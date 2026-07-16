// JClock calculation engine for Zepp OS.
//
// This is a direct, dependency-free port of the authoritative local JClock
// implementation under WayBackToHeaven/public/jclock and jclock.hpp.  Keep the
// deliberately unusual source-clock units: 1080 parts per hour and 76 moments
// per part.

export const JERUSALEM_LATITUDE = 31.7768514
export const JERUSALEM_LONGITUDE = 35.2331664

const PI = Math.PI
const RAD = PI / 180
const J1970 = 2440588
const J2000 = 2451545
const PARTS_PER_HOUR = 1080
const MOMENTS_PER_PART = 76
const SOURCE_UNITS_PER_HOUR = PARTS_PER_HOUR * MOMENTS_PER_PART
const SOURCE_UNITS_PER_DAY = 24 * SOURCE_UNITS_PER_HOUR

const GREG_SDN_OFFSET = 32045
const DAYS_PER_5_MONTHS = 153
const DAYS_PER_4_YEARS = 1461
const DAYS_PER_400_YEARS = 146097
const HALAKIM_PER_DAY = 25920
const HALAKIM_PER_LUNAR_CYCLE = 29 * HALAKIM_PER_DAY + 13753
const HALAKIM_PER_METONIC_CYCLE = HALAKIM_PER_LUNAR_CYCLE * 235
const HEB_SDN_OFFSET = 347997
const NEW_MOON_OF_CREATION = 31524
const NOON = 18 * PARTS_PER_HOUR
const AM3_11_20 = 9 * PARTS_PER_HOUR + 204
const AM9_32_43 = 15 * PARTS_PER_HOUR + 589
const MONTHS_PER_HEBREW_YEAR = [12, 12, 13, 12, 12, 13, 12, 13, 12, 12, 13, 12, 12, 13, 12, 12, 13, 12, 13]

export const MIDA_COLORS = [
  '#5DBCD2', // 1 - Chesed
  '#A6230E', // 2 - Gevurah
  '#815AA8', // 3 - Tiferet
  '#84C45E', // 4 - Netzach
  '#BA8D1A', // 5 - Hod
  '#B45D02', // 6 - Yesod
  '#808080'  // 7 - Malchut
]

// Planet order and colors are the same map used by the local Mazal sources.
export const MAZAL_MAP = [
  { index: 0, key: 'saturn', name: 'שבתאי', english: 'Saturn', midaNumber: 4, midaName: 'נצח', color: '#84C45E' },
  { index: 1, key: 'jupiter', name: 'צדק', english: 'Jupiter', midaNumber: 1, midaName: 'חסד', color: '#5DBCD2' },
  { index: 2, key: 'mars', name: 'מאדים', english: 'Mars', midaNumber: 2, midaName: 'גבורה', color: '#A6230E' },
  { index: 3, key: 'sun', name: 'חמה', english: 'Sun', midaNumber: 3, midaName: 'תפארת', color: '#815AA8' },
  // Display-only highlight: slightly brighter than the canonical Hod/UMID color.
  { index: 4, key: 'venus', name: 'נוגה', english: 'Venus', midaNumber: 5, midaName: 'הוד', color: '#D2A526' },
  { index: 5, key: 'mercury', name: 'כוכב', english: 'Mercury', midaNumber: 6, midaName: 'יסוד', color: '#B45D02' },
  { index: 6, key: 'moon', name: 'לבנה', english: 'Moon', midaNumber: 7, midaName: 'מלכות', color: '#808080' }
]

function positiveModulo(value, modulo) {
  const result = value % modulo
  return result < 0 ? result + modulo : result
}

function pad(value, size) {
  let result = String(Math.trunc(Math.abs(Number(value) || 0)))
  while (result.length < size) result = `0${result}`
  return result
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function partsFromDate(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds()
  }
}

function civilOnly(value) {
  if (value instanceof Date) {
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() }
  }
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) }
}

function currentParts(value) {
  if (value instanceof Date) return partsFromDate(value)
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour) || 0,
    minute: Number(value.minute) || 0,
    second: Number(value.second) || 0,
    millisecond: Number(value.millisecond) || 0
  }
}

function defaultOffsetHours(date, supplied) {
  if (isFiniteNumber(supplied)) return supplied
  return date instanceof Date ? -date.getTimezoneOffset() / 60 : 3
}

function isGregorianLeapYear(year) {
  return year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)
}

function dayOfYear(date) {
  const value = civilOnly(date)
  const monthStarts = [13, 1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
  return monthStarts[value.month] + value.day + (value.month > 2 && isGregorianLeapYear(value.year) ? 1 : 0)
}

function daysFromCivil(year, month, day) {
  let adjustedYear = year
  if (month <= 2) adjustedYear -= 1
  const era = Math.floor(adjustedYear / 400)
  const yearOfEra = adjustedYear - era * 400
  const shiftedMonth = month + (month > 2 ? -3 : 9)
  const dayOfYearValue = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYearValue
  return era * 146097 + dayOfEra - 719468
}

function civilFromDays(value) {
  let z = value + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365)
  let year = yearOfEra + era * 400
  const dayOfYearValue = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const mp = Math.floor((5 * dayOfYearValue + 2) / 153)
  const day = dayOfYearValue - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp + (mp < 10 ? 3 : -9)
  if (month <= 2) year += 1
  return { year, month, day }
}

