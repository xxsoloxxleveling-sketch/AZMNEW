# Examination Attendance — Classic Hall Workspace

Classic client-approved profile: match the production Dashboard, Students and Exam Halls at the 13A baseline. Use compact white panels, subtle slate borders and shadows, restrained rounded-xl corners, blue primary actions and dense tables. The global shell and MASTER are unchanged.

## Product rules

- Exam attendance only. Test Center → Exam Hall → Attendance Session → Frozen Hall Roster → Attendance.
- Hall is the scope. Membership comes only from explicit assignedHallId assignments snapshotted by the backend when a session opens.
- Class is informational row metadata only. No class scope/filter, global student picker or inferred membership from legacy Hall/room/seat text.
- No Session != 0%. Display an em dash when there is no denominator; a real zero percentage requires actual expected candidates.
- NOT_MARKED != ABSENT. Opening a session and closing without explicit conversion retain Not Marked candidates.
- Attendance records are immutable. Marked rows show Recorded and have no edit/delete controls.
- Mobile QR scanning is separate and dormant. No camera access or scanner-first attendance flow.
- Closed sessions retain historical integrity. Render session Hall/Center/date/time snapshots and frozen candidate fields, not current configuration.
- Legacy attendance, if displayed later, must be separately labelled Legacy attendance record and excluded from session metrics.

## Operational behavior

Admins select a real Center/Hall, review explicit candidate count and confirm opening. Zero explicit candidates disable opening; backend conflicts are shown directly. Teachers select authorized existing session snapshots because configuration endpoints are admin-only. Accountants receive no operational attendance view.

Session summaries use backend Expected, Marked, Present, Late, Absent, Not Marked and percentage. Roster search/pagination call only the selected session candidate endpoint. Candidate rows show seat, name, roll, application, informational class, recorded status/method/time and operator label only if supplied; missing values show an em dash. No identity/contact/fee/document/parent information.

Manual marking uses a contextual Present/Late/Absent form. Success requires a backend record, then metrics/roster are refreshed. Closing requires confirmation; the option to mark remaining Not Marked candidates Absent starts unchecked. Closed sessions remain viewable and cannot be marked.

History is paginated within the selected Hall, with date/status filters and authoritative snapshot metrics. Failed reads show a labelled failure with Retry; they never become successful empty or zero states. Failed writes remain inline in the dialog and never fabricate success.

## Accessibility and responsive QA

Attendance-local dialogs provide semantic labels, initial focus, Tab containment, Escape dismissal when not submitting, background inertness and focus restoration. Forms have labels; statuses have text as well as semantic colors; submitting controls disable duplicate actions.

Verify 1440×900, 768×1024 and 390×844. Selectors stack on mobile. Tables scroll inside their own regions; the page has no horizontal overflow. Dialog bodies scroll separately from reachable confirmation footers. Motion is limited to functional feedback.

## Release gates

#attendance is enabled locally in the 13C candidate for ADMIN, SUPER_ADMIN and TEACHER. The Classic sidebar exposes Examination Attendance only to those roles. Teachers use the same Hub with restricted permissions. #scan, storage, fees and payroll remain deferred; the dormant scanner entry is hidden. No global-shell redesign or camera release is included. This is local UI work; no production reconciliation, push, deployment or production migration.

Local acceptance uses disposable PostgreSQL databases and synthetic accounts. Migration rehearsals cover both the complete clean chain and an upgrade from 9fef4f57; no additional 13C migration is introduced. Production remains unchanged.

The aggregate production audit at 2026-10-07 22:55:21 Asia/Karachi confirmed 0 Attendance rows, 0 explicit assignedHallId allocations and 18 legacy text allocation footprints inside a read-only transaction. Legacy text does not establish examination membership.

PRODUCTION ATTENDANCE RELEASE REMAINS BLOCKED UNTIL INTENDED EXAM CANDIDATES HAVE EXPLICIT HALL ASSIGNMENTS.
