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