export function addCivilDays(date, days) {
  const value = civilOnly(date)
  return civilFromDays(daysFromCivil(value.year, value.month, value.day) + Number(days || 0))
}

function currentHourFloat(value) {
  const current = currentParts(value)
  return current.hour + current.minute / 60 + current.second / 3600 + current.millisecond / 3600000
}

// Same suntime() algorithm and constants as public/jclock/js/SunTime.js.
export function sunTimes(
  date,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  zenith = 90 + 50 / 60,
  offsetHours
) {
  const timezone = defaultOffsetHours(date, offsetHours)
  const yday = dayOfYear(date)
  const A = 1.5708
  const B = 3.14159
  const C = 4.71239
  const D = 6.28319
  const E = 0.0174533 * latitude
  const F = 0.0174533 * longitude
  const G = 0.261799 * timezone
  const R = Math.cos(0.01745 * zenith)
  let invalid = false

  function calculateEvent(isSunrise) {
    const J = isSunrise ? A : C
    const K = yday + (J - F) / D
    const L = K * 0.017202 - 0.0574039
    let M = L + 0.0334405 * Math.sin(L)
    M += 4.93289 + 3.49066e-4 * Math.sin(2 * L)

    while (M < 0) M += D
    while (M >= D) M -= D
    if (M / A - Math.floor(M / A) === 0) M += 4.84814e-6

    let P = Math.atan2(0.91746 * (Math.sin(M) / Math.cos(M)), 1)
    if (M > C) P += D
    else if (M > A) P += B

    let Q = 0.39782 * Math.sin(M)
    Q = Math.atan2(Q / Math.sqrt(-Q * Q + 1), 1)

    let S = (R - Math.sin(Q) * Math.sin(E)) / (Math.cos(Q) * Math.cos(E))
    if (Math.abs(S) > 1) invalid = true
    S = A - Math.atan2(S / Math.sqrt(-S * S + 1), 1)
    if (isSunrise) S = D - S

    let V = S + P - 0.0172028 * K - 1.73364 - F + G
    while (V < 0) V += D
    while (V >= D) V -= D
    return V * 3.81972
  }

  const rise = calculateEvent(true)
  const set = calculateEvent(false)
  return { rise, set, sunrise: rise, sunset: set, invalid }
}

export function calculateSourceClock(
  value,
  riseYesterday,
  riseToday,
  riseTomorrow,
  setYesterday,
  setToday,
  setTomorrow
) {
  const currentHour = currentHourFloat(value)
  let length = 1
  let currentOffset = 0
  let hourBase = 0
  let anchorDayOffset = 0
  let isNight = true

  // These are separate source branches on purpose; do not combine them.
  if (setToday > riseToday && currentHour < setToday) {
    length = setToday - riseToday
    currentOffset = currentHour - riseToday
    hourBase = 12
    isNight = false
  }
  if (setToday > riseToday && currentHour < riseToday) {
    length = riseToday + 24 - setYesterday
    currentOffset = currentHour + 24 - setYesterday
    hourBase = 0
    anchorDayOffset = 0
    isNight = true
  }
  if (setToday > riseToday && currentHour > setToday) {
    length = riseTomorrow + 24 - setToday
    currentOffset = currentHour - setToday
    hourBase = 0
    anchorDayOffset = 1
    isNight = true
  }
  if (setToday < riseToday && currentHour < riseToday) {
    length = riseToday - setToday
    currentOffset = currentHour - setToday
    hourBase = 0
    isNight = true
  }
  if (setToday < riseToday && currentHour < setToday) {
    length = setToday + 24 - riseYesterday
    currentOffset = currentHour + 24 - riseYesterday
    hourBase = 12
    anchorDayOffset = -1
    isNight = false
  }
  if (setToday < riseToday && currentHour > riseToday) {
    length = setTomorrow + 24 - riseToday
    currentOffset = currentHour - riseToday
    hourBase = 12
    isNight = false
  }

  const ratio = currentOffset / length
  const raw = 12 * ratio
  const displayedHour = Math.floor(raw)
  const part = Math.floor(12 * PARTS_PER_HOUR * ratio) - displayedHour * PARTS_PER_HOUR
  const moment = Math.floor(12 * SOURCE_UNITS_PER_HOUR * ratio) - displayedHour * SOURCE_UNITS_PER_HOUR - part * MOMENTS_PER_PART

  return {
    hour: hourBase + displayedHour,
    displayedHour,
    minute: part,
    part,
    second: moment,
    moment,
    currentHebrewAnchorDayOffset: anchorDayOffset,
    rise: riseToday,
    set: setToday,
    sourcePeriodLengthHours: length,
    sourceCurrentOffsetHours: currentOffset,
    risingPeriod: !isNight
  }
}

function jsDayOfWeek(date) {
  const value = civilOnly(date)
  return positiveModulo(daysFromCivil(value.year, value.month, value.day) + 4, 7) + 1
}

function normalizeHebrewDay(day) {
  return positiveModulo(Number(day) - 1, 7) + 1
}

function timePartsFromSourceFloat(value) {
  let time = value
  let hour = Math.floor(time)
  let minute = Math.floor((time - hour) * 60)
  let second = Math.floor((((time - hour) * 60) - minute) * 60)
  let millisecond = Math.floor((((((time - hour) * 60) - minute) * 60) - second) * 1000) % 1000
  if (millisecond >= 1000) {
    second += 1
    millisecond = Math.floor(millisecond / 1000)
  }
  if (second >= 60) {
    minute += 1
    second -= 60
  }
  if (minute >= 60) {
    hour += 1
    minute -= 60
  }
  if (hour < 0) hour += 24
  if (hour > 23) hour -= 24
  return { hour, minute, second, millisecond }
}

