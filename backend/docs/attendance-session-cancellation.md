# AZM.AIO — Super Admin Hall-session cancellation safety

Development branch: `feature/super-admin-session-lifecycle`, based on draft PR #14
(`2924871cf8dcf117ce6de7857b4584d910a8ba36`).

## Scope and semantics

- Cancellation targets exactly **one current** `AttendanceSession.id`, status OPEN or CLOSED.
  Archived / previously CANCELLED attempts cannot be cancelled or purged again.
- Cancellation changes the selected attempt to `CANCELLED`, archives it
  (`isCurrent = false`), records actor and time, and **does not automatically
  open another session**. A separate explicit Super Admin action may open
  `attemptNumber + 1` for the same Hall/date, preserving previous identities.
- `Cancel and preserve`: retains original attendance marks and frozen roster.
- `Cancel and purge`: permanently deletes only `Attendance` rows for the
  exact approved session ID, including automatic ABSENT marks from CLOSED
  attempts. It does **not** delete the session identity, frozen candidate
  roster, other attendance attempts, students, test scores, OMR, results,
  fees, transactions, documents, or other Halls.
- A new immutable `AttendanceSessionCancellation` audit stores exact
  session identity, who, when, reason, previous status, action type, policy
  approval reference, affected counts and a SHA-256 snapshot fingerprint.
  It intentionally does **not** retain the deleted individual marks.
- After cancellation, QR/manual attendance and closure are rejected for
  the cancelled attempt. Current statistics exclude it; history can show it.

## Authorization and irreversible-deletion safeguards

- Router and database transaction both require an **active SUPER_ADMIN**;
  the current access-token version is checked again in the transaction.
- Preview and confirm are separate: five-minute HMAC-signed, actor-specific,
  exact-session challenge; fresh fingerprint for marks, roster, student results
  and related metadata; one-time nonce; strict body validation and typed phrase.
- Confirmation requires a UUID `Idempotency-Key`, a reason and, for purging:
  policy/retention approval reference, affirmative retention clearance,
  external OMR/results disposition attestation, irreversible-deletion
  acknowledgement and an extra affirmative CLOSED-evidence approval for CLOSED
  sessions. Idempotent identical retries return the original audit result.
- Purging fails closed when any student in the session roster has `testScore`
  or `overallRank` recorded. Student-level scores are not reliably bound
  to the examination-session ID. A lack of linked score does not prove the
  absence of externally stored OMR/results.
- Database transaction locks Hall and Session, runs SERIALIZABLE, rechecks
  preview freshness and dependencies, writes immutable audit, purges only
  matching attendance, archives exact session and validates deferred
  database constraints; any failure rolls everything back.
- Forward migrations are **additive** and do not edit PR #14's reviewed
  migration. Existing reset and audit protection remains in place.

## Important limitations and release gates

1. **Approval is currently an auditable Super Admin self-attestation.** The
   application records a policy reference but cannot independently verify an
   institutional/legal retention decision. If independent approval is policy,
   integrate that workflow before enabling purging in production.
2. **OMR/results are not consistently session-linked.** This action does not
   void, erase or reschedule such records. External disposition must be
   reviewed separately before granting any permanent-purge approval.
3. **Production database role ownership is not yet separated.** Previously
   observed runtime-role table ownership can permit a privileged role to
   disable triggers, so database-level anti-forgery is not an absolute trust
   boundary. This is an outstanding production-release security decision.
4. Do not merge/deploy PR #14 or this feature without a coordinated
   maintenance window, fresh verifiably restorable backup, explicit
   production migration permission, deployment timing plan, and approval
   of pre-existing test/typecheck failures. Production-derived migration
   rehearsal is not yet completed.
5. Source and synthetic local tests are **not** evidence that any migration
   has been applied to live Oracle PostgreSQL. Never run these tests against
   existing production or development databases.

## Focused validation

Tests create and drop only randomly named, disposable local PostgreSQL
databases; they refuse non-local source hosts. Use a test-only connection
with `ATTENDANCE_TEST_DATABASE_URL` and `NODE_ENV=test`.

- `backend/tests/attendance-cancellation-integrity.test.ts` — scopes,
  OPEN/CLOSED purges, no-purge, stale requests, signed challenges, role
  enforcement, auditing, direct SQL protections, races, rollback, live API.
- `backend/tests/attendance-cancellation-ui.test.ts` — static UI role/selection
  contract and high-risk confirmation wording.
- Existing PR #14 reset integrity, security and API suites should continue
  passing against the modified triggers/migrations.

This work is **development only** until reviewed and specifically released.
