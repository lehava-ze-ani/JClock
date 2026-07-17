package ani.lehava.jclock.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject

object LearningLinkDispatcher {
    private const val BIRTH_CALCULATOR = "https://jclock.net/BirthCalculator/public/he/index.html"

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

    private fun personalLearning(body: JSONObject): Uri = Uri.parse(BIRTH_CALCULATOR).buildUpon()
        .appendQueryParameter("date", body.optString("date"))
        .appendQueryParameter("time", body.optString("time"))
        .appendQueryParameter("timeZone", body.optString("timeZone", "Asia/Jerusalem"))
        .appendQueryParameter("auto", "1")
        .build()

    /** Opens the personal-learning calculation inside the secured JClock WebView. */
    fun forward(context: Context, body: JSONObject) {
        context.startActivity(
            JClockWebActivity.intent(context, personalLearning(body).toString())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