function isAfterSourceBoundary(value, boundary) {
  const current = currentParts(value)
  return (current.hour === boundary.hour && current.minute === boundary.minute && current.second >= boundary.second) ||
    (current.hour === boundary.hour && current.minute > boundary.minute) ||
    current.hour > boundary.hour
}

export function displayHebrewDayFromSource(value, setTime, applyAfterSet = true) {
  const current = currentParts(value)
  let day = jsDayOfWeek(current)
  if (applyAfterSet && isAfterSourceBoundary(current, timePartsFromSourceFloat(setTime))) day += 1
  return normalizeHebrewDay(day)
}

export function mazalIndexForSourceDayHour(hebrewDay, clockHour) {
  const hour = clockHour === 24 ? 0 : Number(clockHour)
  const starts = { 1: 5, 2: 1, 3: 4, 4: 0, 5: 3, 6: 6, 7: 2 }
  return positiveModulo((starts[hebrewDay] || 0) + hour, 7)
}

export function dayMazalIndexForHebrewDay(hebrewDay) {
  const indices = [1, 2, 3, 0, 4, 5, 6]
  return indices[normalizeHebrewDay(hebrewDay) - 1]
}

function applyMazalFields(time, displayHebrewDay, mazalDayOffset) {
  const hebrewDay = normalizeHebrewDay(displayHebrewDay + mazalDayOffset)
  const mazalIndex = mazalIndexForSourceDayHour(hebrewDay, time.hour)
  const dayMazalIndex = dayMazalIndexForHebrewDay(hebrewDay)
  const mazal = MAZAL_MAP[mazalIndex]
  const dayMazal = MAZAL_MAP[dayMazalIndex]
  return Object.assign(time, {
    displayHebrewDay,
    mazalDayOffset,
    hebrewDay,
    mazalIndex,
    mazal,
    mazalName: mazal.name,
    mazalNameEnglish: mazal.english,
    mazalMidaName: mazal.midaName,
    mazalColor: mazal.color,
    dayMazalIndex,
    dayMazal,
    dayMazalName: dayMazal.name,
    dayMazalNameEnglish: dayMazal.english,
    dayMazalMidaName: dayMazal.midaName,
    dayMazalColor: dayMazal.color
  })
}

export function calculateSunClock(
  date,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  offsetHours
) {
  const current = currentParts(date)
  const offset = defaultOffsetHours(date, offsetHours)
  const yesterday = addCivilDays(current, -1)
  const today = civilOnly(current)
  const tomorrow = addCivilDays(current, 1)
  const yesterdaySun = sunTimes(yesterday, latitude, longitude, 90 + 50 / 60, offset)
  const todaySun = sunTimes(today, latitude, longitude, 90 + 50 / 60, offset)
  const tomorrowSun = sunTimes(tomorrow, latitude, longitude, 90 + 50 / 60, offset)
  const time = calculateSourceClock(
    current,
    yesterdaySun.rise,
    todaySun.rise,
    tomorrowSun.rise,
    yesterdaySun.set,
    todaySun.set,
    tomorrowSun.set
  )
  return applyMazalFields(time, displayHebrewDayFromSource(current, todaySun.set, true), 0)
}

function julianFromLocalMidnight(date, offsetHours) {
  const value = civilOnly(date)
  return daysFromCivil(value.year, value.month, value.day) + J1970 - 0.5 - offsetHours / 24
}

function rightAscension(longitude, latitude) {
  const ecliptic = RAD * 23.4397
  return Math.atan2(Math.sin(longitude) * Math.cos(ecliptic) - Math.tan(latitude) * Math.sin(ecliptic), Math.cos(longitude))
}

function declination(longitude, latitude) {
  const ecliptic = RAD * 23.4397
  return Math.asin(Math.sin(latitude) * Math.cos(ecliptic) + Math.cos(latitude) * Math.sin(ecliptic) * Math.sin(longitude))
}

function moonAltitude(julian, latitude, longitude) {
  const lw = RAD * -longitude
  const phi = RAD * latitude
  const days = julian - J2000
  const meanLongitude = RAD * (218.316 + 13.176396 * days)
  const anomaly = RAD * (134.963 + 13.064993 * days)
  const distance = RAD * (93.272 + 13.229350 * days)
  const longitudeValue = meanLongitude + RAD * 6.289 * Math.sin(anomaly)
  const latitudeValue = RAD * 5.128 * Math.sin(distance)
  const ra = rightAscension(longitudeValue, latitudeValue)
  const dec = declination(longitudeValue, latitudeValue)
  const hourAngle = RAD * (280.16 + 360.9856235 * days) - lw - ra
  let altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(hourAngle))
  const refractedAltitude = altitude < 0 ? 0 : altitude
  altitude += 0.0002967 / Math.tan(refractedAltitude + 0.00312536 / (refractedAltitude + 0.08901179))
  return altitude
}

