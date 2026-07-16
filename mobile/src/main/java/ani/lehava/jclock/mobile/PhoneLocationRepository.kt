package ani.lehava.jclock.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.gms.tasks.Tasks
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/** Shared source of truth for phone locations consumed by Wear and Zepp. */
object PhoneLocationRepository {
    enum class Mode(val wireValue: String) {
        FIXED("fixed"),
        MOBILE("mobile"),
        JERUSALEM("jerusalem");

        companion object {
            fun fromWireValue(value: String): Mode? = entries.firstOrNull { it.wireValue == value }
        }
    }

    data class Snapshot(
        val mode: Mode,
        val latitude: Double?,
        val longitude: Double?,
        val accuracy: Float?,
        val capturedAt: Long?,
        val timeZone: String,
        val utcOffsetSeconds: Int,
        val mobileLocationEnabled: Boolean,
        val updated: Boolean,
    )

    sealed class Failure(message: String) : Exception(message) {
        class PermissionDenied : Failure("phone location permission is required")
        class LocationUnavailable : Failure("phone location is unavailable")
    }

    private data class StoredFix(
        val latitude: Double,
        val longitude: Double,
        val accuracy: Float?,
        val capturedAt: Long,
    )

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun isMobileLocationEnabled(context: Context): Boolean =
        preferences(context).getBoolean(KEY_MOBILE_LOCATION_ENABLED, false)

    fun setMobileLocationEnabled(context: Context, enabled: Boolean) {
        preferences(context).edit().putBoolean(KEY_MOBILE_LOCATION_ENABLED, enabled).apply()
    }

    /** Called by [MobileLocationService] whenever Android supplies a new fix. */
    fun saveLocation(context: Context, location: Location) {
        val fix = location.toStoredFix() ?: return
        saveFix(context, fix)
    }

    /**
     * Resolves a Zepp request synchronously. This method must be called off the
     * main thread; the loopback receiver invokes it from its client pool.
     */
    fun resolve(context: Context, mode: Mode): Snapshot = when (mode) {
        Mode.FIXED -> resolveFixed(context)
        Mode.MOBILE -> resolveMobile(context)
        Mode.JERUSALEM -> jerusalemSnapshot(context)
    }

    @SuppressLint("MissingPermission")
    private fun resolveFixed(context: Context): Snapshot {
        if (!hasLocationPermission(context)) throw Failure.PermissionDenied()

        val client = LocationServices.getFusedLocationProviderClient(context)
        val cancellation = CancellationTokenSource()
        val current = try {
            Tasks.await(
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token),
                CURRENT_LOCATION_TIMEOUT_SECONDS,
                TimeUnit.SECONDS,
            )
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            cancellation.cancel()
            null
        } catch (_: Exception) {
            cancellation.cancel()
            null
        }?.toStoredFix()

        if (current != null) {
            saveFix(context, current)
            return localSnapshot(context, Mode.FIXED, current)
        }

        val cached = readFix(context)
        val last = try {
            Tasks.await(client.lastLocation, LAST_LOCATION_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            null
        } catch (_: Exception) {
            null
        }?.toStoredFix()

        val fallback = listOfNotNull(cached, last).maxByOrNull { it.capturedAt }
            ?: throw Failure.LocationUnavailable()
        saveFix(context, fallback)
        return localSnapshot(context, Mode.FIXED, fallback)
    }

    private fun resolveMobile(context: Context): Snapshot {
        if (!isMobileLocationEnabled(context)) return emptyMobileSnapshot(context, enabled = false)
        if (!hasLocationPermission(context)) throw Failure.PermissionDenied()
        val fix = readFix(context) ?: return emptyMobileSnapshot(context, enabled = true)
        return localSnapshot(context, Mode.MOBILE, fix)
    }

    private fun emptyMobileSnapshot(context: Context, enabled: Boolean): Snapshot {
        val now = System.currentTimeMillis()
        val zone = ZoneId.systemDefault()
        return Snapshot(
            mode = Mode.MOBILE,
            latitude = null,
            longitude = null,
            accuracy = null,
            capturedAt = null,
            timeZone = zone.id,
            utcOffsetSeconds = zone.rules.getOffset(Instant.ofEpochMilli(now)).totalSeconds,
            mobileLocationEnabled = enabled,
            updated = false,
        )
    }

