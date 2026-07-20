import { jclockSnapshot, israelUtcOffsetHours } from '../utils/jclock'
import { requestPhoneLocation, sendSnapshot, sendMusicToggle, testPhoneConnection, SUN_TITLE, MOON_TITLE } from '../utils/bridge'
import { createWidget, widget, align, prop, event } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { setPageBrightTime, resetPageBrightTime } from '@zos/display'

const LATITUDE = 31.776852
const LONGITUDE = 35.233166
const DOUBLE_TAP_MS = 430
const LOCATION_POLL_MS = 6000

const BLACK = 0x000000
const PANEL = 0x121416
const BORDER = 0x3a4148
const ORBIT_BORDER = 0x59636d
const TEXT = 0xd4d8dc
const MUTED = 0xaaaaaa
const GOLD = 0xf2ca45
const GOLD_DARK = 0x5a4812
const SUN = 0xffd342
const GARMIN_MIDA_COLORS = [0x0000ff, 0xff0000, 0x800080, 0x00ff00, 0xffff00, 0xffa500, 0xaaaaaa]

const WEEKDAYS = ['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function pad(value, size) {
  let result = String(Math.trunc(Math.abs(Number(value) || 0)))
  while (result.length < size) result = `0${result}`
  return result
}

function colorNumber(value, fallback) {
  if (typeof value === 'number') return value
  const normalized = String(value || '').replace('#', '')
  const parsed = parseInt(normalized, 16)
  return Number.isFinite(parsed) ? parsed : fallback
}

function garminMidaColor(number) {
  return GARMIN_MIDA_COLORS[Math.max(1, Math.min(7, Number(number) || 7)) - 1]
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value))
}

function zonedParts(epoch, utcOffsetMinutes) {
  const offset = Number.isFinite(Number(utcOffsetMinutes)) ? Number(utcOffsetMinutes) : 0
  const shifted = new Date(Number(epoch) + offset * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds()
  }
}