export function moonTimes(
  date,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  offsetHours
) {
  const offset = defaultOffsetHours(date, offsetHours)
  const start = julianFromLocalMidnight(date, offset)
  const hc = 0.133 * RAD
  let h0 = moonAltitude(start, latitude, longitude) - hc
  let rise
  let set
  let extremum = 0

  for (let i = 1; i <= 25; i += 2) {
    const h1 = moonAltitude(start + i / 24, latitude, longitude) - hc
    const h2 = moonAltitude(start + (i + 1) / 24, latitude, longitude) - hc
    const a = (h0 + h2) / 2 - h1
    const b = (h2 - h0) / 2
    if (Math.abs(a) < 1e-12) {
      h0 = h2
      continue
    }
    const xe = -b / (2 * a)
    extremum = (a * xe + b) * xe + h1
    const discriminant = b * b - 4 * a * h1
    let roots = 0
    let x1
    let x2

    if (discriminant >= 0) {
      const dx = Math.sqrt(discriminant) / (Math.abs(a) * 2)
      x1 = xe - dx
      x2 = xe + dx
      if (Math.abs(x1) <= 1) roots += 1
      if (Math.abs(x2) <= 1) roots += 1
      if (x1 < -1) x1 = x2
    }

    if (roots === 1) {
      if (h0 < 0) rise = i + x1
      else set = i + x1
    } else if (roots === 2) {
      rise = i + (extremum < 0 ? x2 : x1)
      set = i + (extremum < 0 ? x1 : x2)
    }

    if (rise !== undefined && set !== undefined) break
    h0 = h2
  }

  return {
    rise,
    set,
    moonrise: rise,
    moonset: set,
    hasRise: rise !== undefined,
    hasSet: set !== undefined,
    alwaysUp: rise === undefined && set === undefined && extremum > 0,
    alwaysDown: rise === undefined && set === undefined && extremum <= 0
  }
}

export function calculateMoonMazalDayOffset(moonTime, sunTime, moonDay, sourceManDay) {
  const dayDiffFromMan = positiveModulo(moonDay - sourceManDay, 7)
  const womanMoonTime = moonTime.hour * PARTS_PER_HOUR + moonTime.minute
  const manSunTime = sunTime.hour * PARTS_PER_HOUR + sunTime.minute
  if (dayDiffFromMan === 1) return -1
  if (dayDiffFromMan === 0 && womanMoonTime > manSunTime) return -1
  return 0
}

export function calculateMoonClock(
  date,
  sunTime,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  offsetHours
) {
  const current = currentParts(date)
  const offset = defaultOffsetHours(date, offsetHours)
  const yesterday = addCivilDays(current, -1)
  const today = civilOnly(current)
  const tomorrow = addCivilDays(current, 1)
  const yesterdayMoon = moonTimes(yesterday, latitude, longitude, offset)
  const todayMoon = moonTimes(today, latitude, longitude, offset)
  const tomorrowMoon = moonTimes(tomorrow, latitude, longitude, offset)

  if (!yesterdayMoon.hasRise || !yesterdayMoon.hasSet ||
      !todayMoon.hasRise || !todayMoon.hasSet ||
      !tomorrowMoon.hasRise || !tomorrowMoon.hasSet) {
    return { valid: false, time: null, times: todayMoon }
  }

  const time = calculateSourceClock(
    current,
    yesterdayMoon.rise,
    todayMoon.rise,
    tomorrowMoon.rise,
    yesterdayMoon.set,
    todayMoon.set,
    tomorrowMoon.set
  )
  const moonDisplayDay = displayHebrewDayFromSource(current, todayMoon.set, true)
  const sourceManDay = displayHebrewDayFromSource(current, sunTime.set, false)
  const mazalDayOffset = calculateMoonMazalDayOffset(time, sunTime, moonDisplayDay, sourceManDay)
  applyMazalFields(time, moonDisplayDay, mazalDayOffset)
  return { valid: true, time, times: todayMoon }
}

export function normalizeHebrewTime(value) {
  if (typeof value === 'string') {
    const fields = value.split(':')
    if (fields.length !== 3 || fields[0] === '--') return null
    value = { hour: Number(fields[0]), minute: Number(fields[1]), second: Number(fields[2]) }
  }
  if (!value || !Number.isFinite(Number(value.hour)) || !Number.isFinite(Number(value.minute)) || !Number.isFinite(Number(value.second))) return null
  let total = Math.trunc(Number(value.hour)) * SOURCE_UNITS_PER_HOUR
  total += Math.trunc(Number(value.minute)) * MOMENTS_PER_PART
  total += Math.trunc(Number(value.second))
  total = positiveModulo(total, SOURCE_UNITS_PER_DAY)
  const hour = Math.floor(total / SOURCE_UNITS_PER_HOUR)
  total -= hour * SOURCE_UNITS_PER_HOUR
  const minute = Math.floor(total / MOMENTS_PER_PART)
  const second = total - minute * MOMENTS_PER_PART
  return { hour, minute, part: minute, second, moment: second, day: value.day }
}

export function formatHebrewTime(value) {
  const normalized = normalizeHebrewTime(value)
  if (!normalized) return '--:----:--'
  return `${pad(normalized.hour, 2)}:${pad(normalized.minute, 4)}:${pad(normalized.second, 2)}`
}

export function solarClock(date, latitude = JERUSALEM_LATITUDE, longitude = JERUSALEM_LONGITUDE, offsetHours) {
  return formatHebrewTime(calculateSunClock(date, latitude, longitude, offsetHours))
}

