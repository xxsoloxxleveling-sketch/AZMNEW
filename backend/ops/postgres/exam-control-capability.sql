-- Privileged, operator-invoked provisioning AFTER forward migrations, BEFORE API startup.
-- Run against the verified intended database only. This creates no credentials or login.
-- Optional DBA session setting azm.control_owner_role permits unique synthetic fixture names.
BEGIN;
DO $$
DECLARE owner_role TEXT:=coalesce(nullif(current_setting('azm.control_owner_role',true),''),'azm_exam_control_owner'); fn TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=owner_role) THEN
  EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',owner_role);
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=owner_role AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname=owner_role) OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=owner_role) THEN RAISE EXCEPTION 'Capability owner must be an isolated, unprivileged NOLOGIN role with no members/memberships'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname=owner_role AND c.relkind IN ('r','p')) THEN RAISE EXCEPTION 'Capability owner must not own tables'; END IF;
 EXECUTE format('GRANT USAGE ON SCHEMA public,azm_control_private TO %I',owner_role);
 EXECUTE format('GRANT SELECT ON public."User",public."Student",public."OfficeUseRecord",public."ExamHall",public."TestCenter",public."AttendanceSession",public."AttendanceSessionCandidate",public."Attendance",public."AttendanceSessionCancellation",public."AttendanceSessionReopening",public."ExamControlOperation",public."ExamPlacementControl",public."ExamAttemptSequence",azm_control_private.signing_key TO %I',owner_role);
 EXECUTE format('GRANT INSERT,UPDATE,DELETE ON public."AttendanceSession",public."AttendanceSessionCandidate" TO %I',owner_role);
 EXECUTE format('GRANT DELETE ON public."Attendance" TO %I',owner_role);
 EXECUTE format('GRANT UPDATE ON public."Student" TO %I',owner_role);
 -- PostgreSQL requires UPDATE on at least one column to take the actor FOR SHARE lock.
 EXECUTE format('GRANT UPDATE ("tokenVersion") ON public."User" TO %I',owner_role);
 EXECUTE format('GRANT INSERT,UPDATE ON public."OfficeUseRecord",public."ExamPlacementControl",public."ExamAttemptSequence" TO %I',owner_role);
 EXECUTE format('GRANT INSERT ON public."ExamControlOperation",public."ExamLifecycleEvent" TO %I',owner_role);
 EXECUTE format('GRANT EXECUTE ON FUNCTION azm_control_private.hmac256(TEXT,TEXT) TO %I',owner_role);
 -- PostgreSQL requires CREATE temporarily for function ownership transfer; revoke before commit.
 EXECUTE format('GRANT CREATE ON SCHEMA public TO %I',owner_role);
 FOREACH fn IN ARRAY ARRAY['public.azm_execute_exam_control(text,text)','public.azm_exam_capability_probe(text,text)','public.azm_sync_live_membership()','public.protect_attendance_generation()','public.azm_record_lifecycle()'] LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO %I',fn,owner_role);
 END LOOP;
 EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I',owner_role);
END $$;
COMMIT;

-- Provision a fresh 64+ character random secret separately through a protected DBA
-- parameterized INSERT into azm_control_private.signing_key. Store the SAME value
-- as EXAM_CONTROL_SIGNING_KEY in the API secret manager. Never put it in source,
-- shell arguments, release logs, browser configuration, or application-role SQL.
-- Then run runtime-grants.sql with its existing explicit database/role preflights.
