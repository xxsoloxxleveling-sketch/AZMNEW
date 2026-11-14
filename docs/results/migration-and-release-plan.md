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

The new backend cannot start against the old schema: its pre-listen database safety guard queries the official attempt binding and immutable DMC replacement structures. The runtime grant script also references `DmcReplacement`. **Do not activate the new backend before the four reviewed additive migrations and matching grants are present.**

1. Before the maintenance window, build and stage the exact reviewed backend and frontend artifacts **without activating or publishing them**. Verify source SHAs and release compatibility, preserve the current running backend and frontend rollback artifacts, and check the approved recovery checkpoint.
2. At an explicitly authorized cutover, ensure no examination, QR, attendance, or result writers will be interrupted. Fence writes or pause the old backend only if the release owner has verified a safe method; do not infer that all changes are backward compatible.
3. Apply, in order, `20261113070000_official_examination_results_and_dmc`, `20261114010000_preserve_exam_history`, `20261114020000_official_result_attempt_binding`, and `20261114030000_dmc_replacement` through the approved migration owner. Recheck the actual production migration ledger and stop for unexpected history or migration failures; do not run `prisma db push` or ad hoc live SQL.
4. Reconcile runtime grants and RLS policies using the reviewed operator-approved `runtime-grants.sql` process, **after** the new tables exist. Confirm the restricted login can SELECT/INSERT replacement audits, cannot UPDATE/DELETE/TRUNCATE them, and has both active DMC replacement triggers and the expected RLS policies.
5. Activate the staged backend only after migration and runtime-grant checks. Require the pre-listen startup safety guard to pass. Confirm API health, authorized staff result reads, public lookup fail-closed behavior, and regression checks for student, attendance, finance, registration, and QR flows before continuing.
6. Publish the matching frontend artifact only when the backend is healthy and the reviewed API contract is available. Recheck automatic `main` → `deploy` publication effects before merging the PR.
7. Run authorized read-only smoke checks; keep new official results unpublished and candidate-facing document routes disabled. Creating production examination metadata, entering marks, issuing documents, or publishing verified results requires separate explicit authorization.

**Rollback:** If the new backend fails after the additive migration, first restore the prior compatible application artifact while retaining the new, unused schema. Do not drop audit tables or reverse migration history automatically. If the schema change is not backward compatible or the old backend cannot safely run, halt and use the independently approved recovery procedure rather than improvising a database rollback.

## Rollback

The preferred rollback is **application rollback while retaining the additive schema**. Roll the frontend/backend artifacts back to the last approved compatible version, keep the new tables unused, and investigate. This avoids deleting new audit or issuance history and avoids coupling an application rollback to a destructive schema rollback.

Do not automatically drop the new tables or reverse audit triggers after any real use. A schema rollback is a separate, reviewed recovery operation requiring a verified backup, a complete inventory showing the new structures contain no retained operational records, and explicit approval from the database owner. Preserve correction history and issued-document snapshots if any official result workflow has been used.

If migration itself fails, stop the deployment, retain logs without exposing secrets or personal data, and use the database owner's recovery procedure. Do not manually delete partially created objects in production. A restore from the verified pre-migration backup is the fallback only when approved by the database owner and when the recovery point is acceptable.

## Release boundary

- No production deployment, migration, service restart, result entry, mark correction, publication, or DMC issuance is part of this branch work.
- No legacy `Student.testScore` values are treated as official or copied into the new model.
- Candidate-owned E-DMC downloads are not ready until student authentication and owner-scoped authorization exist.
- A staging/production migration rehearsal, broader regression suite, and organizational review of role grants and retention policy remain release gates.