export function lunarClock(date, latitude = JERUSALEM_LATITUDE, longitude = JERUSALEM_LONGITUDE, offsetHours) {
  const sun = calculateSunClock(date, latitude, longitude, offsetHours)
  const moon = calculateMoonClock(date, sun, latitude, longitude, offsetHours)
  return moon.valid ? formatHebrewTime(moon.time) : '--:----:--'
}

function gregorianToSdn(year, month, day) {
  let adjustedYear = year < 0 ? year + 4801 : year + 4800
  let adjustedMonth
  if (month > 2) adjustedMonth = month - 3
  else {
    adjustedMonth = month + 9
    adjustedYear -= 1
  }
  let sdn = Math.floor(Math.floor(adjustedYear / 100) * DAYS_PER_400_YEARS / 4)
  sdn += Math.floor((adjustedYear % 100) * DAYS_PER_4_YEARS / 4)
  sdn += Math.floor((adjustedMonth * DAYS_PER_5_MONTHS + 2) / 5)
  return sdn + day - GREG_SDN_OFFSET
}

function monthsPerHebrewYear(metonicYear) {
  return MONTHS_PER_HEBREW_YEAR[positiveModulo(metonicYear, 19)]
}

function hebrewMonthName(month, metonicYear) {
  const names = ['tishri', 'heshvan', 'kislev', 'tevet', 'shevat', 'adar', 'adar_ii', 'nisan', 'iyyar', 'sivan', 'tammuz', 'av', 'elul']
  if (month === 6 && monthsPerHebrewYear(metonicYear) === 13) return 'adar_i'
  return names[month - 1] || 'tishri'
}

function moladOfMetonicCycle(metonicCycle) {
  const total = NEW_MOON_OF_CREATION + metonicCycle * HALAKIM_PER_METONIC_CYCLE
  return {
    moladDay: Math.floor(total / HALAKIM_PER_DAY),
    moladHalakim: positiveModulo(total, HALAKIM_PER_DAY)
  }
}

function findTishriMolad(inputDay) {
  let metonicCycle = Math.floor((inputDay + 310) / 6940)
  let molad = moladOfMetonicCycle(metonicCycle)
  let moladDay = molad.moladDay
  let moladHalakim = molad.moladHalakim

  while (moladDay < inputDay - 6940 + 310) {
    metonicCycle += 1
    moladHalakim += HALAKIM_PER_METONIC_CYCLE
    moladDay += Math.floor(moladHalakim / HALAKIM_PER_DAY)
    moladHalakim = positiveModulo(moladHalakim, HALAKIM_PER_DAY)
  }

  let metonicYear = 0
  for (; metonicYear < 18; metonicYear += 1) {
    if (moladDay > inputDay - 74) break
    moladHalakim += HALAKIM_PER_LUNAR_CYCLE * monthsPerHebrewYear(metonicYear)
    moladDay += Math.floor(moladHalakim / HALAKIM_PER_DAY)
    moladHalakim = positiveModulo(moladHalakim, HALAKIM_PER_DAY)
  }
  return { metonicCycle, metonicYear, moladDay, moladHalakim }
}

function tishri1(metonicYear, moladDay, moladHalakim) {
  let tishriDay = Math.trunc(moladDay)
  let dow = positiveModulo(tishriDay, 7)
  const leap = [2, 5, 7, 10, 13, 16, 18].indexOf(metonicYear) >= 0
  const lastWasLeap = [3, 6, 8, 11, 14, 17, 0].indexOf(metonicYear) >= 0
  if (moladHalakim >= NOON ||
      (!leap && dow === 2 && moladHalakim >= AM3_11_20) ||
      (lastWasLeap && dow === 1 && moladHalakim >= AM9_32_43)) {
    tishriDay += 1
    dow = positiveModulo(dow + 1, 7)
  }
  if (dow === 3 || dow === 5 || dow === 0) tishriDay += 1
  return tishriDay
}

