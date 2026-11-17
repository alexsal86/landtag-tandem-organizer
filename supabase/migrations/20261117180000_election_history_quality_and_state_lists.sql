BEGIN;
CREATE TABLE public.election_history_state_lists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 period_id uuid NOT NULL REFERENCES public.election_history_periods(id) ON DELETE RESTRICT,
 party text NOT NULL CHECK (length(btrim(party)) BETWEEN 1 AND 100),
 source_url text CHECK (source_url IS NULL OR source_url ~* '^https?://'), notes text
);
CREATE UNIQUE INDEX election_state_list_party ON public.election_history_state_lists(period_id,lower(btrim(party)));
CREATE TABLE public.election_history_state_list_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 list_id uuid NOT NULL REFERENCES public.election_history_state_lists(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position BETWEEN 1 AND 1000),
 person_name text NOT NULL CHECK (length(btrim(person_name)) BETWEEN 1 AND 300),
 connection_id uuid, link_mode text NOT NULL DEFAULT 'auto' CHECK (link_mode IN ('auto','manual','unlinked')),
 notes text, UNIQUE(list_id,position)
);
CREATE UNIQUE INDEX election_state_list_person ON public.election_history_state_list_entries(list_id,connection_id) WHERE connection_id IS NOT NULL;
ALTER TABLE public.election_history_state_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_history_state_list_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_history_state_lists,public.election_history_state_list_entries TO authenticated;
CREATE POLICY superadmin_write ON public.election_history_state_lists FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
CREATE POLICY superadmin_write ON public.election_history_state_list_entries FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
CREATE POLICY published_read ON public.election_history_state_lists FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_history_periods p WHERE p.id=period_id AND p.is_published));
CREATE POLICY published_read ON public.election_history_state_list_entries FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_history_state_lists l JOIN public.election_history_periods p ON p.id=l.period_id WHERE l.id=list_id AND p.is_published));
CREATE FUNCTION public.guard_election_state_list() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.election_history_periods WHERE id=NEW.period_id AND number>=18) THEN
   RAISE EXCEPTION 'Landeslisten können ab der 18. Legislaturperiode hinterlegt werden.';
 END IF;
 NEW.party:=btrim(NEW.party); RETURN NEW;
END $$;
CREATE TRIGGER election_state_list_guard BEFORE INSERT OR UPDATE ON public.election_history_state_lists FOR EACH ROW EXECUTE FUNCTION public.guard_election_state_list();
CREATE FUNCTION public.link_election_state_list_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE matches uuid[];
BEGIN
 NEW.person_name:=btrim(NEW.person_name);
 IF NEW.link_mode='unlinked' AND NEW.connection_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.link_mode='manual' AND NEW.connection_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.election_history_mandates WHERE connection_id=NEW.connection_id) THEN RAISE EXCEPTION 'Die gewählte Mandatshistorie existiert nicht mehr.'; END IF;
   RETURN NEW;
 END IF;
 -- Count every distinct exact-name connection, including historical names.
 -- Never guess an identity from party alone, create a person, or create a mandate.
 SELECT array_agg(DISTINCT m.connection_id) INTO matches
 FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
 WHERE m.connection_id IS NOT NULL AND (lower(btrim(m.person_name))=lower(NEW.person_name) OR lower(btrim(p.name))=lower(NEW.person_name));
 IF cardinality(matches)=1 AND NOT EXISTS(SELECT 1 FROM public.election_history_state_list_entries e WHERE e.list_id=NEW.list_id AND e.connection_id=matches[1] AND e.id<>NEW.id) THEN NEW.connection_id:=matches[1]; NEW.link_mode:='auto';
 ELSE NEW.connection_id:=NULL; NEW.link_mode:='unlinked'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER election_state_list_entry_link BEFORE INSERT OR UPDATE OF person_name,connection_id,link_mode,list_id ON public.election_history_state_list_entries FOR EACH ROW EXECUTE FUNCTION public.link_election_state_list_entry();
