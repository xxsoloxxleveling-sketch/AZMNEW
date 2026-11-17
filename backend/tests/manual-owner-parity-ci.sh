#!/usr/bin/env bash
# PostgreSQL 17 synthetic test matching the production table-owner split.
# Never connects to AZM.AIO production: the CI PostgreSQL service is isolated.
set -euo pipefail

db=azm_manual_owner_parity_ci
psql_root() { psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres "$@"; }
psql_test() { psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d "$db" "$@"; }
manual_migration=backend/prisma/migrations/20261116110000_superadmin_manual_exam_mark_entry/migration.sql
verify_migration=backend/prisma/migrations/20261117110000_verified_manual_exam_mark_audit/migration.sql
log=$(mktemp)
created=0
cleanup() {
  rc=$?
  trap - EXIT
  rm -f "$log"
  if [ "$created" -eq 1 ]; then
    psql_root -q -c "DROP DATABASE IF EXISTS $db WITH (FORCE)" || true
  fi
  exit "$rc"
}
trap cleanup EXIT

psql_root -q <<'SQL'
CREATE ROLE student_app NOLOGIN NOINHERIT;
CREATE ROLE azm_runtime NOLOGIN NOINHERIT;
SQL
if [ "$(psql_root -At -c "SELECT count(*) FROM pg_database WHERE datname='$db'")" != 0 ]; then
  echo "Refusing to overwrite a pre-existing synthetic database"
  exit 1
fi
psql_root -q -c "CREATE DATABASE $db OWNER student_app"
created=1
psql_test -q <<'SQL'
CREATE TABLE public."User" (
  id text PRIMARY KEY, name text NOT NULL, role text NOT NULL, status text NOT NULL
);
CREATE TABLE public."Student" (
  id text PRIMARY KEY, status text NOT NULL,
  "rollNumber" text, "applicationNo" text, "testScore" integer,
  "fullName" text NOT NULL, "fatherName" text NOT NULL,
  "currentClass" text NOT NULL
);
CREATE TABLE public."OmrProvisionalMark" (
  "studentId" text NOT NULL, "sessionReference" text NOT NULL,
  PRIMARY KEY ("sessionReference","studentId")
);
CREATE TABLE public."ExaminationResult" ("studentId" text NOT NULL);
INSERT INTO public."User" VALUES
 ('ci-superadmin','CI synthetic supervisor','SUPER_ADMIN','ACTIVE'),
 ('ci-teacher','CI synthetic teacher','TEACHER','ACTIVE');
INSERT INTO public."Student" VALUES
 ('ci-candidate','ACTIVE','AZM-SYN-82','APP-SYN-82',NULL,
  'Synthetic Candidate','Synthetic Guardian','Class 6');
-- Reflect production: existing Student/User owned by student_app;
-- later OMR and manual mark tables owned by postgres.
ALTER TABLE public."User" OWNER TO student_app;
ALTER TABLE public."Student" OWNER TO student_app;
GRANT USAGE ON SCHEMA public TO student_app, azm_runtime;
GRANT SELECT ON public."OmrProvisionalMark",public."ExaminationResult" TO student_app;
GRANT SELECT ON public."User",public."Student",
  public."OmrProvisionalMark",public."ExaminationResult" TO azm_runtime;
SQL

# Prior PR50 was applied with postgres ownership in the live database.
psql_test -q -f "$manual_migration"
psql_test -q <<'SQL'
SELECT * FROM public.azm_record_manual_exam_mark(
  'ci-candidate',82,'SYNTHETIC-SIGNED-REGISTER-82',
  'Synthetic evidence and identity reviewed to validate role isolation for CI.',
  TRUE,TRUE,'ci-superadmin');
DO $$
BEGIN
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class
      WHERE oid='public."ManualExamMark"'::regclass)<>'postgres' THEN
    RAISE EXCEPTION 'Legacy source is not postgres-owned';
  END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class
      WHERE oid='public."Student"'::regclass)<>'student_app' THEN
    RAISE EXCEPTION 'Student is not student_app-owned';
  END IF;
  IF NOT has_table_privilege('student_app','public."ManualExamMark"','SELECT')
     OR has_table_privilege('student_app','public."ManualExamMark"','UPDATE')
     OR has_table_privilege('student_app','public."ManualExamMark"','REFERENCES') THEN
    RAISE EXCEPTION 'Migration-owner privilege profile differs from production';
  END IF;
END $$;
SQL
echo "Production-like initial owner and privilege split confirmed."

# The original migration must fail under production-like permissions.
set +e
{ printf 'SET ROLE student_app;\n'; cat "$verify_migration"; } |
  psql_test -q -f - > "$log" 2>&1
