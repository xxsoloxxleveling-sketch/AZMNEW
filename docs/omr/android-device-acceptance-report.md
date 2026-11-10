# Android acceptance checkpoint — 2026-11-10

**Status: environment and installation readiness prepared; physical-device acceptance NOT RUN.** No authorized Android device is attached at this checkpoint. The earlier installed-APK/USB check is readiness evidence only, not camera/scan acceptance.

| Measurement | Observed result |
|---|---|
| Target APK | Existing final `965c4ff` APK, SHA-256 `0c92215362bd2966589036459f100e0679c5a66616b3ef2fbede948dbdae3095` |
| Isolation | Disposable loopback PGlite database, restricted runtime role, synthetic roster/keys, local private storage; production/cloud/official activation refused |
| Connection protection | Verified installed APK and private session attestation; session transport token required on API requests; observer restricts destinations to app/local test API |
| Physical-device camera sessions completed | 0 |
| Physical-device scan success | Not measured; no attested device/upload denominator |
| Physical-device QR decoding | Not measured |
| Independently labeled physical question accuracy | Not measured; no independent label files |
| Automated acceptance API fixture | 1/1 mapped, 100 response positions; authorized synthetic identity/version review creates private 100/100 DRAFT |
| Original preservation | Byte/hash-identical originals, separate blind copies, observations, content-addressed audit/result revisions; retained after disposable database shutdown |
| Device diagnostics tests | Nine local JavaScript checks passed, including a desktop-browser observer simulation; not Android hardware evidence |
| Private acceptance harness test | Passed locally using the pinned verified APK and disposable database; CI explicitly skips it if that private artifact is absent |
| Retained application/recovery checks | Six passed; seven including the new acceptance harness test |
| Python label/evidence helpers | Ten passed |
| Retained feature/security tests | 48 passed |
| Original physical photo checkpoint | Historical desktop/application replay remains 17/24 mapped, seven rejected, 996 uncertain positions, 0/17 original QR decodes and three uncertain versions; not a device rate |

The USB observer records actual camera open/permission outcome, track resolution and saved-image width/height/bytes/hash, upload status/time, processing progress and review-row count. Source hashes join signed session events to preserved uploads. Camera provenance and gallery/file selection remain distinct. Upload-to-processed timing includes queue delay. QR-crop quality is reported only after a verified unique page pose; unavailable evidence stays unavailable. No tokens, request headers, passwords, keys, QR identity strings or image bodies enter diagnostics.

Fresh full-resolution retakes of S10/S11/S14/S16/S17/S18/S24 are supported as new Dxxx samples with preserved source hashes and case declarations. An old rejected file cannot be labeled a new retake. Old frozen results remain unchanged. Blind transcription reads originals only; unblinded comparisons are not independent labels.

**Known unresolved failure:** one prior unobserved-source upload remained FAILED / WORKER_FAILED with zero responses. Its 3096×4128 original (7,535,841 bytes) and review record were preserved privately. Direct replay took 82.623 seconds and returned INVALID / registration_failed, exceeding the 45-second API worker deadline. The original detailed cause was not captured; earlier temporary-session database-connection errors were also present. This is a remaining failure, not a camera pass or a reason to relax alignment safeguards.

**Environment observation:** an initial command-supervised acceptance session hit an idle transaction expiration (15,000 ms timeout, 289,283 ms elapsed), then failed database attestation. The watchdog closed the API and confirmed `finalSnapshotSaved=true`. A separate hidden background launch was subsequently attested with snapshots more than 205 seconds after startup and no stderr errors at that check. Root cause and sustained active-device stability are still open; the relaunch is not a proven universal fix.

Remaining hardware tests: permission denial/allow, physical sheet capture and actual resolution, orientation, cancellation/resume, offline/upload interruption and retry, complete result review, original QR decoding, seven fresh retakes and independent human accuracy. Full instructions and the PASS/FAIL/NOT RUN checklist are in [android-device-acceptance.md](android-device-acceptance.md).

`SYNTHETIC_ONLY`, `officialScoringAllowed=false` and publication locks remain enforced. No merge, deployment, official-key approval or real student-result changes. The verified APK is unchanged; additions are non-production acceptance tools and documentation.

Hosted validation of final tooling local `949bbc5` / review `d197665f4064c5cef120b09c68cb03a9dc8496cd`, identical tree `1e768ff29d4b1d85b33faea125a87c9ba5a1366d`: [Smart OMR run 42809029056](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42809029056) and [broader runtime run 42809029243](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42809029243) both completed SUCCESS, including native database/PDF/recovery checks and Android compilation. The private-APK harness test is explicitly skipped in CI and passed locally. Hardware results remain NOT RUN. Later report changes are documentation only.
