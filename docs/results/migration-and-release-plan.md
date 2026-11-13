# Official Results migration and release plan

This plan is for review only. The migration has **not** been applied to production, and this document does not authorize a production release.

## What the migration changes

The `20261113070000_official_examination_results_and_dmc` migration is additive. It creates exam-specific result, per-version key-revision mapping, question-response, publication-audit, correction-audit, and DMC issuance/event structures, plus constraints and append-only triggers. It does not alter the existing `Student` rows or legacy score fields, backfill results, change answer keys, publish marks, or add a candidate-facing authentication route.

The API and UI changes remain gated by staff authentication and server-side roles. Only `SUPER_ADMIN` can mutate official exam/result state or issue/revoke an Official DMC. `ADMIN` can read permitted staff data. Public result lookup remains fail-closed. Student self-service remains disabled until a real authenticated student session can establish record ownership.

## Before any production migration

1. Review and approve this exact branch, commit, migration SQL, Prisma schema, and deployment artifact. Confirm the target production database and the exact runtime database role through the existing deployment owner; do not print credentials.
2. Confirm the production schema is at the expected pre-migration revision and that the app version running during migration is compatible with the additive tables.
3. Take and verify a current database backup using the organization's approved backup process. Record the backup identifier and restoration owner.
4. Apply the migration to a fresh disposable PostgreSQL-compatible database and to a production-like staging database. Run Prisma validation, the migration smoke test, API authorization tests, and document-generation checks against synthetic students only.
5. Inspect the actual runtime role grants and confirm it is not a superuser, table owner, or `BYPASSRLS`. Verify the specific read/write operations required by the service. The current migration's RLS policies are permissive and are not row-level tenant isolation; API authentication and object-level authorization remain necessary.
6. Confirm no answer-key contents, production credentials, scans, or student marks enter build artifacts, browser bundles, logs, or test fixtures.
7. Schedule the release with the database and application owners, including a maintenance/rollback decision owner and a stop condition if migration or health checks fail.

## Deployment order and checks

1. Deploy the reviewed backend artifact in compatibility mode while all new exams/results remain unpublished; verify health and existing student, attendance, finance, OMR-print, and legacy Results read-only flows.
2. Apply the additive migration using the approved migration identity, not the general application login. Do not run schema push or an ad hoc SQL edit.
3. Verify migration history, expected table/constraint/trigger presence, and application health without querying or changing real marks.
4. Deploy the reviewed frontend artifact. Keep candidate-facing result/document routes disabled and keep public result lookup fail-closed.
5. Run read-only smoke checks, then create only explicitly approved exam metadata and synthetic/staging result records. Production result entry, verification, and publication require separate authorized operator actions.
6. Confirm E-DMC eligibility requires the exact current verified/published result revision, and Official DMC issue requires the reviewed preparation snapshot and explicit Super Admin action.

## Rollback

The preferred rollback is **application rollback while retaining the additive schema**. Roll the frontend/backend artifacts back to the last approved compatible version, keep the new tables unused, and investigate. This avoids deleting new audit or issuance history and avoids coupling an application rollback to a destructive schema rollback.

Do not automatically drop the new tables or reverse audit triggers after any real use. A schema rollback is a separate, reviewed recovery operation requiring a verified backup, a complete inventory showing the new structures contain no retained operational records, and explicit approval from the database owner. Preserve correction history and issued-document snapshots if any official result workflow has been used.

If migration itself fails, stop the deployment, retain logs without exposing secrets or personal data, and use the database owner's recovery procedure. Do not manually delete partially created objects in production. A restore from the verified pre-migration backup is the fallback only when approved by the database owner and when the recovery point is acceptable.

## Release boundary

- No production deployment, migration, service restart, result entry, mark correction, publication, or DMC issuance is part of this branch work.
- No legacy `Student.testScore` values are treated as official or copied into the new model.
- Candidate-owned E-DMC downloads are not ready until student authentication and owner-scoped authorization exist.
- A staging/production migration rehearsal, broader regression suite, and organizational review of role grants and retention policy remain release gates.
