# Session V manual-mark verification: production ownership-parity release gate

**Status:** Hold for independent DBA authorization and controlled release.
**Source:** PR #51 plus PR #53, not the older staged `507b124` backend build.
**Scope:** Additive manual-mark verification only. Do not change student scores,
OMR sources, attendance, issued official results, or the PR #50 entry history.

## Production-specific discovery (17 November 2026)

A read-only catalog check showed:

| Object | Production owner | Why it matters |
| --- | --- | --- |
| `public."Student"`, `public."User"` | `student_app` | Existing student row lock remains authorized |
| `public."ManualExamMark"` | `postgres` | Existing immutable score has SELECT, but no UPDATE or REFERENCES for `student_app` |
| `public."OmrProvisionalMark"` | `postgres` | Unrelated source must remain untouched |
| `public.azm_record_manual_exam_mark(...)` | `postgres` | Existing SECURITY DEFINER; separately review this elevated owner |
| `public.azm_verify_manual_exam_mark(...)` | *Not deployed* | New RPC must be owned by `student_app` |

The first cutover failed at the foreign key referencing `ManualExamMark`.
The transaction rolled back, the old backend restarted, and the public API
remained healthy. The migration ledger was not advanced.

The initial CI restore had used `pg_restore --role=student_app --no-owner`;
that changed ownership of restored tables and hid the failure. The owner-parity
CI test in `backend/tests/manual-owner-parity-ci.sh` now uses the actual split,
reproduces the failure, and tests the narrow repair.

## Verified source design

- The original manual score is immutable. The verification SQL reads it
  without `FOR UPDATE`, which would otherwise require additional write-like
  privileges on the postgres-owned table.
- `Student FOR UPDATE` remains in the signed RPC and serializes verification
  with OMR/manual source insertion and identity edits.
- The new verification audit is append-only with an enabled
  `ManualExamMarkVerificationAudit_immutable` trigger.
- The new SECURITY DEFINER RPC must be owned by `student_app`. The runtime
  `azm_runtime` needs EXECUTE/SELECT but not direct audit INSERT, table UPDATE
  or REFERENCES.
- The synthetic PostgreSQL 17 owner-parity test verifies one 82/100 entry,
  duplicate and stale rejection, unauthorized reviewer rejection, the
  immutable source and audit, and no remaining REFERENCES grant.

## Absolute database preservation rule

- **Never delete, drop, truncate, reset, replace, or overwrite the live
  database or any student, OMR, attendance, manual mark, DMC or audit table.**
  Commands such as `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`,
  `DELETE FROM`, `prisma migrate reset`, `prisma db push --force-reset`,
  and `pg_restore --clean` are not part of this release.
- Backups are recovery evidence, not an automatic replacement for the
  live database. Roll back the application release without restoring a
  historical snapshot over potentially newer student records.
- The optional `backend/ops/postgres/manual-verification-preflight-readonly.sql`
  runs within a `REPEATABLE READ, READ ONLY` transaction, rejects the
  wrong database name, and reports only aggregate counts/content hashes,
  migration status, object ownership and privileges. Never bypass a blocked
  connection or execution safeguard to run it.
- The CI tests `backend/tests/manual-release-safety.test.ts` and the
  synthetic PostgreSQL preflight step reject destructive SQL in the reviewed
  migration and exercise the read-only gate without real records.
- If any operation would violate this rule or requires additional permission
  beyond the separately reviewed, temporary column REFERENCES grant:
  **STOP. No automatic fallback or destructive cleanup on production.**

## Controlled maintenance procedure (not executable authorization)

1. **Approval gate:** Obtain an independent DBA/release authorization for
   a *temporary column-scoped* grant. Do not infer authorization from this
   document, CI success, or the user's general request to continue.
2. **Identity gate:** Confirm exact validated GitHub commit, deployed PR #50
   path, owner and runtime roles, current migration ledger and read-only
   baseline. Rebuild artifacts from the new merged commit; the earlier
   `507b124` backend stage is stale.
3. **Backup gate:** Fence the frontend deployment timer, quiesce the backend,
   create a fresh custom-format PostgreSQL backup, verify its SHA-256 and
   archive listing, and record hashes/counts for OMR, ManualExamMark,
   Student and Attendance. Preserve the previous backend/frontend release.
4. **Privilege gate:** An approved DBA temporarily grants
   `REFERENCES ("sessionReference","studentId")` on
   `public."ManualExamMark"` **only to `student_app`**, not
   `azm_runtime`. No UPDATE/INSERT grant, ownership transfer, trigger
   disablement or password/role switch is permitted.
5. **Migration gate:** Execute the exactly reviewed PR #51 migration with
   effective SQL role `student_app`. The SQL contains its own BEGIN/COMMIT;
   it should be applied once and must fail closed. A DBA must then **revoke
   the temporary REFERENCES grant even if the migration failed**.
6. **Ledger gate:** Only after schema, FK, trigger and RPC ownership are
   independently verified, record the successful migration with the
   supported Prisma `migrate resolve --applied` procedure. Run
   `prisma migrate status`; do not rewrite any existing migration or fake
   a successful entry.
7. **Security gate:** Assert the new RPC owner is `student_app`, the runtime
   can EXECUTE it, the runtime cannot directly INSERT/UPDATE the audit, and
   neither runtime nor `student_app` retains temporary REFERENCES or new
   UPDATE rights on the old manual-mark table.
8. **Data gate:** Compare counts and content hashes against the quiesced
   snapshot. The new audit should initially be empty. Do not verify a
   genuine candidate merely to prove a release succeeds.
9. **Activation gate:** Stage the new backend as a root-owned immutable
   release, switch only the systemd WorkingDirectory drop-in, and confirm
   health/auth gates. Publish the matching frontend only after backend
   success. Check the public status, an unauthenticated 401, and the
   admin-only feature in a permitted non-mutating workflow.

## Failure and rollback gates

- If a migration transaction fails: immediately revoke any temporary DBA
  grant, verify its absence, confirm the migration ledger did not advance,
  and restart the previous PR #50 backend and frontend publisher. Stop.
- If the additive migration is already committed but activation fails:
  restore the prior backend/frontend release without dropping audit tables,
  changing student marks, or rewriting Prisma history. Escalate schema
  rollback to the DBA; never silently use an old schema snapshot to replace
  subsequent student records.
- If the public lookup discloses pending identity/photo or an unverified E-DMC,
  block frontend publication and investigate before continuing.
- The earlier PR #50 postgres-owned SECURITY DEFINER functions remain a
  separate security-review item and are not altered by this release.

**No production grant, deployment, or data write is authorized by this file.**
