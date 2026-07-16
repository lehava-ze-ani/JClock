package ani.lehava.jclock.mobile.music

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import java.io.Closeable
import java.time.Instant
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import kotlin.random.Random

/** Native Android melody playback. It never creates or communicates with a WebView. */
class MelodyPlayer(
    private val schedule: HebrewMelodySchedule,
    private val catalogClient: MelodyCatalogClient,
    private val cache: MelodyCache,
    private val trackGapMillis: Long = 6_000L,
    private val worker: ExecutorService = Executors.newSingleThreadExecutor(),
    private val mainHandler: Handler = Handler(Looper.getMainLooper()),
    private val onStateChanged: (State) -> Unit = {},
) : Closeable {
    sealed class State {
        data object Idle : State()
        data object LoadingCatalog : State()
        data class Downloading(val name: String) : State()
        data class Playing(val name: String, val folder: String) : State()
        data object Paused : State()
        data class Error(val message: String) : State()
        data object Closed : State()
    }

    private val generation = AtomicLong(0L)
    private var mediaPlayer: MediaPlayer? = null
    private var catalog: MelodyCatalogClient.Catalog? = null
    private var catalogExpiry: Instant? = null
    private var lastTrackName: String? = null
    private var playRequested = false
    private var closed = false
    private var volume = 0.28f

    fun start() {
        runOnMain {
            if (closed) return@runOnMain
            playRequested = true
            val current = mediaPlayer
            if (current != null) {
                runCatching { current.start() }
                    .onSuccess { publish(State.Playing(lastTrackName.orEmpty(), catalog?.folder.orEmpty())) }
                    .onFailure { prepareNext(0L) }
            } else {
                prepareNext(0L)
            }
        }
    }

    fun pause() {
        runOnMain {
            if (closed) return@runOnMain
            playRequested = false
            generation.incrementAndGet()
            mainHandler.removeCallbacksAndMessages(this)
            runCatching { mediaPlayer?.pause() }
            publish(State.Paused)
        }
    }

    fun setVolume(value: Float) {
        runOnMain {
            volume = value.coerceIn(0f, 1f)
            mediaPlayer?.setVolume(volume, volume)
        }
    }

    fun skip() {
        runOnMain {
            if (closed || !playRequested) return@runOnMain
            releasePlayer()
            prepareNext(0L)
        }
    }

    /** Forces a fresh no-store manifest read on the next track. */
    fun refreshCatalog() {
        runOnMain {
            catalog = null
            catalogExpiry = null
            if (playRequested && mediaPlayer == null) prepareNext(0L)
        }
    }

    override fun close() {
        runOnMain {
            if (closed) return@runOnMain
            closed = true
            playRequested = false
            generation.incrementAndGet()
            mainHandler.removeCallbacksAndMessages(this)
            releasePlayer()
            worker.shutdownNow()
            publish(State.Closed)
        }
    }

    private fun prepareNext(delayMillis: Long) {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!playRequested || closed) return
        val token = generation.incrementAndGet()
        mainHandler.postAtTime({ loadNext(token) }, this, android.os.SystemClock.uptimeMillis() + delayMillis)
    }

    private fun loadNext(token: Long) {
        if (!isCurrent(token)) return
        publish(State.LoadingCatalog)
        worker.execute {
            try {
                val now = Instant.now()
                val window = schedule.window(now)
                cache.cleanExpired(now)
                var activeCatalog = catalog
                if (
                    activeCatalog == null ||
                    activeCatalog.folder != window.folder ||
                    catalogExpiry != window.expiresAt
                ) {
                    activeCatalog = catalogClient.fetchForWindow(window)
                    if (activeCatalog.entries.isEmpty()) error("No melodies for folder ${window.folder}")
                    catalog = activeCatalog
                    catalogExpiry = window.expiresAt
                }
                val entry = selectEntry(activeCatalog.entries)
                postIfCurrent(token) { publish(State.Downloading(entry.name)) }
                val cached = cache.find(window.folder, entry, window.expiresAt, now)
                if (cached != null) {
                    postIfCurrent(token) { playFile(token, cached) }
                } else {
                    val source = catalogClient.trackUrl(window.folder, entry, window.expiresAt)
                    postIfCurrent(token) {
                        playSource(token, entry.name, window.folder, source.toString())
                    }
                }
            } catch (error: Throwable) {
                postIfCurrent(token) {
                    publish(State.Error(error.message ?: "Could not play melody"))
                    if (playRequested) prepareNext(RETRY_DELAY_MILLIS)
                }
            }
        }
    }

    private fun selectEntry(entries: List<MelodyCatalogClient.Entry>): MelodyCatalogClient.Entry {
        if (entries.size == 1) return entries.first()
        val candidates = entries.filterNot { it.name == lastTrackName }.ifEmpty { entries }
        return candidates[Random.Default.nextInt(candidates.size)]
    }

    private fun playFile(token: Long, melody: MelodyCache.CachedMelody) {
        playSource(token, melody.entry.name, catalog?.folder.orEmpty(), melody.file.absolutePath)
    }

    /**
     * MediaPlayer progressively reads HTTPS sources, so a 25-45 MB WAV starts
     * after buffering instead of blocking until the entire file is downloaded.
     */
    private fun playSource(token: Long, name: String, folder: String, source: String) {
        if (!isCurrent(token)) return
        releasePlayer()
        val player = MediaPlayer()
        mediaPlayer = player
        try {
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build(),
            )
            player.setDataSource(source)
            player.setVolume(volume, volume)
            player.setOnPreparedListener { prepared ->
                if (!isCurrent(token) || !playRequested) return@setOnPreparedListener
                lastTrackName = name
                prepared.start()
                publish(State.Playing(name, folder))
            }
            player.setOnCompletionListener {
                if (mediaPlayer === it) mediaPlayer = null
                it.release()
                if (playRequested && !closed) prepareNext(trackGapMillis)
            }
            player.setOnErrorListener { failed, what, extra ->
                if (mediaPlayer === failed) mediaPlayer = null
                failed.release()
                publish(State.Error("MediaPlayer error $what/$extra"))
                if (playRequested && !closed) prepareNext(RETRY_DELAY_MILLIS)
                true
            }
            player.prepareAsync()
        } catch (error: Throwable) {
            releasePlayer()
            publish(State.Error(error.message ?: "Could not prepare melody"))
            if (playRequested) prepareNext(RETRY_DELAY_MILLIS)
        }
    }

    private fun releasePlayer() {
        val player = mediaPlayer ?: return
        mediaPlayer = null
        runCatching { player.reset() }
        runCatching { player.release() }
    }

    private fun isCurrent(token: Long): Boolean = !closed && playRequested && generation.get() == token

    private fun postIfCurrent(token: Long, action: () -> Unit) {
        mainHandler.post {
            if (isCurrent(token)) action()
        }
    }

    private fun publish(state: State) {
        if (Looper.myLooper() == Looper.getMainLooper()) onStateChanged(state)
        else mainHandler.post { onStateChanged(state) }
    }

    private fun runOnMain(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) action() else mainHandler.post(action)
    }

    companion object {
        private const val RETRY_DELAY_MILLIS = 1_500L
    }
}
