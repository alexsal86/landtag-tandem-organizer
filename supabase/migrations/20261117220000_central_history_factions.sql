-- A shared catalog, including historical parties which did not form a faction.
BEGIN;
CREATE TABLE public.election_history_factions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 1 AND 100),
 result_code text NOT NULL DEFAULT '',
 full_name text, aliases text[] NOT NULL DEFAULT '{}', is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.election_history_factions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_history_factions FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.election_history_factions TO authenticated;
CREATE POLICY faction_read ON public.election_history_factions FOR SELECT TO authenticated USING (true);
CREATE POLICY faction_write ON public.election_history_factions FOR ALL TO authenticated
 USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
CREATE FUNCTION public.history_faction_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT lower(regexp_replace(btrim($1),'[[:space:]]+',' ','g'));
$$;
CREATE UNIQUE INDEX history_faction_name_key ON public.election_history_factions(public.history_faction_key(name));
CREATE FUNCTION public.resolve_history_faction(value text) RETURNS text
LANGUAGE sql STABLE STRICT SET search_path=public AS $$
 SELECT f.name FROM public.election_history_factions f
 WHERE public.history_faction_key($1)=public.history_faction_key(f.name)
 OR EXISTS (SELECT 1 FROM unnest(f.aliases) a WHERE public.history_faction_key(a)=public.history_faction_key($1));
$$;
CREATE FUNCTION public.guard_history_faction_catalog() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE keys text[];
BEGIN
 -- Serialize alias edits too: a spelling must identify exactly one catalog row.
 PERFORM pg_advisory_xact_lock(17611,22000);
 NEW.name:=btrim(NEW.name);
 IF TG_OP='INSERT' AND NEW.result_code='' THEN
  NEW.result_code:=CASE NEW.name WHEN 'FDP/DVP' THEN 'FDP' WHEN 'Grüne' THEN 'GRÜNE' ELSE NEW.name END;
 ELSIF TG_OP='UPDATE' AND NEW.result_code IS DISTINCT FROM OLD.result_code THEN
  RAISE EXCEPTION 'Die feste Quellenzuordnung darf beim Umbenennen nicht geändert werden';
 END IF;
 IF TG_OP='UPDATE' AND NEW.name IS DISTINCT FROM OLD.name THEN NEW.aliases:=array_append(NEW.aliases,OLD.name); END IF;
 NEW.aliases:=ARRAY(SELECT min(btrim(a)) FROM unnest(NEW.aliases) a
  WHERE nullif(btrim(a),'') IS NOT NULL AND public.history_faction_key(a)<>public.history_faction_key(NEW.name)
  GROUP BY public.history_faction_key(a) ORDER BY min(btrim(a)));
 IF cardinality(NEW.aliases)>100 OR EXISTS(SELECT 1 FROM unnest(NEW.aliases) a WHERE length(a)>100) THEN
  RAISE EXCEPTION 'Zu viele oder zu lange Schreibweisen (höchstens 100 mit je 100 Zeichen)';
 END IF;
 SELECT array_agg(public.history_faction_key(a)) INTO keys FROM unnest(array_prepend(NEW.name,NEW.aliases)) a;
 IF EXISTS(SELECT 1 FROM public.election_history_factions f,
    LATERAL unnest(array_prepend(f.name,f.aliases)) a
    WHERE f.id<>NEW.id AND public.history_faction_key(a)=ANY(keys)) THEN
   RAISE EXCEPTION 'Diese Bezeichnung oder Schreibweise gehört bereits zu einem anderen Verzeichniseintrag';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER a_guard_history_faction_catalog BEFORE INSERT OR UPDATE ON public.election_history_factions
 FOR EACH ROW EXECUTE FUNCTION public.guard_history_faction_catalog();
CREATE TRIGGER election_history_audit AFTER INSERT OR UPDATE ON public.election_history_factions
 FOR EACH ROW EXECUTE FUNCTION public.audit_election_history();

