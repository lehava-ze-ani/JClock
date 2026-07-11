plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "ani.lehava.jclock.mobile"
    compileSdk = 35
    defaultConfig { applicationId = "ani.lehava.jclock"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "1.0" }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
}