export function hebrewDateFromCivil(date) {
  const civil = civilOnly(date)
  const inputDay = gregorianToSdn(civil.year, civil.month, civil.day) - HEB_SDN_OFFSET
  let found = findTishriMolad(inputDay)
  let metonicCycle = found.metonicCycle
  let metonicYear = found.metonicYear
  let moladDay = found.moladDay
  let moladHalakim = found.moladHalakim
  let tishri = tishri1(metonicYear, moladDay, moladHalakim)
  let hebrewYear = 0
  let hebrewMonth = 0
  let hebrewDay = 0

  if (inputDay >= tishri) {
    hebrewYear = metonicCycle * 19 + metonicYear + 1
    if (inputDay < tishri + 59) {
      if (inputDay < tishri + 30) {
        hebrewMonth = 1
        hebrewDay = inputDay - tishri + 1
      } else {
        hebrewMonth = 2
        hebrewDay = inputDay - tishri - 29
      }
    } else {
      moladHalakim += HALAKIM_PER_LUNAR_CYCLE * monthsPerHebrewYear(metonicYear)
      moladDay += Math.floor(moladHalakim / HALAKIM_PER_DAY)
      moladHalakim = positiveModulo(moladHalakim, HALAKIM_PER_DAY)
      const tishriAfter = tishri1(positiveModulo(metonicYear + 1, 19), moladDay, moladHalakim)
      const yearLength = tishriAfter - tishri
      let monthDay = inputDay - tishri - 29
      if (yearLength === 355 || yearLength === 385) {
        if (monthDay <= 30) {
          hebrewMonth = 2
          hebrewDay = monthDay
        } else {
          monthDay -= 30
          hebrewMonth = 3
          hebrewDay = monthDay
        }
      } else if (monthDay <= 29) {
        hebrewMonth = 2
        hebrewDay = monthDay
      } else {
        monthDay -= 29
        hebrewMonth = 3
        hebrewDay = monthDay
      }
    }
  } else {
    hebrewYear = metonicCycle * 19 + metonicYear
    if (inputDay >= tishri - 177) {
      if (inputDay > tishri - 30) {
        hebrewMonth = 13
        hebrewDay = inputDay - tishri + 30
      } else if (inputDay > tishri - 60) {
        hebrewMonth = 12
        hebrewDay = inputDay - tishri + 60
      } else if (inputDay > tishri - 89) {
        hebrewMonth = 11
        hebrewDay = inputDay - tishri + 89
      } else if (inputDay > tishri - 119) {
        hebrewMonth = 10
        hebrewDay = inputDay - tishri + 119
      } else if (inputDay > tishri - 148) {
        hebrewMonth = 9
        hebrewDay = inputDay - tishri + 148
      } else {
        hebrewMonth = 8
        hebrewDay = inputDay - tishri + 178
      }
    } else {
      if (monthsPerHebrewYear(positiveModulo(hebrewYear - 1, 19)) === 13) {
        hebrewMonth = 7
        hebrewDay = inputDay - tishri + 207
        if (hebrewDay <= 0) {
          hebrewMonth -= 1
          hebrewDay += 30
        }
        if (hebrewDay <= 0) {
          hebrewMonth -= 1
          hebrewDay += 30
        }
      } else {
        hebrewMonth = 6
        hebrewDay = inputDay - tishri + 207
        if (hebrewDay <= 0) {
          hebrewMonth -= 1
          hebrewDay += 30
        }
      }
      if (hebrewDay <= 0) {
        hebrewMonth -= 1
        hebrewDay += 29
      }
      if (hebrewDay <= 0) {
        const tishriAfter = tishri
        found = findTishriMolad(moladDay - 365)
        metonicCycle = found.metonicCycle
        metonicYear = found.metonicYear
        moladDay = found.moladDay
        moladHalakim = found.moladHalakim
        tishri = tishri1(metonicYear, moladDay, moladHalakim)
        const yearLength = tishriAfter - tishri
        let monthDay = inputDay - tishri - 29
        if (yearLength === 355 || yearLength === 385) {
          if (monthDay <= 30) {
            hebrewMonth = 2
            hebrewDay = monthDay
          } else {
            monthDay -= 30
            hebrewMonth = 3
            hebrewDay = monthDay
          }
        } else if (monthDay <= 29) {
          hebrewMonth = 2
          hebrewDay = monthDay
        } else {
          monthDay -= 29
          hebrewMonth = 3
          hebrewDay = monthDay
        }
      }
    }
  }

  const finalMetonicYear = positiveModulo(hebrewYear - 1, 19)
  return {
    year: hebrewYear,
    month: hebrewMonth,
    day: hebrewDay,
    date: hebrewDay,
    metonicYear: finalMetonicYear,
    monthName: hebrewMonthName(hebrewMonth, finalMetonicYear),
    month_name: hebrewMonthName(hebrewMonth, finalMetonicYear)
  }
}

export function nisanBasedHebrewMonth(sourceMonth) {
  if (sourceMonth >= 8 && sourceMonth <= 13) return sourceMonth - 7
  if (sourceMonth >= 1 && sourceMonth <= 7) return sourceMonth + 6
  return sourceMonth
}

export function isHebrewLeapYear(hebrewYear) {
  return positiveModulo(7 * Number(hebrewYear) + 1, 19) < 7
}

function monthsBeforeTishrei(hebrewYear) {
  const completedYears = Number(hebrewYear) - 1
  const cycles = Math.floor(completedYears / 19)
  const yearInCycle = positiveModulo(completedYears, 19)
  return 235 * cycles + 12 * yearInCycle + Math.floor((7 * yearInCycle + 1) / 19)
}

function tishriDayForYear(hebrewYear) {
  const totalHalakim = NEW_MOON_OF_CREATION + monthsBeforeTishrei(hebrewYear) * HALAKIM_PER_LUNAR_CYCLE
  const moladDay = Math.floor(totalHalakim / HALAKIM_PER_DAY)
  const moladHalakim = positiveModulo(totalHalakim, HALAKIM_PER_DAY)
  return tishri1(positiveModulo(Number(hebrewYear) - 1, 19), moladDay, moladHalakim)
}

export function hebrewYearLength(hebrewYear) {
  return tishriDayForYear(Number(hebrewYear) + 1) - tishriDayForYear(Number(hebrewYear))
}

export function hebrewMonthLength(hebrewYear, sourceMonth) {
  const metonicYear = positiveModulo(Number(hebrewYear) - 1, 19)
  const leap = [2, 5, 7, 10, 13, 16, 18].indexOf(metonicYear) >= 0
  const yearLength = hebrewYearLength(hebrewYear)
  const month = Number(sourceMonth)
  if (month === 2) return yearLength === 355 || yearLength === 385 ? 30 : 29
  if (month === 3) return yearLength === 353 || yearLength === 383 ? 29 : 30
  if (month === 6) return leap ? 30 : 29
  const lengths = { 1: 30, 4: 29, 5: 30, 7: 29, 8: 30, 9: 29, 10: 30, 11: 29, 12: 30, 13: 29 }
  return lengths[month] || 30
}

