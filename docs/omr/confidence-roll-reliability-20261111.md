# Physical confidence and printed-roll checkpoint — 2026-11-11

Continues `codex/smart-omr-evaluation-mobile`, draft PR #28. Runtime local `6019d0a` / review `3dc8522eddf67441cac1463e77808696afee5f14`, identical source tree `f3d1e94ba9c42bc29e733462b62411bd7579c38c`. No merge or deployment occurred.

## Measured results

The original 24 photographs were replayed first optically and then through the actual disposable API, upload inspection, worker, response storage and private evidence snapshots. Both paths produced the same mapping and answer-review counts. No real students or confidential answer keys were imported.

| Measurement | Previous checkpoint | Current replay |
|---|---:|---:|
| Mapped sheets | 17/24 | 17/24 |
| Rejected photographs | 7 | Same 7 |
| API worker failures | — | 0/24 |
| Uncertain answer positions | 996 | 326 |
| Multiple-mark positions | 11 | 11 |
| Total answer-review positions | 1,007/1,700 | 337/1,700 |
| Previously accepted answers that changed | — | 0 |
| Printed-roll candidates | Reader unavailable in prior device environment | 13/17 mapped sheets |
| Original QR decodes | 0/17 | 0/17 |
| Unresolved paper versions | 3 | Same 3 |
| Independently measured question accuracy / false acceptance | Unavailable | Unavailable |

Uncertainty fell by 670 positions (67.3%); answer-review workload fell by 66.5%. These are workload measurements, not proof of 99% accuracy. Each physical-layout sheet still requires authorized review and remains ineligible for official scoring.

The original reject set S10/S11/S14/S16/S17/S18/S24 stayed rejected. Complete printed-roll reads remain unavailable for S06/S09/S13/S20. No unreadable identity was guessed or attached. This is a historical dataset with an existing 18/6 split; S21 was already exposed during device review. The six-image replay is a frozen technical replay, not a new independent or unseen accuracy experiment.

## Changes and safeguards

The physical layout now measures ink relative to nearby paper brightness. A fixed bright percentile is sampled outside the bubble interior; another answer is never used as the white or black reference. Blank/filled thresholds are unchanged. Raw darkness, adjusted darkness, paper references and measurement method are retained separately. A dark/unreliable reference, damaged outline, faint competing mark or multiple mark still requires review. Fabricated optical tests exercise gray paper, faint marks beside strong marks, blanks, multiples and cropped references.

Printed-roll OCR uses the complete roll/application region instead of the former crop that clipped the leading letters. It runs locally in a bounded subprocess using pinned RapidOCR/ONNX dependencies and checksum-verified bundled models. Original and contrast-adjusted views must yield the same complete supported roll string, pass the reader's quality gate and contain no conflicting complete reading. Model scores are not calibrated probabilities, and agreement between two views is not independent human validation. No letter/digit substitutions are used to repair an unreadable identity. Application numbers are not silently treated as roll numbers. Missing dependencies, modified models, conflicts and timeouts return an explicit unavailable/unreadable status.

OCR results are unverified candidates. The review screen fills the full printed number but leaves identity confirmation unchecked. Existing QR signature, roster, examination and eligibility reconciliation are unchanged; OCR alone cannot attach a candidate or create a grade. The optional bundle is installed with the base pinned scanner requirements followed by `pip install --no-deps -r workers/omr/requirements-ocr.txt` and verified with `python tools/omr-dev/setup-ocr.py`. Runtime OCR downloads nothing and transmits no images. Models remain dependency artifacts and are not committed.

The mobile app now explains a local USB connection failure, retains the current screen for retry and clears a recovered polling error. Network availability is labeled separately from server connectivity. Guarded USB resume preserves an already verified app context without reloading unsaved review. Earlier saved operator corrections remain in their original private audit history; they were not copied into scanner predictions or independent labels.

## Android build and actual-device evidence

Verified artifact: `tmp/omr-dev/release/azm-omr-confidence-3dc8522.apk`, 4,203,536 bytes; SHA-256 `639ddfddb9e65b3596745091b85054b1cac1a3f85f83a60c7a257ddfd62f2182`. Artifact 13824418259 ZIP digest matches GitHub's `d04a43765072ad877562d86eb94559edc246390f89339d79b6a48ee54f33dd06`. Its recorded CI test-merge commit is `f777b654820e24e04303affa38058ac93a6b9ec3`; the source-tree file exactly matches the reviewed runtime above. This is a PR test merge, not a merged PR.

The previous verified test package had a different Android debug signing key. Its checksum was verified before replacement; saved scans/reviews remain private on the computer. The new package was installed on the SM-X710 / Android 16, its installed checksum verified and its disposable loopback session attested. The active test API uses port 5056; the earlier session's evidence is preserved separately.

The same byte-identical 720×1280 source was uploaded through the updated device app and its full review displayed. The app automatically filled the complete printed roll, with confirmation unchecked. Uncertain answers fell from 69 to 22; one multiple mark remains (23 review positions). Upload-to-processed duration was 9,448 ms; observer upload-to-terminal detection was 12,164 ms. OCR adds processing time; these are not pure CPU benchmarks. Identity remains unverified, with zero grades and zero corrections on this new scan. The earlier 70 operator correction audits remain preserved in their earlier session.

This was a recovered file selection through the physical device, not a fresh native camera capture. The operator could not take a new photograph during this continuation. Native camera permission/capture/full-resolution acceptance and seven fresh retakes remain NOT RUN. No physical camera success is claimed.

## Accuracy limitation requiring follow-up

On the device example, 77 automatically accepted readings were compared with the saved **unblinded** operator review: 76 agreed and one disagreed. The disagreement remains unresolved. Neither the scanner prediction nor the operator entry has been promoted to independent ground truth, and no threshold was tuned to make this comparison pass. The exact question and original evidence stay in the private comparison record. A separate reviewer must resolve it from the original, without predictions or keys. This is a release blocker alongside the missing independent labels; reduced review workload alone does not prove correctness.

The portable private blind form for selected original sheets is `tmp/omr-reference/confidence-20261111/Independent_Paper_Review.html`. It contains originals and empty fields only, no predictions, keys or remote requests. Existing operator comparisons are not blind labels.

## Validation and remaining blockers

51 scanner/OCR tests passed locally, including actual offline-model reads on fabricated identifiers. The synthetic mobile-browser regression passed for connection recovery, OCR prefill and unchecked identity confirmation. Full synthetic API/draft grading, missing-QR/version review and the private acceptance harness passed. Both hosted [Smart OMR/native PostgreSQL/PDF/Android checks](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42950793270) and [broader runtime isolation checks](https://github.com/xxsoloxxleveling-sketch/AZMNEW/actions/runs/42950793309) completed SUCCESS. Private physical API evidence and originals were not uploaded to CI or the PR.

Remaining release blockers: the unresolved operator disagreement, independent physical accuracy/false-acceptance labels, four unreadable roll numbers, original QR failure, three uncertain versions, fresh full-resolution Android camera capture, seven fresh retakes and the previously retained high-resolution registration/worker-deadline failure. These are not resolved by accepting the strongest bubble or importing real students into the test database.

`SYNTHETIC_ONLY`, `officialScoringAllowed=false` and publication locks remain enforced. No official key approval, real student-result modification, merge or deployment.
