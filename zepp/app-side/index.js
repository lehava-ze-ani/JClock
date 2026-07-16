import { BaseSideService, settingsLib } from '@zeppos/zml/base-side'

const METHOD_SEND_SNAPSHOT = 'jclock.snapshot'
const METHOD_TOGGLE_MUSIC = 'jclock.music.toggle'
const METHOD_GET_LOCATION = 'jclock.location.get'
const SNAPSHOT_ENDPOINT = 'http://127.0.0.1:43777/jclock/zepp/snapshot'
const MUSIC_ENDPOINT = 'http://127.0.0.1:43777/jclock/zepp/music-toggle'
const LOCATION_ENDPOINT = 'http://127.0.0.1:43777/jclock/zepp/location'
const LOCATION_PROTOCOL = 'jclock.location.v1'
const LOCATION_MODES = ['fixed', 'mobile', 'jerusalem']
const LOCATION_TIMEOUT_MS = 16000
const PENDING_SNAPSHOT_KEY = 'jclock.pendingSnapshot'
const PENDING_MUSIC_KEY = 'jclock.pendingMusicToggle'
const RETRY_DELAY_MS = 15000
const logger = Logger.getLogger('jclock-side')

function isSnapshot(value) {
  return value &&
    value.protocol === 'jclock.snapshot.v1' &&
    typeof value.eventId === 'string' &&
    typeof value.epoch === 'number' &&
    typeof value.timeZone === 'string' &&
    value.sun &&
    typeof value.sun.title === 'string' &&
    value.moon &&
    typeof value.moon.title === 'string'
}

function responseSucceeded(response) {
  const status = response && Number(response.status)
  return Number.isFinite(status) && status >= 200 && status < 300
}

function isMusicToggle(value) {
  return value &&
    value.protocol === 'jclock.music.toggle.v1' &&
    typeof value.eventId === 'string' &&
    typeof value.epoch === 'number'
}

function isLocationRequest(value) {
  return value &&
    value.protocol === LOCATION_PROTOCOL &&
    LOCATION_MODES.indexOf(value.mode) >= 0 &&
    (value.requestedAt === undefined || Number.isFinite(value.requestedAt))
}

function parseResponseBody(response) {
  const body = response && response.body
  if (typeof body === 'string') {
    if (!body.trim()) throw new Error('Android location receiver returned an empty body')
    try {
      return JSON.parse(body)
    } catch (error) {
      throw new Error('Android location receiver returned invalid JSON')
    }
  }
  if (body && typeof body === 'object') return body
  throw new Error('Android location receiver returned no JSON body')
}

