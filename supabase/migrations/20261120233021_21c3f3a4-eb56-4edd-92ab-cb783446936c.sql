CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  first_step text NOT NULL,
  due_in_days integer NOT NULL DEFAULT 7,
  subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, title)
);
GRANT SELECT ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Büromitglieder lesen Aufgabenpakete" ON public.task_templates
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = task_templates.tenant_id AND m.user_id = auth.uid() AND m.is_active = true)
);
CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON public.task_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.save_task_template(
  _id uuid, _tenant_id uuid, _title text, _description text, _first_step text,
  _due_in_days integer, _subtasks jsonb, _is_active boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE result_id uuid; step jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_admin(auth.uid(), _tenant_id) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung dürfen Aufgabenpakete verwalten';
  END IF;
  IF length(trim(_title)) < 2 OR length(trim(_first_step)) < 2 THEN
    RAISE EXCEPTION 'Titel und erster Schritt sind erforderlich';
  END IF;
  IF _due_in_days < 0 OR _due_in_days > 365 THEN
    RAISE EXCEPTION 'Die Gesamtfrist muss zwischen 0 und 365 Tagen liegen';
  END IF;
  IF jsonb_typeof(_subtasks) <> 'array' OR jsonb_array_length(_subtasks) > 30 THEN
    RAISE EXCEPTION 'Unteraufgaben müssen eine Liste mit höchstens 30 Einträgen sein';
  END IF;
  FOR step IN SELECT value FROM jsonb_array_elements(_subtasks) LOOP
    IF jsonb_typeof(step) <> 'object' OR length(trim(coalesce(step->>'title',''))) < 2
       OR coalesce((step->>'offsetDays')::integer,-1) < 0
       OR (step->>'offsetDays')::integer > 365 THEN
      RAISE EXCEPTION 'Jede Unteraufgabe benötigt Titel und Frist zwischen 0 und 365 Tagen';
    END IF;
  END LOOP;
  IF _id IS NULL THEN
    INSERT INTO public.task_templates
      (tenant_id,title,description,first_step,due_in_days,subtasks,is_active,created_by)
    VALUES (_tenant_id,trim(_title),trim(coalesce(_description,'')),trim(_first_step),_due_in_days,_subtasks,coalesce(_is_active,true),auth.uid())
    RETURNING id INTO result_id;
  ELSE
    UPDATE public.task_templates SET title=trim(_title),description=trim(coalesce(_description,'')),
      first_step=trim(_first_step),due_in_days=_due_in_days,subtasks=_subtasks,is_active=coalesce(_is_active,true)
    WHERE id=_id AND tenant_id=_tenant_id RETURNING id INTO result_id;
    IF result_id IS NULL THEN RAISE EXCEPTION 'Aufgabenpaket nicht gefunden'; END IF;
  END IF;
  RETURN result_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task_template(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO owner_tenant FROM public.task_templates WHERE id=_id;
  IF owner_tenant IS NULL OR auth.uid() IS NULL OR NOT public.is_tenant_admin(auth.uid(),owner_tenant) THEN
    RAISE EXCEPTION 'Aufgabenpaket nicht gefunden oder keine Berechtigung';
  END IF;
  DELETE FROM public.task_templates WHERE id=_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_task_template(_template_id uuid, _start_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE tpl public.task_templates%ROWTYPE; parent_id uuid := gen_random_uuid(); start_day date := coalesce(_start_date,current_date);
BEGIN
  SELECT * INTO tpl FROM public.task_templates WHERE id=_template_id AND is_active=true;
  IF tpl.id IS NULL OR auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m WHERE m.tenant_id=tpl.tenant_id AND m.user_id=auth.uid() AND m.is_active=true
  ) THEN RAISE EXCEPTION 'Aufgabenpaket nicht gefunden oder keine Berechtigung'; END IF;
  INSERT INTO public.tasks
    (id,tenant_id,user_id,assigned_to,title,description,status,priority,category,due_date,next_action,ball_owner)
  VALUES (parent_id,tpl.tenant_id,auth.uid(),auth.uid()::text,tpl.title,tpl.description,'todo','medium','personal',
    (start_day+tpl.due_in_days)::timestamptz,tpl.first_step,'office');
  INSERT INTO public.tasks
    (tenant_id,user_id,assigned_to,title,description,status,priority,category,due_date,parent_task_id)
  SELECT tpl.tenant_id,auth.uid(),auth.uid()::text,trim(s.value->>'title'),NULL,'todo','medium','personal',
    (start_day+(s.value->>'offsetDays')::integer)::timestamptz,parent_id
  FROM jsonb_array_elements(tpl.subtasks) s(value);
  RETURN parent_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_task_template(uuid,uuid,text,text,text,integer,jsonb,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.delete_task_template(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.apply_task_template(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_task_template(uuid,uuid,text,text,text,integer,jsonb,boolean) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_task_template(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.apply_task_template(uuid,date) TO authenticated,service_role;

WITH defaults(title,description,first_step,due_in_days,subtasks) AS (VALUES
 ('Vorbereitung Plenarwoche','Alles für die kommende Plenarwoche vorbereiten.','Tagesordnung sichten',7,'[{"title":"Tagesordnung sichten und Themen markieren","offsetDays":1},{"title":"Fraktionsabstimmung vorbereiten","offsetDays":3},{"title":"Redeentwurf schreiben","offsetDays":4},{"title":"Briefingmappe zusammenstellen","offsetDays":5},{"title":"Social-Media-Beiträge planen","offsetDays":6}]'::jsonb),
 ('Bürgersprechstunde','Sprechstunde vor- und nachbereiten.','Anmeldungen prüfen',14,'[{"title":"Anmeldungen prüfen und Termine vergeben","offsetDays":2},{"title":"Anliegen recherchieren / Dossiers vorbereiten","offsetDays":5},{"title":"Raum und Ablauf organisieren","offsetDays":6},{"title":"Nachbereitung: Antwortbriefe versenden","offsetDays":14}]'::jsonb),
 ('Kleine Anfrage an die Landesregierung','Kleine Anfrage erarbeiten, einreichen und Antwortfrist überwachen.','Fachrecherche',30,'[{"title":"Fachrecherche und Fragestellung","offsetDays":3},{"title":"Rechtliche / formale Prüfung","offsetDays":5},{"title":"Freigabe durch Abgeordnete","offsetDays":6},{"title":"Einreichen","offsetDays":7},{"title":"Antwortfrist prüfen (21 Tage)","offsetDays":28}]'::jsonb)
)
INSERT INTO public.task_templates (tenant_id,title,description,first_step,due_in_days,subtasks)
SELECT t.id,d.title,d.description,d.first_step,d.due_in_days,d.subtasks FROM public.tenants t CROSS JOIN defaults d
ON CONFLICT (tenant_id,title) DO NOTHING;