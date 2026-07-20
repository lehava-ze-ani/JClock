plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "ani.lehava.jclock.wear"
    compileSdk = 35
    defaultConfig { applicationId = "ani.lehava.jclock"; minSdk = 30; targetSdk = 35; versionCode = 4; versionName = "1.3" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
}
