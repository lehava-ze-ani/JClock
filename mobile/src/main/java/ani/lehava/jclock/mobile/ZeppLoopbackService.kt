package ani.lehava.jclock.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import ani.lehava.jclock.mobile.music.MelodyPlaybackController
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.LinkedHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Receives Zepp Side Service commands on the phone itself.
 *
 * The socket is deliberately bound to the IPv4 loopback address. It is not
 * reachable from Wi-Fi, mobile data, Bluetooth peers, or other computers.
 */
class ZeppLoopbackService : Service() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val clientPool: ExecutorService = Executors.newFixedThreadPool(2) { runnable ->
        Thread(runnable, "jclock-zepp-client").apply { isDaemon = true }
    }
    private var serverSocket: ServerSocket? = null
    private var acceptThread: Thread? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, createNotification())
        startLoopbackServer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        runCatching { serverSocket?.close() }
        acceptThread?.interrupt()
        clientPool.shutdownNow()
        super.onDestroy()
    }

    private fun createNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL,
                "JClock watch connection",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Keeps the private Zepp watch connection available"
                setShowBadge(false)
            },
        )
        return Notification.Builder(this, NOTIFICATION_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("JClock")
            .setContentText("Zepp watch connection is active")
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }

    private fun startLoopbackServer() {
        acceptThread = Thread({
            try {
                val socket = ServerSocket().apply {
                    reuseAddress = true
                    bind(
                        InetSocketAddress(
                            InetAddress.getByName(LOOPBACK_ADDRESS),
                            PORT,
                        ),
                        SOCKET_BACKLOG,
                    )
                }
                serverSocket = socket
                Log.i(TAG, "Zepp receiver listening on $LOOPBACK_ADDRESS:$PORT")
                while (!Thread.currentThread().isInterrupted) {
                    val client = socket.accept()
                    clientPool.execute { handleClient(client) }
                }
            } catch (error: Throwable) {
                if (serverSocket?.isClosed != true) {
                    Log.e(TAG, "Zepp loopback receiver stopped", error)
                }
            }
        }, "jclock-zepp-accept").apply {
            isDaemon = true
            start()
        }
    }

    private fun handleClient(socket: Socket) {
        socket.use { client ->
            try {
                client.soTimeout = SOCKET_TIMEOUT_MILLIS
                if (!client.inetAddress.isLoopbackAddress) {
                    throw HttpFailure(403, "loopback clients only")
                }
                val request = readRequest(client)
                val response = route(request)
                writeResponse(client, 200, response)
            } catch (failure: HttpFailure) {
                writeResponse(
                    client,
                    failure.status,
                    JSONObject().put("ok", false).put("error", failure.message),
                )
            } catch (error: Throwable) {
                Log.e(TAG, "Could not process Zepp request", error)
                writeResponse(
                    client,
                    500,
                    JSONObject().put("ok", false).put("error", "internal error"),
                )
            }
        }
    }

    private fun route(request: HttpRequest): JSONObject {
        if (request.method != "POST") throw HttpFailure(405, "POST required")
        val body = runCatching { JSONObject(request.body) }
            .getOrElse { throw HttpFailure(400, "invalid JSON") }

        return when (request.path.substringBefore('?')) {
            SNAPSHOT_PATH -> receiveSnapshot(body)
            MUSIC_PATH -> receiveMusicToggle(body)
            LOCATION_PATH -> receiveLocation(body)
            else -> throw HttpFailure(404, "unknown endpoint")
        }
    }

    private fun receiveSnapshot(body: JSONObject): JSONObject {
        requireProtocol(body, SNAPSHOT_PROTOCOL)
        val eventId = requireEventId(body)
        val normalized = normalizeSnapshot(body)
        val isNew = EventDeduper.accept(applicationContext, "$SNAPSHOT_PROTOCOL:$eventId")
        if (!isNew) return accepted(eventId, duplicate = true)

        // Android requires activity work to enter through the main thread.
        mainHandler.post {
            runCatching { LearningLinkDispatcher.forward(applicationContext, normalized) }
                .onFailure { Log.e(TAG, "Could not forward learning links", it) }
        }
        return accepted(eventId, duplicate = false)
    }

    private fun receiveMusicToggle(body: JSONObject): JSONObject {
        requireProtocol(body, MUSIC_PROTOCOL)
        val eventId = requireEventId(body)
        if (!ZeppMusicControlBridge.isAvailable()) {
            throw HttpFailure(503, "music controller is not ready")
        }
        val isNew = EventDeduper.accept(applicationContext, "$MUSIC_PROTOCOL:$eventId")
        if (!isNew) return accepted(eventId, duplicate = true)

        mainHandler.post {
            runCatching { ZeppMusicControlBridge.toggle(applicationContext) }
                .onFailure { Log.e(TAG, "Could not toggle melody playback", it) }
        }
        return accepted(eventId, duplicate = false)
    }

    private fun receiveLocation(body: JSONObject): JSONObject {
        requireProtocol(body, LOCATION_PROTOCOL)
        val mode = PhoneLocationRepository.Mode.fromWireValue(body.optString("mode").trim())
            ?: throw HttpFailure(422, "invalid location mode")
        val snapshot = try {
            PhoneLocationRepository.resolve(applicationContext, mode)
        } catch (_: PhoneLocationRepository.Failure.PermissionDenied) {
            throw HttpFailure(403, "phone location permission is required")
        } catch (_: PhoneLocationRepository.Failure.LocationUnavailable) {
            throw HttpFailure(503, "phone location is unavailable")
        }

        return JSONObject()
            .put("ok", true)
            .put("mode", snapshot.mode.wireValue)
            .put("latitude", snapshot.latitude ?: JSONObject.NULL)
            .put("longitude", snapshot.longitude ?: JSONObject.NULL)
            .put("accuracy", snapshot.accuracy ?: JSONObject.NULL)
            .put("capturedAt", snapshot.capturedAt ?: JSONObject.NULL)
            .put("timeZone", snapshot.timeZone)
            .put("utcOffsetSeconds", snapshot.utcOffsetSeconds)
            .put("mobileLocationEnabled", snapshot.mobileLocationEnabled)
            .put("updated", snapshot.updated)
    }

    private fun normalizeSnapshot(source: JSONObject): JSONObject {
        val result = JSONObject(source.toString())
        val requestedZone = source.optString("timeZone").ifBlank { ZoneId.systemDefault().id }
        val zone = runCatching { ZoneId.of(requestedZone) }
            .getOrElse { throw HttpFailure(422, "invalid timeZone") }

        val suppliedDate = source.optString("date").trim()
        val suppliedTime = source.optString("time").trim()
        if (suppliedDate.isNotEmpty() && suppliedTime.isNotEmpty()) {
            val date = runCatching { LocalDate.parse(suppliedDate) }
                .getOrElse { throw HttpFailure(422, "invalid date") }
            val time = parseTime(suppliedTime)
            result.put("date", date.format(DateTimeFormatter.ISO_LOCAL_DATE))
            result.put("time", time.format(LINK_TIME_FORMAT))
        } else {
            val epochMillis = epochMillis(source)
                ?: throw HttpFailure(422, "epoch is required when date/time are absent")
            val instant = runCatching { Instant.ofEpochMilli(epochMillis) }
                .getOrElse { throw HttpFailure(422, "invalid epoch") }
            val local = instant.atZone(zone)
            result.put("date", local.format(DateTimeFormatter.ISO_LOCAL_DATE))
            result.put("time", local.format(LINK_TIME_FORMAT))
        }
        result.put("timeZone", zone.id)
        return result
    }

    private fun parseTime(value: String): LocalTime {
        return runCatching { LocalTime.parse(value, DateTimeFormatter.ISO_LOCAL_TIME) }
            .recoverCatching { LocalTime.parse(value, LINK_TIME_FORMAT) }
            .getOrElse { throw HttpFailure(422, "invalid time") }
    }

    private fun epochMillis(body: JSONObject): Long? {
        val names = arrayOf("epochMs", "epochMillis", "epoch")
        for (name in names) {
            if (!body.has(name) || body.isNull(name)) continue
            val raw = body.opt(name)
            val value = when (raw) {
                is Number -> raw.toLong()
                is String -> raw.toLongOrNull()
                else -> null
            } ?: throw HttpFailure(422, "invalid $name")
            return if (name == "epoch" && value in -99_999_999_999L..99_999_999_999L) {
                value * 1_000L
            } else {
                value
            }
        }
        return null
    }

    private fun requireProtocol(body: JSONObject, expected: String) {
        if (body.optString("protocol") != expected) {
            throw HttpFailure(422, "unsupported protocol")
        }
    }

    private fun requireEventId(body: JSONObject): String {
        val eventId = body.optString("eventId").trim()
        if (eventId.isEmpty() || eventId.length > MAX_EVENT_ID_LENGTH) {
            throw HttpFailure(422, "invalid eventId")
        }
        return eventId
    }

    private fun accepted(eventId: String, duplicate: Boolean): JSONObject = JSONObject()
        .put("ok", true)
        .put("accepted", true)
        .put("duplicate", duplicate)
        .put("eventId", eventId)

    private fun readRequest(socket: Socket): HttpRequest {
        val input = BufferedInputStream(socket.getInputStream())
        val requestLine = readAsciiLine(input, MAX_REQUEST_LINE_BYTES)
            ?: throw HttpFailure(400, "empty request")
        val requestParts = requestLine.split(' ')
        if (requestParts.size != 3 || !requestParts[2].startsWith("HTTP/1.")) {
            throw HttpFailure(400, "invalid request line")
        }

        val headers = mutableMapOf<String, String>()
        var headerBytes = 0
        while (true) {
            val line = readAsciiLine(input, MAX_HEADER_LINE_BYTES)
                ?: throw HttpFailure(400, "incomplete headers")
            if (line.isEmpty()) break
            headerBytes += line.length
            if (headerBytes > MAX_HEADER_BYTES) throw HttpFailure(431, "headers too large")
            val separator = line.indexOf(':')
            if (separator <= 0) throw HttpFailure(400, "invalid header")
            headers[line.substring(0, separator).trim().lowercase()] =
                line.substring(separator + 1).trim()
        }

        if (headers["transfer-encoding"] != null) {
            throw HttpFailure(400, "chunked requests are not supported")
        }
        val contentLength = headers["content-length"]?.toIntOrNull()
            ?: throw HttpFailure(411, "Content-Length required")
        if (contentLength !in 0..MAX_BODY_BYTES) throw HttpFailure(413, "body too large")
        val bytes = ByteArray(contentLength)
        var read = 0
        while (read < bytes.size) {
            val count = input.read(bytes, read, bytes.size - read)
            if (count < 0) throw HttpFailure(400, "incomplete body")
            read += count
        }
        return HttpRequest(
            method = requestParts[0].uppercase(),
            path = requestParts[1],
            body = String(bytes, StandardCharsets.UTF_8),
        )
    }

    private fun readAsciiLine(input: InputStream, maximum: Int): String? {
        val bytes = ArrayList<Byte>()
        while (bytes.size <= maximum) {
            val value = input.read()
            if (value < 0) return if (bytes.isEmpty()) null else throw HttpFailure(400, "incomplete line")
            if (value == '\n'.code) {
                if (bytes.isNotEmpty() && bytes.last() == '\r'.code.toByte()) {
                    bytes.removeAt(bytes.lastIndex)
                }
                return String(bytes.toByteArray(), StandardCharsets.US_ASCII)
            }
            bytes.add(value.toByte())
        }
        throw HttpFailure(431, "line too large")
    }

    private fun writeResponse(socket: Socket, status: Int, body: JSONObject) {
        runCatching {
            val bytes = body.toString().toByteArray(StandardCharsets.UTF_8)
            val reason = when (status) {
                200 -> "OK"
                400 -> "Bad Request"
                403 -> "Forbidden"
                404 -> "Not Found"
                405 -> "Method Not Allowed"
                411 -> "Length Required"
                413 -> "Payload Too Large"
                422 -> "Unprocessable Content"
                431 -> "Request Header Fields Too Large"
                503 -> "Service Unavailable"
                else -> "Internal Server Error"
            }
            val head = buildString {
                append("HTTP/1.1 $status $reason\r\n")
                append("Content-Type: application/json; charset=utf-8\r\n")
                append("Content-Length: ${bytes.size}\r\n")
                append("Cache-Control: no-store\r\n")
                append("Connection: close\r\n\r\n")
            }.toByteArray(StandardCharsets.US_ASCII)
            socket.getOutputStream().apply {
                write(head)
                write(bytes)
                flush()
            }
        }
    }

    private data class HttpRequest(
        val method: String,
        val path: String,
        val body: String,
    )

    private class HttpFailure(val status: Int, override val message: String) : Exception(message)

    companion object {
        private const val TAG = "JClockZeppReceiver"
        private const val LOOPBACK_ADDRESS = "127.0.0.1"
        private const val PORT = 43_777
        private const val SOCKET_BACKLOG = 8
        private const val SOCKET_TIMEOUT_MILLIS = 5_000
        private const val SNAPSHOT_PATH = "/jclock/zepp/snapshot"
        private const val MUSIC_PATH = "/jclock/zepp/music-toggle"
        private const val LOCATION_PATH = "/jclock/zepp/location"
        private const val SNAPSHOT_PROTOCOL = "jclock.snapshot.v1"
        private const val MUSIC_PROTOCOL = "jclock.music.toggle.v1"
        private const val LOCATION_PROTOCOL = "jclock.location.v1"
        private const val NOTIFICATION_CHANNEL = "jclock_zepp_connection"
        private const val NOTIFICATION_ID = 4_377
        private const val MAX_REQUEST_LINE_BYTES = 2_048
        private const val MAX_HEADER_LINE_BYTES = 4_096
        private const val MAX_HEADER_BYTES = 16_384
        private const val MAX_BODY_BYTES = 65_536
        private const val MAX_EVENT_ID_LENGTH = 200
        private val LINK_TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm")
    }
}