migration_exit=$?
set -e
if [ "$migration_exit" -eq 0 ] ||
   ! grep -Fq 'permission denied for table ManualExamMark' "$log"; then
  echo "Expected foreign-key REFERENCES failure was not reproduced"
  cat "$log"
  exit 1
fi
if [ "$(psql_test -At -c "SELECT to_regclass('public.\"ManualExamMarkVerificationAudit\"') IS NULL")" != t ]; then
  echo "Failed migration left a partial audit table"
  exit 1
fi
echo "Expected privilege failure reproduced and rolled back."

# Review-gated DBA operation: only the two referenced columns, only for
# schema creation, never for azm_runtime. Revoke immediately after migration.
psql_test -q -c 'GRANT REFERENCES ("sessionReference","studentId") ON public."ManualExamMark" TO student_app'
{ printf 'SET ROLE student_app;\n'; cat "$verify_migration"; } |
  psql_test -q -f -
psql_test -q -c 'REVOKE REFERENCES ("sessionReference","studentId") ON public."ManualExamMark" FROM student_app'

psql_test -q <<'SQL'
DO $$
BEGIN
  IF has_column_privilege('student_app','public."ManualExamMark"',
                          'sessionReference','REFERENCES')
    OR has_column_privilege('student_app','public."ManualExamMark"',
                            'studentId','REFERENCES')
    OR has_table_privilege('student_app','public."ManualExamMark"','UPDATE')
    OR has_table_privilege('azm_runtime','public."ManualExamMark"','UPDATE')
    OR has_table_privilege('azm_runtime','public."ManualExamMark"','REFERENCES') THEN
    RAISE EXCEPTION 'Maintenance grant was not fully revoked or leaked';
  END IF;
  IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE
       oid='public.azm_verify_manual_exam_mark(text,integer,text,text,boolean,boolean,boolean,text)'::regprocedure)<>'student_app' THEN
    RAISE EXCEPTION 'New SECURITY DEFINER function owner mismatch';
  END IF;
  IF NOT has_function_privilege('azm_runtime',
    'public.azm_verify_manual_exam_mark(text,integer,text,text,boolean,boolean,boolean,text)','EXECUTE')
     OR has_table_privilege('azm_runtime',
    'public."ManualExamMarkVerificationAudit"','INSERT') THEN
    RAISE EXCEPTION 'Runtime cannot call restricted RPC or has direct insert';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conname='ManualExamMarkVerificationAudit_mark_fkey'
        AND convalidated)<>1 THEN
    RAISE EXCEPTION 'Foreign key missing after grant revocation';
  END IF;
END $$;
SQL
echo "Temporary column-scoped REFERENCES grant revoked; FK remains valid."

# Run the real RPC AS the low-privilege runtime caller, not as postgres.
psql_test -q <<'SQL'
SET ROLE azm_runtime;
SELECT * FROM public.azm_verify_manual_exam_mark(
  'ci-candidate',82,'SYNTHETIC-INDEPENDENT-REVIEW-82',
  'Synthetic review checked signed score, current identity, attendance and total.',
  TRUE,TRUE,TRUE,'ci-superadmin');
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.azm_verify_manual_exam_mark(
      'ci-candidate',82,'SYNTHETIC-REPEAT-VERIFY-82',
      'Synthetic duplicate attempt must not create a second verification audit.',
      TRUE,TRUE,TRUE,'ci-superadmin');
    RAISE EXCEPTION 'Duplicate audit unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    RAISE NOTICE 'Duplicate verification denied';
  END;
  BEGIN
    PERFORM * FROM public.azm_verify_manual_exam_mark(
      'ci-candidate',83,'SYNTHETIC-STALE-VERIFY-83',
      'Synthetic stale mark must never verify a different recorded total.',
      TRUE,TRUE,TRUE,'ci-superadmin');
    RAISE EXCEPTION 'Stale mark unexpectedly accepted';
  EXCEPTION WHEN serialization_failure THEN
    RAISE NOTICE 'Stale mark denied';
  END;
  BEGIN
    PERFORM * FROM public.azm_verify_manual_exam_mark(
      'ci-candidate',82,'SYNTHETIC-UNAUTHORIZED-REVIEW',
      'Synthetic non-Super-Admin must not be allowed to seal any score.',
      TRUE,TRUE,TRUE,'ci-teacher');
    RAISE EXCEPTION 'Unauthorized reviewer unexpectedly accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Non-Super-Admin denied';
  END;
  BEGIN
    INSERT INTO public."ManualExamMarkVerificationAudit"("sessionReference") VALUES ('2026-V');
    RAISE EXCEPTION 'Direct audit INSERT unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Runtime direct audit INSERT denied';
  END;
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public."ManualExamMarkVerificationAudit") <> 1
    OR (SELECT "verifiedMarks" FROM public."ManualExamMarkVerificationAudit") <> 82
    OR (SELECT "obtainedMarks" FROM public."ManualExamMark") <> 82
    OR (SELECT count(*) FROM public."OmrProvisionalMark") <> 0 THEN
    RAISE EXCEPTION 'Source or audit integrity failed';
  END IF;
  BEGIN
    UPDATE public."ManualExamMarkVerificationAudit"
      SET "verificationReason"="verificationReason";
    RAISE EXCEPTION 'Audit update unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Immutable audit update denied';
  END;
