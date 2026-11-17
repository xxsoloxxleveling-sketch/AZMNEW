-- AZM.AIO PR51 preflight. Runs entirely inside a READ ONLY transaction.
-- No student names, roll numbers, CNICs, documents or individual scores are printed.
-- This is an inventory, NOT authorization to run a migration.
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '25s';
SET LOCAL lock_timeout = '2s';

DO $$
BEGIN
  IF current_database() <> 'student_app_db' THEN
    RAISE EXCEPTION 'AZM_PR51_PREFLIGHT_WRONG_DATABASE';
  END IF;
END $$;

SELECT 'database_identity' AS check_name, current_database() AS result;
SELECT 'server_version' AS check_name, current_setting('server_version') AS result;
SELECT 'source_register' AS check_name, 'Student' AS source_name,
  count(*) AS rows,
  md5(coalesce(string_agg(md5(to_jsonb(s)::text),'|' ORDER BY to_jsonb(s)::text),'')) AS content_fingerprint
FROM public."Student" s
UNION ALL
SELECT 'source_register', 'Attendance', count(*),
  md5(coalesce(string_agg(md5(to_jsonb(a)::text),'|' ORDER BY to_jsonb(a)::text),''))
FROM public."Attendance" a
UNION ALL
SELECT 'source_register', 'AttendanceSession', count(*),
  md5(coalesce(string_agg(md5(to_jsonb(h)::text),'|' ORDER BY to_jsonb(h)::text),''))
FROM public."AttendanceSession" h
UNION ALL
SELECT 'source_register', 'OmrProvisionalMark', count(*),
  md5(coalesce(string_agg(md5(to_jsonb(o)::text),'|' ORDER BY to_jsonb(o)::text),''))
FROM public."OmrProvisionalMark" o
UNION ALL
SELECT 'source_register', 'ManualExamMark', count(*),
  md5(coalesce(string_agg(md5(to_jsonb(m)::text),'|' ORDER BY to_jsonb(m)::text),''))
FROM public."ManualExamMark" m
UNION ALL
SELECT 'source_register', 'ExaminationResult', count(*),
  md5(coalesce(string_agg(md5(to_jsonb(e)::text),'|' ORDER BY to_jsonb(e)::text),''))
FROM public."ExaminationResult" e
ORDER BY source_name;

SELECT migration_name,
       finished_at IS NOT NULL AS finished,
       rolled_back_at IS NOT NULL AS rolled_back
FROM public._prisma_migrations
WHERE migration_name IN (
  '20261116100000_allow_administrative_zero_unmarked_omr',
  '20261116110000_superadmin_manual_exam_mark_entry',
  '20261117110000_verified_manual_exam_mark_audit'
)
ORDER BY migration_name;

SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       pg_get_userbyid(c.relowner) AS owner_role,
       has_table_privilege('student_app',c.oid,'SELECT') AS maintenance_can_read,
       has_table_privilege('student_app',c.oid,'UPDATE') AS maintenance_can_update,
       has_table_privilege('student_app',c.oid,'REFERENCES') AS maintenance_has_table_references,
       has_table_privilege('azm_runtime',c.oid,'INSERT') AS runtime_can_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'Student','User','Attendance','OmrProvisionalMark',
    'ManualExamMark','ManualExamMarkVerificationAudit')
  AND c.relkind IN ('r','p')
ORDER BY c.relname;

SELECT 'new_audit_present' AS check_name,
       to_regclass('public."ManualExamMarkVerificationAudit"') IS NOT NULL AS result;
SELECT 'verify_function_present' AS check_name,
       to_regprocedure('public.azm_verify_manual_exam_mark(text,integer,text,text,boolean,boolean,boolean,text)') IS NOT NULL AS result;
ROLLBACK;
