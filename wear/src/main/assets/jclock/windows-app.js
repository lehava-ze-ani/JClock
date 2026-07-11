(function () {
  const MOLAD_HALAKIM_PER_HOUR = 1080;
  const MOLAD_HALAKIM_PER_DAY = 25920;
  const MOLAD_HALAKIM_PER_LUNAR_CYCLE = (29 * MOLAD_HALAKIM_PER_DAY) + 13753;
  const MOLAD_NEW_MOON_OF_CREATION = 31524;
  const MOLAD_NOON = 18 * MOLAD_HALAKIM_PER_HOUR;
  const MOLAD_AM3_11_20 = 9 * MOLAD_HALAKIM_PER_HOUR + 204;
  const MOLAD_AM9_32_43 = 15 * MOLAD_HALAKIM_PER_HOUR + 589;

  const elements = {
    sunTime: document.getElementById("sun-time"),
    moonTime: document.getElementById("moon-time"),
    sunMazal: document.getElementById("sun-mazal"),
    moonMazal: document.getElementById("moon-mazal"),
    sunLine: document.getElementById("sun-line"),
    moonLine: document.getElementById("moon-line"),
    hebrewDate: document.getElementById("hebrew-date"),
    civilTime: document.getElementById("civil-time"),
    civilDate: document.getElementById("civil-date"),
    dateButton: document.getElementById("date-orbit"),
    orbitSunRadius: document.getElementById("orbit-sun-radius"),
    orbitMoonRadius: document.getElementById("orbit-moon-radius"),
    orbitSun: document.getElementById("orbit-sun"),
    orbitMoon: document.getElementById("orbit-moon"),
    currentLocation: document.getElementById("current-location"),
    jerusalem: document.getElementById("jerusalem"),
    timeSlider: document.getElementById("time-offset-slider"),
    timeOffsetLabel: document.getElementById("time-offset-label"),
    timeNow: document.getElementById("time-now"),
    whatsappLearning: document.getElementById("jclock-whatsapp-learning")
  };

  window.shouldOpenDigitalChazan = function () {
    return false;
  };

  const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";
  const MODE_JERUSALEM = "jerusalem";
  const MODE_CURRENT_LOCATION = "current-location";
  const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000
  };
  const DEMO_LOCATIONS = {
    "chelsea-hotel": {
      latitude: 40.7444,
      longitude: -73.9967,
      timeZone: "America/New_York"
    },
    chelsea: {
      latitude: 40.7444,
      longitude: -73.9967,
      timeZone: "America/New_York"
    },
    ny: {
      latitude: 40.7128,
      longitude: -74.006,
      timeZone: "America/New_York"
    },
    "new-york": {
      latitude: 40.7128,
      longitude: -74.006,
      timeZone: "America/New_York"
    }
  };
  const demoLocationKey = new URLSearchParams(window.location.search).get("demoLocation")?.toLowerCase();
  const demoLocation = DEMO_LOCATIONS[demoLocationKey] || null;
  const isHebrewUi = (navigator.language || navigator.userLanguage || "").toLowerCase().startsWith("he");
  const uiText = isHebrewUi
    ? {
        appName: "קידוש החודש",
        currentLocation: "מקומי",
        jerusalem: "ירושלים",
        sun: "חמה",
        moon: "לבנה",
        hebrewDate: "תאריך עברי",
        systemClock: "שעון מערכת",
        musicVolume: "עוצמת מוזיקה",
        noLocation: "לא ניתן לקבל מיקום נוכחי.",
        geoUnsupported: "הדפדפן לא תומך בהרשאת מיקום.",
        geoDenied: "לא התקבלה הרשאת מיקום. השעון נשאר על ירושלים."
      }
    : {
        appName: "Sanctifying the Month",
        currentLocation: "Local",
        jerusalem: "Jerusalem",
        sun: "Sun",
        moon: "Moon",
        hebrewDate: "Hebrew date",
        systemClock: "System clock",
        musicVolume: "Music volume",
        noLocation: "Current location is unavailable.",
        geoUnsupported: "This browser does not support location permission.",
        geoDenied: "Location permission was not granted. The clock remains set to Jerusalem."
      };

  const legacyConvertDateTimeToFloat = window.convertDateTimeToFloat;
  const legacyGetMoonTimes = window.SunCalc && window.SunCalc.getMoonTimes;
  let activeMode = demoLocation ? MODE_CURRENT_LOCATION : MODE_JERUSALEM;
  let currentGeoPoint = demoLocation
    ? {
        latitude: demoLocation.latitude,
        longitude: demoLocation.longitude,
        accuracy: null
      }
    : null;
  let isRequestingCurrentLocation = false;
  let simulatedOffsetSeconds = 0;

  function clockDate() {
    return new Date(Date.now() + simulatedOffsetSeconds * 1000);
  }

  function datePartsInTimeZone(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    const parts = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== "literal") parts[part.type] = part.value;
    }

    const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour,
      minute: Number(parts.minute),
      second: Number(parts.second),
      millisecond: date.getMilliseconds()
    };
  }

  function jerusalemDateParts(date = clockDate()) {
    return datePartsInTimeZone(date, JERUSALEM_TIME_ZONE);
  }

  function deviceDateParts(date = clockDate()) {
    if (demoLocation) return datePartsInTimeZone(date, demoLocation.timeZone);

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      millisecond: date.getMilliseconds()
    };
  }

  function activeDateParts(date = clockDate()) {
    return activeMode === MODE_CURRENT_LOCATION ? deviceDateParts(date) : jerusalemDateParts(date);
  }

  function civilHourFromParts(parts) {
    return parts.hour + (parts.minute / 60) + (parts.second / 3600) + (parts.millisecond / 3600000);
  }

  function activeCivilHour(date = clockDate()) {
    return civilHourFromParts(activeDateParts(date));
  }

  function applyLanguage() {
    document.documentElement.lang = isHebrewUi ? "he" : "en";
    document.documentElement.dir = isHebrewUi ? "rtl" : "ltr";
    document.title = uiText.appName;
    document.querySelector("meta[name='application-name']")?.setAttribute("content", uiText.appName);
    document.querySelector("meta[name='apple-mobile-web-app-title']")?.setAttribute("content", uiText.appName);
    document.querySelector("meta[property='og:title']")?.setAttribute("content", uiText.appName);
    document.querySelector(".windows-desktop")?.setAttribute("aria-label", uiText.appName);
    document.querySelector(".toolbar-window")?.setAttribute("aria-label", uiText.appName);
    document.querySelector(".system-clock")?.setAttribute("aria-label", uiText.systemClock);
    document.querySelector(".jclock-volume-control")?.setAttribute("title", uiText.musicVolume);
    document.getElementById("jclock-music-volume")?.setAttribute("aria-label", uiText.musicVolume);
    if (elements.whatsappLearning) {
      const linkText = isHebrewUi
        ? "אמן שרוצה ללמוד איך לנגן ניגון מכוון? דברו איתי ב־WhatsApp"
        : "Musician interested in learning how to play a melody with intention? Message me on WhatsApp";
      const message = isHebrewUi
        ? "שלום, אני רוצה ללמוד איך לנגן ניגון מכוון."
        : "Hello, I would like to learn how to play a melody with intention.";
      elements.whatsappLearning.querySelector("span").textContent = linkText;
      elements.whatsappLearning.setAttribute("aria-label", linkText);
      elements.whatsappLearning.href = `https://wa.me/972587401735?text=${encodeURIComponent(message)}`;
    }
    elements.timeNow.textContent = isHebrewUi ? "עכשיו" : "Now";
    elements.timeSlider.setAttribute("aria-label", isHebrewUi
      ? "הזזת הזמן בקפיצות של חמש דקות, משלוש שעות אחורה עד שלוש שעות קדימה"
      : "Shift time in five-minute steps, from three hours back to three hours forward");
    elements.currentLocation.replaceChildren(...uiText.currentLocation.split(" ").map((word) => {
      const line = document.createElement("span");
      line.textContent = word;
      return line;
    }));
    elements.jerusalem.textContent = uiText.jerusalem;
    elements.dateButton.setAttribute("aria-label", uiText.hebrewDate);
    elements.sunLine.querySelector(".clock-label").textContent = uiText.sun;
    elements.moonLine.querySelector(".clock-label").textContent = uiText.moon;
  }

  if (typeof legacyConvertDateTimeToFloat === "function") {
    window.convertDateTimeToFloat = function (date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return legacyConvertDateTimeToFloat(date);
      }

      return activeCivilHour(date);
    };
  }

  function moonHoursLater(date, hours) {
    return new Date(date.valueOf() + hours * 3600000);
  }

  function jerusalemMidnightFromLocalDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const probe = new Date(Date.UTC(year, month, day, 12));
    return new Date(Date.UTC(year, month, day, -jerusalemOffsetHours(probe)));
  }

  function activeMidnightFromLocalDate(date) {
    if (activeMode === MODE_JERUSALEM) return jerusalemMidnightFromLocalDate(date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    if (!demoLocation) return new Date(year, month, day, 0, 0, 0, 0);
    const probe = new Date(Date.UTC(year, month, day, 12));
    return new Date(Date.UTC(year, month, day, -deviceOffsetHours(probe)));
  }

  function calculateMoonTimesFromStart(start, lat, lng) {
    const rad = Math.PI / 180;
    const hc = 0.133 * rad;
    let h0 = SunCalc.getMoonPosition(start, lat, lng).altitude - hc;
    let rise;
    let set;
    let ye = 0;

    for (let i = 1; i <= 25; i += 2) {
      const h1 = SunCalc.getMoonPosition(moonHoursLater(start, i), lat, lng).altitude - hc;
      const h2 = SunCalc.getMoonPosition(moonHoursLater(start, i + 1), lat, lng).altitude - hc;
      const a = (h0 + h2) / 2 - h1;
      const b = (h2 - h0) / 2;
      if (Math.abs(a) < 1e-12) {
        h0 = h2;
        continue;
      }
      const xe = -b / (2 * a);
      ye = (a * xe + b) * xe + h1;
      const d = b * b - 4 * a * h1;
      let roots = 0;
      let x1;
      let x2;

      if (d >= 0) {
        const dx = Math.sqrt(d) / (Math.abs(a) * 2);
        x1 = xe - dx;
        x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots += 1;
        if (Math.abs(x2) <= 1) roots += 1;
        if (x1 < -1) x1 = x2;
      }

      if (roots === 1) {
        if (h0 < 0) rise = i + x1;
        else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }

      if (rise !== undefined && set !== undefined) break;
      h0 = h2;
    }

    const result = {};
    if (rise !== undefined) result.rise = moonHoursLater(start, rise);
    if (set !== undefined) result.set = moonHoursLater(start, set);
    if (rise === undefined && set === undefined) result[ye > 0 ? "alwaysUp" : "alwaysDown"] = true;
    return result;
  }

  if (typeof legacyGetMoonTimes === "function") {
    window.SunCalc.getMoonTimes = function (date, lat, lng, inUTC) {
      if (inUTC || !(date instanceof Date) || Number.isNaN(date.getTime())) {
        return legacyGetMoonTimes.call(this, date, lat, lng, inUTC);
      }

      return calculateMoonTimesFromStart(activeMidnightFromLocalDate(date), lat, lng);
    };
  }

  function pad(value, size) {
    return String(Math.trunc(Number(value) || 0)).padStart(size, "0");
  }

  function normalizeHebrewTime(time) {
    let total = Math.trunc(Number(time.hour) || 0) * 1080 * 76;
    total += Math.trunc(Number(time.minute) || 0) * 76;
    total += Math.trunc(Number(time.second) || 0);
    total = ((total % (24 * 1080 * 76)) + (24 * 1080 * 76)) % (24 * 1080 * 76);
    const hour = Math.floor(total / (1080 * 76));
    total -= hour * 1080 * 76;
    const minute = Math.floor(total / 76);
    const second = total - minute * 76;
    return { hour, minute, second, day: time.day };
  }

  function formatHebrewTime(time) {
    if (!Number.isFinite(time.hour) || !Number.isFinite(time.minute) || !Number.isFinite(time.second)) {
      return "--:----:--";
    }
    const normalized = normalizeHebrewTime(time);
    return `${pad(normalized.hour, 2)}:${pad(normalized.minute, 4)}:${pad(normalized.second, 2)}`;
  }

  function readClockSnapshot() {
    return {
      moon: {
        hour: Number(lbHour),
        minute: Number(lbMinute),
        second: Number(lbSecond),
        day: Number(hebrewday)
      },
      sun: {
        hour: Number(lbHour4Man),
        minute: Number(lbMinute4Man),
        second: Number(lbSecond4Man),
        day: Number(hebrewday_man)
      }
    };
  }

  function progress(time) {
    if (!Number.isFinite(time.hour)) return 0;
    const normalized = normalizeHebrewTime(time);
    const fractionalHour = normalized.hour + (normalized.minute + normalized.second / 76) / 1080;
    const value = (fractionalHour - 12) / 24;
    return value - Math.floor(value);
  }

  function setOrbit(dot, value, radiusLine) {
    const glyphSize = dot.offsetWidth || 14;
    const textWidth = elements.hebrewDate.offsetWidth || 74;
    const desiredRadius = textWidth / 2 + glyphSize / 2 + 11;
    const fitRadiusX = elements.dateButton.clientWidth / 2 - glyphSize / 2 - 3;
    const fitRadiusY = elements.dateButton.clientHeight / 2 - glyphSize / 2 - 2;
    const trackRadius = Math.max(
      0,
      Math.min(
        fitRadiusX,
        fitRadiusY,
        (elements.dateButton.clientWidth - glyphSize - 6) / 2,
        (elements.dateButton.clientHeight - glyphSize - 4) / 2
      )
    );
    const minRadius = Math.min(glyphSize + 4, trackRadius);
    const radius = Math.max(minRadius, Math.min(Math.max(desiredRadius, trackRadius * 0.96), trackRadius));
    const angle = -value * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    elements.dateButton.style.setProperty("--orbit-diameter", `${Math.round(radius * 2)}px`);
    if (radiusLine) {
      radiusLine.style.setProperty("--orbit-radius", `${Math.max(0, radius)}px`);
      radiusLine.style.setProperty("--orbit-angle", `${angle}rad`);
    }
    dot.style.transform = `translate(${x}px, ${y}px)`;
  }

  function positiveModulo(value, modulo) {
    const result = value % modulo;
    return result < 0 ? result + modulo : result;
  }

  function normalizeHour(value) {
    let hour = Number(value) || 0;
    while (hour < 0) hour += 24;
    while (hour >= 24) hour -= 24;
    return hour;
  }

  function currentMoladPeriodKey(sun) {
    const time = normalizeHebrewTime(sun);
    const hourValue = normalizeHour(time.hour + (time.minute + time.second / 76) / 1080);
    if (hourValue >= 12 && hourValue < 18) return "month";
    if (hourValue >= 18) return "year";
    return hourValue < 6 ? "yovel" : "nisan";
  }

  function canonicalMoladMonthKey(monthKey) {
    const key = String(monthKey || "").trim().toLowerCase().replace(/[\s_]/g, "");
    const aliases = {
      tishrei: "tishri",
      cheshvan: "heshvan",
      adar1: "adari",
      adari: "adari",
      adar2: "adarii",
      adarii: "adarii",
      nissan: "nisan",
      iyar: "iyyar",
      iyyar: "iyyar",
      tamuz: "tammuz"
    };
    return aliases[key] || key;
  }

  function isHebrewLeapYear(hebrewYear) {
    return positiveModulo(7 * Number(hebrewYear) + 1, 19) < 7;
  }

  function tishri1(metonicYear, moladDay, moladHalakim) {
    let tishriDay = Math.trunc(moladDay);
    let dow = positiveModulo(tishriDay, 7);
    const leap = [2, 5, 7, 10, 13, 16, 18].includes(metonicYear);
    const lastWasLeap = [3, 6, 8, 11, 14, 17, 0].includes(metonicYear);

    if (
      moladHalakim >= MOLAD_NOON ||
      (!leap && dow === 2 && moladHalakim >= MOLAD_AM3_11_20) ||
      (lastWasLeap && dow === 1 && moladHalakim >= MOLAD_AM9_32_43)
    ) {
      tishriDay += 1;
      dow = positiveModulo(dow + 1, 7);
    }

    if (dow === 3 || dow === 5 || dow === 0) {
      tishriDay += 1;
    }

    return tishriDay;
  }

  function tishriDayForYear(hebrewYear) {
    const totalHalakim = MOLAD_NEW_MOON_OF_CREATION + monthsBeforeTishrei(hebrewYear) * MOLAD_HALAKIM_PER_LUNAR_CYCLE;
    const moladDay = Math.floor(totalHalakim / MOLAD_HALAKIM_PER_DAY);
    const moladHalakim = positiveModulo(totalHalakim, MOLAD_HALAKIM_PER_DAY);
    const metonicYear = positiveModulo(Number(hebrewYear) - 1, 19);
    return tishri1(metonicYear, moladDay, moladHalakim);
  }

  function hebrewYearLength(hebrewYear) {
    return tishriDayForYear(Number(hebrewYear) + 1) - tishriDayForYear(Number(hebrewYear));
  }

  function hebrewMonthLength(hebrewYear, sourceMonth) {
    const metonicYear = positiveModulo(Number(hebrewYear) - 1, 19);
    const leap = [2, 5, 7, 10, 13, 16, 18].includes(metonicYear);
    const yearLength = hebrewYearLength(hebrewYear);
    const month = Number(sourceMonth);
    if (month === 2) return yearLength === 355 || yearLength === 385 ? 30 : 29;
    if (month === 3) return yearLength === 353 || yearLength === 383 ? 29 : 30;
    if (month === 6) return leap ? 30 : 29;
    const lengths = {
      1: 30,
      4: 29,
      5: 30,
      7: 29,
      8: 30,
      9: 29,
      10: 30,
      11: 29,
      12: 30,
      13: 29
    };
    return lengths[month] || 30;
  }

  function hebrewMonthKeysForYear(hebrewYear) {
    return isHebrewLeapYear(hebrewYear)
      ? ["tishri", "heshvan", "kislev", "tevet", "shevat", "adari", "adarii", "nisan", "iyyar", "sivan", "tammuz", "av", "elul"]
      : ["tishri", "heshvan", "kislev", "tevet", "shevat", "adar", "nisan", "iyyar", "sivan", "tammuz", "av", "elul"];
  }

  function getMonthOffsetFromTishrei(hebrewYear, monthKey) {
    const canonical = canonicalMoladMonthKey(monthKey);
    const months = hebrewMonthKeysForYear(hebrewYear);
    const index = months.indexOf(canonical);
    return index >= 0 ? index : 0;
  }

  function nextHebrewMonth(hebrewYear, monthKey) {
    const canonical = canonicalMoladMonthKey(monthKey);
    const months = hebrewMonthKeysForYear(hebrewYear);
    const index = months.indexOf(canonical);
    if (index >= 0 && index + 1 < months.length) {
      return { year: hebrewYear, monthKey: months[index + 1] };
    }
    return { year: hebrewYear + 1, monthKey: "tishri" };
  }

  function buildMoladMonth(hebrewYear, monthKey) {
    const canonical = canonicalMoladMonthKey(monthKey);
    return {
      year: Number(hebrewYear),
      monthKey: canonical,
      month: getMonthOffsetFromTishrei(hebrewYear, canonical) + 1
    };
  }

  function buildRoshChodeshAwareMoladMonth(hebrew) {
    let year = Number(hebrew.year);
    let monthKey = canonicalMoladMonthKey(hebrew.month_name);
    if (Number(hebrew.date) === 30) {
      const next = nextHebrewMonth(year, monthKey);
      year = next.year;
      monthKey = next.monthKey;
    }
    return buildMoladMonth(year, monthKey);
  }

  function getYovelStartYear(hebrewYear) {
    return Number(hebrewYear) - positiveModulo(Number(hebrewYear) - 1, 49);
  }

  function getLastNisanYear(hebrew) {
    const nisanOffset = getMonthOffsetFromTishrei(hebrew.year, "nisan");
    const currentOffset = getMonthOffsetFromTishrei(hebrew.year, hebrew.month_name);
    return currentOffset >= nisanOffset ? Number(hebrew.year) : Number(hebrew.year) - 1;
  }

  function moladMonthForPeriod(hebrew, periodKey) {
    if (periodKey === "month") return buildMoladMonth(hebrew.year, hebrew.month_name);
    if (periodKey === "year") return buildMoladMonth(hebrew.year, "tishri");
    if (periodKey === "yovel") return buildMoladMonth(getYovelStartYear(hebrew.year), "tishri");
    if (periodKey === "nisan") return buildMoladMonth(getLastNisanYear(hebrew), "nisan");
    return buildMoladMonth(hebrew.year, hebrew.month_name);
  }

  function addDaysToDateParts(parts, days) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    date.setUTCDate(date.getUTCDate() + days);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  function hebrewDateWithoutTimeBoundary(parts) {
    const saved = {
      birthHour,
      birthMin,
      birthSec,
      birthMs,
      tzeit
    };

    try {
      birthHour = 0;
      birthMin = 0;
      birthSec = 0;
      birthMs = 0;
      tzeit = 24;
      return hebrewDate(parts.year, parts.month, parts.day, "English");
    } finally {
      birthHour = saved.birthHour;
      birthMin = saved.birthMin;
      birthSec = saved.birthSec;
      birthMs = saved.birthMs;
      tzeit = saved.tzeit;
    }
  }

  function moladHebrewDateForJerusalem() {
    const now = jerusalemDateParts();
    return hebrewDateWithoutTimeBoundary(now);
  }

  function monthsBeforeTishrei(hebrewYear) {
    const completedYears = Number(hebrewYear) - 1;
    const cycles = Math.floor(completedYears / 19);
    const yearInCycle = completedYears % 19;
    return (235 * cycles) + (12 * yearInCycle) + Math.floor((7 * yearInCycle + 1) / 19);
  }

  function buildMoladInfoFromTotalHalakim(totalHalakim) {
    const absoluteDay = Math.floor(totalHalakim / MOLAD_HALAKIM_PER_DAY);
    const halakimOfDay = positiveModulo(totalHalakim, MOLAD_HALAKIM_PER_DAY);
    return {
      jewishDay: positiveModulo(absoluteDay, 7) + 1,
      jewishHour: Math.floor(halakimOfDay / MOLAD_HALAKIM_PER_HOUR),
      parts: positiveModulo(halakimOfDay, MOLAD_HALAKIM_PER_HOUR),
      absoluteDay
    };
  }

  function buildMoladInfoForMonth(moladMonth) {
    const monthOffset = getMonthOffsetFromTishrei(moladMonth.year, moladMonth.monthKey);
    const monthsElapsed = monthsBeforeTishrei(moladMonth.year) + monthOffset;
    const totalHalakim = MOLAD_NEW_MOON_OF_CREATION + monthsElapsed * MOLAD_HALAKIM_PER_LUNAR_CYCLE;
    return buildMoladInfoFromTotalHalakim(totalHalakim);
  }

  function commercialHourMidaNumber(hebrewDay, hebrewHour) {
    const dayOffset = {
      1: 6,
      2: 2,
      3: 5,
      4: 1,
      5: 4,
      6: 7,
      7: 3
    }[hebrewDay] || 6;
    let index = positiveModulo(dayOffset + Number(hebrewHour), 7);
    if (index === 0) index = 7;
    return {
      1: 4,
      2: 1,
      3: 2,
      4: 3,
      5: 5,
      6: 6,
      7: 7
    }[index] || 1;
  }

  function midaForNumber(number) {
    const colors = {
      1: "#5DBCD2",
      2: "#A6230E",
      3: "#815AA8",
      4: "#84C45E",
      5: "#BA8D1A",
      6: "#B45D02",
      7: "#808080"
    };
    return colors[number] || colors[1];
  }

  function moladColorsForSourceTime(sourceTime, hebrew) {
    const periodKey = currentMoladPeriodKey(sourceTime);
    const moladMonth = moladMonthForPeriod(hebrew, periodKey);
    const molad = buildMoladInfoForMonth(moladMonth);
    return {
      foreground: midaForNumber(commercialHourMidaNumber(molad.jewishDay, molad.jewishHour)),
      background: midaForNumber(molad.jewishDay)
    };
  }

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return match
      ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
      : { r: 18, g: 20, b: 22 };
  }

  function rgbToHex(color) {
    const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  function blend(a, b, amount) {
    const from = hexToRgb(a);
    const to = hexToRgb(b);
    return rgbToHex({
      r: from.r + (to.r - from.r) * amount,
      g: from.g + (to.g - from.g) * amount,
      b: from.b + (to.b - from.b) * amount
    });
  }

  function applyMoladButtonColors(button, colors) {
    button.style.background = colors.background;
    button.style.color = colors.foreground;
    button.style.borderColor = colors.foreground;
    button.style.boxShadow = `inset 0 0 0 2px ${colors.foreground}, inset 0 0 24px rgba(255, 255, 255, 0.08), 0 0 20px ${colors.background}`;
    button.style.textShadow = `0 2px 3px rgba(0, 0, 0, 0.88), 0 0 14px ${colors.foreground}, 0 0 28px ${colors.foreground}`;
  }

  function applyNeutralButtonColors(button) {
    button.style.background = "#121416";
    button.style.color = "#aaaeb4";
    button.style.borderColor = "#3a3e42";
    button.style.boxShadow = "";
    button.style.textShadow = "";
  }

  function setMoonPhase(day, monthLength) {
    const safeLength = Math.max(29, Number(monthLength) || 30);
    const clampedDay = Math.max(1, Math.min(Number(day) || 1, safeLength));
    const phase = ((clampedDay - 1) / Math.max(1, safeLength - 1)) % 1;
    const illumination = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    elements.orbitMoon.style.setProperty("--moon-lit", `${Math.round(illumination * 100)}%`);
    elements.orbitMoon.classList.toggle("waxing", phase <= 0.5);
    elements.orbitMoon.classList.toggle("waning", phase > 0.5);
  }

  function currentHebrewDate() {
    const now = activeDateParts();
    const activeHour = civilHourFromParts(now);
    const tzeitHour = Number(tzeit);
    const dateParts = addDaysToDateParts(now, Number.isFinite(tzeitHour) && activeHour > tzeitHour ? 1 : 0);
    const date = hebrewDateWithoutTimeBoundary(dateParts);
    const sourceMonth = Number(date.month);
    const displayMonth = sourceMonth >= 8 && sourceMonth <= 13
      ? sourceMonth - 7
      : sourceMonth >= 1 && sourceMonth <= 7
        ? sourceMonth + 6
        : sourceMonth;
    return {
      day: Number(date.date),
      month: displayMonth,
      year: Number(date.year) - 3760,
      sourceMonth,
      sourceYear: Number(date.year),
      monthLength: hebrewMonthLength(Number(date.year), sourceMonth)
    };
  }

  function formatDisplayDate(date) {
    return `${pad(date.day, 2)}-${pad(date.month, 2)}-${pad(date.year, 4)}`;
  }

  function timeZoneOffsetHours(date = clockDate(), timeZone = JERUSALEM_TIME_ZONE) {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset"
      });
      const zoneName = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "";
      const match = zoneName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
      if (match) {
        const hours = Number(match[1]);
        const minutes = Number(match[2] || 0) / 60;
        return hours + Math.sign(hours || 1) * minutes;
      }
    } catch (_) {
      // Fall back below when shortOffset is unavailable.
    }

    const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
    const zoned = new Date(date.toLocaleString("en-US", { timeZone }));
    return (zoned.getTime() - utc.getTime()) / 3600000;
  }

  function jerusalemOffsetHours(date = clockDate()) {
    return timeZoneOffsetHours(date, JERUSALEM_TIME_ZONE);
  }

  function deviceOffsetHours(date = clockDate()) {
    if (demoLocation) return timeZoneOffsetHours(date, demoLocation.timeZone);
    return date.getTimezoneOffset() / -60;
  }

  function activeOffsetHours(date = clockDate()) {
    return activeMode === MODE_CURRENT_LOCATION ? deviceOffsetHours(date) : jerusalemOffsetHours(date);
  }

  function setActiveCalculationContext() {
    const nowDate = clockDate();
    const now = activeDateParts(nowDate);
    const useCurrentLocation = activeMode === MODE_CURRENT_LOCATION && currentGeoPoint;
    longitude = useCurrentLocation ? currentGeoPoint.longitude : defaultLongitude;
    latitude = useCurrentLocation ? currentGeoPoint.latitude : defaultLatitude;
    tz = activeOffsetHours(nowDate);
    birthYear = now.year;
    birthMonth = now.month;
    birthDay = now.day;
    birthGMT = tz;
    birthHour = now.hour;
    birthMin = now.minute;
    birthSec = now.second;
    birthMs = now.millisecond;
    previousDigitalChazanHour = null;
    set_dst();
    month = now.month - 1;
    day = now.day - 1;
    year = now.year - 1900;
    set_date_vars();
    list_pos();
  }

  function calculateJerusalemClockSnapshot() {
    const savedMode = activeMode;
    const savedGeoPoint = currentGeoPoint;
    activeMode = MODE_JERUSALEM;
    currentGeoPoint = null;
    setActiveCalculationContext();
    hebrewclock();
    const snapshot = readClockSnapshot();
    activeMode = savedMode;
    currentGeoPoint = savedGeoPoint;
    return snapshot;
  }

  function updateCivilClock() {
    const now = activeDateParts();
    elements.civilTime.textContent = `${pad(now.hour, 2)}:${pad(now.minute, 2)}`;
    elements.civilDate.textContent = `${pad(now.day, 2)}/${pad(now.month, 2)}/${now.year}`;
  }

  function tick() {
    try {
      const jerusalemClock = calculateJerusalemClockSnapshot();
      setActiveCalculationContext();
      hebrewclock();

      const { moon, sun } = readClockSnapshot();
      const moladHebrewDate = moladHebrewDateForJerusalem();
      const sunMoladColors = moladColorsForSourceTime(jerusalemClock.sun, moladHebrewDate);
      const moonMoladColors = moladColorsForSourceTime(jerusalemClock.moon, moladHebrewDate);
      const hebrewDisplayDate = currentHebrewDate();

      elements.sunTime.textContent = formatHebrewTime(sun);
      elements.moonTime.textContent = formatHebrewTime(moon);
      elements.hebrewDate.textContent = formatDisplayDate(hebrewDisplayDate);
      applyMoladButtonColors(elements.currentLocation, sunMoladColors);
      applyMoladButtonColors(elements.jerusalem, moonMoladColors);
      applyNeutralButtonColors(elements.dateButton);
      setMoonPhase(hebrewDisplayDate.day, hebrewDisplayDate.monthLength);
      setOrbit(elements.orbitSun, progress(sun), elements.orbitSunRadius);
      setOrbit(elements.orbitMoon, progress(moon), elements.orbitMoonRadius);
      document.body.style.backgroundImage = "";
    } catch (error) {
      elements.sunTime.textContent = "--:----:--";
      elements.moonTime.textContent = "--:----:--";
      console.error(error);
    }
    updateCivilClock();
  }

  function updateModeButtons() {
    const currentIsActive = activeMode === MODE_CURRENT_LOCATION;
    elements.currentLocation.classList.toggle("active", currentIsActive);
    elements.jerusalem.classList.toggle("active", !currentIsActive);
    elements.currentLocation.setAttribute("aria-pressed", currentIsActive ? "true" : "false");
    elements.jerusalem.setAttribute("aria-pressed", currentIsActive ? "false" : "true");
  }

  function formatOffsetLabel(seconds) {
    if (!seconds) return isHebrewUi ? "עכשיו" : "Now";
    const sign = seconds > 0 ? "+" : "−";
    const absoluteSeconds = Math.abs(Math.round(seconds));
    const hours = Math.floor(absoluteSeconds / 3600);
    const minutes = Math.floor((absoluteSeconds % 3600) / 60);
    return `${sign}${hours}:${pad(minutes, 2)}`;
  }

  function setSimulatedOffset(seconds) {
    simulatedOffsetSeconds = Math.max(-10800, Math.min(10800, Number(seconds) || 0));
    elements.timeSlider.value = String(simulatedOffsetSeconds);
    elements.timeOffsetLabel.value = formatOffsetLabel(simulatedOffsetSeconds);
    elements.timeNow.classList.toggle("active", simulatedOffsetSeconds === 0);
    tick();
  }

  function setRequestingCurrentLocation(value) {
    isRequestingCurrentLocation = value;
    elements.currentLocation.disabled = value;
    elements.currentLocation.setAttribute("aria-busy", value ? "true" : "false");
  }

  function useJerusalem() {
    activeMode = MODE_JERUSALEM;
    if (window.AndroidLocation) window.AndroidLocation.stopLocationUpdates();
    setRequestingCurrentLocation(false);
    updateModeButtons();
    tick();
  }

  function alertLocationError(message) {
    window.alert(message || uiText.noLocation);
  }

  function requestCurrentLocation() {
    if (isRequestingCurrentLocation) return;

    if (demoLocation) {
      currentGeoPoint = {
        latitude: demoLocation.latitude,
        longitude: demoLocation.longitude,
        accuracy: null
      };
      activeMode = MODE_CURRENT_LOCATION;
      updateModeButtons();
      tick();
      return;
    }

    if (window.AndroidLocation) {
      setRequestingCurrentLocation(true);
      window.jclockPhoneLocationResponse = function (result) {
        if (result && result.error) {
          setRequestingCurrentLocation(false);
          if (!currentGeoPoint) activeMode = MODE_JERUSALEM;
          updateModeButtons();
          alertLocationError(result.error);
          tick();
          return;
        }
        currentGeoPoint = {
          latitude: Number(result.latitude),
          longitude: Number(result.longitude),
          accuracy: Number(result.accuracy) || null
        };
        activeMode = MODE_CURRENT_LOCATION;
        setRequestingCurrentLocation(false);
        updateModeButtons();
        tick();
      };
      window.AndroidLocation.startLocationUpdates();
      return;
    }

    if (!navigator.geolocation) {
      alertLocationError(uiText.geoUnsupported);
      return;
    }

    setRequestingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      function (position) {
        currentGeoPoint = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
          accuracy: Number(position.coords.accuracy) || null
        };
        activeMode = MODE_CURRENT_LOCATION;
        setRequestingCurrentLocation(false);
        updateModeButtons();
        tick();
      },
      function () {
        setRequestingCurrentLocation(false);
        if (!currentGeoPoint) activeMode = MODE_JERUSALEM;
        updateModeButtons();
        alertLocationError(uiText.geoDenied);
        tick();
      },
      GEOLOCATION_OPTIONS
    );
  }

  elements.currentLocation.addEventListener("click", function () {
    requestCurrentLocation();
  });

  elements.jerusalem.addEventListener("click", function () {
    useJerusalem();
  });

  elements.timeSlider.addEventListener("input", function () {
    simulatedOffsetSeconds = -Number(this.value || 0);
    elements.timeOffsetLabel.value = formatOffsetLabel(simulatedOffsetSeconds);
    elements.timeNow.classList.toggle("active", simulatedOffsetSeconds === 0);
    tick();
  });

  elements.timeNow.addEventListener("click", function () {
    setSimulatedOffset(0);
  });

  applyLanguage();
  updateModeButtons();
  setSimulatedOffset(0);
  window.setInterval(tick, 1000);
})();
