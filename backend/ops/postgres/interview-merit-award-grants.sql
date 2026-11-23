-- Operator-approved additive grants for the manual interview merit award table.
-- Run after the award migration with the existing restricted login and NOLOGIN
-- privilege group. This script changes no other table, role or membership.
-- Required psql variables: target_db, login_role, grant_role, approved_ticket,
-- accept_action=APPLY-AZM-MERIT-AWARD-GRANTS.
\set ON_ERROR_STOP on
\if :{?target_db}
\else
  \echo 'BLOCKED: target_db is mandatory.'
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif
\if :{?login_role}
\else
  \echo 'BLOCKED: login_role is mandatory.'
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif
\if :{?grant_role}
\else
  \echo 'BLOCKED: grant_role is mandatory.'
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif
\if :{?approved_ticket}
\else
  \echo 'BLOCKED: approved_ticket is mandatory.'
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif
\if :{?accept_action}
\else
  \echo 'BLOCKED: accept_action is mandatory.'
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif

BEGIN;
SET LOCAL lock_timeout = '8s';
SET LOCAL statement_timeout = '35s';

SELECT (
  current_database() = :'target_db'
  AND :'accept_action' = 'APPLY-AZM-MERIT-AWARD-GRANTS'
  AND length(btrim(:'approved_ticket')) >= 8
  AND :'login_role' <> :'grant_role'
  AND :'login_role' NOT LIKE 'postgres%'
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname=:'login_role'
    AND r.rolcanlogin AND r.rolinherit AND NOT r.rolsuper AND NOT r.rolcreatedb
    AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls)
  AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname=:'grant_role'
    AND NOT r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb
    AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls)
  AND EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
    JOIN pg_roles u ON u.oid=m.member WHERE g.rolname=:'grant_role' AND u.rolname=:'login_role')
  AND NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles g ON g.oid=m.roleid
    JOIN pg_roles u ON u.oid=m.member WHERE g.rolname=:'grant_role' AND u.rolname<>:'login_role')
  AND has_schema_privilege(:'login_role','public','USAGE')
  AND NOT has_schema_privilege(:'login_role','public','CREATE')
  AND NOT has_database_privilege(:'login_role',current_database(),'CREATE')
  AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_roles r ON r.rolname IN (:'login_role',:'grant_role')
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
      AND pg_has_role(r.oid,c.relowner,'MEMBER'))
  AND NOT EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.rolname IN (:'login_role',:'grant_role')
    WHERE n.nspname='public' AND pg_has_role(r.oid,n.nspowner,'MEMBER'))
  AND 2 = (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('InterviewPanelRevision','InterviewAssessmentRevision')
      AND has_table_privilege(:'login_role',c.oid,'SELECT')
      AND has_table_privilege(:'login_role',c.oid,'INSERT')
      AND NOT has_table_privilege(:'login_role',c.oid,'UPDATE,DELETE,TRUNCATE,TRIGGER'))
  AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='InterviewMeritAwardRevision' AND c.relkind='r'
      AND EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid
        AND t.tgname='InterviewMeritAwardRevision_validate' AND t.tgenabled IN ('O','A') AND t.tgtype=7
        AND t.tgfoid='public.azm_validate_interview_merit_award_insert()'::regprocedure)
      AND EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid
        AND t.tgname='InterviewMeritAwardRevision_immutable' AND t.tgenabled IN ('O','A') AND t.tgtype=58
        AND t.tgfoid='public.azm_reject_interview_assessment_mutation()'::regprocedure))
) AS merit_award_grant_preflight_ok \gset
\if :merit_award_grant_preflight_ok
\else
  \echo 'BLOCKED: Wrong target, unsafe existing roles, unexpected membership, or missing award protections.'
  ROLLBACK;
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif

-- Scope is deliberately one new table; preserve every existing audit ACL.
REVOKE ALL ON TABLE public."InterviewMeritAwardRevision" FROM :"login_role", :"grant_role";
GRANT SELECT, INSERT ON TABLE public."InterviewMeritAwardRevision" TO :"grant_role";

SELECT (
  has_table_privilege(:'login_role','public."InterviewMeritAwardRevision"','SELECT')
  AND has_table_privilege(:'login_role','public."InterviewMeritAwardRevision"','INSERT')
  AND NOT has_table_privilege(:'login_role','public."InterviewMeritAwardRevision"','UPDATE,DELETE,TRUNCATE,TRIGGER')
  AND has_table_privilege(:'grant_role','public."InterviewMeritAwardRevision"','SELECT')
  AND has_table_privilege(:'grant_role','public."InterviewMeritAwardRevision"','INSERT')
  AND NOT has_table_privilege(:'grant_role','public."InterviewMeritAwardRevision"','UPDATE,DELETE,TRUNCATE,TRIGGER')
  AND NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
    AND has_table_privilege(r.oid,'public."InterviewMeritAwardRevision"','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  AND NOT EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid='public."InterviewMeritAwardRevision"'::regclass AND a.grantee=0)
) AS merit_award_grants_verified \gset
\if :merit_award_grants_verified
  COMMIT;
  \echo 'PASS: Manual merit award SELECT/INSERT grants verified; existing table privileges unchanged.'
\else
  \echo 'BLOCKED: Unexpected effective award access; no grant changes retained.'
  ROLLBACK;
  SELECT 1/0 AS azm_merit_award_grant_blocked;
\endif