INSERT INTO public.election_history_factions(name,full_name,aliases) VALUES
 ('CDU','Christlich Demokratische Union Deutschlands',ARRAY['Christlich Demokratische Union']),
 ('SPD','Sozialdemokratische Partei Deutschlands','{}'),
 ('FDP/DVP','Freie Demokratische Partei / Demokratische Volkspartei',ARRAY['FDP','FDP / DVP','FDP-DVP']),
 ('Grüne','Bündnis 90/Die Grünen',ARRAY['Bündnis 90 / Die Grünen','BÜNDNIS 90/DIE GRÜNEN','Die Grünen','B90/Grüne']),
 ('AfD','Alternative für Deutschland','{}'),
 ('BHE','Block der Heimatvertriebenen und Entrechteten','{}'),
 ('GB/BHE','Gesamtdeutscher Block / Block der Heimatvertriebenen und Entrechteten',ARRAY['GB / BHE']),
 ('KPD','Kommunistische Partei Deutschlands','{}'),
 ('NPD','Nationaldemokratische Partei Deutschlands','{}'),
 ('REP','Die Republikaner',ARRAY['Republikaner','Die Republikaner']),
 ('fraktionslos',NULL,ARRAY['ohne Fraktion']);
-- Do not discard unfamiliar historical labels or guess political identities.
-- Only the explicit spelling aliases above and case/whitespace are normalized.
DO $$ DECLARE label text; BEGIN
 FOR label IN
  SELECT party FROM public.election_history_mandates
  UNION SELECT party_label FROM public.election_history_mandates WHERE nullif(btrim(party_label),'') IS NOT NULL
  UNION SELECT party FROM public.election_history_candidacies
  UNION SELECT party FROM public.election_history_state_lists
  UNION SELECT r->>'faction' FROM public.election_history_periods p CROSS JOIN LATERAL jsonb_array_elements(p.seat_distribution) r
 LOOP
  IF public.resolve_history_faction(label) IS NULL THEN
   INSERT INTO public.election_history_factions(name) VALUES(btrim(label));
  END IF;
 END LOOP;
END $$;

-- Keep assembly tied to immutable official result codes after catalog renames.
CREATE OR REPLACE FUNCTION public.history_result_party(label text) RETURNS text
LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT coalesce((SELECT f.result_code FROM public.election_history_factions f
  WHERE f.name=public.resolve_history_faction($1)),
  CASE upper(btrim($1)) WHEN 'FDP/DVP' THEN 'FDP' WHEN 'FDP' THEN 'FDP'
   WHEN 'GRÜNE' THEN 'GRÜNE' WHEN 'BÜNDNIS 90/DIE GRÜNEN' THEN 'GRÜNE'
   WHEN 'AFD' THEN 'AfD' ELSE btrim($1) END);
$$;

-- Normalize linked text columns before enforcing real catalog foreign keys.
UPDATE public.election_history_mandates SET party=public.resolve_history_faction(party),
 party_label=public.resolve_history_faction(nullif(btrim(party_label),''))
 WHERE party IS DISTINCT FROM public.resolve_history_faction(party)
 OR party_label IS DISTINCT FROM public.resolve_history_faction(nullif(btrim(party_label),''));
UPDATE public.election_history_candidacies SET party=public.resolve_history_faction(party)
 WHERE party IS DISTINCT FROM public.resolve_history_faction(party);
UPDATE public.election_history_state_lists SET party=public.resolve_history_faction(party)
 WHERE party IS DISTINCT FROM public.resolve_history_faction(party);
ALTER TABLE public.election_history_mandates
 ADD CONSTRAINT mandate_party_catalog FOREIGN KEY(party) REFERENCES public.election_history_factions(name) ON UPDATE CASCADE ON DELETE RESTRICT,
 ADD CONSTRAINT mandate_faction_catalog FOREIGN KEY(party_label) REFERENCES public.election_history_factions(name) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.election_history_candidacies
 ADD CONSTRAINT candidacy_party_catalog FOREIGN KEY(party) REFERENCES public.election_history_factions(name) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.election_history_state_lists
 ADD CONSTRAINT state_list_party_catalog FOREIGN KEY(party) REFERENCES public.election_history_factions(name) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Both manual edits and server-side assembly/imports resolve aliases before guards.
