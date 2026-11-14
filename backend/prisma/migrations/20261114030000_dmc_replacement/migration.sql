BEGIN;
CREATE TABLE public."DmcReplacement" (
  "originalIssuanceId" TEXT PRIMARY KEY REFERENCES public."DmcIssuance"(id) ON DELETE RESTRICT,
  "replacementIssuanceId" TEXT NOT NULL UNIQUE REFERENCES public."DmcIssuance"(id) ON DELETE RESTRICT,
  "actorId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
  "actorName" TEXT NOT NULL,
  evidence TEXT NOT NULL CHECK (length(btrim(evidence)) BETWEEN 12 AND 1000),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 12 AND 1000),
  "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("originalIssuanceId" <> "replacementIssuanceId")
);
ALTER TABLE public."DmcReplacement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."DmcReplacement" FROM PUBLIC;
CREATE FUNCTION public.azm_protect_dmc_replacement() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'DMC replacement records are immutable'; END $$;
CREATE TRIGGER "DmcReplacement_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON public."DmcReplacement" FOR EACH STATEMENT EXECUTE FUNCTION public.azm_protect_dmc_replacement();

-- Do not trust only the HTTP service: audit relationships must connect the
-- same official result, a genuinely legacy original, and an attempt-bound
-- issued replacement. Validate statuses already appended in this transaction.
CREATE FUNCTION public.azm_validate_dmc_replacement() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1
   FROM public."DmcIssuance" prior
   JOIN public."DmcIssuance" newer ON newer.id = NEW."replacementIssuanceId"
   JOIN public."ExaminationResult" result ON result.id = newer."resultId"
   JOIN public."User" reviewer ON reviewer.id = NEW."actorId"
   WHERE prior.id = NEW."originalIssuanceId"
     AND prior."resultId" = newer."resultId"
     AND prior."documentType"::text = 'OFFICIAL'
     AND newer."documentType"::text = 'OFFICIAL'
     AND prior.snapshot->'attemptAssociation'->>'sessionId' IS NULL
     AND result."attendanceSessionId" IS NOT NULL
     AND newer.snapshot->'attemptAssociation'->>'sessionId' = result."attendanceSessionId"
     AND newer."resultRevision" = result."resultRevision"
     AND reviewer.role::text = 'SUPER_ADMIN'
     AND (SELECT ev."eventType"::text FROM public."DmcIssuanceEvent" ev
          WHERE ev."issuanceId" = prior.id
          ORDER BY ev."occurredAt" DESC, ev.id DESC LIMIT 1) = 'SUPERSEDED'
     AND (SELECT ev."eventType"::text FROM public."DmcIssuanceEvent" ev
          WHERE ev."issuanceId" = newer.id
          ORDER BY ev."occurredAt" DESC, ev.id DESC LIMIT 1) = 'ISSUED'
 ) THEN
   RAISE EXCEPTION 'Invalid or incomplete DMC replacement evidence' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "DmcReplacement_validate" BEFORE INSERT ON public."DmcReplacement"
 FOR EACH ROW EXECUTE FUNCTION public.azm_validate_dmc_replacement();
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='azm_app_dml') THEN
  GRANT SELECT, INSERT ON public."DmcReplacement" TO azm_app_dml;
  CREATE POLICY "DmcReplacement_read" ON public."DmcReplacement" FOR SELECT TO azm_app_dml USING (true);
  CREATE POLICY "DmcReplacement_insert" ON public."DmcReplacement" FOR INSERT TO azm_app_dml WITH CHECK (true);
 END IF;
END $$;
COMMIT;
