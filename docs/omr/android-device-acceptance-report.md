# Android acceptance checkpoint â€” updated 2026-11-11

**Current status: actual device upload and review observed; camera acceptance pending.** The 2026-11-10 readiness checkpoint had no attached device. On 2026-11-11 the SM-X710 / Android 16 device was USB-authorized, its installed APK checksum verified, its disposable session attested, and actual synthetic-admin sign-in observed. A recovered, byte-identical 720×1280 image was uploaded through the device app and its review screen opened. No native camera capture was observed; question accuracy remains unmeasured without independent labels.

Two actual-device startup issues were found and corrected: the debug WebView was not immediately available after app startup (bounded readiness retry added), and the app had cached its fetch client before the acceptance transport was injected (reload after preload registration added). The initial sign-in failed with a CORS missing-origin-header error because the required private transport header was absent; no server allowlist or authentication gate was weakened. After reload, actual sign-in succeeded. Ten diagnostics/browser regression checks passed, including cached-fetch preload and startup readiness. This is a connection pass, not a camera or sheet-recognition pass.

| Measurement | Observed result |
|---|---|
| Target APK | Existing final `965c4ff` APK, SHA-256 `0c92215362bd2966589036459f100e0679c5a66616b3ef2fbede948dbdae3095` |
| Isolation | Disposable loopback PGlite database, restricted runtime role, synthetic roster/keys, local private storage; production/cloud/official activation refused |
| Connection protection | Verified installed APK and private session attestation; session transport token required on API requests; observer restricts destinations to app/local test API |
| Physical-device camera sessions completed | 0 |
| Actual-device upload/mapping | 1/1 accepted and mapped; recovered file selection, not a proven new camera capture |
| Actual-device QR decoding | 0/1; verified original QR crop 134×165 pixels, four unsuccessful decoder attempts |
| Independently labeled physical question accuracy | Not measured; no independent label files |
| Automated acceptance API fixture | 1/1 mapped, 100 response positions; authorized synthetic identity/version review creates private 100/100 DRAFT |
| Original preservation | Byte/hash-identical originals, separate blind copies, observations, content-addressed audit/result revisions; retained after disposable database shutdown |
| Device diagnostics tests | Ten local JavaScript checks passed, including a desktop-browser observer simulation; not Android hardware evidence |
| Private acceptance harness test | Passed locally using the pinned verified APK and disposable database; CI explicitly skips it if that private artifact is absent |
| Retained application/recovery checks | Six passed; seven including the new acceptance harness test |
| Python label/evidence helpers | Ten passed |
| Retained feature/security tests | 48 passed |
| Original physical photo checkpoint | Historical desktop/application replay remains 17/24 mapped, seven rejected, 996 uncertain positions, 0/17 original QR decodes and three uncertain versions; not a device rate |

The USB observer records actual camera open/permission outcome, track resolution and saved-image width/height/bytes/hash, upload status/time, processing progress and review-row count. Source hashes join signed session events to preserved uploads. Camera provenance and gallery/file selection remain distinct. Upload-to-processed timing includes queue delay. QR-crop quality is reported only after a verified unique page pose; unavailable evidence stays unavailable. No tokens, request headers, passwords, keys, QR identity strings or image bodies enter diagnostics.

Fresh full-resolution retakes of S10/S11/S14/S16/S17/S18/S24 are supported as new Dxxx samples with preserved source hashes and case declarations. An old rejected file cannot be labeled a new retake. Old frozen results remain unchanged. Blind transcription reads originals only; unblinded comparisons are not independent labels.

**Known unresolved failure:** one prior unobserved-source upload remained FAILED / WORKER_FAILED with zero responses. Its 3096Ã—4128 original (7,535,841 bytes) and review record were preserved privately. Direct replay took 82.623 seconds and returned INVALID / registration_failed, exceeding the 45-second API worker deadline. The original detailed cause was not captured; earlier temporary-session database-connection errors were also present. This is a remaining failure, not a camera pass or a reason to relax alignment safeguards.

**Environment observation:** an initial command-supervised acceptance session hit an idle transaction expiration (15,000 ms timeout, 289,283 ms elapsed), then failed database attestation. The watchdog closed the API and confirmed `finalSnapshotSaved=true`. A separate hidden background launch was subsequently attested with snapshots more than 205 seconds after startup and no stderr errors at that check. Root cause and sustained active-device stability are still open; the relaunch is not a proven universal fix.

Remaining hardware tests: permission denial/allow, physical sheet capture and actual resolution, orientation, cancellation/resume, offline/upload interruption and retry, complete result review, original QR decoding, seven fresh retakes and independent human accuracy. Full instructions and the PASS/FAIL/NOT RUN checklist are in [android-device-acceptance.md](android-device-acceptance.md).

`SYNTHETIC_ONLY`, `officialScoringAllowed=false` and publication locks remain enforced. No merge, deployment, official-key approval or real student-result changes. The verified APK is unchanged; additions are non-production acceptance tools and documentation.

Hosted validation of final tooling local `949bbc5` / review `d197665f4064c5cef120b09c68cb03a9dc8496cd`, identical tree `1e768ff29d4b1d85b33faea125a87c9ba5a1366d`: [Smart OMR run 42809029056](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42809029056) and [broader runtime run 42809029243](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42809029243) both completed SUCCESS, including native database/PDF/recovery checks and Android compilation. The private-APK harness test is explicitly skipped in CI and passed locally. Hardware results remain NOT RUN. Later report changes are documentation only.

## Upload failure investigation — 2026-11-11

The observed `Failed to fetch` upload did not reach the API: the disposable backend watchdog had shut down after a database/evidence-check failure while the USB connection remained active. Its final evidence snapshot was saved. The exact pending original was preserved before restarting the app and restored without changing its bytes.

The disposable database now disables Prisma connection lifetime recycling for its single-slot WASM socket bridge. A roughly five-minute recurrence suggested connection replacement as a contributor; this is a test-environment mitigation, not a proven root cause. The watchdog and all attestation/scoring gates remain enforced, and future guard failures record a private diagnostic cause.

Recovered upload D001 completed mapping in 2,903 ms from upload to processed (6,108 ms to observer terminal detection). It produced 100 response positions, 69 uncertain, version B, no QR decode and `IDENTITY_REVIEW_REQUIRED`. The device displayed the complete review table. Identity remains unverified, with zero draft results/corrections. Original: 720×1280, 151,527 bytes. No new full-resolution camera capture or independent answer transcription was observed. This one sample does not alter the frozen 24-photo checkpoint or establish Android camera acceptance.

After the connection-lifetime change, the replacement session remained attested with saved snapshots for at least 300 seconds, including the accepted upload and full review. No stderr/guard failure was observed in that interval. Longer-session stability remains under observation. The disposable acceptance harness passed locally, as did all ten diagnostics/browser checks.
