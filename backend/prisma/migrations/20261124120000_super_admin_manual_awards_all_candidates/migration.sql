-- All award decisions are explicit Super Admin actions, regardless of application category.
-- Replace only the validation function. Existing revisions, privileges and immutable triggers remain intact.
CREATE OR REPLACE FUNCTION azm_validate_interview_merit_award_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE placement_round TEXT; actor_role TEXT; actor_status TEXT;
BEGIN
  SELECT schedule."roundId" INTO placement_round
    FROM public."InterviewFixedPlacement" placement
    JOIN public."InterviewFixedSchedule" schedule ON schedule.id = placement."scheduleId"
    WHERE placement.id = NEW."placementId";
  IF placement_round IS DISTINCT FROM NEW."roundId" THEN
    RAISE EXCEPTION 'Merit award must match its fixed placement and round' USING ERRCODE = '23514';
  END IF;
  SELECT "role"::text, "status" INTO actor_role, actor_status
    FROM public."User" WHERE id = NEW."actorId";
  IF actor_role IS DISTINCT FROM 'SUPER_ADMIN' OR actor_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Manual merit awards require an active Super Admin' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
