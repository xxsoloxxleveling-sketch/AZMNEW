# AZM.AIO ExamScan v1.1 — Integration and verification report

**Review date:** 14 November 2026 (Asia/Karachi)

## Actual backend interface cross-check

Reviewed `xxsoloxxleveling-sketch/AZMNEW` backend source for `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `attendance.routes.ts`, `attendance.schema.ts`, `attendance.controller.ts`, `attendance.service.ts` and `students.service.ts`.

| Feature | API used by app | Expected backend behavior |
| --- | --- | --- |
| Staff login | `POST /api/auth/login` | Email/password -> access JWT, refresh JWT, user |
| Validate identity | `GET /api/auth/me` | Bearer, active user/token version and role |
| Refresh | `POST /api/auth/refresh` | Refresh token rotation response |
| Hall sessions | `GET /api/attendance/sessions?page=N&limit=100` | Current/historical actual attempts and per-session stats |
| Selected Hall | `GET /api/attendance/sessions/{id}` | Exact attempt `id`, `revision`, `status`, `isCurrent`, roster/stats |
| Roster page | `GET /api/attendance/sessions/{id}/candidates?page=N&limit=40&search=...` | Server-side filtered/paged roster; current mark states |
| QR mark | `POST /api/attendance/scan` | `{sessionId,revision,qrToken,status:'PRESENT'}`; new 201 vs already-marked 200 |
| Manual PRESENT | `POST /api/attendance/sessions/{id}/mark` | `{revision,studentId,status:'PRESENT'}`; stores MANUAL |
| Close Hall | `POST /api/attendance/sessions/{id}/close` | `{markRemainingAbsent:boolean}`; ADMIN/SUPER_ADMIN only |
| Health | `GET /api/health` | Public status and DB connectivity |

**Important discovery fixed:** Actual issued roll-slip QR payload is `https://azmaio.com/attend?token=${qrToken}` (source: `backend/src/modules/students/students.service.ts`). The first ExamScan source accepted only raw `qr_` strings. v1.1 now extracts `token` only from this recognized HTTPS AZM attendance link, or accepts a raw signed token for compatibility. The server remains the sole authority to verify the HMAC and mark attendance. Unsigned or off-origin QR links are rejected before sending requests.

## Read-only checks against the published endpoint

- `https://azmaio.com/api/health`: HTTP 200, `status:ok`, database connected.
- `https://azmaio.com/api/auth/me` without a token: HTTP 401.
- `https://azmaio.com/api/attendance/sessions` without a token: HTTP 401.

These checks used only public/read-only endpoints; **no production login, attendance write, migration or configuration changes** occurred.

## Automated execution (synthetic only)

- Node test suite: **21/21 passed**. Covers signed QR shape, official URL parsing and spoofing rejection, auth, role enforcement, scan payload, session revision, duplicates, access refresh, uncertain write non-retry, Google camera scanner options, module preflight/cancellation, and actual HTTP transport to a disposable in-memory mock server.
- Chromium browser simulation of web PWA: **Teacher and Admin workflows passed** (sign-in, OPEN Hall, QR decoded URL, server-confirmed marking, roster, manual marking, role-restricted close).
- Chromium browser simulation of native Google scanner bridge: **Teacher and Admin workflows passed** (native camera dispatch, decoded URL, authenticated mark, duplicate response, roster, role-restricted close). The Google module was **simulated**, not run on an Android device.
- Production web build: `npm run build` copies the static app and assets to `dist`. No student data, test credentials or live records are bundled.

## Google scanner implementation

The Android entry uses `@capacitor-mlkit/barcode-scanning` 8.2.2 with `BarcodeScanner.scan({formats:[BarcodeFormat.QrCode],autoZoom:true})`. Plugin and Capacitor versions are pinned. The native build script bundles `native/scanner-entry.js`, creates/syncs the Android project, configures Google Play Services module prefetch with `barcode_ui`, and a GitHub Actions workflow can compile a debug APK.

## Remaining before examination-floor use

- Build a real APK using Android SDK/Gradle and verify on a physical Android phone with Google Play Services.
- Authenticate real permitted staff only in a dedicated authorized **staging** system first; verify the deployed endpoint matches source-reviewed behavior.
- Generate a signed synthetic roll slip from the staging backend and test success, duplicate, wrong Hall, stale revision, closed Hall, network loss, Google module download, activity/background behavior and token expiry.
- Obtain independent permission for a production release; signed APK, IT/device management, and audit review are separate gates.

**Verdict:** App is implemented and its API calls are source-reviewed and synthetically tested; live authenticated attendance and physical Google camera behavior are *not* yet certified. No APK artifact is included because Android SDK and physical-device validation were unavailable during this session.
