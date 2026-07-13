package ani.lehava.jclock.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject
import java.util.TimeZone

class PhoneLocationService : WearableListenerService() {
    private companion object {
        const val EMAIL_RECIPIENT = "kidush.lavana007@gmail.com"
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == "/jclock/learning/open") {
            val body = runCatching { JSONObject(String(event.data, Charsets.UTF_8)) }.getOrNull() ?: return
            val url = Uri.parse("https://jclock.net/BirthCalculator/public/he/index.html").buildUpon()
                .appendQueryParameter("date", body.optString("date"))
                .appendQueryParameter("time", body.optString("time"))
                .appendQueryParameter("timeZone", body.optString("timeZone"))
                .appendQueryParameter("auto", "1")
                .build()
            val email = Uri.parse("mailto:").buildUpon()
                .appendQueryParameter("to", EMAIL_RECIPIENT)
                .appendQueryParameter("subject", "JClock - חישוב מולד")
                .appendQueryParameter("body", url.toString())
                .build()
            startActivity(Intent(Intent.ACTION_SENDTO, email).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            return
        }
        if (event.path != "/jclock/location/request") return
        val allowed = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!allowed) return respond(event.sourceNodeId, JSONObject().put("error", "יש לאפשר מיקום בטלפון"))
        LocationServices.getFusedLocationProviderClient(this)
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                if (location == null) respond(event.sourceNodeId, JSONObject().put("error", "המיקום בטלפון אינו זמין"))
                else respond(event.sourceNodeId, JSONObject().put("latitude", location.latitude).put("longitude", location.longitude).put("accuracy", location.accuracy).put("timeZone", TimeZone.getDefault().id))
            }.addOnFailureListener { respond(event.sourceNodeId, JSONObject().put("error", "המיקום בטלפון אינו זמין")) }
    }
    private fun respond(node: String, body: JSONObject) { Wearable.getMessageClient(this).sendMessage(node, "/jclock/location/response", body.toString().toByteArray()) }
}
