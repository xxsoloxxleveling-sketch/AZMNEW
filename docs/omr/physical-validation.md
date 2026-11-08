# Physical-sheet compatibility — 2026-11-08

Branch: `codex/smart-omr-evaluation-mobile`; draft PR #28 remains unmerged. Frozen optical algorithm SHA-256: `59a7779250d157059ca95aa63860fd81a860e426d1a23fcdbf51adcd62e3c08a`. No production service, database, genuine student record or official mark was changed.

## Before and after

These are unmodified original photographs processed through the actual web Bulk Upload, authenticated API, durable queue, Python worker and review/history screens. Derived identity fixtures are excluded from these counts.

| Dataset | Photos | Before: 100 positions mapped | After: 100 positions mapped | Still rejected |
|---|---:|---:|---:|---:|
| Calibration | 18 | 0 | 12 | 6 |
| Reserved validation | 6 | 0 | 5 | 1 |
| Total | 24 | 0 | 17 | 7 |

All 17 mapped sheets remain REVIEW_REQUIRED. They contain 1,700 observations: 697 single options, 2 blanks, 5 multiple marks and 996 uncertain responses. These are classifications to inspect, **not verified correct answers**. No original photograph was attached to a student or assigned a result in the bulk intake test. No original QR was decoded among the 17 mapped photos; QR decoding was not reached for the seven invalid scans. Fourteen paper versions were unambiguous and three require review; version accuracy is unmeasured.

The split was defined after the baseline failures and basic sample inventory were known. The six reserved photographs were excluded from subsequent compatibility tuning; their first evaluation against the new profile used the frozen algorithm. Distinct printed identifier pairs were inspected after freezing to check for obvious duplicate sheets across the split.

Question accuracy, entire-sheet exact match, blank/multiple accuracy and false-confident-answer rate remain unknown because independent human answer transcriptions have not been supplied. The user chose to compare predictions with photographs; such feedback must be recorded as an unblinded comparison, not relabeled as blind ground truth. No official acceptance or publication is authorized by these results.

## Evidence and root causes

All 24 originals are portrait JPEGs, 720 × 1280. They show one framed 100-question layout family, with four columns of 25 rows, small corner marks, printed QR and a version strip. Header wrapping changes vertical placement. Private visual inventory found 24 distinct printed identifier pairs, with no observed duplicate crossing the split; identifier crops/values remain local. This inventory is an assistant visual check, not independent human answer labeling.

The generated/current reference uses `AZM_OMR_V2_2026_V`, approximately 57-pixel normalized corner widths and 25 timing blocks on each side. The photographs have smaller normalized marks, commonly around 33–40 pixels, and lack that timing pattern. Both carry a printed Template 2.0 footer, so the footer alone cannot identify the geometry contract. The alternative is explicitly named `AZM_FRAMED_100_LEGACY_V1`; it is never silently reported as the current timing-track profile.

The baseline corner detector searched the outer quarters of the entire camera frame. Several complete sheets ended above the bottom-quarter boundary because the photo included table/carpet below the page. Some gray markers also failed fixed dark-pixel detection. A closed background contour could hide nested markers from external-contour-only enumeration. After marker alignment, current timing-track assumptions still rejected the other print design. Finally, paper curvature displaced interior rows relative to a single linear row-spacing model. These failures were demonstrated from marker positions, normalized geometry and observed row spacing rather than inferred from a low score.

The private blank reference still follows the original timing-track profile: 100 blank responses, registration 1.0, officialScoringAllowed=false. Its printed identity/QR is excluded from committed evidence.

## Implemented compatibility contract

`physical_layout.py` and `template-framed-legacy-v1.json` add a separate, provisional alignment method. It requires complete small corner proposals, a convex/bounded page transform, an in-frame proposed page boundary, four aligned framed headers, side-frame evidence, bottom rules and exactly 25 ordered four-option rows in each column. First/last row bounds and observed spacing prevent 24/26 rows being forced into 100 questions. A full grid, rather than four squares alone, establishes the mapping. Literal OCR of all printed question numbers is not implemented; human verification of the mapped question numbers remains a release requirement.

Marker proposals use several local-contrast windows and include nested contours; the solid-square criteria remain. Guided boundary edges are recorded separately from the marker-inferred page boundary. Paper curvature is handled by observed row clusters inside the printed frames, with bounded row spacing and unambiguous option assignment. Complete external circle outlines refine centers without optimizing answer darkness.

Broad illumination is normalized, and each column's black reference comes only from its printed header ink. No answer key or achieved score is used for registration, center selection or photometric normalization. Existing blank/filled classification thresholds are unchanged. The legacy contract rejects current timing-track evidence instead of using this alternative to rescue a damaged current-template scan.

