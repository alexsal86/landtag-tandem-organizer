-- Personal acknowledgement is immutable and contains the exact declaration snapshot.
ALTER TABLE public.employee_hr_evidence ADD COLUMN IF NOT EXISTS declaration_version text;
ALTER TABLE public.employee_hr_evidence ADD COLUMN IF NOT EXISTS declaration_text text;
CREATE OR REPLACE FUNCTION public.complete_employee_hr_step(p_step uuid,p_confirmed_on date DEFAULT NULL,p_document uuid DEFAULT NULL,p_deputy uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item routine_package_steps; pkg routine_package_runs; employment employee_lifecycle; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 SELECT r.* INTO pkg FROM routine_package_runs r JOIN routine_package_steps s ON s.run_id=r.id WHERE s.id=p_step FOR UPDATE OF r;
 SELECT * INTO employment FROM employee_lifecycle WHERE id=pkg.employee_lifecycle_id;
 IF NOT FOUND OR NOT can_view_employee_hr(employment.tenant_id,employment.user_id) THEN RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE='42501'; END IF;
 PERFORM automation_private.advance_routine_package(pkg.id);
 SELECT * INTO item FROM routine_package_steps WHERE id=p_step;
 IF item.status='completed' THEN RETURN; END IF;
 IF item.entity_id IS NULL OR item.status NOT IN ('active','blocked') THEN RAISE EXCEPTION 'Der Arbeitsschritt wurde noch nicht gestartet: %',coalesce(item.error_message,'Wartet auf Termin oder Fortsetzung') USING ERRCODE='22023'; END IF;
 IF item.hr_evidence_kind='gdpr' THEN
  IF auth.uid() IS DISTINCT FROM employment.user_id OR NOT EXISTS(SELECT 1 FROM employee_hr_evidence WHERE step_id=item.id AND confirmed_by=auth.uid() AND declaration_version IS NOT NULL) THEN RAISE EXCEPTION 'Bitte die DSGVO-Verpflichtung persönlich öffnen, lesen und bestätigen.' USING ERRCODE='42501'; END IF;
 ELSIF item.hr_evidence_kind<>'none' THEN
  IF NOT is_tenant_config_admin(employment.tenant_id) THEN RAISE EXCEPTION 'Nachweise bestätigt die Büroleitung oder eine abgeordnete Person.' USING ERRCODE='42501'; END IF;
  IF item.hr_evidence_kind='gdpr' AND (p_confirmed_on IS NULL OR p_confirmed_on>today) THEN RAISE EXCEPTION 'Ein gültiges Nachweisdatum bis heute ist erforderlich.' USING ERRCODE='22023'; END IF;
  IF p_document IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents WHERE id=p_document AND tenant_id=employment.tenant_id) THEN RAISE EXCEPTION 'Dokument gehört nicht zum Büro.' USING ERRCODE='42501'; END IF;
  IF item.hr_evidence_kind='handover' THEN PERFORM handover_tasks_to_deputy(employment.tenant_id,employment.user_id,p_deputy); END IF;
  INSERT INTO employee_hr_evidence(tenant_id,step_id,user_id,confirmed_on,confirmed_by,document_id) VALUES(employment.tenant_id,item.id,employment.user_id,coalesce(p_confirmed_on,today),auth.uid(),p_document) ON CONFLICT(step_id) DO NOTHING;
 END IF;
 IF item.kind='task' THEN UPDATE tasks SET status='completed' WHERE id=item.entity_id AND tenant_id=employment.tenant_id;
 ELSIF item.kind='subtask' THEN UPDATE subtasks SET is_completed=true WHERE id=item.entity_id AND task_id=pkg.task_id; END IF;
 PERFORM automation_private.advance_routine_package(pkg.id);