CREATE FUNCTION public.normalize_history_faction_reference() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE canonical text;
BEGIN
 canonical:=public.resolve_history_faction(NEW.party);
 IF canonical IS NULL THEN RAISE EXCEPTION 'Partei / Fraktion nicht im zentralen Verzeichnis: %. Bitte zuerst dort anlegen oder zuordnen.',NEW.party; END IF;
 NEW.party:=canonical;
 IF TG_TABLE_NAME='election_history_mandates' THEN
  IF nullif(btrim(NEW.party_label),'') IS NOT NULL THEN
   canonical:=public.resolve_history_faction(NEW.party_label);
   IF canonical IS NULL THEN RAISE EXCEPTION 'Historische Fraktion nicht im zentralen Verzeichnis: %',NEW.party_label; END IF;
   NEW.party_label:=canonical;
  ELSE NEW.party_label:=NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_normalize_faction BEFORE INSERT OR UPDATE OF party,party_label ON public.election_history_mandates
 FOR EACH ROW EXECUTE FUNCTION public.normalize_history_faction_reference();
CREATE TRIGGER aa_normalize_faction BEFORE INSERT OR UPDATE OF party ON public.election_history_candidacies
 FOR EACH ROW EXECUTE FUNCTION public.normalize_history_faction_reference();
CREATE TRIGGER aa_normalize_faction BEFORE INSERT OR UPDATE OF party ON public.election_history_state_lists
 FOR EACH ROW EXECUTE FUNCTION public.normalize_history_faction_reference();

-- Seat snapshots retain their sourced counts, but each faction is catalog-backed.
CREATE FUNCTION public.normalize_history_seat_factions() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r jsonb; canonical text; rows jsonb:='[]';
BEGIN
 IF jsonb_typeof(NEW.seat_distribution) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(NEW.seat_distribution) LOOP
  canonical:=public.resolve_history_faction(r->>'faction');
  IF canonical IS NULL THEN RAISE EXCEPTION 'Partei / Fraktion der Sitzverteilung fehlt im zentralen Verzeichnis: %',r->>'faction'; END IF;
  rows:=rows||jsonb_build_array(jsonb_set(r,'{faction}',to_jsonb(canonical)));
 END LOOP;
 NEW.seat_distribution:=rows; RETURN NEW;
END $$;
CREATE TRIGGER aa_normalize_seat_factions BEFORE INSERT OR UPDATE OF seat_distribution ON public.election_history_periods
 FOR EACH ROW EXECUTE FUNCTION public.normalize_history_seat_factions();
-- Existing spelling variants inside one snapshot combine without losing seats.
WITH normalized AS (
 SELECT p.id,public.resolve_history_faction(r->>'faction') faction,sum((r->>'seats')::integer)::integer seats,min(ord) ord
 FROM public.election_history_periods p CROSS JOIN LATERAL jsonb_array_elements(p.seat_distribution) WITH ORDINALITY x(r,ord)
 GROUP BY p.id,public.resolve_history_faction(r->>'faction')
), grouped AS (
 SELECT id,jsonb_agg(jsonb_build_object('faction',faction,'seats',seats) ORDER BY ord) distribution FROM normalized GROUP BY id
)
UPDATE public.election_history_periods p SET seat_distribution=g.distribution FROM grouped g
 WHERE p.id=g.id AND p.seat_distribution IS DISTINCT FROM g.distribution;

CREATE FUNCTION public.propagate_history_faction_name() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.name IS DISTINCT FROM OLD.name THEN
  -- Relational references cascade via FK; JSON snapshots need an explicit rewrite.
  UPDATE public.election_history_periods p SET seat_distribution=(
   SELECT jsonb_agg(CASE WHEN r->>'faction'=OLD.name THEN jsonb_set(r,'{faction}',to_jsonb(NEW.name)) ELSE r END ORDER BY ord)
   FROM jsonb_array_elements(p.seat_distribution) WITH ORDINALITY x(r,ord))
  WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p.seat_distribution) r WHERE r->>'faction'=OLD.name);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER z_propagate_history_faction_name AFTER UPDATE OF name ON public.election_history_factions
 FOR EACH ROW EXECUTE FUNCTION public.propagate_history_faction_name();
REVOKE ALL ON FUNCTION public.guard_history_faction_catalog(),public.normalize_history_faction_reference(),public.normalize_history_seat_factions(),public.propagate_history_faction_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.history_faction_key(text),public.resolve_history_faction(text) TO authenticated;
COMMIT;
