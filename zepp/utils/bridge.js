const METHOD_SEND_SNAPSHOT = 'jclock.snapshot'
const METHOD_TOGGLE_MUSIC = 'jclock.music.toggle'
const METHOD_GET_LOCATION = 'jclock.location.get'
const METHOD_PING = 'jclock.ping'
const LOCATION_PROTOCOL = 'jclock.location.v1'
const LOCATION_MODES = ['fixed', 'mobile', 'jerusalem']

export const SUN_TITLE = 'שעון חמה:\nמה צריך להיות באמת יעד המשימה?'
export const MOON_TITLE = 'שעון הלבנה:\nמה גרם לנו לעצור את השעון?'

function report(onStatus, status) {
  if (typeof onStatus === 'function') {
    onStatus(status)
  }
}

function getMessaging() {
  try {
    const app = getApp()
    return app &&
      app._options &&
      app._options.globalData &&
      app._options.globalData.messaging
  } catch (error) {
    return null
  }
}

function normalizedSnapshot(payload) {
  const source = payload || {}
  const epoch = Number(source.epoch)

  return {
    protocol: 'jclock.snapshot.v1',
    eventId: source.eventId || `${Number.isFinite(epoch) ? epoch : Date.now()}-${Date.now()}`,
    epoch: Number.isFinite(epoch) ? epoch : Date.now(),
    timeZone: source.timeZone || 'Asia/Jerusalem',
    sun: {
      title: source.sun && source.sun.title ? source.sun.title : SUN_TITLE,
      time: source.sun && source.sun.time ? source.sun.time : ''
    },
    moon: {
      title: source.moon && source.moon.title ? source.moon.title : MOON_TITLE,
      time: source.moon && source.moon.time ? source.moon.time : ''
    }
  }
}

/**
 * Send one stopped-clock snapshot to the Zepp Side Service on the phone.
 *
 * onStatus receives:
 *   { state: 'sending' }
 *   { state: 'sent', result }
 *   { state: 'queued', result }
 *   { state: 'error', error }
 */
export function sendSnapshot(payload, onStatus) {
  const messaging = getMessaging()

  if (!messaging || typeof messaging.request !== 'function') {
    const error = new Error('Zepp messaging is not ready')
    report(onStatus, { state: 'error', error })
    return Promise.reject(error)
  }

  const snapshot = normalizedSnapshot(payload)
  report(onStatus, { state: 'sending', snapshot })

  return messaging
    .request({
      method: METHOD_SEND_SNAPSHOT,
      params: snapshot
    })
    .then((result) => {
      const state = result && result.delivered ? 'sent' : 'queued'
      report(onStatus, { state, result, snapshot })
      return result
    })
    .catch((error) => {
      report(onStatus, { state: 'error', error, snapshot })
      throw error
    })
}

/**
 * Ask the Android companion to toggle the current media session.
 */
export function sendMusicToggle(onStatus) {
  const messaging = getMessaging()

  if (!messaging || typeof messaging.request !== 'function') {
    const error = new Error('Zepp messaging is not ready')
    report(onStatus, { state: 'error', error })
    return Promise.reject(error)
  }

  const now = Date.now()
  const command = {
    protocol: 'jclock.music.toggle.v1',
    eventId: `music-${now}`,
    epoch: now
  }
  report(onStatus, { state: 'sending', command })

  return messaging
    .request({
      method: METHOD_TOGGLE_MUSIC,
      params: command
    })
    .then((result) => {
      const state = result && result.delivered ? 'sent' : 'queued'
      report(onStatus, { state, result, command })
      return result
    })
    .catch((error) => {
      report(onStatus, { state: 'error', error, command })
      throw error
    })
}

/**
 * Ask the Android companion for the calculation location.
 *
 * `fixed` reads and retains the phone's fixed position, `mobile` reads the current
 * moving position, and `jerusalem` returns the Jerusalem calculation context. Location
 * requests are deliberately request/response only; the Side Service never
 * queues a stale location for later delivery.
 */
export function requestPhoneLocation(mode = 'fixed') {
  const messaging = getMessaging()

  if (!messaging || typeof messaging.request !== 'function') {
    return Promise.reject(new Error('Zepp messaging is not ready'))
  }

  if (LOCATION_MODES.indexOf(mode) < 0) {
    return Promise.reject(new Error(`Unsupported JClock location mode: ${mode}`))
  }

  const requestedAt = Date.now()
  return messaging.request({
    method: METHOD_GET_LOCATION,
    params: {
      protocol: LOCATION_PROTOCOL,
      mode,
      requestedAt
    }
  })
}

export function testPhoneConnection() {
  const messaging = getMessaging()
  if (!messaging || typeof messaging.request !== 'function') {
    return Promise.reject(new Error('Zepp messaging is not ready'))
  }
  return messaging.request({ method: METHOD_PING, params: { requestedAt: Date.now() } })
}
