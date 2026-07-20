const fs = require('fs')
const path = require('path')

const sourcePath = path.join(__dirname, '..', 'utils', 'jclock.js')
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\bexport\s+/g, '')
const api = new Function(`${source}\nreturn {\n  calculateSourceClock,\n  formatHebrewTime,\n  calculateSunClock,\n  calculateMoonClock,\n  moonTimes,\n  garminSunClockColors,\n  israelUtcOffsetHours\n}`)()

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`)
  }
}

// MenuTestView.display_time(), lines 2652-2665: lbHour is displayed modulo 12.
assertEqual(
  api.formatHebrewTime({ hour: 17, minute: 933, second: 35 }),
  '05:0933:35',
  'Garmin display hour'
)
assertEqual(
  api.formatHebrewTime({ hour: 14, minute: 588, second: 7 }),
  '02:0588:07',
  'Garmin moon display hour'
)

// MenuTestView.getIsraelTimeZone(), lines 1801-1847.
assertEqual(api.israelUtcOffsetHours(Date.UTC(2026, 0, 15)), 2, 'Israel winter offset')
assertEqual(api.israelUtcOffsetHours(Date.UTC(2026, 6, 18)), 3, 'Israel summer offset')

const date = { year: 2026, month: 7, day: 18, hour: 12, minute: 35, second: 0 }
const sun = api.calculateSunClock(date, 31.776852, 35.233166, 3)
const moon = api.calculateMoonClock(date, sun, 31.776852, 35.233166, 3)

if (!moon.valid) throw new Error('Garmin moon clock did not produce rise/set values')
if (!sun.garminColors || !sun.garminColors.thresholds) throw new Error('Garmin color thresholds are missing')

for (let day = 1; day <= 31; day += 1) {
  const times = api.moonTimes({ year: 2026, month: 7, day }, 31.776852, 35.233166, 3)
  if (times.hasRise && (times.rise < 0 || times.rise >= 24)) throw new Error(`Moonrise was not Garmin-wrapped on July ${day}`)
  if (times.hasSet && (times.set < 0 || times.set >= 24)) throw new Error(`Moonset was not Garmin-wrapped on July ${day}`)
}

process.stdout.write(JSON.stringify({
  date,
  sunInternalHour: sun.hour,
  sunDisplay: api.formatHebrewTime(sun),
  moonInternalHour: moon.time.hour,
  moonDisplay: api.formatHebrewTime(moon.time),
  israelOffset: api.israelUtcOffsetHours(Date.UTC(2026, 6, 18))
}, null, 2) + '\n')
