# ExamScan for Android — Google Code Scanner

**Buildable Capacitor Android project**, using the official **Google Code Scanner UI inside Google Play services**, with QR-only decoding and `autoZoom: true`. This does **not** launch the separate Google Camera photography app. No photo, scan, or private key is uploaded to Google; a decoded URL is processed locally and the signed token is sent to the authenticated AZM.AIO backend.

## Requirements

- Android device with Google Play Services (Google Code Scanner); Android API level 23+.
- Node.js 24 (or supported recent LTS), Java 21 JDK, Android Studio + installed Android SDK/platform/build-tools, and internet access for the Google scanner module's first download.
- In `config.js`, `apiOrigin` must be an HTTPS AZM.AIO backend origin. The current source is set to `https://azmaio.com`, whose **public** `/api/health` endpoint was checked on 14 November 2026. This does not certify authenticated requests or live marking.
- A staff login authorized by the existing AZM.AIO backend (`TEACHER`, `ADMIN`, `SUPER_ADMIN`).

## Build

From the `AZM_ExamScan` source directory:

```bash
npm install
npm test
npm run android:prepare
npm run android:apk
```

`android:prepare` bundles the Google scanner bridge with esbuild, builds `dist`, creates the Capacitor Android project on first run, syncs native plugins and enables `barcode_ui` module prefetch in `AndroidManifest.xml`. All dependencies are pinned to the versions in `package.json`.

**Debug APK (if the SDK/Gradle build passes):**

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

To use Android Studio, run `npx cap open android` after `npm run android:prepare`. Install the debug APK on a supervised test device. Do not distribute a debug APK as a signed production release.

## How it works

1. Staff signs in through real `POST /api/auth/login`, validates role with `GET /api/auth/me` and selects a current OPEN session from `GET /api/attendance/sessions`.
2. The app preflights Google's scanner module after session selection. The first install may need data/Internet; Play Services supplies the ready-made camera UI and handles auto-focus/zoom. The plugin's `BarcodeScanner.scan({ formats: ['QR_CODE'], autoZoom: true })` is used; the app does not use the in-browser camera on Android.
3. The QR on a real roll slip is **`https://azmaio.com/attend?token=qr_...`**, as produced by `backend/src/modules/students/students.service.ts`. The app accepts only that HTTPS host/path with exactly one `token`, or a raw signed token for older compatible slips.
4. The app forwards **only the opaque signed token** to `POST /api/attendance/scan` with `{sessionId, revision, status:'PRESENT'}` and a staff JWT bearer token.
5. The backend checks HMAC, student identity, frozen Hall roster membership, OPEN/current attempt, revision, and duplicates. No success is shown until the returned attendance/student records confirm it. Google camera decoding by itself never marks a student.

Google code scanning through Play Services does not need the app's own camera permission for the `scan()` method. The Capawesome plugin also exposes other camera APIs that *do* require camera permission; this app deliberately uses only the Google ready-made scanner.

`CapacitorHttp.enabled=true` in `capacitor.config.json` enables Capacitor's native fetch bridge, avoiding browser CORS restrictions for a separately installed WebView. It is not an authorization bypass. The backend's JWT and role checks still apply. Only HTTPS API endpoints are allowed by `api.js`.

## Release checks (must be completed before live examination use)

- Build the APK with the Android SDK, and install it on at least one real Google Play Services device. This environment has not performed an actual APK build or physical-device test.
- Authenticate dedicated active staging Teacher/Admin accounts, including token refresh, timeout and revoked-account behavior.
- Scan an **issued synthetic staging roll-slip** (full attendance URL) under a **synthetic OPEN Hall**: confirm a new HTTP 201, duplicate HTTP 200 with `alreadyMarked:true`, invalid signature, wrong roster, and CLOSED/archived attempts.
- Test app background/restore, Google module downloading, Google camera cancel, loss of mobile data, auto-zoom on a dense printed QR, screen lock, and accessibility.
- Audit dependency versions, Android merged manifest, signing, Play Protect, and any enterprise mobile-device management settings.
- Production writes and live roll-slip testing need separate organizational authorization.

## Automated build on GitHub

The package includes `.github/workflows/examscan-android.yml`. In a dedicated source repository, this workflow can compile a **debug** APK in GitHub Actions without installing Android Studio locally. An Android device is still required to verify actual Google camera performance. No workflow in this package pushes to AZM.AIO's `main`/`deploy` branches or runs against production.
