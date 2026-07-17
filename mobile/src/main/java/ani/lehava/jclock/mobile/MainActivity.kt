package ani.lehava.jclock.mobile

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import ani.lehava.jclock.mobile.music.MelodyPlaybackController
import ani.lehava.jclock.mobile.music.MelodyPlayer
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    private var contentRoot: View? = null
    private var enableMobileAfterPermission = false
    private val permission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val allowed = PhoneLocationRepository.hasLocationPermission(this)
        val shouldEnable = enableMobileAfterPermission
        enableMobileAfterPermission = false
        if (shouldEnable && allowed) {
            PhoneLocationRepository.setMobileLocationEnabled(this, true)
            MobileLocationService.start(this)
        } else if (!allowed && PhoneLocationRepository.isMobileLocationEnabled(this)) {
            PhoneLocationRepository.setMobileLocationEnabled(this, false)
            MobileLocationService.stop(this)
        } else if (allowed && PhoneLocationRepository.isMobileLocationEnabled(this)) {
            MobileLocationService.start(this)
        }
        render()
    }
    private val pickAudio = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@registerForActivityResult
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        MelodyPlaybackController.playLocal(this, uri, displayName(uri))
    }

    private var musicStatusView: TextView? = null
    private var musicToggleButton: Button? = null
    private val musicListener = MelodyPlaybackController.Listener { state ->
        runOnUiThread { showMusicState(state) }
    }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val requested = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requested += Manifest.permission.POST_NOTIFICATIONS
        }
        permission.launch(requested.toTypedArray())
        ContextCompat.startForegroundService(this, Intent(this, ZeppLoopbackService::class.java))
        MelodyPlaybackController.prepare(this)
        render()
    }

    override fun onStart() {
        super.onStart()
        if (
            PhoneLocationRepository.isMobileLocationEnabled(this) &&
            PhoneLocationRepository.hasLocationPermission(this)
        ) {
            MobileLocationService.start(this)
        }
        MelodyPlaybackController.addListener(musicListener)
    }

    override fun onStop() {
        MelodyPlaybackController.removeListener(musicListener)
        super.onStop()
    }

    private fun birthUrl(): String {
        val now = ZonedDateTime.now()
        return Uri.parse("https://jclock.net/BirthCalculator/public/he/index.html").buildUpon()
            .appendQueryParameter("date", now.format(DateTimeFormatter.ISO_LOCAL_DATE))
            .appendQueryParameter("time", now.format(DateTimeFormatter.ofPattern("HH:mm")))
            .appendQueryParameter("timeZone", now.zone.id)
            .appendQueryParameter("auto", "1")
            .build().toString()
    }

    private fun render() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(28), dp(36), dp(28), dp(36))
        }
        layout.addView(TextView(this).apply {
            text = "JClock"
            textSize = 28f
            gravity = Gravity.CENTER
        })
        layout.addView(TextView(this).apply {
            text = "הטלפון מקבל את השעה מן השעון, מפעיל את המנגינות ומעביר את קישורי הלימוד."
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(18))
        })

        addLocationSection(layout)
        addMusicSection(layout)
        addUmidSection(layout)
        layout.addView(Switch(this).apply {
            text = "השאר את מסך השעון דולק"
            textSize = 17f
            isChecked = getSharedPreferences(PREFERENCES, MODE_PRIVATE).getBoolean(KEY_KEEP_WATCH_SCREEN_ON, false)
            setOnCheckedChangeListener { _, enabled ->
                getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
                    .putBoolean(KEY_KEEP_WATCH_SCREEN_ON, enabled).apply()
            }
        })
        addLegalSection(layout)

        layout.addView(Button(this).apply {
            text = "פתח יחידת לימוד"
            isAllCaps = false
            setOnClickListener {
                startActivity(JClockWebActivity.intent(this@MainActivity, birthUrl()))
            }
        })
        layout.addView(Button(this).apply {
            text = "שתף קישור ב־WhatsApp"
            isAllCaps = false
            setOnClickListener {
                val share = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, birthUrl())
                    setPackage("com.whatsapp")
                }
                runCatching { startActivity(share) }.getOrElse {
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, birthUrl())
                    }, "שיתוף הקישור"))
                }
            }
        })
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(layout)
        }
        contentRoot = scroll
        applyUmidTheme(scroll)
        setContentView(scroll)
        showMusicState(MelodyPlaybackController.state)
    }

    private fun addLocationSection(parent: LinearLayout) {
        parent.addView(sectionTitle("מיקום השעון"))
        val mobileEnabled = PhoneLocationRepository.isMobileLocationEnabled(this)
        val locationAllowed = PhoneLocationRepository.hasLocationPermission(this)
        parent.addView(Switch(this).apply {
            text = "מיקום נייד"
            textSize = 17f
            isChecked = mobileEnabled
            setOnCheckedChangeListener { _, enabled ->
                if (!enabled) {
                    enableMobileAfterPermission = false
                    PhoneLocationRepository.setMobileLocationEnabled(this@MainActivity, false)
                    MobileLocationService.stop(this@MainActivity)
                    render()
                } else if (PhoneLocationRepository.hasLocationPermission(this@MainActivity)) {
                    PhoneLocationRepository.setMobileLocationEnabled(this@MainActivity, true)
                    MobileLocationService.start(this@MainActivity)
                    render()
                } else {
                    enableMobileAfterPermission = true
                    permission.launch(locationPermissions())
                }
            }
        })
        parent.addView(TextView(this).apply {
            text = "במיקום קבוע, לחיצה על „מקומי” בשעון שומרת את מיקום הטלפון. " +
                "מיקום נייד מעדכן את החישוב לפי הטלפון כל 6 שניות."
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(6))
        })
        parent.addView(TextView(this).apply {
            text = when {
                mobileEnabled && locationAllowed -> "מיקום נייד פעיל"
                mobileEnabled -> "יש לאשר הרשאת מיקום כדי להפעיל מיקום נייד"
                else -> "מיקום קבוע · המיקום נקלט רק בלחיצה על „מקומי” בשעון"
            }
            textSize = 13f
            gravity = Gravity.CENTER
        })
    }

    private fun addMusicSection(parent: LinearLayout) {
        parent.addView(sectionTitle("מנגינות החודש"))
        musicStatusView = TextView(this).apply {
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(8))
        }.also { parent.addView(it) }

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        musicToggleButton = Button(this).apply {
            isAllCaps = false
            setOnClickListener { MelodyPlaybackController.toggle(this@MainActivity) }
        }.also { controls.addView(it, weighted()) }
        controls.addView(Button(this).apply {
            text = "דלג"
            isAllCaps = false
            setOnClickListener { MelodyPlaybackController.skip(this@MainActivity) }
        }, weighted())
        controls.addView(Button(this).apply {
            text = "קובץ מקומי"
            isAllCaps = false
            setOnClickListener { pickAudio.launch(arrayOf("audio/*")) }
        }, weighted())
        parent.addView(controls)

        parent.addView(TextView(this).apply {
            text = "עוצמה"
            textSize = 13f
        })
        parent.addView(SeekBar(this).apply {
            max = 100
            progress = MelodyPlaybackController.savedVolume(this@MainActivity)
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = Unit
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    MelodyPlaybackController.setVolume(this@MainActivity, seekBar?.progress ?: 70)
                }
            })
        })
    }

    private fun addUmidSection(parent: LinearLayout) {
        parent.addView(sectionTitle("האזור האישי · UMID"))
        parent.addView(TextView(this).apply {
            text = "UMID הוא מזהה של ארבעת צבעי הזמן האישיים — לא מזהה מכשיר. המבנה: שעת לבנה, יום לבנה, שעת חמה, יום חמה."
            textSize = 14f
            gravity = Gravity.CENTER
        })

        val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
        val input = EditText(this).apply {
            hint = "24 תווי HEX, לדוגמה A1B2C3…"
            isSingleLine = true
            textDirection = View.TEXT_DIRECTION_LTR
            filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(24))
            setText(preferences.getString(KEY_UMID, ""))
        }
        parent.addView(input)
        val validation = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 13f
        }
        parent.addView(validation)

        val swatchRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        val labels = listOf("שעת לבנה", "יום לבנה", "שעת חמה", "יום חמה")
        val swatches = labels.map { label ->
            TextView(this).apply {
                tag = UMID_SWATCH_TAG
                text = label
                gravity = Gravity.CENTER
                setPadding(dp(3), dp(12), dp(3), dp(12))
                swatchRow.addView(this, weighted())
            }
        }
        parent.addView(swatchRow)

        fun updateUmid(raw: String) {
            val normalized = raw.trim().uppercase()
            preferences.edit().putString(KEY_UMID, normalized).apply()
            val valid = UMID_PATTERN.matches(normalized)
            validation.text = if (valid) "UMID תקין" else "נדרשים בדיוק 24 תווי HEX ‏(0–9, A–F)"
            validation.setTextColor(if (valid) Color.rgb(29, 116, 62) else Color.rgb(180, 42, 42))
            swatches.forEachIndexed { index, view ->
                val hex = if (valid) normalized.substring(index * 6, index * 6 + 6) else "D4D4D4"
                val color = Color.parseColor("#$hex")
                val label = labels[index]
                view.text = if (valid) "$label\n#$hex" else label
                view.setBackgroundColor(color)
                view.setTextColor(contrastColor(color))
            }
            if (valid) applyUmidTheme(contentRoot ?: parent)
        }
        input.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
                updateUmid(text?.toString().orEmpty())
            }
            override fun afterTextChanged(text: Editable?) = Unit
        })
        updateUmid(input.text.toString())

        parent.addView(Button(this).apply {
            text = "חשב והעתק UMID ב־BirthCalculator"
            isAllCaps = false
            setOnClickListener {
                startActivity(
                    JClockWebActivity.intent(
                        this@MainActivity,
                        "https://jclock.net/BirthCalculator/public/he/index.html",
                    ),
                )
            }
        })
    }

    private fun addLegalSection(parent: LinearLayout) {
        parent.addView(sectionTitle("רישיון וזכויות"))
        parent.addView(TextView(this).apply {
            text = "המחבר והמפתח המתועד של JClock הוא נפתלי ביליג. " +
                "זכויות יוצרים בקוד נפרדות משאלת הפטנט; הודעות צד שלישי נשמרות במלואן."
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(7))
        })
        parent.addView(Button(this).apply {
            text = "הצג רישיון והודעת זכויות"
            isAllCaps = false
            setOnClickListener { showLegalNotice() }
        })
    }

    private fun showLegalNotice() {
        val notice = runCatching {
            assets.open("legal/legal_notice_he.txt").bufferedReader(Charsets.UTF_8).use { it.readText() }
        }.getOrElse {
            "הודעת הרישיון אינה זמינה בחבילה זו."
        }
        val content = TextView(this).apply {
            text = notice
            textSize = 14f
            textDirection = View.TEXT_DIRECTION_RTL
            gravity = Gravity.START
            setTextIsSelectable(true)
            setPadding(dp(22), dp(12), dp(22), dp(12))
        }
        AlertDialog.Builder(this)
            .setTitle("JClock · רישיון וזכויות")
            .setView(ScrollView(this).apply { addView(content) })
            .setPositiveButton("סגור", null)
            .show()
    }

    private fun showMusicState(state: MelodyPlayer.State) {
        musicToggleButton?.text = if (MelodyPlaybackController.isPlaybackRequested) "השהה" else "נגן"
        musicStatusView?.text = when (state) {
            MelodyPlayer.State.Idle -> "מוכן"
            MelodyPlayer.State.LoadingCatalog -> "בודק את מנגינות החודש…"
            is MelodyPlayer.State.Downloading -> "מתחבר לניגון: ${state.name}"
            is MelodyPlayer.State.Playing -> "${state.name} · ${state.folder}"
            MelodyPlayer.State.Paused -> "מושהה"
            is MelodyPlayer.State.Error -> "שגיאה: ${state.message}"
            MelodyPlayer.State.Closed -> "הופסק"
        }
    }

    private fun displayName(uri: Uri): String =
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        } ?: uri.lastPathSegment ?: "קובץ מקומי"

    private fun sectionTitle(text: String) = TextView(this).apply {
        this.text = text
        textSize = 20f
        gravity = Gravity.CENTER
        setPadding(0, dp(18), 0, dp(7))
    }

    private fun weighted() = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

    private fun contrastColor(color: Int): Int {
        val brightness = (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114) / 1000
        return if (brightness >= 145) Color.BLACK else Color.WHITE
    }

    private fun applyUmidTheme(root: View) {
        val umid = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
            .getString(KEY_UMID, "")?.trim()?.uppercase().orEmpty()
        if (!UMID_PATTERN.matches(umid)) return

        val generalText = Color.parseColor("#${umid.substring(0, 6)}")
        val generalBackground = Color.parseColor("#${umid.substring(6, 12)}")
        val buttonText = Color.parseColor("#${umid.substring(12, 18)}")
        val buttonBackground = Color.parseColor("#${umid.substring(18, 24)}")

        fun style(view: View) {
            if (view.tag == UMID_SWATCH_TAG) return
            view.setBackgroundColor(generalBackground)
            when (view) {
                is Button -> {
                    view.setBackgroundColor(buttonBackground)
                    view.setTextColor(buttonText)
                }
                is TextView -> view.setTextColor(generalText)
            }
            if (view is android.view.ViewGroup) {
                for (index in 0 until view.childCount) style(view.getChildAt(index))
            }
        }
        style(root)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun locationPermissions(): Array<String> = arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    companion object {
        private const val PREFERENCES = "jclock-personal"
        private const val KEY_UMID = "umid"
        private const val KEY_KEEP_WATCH_SCREEN_ON = "keep_watch_screen_on"
        private val UMID_PATTERN = Regex("[0-9A-F]{24}")
        private const val UMID_SWATCH_TAG = "umid-swatch"
    }
}
