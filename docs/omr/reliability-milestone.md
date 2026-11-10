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
- Feature Node suite: 46 passed, including sensor-still fallback and low-resolution guidance; activation hashes include the QR module.
- Disposable full-history application and queue recovery: five passed, with fabricated students/keys, private draft, conflicting identity refusal, audit/review and public release refusal.
- Backend TypeScript compilation passed. Web/mobile build and browser results are recorded below when observed.
- Hosted Android now uses a checksum-keyed archive cache and bounded retries against official Gradle distribution endpoints. Every cache hit/download is independently checked against the same pinned SHA-256 before extraction/execution. Source commit and APK SHA-256 accompany the APK artifact. The older APK is never the current artifact.
- Android device/ADB/Java/SDK were not found locally. Real camera/device and iOS/Xcode tests remain unavailable.

Hosted build completion and downloaded artifact verification must be observed before the current APK is reported as built. No independent human label files have yet been returned; no physical accuracy improvement is claimed.
