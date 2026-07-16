package ani.lehava.jclock.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject

object LearningLinkDispatcher {
    private const val BIRTH_CALCULATOR = "https://jclock.net/BirthCalculator/public/he/index.html"
    private const val EMAIL_RECIPIENT = "kidush.lavana007@gmail.com"

    const val SUN_TITLE = "שעון חמה:\nמה צריך להיות באמת יעד המשימה?"
    const val MOON_TITLE = "שעון הלבנה:\nמה גרם לנו לעצור את השעון?"

    data class Links(val sun: Uri, val moon: Uri)

    fun links(body: JSONObject): Links {
        val date = body.optString("date")
        val time = body.optString("time")
        val timeZone = body.optString("timeZone", "Asia/Jerusalem")

        fun build(gender: String, title: String): Uri = Uri.parse(BIRTH_CALCULATOR).buildUpon()
            .appendQueryParameter("date", date)
            .appendQueryParameter("time", time)
            .appendQueryParameter("timeZone", timeZone)
            .appendQueryParameter("auto", "1")
            .appendQueryParameter("gender", gender)
            .appendQueryParameter("ytitle", title)
            .build()

        return Links(
            sun = build(gender = "man", title = SUN_TITLE),
            moon = build(gender = "woman", title = MOON_TITLE),
        )
    }

    /** Preserves the existing forwarding flow, now with two links for one frozen instant. */
    fun forward(context: Context, body: JSONObject) {
        val links = links(body)
        val message = buildString {
            append("שעון חמה:\n")
            append(links.sun)
            append("\n\nשעון הלבנה:\n")
            append(links.moon)
        }
        val email = Uri.parse("mailto:").buildUpon()
            .appendQueryParameter("to", EMAIL_RECIPIENT)
            .appendQueryParameter("subject", "JClock - חישוב מולד")
            .appendQueryParameter("body", message)
            .build()
        context.startActivity(
            Intent(Intent.ACTION_SENDTO, email).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
