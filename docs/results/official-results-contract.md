# Official Results Foundation Contract

This contract is the implementation boundary for the Results profile, corrections, and DMC work. It describes new exam-specific records only; `Student.testScore` and the read-only legacy Results view are never official sources.

## Roles and data boundaries

- `SUPER_ADMIN` and `ADMIN` may read official result records through authenticated admin APIs.
- Only `SUPER_ADMIN` may create an examination, enter a draft result, correct a result, change verification/publication state, prepare or issue an Official DMC, or revoke one.
- `TEACHER`, `ACCOUNTANT`, anonymous users, and student users receive no access unless a separately reviewed, explicit scope/authentication contract is added. The current repository has no student-authenticated session, so no candidate result endpoint is mounted in this milestone.
- Public `/api/results/search` and `/api/results/merit-list` remain fail-closed. No endpoint accepts marks from an OMR client.
- The OMR scan and recognition evidence are immutable inputs; administrative corrections are separately audited.
- Keys, scan images, and unnecessary personal identifiers are excluded from result DTOs, correction audit snapshots, PDFs, and logs.

## Result state

The additive data model consists of:

- `Examination`: exact exam reference/title/session/date/class-group, maximum marks, question count, an approved scoring-policy snapshot, and exam publication state.
- `ExaminationPaperKeyRevision`: immutable exam-specific mapping from each allowed paper version (A/B/C/D as applicable) to a non-secret answer-key revision identifier. The key contents are never stored in or returned by this feature.
- `ExaminationPublicationAudit`: append-only, reasoned revision history for an explicit examination publish/withhold action.
- `ExaminationResult`: immutable student/exam association, optional source-scan reference, paper version, nullable aggregate mark/count fields, identity/scoring/verification/publication states, result revision, and verification/publication actor/timestamps. Unscored values are `null`, not zero. Unique `(studentId, examinationId)` prevents an exam's result being overwritten by another exam.
- `ResultQuestionResponse`: one row per result/question, with detected and reviewed answer, final classification, marks, source, and review metadata. It contains no answer key.
- `ResultCorrectionAudit`: append-only audit entry with result/student/exam IDs, previous/new revision, only the changed result fields, a required reason, actor, timestamp, source, and publication impact.
- `DmcIssuance`: immutable issued-document revision snapshot and unique opaque verification reference. `DmcIssuanceEvent` is append-only and records issued, superseded, and revoked transitions. A short-lived, actor-bound preparation snapshot is used for exact preview-before-issue; it is consumed on issue and is not itself a certificate. No public route resolves a student by roll number.

Use Decimal-backed numeric marks; never infer `marksPerQuestion`, grades, qualification, or subject breakdown. Counts remain unavailable when they were not authoritatively recorded.

## API contract

All admin APIs use `authenticate` and role authorization server-side, Zod validation, `Cache-Control: no-store`, safe errors, and stable IDs.
Examination read DTOs return the current concurrency `revision` and allowed `paperVersions`; the per-version key revision IDs and key material remain server-side.

- `GET /api/results/admin/students/:studentId` — `SUPER_ADMIN`/`ADMIN`; exam-specific history. Empty history is a valid empty array.
- `GET /api/results/admin/examinations` — `SUPER_ADMIN`/`ADMIN`; bounded examination metadata for explicit exam selection.
- `GET /api/results/admin/results` — `SUPER_ADMIN`/`ADMIN`; bounded, paginated official result rows and status filters for the connected dashboard.
- `GET /api/results/admin/:resultId` — `SUPER_ADMIN`/`ADMIN`; detail and question responses.
- `GET /api/results/admin/:resultId/corrections` — `SUPER_ADMIN`/`ADMIN`; correction history, newest first.
- `POST /api/results/admin/examinations` — `SUPER_ADMIN`; create exam metadata, the complete non-secret paper-version-to-key-revision map, and approved scoring policy, never an answer key.
- `POST /api/results/admin/examinations/:examId/publication` — `SUPER_ADMIN`; expected exam revision, explicit `PUBLISH`/`WITHHOLD`, and reason; append-only audit and compare-and-set revision.
- `POST /api/results/admin/examinations/:examId/results` — `SUPER_ADMIN`; create an unpublished draft result tied to exact student and exam IDs; initial entry is audited.
- `POST /api/results/admin/:resultId/corrections` — `SUPER_ADMIN`; body includes `expectedRevision`, meaningful `reason`, `source`, and supported proposed fields. A single transaction verifies revision and association, updates the row, supersedes affected DMCs, advances revision, and appends the audit. Stale revisions return `409`.
- `GET /api/results/admin/:resultId/dmc/electronic` — `SUPER_ADMIN`/`ADMIN`; only the current verified, published, non-withheld result. PDF response is private/no-store and bound to its revision.
- `POST /api/results/admin/:resultId/dmc/official/prepare` — `SUPER_ADMIN`; snapshots an eligible published revision and returns an exact preview PDF plus opaque preparation ID. It does not issue a certificate.
- `POST /api/results/admin/:resultId/dmc/official/issue` — `SUPER_ADMIN`; requires preparation ID, expected revision, and idempotency key; atomically issues only the unchanged prepared revision.
- `GET /api/results/admin/:resultId/dmc/official/:issuanceId` — `SUPER_ADMIN`/`ADMIN`; only a current issued document.
- `POST /api/results/admin/:resultId/dmc/official/:issuanceId/revoke` — `SUPER_ADMIN`; required reason and audit-safe state transition.
- `GET /api/results/verification/:reference` — exposes only valid/invalid/current/superseded/revoked and exam title/date; never candidate identity or marks.

No candidate-facing endpoint is activated until the repository has an established student identity/session mechanism that can prove ownership without roll-number-only access.

## Corrections and publication

- Expected-revision compare-and-set prevents lost updates. Reasons are required and length-limited.
- Examination publication and each result publication are separate explicit actions; publishing a result requires a published examination.
- A result's explicit paper version must match an exact `ExaminationPaperKeyRevision` mapping. No A/B/C/D version is inferred from answers or score.
- A score-only administrative adjustment preserves original response counts and sets `administrativelyAdjusted`; it never synthesizes question classifications.
- If question responses are changed, compute counts only from final classifications, and calculate marks only from the examination's approved scoring policy.
- A published correction preserves its old values in audit, advances revision, invalidates/supersedes old Official DMCs in the same transaction, and requires a fresh reviewed issuance. It does not publish automatically unless the explicit correction request separately requests the guarded publication transition.
- E-DMC and Official DMC generation require examination `PUBLISHED`, result `VERIFIED` and `PUBLISHED`, a current revision, and zero unresolved responses. Missing evidence blocks the PDF instead of fabricating values.
- Result creation, verification, publication, DMC preparation, issue, and revoke require explicit actions; OMR scan ingestion remains inactive.

## Migration / runtime boundary

The migration is additive and includes database-level append-only enforcement for correction audit records, issued document snapshots, and issuance events. It is not applied to production. No result rows are backfilled from legacy score fields. Automated tests must use synthetic data and a disposable local PostgreSQL-compatible database.
