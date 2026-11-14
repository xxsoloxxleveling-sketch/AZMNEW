# ExamScan — AZM.AIO Examination Attendance

A mobile-first attendance app based on the four supplied **Google Stitch Proctor Cadence** screens. Android uses the native **Google Code Scanner** (Google Play services, QR-only with auto-zoom); the PWA uses the browser camera. Both speak the actual AZM.AIO authentication and attendance API.

> **Status (14 Nov 2026):** Source app, static web build, synthetic HTTP integration/unit tests and browser simulations are completed. The verified public AZM.AIO backend health check responded successfully. This package is **not** an APK and authenticated production marking has **not** been tested. Before live attendance, an authorized operator must configure the real backend, use a dedicated staging account, verify Android camera on a physical device, and approve release.

## Features

- Staff email/password sign-in with AZM.AIO, JWT Bearer authorization, automatic access-token refresh on HTTP 401, and role validation with `/api/auth/me`.
- Browse actual examination sessions (pagination), view live roster and counts, select a specific immutable Hall attempt.
- Scan a real AZM.AIO **attendance URL QR** (`https://azmaio.com/attend?token=qr_...`) through Google Code Scanner on native Android, or `BarcodeDetector` on supported HTTPS browsers; only its signed token is forwarded to the server.
- **Only the backend marks attendance.** New scan: HTTP 201; already-marked scan: HTTP 200 with `alreadyMarked:true`; invalid/stale/closed/outside-roster scans are rejected.
- Manual PRESENT from a selected roster candidate (requires explicit confirmation); recorded with `MANUAL`, not falsely labeled QR.
- Administrator-only session closing with explicit typed confirmation; optionally mark remaining absent. Teachers cannot close.
- Server-side roster search and pagination, truthful statistics, separate duplicate/error UI, sound/haptics, camera torch where supported, and visible-page CSV export.
- Private bearer tokens **in memory only**, no offline attendance submission, no automatic retry of an uncertain attendance write, no student data in the service-worker cache.

## Start on a desktop browser (local preview)

Requires Node.js 20+ and Chrome/Chromium. **No npm install is needed for the PWA.**

```bash
npm run check
npm run dev
```

Visit `http://localhost:8080` on the same computer. Camera APIs are normally accessible on HTTPS or localhost only.

### Connect to an authorized AZM.AIO backend

The shipped `config.js` is configured to the verified live HTTPS backend origin. To target an **authorized staging backend**, open `config.js` and set:

```js
window.AZM_ATTENDANCE_CONFIG = {
  apiOrigin: 'https://azmaio.com',
  appName: 'ExamScan',
};
```

Supply **the HTTPS origin only**, without `/api` or any path. The frontend uses the actual AZM.AIO endpoints below. This file must contain **no passwords, API keys or JWTs**. If hosting this app under the same origin as the backend, `apiOrigin: ''` will use the site origin.

A PWA served on a **different HTTPS origin** needs that exact origin approved by AZM.AIO's CORS configuration (a separate reviewed backend change), or must be hosted under the existing approved origin. Do not disable CORS or use a wildcard. The localhost preview cannot use the real production API until the server explicitly authorizes the browser origin; do not change live CORS for a preview.

The public `/api/health` responded HTTP 200 (database connected), while unauthenticated `/api/auth/me` and `/api/attendance/sessions` returned the expected HTTP 401 on 14 November 2026. These safe checks confirm connectivity and authorization gates **but not a staff login or live mark**.

An OPEN examination attempt must already have been prepared and opened by an administrator in the existing AZM.AIO portal. This app does **not** create sessions or use outdated Hall state.

### Install on a phone (PWA)

Serve `dist/` over HTTPS on a reviewed, approved host and open it with an Android Chrome version that supports `BarcodeDetector`. Use **Install app** / **Add to Home screen**. Enable camera access. The scanner asks for the rear camera, decodes in the browser, then sends the signed QR to the server for verification and marking.

On browsers without `BarcodeDetector`, use the optional native Android build below; the app does not pretend that undecoded camera frames are confirmed attendance.

## Real AZM.AIO backend endpoints

All paths start with the configured origin, which is automatically combined with `/api`:

