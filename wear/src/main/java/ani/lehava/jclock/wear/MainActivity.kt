package ani.lehava.jclock.wear

import android.app.Activity
import android.graphics.Canvas
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.icu.util.HebrewCalendar
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.io.File
import java.io.FileOutputStream
import kotlin.math.atan2
import kotlin.math.asin
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan
import kotlin.math.roundToInt

class MainActivity : Activity() {
    private data class ClockReading(
        val hour: Int,
        val part: Int,
        val moment: Int,
        val risingPeriod: Boolean,
    ) {
        fun display(): String = "%02d:%04d:%02d".format(Locale.US, hour % 12, part, moment)
        fun sourceUnits(): Long = hour.toLong() * 1080L * 76L + part.toLong() * 76L + moment
    }

    private data class ClockColors(
        val hour: Int,
        val part: Int,
        val moment: Int,
        val separator: Int = Color.LTGRAY,
    )

    private data class TextSegment(val value: String, val color: Int)

    private data class Mazal(val name: String, val color: Int)

    private lateinit var face: JClockView
    private val clockHandler = Handler(Looper.getMainLooper())
    private val responsePath = "/jclock/location/response"

    private val listener = MessageClient.OnMessageReceivedListener { event ->
        if (event.path == responsePath) runCatching {
            val json = JSONObject(String(event.data, Charsets.UTF_8))
            val lat = json.optDouble("latitude", Double.NaN)
            val lon = json.optDouble("longitude", Double.NaN)
            val timeZone = json.optString("timeZone", "")
            if (!lat.isNaN() && !lon.isNaN()) runOnUiThread { face.setLocal(lat, lon, timeZone) }
        }
    }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.statusBarColor = Color.BLACK
        face = JClockView()
        setContentView(face)
    }

    private fun requestLocation() {
        Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
            if (nodes.isEmpty()) face.showStatus("אין טלפון מחובר")
            else Wearable.getMessageClient(this)
                .sendMessage(nodes.first().id, "/jclock/location/request", byteArrayOf())
                .addOnFailureListener { face.showStatus("המיקום לא זמין") }
        }.addOnFailureListener { face.showStatus("אין טלפון מחובר") }
    }

    private fun openLearningOnPhone(
        epoch: Long,
        zoneId: String,
        sun: String,
        moon: String,
        onSent: () -> Unit,
        onFailed: () -> Unit,
    ) {
        val jerusalemZone = ZoneId.of("Asia/Jerusalem")
        val instant = Instant.ofEpochMilli(epoch).atZone(jerusalemZone)
        val body = JSONObject()
            .put("source", "wear")
            .put("protocol", "jclock.wear.snapshot.v1")
            .put("epochMs", epoch)
            .put("date", instant.toLocalDate().toString())
            .put("time", "%02d:%02d".format(Locale.US, instant.hour, instant.minute))
            .put("timeZone", jerusalemZone.id)
            .put("sourceTimeZone", zoneId)
            .put("sun", JSONObject().put("time", sun))
            .put("moon", JSONObject().put("time", moon))
            .toString().toByteArray(Charsets.UTF_8)
        Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
            if (nodes.isEmpty()) {
                face.showStatus("אין טלפון מחובר")
                onFailed()
            }
            else Wearable.getMessageClient(this)
                .sendMessage(nodes.first().id, "/jclock/learning/open", body)
                .addOnSuccessListener {
                    face.showStatus("נשלח לטלפון")
                    onSent()
                }
                .addOnFailureListener {
                    face.showStatus("השליחה נכשלה")
                    onFailed()
                }
        }.addOnFailureListener {
            face.showStatus("אין טלפון מחובר")
            onFailed()
        }
    }

    override fun onResume() {
        super.onResume()
        Wearable.getMessageClient(this).addListener(listener)
        face.start()
    }

    override fun onPause() {
        face.stop()
        Wearable.getMessageClient(this).removeListener(listener)
        super.onPause()
    }

    private inner class JClockView : View(this) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = android.graphics.Typeface.create("sans", android.graphics.Typeface.NORMAL)
        }
        private val bold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = android.graphics.Typeface.create("sans", android.graphics.Typeface.BOLD)
        }
        private val tick = object : Runnable { override fun run() { invalidate(); clockHandler.postDelayed(this, 1000) } }
        private var offsetSeconds = 0
        private var localMode = false
        private var localLatitude = 31.776852
        private var localLongitude = 35.233166
        private var localTimeZone: String? = null
        private var preciseLocalLocation = false
        private var status = ""
        private var statusUntil = 0L
        private var pausedAt: Long? = null
        private var sendingFrozenTime = false
        private val sourceSwitchStartedAt = SystemClock.elapsedRealtime()
        private val moonImages = arrayOfNulls<Bitmap>(30)

        fun start() { clockHandler.removeCallbacks(tick); clockHandler.post(tick) }
        fun stop() = clockHandler.removeCallbacks(tick)
        fun showStatus(value: String) {
            status = value
            statusUntil = SystemClock.elapsedRealtime() + 2600L
            invalidate()
        }
        fun setLocal(lat: Double, lon: Double, timeZone: String) { localLatitude=lat; localLongitude=lon; localTimeZone=timeZone.ifBlank { null }; preciseLocalLocation=true; localMode = true; status = "מקומי %.2f, %.2f".format(lat, lon); invalidate() }
        private fun activeZone(): ZoneId = if (localMode) ZoneId.of(localTimeZone ?: TimeZone.getDefault().id) else ZoneId.of("Asia/Jerusalem")
        private fun activeLatitude(): Double = if (localMode) localLatitude else 31.776852
        private fun activeLongitude(): Double = if (localMode) localLongitude else 35.233166

        private fun useLocalTimeZoneFallback() {
            val isDebugBuild = (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            val localZone = if (isDebugBuild) ZoneId.of("America/New_York") else ZoneId.systemDefault()
            // בגרסת debug מדמים את מלון צ'לסי; בגרסת הפצה נשארים בירושלים
            // עד שמגיע GPS אמיתי, בלי להסיק קואורדינטות מאזור הזמן.
            localLatitude = if (isDebugBuild) 40.7444 else 31.776852
            localLongitude = if (isDebugBuild) -73.9967 else 35.233166
            localTimeZone = localZone.id
            preciseLocalLocation = isDebugBuild
            localMode = true
        }

        private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int, p: Paint = paint) {
            p.textSize = size; p.color = color; p.textAlign = Paint.Align.CENTER
            canvas.drawText(value, x, y - (p.ascent() + p.descent()) / 2, p)
        }

        /** Largest text size whose full bounding box remains inside the round display. */
        private fun fittedTextSize(value: String, y: Float, preferred: Float, p: Paint = bold): Float {
            val radius = minOf(width, height) / 2f - minOf(width, height) * .025f
            val centerY = height / 2f
            var size = preferred
            repeat(8) {
                p.textSize = size
                val textHeight = p.fontMetrics.descent - p.fontMetrics.ascent
                val farthestY = abs(y - centerY) + textHeight / 2f
                val safeWidth = if (farthestY >= radius) 0f else 2f * sqrt(radius * radius - farthestY * farthestY)
                val measuredWidth = p.measureText(value)
                if (measuredWidth <= safeWidth) return size
                size *= (safeWidth / measuredWidth).coerceIn(.72f, .98f)
            }
            return size
        }

        private fun drawSegments(canvas: Canvas, segments: List<TextSegment>, y: Float, preferredSize: Float) {
            val fullText = segments.joinToString(separator = "") { it.value }
            val size = fittedTextSize(fullText, y, preferredSize, bold)
            bold.textSize = size
            bold.textAlign = Paint.Align.LEFT
            val totalWidth = segments.sumOf { bold.measureText(it.value).toDouble() }.toFloat()
            var x = (width - totalWidth) / 2f
            val baseline = y - (bold.ascent() + bold.descent()) / 2f
            segments.forEach { segment ->
                bold.color = segment.color
                canvas.drawText(segment.value, x, baseline, bold)
                x += bold.measureText(segment.value)
            }
        }

        private fun drawClock(canvas: Canvas, reading: ClockReading, colors: ClockColors, y: Float, preferredSize: Float) {
            drawSegments(
                canvas,
                listOf(
                    TextSegment("%02d".format(Locale.US, reading.hour % 12), colors.hour),
                    TextSegment(":", colors.separator),
                    TextSegment("%04d".format(Locale.US, reading.part), colors.part),
                    TextSegment(":", colors.separator),
                    TextSegment("%02d".format(Locale.US, reading.moment), colors.moment),
                ),
                y,
                preferredSize,
            )
        }

        override fun onDraw(c: Canvas) {
            val w = width.toFloat(); val h = height.toFloat(); val cx = w / 2
            c.drawColor(Color.BLACK)
            paint.style = Paint.Style.FILL

            val epoch = (pausedAt ?: System.currentTimeMillis()) + offsetSeconds * 1000L
            val current = Instant.ofEpochMilli(epoch).atZone(activeZone())
            val sunClock = templeMountSunClock(epoch)
            val moonClock = templeMountMoonClock(epoch)
            val showMoon = moonClock != null && ((SystemClock.elapsedRealtime() - sourceSwitchStartedAt) / 6000L) % 2L == 1L
            val source = if (showMoon) moonClock!! else sunClock
            val molad = moladColors(epoch, source)
            val scale = minOf(w, h) / 454f

            drawSegments(
                c,
                listOf(
                    TextSegment("%02d".format(Locale.US, current.dayOfMonth), molad.first),
                    TextSegment(" / ", Color.LTGRAY),
                    TextSegment("%02d".format(Locale.US, current.monthValue), molad.second),
                ),
                h * .12f,
                50f * scale,
            )
            val civilTime = "%02d:%02d:%02d".format(Locale.US, current.hour, current.minute, current.second)
            val civilSize = fittedTextSize(civilTime, h * .29f, 58f * scale, bold)
            text(c, civilTime, cx, h * .29f, civilSize, Color.LTGRAY, bold)

            paint.color = Color.WHITE
            c.drawRect(0f, h * .50f, w, h * .50f + maxOf(2f, 2f * scale), paint)

            val sunMazal = sunMazal(sunClock, epoch)
            val moonMazal = if (moonClock != null) moonMazal(moonClock, sunClock, epoch) else null
            val statusVisible = status.isNotBlank() && SystemClock.elapsedRealtime() < statusUntil
            val label = when {
                statusVisible -> status
                showMoon -> hebrewDateLabel(epoch)
                else -> sunMazal.name
            }
            val labelColor = when {
                statusVisible -> Color.YELLOW
                showMoon -> if (source.risingPeriod) Color.WHITE else Color.LTGRAY
                else -> Color.LTGRAY
            }
            val labelSize = fittedTextSize(label, h * .60f, 48f * scale, bold)
            text(c, label, cx, h * .60f, labelSize, labelColor, bold)

            val colors = if (showMoon && moonMazal != null) {
                ClockColors(moonMazal.color, moonMazal.color, moonMazal.color, moonMazal.color)
            } else {
                garminSunColors(epoch)
            }
            drawClock(c, source, colors, h * .78f, 54f * scale)
        }

        override fun onTouchEvent(e: MotionEvent): Boolean {
            if (e.action != MotionEvent.ACTION_DOWN) return true
            val frozen = pausedAt
            if (frozen == null) {
                pausedAt = System.currentTimeMillis()
                showStatus("השעון נעצר")
                return true
            }

            if (sendingFrozenTime) return true
            sendingFrozenTime = true
            val sun = templeMountSunClock(frozen)
            val moon = templeMountMoonClock(frozen)
            showStatus("שולח לטלפון")
            openLearningOnPhone(
                frozen,
                activeZone().id,
                sun.display(),
                moon?.display() ?: "--:----:--",
                onSent = {
                    sendingFrozenTime = false
                    pausedAt = null
                    invalidate()
                },
                onFailed = {
                    sendingFrozenTime = false
                    invalidate()
                },
            )
            return true
        }

        private fun hebrewDate(epoch: Long, timeZone: TimeZone): String {
            val zone = activeZone()
            val jerusalemNow = Instant.ofEpochMilli(epoch).atZone(zone)
            val tzeit = sunTimes(jerusalemNow.toLocalDate(), zone, 96.0).second
            val currentHour = jerusalemNow.hour + jerusalemNow.minute / 60.0 + jerusalemNow.second / 3600.0
            val calendar = HebrewCalendar().apply {
                this.timeZone = android.icu.util.TimeZone.getTimeZone(timeZone.id)
                timeInMillis = epoch
                if (currentHour >= tzeit) add(HebrewCalendar.DAY_OF_MONTH, 1)
            }
            val day = calendar.get(HebrewCalendar.DAY_OF_MONTH)
            val month = calendar.get(HebrewCalendar.MONTH)
            val year = calendar.get(HebrewCalendar.YEAR)
            val displayMonth = if (month >= HebrewCalendar.NISAN) month - 6 else month + 7
            val displayYear = year - 3760
            return "%02d-%02d-%04d".format(Locale.US, day, displayMonth, displayYear)
        }

        private fun calculateSourceClock(
            now: Double,
            riseYesterday: Double,
            riseToday: Double,
            riseTomorrow: Double,
            setYesterday: Double,
            setToday: Double,
            setTomorrow: Double,
        ): ClockReading {
            var length = 1.0
            var currentOffset = 0.0
            var hourBase = 0
            var rising = false

            // Six separate branches, exactly as in Garmin hebrewclock().
            if (setToday > riseToday && now < setToday) {
                length = setToday - riseToday
                currentOffset = now - riseToday
                hourBase = 12
                rising = true
            }
            if (setToday > riseToday && now < riseToday) {
                length = riseToday + 24.0 - setYesterday
                currentOffset = now + 24.0 - setYesterday
                hourBase = 0
                rising = false
            }
            if (setToday > riseToday && now > setToday) {
                length = riseTomorrow + 24.0 - setToday
                currentOffset = now - setToday
                hourBase = 0
                rising = false
            }
            if (setToday < riseToday && now < riseToday) {
                length = riseToday - setToday
                currentOffset = now - setToday
                hourBase = 0
                rising = false
            }
            if (setToday < riseToday && now < setToday) {
                length = setToday + 24.0 - riseYesterday
                currentOffset = now + 24.0 - riseYesterday
                hourBase = 12
                rising = true
            }
            if (setToday < riseToday && now > riseToday) {
                length = setTomorrow + 24.0 - riseToday
                currentOffset = now - riseToday
                hourBase = 12
                rising = true
            }

            val ratio = currentOffset / length
            val sourceHour = floor(12.0 * ratio).toInt()
            val part = floor(12.0 * 1080.0 * ratio).toInt() - sourceHour * 1080
            val moment = floor(12.0 * 1080.0 * 76.0 * ratio).toInt() - sourceHour * 1080 * 76 - part * 76
            return ClockReading(hourBase + sourceHour, part, moment, rising)
        }

        private fun templeMountSunClock(epoch: Long): ClockReading {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val day = current.toLocalDate()
            val nowHour = current.hour + current.minute / 60.0 + current.second / 3600.0
            val yesterday = sunTimes(day.minusDays(1), zone, 90.0 + 50.0 / 60.0)
            val today = sunTimes(day, zone, 90.0 + 50.0 / 60.0)
            val tomorrow = sunTimes(day.plusDays(1), zone, 90.0 + 50.0 / 60.0)
            return calculateSourceClock(
                nowHour,
                yesterday.first, today.first, tomorrow.first,
                yesterday.second, today.second, tomorrow.second,
            )
        }

        private fun clockProgress(value: ClockReading): Double {
            return ((value.hour + (value.part + value.moment / 76.0) / 1080.0) % 24.0) / 24.0
        }

        private fun weekdayForSet(epoch: Long, set: Double): Int {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            var day = current.dayOfWeek.value % 7 + 1 // Sunday=1
            val hour = current.hour + current.minute / 60.0 + current.second / 3600.0
            if (hour >= set && !(current.hour == 23 && current.minute == 59)) day += 1
            return if (day == 8) 1 else day
        }

        private fun mazalFor(day: Int, hour: Int): Mazal {
            val offsets = intArrayOf(0, 6, 2, 5, 1, 4, 7, 3)
            val names = arrayOf("לבנה", "שבתאי", "צדק", "מאדים", "חמה", "נוגה", "כוכב")
            val colors = intArrayOf(Color.LTGRAY, Color.GREEN, Color.BLUE, Color.RED, Color.rgb(128, 0, 128), Color.YELLOW, Color.rgb(255, 165, 0))
            val index = Math.floorMod(offsets[day] + hour, 7)
            return Mazal(names[index], colors[index])
        }

        private fun sunMazal(sun: ClockReading, epoch: Long): Mazal {
            val current = Instant.ofEpochMilli(epoch).atZone(activeZone())
            val sunset = sunTimes(current.toLocalDate(), activeZone(), 90.0 + 50.0 / 60.0).second
            return mazalFor(weekdayForSet(epoch, sunset), sun.hour)
        }

        private fun moonMazal(moon: ClockReading, sun: ClockReading, epoch: Long): Mazal {
            val current = Instant.ofEpochMilli(epoch).atZone(activeZone())
            val date = current.toLocalDate()
            val moonSet = moonTimes(date, activeZone()).second ?: 0.0
            val sunSet = sunTimes(date, activeZone(), 90.0 + 50.0 / 60.0).second
            var moonDay = weekdayForSet(epoch, moonSet)
            val sunDay = weekdayForSet(epoch, sunSet)
            val dayDiff = Math.floorMod(moonDay - sunDay, 7)
            if (dayDiff == 1 || (dayDiff == 0 && moon.sourceUnits() > sun.sourceUnits())) {
                moonDay -= 1
                if (moonDay == 0) moonDay = 7
            }
            return mazalFor(moonDay, moon.hour)
        }

        private fun hebrewDateLabel(epoch: Long): String {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val calendar = HebrewCalendar().apply {
                timeZone = android.icu.util.TimeZone.getTimeZone(zone.id)
                timeInMillis = epoch
            }
            var day = calendar.get(HebrewCalendar.DAY_OF_MONTH)
            val year = calendar.get(HebrewCalendar.YEAR)
            val leap = Math.floorMod(7 * year + 1, 19) < 7
            val icuMonth = calendar.get(HebrewCalendar.MONTH)
            val fixedMonth = if (!leap && icuMonth == HebrewCalendar.ADAR) 6 else icuMonth + 1
            val tzeit = sunTimes(current.toLocalDate(), zone, 96.0).second
            val hour = current.hour + current.minute / 60.0 + current.second / 3600.0
            if (hour > tzeit) {
                day += 1
                if (day == 31) day = 1
            }
            val days = arrayOf("", "א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ז'", "ח'", "ט'", "י'", "י\"א", "י\"ב", "י\"ג", "י\"ד", "ט\"ו", "ט\"ז", "י\"ז", "י\"ח", "י\"ט", "כ'", "כ\"א", "כ\"ב", "כ\"ג", "כ\"ד", "כ\"ה", "כ\"ו", "כ\"ז", "כ\"ח", "כ\"ט", "ל'")
            val months = arrayOf("", "תשרי", "חשוון", "כסלו", "טבת", "שבט", "אדר", "אדר ב", "ניסן", "אייר", "סיוון", "תמוז", "אב", "אלול")
            return "${days.getOrElse(day) { "" }} ב${months.getOrElse(fixedMonth) { "" }}"
        }

        private fun garminSunColors(epoch: Long): ClockColors {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val day = current.toLocalDate()
            val now = current.hour + current.minute / 60.0 + current.second / 3600.0
            val standard = sunTimes(day, zone, 90.0 + 50.0 / 60.0)
            val misheyakir = sunTimes(day, zone, 101.0).first
            val tzeit = sunTimes(day, zone, 96.0).second
            val fajar = sunTimes(day.plusDays(1), zone, 108.0).first
            val declination = 23.44 * sin(Math.toRadians((360.0 / 365.0) * (day.dayOfYear - 81)))
            val thetaNoon = 90.0 - abs(activeLatitude() - declination)
            val initialShadow = 1.0 / tan(Math.toRadians(thetaNoon))
            val asrAngle = Math.toDegrees(kotlin.math.atan(1.0 / (1.0 + initialShadow)))
            val atzer = sunTimes(day, zone, 90.0 - asrAngle).second
            val isha = sunTimes(day, zone, 108.0).second
            val hourColor = if (now > misheyakir && now <= tzeit) Color.BLUE else Color.LTGRAY
            val partColor = if (now > standard.second || now < standard.first) Color.LTGRAY else Color.RED
            val momentColor = when {
                now > fajar && now < atzer -> Color.GREEN
                now > atzer && now < isha -> Color.YELLOW
                else -> Color.LTGRAY
            }
            return ClockColors(hourColor, partColor, momentColor, Color.LTGRAY)
        }

        private fun moladColors(epoch: Long, clock: ClockReading): Pair<Int, Int> {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val calendar = HebrewCalendar().apply {
                timeZone = android.icu.util.TimeZone.getTimeZone(zone.id)
                timeInMillis = epoch
            }
            var year = calendar.get(HebrewCalendar.YEAR)
            val leap = Math.floorMod(7*year+1, 19) < 7
            val icuMonth = calendar.get(HebrewCalendar.MONTH)
            var fixedMonth = if (!leap && icuMonth == HebrewCalendar.ADAR) 6 else icuMonth + 1
            var displayedDay = calendar.get(HebrewCalendar.DAY_OF_MONTH)
            val tzeit = sunTimes(current.toLocalDate(), zone, 96.0).second
            val currentHour = current.hour + current.minute / 60.0 + current.second / 3600.0
            if (currentHour > tzeit) {
                displayedDay += 1
                if (displayedDay == 31) displayedDay = 1
            }

            // JColor.getRoshChodeshMoladDate(): day 30 uses the coming month.
            if (displayedDay == 30) {
                if (fixedMonth == 13) {
                    year += 1
                    fixedMonth = 1
                } else if (!leap && fixedMonth == 6) {
                    fixedMonth = 8
                } else {
                    fixedMonth += 1
                }
            }

            fun monthOffset(targetYear: Int, month: Int): Int {
                val targetLeap = Math.floorMod(7 * targetYear + 1, 19) < 7
                return when {
                    targetLeap -> month - 1
                    month == 7 -> 6
                    month >= 8 -> month - 2
                    else -> month - 1
                }
            }

            val offset = when {
                clock.hour in 12..17 -> monthOffset(year, fixedMonth)
                clock.hour >= 18 -> 0
                clock.hour < 6 -> {
                    year -= ((year-1)%49+49)%49
                    0
                }
                else -> {
                    if (monthOffset(year, fixedMonth) < monthOffset(year, 8)) year -= 1
                    monthOffset(year, 8)
                }
            }
            val completedYears = year-1L
            val cycles = Math.floorDiv(completedYears, 19L)
            val yearInCycle = Math.floorMod(completedYears, 19L)
            val monthsBeforeTishri = 235L*cycles + 12L*yearInCycle + (7L*yearInCycle+1L)/19L
            val totalHalakim = 31524L + (monthsBeforeTishri+offset)*765433L
            val absoluteDay = Math.floorDiv(totalHalakim, 25920L)
            val halakimOfDay = Math.floorMod(totalHalakim, 25920L)
            val jewishDay = Math.floorMod(absoluteDay, 7L).toInt()+1
            val jewishHour = (halakimOfDay/1080L).toInt()
            val offsets = intArrayOf(0,6,2,5,1,4,7,3)
            var index = (offsets[jewishDay]+jewishHour)%7
            if (index == 0) index=7
            val commercial = intArrayOf(0,4,1,2,3,5,6,7)[index]
            fun color(number: Int): Int = when(number) {
                1 -> Color.BLUE
                2 -> Color.RED
                3 -> Color.rgb(128,0,128)
                4 -> Color.GREEN
                5 -> Color.YELLOW
                6 -> Color.rgb(255,165,0)
                else -> Color.LTGRAY
            }
            return color(commercial) to color(jewishDay)
        }

        private fun hebrewDay(epoch: Long): Int = HebrewCalendar().apply {
            timeZone = android.icu.util.TimeZone.getTimeZone(activeZone().id)
            timeInMillis = epoch
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val tzeit = sunTimes(current.toLocalDate(), zone, 96.0).second
            val hour = current.hour + current.minute/60.0 + current.second/3600.0
            if (hour >= tzeit) add(HebrewCalendar.DAY_OF_MONTH, 1)
        }.get(HebrewCalendar.DAY_OF_MONTH).coerceIn(1, 30)

        private fun weekdayLabel(epoch: Long): String {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val sun = sunTimes(current.toLocalDate(), zone, 90.0+50.0/60.0)
            val sunrise = sun.first
            val sunset = sun.second
            val hour = current.hour + current.minute/60.0 + current.second/3600.0
            val afterSunset = hour >= sunset
            val dayIndex = ((current.dayOfWeek.value%7) + if (afterSunset) 1 else 0) % 7
            val period = when {
                afterSunset -> "ערב"
                hour < sunrise -> "ליל"
                hour < 12.0 -> "בוקר"
                else -> "צהריי"
            }
            val dayName = arrayOf("ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת")[dayIndex]
            return "$period $dayName"
        }

        private fun moonImage(day: Int): Bitmap {
            val index = day.coerceIn(1, 30)-1
            moonImages[index]?.let { return it }
            val directory = File(filesDir, "moon_phases").apply { mkdirs() }
            val file = File(directory, "moon_day_%02d.png".format(Locale.US, day))
            val bitmap = if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
            val result = bitmap ?: createMoonImage(day).also { generated ->
                runCatching { FileOutputStream(file).use { generated.compress(Bitmap.CompressFormat.PNG, 100, it) } }
            }
            moonImages[index] = result
            return result
        }

        private fun createMoonImage(day: Int): Bitmap {
            val size = 18; val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap); val p = Paint(Paint.ANTI_ALIAS_FLAG)
            val center = size/2f; val radius = size/2f-1f
            p.color = Color.rgb(17, 21, 25); canvas.drawCircle(center, center, radius, p)
            val phase = (day-1)/29.0
            val illumination = 0.5-0.5*cos(phase*Math.PI*2.0)
            canvas.save(); canvas.clipPath(android.graphics.Path().apply { addCircle(center, center, radius, android.graphics.Path.Direction.CW) })
            p.color = Color.rgb(220, 226, 234)
            val litWidth = (size*illumination).toFloat()
            if (phase <= .5) canvas.drawRect(size-litWidth, 0f, size.toFloat(), size.toFloat(), p)
            else canvas.drawRect(0f, 0f, litWidth, size.toFloat(), p)
            canvas.restore()
            p.style = Paint.Style.STROKE; p.strokeWidth = 1f; p.color = Color.rgb(175, 185, 198)
            canvas.drawCircle(center, center, radius, p)
            return bitmap
        }

        private fun templeMountMoonClock(epoch: Long): ClockReading? {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val day = current.toLocalDate()
            val now = current.hour + current.minute / 60.0 + current.second / 3600.0
            val previous = moonTimes(day.minusDays(1), zone)
            val today = moonTimes(day, zone)
            val next = moonTimes(day.plusDays(1), zone)
            return calculateSourceClock(
                now,
                previous.first ?: return null,
                today.first ?: return null,
                next.first ?: return null,
                previous.second ?: return null,
                today.second ?: return null,
                next.second ?: return null,
            )
        }

        private fun moonTimes(date: LocalDate, zone: ZoneId): Pair<Double?, Double?> {
            val start = date.atStartOfDay(zone).toInstant().toEpochMilli()
            val hc = 0.133 * Math.PI / 180.0
            var h0 = moonAltitude(start) - hc
            var rise: Double? = null; var set: Double? = null
            for (i in 1..25 step 2) {
                val h1 = moonAltitude(start + i * 3_600_000L) - hc
                val h2 = moonAltitude(start + (i + 1) * 3_600_000L) - hc
                val a = (h0 + h2) / 2.0 - h1
                val b = (h2 - h0) / 2.0
                if (abs(a) < 1e-12) {
                    h0 = h2
                    continue
                }
                val xe = -b / (2.0 * a)
                val ye = (a * xe + b) * xe + h1
                val discriminant = b * b - 4.0 * a * h1
                var roots = 0; var x1 = 0.0; var x2 = 0.0
                if (discriminant >= 0.0) {
                    val dx = sqrt(discriminant) / (abs(a) * 2.0)
                    x1 = xe - dx; x2 = xe + dx
                    if (abs(x1) <= 1.0) roots++
                    if (abs(x2) <= 1.0) roots++
                    if (x1 < -1.0) x1 = x2
                }
                if (roots == 1) {
                    if (h0 < 0.0) rise = i + x1 else set = i + x1
                } else if (roots == 2) {
                    rise = i + if (ye < 0.0) x2 else x1
                    set = i + if (ye < 0.0) x1 else x2
                }
                if (rise != null && set != null) break
                h0 = h2
            }
            if (rise != null && rise >= 24.0) rise -= 24.0
            if (set != null && set >= 24.0) set -= 24.0
            return rise to set
        }

        private fun moonAltitude(epoch: Long): Double {
            val rad = Math.PI / 180.0
            val days = epoch / 86_400_000.0 - 0.5 + 2440588.0 - 2451545.0
            val ecliptic = rad * 23.4397
            val lMean = rad * (218.316 + 13.176396 * days)
            val anomaly = rad * (134.963 + 13.064993 * days)
            val distance = rad * (93.272 + 13.229350 * days)
            val longitude = lMean + rad * 6.289 * sin(anomaly)
            val latitude = rad * 5.128 * sin(distance)
            val ra = atan2(sin(longitude) * cos(ecliptic) - tan(latitude) * sin(ecliptic), cos(longitude))
            val dec = asin(sin(latitude) * cos(ecliptic) + cos(latitude) * sin(ecliptic) * sin(longitude))
            val lw = rad * -activeLongitude()
            val phi = rad * activeLatitude()
            val hourAngle = rad * (280.16 + 360.9856235 * days) - lw - ra
            var altitude = asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(hourAngle))
            val refracted = if (altitude < 0.0) 0.0 else altitude
            altitude += 0.0002967 / tan(refracted + 0.00312536 / (refracted + 0.08901179))
            return altitude
        }

        /** The same 90°50′ sunrise/sunset algorithm used by JClock. */
        private fun sunTimes(date: LocalDate, zone: ZoneId, zenithDegrees: Double): Pair<Double, Double> {
            val latitude = activeLatitude()
            val longitude = activeLongitude()
            val timezone = date.atTime(12, 0).atZone(zone).offset.totalSeconds / 3600.0
            val yday = date.dayOfYear
            val a = 1.5708; val b = 3.14159; val cc = 4.71239; val d = 6.28319
            val e = 0.0174533 * latitude; val f = 0.0174533 * longitude; val g = 0.261799 * timezone
            val rr = cos(0.01745 * zenithDegrees)
            fun event(sunrise: Boolean): Double {
                val j = if (sunrise) a else cc
                val k = yday + ((j - f) / d)
                val l = (k * .017202) - .0574039
                var m = l + .0334405 * sin(l)
                m += 4.93289 + 3.49066E-04 * sin(2 * l)
                while (m < 0) m += d
                while (m >= d) m -= d
                if ((m / a) - floor(m / a) == 0.0) m += 4.84814E-06
                var p = atan2(.91746 * (sin(m) / cos(m)), 1.0)
                if (m > cc) p += d else if (m > a) p += b
                var q = .39782 * sin(m)
                q = atan2(q / sqrt(-q * q + 1), 1.0)
                var s = (rr - sin(q) * sin(e)) / (cos(q) * cos(e))
                s /= sqrt(-s * s + 1)
                s = a - atan2(s, 1.0)
                if (sunrise) s = d - s
                val t = s + p - 0.0172028 * k - 1.73364
                var v = t - f + g
                while (v < 0) v += d
                while (v >= d) v -= d
                return v * 3.81972
            }
            return event(true) to event(false)
        }
    }
}
