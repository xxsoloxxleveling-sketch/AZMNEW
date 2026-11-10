# OMR reliability milestone — 2026-11-10

Continues `codex/smart-omr-evaluation-mobile` / draft PR #28. No production deployment, official-key approval, student-mark change or publication is authorized. The legacy profile remains provisional, `SYNTHETIC_ONLY`, `physicalValidationRequired=true`, `officialScoringAllowed=false`.

## Measured physical replay

The fixed original private photos were replayed without changing their pixels, answer thresholds or geometry. This is a regression replay of an already evaluated dataset, not a newly unseen experiment. The original frozen checkpoint and reserved split are preserved.

| Metric | Previous checkpoint | Reliability replay |
|---|---:|---:|
| Mapped photos | 17/24 | 17/24 |
| Rejected photos | 7/24 | same 7/24 |
| Extracted positions | 1,700 | 1,700, classifications unchanged |
| Uncertain answers | 996 | 996 |
| Original QR decoded | 0/17 mapped | 0/17 mapped |
| Uncertain paper versions | 3 | same 3 |
| Independent physical accuracy / false acceptance | unavailable | pending independent labels |

S10/S14 remain cropped-page failures, S11 remains an ambiguous row/frame mapping, and S16/S17/S18/S24 lack complete unambiguous corner evidence. No retaken sources were supplied for this run. No invalid photo was rescued by relaxing registration.

## Original QR investigation and improvement

The supplied originals are all 720×1280; there is no higher-resolution source in that private folder. The actual original-pixel projected QR regions are 121–137 pixels wide and 142–170 high including surrounding text/frame. Direct inspection of S01 finds a QR symbol only approximately 64 pixels across. Finder-pattern measurements on several crops suggest roughly 1–1.5 source pixels per module, but these are diagnostic estimates, not decoded QR-version evidence. Some detector quadrilaterals are false/small proposals and must not be treated as exact symbol sizes.

The old runtime made one OpenCV attempt on a page-upsampled crop. The new bounded decoder tries grayscale, local contrast, nearest-neighbor resampling where applicable and Otsu thresholding with padding. Legacy sheets also try a verified page-region projection back into original camera pixels. Distinct payloads across strategies or original/normalized sources fail closed. No image generation, module guessing, identifier reconstruction or answer-key lookup is used. QR output remains unverified; the backend still reconciles the complete identity, session/exam, eligibility and printed roll with the roster. The added decoder is included in activation hashes.

An extended private investigation tested two crops, seven contrast/resampling variants, ordinary/curved OpenCV decoding (28 attempts/photo) and the separate zxing-cpp 2.3.0 decoder (14 attempts/photo), totaling 476 OpenCV and 238 alternate attempts. All 17 original QR codes remained unreadable. zxing-cpp is analysis-only and is not a runtime dependency. These captures do not contain enough usable detail for reliable decoding with the tested methods; this is not proof that recovery by every possible decoder is mathematically impossible.

Prefer a new original full-resolution full-page image. The shared camera now requests 3840×2880 and prefers the sensor still-image API when supported, validates the still's type/dimensions/size, and otherwise uses the actual video-frame dimensions at JPEG quality 0.98. It shows numerical preview resolution and messaging-copy/QR guidance. Capture cancellation/offline/unmount generation checks prevent a late image from being accepted. No camera permission or sensor quality is assumed from browser emulation.

Missing QR continues through the existing authorized printed-identity review: exact scan, roster match, printed roll, selected examination and recorded reason/actor. A detached QR close-up is not accepted as evidence of the same physical sheet. A new paired-close-up storage/association protocol is not implemented in this milestone; full-resolution retakes and authorized roster review are the available paths.

## Confidence and paper-version investigation

All 996 uncertain positions are `AMBIGUOUS_INK`; none are `DAMAGED_PRINT_OR_GLARE`. Existing classification requires every non-selected option to be below the blank threshold. Weak ink in another option therefore keeps a strong candidate uncertain. That weak signal can come from print, imperfect sampling or an actual second/erased mark; darkness values alone cannot establish which. No `A?` candidate is promoted and no threshold is relaxed without independent labels.

S07/S13/S19 have a strong version mark plus another measurement in the weak interval. Their four darkness measurements are respectively approximately `[0.249,0.951,0.099,0.155]`, `[0.082,0.101,0.192,1.000]`, `[1.000,0.103,0.116,0.230]`. Private crops are retained for review. These measurements explain the review request; they do not authorize automatic B/D/A assignment. The review screen now explicitly directs authorized reviewers to zoom the original A/B/C/D strip, leave unreadable versions unresolved and never select by score. Existing version changes retain before/after audit evidence and allowed-version/key matching.

## Practical independent labels

The user confirmed that a separate reviewer can label photos. `export-blind-review.py` reuses the existing human-label form and exports one portable HTML file with originals, empty controls, zoom and per-sheet JSON download. It reads no predictions or keys and needs no loopback server. Selected calibration sheets: S01/S07/S13. Reserved sheets: S19/S20/S23. Preserve that split; calibrate only on labeled calibration data and freeze before evaluating reserved labels. New unseen retakes are a separate future dataset.

The reviewer must not have seen predictions/keys for these sheets, must personally read all 100 responses and the paper version, and must identify/confirm the transcription. Downloaded files include original SHA-256, reviewer, time, explicit exposure declaration and method. The previous user's prediction comparison remains useful unblinded feedback, never independent ground truth.

`physical-accuracy.py` validates the existing human-label contract, source hash, exposure and all 100 ordered positions. It reports exact classification accuracy on human-resolvable labels, false accepted classifications divided by non-review classifications with resolvable labels, human uncertainty exclusions, answer review workload and version correctness. `UNCERTAIN` predictions count as unresolved rather than a guessed candidate. No labels means null accuracy/false-acceptance, not zero errors. Current uncertainty workload is 996/1700 (58.59%); including five multiple marks gives 1001/1700 (58.88%) answer positions requiring review, and all 17 mapped sheets still require physical review.

