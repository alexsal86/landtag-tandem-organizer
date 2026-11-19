CREATE OR REPLACE FUNCTION public.guard_analysis_scenario() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pair record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR NEW.owner_id<>OLD.owner_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'Szenario-Eigentümer und Büro sind unveränderlich'; END IF;
  NEW.revision:=OLD.revision+1;NEW.created_at:=OLD.created_at;
 ELSE NEW.revision:=1;NEW.created_at:=now(); END IF;
 NEW.updated_at:=now();
 FOR pair IN SELECT key,value FROM jsonb_each(NEW.params) LOOP
  IF length(pair.key)>160 OR jsonb_typeof(pair.value)<>'string' OR length(pair.value::text)>6000 OR
   NOT(pair.key IN('analysisYear','analysisBallot','analysisSection','researchTool','scenarioMapParty','seatBalancing','seatThresholdParty','seatLotOrder','seatCorrections','seatSpecialFirst') OR pair.key LIKE 'scenarioDelta\_%' ESCAPE '\' OR pair.key LIKE 'seatFirst\_%' ESCAPE '\' OR pair.key LIKE 'seatSecond\_%' ESCAPE '\' OR pair.key LIKE 'seatDirect\_%' ESCAPE '\' OR pair.key LIKE 'seatDistrictLot\_%' ESCAPE '\' OR
     (NEW.model_version='bw-lwg-2026-v1' AND pair.key ~ '^seatFlip_([1-9]|[1-6][0-9]|70)$'
       AND length(pair.value #>> '{}') BETWEEN 1 AND 80 AND jsonb_typeof(NEW.input_snapshot->'file') IS NOT DISTINCT FROM 'object')) THEN
   RAISE EXCEPTION 'Nicht unterstützter oder regionaler Szenarioparameter: %',pair.key;
  END IF;
 END LOOP;
 IF NEW.model_version='bw-lwg-2026-v1' AND (NEW.year<>2026 OR NEW.ballot<>'second') THEN RAISE EXCEPTION 'Wahlrecht nur für 2026 implementiert'; END IF;
 RETURN NEW;
END $$;
