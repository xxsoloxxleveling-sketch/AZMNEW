# AZM.AIO Stage 1 — Preserve-only attendance cancellation

**Status:** proposed stacked feature branch, **not deployed**. Based on PR #16
(which stacks on PR #15, then PR #14). Do not merge or deploy separately.

## User-visible functionality

- Super Admin can reset specific Hall attendance attempts using reviewed PR #14.
  Resets archive the previous attempt's records and open the next empty generation.
- Super Admin can cancel a selected current OPEN or CLOSED attendance session
  using reviewed exact-session, signed five-minute preview, role checks, reason,
  typed **CANCEL SESSION** phrase, idempotency and immutable audit.
- Cancellation archives the exact attempt, blocks future marking of that attempt
  and **keeps every existing mark, method, timestamp, auto-ABSENT entry, frozen
  candidate roster, attendance-history record and related Student/fee/document
  data**. Reopening is explicit and creates the next generation.
- **Permanent deletion of attendance markings is not available in Stage 1.**
  There is no admin UI control or API action for it, even for a CLOSED attempt.
  Historical cancellation-audit reads still show previous values if they exist.

## Defense-in-depth hard-denial points

1. **UI:** only the preserve option is rendered. Only the typed phrase
   CANCEL SESSION is accepted; impact preview states every mark remains.
2. **Client/API:** the frontend sends exactly purgeAttendance=false, rejects
   a destructive server response, and refuses runtime-injected approval fields.
   Backend Zod schemas require literal false and the preserve-only phrase,
   with .strict() rejecting old retention approval fields.
3. **Server:** even if an old HMAC-valid preview explicitly says purgeAttendance
   true, the cancellation service rejects it **before idempotency replay**.
   The server contains no Attendance.deleteMany call in its cancellation path.
   All newly written cancellation audits have purgeAttendance=false,
   deletedCount=0 and retainedCount=markedCount.
4. **PostgreSQL:** NEW additive migration
   20261011221000_staged_attendance_preservation installs:
   - NOT-NULL, validated CHECK on the cancellation audit requiring no purge,
     zero deleted marks and all prior marks retained.
   - Always-rejecting BEFORE DELETE trigger Attendance_staged_no_delete on
     Attendance, independent of any application-specific audit GUC.
   - Existing PR #14/#15 migrations remain byte-for-byte unchanged.
5. **Runtime grants / startup:** the reviewed role-separation grants are
   adjusted to **omit DELETE on Attendance**. The production pre-listen guard
   rejects runtime logins that have Attendance DELETE privileges, lack the
   staged hard-denial trigger, or retain table-owner/migration privileges.

No app environment flag or remotely modifiable setting can enable deletion.
To introduce future hard deletion requires an independently reviewed release
that deliberately changes the API, database constraint and trigger, runtime
ACLs and startup guard and passes fresh retention/OMR/audit approval gates.

## Operational ordering

The prior production-derived backup rehearsal showed the **first three**
migrations apply cleanly and preserve all original records. This branch
adds a **fourth** migration which must be included in a NEW release-approved
migration inventory and production-derived incremental rehearsal before
production readiness may be claimed.

During any separately approved release, after writes are quiesced and recovery
is verified, the migrator/owner must apply all pending migrations in order,
including 20261011221000. Only then may the operator apply the **updated**
runtime-grants.sql, switch both backend DSNs to non-owner runtime credentials,
start the new backend (pre-listen guard must PASS), and publish the paired
frontend. Do not apply the new guard before the fourth migration or before
the runtime credential cutover: it correctly refuses API startup.

The audit CHECK intentionally fails if the target database already has
cancellation operations with purgeAttendance=true. Do not bypass it, remove
old audits or rewrite the migration ledger; stop for separate review.

**Do not automatically execute DDL against production.** All CI tests run
on randomly named disposable localhost PostgreSQL 17 databases. Before any
live cutover, verify current disk headroom, backup/restoration readiness,
effective production roles, inherited quality exceptions, release source
provenance, backend/frontend matching artifacts and timer control.

## Security limits and release blockers

- Non-owner application role still has other broad DML. Cancellation/audit
  forgery via arbitrary SQL with INSERT privileges and application GUCs is not
  fully resolved by blocking attendance deletion alone.
- The OMR/results session linkage is still incomplete, and independent
  CLOSED-session retention authorization is unresolved. This is **why**
  Stage 1 forbids permanent deletion, rather than trusting attestations.
- A privileged table owner can disable triggers or TRUNCATE. The production
  migration/owner credential must NOT be accessible to the runtime service.
  Stage 1 no-delete protection requires **PR #16 role separation**.
- Production disk/recovery checks and maintained release window remain pending.
- The Stage 1 protection does not erase any historical marks or undo
  previously completed destructive actions. It only prevents new deletion.

## Focused tests

- backend/tests/attendance-cancellation-integrity.test.ts
- backend/tests/attendance-cancellation-ui.test.ts
- backend/tests/runtime-role-isolation.test.ts
- backend/tests/attendance-reset-integrity.test.ts
- backend/tests/attendance-reset-security.test.ts
- backend/tests/attendance-reset-api.test.ts

See GitHub Actions PG17 synthetic CI for final evidence. Local PG18 synthetic
tests are supplementary; never connect them to the existing dev database.

**NO production migrations, roles, credentials, deploys, attendance changes,
frontend timer changes, PR merges or backups have been performed.**