AppSideService(
  BaseSideService({
    onInit() {
      this.pendingInFlight = {}
      this.retryTimers = {}
      this.retryPending(PENDING_SNAPSHOT_KEY, isSnapshot)
      this.retryPending(PENDING_MUSIC_KEY, isMusicToggle)
    },

    onRun() {
      this.retryPending(PENDING_SNAPSHOT_KEY, isSnapshot)
      this.retryPending(PENDING_MUSIC_KEY, isMusicToggle)
    },

    relay(endpoint, pendingKey, protocol, payload) {
      return this.fetch({
        url: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JClock-Protocol': protocol
        },
        body: JSON.stringify(payload),
        timeout: 5000
      }).then((response) => {
        if (!responseSucceeded(response)) {
          const status = response && response.status
          throw new Error(`Android receiver returned ${status || 'no status'}`)
        }

        settingsLib.removeItem(pendingKey)
        this.clearRetry(pendingKey)
        return {
          delivered: true,
          eventId: payload.eventId,
          status: Number(response.status)
        }
      })
    },

    relayPayload(payload) {
      if (isSnapshot(payload)) {
        return this.relay(
          SNAPSHOT_ENDPOINT,
          PENDING_SNAPSHOT_KEY,
          'jclock.snapshot.v1',
          payload
        )
      }
      if (isMusicToggle(payload)) {
        return this.relay(
          MUSIC_ENDPOINT,
          PENDING_MUSIC_KEY,
          'jclock.music.toggle.v1',
          payload
        )
      }
      return Promise.reject(new Error('Unsupported JClock payload'))
    },

    relayLocation(payload) {
      return this.fetch({
        url: LOCATION_ENDPOINT,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JClock-Protocol': LOCATION_PROTOCOL
        },
        body: JSON.stringify(payload),
        timeout: LOCATION_TIMEOUT_MS
      }).then((response) => {
        if (!responseSucceeded(response)) {
          const status = response && response.status
          throw new Error(`Android location receiver returned ${status || 'no status'}`)
        }

        const result = parseResponseBody(response)
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
          throw new Error('Android location receiver returned an invalid JSON object')
        }
        if (result.ok === false) {
          throw new Error(result.error || 'Android location receiver rejected the request')
        }
        if (result.mode && result.mode !== payload.mode) {
          throw new Error('Android location receiver returned the wrong mode')
        }
        const normalized = Object.assign({}, result, { mode: result.mode || payload.mode })
        if (Number.isFinite(result.utcOffsetSeconds)) {
          normalized.utcOffsetMinutes = result.utcOffsetSeconds / 60
        } else if (!Number.isFinite(result.utcOffsetMinutes)) {
          throw new Error('Android location receiver returned no UTC offset')
        }
        return normalized
      })
    },

    queuePayload(pendingKey, payload, error) {
      settingsLib.setItem(pendingKey, JSON.stringify(payload))
      this.scheduleRetry(pendingKey)
      logger.warn(`command queued: ${error && error.message ? error.message : error}`)
      return {
        delivered: false,
        queued: true,
        eventId: payload.eventId
      }
    },

    clearRetry(pendingKey) {
      const timer = this.retryTimers && this.retryTimers[pendingKey]
      if (timer) clearTimeout(timer)
      if (this.retryTimers) this.retryTimers[pendingKey] = null
    },

    scheduleRetry(pendingKey) {
      if (!this.retryTimers) this.retryTimers = {}
      if (this.retryTimers[pendingKey]) return
      this.retryTimers[pendingKey] = setTimeout(() => {
        this.retryTimers[pendingKey] = null
        this.retryPending(
          pendingKey,
          pendingKey === PENDING_SNAPSHOT_KEY ? isSnapshot : isMusicToggle
        )
      }, RETRY_DELAY_MS)
    },

    retryPending(pendingKey, validate) {
      if (!this.pendingInFlight) this.pendingInFlight = {}
      if (this.pendingInFlight[pendingKey]) return
      const pending = settingsLib.getItem(pendingKey)
      if (!pending) return

      try {
        const payload = JSON.parse(pending)
        if (!validate(payload)) {
          settingsLib.removeItem(pendingKey)
          return
        }
        this.pendingInFlight[pendingKey] = true
        this.relayPayload(payload)
          .catch((error) => {
            logger.warn(`pending command still waiting: ${error && error.message ? error.message : error}`)
            this.scheduleRetry(pendingKey)
          })
          .then(() => {
            this.pendingInFlight[pendingKey] = false
          })
      } catch (error) {
        settingsLib.removeItem(pendingKey)
      }
    },

    onRequest(request, respond) {
      if (request && request.method === METHOD_GET_LOCATION) {
        const payload = request.params
        if (!isLocationRequest(payload)) {
          respond({ code: 'INVALID_PAYLOAD', message: 'Invalid JClock location payload' })
          return
        }

        // A delayed location is worse than no location, so location requests
        // are never persisted or retried through the snapshot/music queue.
        this.relayLocation(payload)
          .then((result) => respond(null, result))
          .catch((error) => respond({
            code: 'LOCATION_UNAVAILABLE',
            message: error && error.message ? error.message : 'Phone location is unavailable'
          }))
        return
      }

      if (!request || (request.method !== METHOD_SEND_SNAPSHOT && request.method !== METHOD_TOGGLE_MUSIC)) {
        respond({ code: 'UNKNOWN_METHOD', message: 'Unknown JClock method' })
        return
      }

      const payload = request.params
      const isSnapshotRequest = request.method === METHOD_SEND_SNAPSHOT
      const valid = isSnapshotRequest ? isSnapshot(payload) : isMusicToggle(payload)
      if (!valid) {
        respond({ code: 'INVALID_PAYLOAD', message: 'Invalid JClock payload' })
        return
      }

      const pendingKey = isSnapshotRequest ? PENDING_SNAPSHOT_KEY : PENDING_MUSIC_KEY
      this.relayPayload(payload)
        .then((result) => respond(null, result))
        .catch((error) => respond(null, this.queuePayload(pendingKey, payload, error)))
    },

    onDestroy() {
      this.clearRetry(PENDING_SNAPSHOT_KEY)
      this.clearRetry(PENDING_MUSIC_KEY)
    }
  })
)