    private fun jerusalemSnapshot(context: Context): Snapshot {
        val now = System.currentTimeMillis()
        val zone = ZoneId.of(JERUSALEM_TIME_ZONE)
        return Snapshot(
            mode = Mode.JERUSALEM,
            latitude = JERUSALEM_LATITUDE,
            longitude = JERUSALEM_LONGITUDE,
            accuracy = null,
            capturedAt = now,
            timeZone = zone.id,
            utcOffsetSeconds = zone.rules.getOffset(Instant.ofEpochMilli(now)).totalSeconds,
            mobileLocationEnabled = isMobileLocationEnabled(context),
            updated = true,
        )
    }

    private fun localSnapshot(context: Context, mode: Mode, fix: StoredFix): Snapshot {
        val now = System.currentTimeMillis()
        val zone = ZoneId.systemDefault()
        return Snapshot(
            mode = mode,
            latitude = fix.latitude,
            longitude = fix.longitude,
            accuracy = fix.accuracy,
            capturedAt = fix.capturedAt,
            timeZone = zone.id,
            utcOffsetSeconds = zone.rules.getOffset(Instant.ofEpochMilli(now)).totalSeconds,
            mobileLocationEnabled = isMobileLocationEnabled(context),
            updated = true,
        )
    }

    private fun Location.toStoredFix(): StoredFix? {
        if (!latitude.isFinite() || latitude !in -90.0..90.0) return null
        if (!longitude.isFinite() || longitude !in -180.0..180.0) return null
        return StoredFix(
            latitude = latitude,
            longitude = longitude,
            accuracy = if (hasAccuracy() && accuracy.isFinite() && accuracy >= 0f) accuracy else null,
            capturedAt = time.takeIf { it > 0L } ?: System.currentTimeMillis(),
        )
    }

    private fun saveFix(context: Context, fix: StoredFix) {
        preferences(context).edit()
            .putLong(KEY_LATITUDE, fix.latitude.toRawBits())
            .putLong(KEY_LONGITUDE, fix.longitude.toRawBits())
            .putLong(KEY_CAPTURED_AT, fix.capturedAt)
            .apply {
                if (fix.accuracy == null) remove(KEY_ACCURACY) else putFloat(KEY_ACCURACY, fix.accuracy)
            }
            .apply()
    }

    private fun readFix(context: Context): StoredFix? {
        val saved = preferences(context)
        if (!saved.contains(KEY_LATITUDE) || !saved.contains(KEY_LONGITUDE)) return null
        val latitude = Double.fromBits(saved.getLong(KEY_LATITUDE, 0L))
        val longitude = Double.fromBits(saved.getLong(KEY_LONGITUDE, 0L))
        if (!latitude.isFinite() || latitude !in -90.0..90.0) return null
        if (!longitude.isFinite() || longitude !in -180.0..180.0) return null
        val accuracy = if (saved.contains(KEY_ACCURACY)) saved.getFloat(KEY_ACCURACY, 0f) else null
        return StoredFix(
            latitude = latitude,
            longitude = longitude,
            accuracy = accuracy,
            capturedAt = saved.getLong(KEY_CAPTURED_AT, 0L).takeIf { it > 0L } ?: 0L,
        )
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    private const val PREFERENCES = "jclock-location"
    private const val KEY_MOBILE_LOCATION_ENABLED = "mobile_location_enabled"
    private const val KEY_LATITUDE = "last_latitude"
    private const val KEY_LONGITUDE = "last_longitude"
    private const val KEY_ACCURACY = "last_accuracy"
    private const val KEY_CAPTURED_AT = "last_captured_at"
    private const val CURRENT_LOCATION_TIMEOUT_SECONDS = 10L
    private const val LAST_LOCATION_TIMEOUT_SECONDS = 2L
    private const val JERUSALEM_TIME_ZONE = "Asia/Jerusalem"
    private const val JERUSALEM_LATITUDE = 31.7768514
    private const val JERUSALEM_LONGITUDE = 35.2331664
}
