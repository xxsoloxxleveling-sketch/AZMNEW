-- AZM.AIO: operator-approved RUNTIME GRANT PROVISIONING ONLY.
-- NEVER run via prisma migrate deploy or from the running backend.
-- This psql script is intended for a new, dedicated LOGIN role created via
-- an out-of-band credential channel, distinct from all owner/migrator roles.
--
-- Required explicit psql variables:
--   target_db       Exact DB being provisioned (must equal current_database())
--   login_role      New dedicated LOGIN role (already created by DBA)
--   grant_role      Dedicated NOLOGIN application privilege group
--   approved_ticket Written review/approval ticket (minimum 8 chars)
--   accept_action  Must equal APPLY-AZM-RUNTIME-ROLE-GRANTS
--
-- Example for SYNTHETIC DEVELOPMENT DB ONLY:
-- psql -X -v ON_ERROR_STOP=1 -d synthetic_db -v target_db=synthetic_db \
--      -v login_role=azm_fixture_runtime -v grant_role=azm_fixture_dml \
--      -v approved_ticket=SYNTHETIC-REVIEW -v accept_action=APPLY-AZM-RUNTIME-ROLE-GRANTS \
--      -f backend/ops/postgres/runtime-grants.sql
--
-- All changes are transactional; a failed assertion rolls back the grants.

\set ON_ERROR_STOP on
\if :{?target_db}
\else
  \echo 'BLOCKED: target_db is mandatory.'
  SELECT 1/0 AS azm_role_grant_blocked;
\endif
\if :{?login_role}
\else
  \echo 'BLOCKED: login_role is mandatory.'
  SELECT 1/0 AS azm_role_grant_blocked;
\endif
\if :{?grant_role}
\else
  \echo 'BLOCKED: grant_role is mandatory.'
  SELECT 1/0 AS azm_role_grant_blocked;
\endif
\if :{?approved_ticket}
\else
  \echo 'BLOCKED: approved_ticket is mandatory.'
  SELECT 1/0 AS azm_role_grant_blocked;
\endif
\if :{?accept_action}
\else
  \echo 'BLOCKED: accept_action is mandatory.'
  SELECT 1/0 AS azm_role_grant_blocked;
\endif

BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '35s';

SELECT (
  current_database() = :'target_db'
  AND :'accept_action' = 'APPLY-AZM-RUNTIME-ROLE-GRANTS'
  AND length(btrim(:'approved_ticket')) >= 8
  AND :'login_role' <> :'grant_role'
  AND :'login_role' NOT LIKE 'postgres%'
  AND EXISTS (
    SELECT 1 FROM pg_roles r
    WHERE r.rolname = :'login_role' AND r.rolcanlogin AND r.rolinherit
      AND NOT r.rolsuper AND NOT r.rolcreaterole AND NOT r.rolcreatedb
      AND NOT r.rolreplication AND NOT r.rolbypassrls
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_roles r ON r.rolname=:'login_role'
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND pg_has_role(r.oid,c.relowner,'MEMBER')
  )
) AS role_preflight_ok \gset

\if :role_preflight_ok
\else
  \echo 'BLOCKED: wrong database, missing approval, privileged login, owner membership, or object ownership.'
  ROLLBACK;
  SELECT 1/0 AS azm_role_grant_blocked;
\endif

-- Provision only the NOLOGIN privilege group. Never create or rotate passwords
-- in SQL scripts, pull requests or application logs.
SELECT format('CREATE ROLE %I NOLOGIN', :'grant_role')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'grant_role') \gexec

SELECT (
  EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname=:'grant_role' AND NOT r.rolcanlogin)
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_roles r ON r.rolname=:'grant_role'
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND pg_has_role(r.oid,c.relowner,'MEMBER')
  )
  -- Never widen access for unrelated login roles sharing the grant group.
  AND NOT EXISTS (
    SELECT 1 FROM pg_auth_members m
      JOIN pg_roles g ON g.oid=m.roleid
      JOIN pg_roles u ON u.oid=m.member
    WHERE g.rolname=:'grant_role' AND u.rolname<>:'login_role'
  )
) AS grant_role_preflight_ok \gset
\if :grant_role_preflight_ok
\else
  \echo 'BLOCKED: grant group has unexpected ownership or members.'
  ROLLBACK;
  SELECT 1/0 AS azm_role_grant_blocked;
