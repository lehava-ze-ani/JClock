package ani.lehava.jclock.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.SafeBrowsingResponse
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class JClockWebActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var backButton: Button
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        val granted = hasLocationPermission()
        val origin = pendingGeoOrigin
        val callback = pendingGeoCallback
        pendingGeoOrigin = null
        pendingGeoCallback = null
        if (origin != null && callback != null) {
            callback.invoke(origin, granted, false)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        window.statusBarColor = Color.rgb(31, 52, 69)

        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
        }
        backButton = toolbarButton("חזרה") {
            if (webView.canGoBack()) webView.goBack() else finish()
        }

        configureWebView()
        setContentView(buildContent())

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        val restored = state != null && webView.restoreState(state) != null
        if (!restored) loadRequestedUrl(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadRequestedUrl(intent)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        pendingGeoCallback?.let { callback ->
            pendingGeoOrigin?.let { origin -> callback.invoke(origin, false, false) }
        }
        pendingGeoCallback = null
        pendingGeoOrigin = null
        webView.stopLoading()
        webView.removeAllViews()
        webView.destroy()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val isDebuggable = applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
        val versionName = packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
        WebView.setWebContentsDebuggingEnabled(isDebuggable)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            WebView.startSafeBrowsing(this) { }
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            mediaPlaybackRequiresUserGesture = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = "$userAgentString JClockAndroid/$versionName"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                handleNavigation(request.url)

            @Deprecated("Deprecated in Android")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean =
                handleNavigation(Uri.parse(url))

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                progress.visibility = View.VISIBLE
                updateNavigation()
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                updateNavigation()
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                updateNavigation()
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler,
                error: SslError?,
            ) {
                handler.cancel()
                toast("החיבור נחסם כי אישור האבטחה אינו תקין")
            }

            override fun onSafeBrowsingHit(
                view: WebView,
                request: WebResourceRequest,
                threatType: Int,
                callback: SafeBrowsingResponse,
            ) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                    callback.backToSafety(true)
                } else {
                    view.stopLoading()
                }
                toast("העמוד נחסם על ידי הגנת הגלישה הבטוחה")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback,
            ) {
                if (!isTrustedOrigin(origin)) {
                    callback.invoke(origin, false, false)
                    return
                }
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }

                pendingGeoCallback?.let { previous ->
                    pendingGeoOrigin?.let { previousOrigin ->
                        previous.invoke(previousOrigin, false, false)
                    }
                }
                pendingGeoOrigin = origin
                pendingGeoCallback = callback
                locationPermission.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                )
            }

            override fun onGeolocationPermissionsHidePrompt() {
                pendingGeoCallback = null
                pendingGeoOrigin = null
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                request.deny()
            }
        }
    }

    private fun buildContent(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(Color.WHITE)
        }
        root.addView(buildToolbar())
        root.addView(
            progress,
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)),
        )
        root.addView(
            webView,
            LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f),
        )
        return root
    }

    private fun buildToolbar(): View = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(6), dp(4), dp(6), dp(4))
        setBackgroundColor(Color.rgb(31, 52, 69))

        addView(backButton)
        addView(toolbarButton("בית") { webView.loadUrl(HOME_URL) })
        addView(ImageView(this@JClockWebActivity).apply {
            setImageResource(R.drawable.hebrew_clock_logo_big)
            contentDescription = "JClock"
            scaleType = ImageView.ScaleType.CENTER_CROP
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        addView(toolbarButton("רענן") { webView.reload() })
        addView(toolbarButton("הגדרות") {
            startActivity(Intent(this@JClockWebActivity, MainActivity::class.java))
        })
    }

    private fun toolbarButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        textSize = 12f
        isAllCaps = false
        minWidth = 0
        minimumWidth = 0
        setPadding(dp(7), 0, dp(7), 0)
        setOnClickListener { action() }
    }

    private fun loadRequestedUrl(source: Intent) {
        val requested = source.getStringExtra(EXTRA_URL)?.let(Uri::parse)
        val target = if (requested != null && isAllowedNavigation(requested)) {
            requested.toString()
        } else {
            HOME_URL
        }
        webView.loadUrl(target)
    }

    private fun handleNavigation(uri: Uri): Boolean {
        if (isAllowedNavigation(uri)) return false
        toast("הקישור החיצוני נחסם ונשארת בתוך JClock")
        return true
    }

    private fun isAllowedNavigation(uri: Uri): Boolean {
        if (uri.toString() == "about:blank") return true
        return uri.scheme.equals("https", ignoreCase = true) && isTrustedHost(uri.host)
    }

    private fun isTrustedOrigin(origin: String): Boolean {
        val uri = runCatching { Uri.parse(origin) }.getOrNull() ?: return false
        return uri.scheme.equals("https", ignoreCase = true) && isTrustedHost(uri.host)
    }

    private fun isTrustedHost(host: String?): Boolean = host?.lowercase() in TRUSTED_HOSTS

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun updateNavigation() {
        backButton.isEnabled = webView.canGoBack()
        backButton.alpha = if (backButton.isEnabled) 1f else 0.55f
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val HOME_URL = "https://jclock.net/"
        private const val EXTRA_URL = "ani.lehava.jclock.extra.URL"
        private val TRUSTED_HOSTS = setOf(
            "jclock.net",
            "www.jclock.net",
        )

        fun intent(context: Context, url: String = HOME_URL): Intent =
            Intent(context, JClockWebActivity::class.java).putExtra(EXTRA_URL, url)
    }
}
