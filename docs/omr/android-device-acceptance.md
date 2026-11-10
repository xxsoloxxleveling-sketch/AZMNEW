# Physical Android device acceptance — 2026-11-10

Continues the completed reliability milestone on `codex/smart-omr-evaluation-mobile`, draft PR #28. This milestone prepares and measures physical-device testing; browser mocks/API tests are separate evidence. There is currently no attached authorized Android device. No camera permission/capture/upload success is claimed from the earlier installation/USB readiness check.

## Verified installation target

Use only `tmp/omr-dev/release/azm-omr-reliability-965c4ff.apk` (4,203,204 bytes), SHA-256 `0c92215362bd2966589036459f100e0679c5a66616b3ef2fbede948dbdae3095`. It contains executable source tested at local `fb30f63` / review `965c4ff`, source tree `707d057b97b0c6d861505c622f2d760915425527`. The acceptance tools do not change the APK or production application. Local preflight and installed-package hash checks refuse a different build.

The earlier SM-X710 / Android 16 connection proved installation/hash, active app screen and USB forwarding readiness only. No captured physical sheet was observed end to end. Recheck the actual attached device for every acceptance session.

## Isolated environment

`device-acceptance.ts` starts the existing PGlite in-memory development backend, applies the existing migrations and uses the restricted `azm_app_dml` role. It ignores externally supplied database URLs, clears cloud/official activation settings and binds the API to `127.0.0.1` only. It refuses production mode, non-synthetic students/keys, official activation and published results. No actual students, real keys or production services are imported.

Each session has a random ID and private nonce. The connection tool requires a matching nonce-protected local attestation, verifies the installed APK, and configures USB reverse forwarding. While the diagnostic observer runs, WebView request interception permits the app origin and the attested local API only; external destinations are blocked. Do not configure the app with Oracle/production URLs. Restart the app and begin a new attested session if the observer disconnects.

All acceptance API calls also require the session-specific transport header, injected privately by the observer. The published synthetic password alone cannot access the session's private scans. The nonce is never printed, included in events or committed. This guard exists only in the disposable launcher; production API behavior is unchanged. The connection observer must be running before signing in.

The database is disposable; scans and evidence persist under ignored `tmp/omr-reference/device-acceptance/<session-id>/`. A five-second snapshot preserves exact originals, immutable revision records, original scanner observations, correction/result audits and private diagnostics before shutdown. Stop with Ctrl+C to take a final snapshot and destroy the database. This is not a production backup/restore feature. A force-killed process can lose unsnapshotted transient metadata; original uploads already written to the private directory are retained.

## Exact Windows setup

1. Verify the APK above. On the Android device, enable Developer options and USB debugging. Connect a USB **data** cable, unlock the device, and accept its debugging authorization prompt. Never silently grant camera permission with ADB; exercise the app's own permission flow.
2. Start the disposable environment in PowerShell and leave it running:

   ```powershell
   & 'C:\Users\hisha\.codex\worktrees\smart-omr-evaluation-mobile\Azm\tools\omr-dev\device-test.ps1'
   ```

3. In a second PowerShell window, install the verified APK and connect its observer:

   ```powershell
   & 'C:\Users\hisha\.codex\worktrees\smart-omr-evaluation-mobile\Azm\tools\omr-dev\device-test.ps1' -Connect -Install
   ```

   If the correct APK is already installed, omit `-Install`. The tool restarts the test app to clear previous in-memory server settings/login; finish saving any pending capture first. `-Probe` is read-only readiness checking and never constitutes a physical test. Exactly one authorized USB device is required. The SDK tool is the official Google platform-tools download already retained in `tmp/omr-dev/android-tools/platform-tools/`; `OMR_ADB` can identify another approved local adb executable. No wireless ADB connection is selected automatically.