The worker preserves private numeric geometry and rejection stages; local diagnostic PNGs show marker proposals, expected positions, observed/proposed page boundaries, proposed transform, current timing samples and proposed grid regions. Missing evidence is shown as unavailable rather than fabricated. The API converts crop and row-mapping failures into specific safe UI messages. Review automatically uses the original image when an overlay is unavailable.

Every legacy-profile observation sets `physicalValidationRequired=true`, `SYNTHETIC_ONLY` and `officialScoringAllowed=false`. Non-synthetic grading refuses it even if an approval for the original profile exists. Activation hashes include the new code/profile; changing the profile invalidates prior approval evidence. Regression tests exercise both restrictions.

## Remaining original-photo rejections

| Sample | Rejection |
|---|---|
| S10, S14 | Proposed full page extends outside the photograph; retake with page/corner margins |
| S11 | Printed row/frame geometry does not yield one safe 25-row mapping |
| S16, S17, S18, S24 | Complete unambiguous four-marker evidence unavailable; some corners/marks are clipped |

These failures are retained. No code was changed to force the six reserved validation photos to pass after their first frozen run. The mapped-photo recognition time was median 4.198 s, maximum 4.555 s in the recorded local run, excluding diagnostic rendering. These timings are not device or server throughput guarantees.

## Answer keys and end-to-end application checks

The current private PDF was re-extracted into 44 exact class/group/version keys, 11 groups and 4,400 answers. CSVs agree with the extracted pages. All 1,892 cross-key pairings were rejected by the grading contract; exam, group and version must match, and revisions remain explicit. This is a key-selection test, not recognition accuracy. No official keys were approved; contents stay under ignored private directories and are not teacher-facing.

The raw S01 photo was selected in the actual mobile web application. Its 100 observations appeared in the shared review queue, with no attached real identity. A separate **explicitly derived test copy** replaced only the identity header with a fabricated candidate/QR. Pixel equality/hash checks preserve the photographed answer/version area. The fabricated QR decoded to its synthetic candidate, the exact Class 8 / Paper B synthetic test key was applied, and an internal DRAFT was displayed in web review. This does not establish original-photo identity or QR accuracy.

The private flow exercises correction/reversal and retained audits, original-photo duplicate detection, missing original QR, crop-specific rejection, teacher key/score confidentiality, uncertainty blocking verification, and publication/public-search refusal. Original identity failures remain failures. Existing automated suites cover invalid signed QR, conflicting identities, wrong groups/versions, retries, queue recovery and double publication. No synthetic identity copy or confidential key enters CI artifacts.

Mobile capture now emphasizes all four corners plus page margins, flat paper, parallel camera positioning, original resolution and low-resolution/blur/lighting warnings. Tilt advice and the overlay are guidance, not a validated live page detector. No Android camera/device installation or iOS/Xcode test is claimed. Browser testing is the available fallback; hosted Android build results must be observed separately.

## Reproducibility and private review

`physical-benchmark.py --split calibration --freeze` records the code and source hashes before `--split validation`. Changing the frozen optical code/dataset prevents another run being represented as the same held-out experiment. Private label tooling starts with empty answers and never loads keys/predictions. An inaccessible local-link workflow has a text/CSV comparison alternative; a blank transcription CSV is also available. User feedback after seeing predictions must retain that review method.

Private evidence is under ignored `tmp/omr-reference/physical-validation/`: separate calibration/validation reports, all 24 diagnostic images, per-sheet observations, confidential deduplication crops and `comparison-pack/ALL-PHOTO-READINGS.txt` / `.csv`. The latter contains provisional readings for all 17 mapped sheets and explicit rejection reasons for the other seven. No identifying values, images, actual responses or key contents are committed. `physical-validation-summary.json` is the sanitized aggregate/sample-status report.

Local checks observed: 37 Python scanner tests, 5 key-parser/human-label helper tests, 44 feature Node tests, 5 real API/queue-recovery checks, private photo web/mobile/correction/publication-boundary flow, backend/web/mobile builds and scoped web type-check. The positive PDF test is explicitly skipped on Windows; hosted PostgreSQL 17, Linux PDF, broader regression and Android reruns for this milestone remain to observe. Synthetic benchmark remains 1000/1000, median 1.084 s/max 1.245 s; it is not physical accuracy.

**Verdict: substantial physical compatibility progress, still not production-ready.** Independent human transcriptions, review of uncertain/multiple responses and question numbering, original QR/identity validation, seven failed captures, actual device testing and release authorization remain outstanding. Official scoring/publication stays locked.
