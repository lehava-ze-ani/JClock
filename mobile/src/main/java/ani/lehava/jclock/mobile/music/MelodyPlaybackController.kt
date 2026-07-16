package ani.lehava.jclock.mobile.music

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.ContextCompat
import java.util.concurrent.CopyOnWriteArraySet

/** Process-level facade shared by Wear, the Zepp loopback bridge, and the phone UI. */
object MelodyPlaybackController {
    fun interface Listener {
        fun onStateChanged(state: MelodyPlayer.State)
    }

    private val listeners = CopyOnWriteArraySet<Listener>()

    @Volatile
    var state: MelodyPlayer.State = MelodyPlayer.State.Idle
        private set

    @Volatile
    var isPlaybackRequested: Boolean = false
        internal set

    fun toggle(context: Context) = dispatch(context, MelodyPlaybackService.ACTION_TOGGLE)

    fun play(context: Context) = dispatch(context, MelodyPlaybackService.ACTION_PLAY)

    fun pause(context: Context) = dispatch(context, MelodyPlaybackService.ACTION_PAUSE)

    fun skip(context: Context) = dispatch(context, MelodyPlaybackService.ACTION_SKIP)

    /** Starts the persistent media command target while the Activity is visible. */
    fun prepare(context: Context) = dispatch(context, MelodyPlaybackService.ACTION_PREPARE)

    fun playLocal(context: Context, uri: Uri, displayName: String) {
        val intent = Intent(context, MelodyPlaybackService::class.java)
            .setAction(MelodyPlaybackService.ACTION_PLAY_LOCAL)
            .setData(uri)
            .putExtra(MelodyPlaybackService.EXTRA_LOCAL_NAME, displayName)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        dispatchIntent(context, intent)
    }

    fun setVolume(context: Context, value: Int) {
        val safeValue = value.coerceIn(0, 100)
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_VOLUME, safeValue)
            .apply()
        if (!isPlaybackRequested) return
        val intent = Intent(context, MelodyPlaybackService::class.java)
            .setAction(MelodyPlaybackService.ACTION_SET_VOLUME)
            .putExtra(MelodyPlaybackService.EXTRA_VOLUME, safeValue)
        dispatchIntent(context, intent)
    }

    fun savedVolume(context: Context): Int =
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getInt(KEY_VOLUME, 70)

    fun addListener(listener: Listener) {
        listeners += listener
        listener.onStateChanged(state)
    }

    fun removeListener(listener: Listener) {
        listeners -= listener
    }

    internal fun publish(newState: MelodyPlayer.State) {
        state = newState
        listeners.forEach { it.onStateChanged(newState) }
    }

    private fun dispatch(context: Context, action: String) {
        dispatchIntent(context, Intent(context, MelodyPlaybackService::class.java).setAction(action))
    }

    private fun dispatchIntent(context: Context, intent: Intent) {
        if (MelodyPlaybackService.dispatchIfRunning(intent)) return
        ContextCompat.startForegroundService(context, intent)
    }

    private const val PREFERENCES = "jclock-melodies"
    private const val KEY_VOLUME = "volume"
}
