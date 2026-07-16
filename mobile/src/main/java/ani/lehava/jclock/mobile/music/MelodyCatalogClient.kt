package ani.lehava.jclock.mobile.music

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.time.Instant

/** Blocking R2 catalog client. Call from a worker thread. */
class MelodyCatalogClient(
    rootUrl: String = DEFAULT_ROOT_URL,
    private val connectTimeoutMillis: Int = 10_000,
    private val readTimeoutMillis: Int = 30_000,
) {
    data class Entry(val name: String, val bytes: Long?)

    data class Catalog(
        val folder: String,
        val entries: List<Entry>,
    )

    private val root = URL(if (rootUrl.endsWith('/')) rootUrl else "$rootUrl/")

    fun fetchForWindow(window: HebrewMelodySchedule.Window): Catalog = fetchMonth(window.folder)

    fun fetchMonth(folder: String): Catalog {
        require(FOLDER_PATTERN.matches(folder)) { "Invalid melody folder: $folder" }

        val rootManifest = runCatching { fetchJson(URL(root, "manifest.json")) }.getOrNull()
        if (rootManifest != null) {
            val entries = entriesFromManifest(rootManifest, folder)
            if (entries.isNotEmpty()) return Catalog(folder, entries)
        }

        val monthManifest = fetchJson(URL(root, "$folder/manifest.json"))
        return Catalog(folder, entriesFromManifest(monthManifest, folder))
    }

    fun trackUrl(folder: String, entry: Entry, expiresAt: Instant): URL {
        require(FOLDER_PATTERN.matches(folder)) { "Invalid melody folder: $folder" }
        require(validAudioName(entry.name)) { "Invalid melody filename" }
        val encodedPath = URI(null, null, "/$folder/${entry.name}", null).rawPath.removePrefix("/")
        val query = buildList {
            entry.bytes?.let { add("bytes=$it") }
            add("expires=${expiresAt.toEpochMilli()}")
        }.joinToString("&")
        return URL(root, "$encodedPath?$query")
    }

    internal fun entriesFromManifest(manifest: JSONObject, folder: String): List<Entry> {
        val files = manifest.optJSONArray("files")
            ?: manifest.optJSONObject("months")?.optJSONArray(folder)
            ?: JSONArray()
        val sizesRoot = manifest.optJSONObject("fileSizes")
        val sizes = sizesRoot?.optJSONObject(folder) ?: sizesRoot
        val result = ArrayList<Entry>(files.length())

        for (index in 0 until files.length()) {
            val value = files.opt(index)
            val name: String
            val rawBytes: Any?
            if (value is JSONObject) {
                name = sequenceOf("name", "file", "path")
                    .map { value.optString(it, "").trim() }
                    .firstOrNull { it.isNotEmpty() }
                    .orEmpty()
                rawBytes = sequenceOf("bytes", "size", "length")
                    .map { value.opt(it) }
                    .firstOrNull { it != null && it != JSONObject.NULL }
                    ?: sizes?.opt(name)
            } else {
                name = value?.toString()?.trim().orEmpty()
                rawBytes = sizes?.opt(name)
            }
            if (!validAudioName(name)) continue
            result += Entry(name, exactByteSize(rawBytes))
        }
        return result
    }

    private fun fetchJson(url: URL): JSONObject {
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            instanceFollowRedirects = true
            connectTimeout = connectTimeoutMillis
            readTimeout = readTimeoutMillis
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IOException("Melody manifest HTTP $status")
            val output = ByteArrayOutputStream()
            connection.inputStream.use { input ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var total = 0
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    if (total > MAX_MANIFEST_BYTES) throw IOException("Melody manifest is too large")
                    output.write(buffer, 0, count)
                }
            }
            return JSONObject(output.toString(Charsets.UTF_8.name()))
        } finally {
            connection.disconnect()
        }
    }

    private fun exactByteSize(value: Any?): Long? {
        val number = when (value) {
            is Byte, is Short, is Int, is Long -> (value as Number).toLong()
            is Number -> {
                val decimal = value.toDouble()
                val integer = decimal.toLong()
                integer.takeIf { decimal.isFinite() && integer.toDouble() == decimal }
            }
            is String -> value.toLongOrNull()
            else -> null
        }
        return number?.takeIf { it in 0L..MAX_SAFE_INTEGER }
    }

    private fun validAudioName(name: String): Boolean =
        name.isNotBlank() && !name.contains('/') && !name.contains('\\') && AUDIO_PATTERN.matches(name)

    companion object {
        const val DEFAULT_ROOT_URL = "https://pub-71e18ce829fd428ea6d4aa9498a7e642.r2.dev/"
        private const val MAX_MANIFEST_BYTES = 2 * 1024 * 1024
        private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991L
        private val FOLDER_PATTERN = Regex("\\d{2}")
        private val AUDIO_PATTERN = Regex("[^/\\\\]+\\.(wav|mp3|ogg)", RegexOption.IGNORE_CASE)
    }
}
