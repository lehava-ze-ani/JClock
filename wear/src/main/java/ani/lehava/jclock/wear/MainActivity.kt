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

    private fun openLearningOnPhone(epoch: Long, zoneId: String) {
        val jerusalemZone = ZoneId.of("Asia/Jerusalem")
        val instant = Instant.ofEpochMilli(epoch).atZone(jerusalemZone)
        val body = JSONObject()
            .put("date", instant.toLocalDate().toString())
            .put("time", "%02d:%02d".format(Locale.US, instant.hour, instant.minute))
            .put("timeZone", jerusalemZone.id)
            .put("sourceTimeZone", zoneId)
            .toString().toByteArray(Charsets.UTF_8)
        Wearable.getNodeClient(this).connectedNodes.addOnSuccessListener { nodes ->
            if (nodes.isEmpty()) face.showStatus("אין טלפון מחובר")
            else Wearable.getMessageClient(this)
                .sendMessage(nodes.first().id, "/jclock/learning/open", body)
                .addOnSuccessListener { face.showStatus("נשלח לטלפון") }
                .addOnFailureListener { face.showStatus("השליחה נכשלה") }
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
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = android.graphics.Typeface.create("sans", 0) }
        private val bold = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = android.graphics.Typeface.create("sans", 1) }
        private val tick = object : Runnable { override fun run() { invalidate(); clockHandler.postDelayed(this, 1000) } }
        private var offsetSeconds = 0
        private var localMode = false
        private var localLatitude = 31.7768514
        private var localLongitude = 35.2331664
        private var localTimeZone: String? = null
        private var preciseLocalLocation = false
        private var status = "ירושלים"
        private var pausedAt: Long? = null
        private val moonImages = arrayOfNulls<Bitmap>(30)

        fun start() { clockHandler.removeCallbacks(tick); clockHandler.post(tick) }
        fun stop() = clockHandler.removeCallbacks(tick)
        fun showStatus(value: String) { status = value; invalidate() }
        fun setLocal(lat: Double, lon: Double, timeZone: String) { localLatitude=lat; localLongitude=lon; localTimeZone=timeZone.ifBlank { null }; preciseLocalLocation=true; localMode = true; status = "מקומי %.2f, %.2f".format(lat, lon); invalidate() }
        private fun activeZone(): ZoneId = if (localMode) ZoneId.of(localTimeZone ?: TimeZone.getDefault().id) else ZoneId.of("Asia/Jerusalem")
        private fun activeLatitude(): Double = if (localMode) localLatitude else 31.7768514
        private fun activeLongitude(): Double = if (localMode) localLongitude else 35.2331664

        private fun useLocalTimeZoneFallback() {
            val isDebugBuild = (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
            val localZone = if (isDebugBuild) ZoneId.of("America/New_York") else ZoneId.systemDefault()
            // בגרסת debug מדמים את מלון צ'לסי; בגרסת הפצה נשארים בירושלים
            // עד שמגיע GPS אמיתי, בלי להסיק קואורדינטות מאזור הזמן.
            localLatitude = if (isDebugBuild) 40.7444 else 31.7768514
            localLongitude = if (isDebugBuild) -73.9967 else 35.2331664
            localTimeZone = localZone.id
            preciseLocalLocation = isDebugBuild
            localMode = true
        }

        private fun text(canvas: Canvas, value: String, x: Float, y: Float, size: Float, color: Int, p: Paint = paint) {
            p.textSize = size; p.color = color; p.textAlign = Paint.Align.CENTER
            canvas.drawText(value, x, y - (p.ascent() + p.descent()) / 2, p)
        }

        override fun onDraw(c: Canvas) {
            val w = width.toFloat(); val h = height.toFloat(); val cx = w / 2; val cy = h / 2
            c.drawColor(Color.BLACK)
            val r = minOf(w, h) / 2 - 5
            paint.style = Paint.Style.STROKE; paint.strokeWidth = 3f; paint.color = Color.rgb(55, 68, 78)
            c.drawCircle(cx, cy, r, paint); paint.style = Paint.Style.FILL

            val now = Date((pausedAt ?: System.currentTimeMillis()) + offsetSeconds * 1000L)
            val tz = TimeZone.getTimeZone(activeZone().id)
            val time = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = tz }.format(now)
            val seconds = SimpleDateFormat("ss", Locale.US).apply { timeZone = tz }.format(now)
            val date = hebrewDate(now.time, tz)
            // זמן אסטרונומי הוא רגע מוחלט: אזור הזמן אינו מוזז לתוכו פעם נוספת.
            // במצב מקומי הקואורדינטות שהתקבלו מהטלפון משנות את זמני הזריחה והשקיעה.
            val sunClock = templeMountSunClock(now.time)
            val moonClock = templeMountMoonClock(now.time)
            // צבעי המולד הם עוגן ירושלמי קבוע ואינם תלויים בשעון המוצג.
            val displayedMode = localMode
            localMode = false
            val jerusalemSunClock = templeMountSunClock(now.time)
            val jerusalemMoonClock = templeMountMoonClock(now.time)
            val moladColors = moladColors(now.time, jerusalemSunClock)
            val moonMoladColors = moladColors(now.time, jerusalemMoonClock)
            localMode = displayedMode

            text(c, "קידוש החודש", cx, cy - r * .73f, 20f, Color.rgb(116, 205, 255), bold)
            text(c, sunClock, cx, cy - r * .55f, 26f, Color.WHITE, bold)

            val localButtonRect = RectF(cx-r*.79f, cy-r*.44f, cx-r*.43f, cy+r*.25f)
            val jerusalemButtonRect = RectF(cx+r*.43f, cy-r*.44f, cx+r*.79f, cy+r*.25f)
            paint.style = Paint.Style.FILL; paint.color = moladColors.second
            c.drawRoundRect(localButtonRect, 9f, 9f, paint)
            paint.color = moonMoladColors.second
            c.drawRoundRect(jerusalemButtonRect, 9f, 9f, paint)
            paint.style = Paint.Style.STROKE; paint.strokeWidth = 3f; paint.color = moladColors.first
            c.drawRoundRect(localButtonRect, 9f, 9f, paint)
            paint.color = moonMoladColors.first
            c.drawRoundRect(jerusalemButtonRect, 9f, 9f, paint)
            paint.style = Paint.Style.FILL
            bold.style = Paint.Style.STROKE; bold.strokeWidth = 3f
            text(c, "מקומי", cx-r*.61f, cy-r*.07f, 19f, Color.BLACK, bold)
            text(c, "ירושלים", cx+r*.61f, cy-r*.07f, 14f, Color.BLACK, bold)
            bold.style = Paint.Style.FILL
            bold.setShadowLayer(4f, 0f, 1f, Color.BLACK)
            text(c, "מקומי", cx-r*.61f, cy-r*.07f, 19f, moladColors.first, bold)
            text(c, "ירושלים", cx+r*.61f, cy-r*.07f, 14f, moonMoladColors.first, bold)
            bold.clearShadowLayer()
            val centerColor = if (pausedAt == null) Color.rgb(197, 225, 242) else Color.rgb(255, 196, 65)
            // שלוש שורות סימטריות בתוך מסלול גרמי השמים.
            val centerInfoY = cy - r * .07f
            val centerInfoGap = r * .125f
            text(c, weekdayLabel(now.time), cx, centerInfoY-centerInfoGap, 13f, centerColor, bold)
            text(c, date, cx, centerInfoY, 15f, centerColor, bold)
            text(c, "$time:$seconds", cx, centerInfoY+centerInfoGap, 15f, centerColor, bold)

            // המסלול מוגבל למרכז שבין הקצוות הפנימיים של שני הכפתורים.
            val orbitCenterY = centerInfoY
            val orbitRadius = minOf(r*.26f, r*.46f-13f)
            paint.style = Paint.Style.STROKE; paint.strokeWidth = 1.5f; paint.color = Color.rgb(75, 89, 99)
            c.drawCircle(cx, orbitCenterY, orbitRadius, paint); paint.style = Paint.Style.FILL
            // נוסחת המסלול המקורית של JClock: 12 בימין והתקדמות נגד כיוון הזווית.
            val sunAngle = -(clockProgress(sunClock)-0.5) * (Math.PI*2.0)
            val moonAngle = -(clockProgress(moonClock)-0.5) * (Math.PI*2.0)
            val sunX = cx + (cos(sunAngle)*orbitRadius).toFloat(); val sunY = orbitCenterY + (sin(sunAngle)*orbitRadius).toFloat()
            paint.color = Color.rgb(255, 210, 70); paint.setShadowLayer(8f, 0f, 0f, Color.rgb(255, 190, 30)); setLayerType(LAYER_TYPE_SOFTWARE, paint)
            c.drawCircle(sunX, sunY, 6f, paint); paint.clearShadowLayer()
            val moonDay = hebrewDay(now.time)
            val moon = moonImage(moonDay)
            val moonX = cx + (cos(moonAngle)*orbitRadius).toFloat(); val moonY = orbitCenterY + (sin(moonAngle)*orbitRadius).toFloat()
            c.drawBitmap(moon, moonX-moon.width/2f, moonY-moon.height/2f, paint)

            text(c, moonClock, cx, cy+r*.36f, 25f, Color.WHITE, bold)

            paint.color = Color.rgb(48, 57, 64)
            c.drawRoundRect(RectF(cx-r*.65f, cy+r*.48f, cx+r*.65f, cy+r*.53f), 5f, 5f, paint)
            val knobX = cx - r * .65f * (offsetSeconds / 10800f)
            paint.color = Color.rgb(69, 183, 255); c.drawCircle(knobX, cy+r*.505f, 9f, paint)
            paint.color = Color.rgb(34, 58, 72)
            c.drawRoundRect(RectF(cx-r*.19f, cy+r*.59f, cx+r*.19f, cy+r*.73f), 9f, 9f, paint)
            text(c, "Now", cx, cy+r*.66f, 15f, Color.rgb(135, 210, 255), bold)
            text(c, status, cx, cy+r*.82f, 13f, Color.LTGRAY)
        }

        override fun onTouchEvent(e: MotionEvent): Boolean {
            if (e.action != MotionEvent.ACTION_DOWN && e.action != MotionEvent.ACTION_MOVE) return true
            val cx = width / 2f; val cy = height / 2f; val r = minOf(width, height) / 2f - 5
            if (e.action == MotionEvent.ACTION_DOWN && e.x in (cx-r*.22f)..(cx+r*.22f) && e.y in (cy+r*.56f)..(cy+r*.76f)) {
                offsetSeconds = 0
                invalidate()
                return true
            }
            if (e.y in (cy-r*.46f)..(cy+r*.27f) && e.action == MotionEvent.ACTION_DOWN) {
                if (e.x in (cx-r*.24f)..(cx+r*.24f)) {
                    val frozen = pausedAt
                    if (frozen == null) pausedAt = System.currentTimeMillis()
                    else {
                        openLearningOnPhone(frozen + offsetSeconds * 1000L, activeZone().id)
                        pausedAt = null
                    }
                    status = if (pausedAt == null) (if (localMode) "מקומי" else "ירושלים") else "חישוב המולד נעצר"
                }
                else if (e.x in (cx-r*.79f)..(cx-r*.43f)) { useLocalTimeZoneFallback(); status = "מחפש מיקום…"; requestLocation() }
                else if (e.x in (cx+r*.43f)..(cx+r*.79f)) { localMode = false; status = "ירושלים" }
                invalidate(); return true
            }
            if (e.y in (cy+r*.38f)..(cy+r*.66f)) {
                val normalized = ((e.x - cx) / (r*.65f)).coerceIn(-1f, 1f)
                offsetSeconds = -((normalized * 10800 / 300).roundToInt() * 300)
                invalidate()
            }
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

        private fun templeMountSunClock(epoch: Long): String {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val day = current.toLocalDate()
            val nowHour = current.hour + current.minute / 60.0 + current.second / 3600.0 + current.nano / 3_600_000_000_000.0
            val yesterday = sunTimes(day.minusDays(1), zone, 90.0 + 50.0 / 60.0)
            val today = sunTimes(day, zone, 90.0 + 50.0 / 60.0)
            val tomorrow = sunTimes(day.plusDays(1), zone, 90.0 + 50.0 / 60.0)
            val hebrewHours = when {
                nowHour < today.first -> 12.0 * (nowHour + 24.0 - yesterday.second) / (today.first + 24.0 - yesterday.second)
                nowHour < today.second -> 12.0 + 12.0 * (nowHour - today.first) / (today.second - today.first)
                else -> 12.0 * (nowHour - today.second) / (tomorrow.first + 24.0 - today.second)
            }
            var totalParts = floor(hebrewHours * 1080.0 * 76.0).toLong()
            totalParts = ((totalParts % (24L * 1080L * 76L)) + 24L * 1080L * 76L) % (24L * 1080L * 76L)
            val hour = totalParts / (1080L * 76L)
            totalParts -= hour * 1080L * 76L
            val part = totalParts / 76L
            val moment = totalParts % 76L
            return "%02d:%04d:%02d".format(Locale.US, hour, part, moment)
        }

        private fun clockProgress(value: String): Double {
            val fields = value.split(':')
            if (fields.size != 3) return 0.0
            val hour = fields[0].toDoubleOrNull() ?: return 0.0
            val part = fields[1].toDoubleOrNull() ?: 0.0
            val moment = fields[2].toDoubleOrNull() ?: 0.0
            return ((hour + (part + moment/76.0)/1080.0) % 24.0) / 24.0
        }

        private fun hourMazal(value: String, epoch: Long, moonClock: Boolean): String {
            val hour = value.substringBefore(':').toIntOrNull() ?: return "--"
            val ordered = arrayOf("לבנה", "שבתאי", "צדק", "מאדים", "חמה", "נוגה", "כוכב")
            val nightStarts = intArrayOf(6, 2, 5, 1, 4, 7, 3)
            val dayStarts = intArrayOf(4, 7, 3, 6, 2, 5, 1)
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val sunset = sunTimes(current.toLocalDate(), zone, 90.0+50.0/60.0).second
            val isDaySegment = hour >= 12
            var weekday = current.dayOfWeek.value % 7 // Sunday=0
            val currentHour = current.hour + current.minute/60.0 + current.second/3600.0
            if (currentHour >= sunset) weekday = (weekday+1)%7
            if (moonClock) {
                val candidates = (-2..2).mapNotNull { offset ->
                    val date = current.toLocalDate().plusDays(offset.toLong())
                    val rise = moonTimes(date, zone).first ?: return@mapNotNull null
                    date.atStartOfDay(zone).plusSeconds((rise*3600.0).toLong())
                }
                val titleDate = if (isDaySegment) {
                    candidates.filter { !it.toInstant().isAfter(Instant.ofEpochMilli(epoch)) }.maxByOrNull { it.toInstant() }
                } else {
                    candidates.filter { it.toInstant().isAfter(Instant.ofEpochMilli(epoch)) }.minByOrNull { it.toInstant() }
                }
                if (titleDate != null) weekday = titleDate.dayOfWeek.value % 7
                // JClock HebrewDayOffset: כאשר זמן הלבנה מקדים במחזור את זמן החמה
                // באותו יום תצוגה, מזל הלבנה שייך ליום הקודם.
                if (clockProgress(value) > clockProgress(templeMountSunClock(epoch))) weekday = (weekday+6)%7
            } else {
                // מזל השמש נשען על יום השבוע שכבר הוחלף בשקיעה.
            }
            val start = if (isDaySegment) dayStarts[weekday] else nightStarts[weekday]
            return ordered[(start + (hour%12)) % 7]
        }

        private fun moladColors(epoch: Long, sunClock: String): Pair<Int, Int> {
            val calendar = HebrewCalendar().apply {
                timeZone = android.icu.util.TimeZone.getTimeZone(activeZone().id)
                timeInMillis = epoch
            }
            // בשקיעה מתחלף רק היום בשבוע לצורכי הסיווג והצבעים.
            // התאריך העברי, היום בחודש והחודש מתחלפים רק בצאת הכוכבים 96°.
            var year = calendar.get(HebrewCalendar.YEAR)
            val month = calendar.get(HebrewCalendar.MONTH)
            val leap = Math.floorMod(7*year+1, 19) < 7
            val currentMonthOffset = when {
                month <= HebrewCalendar.SHEVAT -> month
                month == HebrewCalendar.ADAR_1 -> 5
                month == HebrewCalendar.ADAR -> if (leap) 6 else 5
                else -> if (leap) month else month-1
            }
            val nisanOffset = if (leap) 7 else 6
            val hour = sunClock.substringBefore(':').toIntOrNull() ?: 0
            val monthOffset = when {
                hour in 12..17 -> currentMonthOffset
                hour >= 18 -> 0
                hour < 6 -> {
                    year -= ((year-1)%49+49)%49
                    0
                }
                else -> {
                    if (currentMonthOffset < nisanOffset) year -= 1
                    val nisanLeap = Math.floorMod(7*year+1, 19) < 7
                    if (nisanLeap) 7 else 6
                }
            }
            val completedYears = year-1L
            val cycles = Math.floorDiv(completedYears, 19L)
            val yearInCycle = Math.floorMod(completedYears, 19L)
            val monthsBeforeTishri = 235L*cycles + 12L*yearInCycle + (7L*yearInCycle+1L)/19L
            val totalHalakim = 31524L + (monthsBeforeTishri+monthOffset)*765433L
            val absoluteDay = Math.floorDiv(totalHalakim, 25920L)
            val halakimOfDay = Math.floorMod(totalHalakim, 25920L)
            val jewishDay = Math.floorMod(absoluteDay, 7L).toInt()+1
            val jewishHour = (halakimOfDay/1080L).toInt()
            val offsets = intArrayOf(0,6,2,5,1,4,7,3)
            var index = (offsets[jewishDay]+jewishHour)%7
            if (index == 0) index=7
            val commercial = intArrayOf(0,4,1,2,3,5,6,7)[index]
            fun color(number: Int): Int = when(number) {
                1 -> Color.rgb(93,188,210)
                2 -> Color.rgb(166,35,14)
                3 -> Color.rgb(129,90,168)
                4 -> Color.rgb(132,196,94)
                5 -> Color.rgb(186,141,26)
                6 -> Color.rgb(180,93,2)
                else -> Color.rgb(128,128,128)
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

        private fun templeMountMoonClock(epoch: Long): String {
            val zone = activeZone()
            val current = Instant.ofEpochMilli(epoch).atZone(zone)
            val day = current.toLocalDate()
            val now = current.hour + current.minute / 60.0 + current.second / 3600.0 + current.nano / 3_600_000_000_000.0
            val previous = moonTimes(day.minusDays(1), zone)
            val today = moonTimes(day, zone)
            val next = moonTimes(day.plusDays(1), zone)
            val rise = today.first ?: return "--:----:--"
            val set = today.second ?: return "--:----:--"
            // מנגנון הספרייה באזור חצות הלילה האזרחי שופר בידי נפתלי ביליג,
            // כחלק מ־JClock המקורי ועוד לפני עידן ה־AI. השימוש ביום הקודם/הבא
            // כאן שומר על הרצף הנכון כשזריחת הלבנה או שקיעתה חוצות את 00:00.
            val hebrewHours = if (set > rise) {
                when {
                    now < rise -> {
                        val previousSet = previous.second ?: return "--:----:--"
                        12.0 * (now + 24.0 - previousSet) / (rise + 24.0 - previousSet)
                    }
                    now < set -> 12.0 + 12.0 * (now - rise) / (set - rise)
                    else -> {
                        val nextRise = next.first ?: return "--:----:--"
                        12.0 * (now - set) / (nextRise + 24.0 - set)
                    }
                }
            } else {
                when {
                    now < set -> {
                        val previousRise = previous.first ?: return "--:----:--"
                        12.0 + 12.0 * (now + 24.0 - previousRise) / (set + 24.0 - previousRise)
                    }
                    now < rise -> 12.0 * (now - set) / (rise - set)
                    else -> {
                        val nextSet = next.second ?: return "--:----:--"
                        12.0 + 12.0 * (now - rise) / (nextSet + 24.0 - rise)
                    }
                }
            }
            return formatHebrewClock(hebrewHours)
        }

        private fun formatHebrewClock(hours: Double): String {
            var total = floor(hours * 1080.0 * 76.0).toLong()
            val fullDay = 24L * 1080L * 76L
            total = ((total % fullDay) + fullDay) % fullDay
            val hour = total / (1080L * 76L)
            total -= hour * 1080L * 76L
            val part = total / 76L
            val moment = total % 76L
            return "%02d:%04d:%02d".format(Locale.US, hour, part, moment)
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