export function calculateHebrewDisplayDate(
  date,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  offsetHours
) {
  const current = currentParts(date)
  const offset = defaultOffsetHours(date, offsetHours)
  const tzeitTimes = sunTimes(current, latitude, longitude, 96, offset)
  const afterTzeit = currentHourFloat(current) > tzeitTimes.set
  const sourceCivilDate = afterTzeit ? addCivilDays(current, 1) : civilOnly(current)
  const sourceDate = hebrewDateFromCivil(sourceCivilDate)
  const displayYear = sourceDate.year - 3760
  const result = {
    day: sourceDate.day,
    month: nisanBasedHebrewMonth(sourceDate.month),
    year: displayYear,
    displayYear,
    hebrewYear: sourceDate.year,
    sourceYear: sourceDate.year,
    sourceMonth: sourceDate.month,
    sourceDate,
    civilDate: sourceCivilDate,
    weekday: jsDayOfWeek(sourceCivilDate),
    monthLength: hebrewMonthLength(sourceDate.year, sourceDate.month),
    tzeit: tzeitTimes.set,
    afterTzeit
  }
  result.formatted = `${pad(result.day, 2)}-${pad(result.month, 2)}-${pad(result.displayYear, 4)}`
  return result
}

export function moonPhaseForHebrewDate(day, monthLength) {
  const safeLength = Math.max(29, Number(monthLength) || 30)
  const clampedDay = Math.max(1, Math.min(Number(day) || 1, safeLength))
  const phase = positiveModulo((clampedDay - 1) / Math.max(1, safeLength - 1), 1)
  const illumination = 0.5 - 0.5 * Math.cos(phase * PI * 2)
  return {
    phase,
    illumination,
    percent: Math.round(illumination * 100),
    waxing: phase <= 0.5,
    waning: phase > 0.5
  }
}

export function sourceTimeProgress(value) {
  const normalized = normalizeHebrewTime(value)
  if (!normalized) return 0
  const fractionalHour = normalized.hour + (normalized.minute + normalized.second / MOMENTS_PER_PART) / PARTS_PER_HOUR
  return positiveModulo((fractionalHour - 12) / 24, 1)
}

export function orbitPoint(value, centerX = 0, centerY = 0, radius = 1) {
  const progress = sourceTimeProgress(value)
  const angle = -progress * PI * 2
  return {
    progress,
    angle,
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius
  }
}

function canonicalMoladMonthKey(monthKey) {
  const key = String(monthKey || '').trim().toLowerCase().replace(/[\s_]/g, '')
  const aliases = {
    tishrei: 'tishri',
    cheshvan: 'heshvan',
    adar1: 'adari',
    adari: 'adari',
    adar2: 'adarii',
    adarii: 'adarii',
    nissan: 'nisan',
    iyar: 'iyyar',
    iyyar: 'iyyar',
    tamuz: 'tammuz'
  }
  return aliases[key] || key
}

function hebrewMonthKeysForYear(hebrewYear) {
  return isHebrewLeapYear(hebrewYear)
    ? ['tishri', 'heshvan', 'kislev', 'tevet', 'shevat', 'adari', 'adarii', 'nisan', 'iyyar', 'sivan', 'tammuz', 'av', 'elul']
    : ['tishri', 'heshvan', 'kislev', 'tevet', 'shevat', 'adar', 'nisan', 'iyyar', 'sivan', 'tammuz', 'av', 'elul']
}

function getMonthOffsetFromTishrei(hebrewYear, monthKey) {
  const months = hebrewMonthKeysForYear(hebrewYear)
  const index = months.indexOf(canonicalMoladMonthKey(monthKey))
  return index >= 0 ? index : 0
}

function buildMoladMonth(hebrewYear, monthKey) {
  const canonical = canonicalMoladMonthKey(monthKey)
  return { year: Number(hebrewYear), monthKey: canonical, month: getMonthOffsetFromTishrei(hebrewYear, canonical) + 1 }
}

function getYovelStartYear(hebrewYear) {
  return Number(hebrewYear) - positiveModulo(Number(hebrewYear) - 1, 49)
}

function getLastNisanYear(hebrew) {
  const monthName = hebrew.monthName || hebrew.month_name
  const nisanOffset = getMonthOffsetFromTishrei(hebrew.year, 'nisan')
  const currentOffset = getMonthOffsetFromTishrei(hebrew.year, monthName)
  return currentOffset >= nisanOffset ? Number(hebrew.year) : Number(hebrew.year) - 1
}

function currentMoladPeriodKey(value) {
  const normalized = normalizeHebrewTime(value)
  if (!normalized) return 'yovel'
  const hourValue = positiveModulo(normalized.hour + (normalized.minute + normalized.second / MOMENTS_PER_PART) / PARTS_PER_HOUR, 24)
  if (hourValue >= 12 && hourValue < 18) return 'month'
  if (hourValue >= 18) return 'year'
  return hourValue < 6 ? 'yovel' : 'nisan'
}

function moladMonthForPeriod(hebrew, periodKey) {
  const monthName = hebrew.monthName || hebrew.month_name
  if (periodKey === 'month') return buildMoladMonth(hebrew.year, monthName)
  if (periodKey === 'year') return buildMoladMonth(hebrew.year, 'tishri')
  if (periodKey === 'yovel') return buildMoladMonth(getYovelStartYear(hebrew.year), 'tishri')
  if (periodKey === 'nisan') return buildMoladMonth(getLastNisanYear(hebrew), 'nisan')
  return buildMoladMonth(hebrew.year, monthName)
}