CREATE TRIGGER election_history_audit AFTER INSERT OR UPDATE OR DELETE ON public.election_history_state_lists FOR EACH ROW EXECUTE FUNCTION public.audit_election_history();
CREATE TRIGGER election_history_audit AFTER INSERT OR UPDATE OR DELETE ON public.election_history_state_list_entries FOR EACH ROW EXECUTE FUNCTION public.audit_election_history();

CREATE FUNCTION public.search_election_state_list_people(search_text text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Landeslisten verwalten' USING ERRCODE='42501'; END IF;
 IF length(btrim(search_text))<2 THEN RETURN '[]'::jsonb; END IF;
 RETURN(SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) FROM(
 SELECT m.connection_id,min(coalesce(m.person_name,p.name)) AS name,
   array_agg(DISTINCT m.party ORDER BY m.party) AS parties,
   array_agg(DISTINCT lp.number ORDER BY lp.number) AS periods,
   bool_or((lower(btrim(m.person_name))=lower(btrim(search_text)) OR lower(btrim(p.name))=lower(btrim(search_text))) IS TRUE) AS exact_match
 FROM public.election_history_mandates m JOIN public.election_history_periods lp ON lp.id=m.period_id
 LEFT JOIN public.election_history_people p ON p.id=m.person_id
 WHERE m.connection_id IS NOT NULL AND (strpos(lower(coalesce(m.person_name,'')),lower(btrim(search_text)))>0 OR strpos(lower(coalesce(p.name,'')),lower(btrim(search_text)))>0)
 GROUP BY m.connection_id ORDER BY exact_match DESC,min(coalesce(m.person_name,p.name)),m.connection_id LIMIT 20
 )g);
END $$;
-- Carry roster references through a confirmed, complete history merge. A partial
-- split retains the old reference as long as that history still exists.
CREATE FUNCTION public.sync_election_state_list_connections() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mapping record;
BEGIN
 FOR mapping IN SELECT o.connection_id AS old_id,(array_agg(DISTINCT n.connection_id))[1] AS new_id
   FROM old_mandates o JOIN new_mandates n ON n.id=o.id
   WHERE o.connection_id IS NOT NULL AND n.connection_id IS NOT NULL AND o.connection_id IS DISTINCT FROM n.connection_id
   GROUP BY o.connection_id HAVING count(DISTINCT n.connection_id)=1
 LOOP
   IF NOT EXISTS(SELECT 1 FROM public.election_history_mandates WHERE connection_id=mapping.old_id) THEN
     UPDATE public.election_history_state_list_entries e
     SET connection_id=CASE WHEN EXISTS(SELECT 1 FROM public.election_history_state_list_entries other WHERE other.list_id=e.list_id AND other.connection_id=mapping.new_id AND other.id<>e.id) THEN NULL ELSE mapping.new_id END,
       link_mode=CASE WHEN EXISTS(SELECT 1 FROM public.election_history_state_list_entries other WHERE other.list_id=e.list_id AND other.connection_id=mapping.new_id AND other.id<>e.id) THEN 'unlinked' ELSE 'manual' END
     WHERE e.connection_id=mapping.old_id;
   END IF;
 END LOOP;
 UPDATE public.election_history_state_list_entries e SET link_mode='auto'
 WHERE e.link_mode<>'manual' AND lower(btrim(e.person_name)) IN (
   SELECT lower(btrim(coalesce(n.person_name,p.name))) FROM new_mandates n LEFT JOIN public.election_history_people p ON p.id=n.person_id
   UNION SELECT lower(btrim(coalesce(o.person_name,p.name))) FROM old_mandates o LEFT JOIN public.election_history_people p ON p.id=o.person_id
 );
 RETURN NULL;
END $$;
CREATE TRIGGER election_state_list_connection_sync AFTER UPDATE ON public.election_history_mandates
 REFERENCING OLD TABLE AS old_mandates NEW TABLE AS new_mandates FOR EACH STATEMENT EXECUTE FUNCTION public.sync_election_state_list_connections();