\endif

-- Revoke directly granted privileges on the dedicated login and privilege
-- group, so ACLs are explicit and do not include TRIGGER or TRUNCATE.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"login_role", :"grant_role";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM :"login_role", :"grant_role";
REVOKE CREATE ON SCHEMA public FROM :"login_role", :"grant_role";
GRANT CONNECT ON DATABASE :"target_db" TO :"grant_role";
GRANT USAGE ON SCHEMA public TO :"grant_role";

-- No application read/write permission on the Prisma migrations ledger.
-- Mutation of either append-only attendance audit is denied at the ACL level.
-- Stage 1 also disallows DELETE on the Attendance table, even when a caller
-- supplies a forged cancellation-audit context. Other application tables
-- retain their existing DML surface. Database triggers remain mandatory.
SELECT format('GRANT %s ON TABLE %I.%I TO %I',
  CASE WHEN c.relname IN ('AttendanceResetOperation','AttendanceSessionCancellation')
    THEN 'SELECT, INSERT'
    WHEN c.relname = 'Attendance' THEN 'SELECT, INSERT, UPDATE'
    ELSE 'SELECT, INSERT, UPDATE, DELETE'
  END,
  n.nspname,c.relname,:'grant_role')
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
  AND c.relname <> '_prisma_migrations'
ORDER BY c.relname \gexec

-- Prisma-generated serial IDs / sequences need USAGE (nextval), not ownership.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"grant_role";
GRANT :"grant_role" TO :"login_role" WITH INHERIT TRUE, SET FALSE;

-- Fail the entire transaction if the runtime login is still an owner, inherits
-- CREATE/TRIGGER rights from PUBLIC/other memberships, can write the migration
-- ledger, or lacks operational DML.
SELECT (
  NOT has_schema_privilege(:'login_role','public','CREATE')
  AND NOT has_database_privilege(:'login_role',current_database(),'CREATE')
  AND NOT has_table_privilege(:'login_role','public."AttendanceSession"','TRIGGER')
  AND has_table_privilege(:'login_role','public."AttendanceSession"','SELECT')
  AND has_table_privilege(:'login_role','public."AttendanceSession"','INSERT')
  AND has_table_privilege(:'login_role','public."AttendanceSession"','UPDATE')
  AND has_table_privilege(:'login_role','public."AttendanceSession"','DELETE')
  AND NOT has_table_privilege(:'login_role','public."Attendance"','DELETE')
  AND NOT has_table_privilege(:'login_role','public."Attendance"','TRUNCATE')
  AND has_table_privilege(:'login_role','public."AttendanceSessionCancellation"','INSERT')
  AND NOT has_table_privilege(:'login_role','public."AttendanceSessionCancellation"','UPDATE')
  AND NOT has_table_privilege(:'login_role','public."AttendanceSessionCancellation"','DELETE')
  AND NOT has_table_privilege(:'login_role','public."AttendanceResetOperation"','UPDATE')
  AND NOT has_table_privilege(:'login_role','public."AttendanceResetOperation"','DELETE')
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='_prisma_migrations'
      AND (has_table_privilege(:'login_role',c.oid,'INSERT')
        OR has_table_privilege(:'login_role',c.oid,'UPDATE')
        OR has_table_privilege(:'login_role',c.oid,'DELETE'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_roles r ON r.rolname=:'login_role'
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND pg_has_role(r.oid,c.relowner,'MEMBER')
  )
) AS runtime_grants_verified \gset
\if :runtime_grants_verified
  COMMIT;
  \echo 'PASS: Non-owner application role grants verified; backend credential switch NOT performed.'
\else
  \echo 'BLOCKED: Unexpected ownership, inherited DDL privileges, audit grants or missing DML.'
  ROLLBACK;
  SELECT 1/0 AS azm_role_grant_blocked;
\endif
