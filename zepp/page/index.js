import { jclockSnapshot } from '../utils/jclock'
import { requestPhoneLocation, sendSnapshot, sendMusicToggle, testPhoneConnection, SUN_TITLE, MOON_TITLE } from '../utils/bridge'
import { createWidget, widget, align, prop, event } from '@zos/ui'
import { getDeviceInfo } from '@zos/device'

const LATITUDE = 31.7768514
const LONGITUDE = 35.2331664
const DOUBLE_TAP_MS = 430
const LOCATION_POLL_MS = 6000

const BLACK = 0x000000
const PANEL = 0x121416
const BORDER = 0x3a4148
const ORBIT_BORDER = 0x59636d
const TEXT = 0xd4d8dc
const MUTED = 0x9199a2
const GOLD = 0xf2ca45
const GOLD_DARK = 0x5a4812
const SUN = 0xffd342

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
    ,umid: /^[0-9A-F]{24}$/i.test(String(value && value.umid || '').trim())
      ? String(value.umid).trim().toUpperCase()
      : ''
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
    console.log('[JClock] B00 build start')
    const { width, height } = getDeviceInfo()
    console.log(`[JClock] B01 device ${width}x${height}`)
    const scale = Math.min(width, height) / 454
    const px = value => Math.round(value * scale)
    const centerX = Math.round(width / 2)

    this.width = width
    this.height = height
    this.px = px
    this.snapshot = null
    this.firstTapAt = 0
    this.pausedEpoch = 0
    this.tapTimer = null
    this.statusTimer = null
    this.locationPollTimer = null
    this.locationRequestInFlight = false
    this.locationGeneration = 0
    this.desiredLocationMode = 'jerusalem'
    this.locationMode = 'jerusalem'
    this.latitude = LATITUDE
    this.longitude = LONGITUDE
    this.timeZone = 'Asia/Jerusalem'
    this.utcOffsetMinutes = -new Date().getTimezoneOffset()
    this.mobileLocationEnabled = false
    this.umid = ''
    this.generalTextWidgets = []
    this.generalFillWidgets = []

    let defaultOwner = null
    const make = (owner, type, params) => {
      const targetOwner = owner === null ? defaultOwner : owner
      return targetOwner
        ? targetOwner.createWidget(type, params)
        : createWidget(type, params)
    }

    const fill = (owner, x, y, w, h, color, radius = 0) => {
      const result = make(owner, widget.FILL_RECT, { x, y, w, h, color, radius })
      this.generalFillWidgets.push(result)
      return result
    }

    const text = (owner, x, y, w, h, size, value, color = TEXT) => {
      const result = make(owner, widget.TEXT, {
        x, y, w, h, text: value, text_size: size, color,
        align_h: align.CENTER_H, align_v: align.CENTER_V
      })
      this.generalTextWidgets.push(result)
      return result
    }

    fill(null, 0, 0, width, height, BLACK)
    this.background = make(null, widget.IMG, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      src: 'cover-yellow-black.png',
      auto_scale: true,
      auto_scale_obj_fit: true
    })
    // If a later widget or calculation fails, this remains visible and proves
    // that the page itself started instead of leaving an indistinguishable black screen.
    this.bootLabel = text(null, px(55), px(190), width - px(110), px(74), px(25), 'JClock 0.3.8\nטוען…', GOLD)
    this.mainLayer = createWidget(widget.GROUP, { x: 0, y: 0, w: width, h: height })
    defaultOwner = this.mainLayer
    console.log('[JClock] B02 boot label')

    // Top: solar source-clock line.
    text(null, centerX - px(52), px(18), px(104), px(24), px(17), 'חמה', GOLD)
    const rowX = px(61)
    const rowW = width - rowX * 2
    const rowH = px(64)
    fill(null, rowX, px(41), rowW, rowH, BORDER, px(8))
    fill(null, rowX + px(2), px(43), rowW - px(4), rowH - px(4), PANEL, px(6))
    this.sunTime = text(null, rowX, px(43), rowW, px(45), px(38), '--:----:--')
    this.sunMazal = text(null, rowX + px(8), px(86), rowW - px(16), px(16), px(13), '--', MUTED)
    console.log('[JClock] B03 solar row')

    // Critical molad-color buttons. The left one receives Jerusalem sun colors;
    // the right one receives Jerusalem moon colors, exactly like the local source.
    const sideY = px(151)
    const sideW = px(70)
    const sideH = px(126)
    this.leftButtonGeometry = { x: px(16), y: sideY, w: sideW, h: sideH }
    this.rightButtonGeometry = { x: width - px(16) - sideW, y: sideY, w: sideW, h: sideH }
    this.leftButtonOuter = fill(null, this.leftButtonGeometry.x, sideY, sideW, sideH, BORDER, px(9))
    this.leftButtonInner = fill(null, this.leftButtonGeometry.x + px(3), sideY + px(3), sideW - px(6), sideH - px(6), PANEL, px(7))
    this.leftButtonText = text(null, this.leftButtonGeometry.x, sideY, sideW, sideH, px(16), 'מקומי')
    this.rightButtonOuter = fill(null, this.rightButtonGeometry.x, sideY, sideW, sideH, BORDER, px(9))
    this.rightButtonInner = fill(null, this.rightButtonGeometry.x + px(3), sideY + px(3), sideW - px(6), sideH - px(6), PANEL, px(7))
    this.rightButtonText = text(null, this.rightButtonGeometry.x, sideY, sideW, sideH, px(14), 'ירושלים')
    this.leftButtonText.addEventListener(event.CLICK_UP, () => this.selectLocalLocation())
    this.rightButtonText.addEventListener(event.CLICK_UP, () => this.selectJerusalem())
    console.log('[JClock] B04 side buttons')

    // Center orbit. Right is east/rise, left is west/set.
    const groupSize = px(218)
    this.orbitGroupSize = groupSize
    this.orbitCenter = Math.round(groupSize / 2)
    this.orbitRadius = px(82)
    this.orbitGroup = createWidget(widget.GROUP, {
      x: centerX - Math.round(groupSize / 2),
      y: px(107),
      w: groupSize,
      h: groupSize
    })
    console.log('[JClock] B05 orbit group')
    make(this.orbitGroup, widget.CIRCLE, {
      center_x: this.orbitCenter,
      center_y: this.orbitCenter,
      radius: px(91),
      color: ORBIT_BORDER
    })
    make(this.orbitGroup, widget.CIRCLE, {
      center_x: this.orbitCenter,
      center_y: this.orbitCenter,
      radius: px(89),
      color: PANEL
    })
    this.weekday = text(this.orbitGroup, px(45), px(65), px(128), px(22), px(13), '--', MUTED)
    this.date = text(this.orbitGroup, px(30), px(88), px(158), px(34), px(22), '--', TEXT)
    this.civil = text(this.orbitGroup, px(47), px(121), px(124), px(24), px(16), '--:--:--', TEXT)
    this.status = text(this.orbitGroup, px(25), px(146), px(168), px(25), px(13), 'נגיעה: נגן · כפולה: שליחה', MUTED)

    this.sunDot = make(this.orbitGroup, widget.CIRCLE, {
      center_x: this.orbitCenter,
      center_y: this.orbitCenter - this.orbitRadius,
      radius: px(9),
      color: SUN
    })
    this.moonImage = make(this.orbitGroup, widget.IMG, {
      x: this.orbitCenter - px(16),
      y: this.orbitCenter - this.orbitRadius - px(16),
      w: px(32),
      h: px(32),
      src: 'moon/moon_30_01.png',
      auto_scale: true,
      auto_scale_obj_fit: true
    })
    this.orbitGroup.addEventListener(event.CLICK_UP, () => this.onClockTap())
    console.log('[JClock] B06 orbit content')

    text(null, px(112), px(284), px(70), px(18), px(11), 'מערב', MUTED)
    text(null, width - px(182), px(284), px(70), px(18), px(11), 'מזרח', MUTED)

    // Bottom: lunar source-clock line.
    text(null, centerX - px(52), px(299), px(104), px(23), px(17), 'לבנה', GOLD)
    fill(null, rowX, px(321), rowW, rowH, BORDER, px(8))
    fill(null, rowX + px(2), px(323), rowW - px(4), rowH - px(4), PANEL, px(6))
    this.moonTime = text(null, rowX, px(323), rowW, px(45), px(38), '--:----:--')
    this.moonMazal = text(null, rowX + px(8), px(366), rowW - px(16), px(16), px(13), '--', MUTED)
    console.log('[JClock] B07 lunar row')

    this.locationLabel = text(null, px(62), px(397), width - px(124), px(32), px(14), 'ירושלים · מיקום קבוע', GOLD)
    console.log('[JClock] B08 location mode')
    this.syncButtonGeometry = { x: px(137), y: px(430), w: width - px(274), h: px(22) }
    this.syncButtonOuter = fill(null, this.syncButtonGeometry.x, this.syncButtonGeometry.y, this.syncButtonGeometry.w, this.syncButtonGeometry.h, BORDER, px(7))
    this.syncButtonInner = fill(null, this.syncButtonGeometry.x + px(2), this.syncButtonGeometry.y + px(2), this.syncButtonGeometry.w - px(4), this.syncButtonGeometry.h - px(4), PANEL, px(5))
    this.syncButtonText = text(null, this.syncButtonGeometry.x, this.syncButtonGeometry.y, this.syncButtonGeometry.w, this.syncButtonGeometry.h, px(11), 'בדיקת חיבור')
    this.syncButtonText.addEventListener(event.CLICK_UP, () => this.checkConnection())

    // Opening cover. The artwork stays text-free; exact Hebrew is drawn here so
    // spelling remains deterministic on every build.
    this.cover = createWidget(widget.GROUP, { x: 0, y: 0, w: width, h: height })
    console.log('[JClock] B09 cover group')
    console.log('[JClock] B10 shared background')
    text(this.cover, px(64), px(80), width - px(128), px(42), px(30), 'JClock', GOLD)
    text(this.cover, px(60), px(133), width - px(120), px(30), px(21), 'שעון חמה:', GOLD)
    text(this.cover, px(48), px(161), width - px(96), px(62), px(20), 'מה צריך להיות באמת\nיעד המשימה?', TEXT)
    fill(this.cover, px(105), px(232), width - px(210), px(2), GOLD_DARK)
    text(this.cover, px(60), px(244), width - px(120), px(30), px(21), 'שעון הלבנה:', GOLD)
    text(this.cover, px(48), px(272), width - px(96), px(62), px(20), 'מה גרם לנו לעצור\nאת השעון?', TEXT)
    this.coverStatus = text(this.cover, px(70), px(368), width - px(140), px(28), px(15), 'נגיעה לפתיחת השעון', GOLD)
    this.coverError = text(this.cover, px(42), px(397), width - px(84), px(24), px(11), '', 0xe05858)
    text(this.cover, px(48), px(426), width - px(96), px(16), px(10), '© 2009–2026 נפתלי ביליג', MUTED)
    this.mainLayer.setProperty(prop.VISIBLE, false)
    this.orbitGroup.setProperty(prop.VISIBLE, false)
    this.cover.addEventListener(event.CLICK_UP, () => {
      this.cover.setProperty(prop.VISIBLE, false)
      this.mainLayer.setProperty(prop.VISIBLE, true)
      this.orbitGroup.setProperty(prop.VISIBLE, true)
    })
    this.bootLabel.setProperty(prop.VISIBLE, false)
    console.log('[JClock] B11 cover complete')

    // Build the cover before the first dynamic calculation. If a calculation
    // fails on a particular firmware, the user still sees a usable diagnostic
    // screen instead of the black background.
    this.safeRefresh()
    console.log('[JClock] B12 first refresh')
    this.timer = setInterval(() => this.safeRefresh(), 1000)
    this.refreshJerusalemContext()
    console.log('[JClock] B13 timer')
  },

  setStatus(value, color = MUTED, clearAfter = 0) {
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
      this.pausedEpoch = 0
      this.sendStoppedTime(selectedEpoch)
      this.safeRefresh()
      return
    }

    this.firstTapAt = now
    this.pausedEpoch = now
    this.safeRefresh()
    this.setStatus('ממתין ללחיצה שנייה…', GOLD)
    this.tapTimer = setTimeout(() => {
      this.tapTimer = null
      this.firstTapAt = 0
      this.pausedEpoch = 0
      this.togglePhoneMusic()
      this.safeRefresh()
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
      parts: zonedParts(epoch, this.utcOffsetMinutes),
      offsetMinutes: this.utcOffsetMinutes
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
        this.applyUmid(location.umid)
        this.utcOffsetMinutes = location.utcOffsetMinutes
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
    this.applyUmid(location.umid)
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
    const foreground = this.umid ? colorNumber(this.umid.slice(12, 18), BORDER) : colorNumber(colors && colors.foreground, BORDER)
    const background = this.umid ? colorNumber(this.umid.slice(18, 24), PANEL) : colorNumber(colors && colors.background, PANEL)
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

  applyUmid(value) {
    const normalized = String(value || '').trim().toUpperCase()
    if (!/^[0-9A-F]{24}$/.test(normalized) || normalized === this.umid) return
    this.umid = normalized
    const generalText = colorNumber(normalized.slice(0, 6), TEXT)
    const generalBackground = colorNumber(normalized.slice(6, 12), BLACK)
    this.generalFillWidgets.forEach(item => item.setProperty(prop.COLOR, generalBackground))
    this.generalTextWidgets.forEach(item => item.setProperty(prop.COLOR, generalText))
    if (this.background) this.background.setProperty(prop.VISIBLE, false)
    this.safeRefresh()
  },

  safeRefresh() {
    try {
      this.refresh()
      return true
    } catch (error) {
      this.setStatus('שגיאת תצוגה · פתח מחדש', 0xe05858)
      if (this.coverStatus) this.coverStatus.setProperty(prop.TEXT, 'שגיאת חישוב')
      if (this.coverError) {
        const message = error && error.message ? error.message : String(error || 'unknown')
        this.coverError.setProperty(prop.TEXT, message.slice(0, 48))
      }
      return false
    }
  },

  refresh() {
    if (!this.sunTime) return
    const epoch = this.pausedEpoch || Date.now()
    const context = this.calculationContext(epoch)
    const snapshot = jclockSnapshot(
      context.parts,
      this.latitude,
      this.longitude,
      context.offsetMinutes / 60
    )
    this.snapshot = snapshot

    this.sunTime.setProperty(prop.TEXT, snapshot.sun.value)
    this.moonTime.setProperty(prop.TEXT, snapshot.moon ? snapshot.moon.value : '--:----:--')
    this.date.setProperty(prop.TEXT, snapshot.hebrew.formatted)
    this.weekday.setProperty(prop.TEXT, `יום ${WEEKDAYS[snapshot.hebrew.weekday] || ''}`)
    this.civil.setProperty(prop.TEXT, civilTimeFromParts(context.parts))
    this.sunMazal.setProperty(prop.MORE, {
      x: this.px(69),
      y: this.px(86),
      w: this.width - this.px(138),
      h: this.px(16),
      text: `יום ${snapshot.sun.dayMazalName} · שעה ${snapshot.sun.mazalName}`,
      text_size: this.px(13),
      color: colorNumber(snapshot.sun.mazalColor, MUTED),
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })
    this.moonMazal.setProperty(prop.MORE, {
      x: this.px(69),
      y: this.px(366),
      w: this.width - this.px(138),
      h: this.px(16),
      text: snapshot.moon ? `יום ${snapshot.moon.dayMazalName} · שעה ${snapshot.moon.mazalName}` : '--',
      text_size: this.px(13),
      color: snapshot.moon ? colorNumber(snapshot.moon.mazalColor, MUTED) : MUTED,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    })

    const sun = sourcePosition(snapshot.sun, this.orbitCenter, this.orbitRadius)
    const moon = sourcePosition(snapshot.moon, this.orbitCenter, this.orbitRadius)
    this.sunDot.setProperty(prop.MORE, {
      center_x: sun.x,
      center_y: sun.y,
      radius: this.px(9),
      color: SUN
    })
    this.moonImage.setProperty(prop.MORE, {
      x: moon.x - this.px(16),
      y: moon.y - this.px(16),
      w: this.px(32),
      h: this.px(32),
      src: moonAsset(snapshot),
      auto_scale: true,
      auto_scale_obj_fit: true
    })

    this.applyMoladButton(
      this.leftButtonOuter,
      this.leftButtonInner,
      this.leftButtonText,
      this.leftButtonGeometry,
      snapshot.molad.sun
    )
    this.applyMoladButton(
      this.rightButtonOuter,
      this.rightButtonInner,
      this.rightButtonText,
      this.rightButtonGeometry,
      snapshot.molad.moon
    )
    this.updateLocationLabel()
  },

  onDestroy() {
    if (this.timer) clearInterval(this.timer)
    if (this.tapTimer) clearTimeout(this.tapTimer)
    if (this.statusTimer) clearTimeout(this.statusTimer)
    this.stopLocationPolling()
  }
})
