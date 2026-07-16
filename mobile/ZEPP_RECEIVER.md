# Zepp-to-Android loopback receiver

The Zepp Side Service sends watch commands to the Android companion at
`127.0.0.1:43777`. `ZeppLoopbackService` binds only that IPv4 loopback address;
it does not listen on Wi-Fi, mobile-data, or LAN interfaces.

Supported requests:

- `POST /jclock/zepp/snapshot` with protocol `jclock.snapshot.v1`
- `POST /jclock/zepp/music-toggle` with protocol `jclock.music.toggle.v1`
- `POST /jclock/zepp/location` with protocol `jclock.location.v1`

Snapshot and music messages require a non-empty `eventId`. Accepted IDs are retained for 24
hours (up to 256 entries), including across process restarts, so Side Service
retries do not repeat a link-forwarding or play/pause action. JSON bodies are
limited to 64 KiB. A snapshot may supply `date` and `time`; otherwise the
receiver derives them from `epoch`/`epochMs` in the supplied `timeZone`.

Location requests use one of three modes: `fixed` performs the default fixed
phone GPS read, `mobile` returns the moving location for the caller's 6000 ms
refresh cycle, and `jerusalem` returns the fixed Jerusalem calculation context.
Location responses are never queued or retried: replaying an old position would
be less accurate than reporting that the current position is unavailable.
`fixed` and `mobile` preserve the phone's local time zone as-is; only
`jerusalem` uses `Asia/Jerusalem`. Android returns `utcOffsetSeconds`, and the
Side Service also exposes the normalized `utcOffsetMinutes` value to the watch.

## Android lifecycle limitations

The receiver starts as a foreground service when `MainActivity` is opened and
shows a persistent low-priority notification. Android can still stop it after a
force-stop, a reboot before the app is reopened, aggressive battery management,
or foreground-service time limits. The user should open JClock once again in
those cases. The Zepp Side Service keeps its latest undelivered snapshot or
music command queued; location requests are excluded from that queue.

Android may also prevent an app in the background from placing a new Activity
over the lock screen or the user's current app. Receiving the snapshot and
opening the link/email UI are separate operations: the request can be accepted
while the UI waits until the phone is unlocked or JClock is foregrounded.

Loopback prevents remote-network access, but Android apps share the phone's
loopback network namespace. Protocol validation, strict size limits, and event
deduplication reduce accidental or replayed commands; they are not authentication
against another malicious app installed on the same phone.
