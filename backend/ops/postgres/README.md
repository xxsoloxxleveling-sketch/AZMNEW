# AZM.AIO — Runtime PostgreSQL privilege-separation runbook (DRAFT)

**Scope:** Security gate for combined PR #14 / PR #15. This runbook is a
design and synthetic verification artifact; it is **not authorization** to
change live PostgreSQL identities, services, credentials, or data.

## Stage 1 preserve-only amendment (stacked PR)

The new additive migration 20261011221000_staged_attendance_preservation
**prohibits all new permanent attendance deletion**, including for CLOSED
sessions. The revised runtime-grants.sql **does NOT grant Attendance.DELETE**;
the production pre-listen guard also requires its absence and the enabled
Attendance_staged_no_delete trigger. After approval, apply all FOUR reviewed
migrations (not three) before the new runtime credential/grant switch.
See backend/docs/staged-attendance-preservation.md. No live cutover is approved.

## Why this gate exists

The deployed API must not connect as the owner of its own attendance tables
and protective trigger functions. A table owner can bypass audit/finality
protections by altering tables or disabling triggers, despite triggers passing
their application-level tests.

The backend uses DATABASE_URL and DIRECT_URL. Prisma migration deployment is a
separate command. Avoid owner/migration credentials in the systemd API service.

The new pre-listen production startup guard checks the effective PostgreSQL
login, both connection identities, public-schema ownership, DDL and immutable
audit privileges, migration-ledger rights and required active trigger names.
It refuses to start HTTP when those checks fail, including when the backend
still uses its former table owner. Therefore DO NOT merge/deploy this guard
until the migration and backend-runtime credential cutover are coordinated.
Development/test service startup is unaffected.

## Preferred conservative topology

| Identity | Login | Permissions | Runtime placement |
|---|---|---|---|
| Existing schema/table owner and migration identity | Maintenance only | Owns schema and runs Prisma migrations | Time-bound release job, NOT API process |
| New runtime login (e.g. azm_runtime) | YES | Application DML, no schema/table ownership, no ability to disable triggers or mutate migration ledger | Backend DATABASE_URL and DIRECT_URL |
| New runtime privilege group (e.g. azm_app_dml) | NO | Revocable app DML grants except immutable audits | PostgreSQL role membership only |

We **do not** propose REASSIGN OWNED, dropping tables, rewriting migration
history, renaming live databases, or reusing owner credentials at runtime.
Owners remain migration identities. The scripted grants exclude
_prisma_migrations entirely and limit attendance audit tables to SELECT/INSERT
(no UPDATE/DELETE). Other current application tables retain broad DML.
This is ownership separation, not fine-grained per-business-action grants.

### Phase A — production evidence collection (read-only only)

1. Establish release operator-approved connectivity with the correct Oracle
   PostgreSQL maintenance or current application login. Never display or
   export passwords, tokens, DSNs, student rows or configuration secrets.
2. Run from backend with DATABASE_URL provided through a secure environment:
   node ops/postgres/audit-runtime-readonly.cjs --read-only
   The command uses BEGIN READ ONLY, queries pg_catalog and permission
   predicates, and prints summarized owner, trigger and grant evidence.
3. Verify effective DB login under the actual systemd API service, identities
   in both DATABASE_URL and DIRECT_URL (without displaying credential values),
   table owners, role memberships, schema privileges, and current triggers.
4. Record a sanitized PASS / BLOCKED report. The separate Windows PG18
   development database uses local postgres superuser; it is **not production
   privilege evidence**. No verified production role inventory yet exists.

### Phase B — isolated security rehearsal (automated)

The db-runtime-isolation GitHub Actions workflow runs PostgreSQL 17 in a
disposable service container. The runtime-role-isolation test creates and
drops a synthetic database and two dedicated synthetic roles, applies the
current migrations, then provisions scoped grants.

It verifies that restricted credentials CAN perform normal Hall attendance
and authorized audited cancellation, but CANNOT create objects, alter or
disable triggers, inherit table ownership, edit Prisma migration history,
or UPDATE/DELETE immutable attendance audit tables. Direct unaudited
attendance deletion must still fail. No real examination records are used.

### Phase C — separately approved production cutover (NOT YET AUTHORIZED)

1. With DBA maintenance access, provision a dedicated LOGIN role with INHERIT,
   NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS.
   Set password interactively through the PostgreSQL client or a secured
   credential store. Never include passwords in SQL files or shell arguments.
   Do not make this login a member of owner, migrator or superuser roles.
2. Confirm approved target database, role names, and ticket. The script
   ops/postgres/runtime-grants.sql requires psql parameters:
   target_db, login_role, grant_role, approved_ticket and exact
   accept_action=APPLY-AZM-RUNTIME-ROLE-GRANTS. It fails without them;
   it checks the role identity, membership and final grants and rolls
   back on any guard failure.
3. Verify the new role in read-only inventory and end-to-end maintenance smoke
   tests. During an approved cutover, put only its restricted connection into
   both DATABASE_URL and DIRECT_URL of the actual Node backend service.
4. Apply reviewed Prisma migrations using a separate, temporary migration
   environment providing migration-owner connection in BOTH DATABASE_URL
   and DIRECT_URL. Never leave owner credentials in the API service or
   a readable backend .env, journal or deployment artifact. Rotate prior
   privileged credentials in an explicitly approved cutover.
5. Reapply/check role grants after each reviewed migration adding new tables.
   Deliberately avoid blanket future DEFAULT PRIVILEGES which could accidentally
   grant UPDATE/DELETE to new audit or migration tables.
6. If service health, privileges or attendance smoke tests fail, follow the
   separately reviewed maintenance rollback plan. Switching back to owner
   credentials would reintroduce the bypass risk; it is not automatic.

### Known remaining release risks

- The SQL grant script performs privileged DDL and is NEVER called from the
  app, CI against real data, or Prisma migration deployment automatically.
- Ownership separation blocks disabling triggers through ordinary runtime
  credentials. It does not make the SQL audit mechanism unforgeable: runtime
  DML still includes INSERT to cancellation audits, and arbitrary SQL can set
  application-specific GUCs. This requires additional threat-model review
  and possibly restricted database capabilities or an independent audit path.
- Retention-approval reference is presently a Super Admin self-attestation,
  not independently verified institutional or legal authorization.
- OMR/results are not always linked to specific attendance attempts; no
  external record is automatically voided or deleted by cancellation.
- Oracle production-derived restore rehearsal, source provenance,
  migration/rollback plan, deployment timer coordination, outstanding inherited
  quality checks and release owner authorization remain pending.
- Host security has already been marked OWNER ACCEPTED; do not reopen it.

**Current scope:** Preparation/synthetic testing only; no production role
creation, credential rotation, database migration, backend restart or deploy.
