# AZM.AIO OMR mobile

Capacitor 8 / React 19 / TypeScript, sharing the application's OMR transport, camera, upload and review components. It calls the existing AZM backend; it does not contain another student service.

```powershell
npm ci --ignore-scripts --legacy-peer-deps
npm run build
npx cap sync
npx cap open android
```

Set `VITE_OMR_API_URL` before building to select an HTTPS API origin. The development default is loopback `http://127.0.0.1:5055`; Android emulator can use `http://10.0.2.2:5055` only with a reachable authorized local backend. A physical device needs a reachable HTTPS development origin. Configure the backend CORS list explicitly for the approved app origin (`https://localhost` Android; `capacitor://localhost` iOS). Use synthetic accounts from `tools/omr-dev/README.md` for validation.

Android sources include camera permission, optional camera hardware, disabled backups, HTTPS by default and screenshot/recent-preview protection. Cleartext exceptions are restricted to development loopback/emulator hosts. Install Java 21 and Android SDK 36, configure `ANDROID_HOME`/`JAVA_HOME`, then run `android/gradlew.bat -p android assembleDebug` on Windows, or `./android/gradlew -p android assembleDebug` on Linux/macOS. The expected output path is `android/app/build/outputs/apk/debug/app-debug.apk`; **the local Windows build is blocked** because Java/Android tooling is unavailable. Hosted CI successfully built a development APK using Java 21 / SDK 36; its verified download is at `../../tmp/omr-dev/release/azm-omr-development.apk` in the current worktree. See the validation report for its checksum. No device installation/test is claimed.

The generated iOS Swift Package Manager project includes the camera usage description and an app-switcher privacy cover. Build it with the Capacitor-supported Xcode/Apple toolchain on macOS. iOS sources are prepared; no Xcode build or device test has been performed.

Access and refresh tokens remain in memory, refresh requests are serialized, logout aborts outstanding work and late refreshes cannot restore a session. Images remain in memory until upload or navigation. No service worker, IndexedDB, localStorage, sessionStorage or filesystem image cache is used by the mobile app. Browser/webview camera buffers are cleared on stop. Offline capture/storage are disabled. This trades persistent login/offline scanning for a smaller privacy surface until protected OS storage is validated.

Tests exercise a browser with a fake camera; that is not an Android/iOS device or physical-sheet accuracy test. Native permission behavior, app suspension, memory pressure, camera orientation and actual release APK behavior remain release gates. Launcher artwork is generated scaffold artwork and should be replaced with approved branding before distribution.