function buildMoladInfoForMonth(moladMonth) {
  const monthOffset = getMonthOffsetFromTishrei(moladMonth.year, moladMonth.monthKey)
  const monthsElapsed = monthsBeforeTishrei(moladMonth.year) + monthOffset
  const totalHalakim = NEW_MOON_OF_CREATION + monthsElapsed * HALAKIM_PER_LUNAR_CYCLE
  const absoluteDay = Math.floor(totalHalakim / HALAKIM_PER_DAY)
  const halakimOfDay = positiveModulo(totalHalakim, HALAKIM_PER_DAY)
  return {
    jewishDay: positiveModulo(absoluteDay, 7) + 1,
    jewishHour: Math.floor(halakimOfDay / PARTS_PER_HOUR),
    parts: positiveModulo(halakimOfDay, PARTS_PER_HOUR),
    absoluteDay
  }
}

function commercialHourMidaNumber(hebrewDay, hebrewHour) {
  const offsets = { 1: 6, 2: 2, 3: 5, 4: 1, 5: 4, 6: 7, 7: 3 }
  let index = positiveModulo((offsets[hebrewDay] || 6) + Number(hebrewHour), 7)
  if (index === 0) index = 7
  const result = { 1: 4, 2: 1, 3: 2, 4: 3, 5: 5, 6: 6, 7: 7 }
  return result[index] || 1
}

function midaForNumber(number) {
  return MIDA_COLORS[Number(number) - 1] || MIDA_COLORS[0]
}

export function moladColorsForSourceTime(sourceTime, hebrew) {
  const periodKey = currentMoladPeriodKey(sourceTime)
  const moladMonth = moladMonthForPeriod(hebrew, periodKey)
  const molad = buildMoladInfoForMonth(moladMonth)
  const foregroundMida = commercialHourMidaNumber(molad.jewishDay, molad.jewishHour)
  return {
    periodKey,
    moladMonth,
    molad,
    foregroundMida,
    backgroundMida: molad.jewishDay,
    foreground: midaForNumber(foregroundMida),
    background: midaForNumber(molad.jewishDay)
  }
}

// The website intentionally colors both side buttons from a Jerusalem snapshot:
// the Local button uses Jerusalem SUN molad colors and Jerusalem uses MOON colors.
export function moladButtonColors(date, offsetHours) {
  const offset = defaultOffsetHours(date, offsetHours)
  const sun = calculateSunClock(date, JERUSALEM_LATITUDE, JERUSALEM_LONGITUDE, offset)
  const moonClock = calculateMoonClock(date, sun, JERUSALEM_LATITUDE, JERUSALEM_LONGITUDE, offset)
  const hebrew = hebrewDateFromCivil(civilOnly(date)) // no tzeit rollover for colors
  const sunColors = moladColorsForSourceTime(sun, hebrew)
  const moonColors = moonClock.valid ? moladColorsForSourceTime(moonClock.time, hebrew) : sunColors
  return {
    sun: sunColors,
    moon: moonColors,
    currentLocation: sunColors,
    jerusalem: moonColors
  }
}

export function jclockSnapshot(
  date,
  latitude = JERUSALEM_LATITUDE,
  longitude = JERUSALEM_LONGITUDE,
  offsetHours
) {
  const offset = defaultOffsetHours(date, offsetHours)
  const sun = calculateSunClock(date, latitude, longitude, offset)
  const moonClock = calculateMoonClock(date, sun, latitude, longitude, offset)
  const hebrewDate = calculateHebrewDisplayDate(date, latitude, longitude, offset)
  const moonPhase = moonPhaseForHebrewDate(hebrewDate.day, hebrewDate.monthLength)
  const moon = moonClock.valid ? moonClock.time : null
  const sunText = formatHebrewTime(sun)
  const moonText = formatHebrewTime(moon)
  const sunOrbit = orbitPoint(sun)
  const moonOrbit = orbitPoint(moon)
  const moladColors = moladButtonColors(date, offset)

  // Nested aliases make the high-level snapshot convenient for the Zepp page,
  // while the raw source-clock fields remain available on the same objects.
  sun.value = sunText
  sun.formatted = sunText
  sun.orbit = sunOrbit
  if (moon) {
    moon.value = moonText
    moon.formatted = moonText
    moon.orbit = moonOrbit
    moon.illumination = moonPhase.illumination
    moon.illuminationPercent = moonPhase.percent
    moon.waxing = moonPhase.waxing
    moon.waning = moonPhase.waning
  }
  return {
    date,
    offsetHours: offset,
    sun,
    moon,
    sunText,
    moonText,
    hebrew: hebrewDate,
    hebrewDate,
    hebrewDateText: hebrewDate.formatted,
    moonPhase,
    illumination: moonPhase,
    orbit: { sun: sunOrbit, moon: moonOrbit },
    sunOrbit,
    moonOrbit,
    molad: { sun: moladColors.sun, moon: moladColors.moon },
    moladColors
  }
}

export function civilTime(date) {
  return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}`
}

export function civilDate(date) {
  return `${pad(date.getDate(), 2)}-${pad(date.getMonth() + 1, 2)}-${date.getFullYear()}`
}