4. In the app enter API server `http://127.0.0.1:5055`, email `admin@omr.test`, password `Synthetic-Omr-Only-2026!`. Select **Synthetic OMR development examination**. Keep USB and both PowerShell windows connected/running. This address works on the device because `adb reverse tcp:5055 tcp:5055` maps it to the computer; `10.0.2.2` is not the physical-device address.
5. Tap Scan sheet → Open camera, respond to Android's permission dialog, frame the entire sheet and all four corner marks with margins, focus and capture. Inspect the preview, upload, wait for terminal processing, then open evaluation evidence.

The connection script verifies the package with `adb shell pm path --user 0 com.azmaio.omr` and its installed APK checksum. If the APK signature differs from a previously installed development build, installation may require manually uninstalling that test app first; do not delete app data automatically. No production app is replaced by these tools. USB/permission setup follows the [official Android ADB documentation](https://developer.android.com/tools/adb).

## Test data and fresh retakes

Start the complete grading workflow using a **fabricated** printed sheet: `tmp/omr-dev/synthetic-device-acceptance.png`, generated by the local harness test. It contains synthetic identity, 100 A responses, deliberately missing QR and a gray A-version mark to exercise review. Print at A4, keep all registration marks and page margins, and photograph the actual printed page. This is a synthetic printed fixture, not independent validation of handwritten real exam answers. The seeded key is synthetic Class 6/A with 100 A answers.

For that fabricated sheet only, an authorized admin can confirm lookup `SYNTHETIC-APP-0001`, printed roll `SYNTHETIC-OMR-0001`, examination and visible version A with an explicit test reason. Verify a private 100/100 DRAFT, retained corrections and original uncertain version, and refusal of public publication. Do not enter a synthetic roll against a real student's printed identity just to obtain a draft.

Use fresh full-resolution photographs of actual sheets for optical tests, retaining their real printed identity only in private evidence. They may correctly remain unidentified or ineligible under the fabricated roster and must not be assigned invented identities. No confidential supplied answer key is loaded into this acceptance session. Preserve real-key comparison outside the scanning UI.

Retake the physical sheets represented by S10/S14, S11 and S16/S17/S18/S24. Record an operator case note mapping the new Dxxx sample/source hash to `retakeOf: S10` etc. Preserve the previous photographs/frozen counts unchanged; never replace an old failed source with its retake. Send original camera files, not messaging-compressed copies. The worker accepts actual JPEG/PNG up to 20 MB and 20 megapixels, minimum side 600 pixels; prefer a clear 12 MP source over an oversized 48/108 MP file. Do not crop away corners to reduce file size. New retakes are a new dataset, not an unseen repeat of the earlier frozen experiment.

After a new sample is preserved, declare its retake case from the repository root (example D001 replacing S10):

```powershell
& 'C:\Users\hisha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools/omr-dev/device-retake.mjs D001 S10
```

The declaration refuses the old rejected source hash, preserves existing case notes and never validates answers or approves the scan. The original rejected images stay unchanged.

## Acceptance checklist

Mark each step PASS / FAIL / NOT RUN, with the session ID, Dxxx sample/source hash, device model/Android version and operator time. A result is not PASS merely because a control exists.

| Test | Evidence required / expected behavior |
|---|---|
| APK and backend | Verified installed APK hash; matching disposable nonce attestation; official scoring/publication false |
| Camera permission denied | Android denial produces useful error, no image/upload; record the permission error name |
| Camera permission allowed | Actual camera opens; measured track resolution/facing mode recorded |
| Sensor/frame capture | Measured saved-image width/height/bytes/hash and sensor-still or video-frame source; requested resolution alone is insufficient |
| Cancel/retake | Close during capture releases controls, late image discarded; new capture succeeds; chosen file clears |
| Rotation/background/resume | Correct original orientation; no stale image or unexpected capture; re-open/retry after resume |
| Offline/upload interruption | Upload refused or retained in-memory for retry, no silent lost image; reconnect/retry measured |
| Upload and preservation | Accepted HTTP 202, original source SHA matches stored bytes; originals remain separate from overlays/predictions |
| Processing | Terminal status, error code, upload HTTP duration and upload-to-processed duration; queued/failed is not success |
| QR | Original-resolution QR crop dimensions/decoder result where a verified pose exists; no guessed crop-to-sheet association |
| Identity | Valid synthetic QR/printed roster match or authorized explicit printed review; wrong roll/group/session refused |
| Version | Visible A/B/C/D checked; ambiguous remains unresolved until authorized review; no highest-score version choice |
| Answers | All 100 rows in order, unknown/multiple marks preserved; blinded labels checked separately |
| Private draft/audits | Matching synthetic key only, DRAFT retained with correction/version/identity audits and immutable raw evidence |
| Confidentiality/release | Teacher cannot fetch key/score; official scoring false; synthetic/public publication remains refused |
| Seven fresh retakes | New source hashes and case notes; success/failure recorded individually, old rejects unchanged |

## Diagnostics and independent labels

The USB observer records camera open/permission outcomes, actual video and saved-image resolution, source byte hash, upload duration/status, processing polling and review-row count. It never records access/refresh tokens, request headers, passwords, keys, decoded QR strings or image bodies. Device model/OS and a hashed device identifier are private. Device event records are HMAC-bound to the session. Original/QR crops and response records stay private; only anonymized aggregates belong in repository reports.

Physical-device metrics require both an actual verified USB-device attestation and a matching accepted-upload source hash in the disposable database. `source=mobile`, desktop browser emulation or a file merely appearing in the API never proves a phone capture. Report accepted upload attempts, matched terminal scans and mapped scans separately; failures stay in the terminal denominator. Camera provenance is separate from gallery/file selection. Pending jobs are excluded from terminal success rates. QR denominator is mapped scans, not every attempted photo.

`uploadToProcessedMs` includes queue wait and worker processing; it is not a pure CPU/worker benchmark. `UPLOAD_ACCEPTED.durationMs` measures the HTTP request. Camera source dimensions come from the captured blob and preserved original, not the normalized 1980×2800 page.

For blind review, give an unexposed reviewer only the originals and empty form:

```powershell
& 'C:\Users\hisha\.codex\worktrees\smart-omr-evaluation-mobile\Azm\workers\omr\.venv\Scripts\python.exe' tools/omr-dev/export-blind-review.py '<session-folder>\blind-originals' '<session-folder>\Blind_Review.html' --samples ALL
```

The command runs from the repository root. Return the per-sheet downloaded JSON privately to `<session-folder>\independent-labels`. Snapshot diagnostics reuse the existing human-label validator, require source hash and unexposed reviewer declarations and compute exact classification/false-acceptance denominators. Originals, predictions and labels are distinct files. Earlier comparisons against displayed predictions remain unblinded feedback. No labels means null accuracy, not zero errors or 100% correct. Correctness on a fabricated known-answer fixture is reported as fixture behavior, not independent physical accuracy.

## Current report and remaining failures

No physical Android camera acceptance pass has been observed in this milestone. Hardware scan success, QR rate and independently labeled accuracy therefore remain **not measured**. The prior 24-photo desktop/application checkpoint remains 17 mapped / seven rejected, 996 uncertain and 0/17 original QR decoded; it is not an Android acceptance rate.

The earlier temporary API session contained one FAILED scan (`WORKER_FAILED`, zero responses, no attached student/result). Its exact original, API review record and provenance were preserved privately under `tmp/omr-reference/device-acceptance/prior-session/` before shutdown. Source: 3096×4128, 7,535,841 bytes. A separate direct replay took 82.623 seconds and ended INVALID / registration_failed. This exceeds the API worker's 45-second deadline and is consistent with a timeout, but the original attempt has no detailed worker cause and earlier session database-connection errors also existed. Do not label it as a verified camera test or confidently assign its original failure to a single cause. No alignment threshold or timeout was relaxed to force success.

Fresh retakes, actual permission/camera/network/resume tests and independent human labels remain pending. The private session report and device readiness JSON are populated by the scripts; only actual attached-device evidence can change NOT RUN hardware status. No merge, deployment, official-key approval or actual student-result changes are authorized.
