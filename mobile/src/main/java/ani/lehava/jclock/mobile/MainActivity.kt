package ani.lehava.jclock.mobile

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    private val permission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { render() }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        render()
    }

    private fun birthUrl(): String {
        val now = ZonedDateTime.now()
        return Uri.parse("https://jclock.net/BirthCalculator/public/he/index.html").buildUpon()
            .appendQueryParameter("date", now.format(DateTimeFormatter.ISO_LOCAL_DATE))
            .appendQueryParameter("time", now.format(DateTimeFormatter.ofPattern("HH:mm")))
            .appendQueryParameter("timeZone", now.zone.id)
            .appendQueryParameter("auto", "1")
            .build().toString()
    }

    private fun render() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = android.view.View.LAYOUT_DIRECTION_RTL
            setPadding(48, 72, 48, 48)
        }
        layout.addView(TextView(this).apply {
            text = "JClock\n\nהאפליקציה מעבירה ל־BirthCalculator את התאריך, השעה ואזור הזמן. האתר מבצע את ההמרה לזמן ירושלים ואת חישוב השעה העברית."
            textSize = 19f
        })
        layout.addView(Button(this).apply {
            text = "פתח יחידת לימוד"
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(birthUrl()))) }
        })
        layout.addView(Button(this).apply {
            text = "שתף קישור ב־WhatsApp"
            setOnClickListener {
                val share = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, birthUrl())
                    setPackage("com.whatsapp")
                }
                runCatching { startActivity(share) }.getOrElse {
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, birthUrl())
                    }, "שיתוף הקישור"))
                }
            }
        })
        setContentView(layout)
    }
}