/** Bounded, expiring replay protection for Zepp Side Service retries. */
private object EventDeduper {
    private const val MAX_ENTRIES = 256
    private const val RETENTION_MILLIS = 24L * 60L * 60L * 1_000L
    private const val PREFERENCES = "jclock_zepp_events"
    private const val EVENTS_KEY = "events"
    private val events = LinkedHashMap<String, Long>(MAX_ENTRIES, 0.75f, true)
    private var loaded = false

    @Synchronized
    fun accept(context: Context, key: String, now: Long = System.currentTimeMillis()): Boolean {
        if (!loaded) load(context, now)
        val iterator = events.entries.iterator()
        while (iterator.hasNext()) {
            if (now - iterator.next().value > RETENTION_MILLIS) iterator.remove()
        }
        if (events.containsKey(key)) return false
        events[key] = now
        while (events.size > MAX_ENTRIES) {
            events.remove(events.entries.first().key)
        }
        persist(context)
        return true
    }

    private fun load(context: Context, now: Long) {
        loaded = true
        val saved = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(EVENTS_KEY, null)
            ?: return
        runCatching {
            val json = JSONObject(saved)
            val keys = json.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val timestamp = json.optLong(key, Long.MIN_VALUE)
                if (timestamp != Long.MIN_VALUE && now - timestamp <= RETENTION_MILLIS) {
                    events[key] = timestamp
                }
            }
            while (events.size > MAX_ENTRIES) events.remove(events.entries.first().key)
        }.onFailure {
            events.clear()
        }
    }

    private fun persist(context: Context) {
        val json = JSONObject()
        events.forEach { (key, timestamp) -> json.put(key, timestamp) }
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(EVENTS_KEY, json.toString())
            .apply()
    }
}

/**
 * Stable integration point between the HTTP transport and the native player.
 * Keeping the controller call here avoids coupling the HTTP parser to playback.
 */
object ZeppMusicControlBridge {
    fun isAvailable(): Boolean = true

    fun toggle(context: Context) {
        MelodyPlaybackController.toggle(context)
    }
}