function deviceLocalParts(epoch) {
  const date = new Date(Number(epoch))
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

function civilTimeFromParts(parts) {
  return `${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`
}

function normalizedLocation(value) {
  const latitude = Number(value && value.latitude)
  const longitude = Number(value && value.longitude)
  const utcOffsetMinutes = Number(value && value.utcOffsetMinutes)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
  if (!Number.isFinite(utcOffsetMinutes) || utcOffsetMinutes < -14 * 60 || utcOffsetMinutes > 14 * 60) return null
  return {
    latitude,
    longitude,
    utcOffsetMinutes,
    accuracy: Number(value && value.accuracy),
    timeZone: String((value && value.timeZone) || ''),
    mobileLocationEnabled: Boolean(value && value.mobileLocationEnabled),
    updated: !value || value.updated !== false
    ,keepScreenOn: Boolean(value && value.keepScreenOn)
  }
}

function moonAsset(snapshot) {
  const monthLength = snapshot.hebrew.monthLength === 29 ? 29 : 30
  const day = clamp(snapshot.hebrew.day, 1, monthLength)
  return `moon/moon_${monthLength}_${pad(day, 2)}.png`
}

function sourcePosition(source, center, radius) {
  const orbit = source && source.orbit ? source.orbit : { x: 0, y: -1 }
  return {
    x: Math.round(center + orbit.x * radius),
    y: Math.round(center + orbit.y * radius)
  }
}

Page({
  build() {
    const { width, height } = getDeviceInfo()
    const scale = Math.min(width, height) / 454
    const px = value => Math.round(value * scale)

    this.width = width
    this.height = height
    this.px = px
    this.snapshot = null
    this.firstTapAt = 0
    this.pausedEpoch = 0
    this.tapTimer = null
    this.statusTimer = null
    this.locationPollTimer = null
    this.displayPreferenceTimer = null
    this.locationRequestInFlight = false
    this.locationGeneration = 0
    this.desiredLocationMode = 'jerusalem'
    this.locationMode = 'jerusalem'
    this.latitude = LATITUDE
    this.longitude = LONGITUDE
    this.timeZone = 'Asia/Jerusalem'
    this.utcOffsetMinutes = israelUtcOffsetHours(Date.now()) * 60
    this.mobileLocationEnabled = false
    this.sourceSwitchStartedAt = Date.now()

    const text = (x, y, w, h, size, value, color = MUTED) => createWidget(widget.TEXT, {
      x, y, w, h, text: value, text_size: size, color,
      align_h: align.CENTER_H, align_v: align.CENTER_V
    })

    this.background = createWidget(widget.FILL_RECT, { x: 0, y: 0, w: width, h: height, color: BLACK })

    // Large round-screen layout: each row nearly fills the safe circular width.
    const rowHeight = px(74)
    const rowY = percent => Math.round(height * percent - rowHeight / 2)
    const dateCellW = Math.round(width * 0.24)
    const dateCell = center => Math.round(width * center - dateCellW / 2)
    this.gregorianDay = text(dateCell(0.35), rowY(0.12), dateCellW, rowHeight, px(50), '--')
    this.gregorianSeparator = text(dateCell(0.50), rowY(0.12), dateCellW, rowHeight, px(50), '/')
    this.gregorianMonth = text(dateCell(0.65), rowY(0.12), dateCellW, rowHeight, px(50), '--')
    this.civil = text(px(24), rowY(0.29), width - px(48), rowHeight, px(58), '--:--:--')
    this.centerDivider = createWidget(widget.FILL_RECT, {
      x: 0, y: Math.round(height / 2), w: width, h: Math.max(2, px(2)), color: 0xffffff
    })
    this.mazalLabel = text(px(18), rowY(0.60), width - px(36), rowHeight, px(48), '--')

    const clockY = rowY(0.78)
    const clockSize = px(52)
    this.sunHour = text(Math.round(width * 0.15), clockY, Math.round(width * 0.22), rowHeight, clockSize, '--')
    this.sunSeparator1 = text(Math.round(width * 0.32), clockY, Math.round(width * 0.08), rowHeight, clockSize, ':')
    this.sunMinute = text(Math.round(width * 0.36), clockY, Math.round(width * 0.28), rowHeight, clockSize, '----')
    this.sunSeparator2 = text(Math.round(width * 0.62), clockY, Math.round(width * 0.08), rowHeight, clockSize, ':')
    this.sunSecond = text(Math.round(width * 0.67), clockY, Math.round(width * 0.18), rowHeight, clockSize, '--')

    // Preserve the existing single/double-tap behavior without adding visible chrome.
    const tapTargets = [
      this.background,
      this.gregorianDay,
      this.gregorianSeparator,
      this.gregorianMonth,
      this.civil,
      this.centerDivider,
      this.mazalLabel,
      this.sunHour,
      this.sunSeparator1,
      this.sunMinute,
      this.sunSeparator2,
      this.sunSecond
    ]
    tapTargets.forEach(target => target.addEventListener(event.CLICK_UP, () => this.onClockTap()))

    this.safeRefresh()
    this.timer = setInterval(() => this.safeRefresh(), 1000)
    this.refreshJerusalemContext()
    this.displayPreferenceTimer = setInterval(() => this.refreshJerusalemContext(), LOCATION_POLL_MS)
  },

  setStatus(value, color = MUTED, clearAfter = 0) {
    if (!this.status && this.mazalLabel) {
      this.mazalLabel.setProperty(prop.MORE, { text: value, color })
      if (this.statusTimer) clearTimeout(this.statusTimer)
      if (clearAfter) {
        this.statusTimer = setTimeout(() => {
          this.statusTimer = null
          this.safeRefresh()
        }, clearAfter)
      }
      return
    }
    if (!this.status) return
    this.status.setProperty(prop.MORE, {
      x: this.px(25),
      y: this.px(146),
      w: this.px(168),
      h: this.px(25),
      text: value,
      text_size: this.px(13),
      color,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })
    if (this.statusTimer) clearTimeout(this.statusTimer)
    if (clearAfter) {
      this.statusTimer = setTimeout(() => {
        this.statusTimer = null
        this.setStatus('נגיעה: נגן · כפולה: שליחה')
      }, clearAfter)
    }
  },

  onClockTap() {
    const now = Date.now()
    if (this.tapTimer && now - this.firstTapAt <= DOUBLE_TAP_MS) {
      clearTimeout(this.tapTimer)
      this.tapTimer = null
      const selectedEpoch = this.pausedEpoch || this.firstTapAt
      this.firstTapAt = 0
      this.sendStoppedTime(selectedEpoch)
      this.safeRefresh()
      return
    }

    if (this.pausedEpoch) {
      this.pausedEpoch = 0
      this.firstTapAt = 0
      this.safeRefresh()
      return
    }

    this.firstTapAt = now
    this.pausedEpoch = now
    this.safeRefresh()
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null
      this.firstTapAt = 0
    }, DOUBLE_TAP_MS)
  },

  togglePhoneMusic() {
    this.setStatus('♫ שולח לנגן…', GOLD)
    sendMusicToggle(({ state }) => {
      if (state === 'sent') this.setStatus('♫ הנגן קיבל', GOLD, 2200)
      else if (state === 'queued') this.setStatus('♫ ממתין לטלפון', GOLD, 3000)
      else if (state === 'error') this.setStatus('אין חיבור לטלפון', 0xe05858, 3000)
    }).catch(() => {})
  },

  checkConnection() {
    this.setStatus('בודק חיבור…', GOLD)
    testPhoneConnection()
      .then(() => this.setStatus('✓ הטלפון והשעון מחוברים', 0x84c45e, 4000))
      .catch(() => this.setStatus('אין חיבור לטלפון', 0xe05858, 4000))
  },

  calculationContext(epoch) {
    if (this.locationMode === 'local') {
      const localDate = new Date(epoch)
      return {
        parts: deviceLocalParts(epoch),
        offsetMinutes: -localDate.getTimezoneOffset()
      }
    }
    return {
      parts: zonedParts(epoch, israelUtcOffsetHours(epoch) * 60),
      offsetMinutes: israelUtcOffsetHours(epoch) * 60
    }
  },

  sendStoppedTime(epoch) {
    const context = this.calculationContext(epoch)
    const selected = jclockSnapshot(
      context.parts,
      this.latitude,
      this.longitude,
      context.offsetMinutes / 60
    )
    this.setStatus('השעון נעצר · שולח 2…', GOLD)
    sendSnapshot({
      epoch,
      timeZone: this.timeZone,
      sun: { title: SUN_TITLE, time: selected.sun.value },
      moon: { title: MOON_TITLE, time: selected.moon ? selected.moon.value : '--:----:--' }
    }, ({ state }) => {
      if (state === 'sent') this.setStatus('שני השעונים נשלחו', GOLD, 2600)
      else if (state === 'queued') this.setStatus('שני השעונים ממתינים', GOLD, 3200)
      else if (state === 'error') this.setStatus('אין חיבור לטלפון', 0xe05858, 3200)
    }).catch(() => {})
  },

  refreshJerusalemContext() {
    const generation = this.locationGeneration
    requestPhoneLocation('jerusalem')
      .then((value) => {
        if (generation !== this.locationGeneration || this.locationMode !== 'jerusalem') return
        const location = normalizedLocation(value)
        if (!location) return
        this.applyDisplayPreference(location.keepScreenOn)
        this.utcOffsetMinutes = israelUtcOffsetHours(Date.now()) * 60
        this.timeZone = location.timeZone || 'Asia/Jerusalem'
        this.safeRefresh()
      })
      .catch(() => {})
  },

  selectJerusalem() {
    this.locationGeneration += 1
    this.desiredLocationMode = 'jerusalem'
    this.locationMode = 'jerusalem'
    this.latitude = LATITUDE
    this.longitude = LONGITUDE
    this.timeZone = 'Asia/Jerusalem'
    this.mobileLocationEnabled = false
    this.locationRequestInFlight = false
    this.stopLocationPolling()
    this.updateLocationLabel()
    this.safeRefresh()
    this.setStatus('ירושלים · מיקום קבוע', GOLD, 2200)
    this.refreshJerusalemContext()
  },

  selectLocalLocation() {
    const generation = ++this.locationGeneration
    this.desiredLocationMode = 'local'
    this.locationRequestInFlight = true
    this.setStatus('מקבל GPS מהטלפון…', GOLD)
    requestPhoneLocation('fixed')
      .then((value) => {
        this.locationRequestInFlight = false
        if (generation !== this.locationGeneration || this.desiredLocationMode !== 'local') return
        const location = normalizedLocation(value)
        if (!location) throw new Error('invalid phone location')
        this.applyLocalLocation(location)
        this.startLocationPolling()
        this.setStatus(
          location.mobileLocationEnabled ? 'מקומי · מיקום נייד' : 'מקומי · מיקום קבוע',
          GOLD,
          2600
        )
      })
      .catch(() => {
        this.locationRequestInFlight = false
        if (generation !== this.locationGeneration || this.desiredLocationMode !== 'local') return
        this.desiredLocationMode = this.locationMode
        this.setStatus('GPS בטלפון אינו זמין', 0xe05858, 3200)
      })
  },

  applyLocalLocation(location) {
    this.locationMode = 'local'
    this.desiredLocationMode = 'local'
    this.latitude = location.latitude
    this.longitude = location.longitude
    this.utcOffsetMinutes = location.utcOffsetMinutes
    this.timeZone = location.timeZone || this.timeZone
    this.mobileLocationEnabled = location.mobileLocationEnabled
    this.applyDisplayPreference(location.keepScreenOn)
    this.updateLocationLabel()
    this.safeRefresh()
  },

  startLocationPolling() {
    this.stopLocationPolling()
    this.locationPollTimer = setInterval(() => this.pollMobileLocation(), LOCATION_POLL_MS)
  },

  stopLocationPolling() {
    if (this.locationPollTimer) clearInterval(this.locationPollTimer)
    this.locationPollTimer = null
  },

  pollMobileLocation() {
    if (this.locationMode !== 'local' || this.locationRequestInFlight) return
    const generation = this.locationGeneration
    this.locationRequestInFlight = true
    requestPhoneLocation('mobile')
      .then((value) => {
        this.locationRequestInFlight = false
        if (generation !== this.locationGeneration || this.locationMode !== 'local') return
        this.mobileLocationEnabled = Boolean(value && value.mobileLocationEnabled)
        if (this.mobileLocationEnabled && value && value.updated !== false) {
          const location = normalizedLocation(value)
          if (location) this.applyLocalLocation(location)
        }
        this.updateLocationLabel()
      })
      .catch(() => {
        this.locationRequestInFlight = false
      })
  },

  updateLocationLabel() {
    if (this.locationLabel) {
      const value = this.locationMode === 'local'
        ? (this.mobileLocationEnabled ? 'מקומי · מיקום נייד' : 'מקומי · מיקום קבוע')
        : 'ירושלים · מיקום קבוע'
      this.locationLabel.setProperty(prop.TEXT, value)
    }
    if (this.leftButtonText) {
      this.leftButtonText.setProperty(prop.TEXT, this.locationMode === 'local' ? '• מקומי' : 'מקומי')
    }
    if (this.rightButtonText) {
      this.rightButtonText.setProperty(prop.TEXT, this.locationMode === 'jerusalem' ? '• ירושלים' : 'ירושלים')
    }
  },

  applyMoladButton(outer, inner, label, geometry, colors) {
    const foreground = colorNumber(colors && colors.foreground, BORDER)
    const background = colorNumber(colors && colors.background, PANEL)
    outer.setProperty(prop.MORE, {
      x: geometry.x,
      y: geometry.y,
      w: geometry.w,
      h: geometry.h,
      color: foreground,
      radius: this.px(9)
    })
    inner.setProperty(prop.MORE, {
      x: geometry.x + this.px(3),
      y: geometry.y + this.px(3),
      w: geometry.w - this.px(6),
      h: geometry.h - this.px(6),
      color: background,
      radius: this.px(7)
    })
    label.setProperty(prop.MORE, {
      x: geometry.x,
      y: geometry.y,
      w: geometry.w,
      h: geometry.h,
      color: foreground,
      text_size: geometry === this.leftButtonGeometry ? this.px(16) : this.px(14),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })
  },

  applyDisplayPreference(keepScreenOn) {
    if (keepScreenOn) setPageBrightTime({ brightTime: 2147483000 })
    else resetPageBrightTime()
  },

  safeRefresh() {
    try {
      this.refresh()
      return true
    } catch (error) {
      if (this.mazalLabel) this.mazalLabel.setProperty(prop.TEXT, 'שגיאת חישוב')
      return false
    }
  },

  refresh() {
    if (!this.sunHour) return
    const epoch = this.pausedEpoch || Date.now()
    const context = this.calculationContext(epoch)
    const snapshot = jclockSnapshot(
      context.parts,
      this.latitude,
      this.longitude,
      context.offsetMinutes / 60
    )
    this.snapshot = snapshot

    const showMoon = Boolean(snapshot.moon) && Math.floor((Date.now() - this.sourceSwitchStartedAt) / 6000) % 2 === 1
    const source = showMoon ? snapshot.moon : snapshot.sun
    const molad = showMoon ? snapshot.molad.moon : snapshot.molad.sun

    this.gregorianDay.setProperty(prop.MORE, {
      text: pad(context.parts.day, 2),
      color: garminMidaColor(molad.foregroundMida)
    })
    this.gregorianSeparator.setProperty(prop.COLOR, MUTED)
    this.gregorianMonth.setProperty(prop.MORE, {
      text: pad(context.parts.month, 2),
      color: garminMidaColor(molad.backgroundMida)
    })
    this.civil.setProperty(prop.TEXT, civilTimeFromParts(context.parts))
    this.mazalLabel.setProperty(prop.MORE, {
      text: showMoon ? snapshot.hebrew.hebrewText : (source.mazalName || snapshot.hebrew.hebrewText),
      color: showMoon
        ? (source.risingPeriod ? 0xffffff : MUTED)
        : MUTED
    })

    const parts = String(source.value || '--:----:--').split(':')
    this.sunHour.setProperty(prop.TEXT, parts[0] || '--')
    this.sunMinute.setProperty(prop.TEXT, parts[1] || '----')
    this.sunSecond.setProperty(prop.TEXT, parts[2] || '--')

    if (showMoon) {
      const moonColor = garminMidaColor(source.mazal && source.mazal.midaNumber)
      this.sunHour.setProperty(prop.COLOR, moonColor)
      this.sunMinute.setProperty(prop.COLOR, moonColor)
      this.sunSecond.setProperty(prop.COLOR, moonColor)
      this.sunSeparator1.setProperty(prop.COLOR, moonColor)
      this.sunSeparator2.setProperty(prop.COLOR, moonColor)
    } else {
      const colors = source.garminColors
      this.sunHour.setProperty(prop.COLOR, colors.hour)
      this.sunMinute.setProperty(prop.COLOR, colors.minute)
      this.sunSecond.setProperty(prop.COLOR, colors.second)
      this.sunSeparator1.setProperty(prop.COLOR, colors.separator)
      this.sunSeparator2.setProperty(prop.COLOR, colors.separator)
    }
  },

  onDestroy() {
    if (this.timer) clearInterval(this.timer)
    if (this.tapTimer) clearTimeout(this.tapTimer)
    if (this.statusTimer) clearTimeout(this.statusTimer)
    if (this.displayPreferenceTimer) clearInterval(this.displayPreferenceTimer)
    resetPageBrightTime()
    this.stopLocationPolling()
  }
})
