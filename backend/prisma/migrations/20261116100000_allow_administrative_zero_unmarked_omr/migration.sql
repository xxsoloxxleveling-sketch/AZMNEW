-- Session V OMR Studio batch (957 scored sheets) includes administrator-authorized
-- zero marks when the marked paper cannot be read or does not fit the key.
-- Some zero awards have no determinable A/B/C/D version. Never fabricate
-- a paper version to satisfy the old check constraint.
--
-- This additive migration changes only two permitted-value CHECK constraints.
-- It does not touch a score, corrected score, verification, certificate or
-- existing row. Each new administrative zero still requires Super Admin review.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public."OmrProvisionalMark"
  DROP CONSTRAINT "OmrProvisionalMark_paperVersion_check",
  ADD CONSTRAINT "OmrProvisionalMark_paperVersion_check"
    CHECK ("paperVersion" = ANY (
      ARRAY['A'::text,'B'::text,'C'::text,'D'::text,'UNDETERMINED'::text]
    ));

ALTER TABLE public."OmrProvisionalMark"
  DROP CONSTRAINT "OmrProvisionalMark_reviewCategory_check",
  ADD CONSTRAINT "OmrProvisionalMark_reviewCategory_check"
    CHECK ("reviewCategory" = ANY (
      ARRAY[
        'READY_HIGH_CONFIDENCE'::text,
        'PROVISIONAL_VERSION_REVIEW'::text,
        'HOLD_IDENTITY'::text,
        'HOLD_PRINTED_CLASS'::text,
        'HOLD_SCORE'::text,
        'HOLD_PAPER_VERSION'::text,
        'ADMIN_ZERO_OVERRIDE_REVIEW'::text
      ]
    ));

COMMIT;
