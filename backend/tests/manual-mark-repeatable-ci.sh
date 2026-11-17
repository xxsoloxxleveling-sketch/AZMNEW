#!/usr/bin/env bash
# Disposable GitHub Actions PostgreSQL 17 ONLY. Never run on Oracle.
set -euo pipefail
test "$CI" = true
test "$PGPASSWORD" = synthetic_test_only
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres \
  -f backend/prisma/migrations/20261117150000_repeatable_manual_exam_mark_corrections/migration.sql
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d postgres <<'SQL'
DO $$
DECLARE c1 BIGINT; c2 BIGINT; c3 BIGINT;
BEGIN
  IF (SELECT count(*) FROM public."ManualExamMarkVerificationAudit") <> 1 THEN
    RAISE EXCEPTION 'Expected prior verified synthetic score';
  END IF;
  PERFORM * FROM public.azm_correct_manual_exam_mark(
    'candidate-synthetic',77,82,'SYNTHETIC-SIGNED-REGISTER-01',
    'Synthetic original register independently reviewed: corrected 77 to 82.',
    TRUE,TRUE,'admin-synthetic');
  SELECT max(id) INTO c1 FROM public."ManualExamMarkCorrectionAudit";
  IF (SELECT "latestCorrectionId" FROM public."ManualExamMarkVerificationAudit" ORDER BY id DESC LIMIT 1)
      IS NOT DISTINCT FROM c1 THEN
    RAISE EXCEPTION 'Earlier verification falsely sealed corrected marks';
  END IF;
  BEGIN
    PERFORM * FROM public.azm_correct_manual_exam_mark(
      'candidate-synthetic',77,83,'SYNTHETIC-SIGNED-REGISTER-02',
      'Stale client values must not change the last recorded numerical score.',
      TRUE,TRUE,'admin-synthetic');
    RAISE EXCEPTION 'Stale edit accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.azm_correct_manual_exam_mark(
      'candidate-synthetic',82,82,'SYNTHETIC-SIGNED-REGISTER-03',
      'A duplicate score correction must never add another audit record.',
      TRUE,TRUE,'admin-synthetic');
    RAISE EXCEPTION 'No-op edit accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.azm_correct_manual_exam_mark(
      'candidate-synthetic',82,83,'SYNTHETIC-SIGNED-REGISTER-04',
      'This non-administrator actor is not allowed to modify any score.',
      TRUE,TRUE,'unknown-actor');
    RAISE EXCEPTION 'Invalid actor accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM * FROM public.azm_verify_manual_exam_mark(
    'candidate-synthetic',82,'SYNTHETIC-INDEPENDENT-REVIEW-01',
    'Original register, identity and attendance independently checked for first revised score.',
    TRUE,TRUE,TRUE,'admin-synthetic');
  IF (SELECT "latestCorrectionId" FROM public."ManualExamMarkVerificationAudit" ORDER BY id DESC LIMIT 1)
      IS DISTINCT FROM c1 THEN
    RAISE EXCEPTION 'First correction seal does not match revision';
  END IF;
  PERFORM * FROM public.azm_correct_manual_exam_mark(
    'candidate-synthetic',82,60,'SYNTHETIC-SIGNED-REGISTER-05',
    'A second signed record review corrected the mark to the passing boundary.',
    TRUE,TRUE,'admin-synthetic');
  SELECT max(id) INTO c2 FROM public."ManualExamMarkCorrectionAudit";
  IF c2<=c1 THEN RAISE EXCEPTION 'Second revision is not new'; END IF;
  IF (SELECT "latestCorrectionId" FROM public."ManualExamMarkVerificationAudit" ORDER BY id DESC LIMIT 1)
      IS NOT DISTINCT FROM c2 THEN
    RAISE EXCEPTION 'Prior seal still verifies second revision';
  END IF;
  PERFORM * FROM public.azm_verify_manual_exam_mark(
    'candidate-synthetic',60,'SYNTHETIC-INDEPENDENT-REVIEW-02',
    'Second corrected score and student identity were independently verified.',
    TRUE,TRUE,TRUE,'admin-synthetic');
  PERFORM * FROM public.azm_correct_manual_exam_mark(
    'candidate-synthetic',60,77,'SYNTHETIC-SIGNED-REGISTER-06',
    'Third revision deliberately restores the original score while preserving all previous audits.',
    TRUE,TRUE,'admin-synthetic');
  SELECT max(id) INTO c3 FROM public."ManualExamMarkCorrectionAudit";
  IF c3<=c2 THEN RAISE EXCEPTION 'Third revision missing'; END IF;
  PERFORM * FROM public.azm_verify_manual_exam_mark(
    'candidate-synthetic',77,'SYNTHETIC-INDEPENDENT-REVIEW-03',
    'Final revision has been independently verified even though it equals the original number.',
    TRUE,TRUE,TRUE,'admin-synthetic');
  IF (SELECT count(*) FROM public."ManualExamMarkCorrectionAudit") <> 3
    OR (SELECT count(*) FROM public."ManualExamMarkVerificationAudit") <> 4
    OR (SELECT "obtainedMarks" FROM public."ManualExamMark") <> 77
    OR (SELECT "latestCorrectionId" FROM public."ManualExamMarkVerificationAudit"
      ORDER BY id DESC LIMIT 1) IS DISTINCT FROM c3 THEN
    RAISE EXCEPTION 'Original, revision or seal integrity failed';
  END IF;
  BEGIN
    UPDATE public."ManualExamMarkCorrectionAudit" SET "newEffectiveMarks"=99 WHERE id=c1;
    RAISE EXCEPTION 'Audit update accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public."ManualExamMarkCorrectionAudit" WHERE id=c1;
    RAISE EXCEPTION 'Audit delete accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SQL
echo 'PASS synthetic PG17: 3 corrections + 3 reverifications; original unchanged; immutable history'