| Operation | Method and path | Body / contract |
| --- | --- | --- |
| Login | `POST /api/auth/login` | `{email,password}` → accessToken, refreshToken, user |
| Validate staff | `GET /api/auth/me` | Bearer → `{user}` |
| Refresh JWT | `POST /api/auth/refresh` | `{refreshToken}` |
| Session list | `GET /api/attendance/sessions?page=1&limit=100` | `{sessions,pagination}` |
| Selected Hall | `GET /api/attendance/sessions/:sessionId` | `{session,stats,roster}` |
| Roster page/search | `GET /api/attendance/sessions/:sessionId/candidates?page=1&limit=40&search=...` | `{candidates,pagination}` |
| **Mark scanned QR** | **`POST /api/attendance/scan`** | **`{sessionId,revision,qrToken,status:'PRESENT'}`** |
| Manual PRESENT | `POST /api/attendance/sessions/:sessionId/mark` | `{revision,studentId,status:'PRESENT'}` |
| Close Hall (admins only) | `POST /api/attendance/sessions/:sessionId/close` | `{markRemainingAbsent:false}` |
| Health | `GET /api/health` | Unwrapped `{status,database}` |

Staff roles permitted to mark: `TEACHER`, `ADMIN`, `SUPER_ADMIN`. Admins and Super Admins alone may close an OPEN session. The server checks active staff status and token version, active/OPEN/current Hall identity, revision, signed QR HMAC, frozen candidate roster membership, existing marks and write transaction safety.

**Important response handling:** QR recognition is not proof of attendance. On a successful `/scan`, the app expects the returned `attendance` and `student` records; `alreadyMarked:true` is a duplicate (not a newly marked student). Failed/uncertain requests are **never queued or blindly retried**; refresh the roster before retrying.

## Google Code Scanner — Android native source

See [`native/README.md`](native/README.md) for the exact Capacitor/Gradle build steps and Google Play Services checks. The native bridge uses Google's ready-made barcode scanner and returns only the QR value; this app then performs the **same authenticated backend call**. The native project **requires** an explicit approved `apiOrigin` in `config.js`, current patched Capacitor dependencies and Google Play Services. Android Studio/SDK and an Android device are necessary to produce and test an APK.

## Test commands

```bash
npm test            # API contract, QR URL parsing, Google scanner and HTTP tests (21 cases)
npm run build       # Copies installable PWA into dist/
python tests/browser_smoke.py          # Synthetic browser camera flow
python tests/browser_native_smoke.py   # Synthetic Android/Google scanner bridge flow
```

`tests/browser_smoke.py` builds an **in-memory synthetic** browser harness. It never calls a real backend or performs live attendance writes. A separate Node HTTP integration test exercises the actual network transport against a disposable in-memory mock server. It validates Teacher and Admin login, session choice, simulated QR decoding, exact authenticated request, manual marking, confirmation and role-limited close. Synthetic screenshots are under `tests/screenshots/`.

## Folder map

- `index.html`, `styles.css`, `ui.js`: Proctor Cadence-inspired visual design and accessibility.
- `app.js`: navigation, state, role gates, camera and roster workflows.
- `api.js`: authenticated AZM.AIO HTTP client and payload validation.
- `camera.js`: web camera and QR decoding; no local attendance writes.
- `config.js`: *non-secret* approved API origin.
- `service-worker.js`: only offline UI shell, no API/QR/person data cache.
- `native/`: optional Google ML Kit Android scanner bridge.
- `dist/`: publishable PWA built by `npm run build`.
- `tests/`: synthetic contract tests and browser tests.

## Operational safety

Do not test scanning with a real student and a live OPEN session until authorized. A real QR request **writes** an actual attendance record in production. This package contains no production credentials, no signing keys, no student fixtures in the shipped app, and it does not touch the PR #30 branch or the Oracle VM. See [SECURITY.md](SECURITY.md).

## Build provenance and scope

The full Android bridge source, pinned dependency versions, automatic Android project generation and GitHub Actions debug-APK workflow are included. An Android SDK and physical Android device were unavailable in the execution environment, so **do not claim an APK was compiled or the Google camera was physically tested**. The app uses the real backend URL and exact routes, but never ships staff passwords, signing keys, or hard-coded JWTs.
