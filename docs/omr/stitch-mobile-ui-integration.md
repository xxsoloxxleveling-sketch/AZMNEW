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