The portable file and all actual responses/images/diagnostics remain in ignored `tmp/omr-reference/reliability-20261110/`. Nothing private is included in PR/CI artifacts.

## Validation status

- Local scanner suite: 41 passed (37 retained + four QR recovery/conflict/original-pixel tests).
- Python helper suite: eight passed, including source/exposure refusal and correct false-acceptance/uncertainty accounting.
- Feature Node suite: 46 passed initially; the follow-up security suite passed all 12 tests after adding a conflicting-QR manual-review bypass refusal (47 tests across the feature suites). Activation hashes include the QR module.
- Disposable full-history application and queue recovery: five passed, with fabricated students/keys, private draft, conflicting identity refusal, audit/review and public release refusal.
- Backend compilation, scoped web compilation, web production build and mobile strict TypeScript/production build passed. An incidental whole-repository TypeScript invocation reported existing unrelated type errors; it is not represented as a passing whole-repository lint.
- Hosted Android now uses a checksum-keyed archive cache and bounded retries against official Gradle distribution endpoints. Every cache hit/download is independently checked against the same pinned SHA-256 before extraction/execution. Source commit and APK SHA-256 accompany the APK artifact. The older APK is never the current artifact.
- Android device/ADB/Java/SDK were not found locally. Real camera/device and iOS/Xcode tests remain unavailable.

Hosted build completion and downloaded artifact verification must be observed before the current APK is reported as built. No independent human label files have yet been returned; no physical accuracy improvement is claimed.

## Observed hosted checkpoint and browser evidence

Local runtime `9fa6864` and review runtime `1b9304b78be14cc164983317fa39dd16dbea94f7` share tree `b0629c8301389882253ae82071ab6d06dc5579ce`. [Smart OMR run 42783721218](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42783721218) and [broader PostgreSQL/runtime run 42783721489](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42783721489) both completed SUCCESS. OMR includes the scanner/helper/feature suites, native PostgreSQL 17, synthetic API/queue recovery, Linux sandboxed PDF integration and historical migration/recovery/restore checks. The Android distribution download, SHA-256 verification, native compilation and APK artifact upload all passed. Cache miss used the official distribution endpoint successfully and saved the verified archive.

Downloaded artifact 13747183396 ZIP SHA-256 `4e24c129772fdaeac9873b172a6eea23d311f998c5bf9efd7582c05583e004cd` matches GitHub's digest. APK SHA-256 `14edbee622eafa482ed491373fbdf67db28df8dd6204aca4beee50859ea3a57f`, 4,203,136 bytes, matches the accompanying checksum. AndroidManifest.xml/classes.dex are present. Its recorded source is PR test-merge `394a7a8c313fa484d878d9a53443a48240c372e7`; GitHub compare reports no file differences from the review runtime. This is a CI test merge, not a merged PR or deployment. Private downloaded APK: `tmp/omr-dev/release/azm-omr-reliability-1b9304b.apk`.

The ordinary ten-screen web/mobile browser regression passed. A stricter follow-up also passed the actual Capture sheet button using an explicitly fabricated sensor still and camera stream, then offline refusal, retained preview/retry, upload, actual worker recognition, 100-row review, history and logout. Two intermediate test-fixture attempts failed (Windows fake camera disappeared on reopen; then an injected tsx named-function helper was missing); both are preserved as fixture failures and were corrected without weakening app checks. No physical device is implied.

Portable blind HTML browser verification passed six original photo choices, 100 initially empty controls, completion/confirmation gating and reset on changing sample. No fabricated human labels were downloaded or stored. Independent labels remain pending.

Subsequent security/test changes are validated and checkpointed separately below; the first successful build above is not substituted for checks of changed executable code.

The added real API/worker test for missing QR plus an uncertain version passed locally. Before authorized review it has no student, no usable version and no result. Teacher review is forbidden; a wrong printed roll is rejected. Correct fabricated roster/version review creates a private 100/100 DRAFT under the matching synthetic key, retains identity/version audit entries and the original UNCERTAIN version evidence, hides the score from teachers and blocks public publication/search. This tests workflow mechanics with fabricated evidence, not human physical accuracy.

Final camera hardening bounds sensor-still waiting to 12 seconds before video-frame fallback. Closing the camera immediately releases the capture control; a cancelled capture's late completion cannot change a subsequent capture's busy state or deliver a stale image. A stalled-sensor unit test and the strict mobile type-check pass. The final source is rebuilt after this change; the first APK above is retained only as an earlier checkpoint.

Follow-up runtime local `c08feec8` / review `af261cfd22cb8674e7c503ff7811246eac495d0c`, tree `ed7917bbee44446ba114d5a2c6cc562f22b1e4d7`, passed [Smart OMR run 42785619279](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42785619279) and [broader runtime run 42785619387](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42785619387), including the new missing-QR/version API test and Android assembly. This checkpoint precedes the last camera timeout fix.

The final browser run also passed explicit stalled-capture cancellation: close releases Open camera, a late result creates no preview, and a subsequent successful captured sensor image proceeds through offline refusal/retry, actual processing and 100-row review. Final feature test count becomes 48 with the timeout test; application/recovery checks become six with the missing-QR/version test. Real device testing remains unavailable.

User review update, 2026-11-10: the user reported checking all papers and explicitly clarified that the comparison was against displayed readings. Record this as user-confirmed unblinded comparison, not separate blind transcription. No independent label JSON files have been returned. No numeric physical accuracy, false-acceptance estimate, automatic confidence/version promotion or official approval follows from that statement.
