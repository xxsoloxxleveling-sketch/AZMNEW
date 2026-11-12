# AZM Scan — Stitch Precision Engine UI integration

Status: **draft development UI**, not a production release.

## Source and visual scope
Recreated five screens supplied in the private Stitch OMR UI/UX ZIP: (1) invigilator login, (2) home dashboard, (3) exam selection, (4) live camera scanner, and (5) pre-upload preview/quality check. The screenshots are reference assets; no example user credentials, real student records or fabricated staff names are embedded.

Implementation: apps/omr-mobile/src/StitchApp.tsx, StitchIcon.tsx, stitch.css. The mobile entrypoint mounts the React screen tree; existing session.ts, UploadPanel.tsx, CameraCapture.tsx, ScanReview.tsx, and OmrClient remain responsible for actual operations.

## Design → backend contract

| UX area | Existing route | Operational behavior |
| --- | --- | --- |
| Staff login | POST /api/auth/login via createMemorySession.login | Role comes from the server. Displayed role labels are noninteractive, not authorization choices. |
| Assigned examinations | GET /api/omr/exams | Cards display the assigned exam's real code, title, date, group, question count, allowed versions, session and status. |
| Exam permissions | Exam.permissions array plus API authorization | Scanning is disabled when not permitted. |
| Dashboard | GET /api/omr/exams/:examId/stats | Counts are actual scan statuses, review and rejected counts plus batches. No invented throughput. |
| Recent / history | GET /api/omr/exams/:examId/scans | Candidate associations remain unverified unless the backend verifies them. |
| Review queue | GET /api/omr/exams/:examId/scans?status=REVIEW_REQUIRED | Server-side status filtering; existing ScanReview controls correct answers and retains audit trail. |
| Camera | CameraCapture, getUserMedia and ImageCapture | Cyan corners are visual framing guidance, not a measured live lock. Permission and image quality come from the device. |
| Image preview | optimizeCapture and inspectOmrImage | Actual saved-image dimensions and compression sizes are measured. Insufficient resolution is blocked. |
| Upload | POST /api/omr/exams/:id/batches?source=mobile | Authenticated existing upload and error behavior. |
| Processing | GET /api/omr/batches/:batchId | Live worker state; upload does not imply verification. |
| Scan evidence | GET /api/omr/scans/:scanId, authorized image endpoints | Retains full 100-question review, original image, QR close-up, and correction history. |
| Verified/draft workflow | Existing PATCH review and POST approve/reject | Existing permission and audit gates. No new publication authorization. |
| Settings | Memory session and POST /api/auth/logout | No persistent local credentials or photos. |

## Mockup claims that are deliberately excluded
Illustrative 99.8% confidence, QR Verified 100%, 120 sheets per minute, 1.4 sec/sheet, invented people and scores, biometric login, 4-corner live AI lock, automatic burst scanning and official answer key preloads were not implemented as factual capabilities. The source ZIP is a UI reference, not evidence these features exist.

Existing review/history/settings remain functional, rather than becoming inert static designs.

## Validation
- Mobile TypeScript and Vite production build.
- Synthetic browser test: tools/omr-dev/stitch-ui-browser.test.mjs verifies role-safe login, live exam details and metrics, permission-aware navigation, review filtering and low/high-resolution guard.
- Existing mobile-review-browser.test.mjs still tests uploads, polling, OCR candidates, corrections and race isolation.
- Visual QA with 402px phone and 780px tablet screenshots using synthetic backend responses.
- No production migrations, official-key approval, student-mark changes or result publication.

Remaining: install and test the rebuilt Android APK on the Samsung tablet using the disposable backend, retake a new high-resolution physical OMR photo, verify worker recognition, and independently label answers before claiming 99% accuracy.



## CamScanner-style automatic capture and continuous sheet mode

The camera now uses a lightweight on-device preview analyzer in
src/features/omr/page-detection.ts to identify a bright, approximately A4-shaped
quadrilateral against a darker surface. The polygon overlay is *a preview
estimate*, never a substitute for the worker's printed-marker validation.
The detector rejects near-uniform backgrounds, images with clipped page
extents, unsupported proportions and unstable corners; it requires four
consecutive observations and a 1.25-second stable hold before triggering the
full-resolution photo. The original still image is used (when supported),
then conservatively JPEG-compressed without changing normal 12 MP dimensions.

Staff can toggle automatic capture, automatic upload and continuous scanning.
Continuous mode accepts one image at a time, keeping the camera running after
the backend acknowledges an upload. The detector only rearms after the previous
sheet has visibly left the preview for multiple observations. This prevents
repeated uploads from the same unmoved page. Server duplicate protection
remains independently required. Camera/connection/permission failures retain
explicit manual shutter, retake, gallery selection and manual upload fallbacks.
Uploads require a signed-in authorized staff account and an assigned exam.
There is no background/offline storing of confidential images.

A preview page polygon does not imply a decoded QR, verified roll number,
correct answer, approved answer key, high measured accuracy, or a published
grade. All those assertions continue to come from the authenticated backend
and auditable human review. If the desk/background is too light or the sheet
is curled, manual capture remains available.

Validation added:
- tools/omr-dev/auto-page-detection.test.ts tests page geometry, empty/cropped
  cases, movement resetting stability, and frame/time capture gating.
- tools/omr-dev/auto-camera-browser.test.mjs uses an isolated synthetic
  browser camera and API to verify exactly one upload per stable sheet,
  no duplicate while the same page remains in view, and a second automatic
  upload only after removing and re-presenting a page.
- Both suites are included in GitHub Smart OMR isolated checks.

Physical Samsung camera acceptance is a separate gate; never infer 99% physical
accuracy or real QR validation from these synthetic browser tests.
