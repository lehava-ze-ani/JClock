package ani.lehava.jclock.mobile.music

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.time.Instant
import java.util.Properties

/**
 * Disk cache for original melody bytes. Entries remain usable until their explicit
 * Hebrew-month deadline, and are rejected if their byte signature no longer matches.
 * All public operations are blocking and should run off the main thread.
 */
class MelodyCache(
    private val directory: File,
    private val catalogClient: MelodyCatalogClient,
    private val connectTimeoutMillis: Int = 15_000,
    private val readTimeoutMillis: Int = 60_000,
) {
    data class CachedMelody(
        val file: File,
        val entry: MelodyCatalogClient.Entry,
        val expiresAt: Instant,
        val sourceUrl: URL,
    )

    @Synchronized
    fun getOrDownload(
        folder: String,
        entry: MelodyCatalogClient.Entry,
        expiresAt: Instant,
        now: Instant = Instant.now(),
    ): CachedMelody {
        require(expiresAt.isAfter(now)) { "Melody cache deadline has passed" }
        ensureDirectory()
        cleanExpired(now)

        val sourceUrl = catalogClient.trackUrl(folder, entry, expiresAt)
        val key = cacheKey(sourceUrl)
        val extension = entry.name.substringAfterLast('.', "audio").lowercase()
        val audioFile = File(directory, "$key.$extension")
        val metadataFile = File(directory, "$key.properties")
        if (validExistingEntry(audioFile, metadataFile, entry, expiresAt, sourceUrl, now)) {
            return CachedMelody(audioFile, entry, expiresAt, sourceUrl)
        }
        deletePair(audioFile, metadataFile)

        val temporaryAudio = File(directory, "$key.download")
        val temporaryMetadata = File(directory, "$key.properties.tmp")
        temporaryAudio.delete()
        temporaryMetadata.delete()
        try {
            val actualBytes = download(sourceUrl, temporaryAudio, entry.bytes)
            moveReplacing(temporaryAudio, audioFile)
            writeMetadata(
                temporaryMetadata,
                mapOf(
                    "name" to entry.name,
                    "bytes" to actualBytes.toString(),
                    "expectedBytes" to (entry.bytes?.toString() ?: ""),
                    "expiresAt" to expiresAt.toEpochMilli().toString(),
                    "sourceUrl" to sourceUrl.toString(),
                ),
            )
            moveReplacing(temporaryMetadata, metadataFile)
            return CachedMelody(audioFile, entry, expiresAt, sourceUrl)
        } catch (error: Throwable) {
            temporaryAudio.delete()
            temporaryMetadata.delete()
            deletePair(audioFile, metadataFile)
            throw error
        }
    }

    @Synchronized
    fun find(
        folder: String,
        entry: MelodyCatalogClient.Entry,
        expiresAt: Instant,
        now: Instant = Instant.now(),
    ): CachedMelody? {
        if (!expiresAt.isAfter(now)) return null
        ensureDirectory()
        val sourceUrl = catalogClient.trackUrl(folder, entry, expiresAt)
        val key = cacheKey(sourceUrl)
        val extension = entry.name.substringAfterLast('.', "audio").lowercase()
        val audioFile = File(directory, "$key.$extension")
        val metadataFile = File(directory, "$key.properties")
        return if (validExistingEntry(audioFile, metadataFile, entry, expiresAt, sourceUrl, now)) {
            CachedMelody(audioFile, entry, expiresAt, sourceUrl)
        } else {
            null
        }
    }

    @Synchronized
    fun cleanExpired(now: Instant = Instant.now()): Int {
        ensureDirectory()
        var removed = 0
        val metadataFiles = directory.listFiles { file -> file.isFile && file.name.endsWith(".properties") }
            ?: emptyArray()
        val liveKeys = HashSet<String>()
        for (metadataFile in metadataFiles) {
            val key = metadataFile.name.removeSuffix(".properties")
            liveKeys += key
            val properties = readMetadata(metadataFile)
            val expiresAt = properties?.getProperty("expiresAt")?.toLongOrNull()
            val audio = directory.listFiles { file ->
                file.isFile && file.name.startsWith("$key.") && !file.name.endsWith(".properties")
            }?.firstOrNull()
            if (expiresAt == null || now.toEpochMilli() >= expiresAt || audio == null || !audio.exists()) {
                if (audio?.delete() == true) removed += 1
                if (metadataFile.delete()) removed += 1
            }
        }

        directory.listFiles()?.forEach { file ->
            val isTemporary = file.name.endsWith(".download") || file.name.endsWith(".tmp")
            val key = file.name.substringBefore('.')
            val orphanAudio = file.isFile && !isTemporary && !file.name.endsWith(".properties") && key !in liveKeys
            if ((isTemporary || orphanAudio) && file.delete()) removed += 1
        }
        return removed
    }

    private fun validExistingEntry(
        audioFile: File,
        metadataFile: File,
        entry: MelodyCatalogClient.Entry,
        expiresAt: Instant,
        sourceUrl: URL,
        now: Instant,
    ): Boolean {
        if (!audioFile.isFile || !metadataFile.isFile || !expiresAt.isAfter(now)) return false
        val metadata = readMetadata(metadataFile) ?: return false
        val storedExpiry = metadata.getProperty("expiresAt")?.toLongOrNull() ?: return false
        val storedBytes = metadata.getProperty("bytes")?.toLongOrNull() ?: return false
        if (storedExpiry != expiresAt.toEpochMilli() || storedBytes != audioFile.length()) return false
        if (metadata.getProperty("sourceUrl") != sourceUrl.toString()) return false
        if (metadata.getProperty("name") != entry.name) return false
        return entry.bytes == null || entry.bytes == audioFile.length()
    }

    private fun download(url: URL, destination: File, expectedBytes: Long?): Long {
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            instanceFollowRedirects = true
            connectTimeout = connectTimeoutMillis
            readTimeout = readTimeoutMillis
            useCaches = false
            setRequestProperty("Accept", "audio/*")
            setRequestProperty("Cache-Control", "no-cache")
        }
        try {
            val status = connection.responseCode
            if (status != HttpURLConnection.HTTP_OK) throw IOException("Melody download HTTP $status")
            val headerLength = connection.contentLengthLong.takeIf { it >= 0L }
            if (expectedBytes != null && headerLength != null && headerLength != expectedBytes) {
                throw IOException("Melody Content-Length mismatch: expected $expectedBytes, got $headerLength")
            }

            var total = 0L
            connection.inputStream.use { input ->
                FileOutputStream(destination).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        if (expectedBytes != null && total > expectedBytes) {
                            throw IOException("Melody is larger than its byte signature")
                        }
                        output.write(buffer, 0, count)
                    }
                    output.fd.sync()
                }
            }
            if (expectedBytes != null && total != expectedBytes) {
                throw IOException("Melody byte mismatch: expected $expectedBytes, got $total")
            }
            return total
        } finally {
            connection.disconnect()
        }
    }

    private fun writeMetadata(file: File, values: Map<String, String>) {
        val properties = Properties()
        values.forEach(properties::setProperty)
        FileOutputStream(file).use { output ->
            properties.store(output, "Way Back To Heaven melody cache")
            output.fd.sync()
        }
    }

    private fun readMetadata(file: File): Properties? = runCatching {
        Properties().apply { file.inputStream().use(::load) }
    }.getOrNull()

    private fun moveReplacing(source: File, target: File) {
        Files.move(source.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
    }

    private fun cacheKey(url: URL): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(url.toString().toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun deletePair(audio: File, metadata: File) {
        audio.delete()
        metadata.delete()
    }

    private fun ensureDirectory() {
        if ((!directory.exists() && !directory.mkdirs()) || !directory.isDirectory) {
            throw IOException("Could not create melody cache directory: $directory")
        }
    }
}
