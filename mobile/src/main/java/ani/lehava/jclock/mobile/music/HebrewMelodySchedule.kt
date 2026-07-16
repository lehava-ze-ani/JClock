package ani.lehava.jclock.mobile.music

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Selects the monthly melody folder and cache deadline without relying on a WebView.
 *
 * This is a source-faithful port of background_music.js. Hebrew months are numbered
 * from Nisan (Nisan=1, Tishrei=7), and Adar II intentionally shares folder 12.
 */
class HebrewMelodySchedule(
    val zoneId: ZoneId = JERUSALEM_ZONE,
) {
    data class Window(
        val monthFromNisan: Int,
        val folder: String,
        val expiresAt: Instant,
    )

    data class HebrewDate(
        val year: Int,
        val monthFromNisan: Int,
        val day: Int,
    )

    fun window(now: Instant = Instant.now()): Window {
        val month = musicMonthNumberFromNisan(now)
        return Window(month, folderForMonth(month), cacheExpiresAt(now))
    }

    fun musicMonthNumberFromNisan(now: Instant = Instant.now()): Int {
        val anchorDate = musicMonthAnchorDate(now)
        val currentMonth = hebrewDateForCivilDate(anchorDate).monthFromNisan
        val currentEnd = hebrewMonthCacheExpiresAt(now)
        if (!now.isBefore(currentEnd)) {
            return hebrewDateAt(now.plus(THREE_DAYS)).monthFromNisan
        }
        return currentMonth
    }

    fun cacheExpiresAt(now: Instant = Instant.now()): Instant {
        val currentEnd = hebrewMonthCacheExpiresAt(now)
        if (now.isBefore(currentEnd)) return currentEnd

        val nextEnd = hebrewMonthCacheExpiresAt(now.plus(THREE_DAYS))
        return if (nextEnd.isAfter(now)) nextEnd else now.plus(FALLBACK_RETENTION)
    }

    fun folderForMonth(monthFromNisan: Int): String {
        require(monthFromNisan >= 1) { "Hebrew month must be positive" }
        val folderMonth = if (monthFromNisan == 13) 12 else monthFromNisan.coerceAtMost(12)
        return folderMonth.toString().padStart(2, '0')
    }

    internal fun hebrewDateAt(instant: Instant): HebrewDate =
        hebrewDateForCivilDate(instant.atZone(zoneId).toLocalDate())

    internal fun hebrewMonthCacheExpiresAt(now: Instant): Instant {
        val current = hebrewDateAt(now)
        val civilToday = now.atZone(zoneId).toLocalDate()

        for (offsetDays in -2L..35L) {
            val civil = civilToday.plusDays(offsetDays)
            val hebrew = hebrewDateForCivilDate(civil)
            if (hebrew.monthFromNisan != current.monthFromNisan || hebrew.day != 29) continue

            val sunset = sunTimes(civil).sunset
            if (!sunset.isFinite()) return now.plus(FALLBACK_RETENTION)
            return civilHourToInstant(civil, sunset - 1.0)
        }

        return now.plus(FALLBACK_RETENTION)
    }

    private fun musicMonthAnchorDate(now: Instant): LocalDate {
        val local = now.atZone(zoneId)
        val today = local.toLocalDate()
        // The browser source applies the current Jerusalem UTC offset to all
        // three neighboring days in this JClock calculation.
        val currentZoneOffset = local.offset.totalSeconds / 3600.0
        val yesterdaySun = sunTimes(today.minusDays(1), currentZoneOffset)
        val todaySun = sunTimes(today, currentZoneOffset)
        val tomorrowSun = sunTimes(today.plusDays(1), currentZoneOffset)
        val currentHour = local.hour + local.minute / 60.0 + local.second / 3600.0 +
            (local.nano / 1_000_000) / 3_600_000.0

        val length: Double
        val currentOffset: Double
        var hourBase = 0
        var hebrewAnchorDayOffset = 0L

        if (currentHour < todaySun.sunrise) {
            length = todaySun.sunrise + 24.0 - yesterdaySun.sunset
            currentOffset = currentHour + 24.0 - yesterdaySun.sunset
        } else if (currentHour < todaySun.sunset) {
            length = todaySun.sunset - todaySun.sunrise
            currentOffset = currentHour - todaySun.sunrise
            hourBase = 12
        } else {
            length = tomorrowSun.sunrise + 24.0 - todaySun.sunset
            currentOffset = currentHour - todaySun.sunset
            hebrewAnchorDayOffset = 1L
        }

        val displayedHour = floor(12.0 * currentOffset / length).toInt()
        val jclockHour = hourBase + displayedHour
        val dayOffset = if (jclockHour >= MUSIC_MONTH_SWITCH_HOUR) {
            hebrewAnchorDayOffset
        } else {
            hebrewAnchorDayOffset - 1L
        }
        return today.plusDays(dayOffset)
    }

    private fun civilHourToInstant(date: LocalDate, localHour: Double): Instant {
        val offsetSeconds = date.atTime(12, 0).atZone(zoneId).offset.totalSeconds.toDouble()
        val utcMidnight = date.atStartOfDay(ZoneOffset.UTC).toInstant()
        val seconds = localHour * 3600.0 - offsetSeconds
        return utcMidnight.plusNanos((seconds * 1_000_000_000.0).toLong())
    }

    private fun sunTimes(
        date: LocalDate,
        offsetHours: Double = date.atTime(12, 0).atZone(zoneId).offset.totalSeconds / 3600.0,
    ): SunTimes {
        val longitude = JERUSALEM_LONGITUDE
        val latitude = JERUSALEM_LATITUDE
        val yday = date.dayOfYear
        val a = 1.5708
        val b = 3.14159
        val c = 4.71239
        val d = 6.28319
        val e = 0.0174533 * latitude
        val f = 0.0174533 * longitude
        val g = 0.261799 * offsetHours
        val r = cos(0.01745 * (90.0 + 50.0 / 60.0))
        var sunrise = Double.NaN
        var sunset = Double.NaN

        for (index in 0..1) {
            val j = if (index == 0) a else c
            val k = yday + (j - f) / d
            val l = k * 0.017202 - 0.0574039
            var m = l + 0.0334405 * sin(l)
            m += 4.93289 + 3.49066e-4 * sin(2.0 * l)
            while (m < 0.0) m += d
            while (m >= d) m -= d
            if (m / a - floor(m / a) == 0.0) m += 4.84814e-6

            var p = atan2(0.91746 * (sin(m) / cos(m)), 1.0)
            if (m > c) p += d else if (m > a) p += b

            var q = 0.39782 * sin(m)
            q = atan2(q / sqrt(1.0 - q * q), 1.0)
            var s = (r - sin(q) * sin(e)) / (cos(q) * cos(e))
            if (abs(s) > 1.0) return SunTimes(Double.NaN, Double.NaN)
            s = a - atan2(s / sqrt(1.0 - s * s), 1.0)
            if (index == 0) s = d - s

            val t = s + p - 0.0172028 * k - 1.73364
            val u = t - f
            var v = u + g
            while (v < 0.0) v += d
            while (v >= d) v -= d
            v *= 3.81972
            if (index == 0) sunrise = v else sunset = v
        }
        return SunTimes(sunrise, sunset)
    }

    internal fun hebrewDateForCivilDate(date: LocalDate): HebrewDate {
        val fixed = date.toEpochDay() + FIXED_DATE_UNIX_EPOCH
        var year = ((fixed - HEBREW_EPOCH) / 366L).toInt().coerceAtLeast(1)
        while (fixed >= fixedFromHebrew(year + 1, 7, 1)) year += 1
        while (fixed < fixedFromHebrew(year, 7, 1)) year -= 1

        var month = if (fixed < fixedFromHebrew(year, 1, 1)) 7 else 1
        while (fixed > fixedFromHebrew(year, month, daysInHebrewMonth(year, month))) {
            month += 1
        }
        val day = (fixed - fixedFromHebrew(year, month, 1) + 1L).toInt()
        return HebrewDate(year, month, day)
    }

    private fun fixedFromHebrew(year: Int, month: Int, day: Int): Long {
        var fixed = day.toLong() + hebrewNewYear(year) + HEBREW_EPOCH - 1L
        if (month < 7) {
            for (candidate in 7..lastHebrewMonth(year)) fixed += daysInHebrewMonth(year, candidate)
            for (candidate in 1 until month) fixed += daysInHebrewMonth(year, candidate)
        } else {
            for (candidate in 7 until month) fixed += daysInHebrewMonth(year, candidate)
        }
        return fixed
    }

    private fun hebrewNewYear(year: Int): Long = hebrewDelay1(year) + hebrewDelay2(year)

    private fun hebrewDelay1(year: Int): Long {
        val months = (235L * year - 234L) / 19L
        val parts = 12_084L + 13_753L * months
        var day = 29L * months + parts / 25_920L
        if ((3L * (day + 1L)) % 7L < 3L) day += 1L
        return day
    }

    private fun hebrewDelay2(year: Int): Long {
        val last = hebrewDelay1(year - 1)
        val present = hebrewDelay1(year)
        val next = hebrewDelay1(year + 1)
        return when {
            next - present == 356L -> 2L
            present - last == 382L -> 1L
            else -> 0L
        }
    }

    private fun isHebrewLeapYear(year: Int): Boolean = (7 * year + 1) % 19 < 7

    private fun lastHebrewMonth(year: Int): Int = if (isHebrewLeapYear(year)) 13 else 12

    private fun daysInHebrewYear(year: Int): Long = hebrewNewYear(year + 1) - hebrewNewYear(year)

    private fun daysInHebrewMonth(year: Int, month: Int): Int = when {
        month in setOf(2, 4, 6, 10, 13) -> 29
        month == 12 && !isHebrewLeapYear(year) -> 29
        month == 8 && daysInHebrewYear(year) % 10L != 5L -> 29
        month == 9 && daysInHebrewYear(year) % 10L == 3L -> 29
        else -> 30
    }

    private data class SunTimes(val sunrise: Double, val sunset: Double)

    companion object {
        val JERUSALEM_ZONE: ZoneId = ZoneId.of("Asia/Jerusalem")
        private const val JERUSALEM_LATITUDE = 31.7768514
        private const val JERUSALEM_LONGITUDE = 35.2331664
        private const val MUSIC_MONTH_SWITCH_HOUR = 6
        private const val HEBREW_EPOCH = -1_373_427L
        private const val FIXED_DATE_UNIX_EPOCH = 719_163L
        private val THREE_DAYS: Duration = Duration.ofDays(3)
        private val FALLBACK_RETENTION: Duration = Duration.ofDays(31)
    }
}
