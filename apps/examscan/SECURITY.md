# Security and release controls — ExamScan

This client is a convenience terminal for staff-authenticated examination attendance, **not** the authority for identity or marks.

## Hard invariants

1. Never derive student identity from an unsigned roll number or locally decode and trust the QR's contents. Extract the opaque `qr_...` token from the official `https://azmaio.com/attend?token=...` link or accept an already-raw token; send only that signed token to the AZM.AIO server for HMAC verification.
2. Marking is allowed only for an `OPEN`, `isCurrent:true` attempt with a specific server-provided `sessionId` and `revision`.
3. Show PRESENT only after the API returns a confirmed new attendance record. Preserve the distinction between `alreadyMarked` and new marks. An existing ABSENT/manual record must not be changed by the scan UI.
4. No offline mark queue and no automatic retry of an unknown/timeout POST. An indeterminate request can have committed on the server; show an error and require a roster refresh.
5. Protected requests use staff bearer tokens; teachers cannot close Hall sessions. The server remains responsible for authorization even if a client-side button is hidden.
6. Keep staff credentials, JWTs, signing keys, student records and API responses out of static builds, service-worker caches, logs, analytics and third-party scripts.
7. Never widen production CORS to `*`; use same-origin HTTPS hosting or a specifically approved origin for browser apps. Native CapacitorHttp can use native transport with an explicit approved HTTPS backend URL.
8. Session changes, archive, cancellation, closure or revision mismatch must stop camera scanning and demand re-selection.
9. APK release requires tested camera, permissions, network loss, Google Play Services module availability, and token/session expiry on actual Android hardware.

## Known constraints / not yet demonstrated

- Synthetic tests establish that the app sends requests matching source-reviewed AZM.AIO backend routes. They do **not** prove that a specific live deployment is healthy, reachable, CORS-compatible, or running that code.
- The PWA depends on browser Barcode Detection support. The Google Code Scanner integration has unit and synthetic browser tests, but the APK and physical Google camera behavior have **not been built or device-tested** in this environment.
- Backend `/api/auth/logout` merely acknowledges the request; it does not revoke bearer or refresh tokens server-side. The client clears memory-held tokens on sign-out. For a lost device, existing backend token-version/account controls should be used by an authorized administrator.
- Manual attendance and session close are real writes and can impact audit evidence; never test either against real records without a supervised release plan.
- Avoid using tests or demos to exercise the live environment, even with a student number that appears fake.
- Third-party fonts may load from Google Fonts when the browser is online. For privacy-constrained deployments self-host fonts or remove the external font links; the UI has system fallbacks.

## Pre-release acceptance

- [ ] Exact backend revision and `/api/auth`/`/api/attendance` routes confirmed on **approved non-production staging**.
- [ ] Dedicated ACTIVE staff logins for TEACHER and ADMIN verified; unauthorized roles fail.
- [ ] Signed roll-slip QR issued by the same backend verifies for a known **synthetic** staging candidate.
- [ ] QR 201 means new PRESENT; QR 200 with `alreadyMarked:true` is clearly identified; invalid signature, wrong Hall, stale revision, archived/closed session are rejected.
- [ ] Staff network interruption, timeout, JWT expiry, duplicate scan, and camera permission denial tested on phone.
- [ ] Mobile Chrome rear-camera QR scan tested (PWA path) and/or Google Code Scanner on physical Android (APK path).
- [ ] Admin close confirmation tested using a disposable session; no unauthorized Teacher close.
- [ ] Approved HTTPS hosting/CORS/native HTTP, CSP, TLS, dependency audit, privacy policy and device management reviewed.
- [ ] Production enablement separately authorized; never push attendance app or its CORS changes as a side effect of PR #30.
