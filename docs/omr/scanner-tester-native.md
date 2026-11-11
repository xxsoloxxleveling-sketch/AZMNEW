# AZM Scan: scanner-only tester (native Android)

Development-only implementation on draft PR #28. No production migration or scoring permission.

## Scope
The tablet opens to a single scanner tester: start automatic scan, privately saved pages, preview, delete and optional isolated-backend recognition upload. The old dashboards, examination metrics, history and navigation are removed from the active mobile entrypoint. Authentication is only needed when the user explicitly chooses to test the backend.

## Native document capture
The Android Capacitor plugin AzmNativeScannerPlugin wraps Google's ML Kit Document Scanner. Google Play services provides document finding, live corner detection, automatic capture, crop adjustment and batch flow. Some devices require a one-time scanner component download. Use SCANNER_MODE_BASE and JPEG export to avoid document-beautification filters altering OMR bubble ink. The ML Kit scanner's crop still needs physical testing to ensure the four printed OMR fiducials remain visible; a crop that loses markers is not valid OMR evidence.

After the user confirms a scan in the native flow, JPEGs are copied to Android's application-private files/scanner-test-images directory. Up to 10 pages per native scan and 40 retained test pages total, max 20 MB each; no automatic deletions. The scanner list is read again after app/WebView restart, so accepted pages survive a screen reload. Deleting a page requires user confirmation. The app uses FLAG_SECURE and does not log student identities or image bytes.

Native scanning does not require API login. **Uploads are opt-in** and require staff authentication plus an exam for which the server grants scanning permission. An upload does not verify a QR, roll, score, answer, or publication. Worker failures are displayed and do not delete the saved page. Production and official-scoring gates are unchanged.

## Quality and limitations
The previous JavaScript bright-rectangle detector could lock onto a computer screen rather than a real paper. The three last development test uploads failed with WORKER_FAILED and were not mapped/graded. They must not be counted as successful physical-sheet validations. This implementation uses the Android document scanner instead of the homemade canvas detector.

Expected acceptance: build/typecheck, synthetic scanner-only browser test, Android Java compilation, installed APK checksum, manual inspection of native ML Kit camera and return-to-app flow on Galaxy Tab S9, full-resolution original printed OMR photo, all four markers and 100 question grid mapping. Results remain synthetic-only until independently validated.

## Risk and preservation
The scanner outputs are private app files, not gallery copies. **Uninstalling the APK destroys these files.** Future development signing-key changes must back them up first; installation must never silently uninstall a scanner with saved pages. A scanner emulator/browser preview is not proof of physical camera quality. Do not loosen backend alignment constraints to make a malformed scan pass.


## Returning 100 MCQs and marks to the tester
After capturing a page, select **View MCQs & marks**, sign into the isolated test backend, choose the authorized exam, then select **Recognize this page & view 100 MCQs**. The existing batch API is polled until a page scan is recorded, then the authenticated scan-detail endpoint supplies the actual responses: question 1–100, A/B/C/D, BLANK, MULTIPLE or UNCERTAIN, plus separate human-reviewed answers and evidence. Failed/invalid pages explicitly show errors; there is no invented answer data.

Backend marks are only displayed if the authorized scan-detail response includes a score and maximumScore; server-side role restrictions still apply. Without verified identity and a matching approved key, no backend mark is fabricated. Administrators can optionally paste a 100-choice key to compute a **local practice subtotal** from the actual detected choices and exam marking policy. This key never leaves React component memory, is not saved or sent, and is labelled unofficial, especially when any bubble remains unresolved. Teachers cannot invoke the local test-mark preview.

The native JPEG stays safely stored even if recognition fails. The app neither publishes a result nor changes exam keys, candidate verification, or scoring permissions. These are read-only scan-report additions and optional isolated uploads; official scoring remains locked pending physical verification.


## Native ML Kit crop below 1600 pixels (November 11, 2026)
The native document scanner sometimes produces a JPEG with a 1599-pixel
short side after applying its crop. The scanner-only tester previously rejected
all photographs shorter than 1600 pixels *before uploading*, despite the isolated
OpenCV worker accepting image input down to 600 pixels and applying independent
printed-marker, focus and template checks. A single missing pixel was not a
meaningful image-quality failure.

The scanner tester now accepts original native crops with a short side of at
least 1536 pixels (4% tolerance from the preferred 1600), preserving the existing
20-megapixel limit. A visible warning marks below-preference captures as
**submitted for inspection, not verified**. Crops below 1536 remain blocked;
neither upscaling nor auto-correction is performed. Backend QR and geometry
validation are untouched, and unsupported crops still return explicit errors.

Synthetic tests cover 1599 × 2571 acceptance, 1535-pixel rejection, max-pixel
rejection, image validity and 100-response/marking behavior. Full physical
OMR accuracy and QR legibility remain independently unverified.


## Guarded frame-grid recovery and clear alignment diagnostics (November 2026)

The printed four registration squares are *not* enough to recognize a sheet. The
framed-layout worker now:
1. Uses a stronger Hough accumulator for bubble candidates, then counts only
   circles inside each of the four independently verified MCQ column regions.
   Extraneous circular artwork/lettering outside those regions cannot reject a
   fully supported 100-bubble-row layout.
2. Requires four column headers, 25 observed row clusters per column, strict
   row pitch, printed bottom rules, frame support, a validated page quad,
   calibrated black-header ink and four paper-version bubbles.
3. Allows up to six unobserved circle candidates in an otherwise verified
   25-row column and a maximum row vertical spread of 14px (previously 9).
   At most eight affected rows per column may be provisional.
4. **Always converts every recovered/unstable row into UNCERTAIN with reason
   UNVERIFIED_PRINTED_BUBBLE_GEOMETRY**. No guessed/inferred bubble can become
   a confident A/B/C/D answer or an official grade.
5. Still requires full optical registration, focus, QR and paper-version review;
   physicalValidationRequired remains true and officialScoringAllowed false.
   Missing corner squares, missing columns, 24/26 rows, fake-only markers and
   partially damaged timing-track templates remain rejected.

This corrects an over-strict global Hough count: a privately retained scanner
photo had 911 global proposals but showed four actual printed MCQ headers and
the expected 25-row structures. In an isolated test run the recovery produced
100 **provisional** question readings including unresolved/uncertain evidence.
No real-world accuracy claim follows from this monitor-photograph test; use a
physical printed sheet to validate the registration markers, QR and marks.

The mobile error string for PAGE_ALIGNMENT_FAILED is now precise: it mentions
the full printed column-and-bubble grid, rather than falsely claiming the four
corners themselves failed. Regression tests include synthetic extra circles,
missing bubbles forced UNCERTAIN, missing pairs still rejected, missing
corner/column still rejected, and the existing engine/physical-layout suite.