CREATE FUNCTION public.refresh_election_state_list_matches() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.election_history_state_list_entries e SET link_mode='auto'
 WHERE e.link_mode<>'manual' AND lower(btrim(e.person_name)) IN (
   SELECT lower(btrim(coalesce(n.person_name,p.name))) FROM new_mandates n LEFT JOIN public.election_history_people p ON p.id=n.person_id
 );
 RETURN NULL;
END $$;
CREATE TRIGGER election_state_list_import_link AFTER INSERT ON public.election_history_mandates
 REFERENCING NEW TABLE AS new_mandates FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_election_state_list_matches();
CREATE FUNCTION public.guard_election_period_state_lists() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.number<18 AND EXISTS(SELECT 1 FROM public.election_history_state_lists WHERE period_id=NEW.id) THEN RAISE EXCEPTION 'Diese Periode enthält Landeslisten und kann nicht vor die 18. Legislaturperiode verschoben werden.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER election_period_state_list_guard BEFORE UPDATE OF number ON public.election_history_periods FOR EACH ROW EXECUTE FUNCTION public.guard_election_period_state_lists();
REVOKE ALL ON FUNCTION public.search_election_state_list_people(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_election_state_list_people(text) TO authenticated;

CREATE FUNCTION public.election_history_issue_rows()
RETURNS TABLE(entity text,record_id uuid,period_id uuid,period_number integer,period_name text,label text,issue_code text,issue_label text,list_id uuid)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Problemfälle öffnen' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH period_issues AS (
  SELECT p.*,i.code,i.title FROM public.election_history_periods p CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(p.source_url),'') IS NULL),
   ('election_date_missing','Wahltag fehlt',p.election_date IS NULL),
   ('start_missing','Beginn fehlt',p.starts_on IS NULL),
   ('end_missing','Ende fehlt',p.ends_on IS NULL AND NOT p.is_current AND p.expected_ends_on IS NULL)
  )i(code,title,active) WHERE i.active
 ), mandate_issues AS (
  SELECT m.*,i.code,i.title FROM public.election_history_mandates m JOIN public.election_history_periods p ON p.id=m.period_id
  CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(m.source_url),'') IS NULL),
   ('identity_missing','Personenverbindung offen',m.person_id IS NULL AND m.connection_id IS NULL),
   ('district_missing','Direktmandat ohne Wahlkreis',m.mandate_type='direct' AND m.district_id IS NULL),
   ('succession_date_missing','Nachrücker ohne eigenes Eintrittsdatum',m.entry_type='succession' AND (m.starts_on IS NULL OR m.start_from_period)),
   ('start_missing','Beginn fehlt',m.starts_on IS NULL AND m.entry_type<>'succession'),
   ('end_missing','Ende fehlt',m.ends_on IS NULL AND (m.left_early OR p.ends_on IS NOT NULL))
  )i(code,title,active) WHERE i.active
 ), district_issues AS (
  SELECT d.*,i.code,i.title FROM public.election_history_districts d CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(d.source_url),'') IS NULL),
   ('direct_missing','Kein Direktmandat zugeordnet',NOT EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=d.period_id AND m.district_id=d.id AND m.mandate_type='direct'))
  )i(code,title,active) WHERE i.active
 ), candidate_issues AS (
  SELECT c.*,i.code,i.title FROM public.election_history_candidacies c CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(c.source_url),'') IS NULL),
   ('result_missing','Ergebnis fehlt',c.votes IS NULL AND c.vote_share IS NULL),
   ('outcome_missing','Wahlausgang offen',c.outcome='unknown')
  )i(code,title,active) WHERE i.active
 )
 SELECT 'periods',p.id,p.id,p.number,p.name,p.name,p.code,p.title,NULL::uuid FROM period_issues p
 UNION ALL SELECT 'mandates',m.id,p.id,p.number,p.name,coalesce(m.person_name,person.name,'Name fehlt')||' · '||m.party,m.code,m.title,NULL::uuid FROM mandate_issues m JOIN public.election_history_periods p ON p.id=m.period_id LEFT JOIN public.election_history_people person ON person.id=m.person_id
 UNION ALL SELECT 'districts',d.id,p.id,p.number,p.name,coalesce(d.number_label,d.district_number::text,'–')||': '||d.name,d.code,d.title,NULL::uuid FROM district_issues d JOIN public.election_history_periods p ON p.id=d.period_id
 UNION ALL SELECT 'candidacies',c.id,p.id,p.number,p.name,person.name||' · '||c.party,c.code,c.title,NULL::uuid FROM candidate_issues c JOIN public.election_history_periods p ON p.id=c.period_id JOIN public.election_history_people person ON person.id=c.person_id
 UNION ALL SELECT 'districts',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Wahlkreise erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_districts d WHERE d.period_id=p.id)
 UNION ALL SELECT 'mandates',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Mandate erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=p.id)
 UNION ALL SELECT 'candidacies',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Kandidaturen erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_candidacies c WHERE c.period_id=p.id)
 UNION ALL SELECT 'state_lists',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Landeslisten erfasst',NULL::uuid FROM public.election_history_periods p WHERE p.number>=18 AND NOT EXISTS(SELECT 1 FROM public.election_history_state_lists l WHERE l.period_id=p.id)
 UNION ALL SELECT 'state_lists',l.id,p.id,p.number,p.name,l.party,'source_missing','Quelle fehlt',l.id FROM public.election_history_state_lists l JOIN public.election_history_periods p ON p.id=l.period_id WHERE nullif(btrim(l.source_url),'') IS NULL
 UNION ALL SELECT 'state_lists',l.id,p.id,p.number,p.name,l.party,'records_missing','Landesliste ohne Einträge',l.id FROM public.election_history_state_lists l JOIN public.election_history_periods p ON p.id=l.period_id WHERE NOT EXISTS(SELECT 1 FROM public.election_history_state_list_entries e WHERE e.list_id=l.id)
 UNION ALL SELECT 'state_lists',e.id,p.id,p.number,p.name,e.position::text||'. '||e.person_name||' · '||l.party,'identity_missing','Personenverbindung offen',l.id FROM public.election_history_state_list_entries e JOIN public.election_history_state_lists l ON l.id=e.list_id JOIN public.election_history_periods p ON p.id=l.period_id WHERE e.connection_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.connection_id=e.connection_id);