END $$;
SQL
echo "PASS: production-like ownership, one verified synthetic 82/100, strict grants and immutable sources."


# Repeatable corrections must work under the same split owners WITHOUT a
# second REFERENCES grant on the postgres-owned original source.
correction_migration=backend/prisma/migrations/20261117150000_repeatable_manual_exam_mark_corrections/migration.sql
{ printf 'SET ROLE student_app;\n'; cat "$correction_migration"; } | psql_test -q -f -
psql_test -q <<'SQL'
DO $$
BEGIN
 IF (SELECT pg_get_userbyid(proowner) FROM pg_proc
     WHERE oid='public.azm_correct_manual_exam_mark(text,integer,integer,bigint,text,text,boolean,boolean,text)'::regprocedure) <> 'student_app'
   OR (SELECT pg_get_userbyid(proowner) FROM pg_proc
     WHERE oid='public.azm_verify_manual_exam_mark(text,integer,text,text,boolean,boolean,boolean,text)'::regprocedure) <> 'student_app' THEN
   RAISE EXCEPTION 'Correction and verification RPC owners must both be student_app';
 END IF;
 IF has_column_privilege('student_app','public."ManualExamMark"','sessionReference','REFERENCES')
   OR has_column_privilege('student_app','public."ManualExamMark"','studentId','REFERENCES')
   OR has_table_privilege('azm_runtime','public."ManualExamMarkCorrectionAudit"','INSERT') THEN
   RAISE EXCEPTION 'Unexpected source REFERENCES or runtime direct audit INSERT';
 END IF;
 IF NOT has_function_privilege('azm_runtime',
   'public.azm_correct_manual_exam_mark(text,integer,integer,bigint,text,text,boolean,boolean,text)','EXECUTE') THEN
   RAISE EXCEPTION 'Restricted correction function not executable by runtime role';
 END IF;
END $$;
SET ROLE azm_runtime;
SELECT * FROM public.azm_correct_manual_exam_mark(
 'ci-candidate',82,87,NULL,'SYNTHETIC-OWNER-PARITY-REGISTER-01',
 'Signed synthetic marks evidence independently checked for a correction after approval.',
 TRUE,TRUE,'ci-superadmin');
DO $$
BEGIN
 IF (SELECT "newEffectiveMarks" FROM public."ManualExamMarkCorrectionAudit" ORDER BY id DESC LIMIT 1) <> 87
   OR (SELECT "obtainedMarks" FROM public."ManualExamMark") <> 82 THEN
   RAISE EXCEPTION 'Correction failed or immutable source changed';
 END IF;
 BEGIN
   PERFORM * FROM public.azm_correct_manual_exam_mark(
     'ci-candidate',82,89,NULL,'SYNTHETIC-OWNER-PARITY-REGISTER-02',
     'An obsolete value must be rejected as stale after a correction event.',
     TRUE,TRUE,'ci-superadmin');
   RAISE EXCEPTION 'Stale concurrent request accepted';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 BEGIN
   INSERT INTO public."ManualExamMarkCorrectionAudit"("sessionReference") VALUES ('2026-V');
   RAISE EXCEPTION 'Runtime inserted correction audit directly';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SELECT * FROM public.azm_verify_manual_exam_mark(
 'ci-candidate',87,'SYNTHETIC-OWNER-PARITY-VERIFY-01',
 'Independent confirmation of correction revision, signed evidence and student identity.',
 TRUE,TRUE,TRUE,'ci-superadmin');
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public."ManualExamMarkVerificationAudit") <> 2
   OR (SELECT "latestCorrectionId" FROM public."ManualExamMarkVerificationAudit"
       ORDER BY id DESC LIMIT 1) IS DISTINCT FROM
      (SELECT id FROM public."ManualExamMarkCorrectionAudit" ORDER BY id DESC LIMIT 1)
   OR (SELECT "obtainedMarks" FROM public."ManualExamMark") <> 82 THEN
   RAISE EXCEPTION 'Updated seal is not correction-bound or the original was modified';
 END IF;
END $$;
SQL
echo "PASS: actual owner split, no second REFERENCES grant, one audited correction and new verification."