END $$;
REVOKE ALL ON FUNCTION public.complete_employee_hr_step(uuid,date,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_employee_hr_step(uuid,date,uuid,uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.confirm_employee_hr_gdpr(p_step uuid,p_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item routine_package_steps; pkg routine_package_runs; employment employee_lifecycle;
BEGIN
 SELECT r.* INTO pkg FROM routine_package_runs r JOIN routine_package_steps s ON s.run_id=r.id WHERE s.id=p_step FOR UPDATE OF r;
 SELECT * INTO employment FROM employee_lifecycle WHERE id=pkg.employee_lifecycle_id;
 IF NOT FOUND OR auth.uid() IS DISTINCT FROM employment.user_id OR NOT can_view_employee_hr(employment.tenant_id,employment.user_id) THEN RAISE EXCEPTION 'Nur die betroffene Person darf persönlich bestätigen.' USING ERRCODE='42501'; END IF;
 IF p_version IS DISTINCT FROM '2026-11-13.1' THEN RAISE EXCEPTION 'Die Textversion ist veraltet. Bitte erneut öffnen.' USING ERRCODE='22023'; END IF;
 SELECT * INTO item FROM routine_package_steps WHERE id=p_step;
 IF item.hr_evidence_kind IS DISTINCT FROM 'gdpr' OR pkg.hr_direction IS DISTINCT FROM 'onboarding' THEN RAISE EXCEPTION 'Kein DSGVO-Onboarding-Schritt.' USING ERRCODE='22023'; END IF;
 IF item.status='completed' THEN RETURN; END IF;
 IF item.entity_id IS NULL OR item.status NOT IN ('active','blocked') THEN RAISE EXCEPTION 'Der Schritt ist noch nicht freigegeben.' USING ERRCODE='22023'; END IF;
 INSERT INTO employee_hr_evidence(tenant_id,step_id,user_id,confirmed_on,confirmed_by,declaration_version,declaration_text)
 VALUES(employment.tenant_id,item.id,employment.user_id,(now() AT TIME ZONE 'Europe/Berlin')::date,auth.uid(),p_version,$declaration$Verpflichtung auf Datenschutz und Vertraulichkeit

Geltungsbereich und Vertraulichkeit
Ich verpflichte mich, personenbezogene Daten, die mir im Rahmen meiner Tätigkeit zugänglich werden, vertraulich zu behandeln. Dazu gehören insbesondere Angaben über Beschäftigte, Bewerberinnen und Bewerber, Bürgerinnen und Bürger sowie Kontaktpersonen. Die Verpflichtung gilt für digitale Daten, Papierunterlagen, Gespräche und alle weiteren Formen der Verarbeitung, auch im Homeoffice und unterwegs.

Verarbeitung nur für dienstliche Zwecke
Ich verarbeite personenbezogene Daten nur im Rahmen meiner Aufgaben, meiner Berechtigungen und der rechtmäßigen Weisungen der verantwortlichen Stelle (Art. 29 und Art. 32 Abs. 4 DSGVO). Ich greife nur auf die für meine Aufgabe erforderlichen Daten zu. Ich verwende sie nicht für private Zwecke und gebe sie nur an berechtigte Personen weiter. Bei unklaren oder möglicherweise rechtswidrigen Weisungen kläre ich den Sachverhalt vor der Verarbeitung mit der zuständigen Leitung oder Datenschutzstelle.

Grundsätze des Datenschutzes
Ich beachte insbesondere Rechtmäßigkeit, Zweckbindung, Datenminimierung, Richtigkeit, Speicherbegrenzung sowie Integrität und Vertraulichkeit (Art. 5 DSGVO). Ich erhebe und nutze nur erforderliche Daten und beachte die vorgesehenen Aufbewahrungs- und Löschregeln. Eigenmächtige Kopien, private Archive oder eine Nutzung für andere Zwecke sind unzulässig.

Besonders schutzbedürftige Informationen
Gesundheitsdaten, politische Meinungen, religiöse Überzeugungen und andere besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO sowie Angaben über strafrechtliche Verurteilungen nach Art. 10 DSGVO behandle ich mit besonderer Sorgfalt. Ich verarbeite sie nur, wenn dies ausdrücklich zu meinen Aufgaben gehört und die dafür vorgesehenen Voraussetzungen und Schutzmaßnahmen erfüllt sind.

Sicherer Umgang mit Daten und Arbeitsmitteln
Ich nutze nur freigegebene Geräte, Programme, Speicherorte und Übertragungswege. Ich schütze Zugangsdaten, gebe sie nicht weiter und sperre meinen Bildschirm bei Abwesenheit. Unterlagen und Geräte bewahre ich vor unbefugtem Zugriff geschützt auf. Vor dem Versand prüfe ich Empfänger und Berechtigungen. Personenbezogene oder vertrauliche Inhalte übertrage ich nur nach ausdrücklicher Freigabe in externe Dienste, private E-Mail-Konten, Cloudspeicher oder KI-Anwendungen.

Vorfälle unverzüglich melden
Verlorene Geräte oder Unterlagen, Fehlversand, verdächtige Zugriffe und andere mögliche Datenschutzverletzungen melde ich unverzüglich über die internen Meldewege an die zuständige Leitung oder Datenschutzstelle. Ich sichere verfügbare Informationen und wirke an der Aufklärung mit. Ich entscheide nicht selbst über eine Meldung an Aufsichtsbehörden oder betroffene Personen; hierfür ist die verantwortliche Stelle zuständig.

Anfragen und Rechte betroffener Personen
Anfragen zu Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit oder Widerspruch leite ich unverzüglich an die zuständige Stelle weiter. Ich erteile keine unbefugten Auskünfte und beachte die internen Verfahren zur Prüfung von Identität, Berechtigung und Fristen.

Fortgeltung, Rückgabe und Folgen
Diese Vertraulichkeitspflicht gilt auch nach einem Aufgabenwechsel und nach dem Ende meiner Tätigkeit fort. Bei deren Beendigung gebe ich dienstliche Unterlagen und Arbeitsmittel zurück und behalte keine unbefugten Kopien. Gesetzliche Offenlegungsrechte und geschützte Meldungen von Rechtsverstößen bleiben unberührt. Verstöße können abhängig vom Einzelfall arbeits- oder dienstrechtliche, zivilrechtliche und strafrechtliche Folgen haben. Die gesetzlichen Pflichten der verantwortlichen Stelle bleiben bestehen.

Persönliche Erklärung
Ich habe diese Verpflichtung vollständig gelesen und verstanden und verpflichte mich, sie einzuhalten. Bei Fragen oder Unsicherheiten wende ich mich vor der betreffenden Verarbeitung an die zuständige Leitung oder Datenschutzstelle. Diese Erklärung dokumentiert meine Verpflichtung zur Vertraulichkeit; sie ist keine Einwilligung in die Verarbeitung meiner eigenen Beschäftigtendaten und ersetzt keine erforderliche Datenschutzunterweisung.$declaration$) ON CONFLICT(step_id) DO NOTHING;
 PERFORM complete_employee_hr_step(p_step);
END $$;
REVOKE ALL ON FUNCTION public.confirm_employee_hr_gdpr(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_employee_hr_gdpr(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.selftest_employee_hr(p_tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE template_id uuid; lifecycle uuid; first_run uuid; second_run uuid; result jsonb; actual_count integer; sample jsonb:='[{"title":"[SELFTEST] Pflichtnachweis","phase":"first_week","is_mandatory":true,"anchor":"start","offset_days":14,"evidence":"gdpr","kind":"subtask","release":"package_start"}]'; denied boolean:=false; target uuid; run_task uuid; type_name text:='selftest-'||substr(gen_random_uuid()::text,1,8); fixture_start date:=(now() AT TIME ZONE 'Europe/Berlin')::date-45; reminders integer; reminder_repeat integer;
BEGIN
 IF NOT is_tenant_config_admin(p_tenant) OR NOT user_belongs_to_tenant(p_tenant) THEN RAISE EXCEPTION 'Nur Leitung und Abgeordnete prüfen diesen Ablauf.' USING ERRCODE='42501'; END IF;
 BEGIN
  template_id:=save_employee_hr_template(p_tenant,'[SELFTEST] HR',type_name,'onboarding',sample);
  WHILE EXISTS(SELECT 1 FROM employee_lifecycle WHERE tenant_id=p_tenant AND user_id=auth.uid() AND start_date=fixture_start) LOOP fixture_start:=fixture_start-1; END LOOP;
  lifecycle:=save_employee_lifecycle(p_tenant,auth.uid(),type_name,fixture_start,(now() AT TIME ZONE 'Europe/Berlin')::date+10);
  first_run:=start_employee_hr(lifecycle,template_id);second_run:=start_employee_hr(lifecycle,template_id);
  SELECT count(*),min(entity_id::text)::uuid INTO actual_count,target FROM routine_package_steps WHERE run_id=first_run;
  SELECT task_id INTO run_task FROM routine_package_runs WHERE id=first_run;
  reminders:=remind_employee_hr(lifecycle);reminder_repeat:=remind_employee_hr(lifecycle);
  BEGIN UPDATE subtasks SET is_completed=true WHERE id=target; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  PERFORM confirm_employee_hr_gdpr((SELECT id FROM routine_package_steps WHERE run_id=first_run),'2026-11-13.1');
  result:=jsonb_build_object('idempotent',first_run=second_run,'single_daily_reminder',reminders>0 AND reminder_repeat=0,'single_step',actual_count=1,'evidence_guard',denied,'proof_saved',EXISTS(SELECT 1 FROM employee_hr_evidence WHERE step_id IN(SELECT id FROM routine_package_steps WHERE run_id=first_run)),'completed',EXISTS(SELECT 1 FROM tasks WHERE id=run_task AND status='completed'));
  RAISE EXCEPTION 'HR-Selbsttest-Fixures zurückrollen' USING ERRCODE='P0004';
 EXCEPTION WHEN SQLSTATE 'P0004' THEN NULL;
 END;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.selftest_employee_hr(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.selftest_employee_hr(uuid) TO authenticated;
