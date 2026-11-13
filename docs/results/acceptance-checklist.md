# Official Results Acceptance Checklist

Use only a disposable PostgreSQL-compatible database and synthetic students. This checklist is for development/CI review; it does not authorize applying migrations or deploying to production.

## Data and migration

- [ ] Review the additive migration against the Prisma model and current `main` schema.
- [ ] Apply it only to a newly created disposable database; verify no live connection string or production credential is present.
- [ ] Confirm there is no backfill from `Student.testScore`, and that legacy results remain labeled unverified.
- [ ] Verify student/examination uniqueness, numeric mark bounds, count consistency, response question bounds, and foreign-key delete restrictions.
- [ ] Verify correction audit, examination publication audit, issued-document snapshots, and issuance-event rows reject mutation/deletion at the database layer.
- [ ] On the disposable database, confirm the runtime login is not a superuser, table owner, or `BYPASSRLS`; exercise actual grants and policies using that login, since policy declarations alone do not prove enforcement.
- [ ] Confirm the migration can be rolled back from a pre-migration disposable backup; do not use a production backup for this test.

## Student profile and dashboard

- [ ] Open a synthetic student with no result; show “No examination result has been recorded for this student,” with no zero score.
- [ ] Create two synthetic examinations and confirm the student's profile lists both without replacing either result.
- [ ] Open a result from the connected dashboard and confirm it navigates to that exact immutable student ID and the Examination Results section.
- [ ] Return from the profile to the dashboard and preserve the selected examination context.
- [ ] Check verified-unpublished, published, withheld, corrected, and superseded-document states.
- [ ] Confirm legacy records and fictional demo records remain visually separate from official result rows.
- [ ] Check responsive desktop/tablet/mobile widths, keyboard navigation, modal focus, and loading/error/empty states.

## Permissions and privacy

- [ ] `SUPER_ADMIN` can create examination metadata, enter a draft result, correct it, publish/withhold, and issue/revoke an Official DMC.
- [ ] `ADMIN` can read allowed result details and correction/document history, but all result/examination mutations return 403.
- [ ] `TEACHER`, `ACCOUNTANT`, anonymous clients, and student-role clients cannot read or mutate admin result data without an explicit reviewed scope.
- [ ] Public `/api/results/search` and `/api/results/merit-list` remain fail-closed and return no marks.
- [ ] No candidate result route accepts a roll number or arbitrary result ID as proof of ownership. Student self-service remains disabled until a real student-authenticated session is implemented.
- [ ] Admin result responses and PDF downloads use `Cache-Control: no-store`; responses contain no answer-key data, scan images, full CNIC/B-Form, or unrelated personal data.
- [ ] Only authenticated `SUPER_ADMIN`/`ADMIN` can download eligible E-DMCs or current Official DMCs; anonymous, teacher, accountant, and unrelated roles receive no PDF.
- [ ] A PDF download requires the result ID and issuance ID to belong together; an issuance from another result, a superseded/revoked issuance, or an expired/other-actor preparation preview is rejected.
- [ ] Document verification references disclose only validity/current/superseded/revoked state and approved exam metadata, never candidate identity or marks.

## Corrections and publication

- [ ] Reject correction requests with a missing/short reason, invalid marks, invalid response counts, duplicate/out-of-range question numbers, or invalid state transitions.
- [ ] Accept a valid correction only for the expected current revision; stale revisions return 409 without partial updates.
- [ ] Confirm old/new values, actor, timestamp, reason, source, and publication impact are recorded in an append-only audit row.
- [ ] Confirm a score-only adjustment preserves OMR/question counts and is labeled “Administratively adjusted score.”
- [ ] Confirm question-level changes recompute marks/counts only through the approved examination scoring policy.
- [ ] Confirm examination publication and individual result publication require separate explicit Super Admin actions.
- [ ] Confirm withheld/unverified/unpublished/unresolved results cannot generate or download public/student certificates.
- [ ] Confirm a published correction supersedes old Official DMCs atomically and requires a new explicit reviewed issue.
- [ ] Confirm original scan evidence is not altered or deleted by any correction.

## E-DMC and Official DMC

- [ ] Generate synthetic PDF samples and verify the files begin with a valid PDF signature and contain selectable text.
- [ ] Render both templates to images; verify A4 page size, margins, pagination, no clipping/overlap, correct logo, and legible text.
- [ ] Check E-DMC includes the exact current published/verified revision, truthful available counts, and no guessed grade, qualification, or section scores.
- [ ] Check Official DMC preview matches the exact prepared snapshot that is later issued; its issuance number/reference is unique and revision-bound.
- [ ] Confirm issue is idempotent, revocation requires a reason, old revisions become superseded, and old document downloads are rejected as current.
- [ ] Confirm preview and download routes are bound to the requested result, prepared/issued document, role, and current revision; all PDF responses are private and non-cacheable.
- [ ] Confirm no answer key, QR signing secret, raw scan, or full CNIC/B-Form appears in either PDF or PDF metadata.

## Regression and release gate

- [ ] Run Results API, permission, correction, PDF, and frontend tests with synthetic fixtures.
- [ ] Run relevant student registration/profile/edit/document, attendance, roll-slip, OMR-print, QR, finance, authentication, and Results regression tests.
- [ ] Test pagination/filtering against at least 4,000 synthetic records without downloading the entire dataset.
- [ ] Verify the live public Results page remains in its empty/pre-publication state and production backend/data were not changed.
- [ ] Do not merge, migrate, restart production services, publish marks, or deploy until the exact reviewed release receives separate authorization.

## Current infrastructure limitation

The existing application authenticates staff accounts only. Student-owned E-DMC access must remain unavailable until an established identity-verification and student-session flow exists; roll number alone is not an authentication method.