END $$;
CREATE FUNCTION public.get_election_history_issues(entity_filter text DEFAULT '',issue_filter text DEFAULT '',period_filter uuid DEFAULT NULL,search_text text DEFAULT '',sort_by text DEFAULT 'problem',page_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Problemfälle öffnen' USING ERRCODE='42501'; END IF;
 RETURN(WITH scoped AS MATERIALIZED(
  SELECT i.* FROM public.election_history_issue_rows() i WHERE (entity_filter='' OR i.entity=entity_filter)
   AND (period_filter IS NULL OR i.period_id=period_filter)
   AND strpos(lower(i.label||' '||i.period_name),lower(btrim(search_text)))>0
 ), filtered AS MATERIALIZED(SELECT i.* FROM scoped i WHERE issue_filter='' OR i.issue_code=issue_filter), page AS(
  SELECT * FROM filtered ORDER BY CASE WHEN sort_by='problem' THEN issue_label END,CASE WHEN sort_by='name' THEN label END,period_number DESC,entity,label,record_id,issue_code LIMIT 50 OFFSET greatest(0,page_offset)
 ) SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb),
 'total',(SELECT count(*) FROM filtered),
 'counts',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM(SELECT issue_code,CASE WHEN issue_code='records_missing' THEN 'Keine Einträge / leerer Bereich' ELSE min(issue_label) END AS label,count(*) AS count FROM scoped GROUP BY issue_code ORDER BY min(issue_label))c),'[]'::jsonb)));
END $$;
REVOKE ALL ON FUNCTION public.election_history_issue_rows() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_election_history_issues(text,text,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_history_issue_rows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_election_history_issues(text,text,uuid,text,text,integer) TO authenticated;
COMMIT;
