# VidyaSetu — Android app (Capacitor)

The Android app is a **Capacitor** wrapper around the existing Angular PWA. It
loads the live hosted site (`https://vidyasetu-d0ee7.web.app`), so **content
updates instantly on every `firebase deploy`** — you only rebuild the APK for
native changes (icon, plugins, app id…).

- App name: **VidyaSetu**  ·  App ID: **com.vidyasetu.app**
- Native project: [`android/`](android/) · config: [`capacitor.config.ts`](capacitor.config.ts)

## Install the test build (debug APK)
A ready debug APK is produced at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```
Copy it to an Android phone → tap to install (allow "install from unknown
sources"). It opens the full VidyaSetu app.

## Build it yourself
Prereqs (already on this machine): **Android Studio + SDK** and a JDK.

```bash
# 1) refresh the wrapped web build + native project
npm run android:sync

# 2a) build a debug APK from the command line
cd android && ./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk

# 2b) …or open in Android Studio (recommended for release)
npm run android:open                       # Build ▸ Build APK / Run on device
```
> If Gradle complains about `JAVA_HOME`, point it at Android Studio's JDK:
> `JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"`.

## App icon / splash
Source images live in [`resources/`](resources/) (`icon.png`, `splash.png`).
Regenerate all densities after changing them:
```bash
npm run android:icons
```

## Releasing to the Play Store (signed AAB)
1. In Android Studio: **Build ▸ Generate Signed Bundle / APK ▸ Android App Bundle**.
2. Create a **keystore** (keep it safe — you need the same one for every update).
3. Upload the `.aab` to the Play Console.

## ⚠️ Known limitation — Google sign-in
Google blocks its OAuth flow inside an embedded WebView, so the **"Sign in with
Google"** button (used by the **super admin** and **Head Masters**) will **not**
work inside the app yet. **Email/password login works** — so teachers, parents
and students are fully covered today.

To enable native Google sign-in for Head Masters, add
`@capacitor-firebase/authentication` (native Google Sign-In + Firebase),
register the app's SHA-1 in the Firebase console, and drop in `google-services.json`.
That's the recommended next step.

## Roadmap (native upgrades)
- Native Google sign-in (above).
- **Push notifications** via `@capacitor/push-notifications` + FCM — instant
  absence/fee alerts to parents (a big selling point).
- Camera for student photos, biometric unlock, native share of receipts/report cards.
