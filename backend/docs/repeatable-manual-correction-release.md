# AZM.AIO — Repeatable Manual Score Corrections: Release Gate

**Status:** candidate only. This document grants no production authorization.

## Feature

The Super Admin can select **Edit manual marks** for a student with a manual score, whether previously approved or pending. Enter a new integer score (0–100), an evidence reference, a reason, and identity/attendance acknowledgements. A second confirmation appends a new immutable correction audit. The original `ManualExamMark.obtainedMarks` and every previous verification record stay unchanged.

The public results and staff roster read the latest correction. An earlier verification never validates a new correction, even when the score returns to an old number: the manual verification audit is bound to `latestCorrectionId`. A corrected score is **Review pending** until the Super Admin approves that exact revision again; verified E-DMC download remains blocked during this period.

**This does not supersede or rewrite any issued Regional Office DMC.** Existing examination result conflicts must use the dedicated official-result supersession workflow. Previously generated result gazettes are dated snapshots; create and approve a new publication after changes.

## Data preservation (non-negotiable)

- **Never** drop/delete/truncate/reset/restore-over the live database, source marks, students, attendance, OMR, or DMC/audit tables.
- Do not edit `ManualExamMark`, `ManualExamMarkVerificationAudit`, or correction audit rows in place.
- The SQL migration only **creates** `ManualExamMarkCorrectionAudit`, adds a nullable revision column to the existing verification table, and redefines the verification RPC to check the latest revision. Existing audits have NULL revision, preserving their original-score meaning.
- The new correction table has **no foreign key** to the postgres-owned `ManualExamMark` table. Unlike the previous manual-verification migration, the new migration is designed to run as the `student_app` owner **without a temporary REFERENCES grant**. Test this with the actual-owner PostgreSQL 17 CI suite.
- Only a currently active Super Admin through the authenticated route can append a new correction. The database RPC repeats the actor, score, evidence, identity, conflict and optimistic **score-and-revision** checks while holding the Student row lock.
- Only the owning function may insert corrections. The runtime role gets SELECT/EXECUTE but no direct INSERT/UPDATE/DELETE.

## Release procedure — requires separate operator approval

1. Freeze and review PR #58, exact HEAD and full GitHub CI; verify new PostgreSQL 17 synthetic tests (77→82→60→77, reapproval, stale/ABA conflict, immutability, restricted runtime, owner parity).
2. Confirm production is still running the known PR #51 release and that the database's migration ledger is unchanged. Inspect current student and source-register counts and fingerprints using a read-only transaction.
3. Create a **fresh quiesced protected `pg_dump -Fc`**, verify SHA-256 and `pg_restore --list` (never restore during normal cutover), retain all existing backups.
4. Apply only `20261117150000_repeatable_manual_exam_mark_corrections` under the reviewed schema owner `student_app` with transactional error handling. Do not grant new REFERENCES or alter old manual marks. Verify the immutable trigger, RPC ownership, restricted grants, and migration ledger.
5. Compare pre/post hashes of existing Student, Attendance, OMR, ManualExamMark, ExaminationResult, and old verification-audit rows. New audit is expected empty initially. Any mismatch: STOP and investigate; **do not auto-restore old data over newer records**.
6. Build backend and frontend from the **same exact commit**; switch backend first, confirm health, authorization 401/403 tests, manual-score query behavior, and absence of 500 errors. Then publish frontend static assets **without deleting old hashed chunks**. Restore frontend publisher timer and check deployed version.
7. Have a Super Admin test a **legitimate, evidenced** correction and reverification (do not alter a real student just for smoke tests). Confirm old score/audit remains, new E-DMC and public result update only after fresh approval.
8. Roll back the application only if compatibility is guaranteed. **Once a correction has been appended, the old PR #51 code is not revision-aware and must not be redeployed** to serve results; maintain a revision-aware compatible backend or stop public score release until fixed. Never restore an old database snapshot automatically.

## Publication

Every public score correction potentially changes pass/fail totals, school lists, student rankings, and gazette output. Regenerate and approve the official Session V gazette after any material changes; never silently modify a signed PDF already published.
