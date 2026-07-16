package ani.lehava.jclock.mobile

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/** Keeps the phone's cached location current while the user enables mobile mode. */
class MobileLocationService : Service() {
    private val locationClient by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private var receivingUpdates = false
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { PhoneLocationRepository.saveLocation(applicationContext, it) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        if (!canRun()) {
            stopSelf()
            return
        }
        startAsForeground()
        startLocationUpdates()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!canRun()) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (!receivingUpdates) startLocationUpdates()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (receivingUpdates) {
            locationClient.removeLocationUpdates(locationCallback)
            receivingUpdates = false
        }
        super.onDestroy()
    }

    private fun canRun(): Boolean =
        PhoneLocationRepository.isMobileLocationEnabled(this) &&
            PhoneLocationRepository.hasLocationPermission(this)

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        if (!canRun() || receivingUpdates) return
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MILLIS)
            .setMinUpdateIntervalMillis(UPDATE_INTERVAL_MILLIS)
            .setWaitForAccurateLocation(false)
            .build()
        receivingUpdates = true
        locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            .addOnFailureListener {
                receivingUpdates = false
                stopSelf()
            }
    }

    private fun startAsForeground() {
        val notification = createNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL,
                "JClock mobile location",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Updates the JClock watch location while mobile mode is enabled"
                setShowBadge(false)
            },
        )
        return Notification.Builder(this, NOTIFICATION_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("JClock · מיקום נייד")
            .setContentText("המיקום נשלח לחישוב השעון כל 6 שניות")
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }

    companion object {
        private const val UPDATE_INTERVAL_MILLIS = 6_000L
        private const val NOTIFICATION_CHANNEL = "jclock_mobile_location"
        private const val NOTIFICATION_ID = 4_378

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, MobileLocationService::class.java),
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MobileLocationService::class.java))
        }
    }
}
