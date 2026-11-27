-- Themen-Wolke für die Ministerien (#Themen)
--
-- Ziel: ein tragfähiger Grundbestand im zentralen Themenkatalog, der die
-- Ressortlinien aus parlis_ministry_lines abbildet. 69 Themen, je Ressortlinie
-- 5–10, plus bewusste Querverbindungen (z. B. Klima → Verkehr, Umwelt,
-- Ländlicher Raum, Wohnen).
--
-- Jedes Label ist genau ein Wort ohne Leerzeichen und höchstens 20 Zeichen,
-- damit es im Editor direkt als #Begriff getippt werden kann: der
-- Erwähnungs-Trigger endet an Leerzeichen, mehrwortige Labels wären also nur
-- über das Menü erreichbar. Die inhaltliche Abgrenzung steht deshalb in der
-- Beschreibung und darf gern ausführlich sein.
--
-- Bereits vorhandene zentrale Themen (Bildung, Wissenschaft, Verkehr, Umwelt,
-- Soziales, Wirtschaft, Digitalisierung, Sicherheit, …) werden wiederverwendet:
-- leere Beschreibungen erhalten die ausführliche Beschreibung aus dieser Wolke,
-- Icon und Farbe werden auf die Ressortfarbe vereinheitlicht. Gepflegte
-- Beschreibungen bleiben stehen; Themen außerhalb der Wolke bleiben unberührt.
--
-- Die Wolke wird für jeden Mandanten einmal angelegt und danach für jedes neue
-- Büro automatisch: seed_ministry_topic_cloud() ist idempotent, der Trigger auf
-- tenants ruft sie bei der Anlage auf, der Backfill holt bestehende Büros nach.
-- Mandanten ohne Ressortlinien oder mit abweichender Themenwahl bleiben
-- unberührt, weil nur fehlende Labels ergänzt und nur vorhandene Linien
-- verknüpft werden.
--
-- Klassifikationen (Kategorien, Status, Orte) bleiben unverändert.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Datengrundlage: ein Thema pro Zeile, Ressortlinien als Array.
--    Die Zeilenreihenfolge bestimmt die Sortierung im Themenkatalog.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ministry_topic_cloud()
RETURNS TABLE (label text, lines text[], icon text, color text, description text, sort integer)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT v.label, v.lines::text[], v.icon, v.color, v.description, v.sort
  FROM (VALUES
    -- Staatsministerium
    ('Bürokratie', '{state}', 'Settings', '#475569',
     'Anträge, Verfahren und Fristen vereinfachen; Abbau von Berichts-, Nachweis- und Genehmigungspflichten', 1),
    ('Verwaltung', '{state}', 'Workflow', '#475569',
     'Leistungsfähige Verwaltung, Personalgewinnung, Bürgerbüros und schnellere Bearbeitungszeiten', 2),
    ('Medien', '{state}', 'Radio', '#475569',
     'Presse- und Rundfunkangebote, Medienförderung, Lokaljournalismus und Medienkompetenz', 3),
    ('Europa', '{state}', 'Globe', '#475569',
     'EU-Gesetzgebung, Ausschuss der Regionen, Landesinteressen in Brüssel und EU-Fördermittel', 4),
    ('Ehrenamt', '{state,rural}', 'HeartHandshake', '#475569',
     'Vereine, Feuerwehren, Freiwilligendienste, Anerkennung und Entlastung von Engagierten', 5),
    ('Digitalisierung', '{state,interior}', 'MonitorSmartphone', '#2563eb',
     'Sammelthema für E-Government, Onlinezugangsgesetz, IT-Infrastruktur, Registermodernisierung und Breitband', 6),

    -- Inneres und Digitalisierung
    ('Sicherheit', '{interior}', 'Shield', '#2563eb',
     'Sammelthema für Innere Sicherheit: Kriminalitätsbekämpfung, Gefahrenabwehr und Schutz der Bevölkerung', 7),
    ('Polizei', '{interior}', 'Siren', '#2563eb',
     'Personal, Ausstattung, Ausbildung, Organisation und Präsidien der Polizei des Landes', 8),
    ('Extremismus', '{interior}', 'AlertTriangle', '#2563eb',
     'Rechtsextremismus, Linksextremismus, Islamismus, Prävention und Demokratieförderung', 9),
    ('Katastrophenschutz', '{interior,environment}', 'Network', '#2563eb',
     'Feuerwehren, Rettungsdienst, Warnsysteme und Bewältigung von Großschadenslagen', 10),
    ('Cybersicherheit', '{interior}', 'Lock', '#2563eb',
     'IT-Sicherheit von Land und Kommunen, Angriffe auf Verwaltungsnetze und Sicherheitsforschung', 11),
    ('Kommunen', '{interior}', 'Landmark', '#2563eb',
     'Kommunalaufsicht, Städte und Gemeinden, Landkreise und interkommunale Zusammenarbeit', 12),
    ('Datenschutz', '{interior,justice}', 'ShieldCheck', '#7c3aed',
     'Datenschutzaufsicht, Informationsfreiheit, Akteneinsicht und Umgang mit personenbezogenen Daten', 13),
    ('Finanzausgleich', '{interior,finance}', 'Landmark', '#059669',
     'Verteilung der Landesmittel an die Kommunen, Schlüsselzuweisungen und Bedarfszuweisungen', 14),

    -- Justiz und Migration
    ('Justiz', '{justice}', 'Scale', '#7c3aed',
     'Gerichte, Staatsanwaltschaften, Personal und Ausstattung der ordentlichen Gerichtsbarkeit', 15),
    ('Strafvollzug', '{justice}', 'Building2', '#7c3aed',
     'Justizvollzugsanstalten, Unterbringung, Resozialisierung und Opferschutz', 16),
    ('Migration', '{justice}', 'Users', '#7c3aed',
     'Aufenthalt, Asylverfahren, Aufnahme, Integration und Sprachförderung', 17),
    ('Rechtsstaat', '{justice}', 'BookOpen', '#7c3aed',
     'Verfassung, Grundrechte, Verfahrensrechte und Unabhängigkeit der Gerichte', 18),

    -- Finanzen
    ('Haushalt', '{finance}', 'Wallet', '#059669',
     'Landeshaushalt, Nachtragshaushalt, Einzelpläne und Haushaltsberatungen', 19),
    ('Steuern', '{finance}', 'Coins', '#059669',
     'Landessteuern, Steuerpolitik, Grunderwerbsteuer und Vollzug der Steuergesetze', 20),
    ('Beteiligungen', '{finance}', 'PieChart', '#059669',
     'Landesbeteiligungen, Aufsichtsräte, Beteiligungsbericht und Landesvermögen', 21),
    ('Vergabe', '{finance}', 'FileCheck', '#059669',
     'Öffentliche Ausschreibungen, Vergaberecht, Vergabekammer und Beschaffung des Landes', 22),

    -- Kultus und Schule
    ('Bildung', '{education}', 'School', '#d97706',
     'Sammelthema für Schulen, Unterricht und Bildungswege von der Grundschule bis zum Schulabschluss', 23),
    ('Lehrkräfte', '{education}', 'Users', '#d97706',
     'Einstellung, Ausbildung, Fortbildung, Arbeitsbelastung und Unterrichtsversorgung', 24),
    ('Ganztag', '{education}', 'Clock', '#d97706',
     'Ganztagsschulen, Betreuungsangebote, Kooperationen mit Vereinen und freien Trägern', 25),
    ('Ausbildung', '{education}', 'Wrench', '#d97706',
     'Duale Ausbildung, Berufsschulen, Ausbildungsmarkt und Übergänge von der Schule in den Beruf', 26),
    ('Schulbau', '{education}', 'Building', '#d97706',
     'Schulgebäude, Sanierungsstau, Förderprogramme und Ausstattung mit digitaler Technik', 27),

    -- Wissenschaft, Forschung und Kunst
    ('Wissenschaft', '{science}', 'GraduationCap', '#ea580c',
     'Sammelthema für Hochschulen, Forschung und den wissenschaftlichen Nachwuchs im Land', 28),
    ('Forschung', '{science}', 'Microscope', '#ea580c',
     'Spitzenforschung, Transfer, Forschungsförderung und Innovationen aus den Hochschulen', 29),
    ('Kultur', '{science}', 'Palette', '#ea580c',
     'Kulturförderung, Theater, Museen, Soziokultur und die freie Szene', 30),
    ('Denkmalpflege', '{science}', 'Castle', '#ea580c',
     'Denkmalschutz, Schlösser und Burgen, Archive und Bibliotheken', 31),
    ('Studium', '{science}', 'Euro', '#ea580c',
     'Studienfinanzierung, BAföG, Stipendien, Zulassung und Studienbedingungen', 32),

    -- Wirtschaft und Tourismus
    ('Wirtschaft', '{economy}', 'TrendingUp', '#0891b2',
     'Sammelthema für Standortpolitik, Unternehmen und wirtschaftliche Entwicklung im Land', 33),
    ('Handwerk', '{economy}', 'Store', '#0891b2',
     'Handwerksbetriebe, Kammern, Betriebsnachfolge und Fachkräfte im Handwerk', 34),
    ('Industrie', '{economy}', 'Factory', '#0891b2',
     'Automobil- und Zulieferindustrie, Strukturwandel und Transformationsförderung', 35),
    ('Tourismus', '{economy,rural}', 'MapPin', '#0891b2',
     'Gastgewerbe, Destinationen, Tourismusmarketing und Förderung des Tourismus', 36),
    ('Fachkräfte', '{economy,education,social}', 'UserCheck', '#0891b2',
     'Gewinnung, Qualifizierung und Bindung von Arbeits- und Fachkräften', 37),
    ('Gründung', '{economy}', 'Rocket', '#0891b2',
     'Existenzgründungen, Start-ups, Gründungsförderung und Finanzierung', 38),
    ('Arbeitsmarkt', '{economy,social}', 'Briefcase', '#db2777',
     'Arbeitslosigkeit, Beschäftigungsförderung, Löhne und Arbeitsbedingungen', 39),

    -- Soziales und Gesundheit
    ('Gesundheit', '{social}', 'HeartPulse', '#db2777',
     'Gesundheitsversorgung, Prävention, Ärztemangel und öffentlicher Gesundheitsdienst', 40),
    ('Pflege', '{social}', 'Heart', '#db2777',
     'Pflegekräfte, Pflegeeinrichtungen, Pflegebedürftigkeit und Entlastung Angehöriger', 41),
    ('Krankenhäuser', '{social}', 'Building2', '#db2777',
     'Klinikstandorte, Krankenhausfinanzierung, Notfallversorgung und Qualität', 42),
    ('Soziales', '{social}', 'Heart', '#db2777',
     'Sammelthema für soziale Sicherung, Grundsicherung und Armutsbekämpfung', 43),
    ('Inklusion', '{social}', 'Accessibility', '#db2777',
     'Menschen mit Behinderung, Barrierefreiheit und Teilhabe am Arbeitsleben', 44),
    ('Jugendhilfe', '{social}', 'Baby', '#db2777',
     'Jugendämter, Hilfen zur Erziehung, Kinderschutz und Frühe Hilfen', 45),

    -- Verkehr
    ('Verkehr', '{transport}', 'Car', '#0284c7',
     'Sammelthema für Straßen, Schiene, Nahverkehr und Verkehrspolitik im Land', 46),
    ('Straßen', '{transport}', 'Route', '#0284c7',
     'Landesstraßen, Brücken, Sanierung und Baustellen', 47),
    ('Nahverkehr', '{transport}', 'Bus', '#0284c7',
     'Busse und Bahnen vor Ort, Nahverkehrspläne, Ticketangebote und Verkehrsverbünde', 48),
    ('Schiene', '{transport}', 'Train', '#0284c7',
     'Bahnstrecken, Bahnhöfe, Takte, Elektrifizierung und Güterverkehr', 49),
    ('Radverkehr', '{transport}', 'Bike', '#0284c7',
     'Radwege, Fußgängerführung, Verkehrswende und sichere Schulwege', 50),
    ('Verkehrssicherheit', '{transport}', 'AlertTriangle', '#0284c7',
     'Unfälle, Tempolimits, Gefahrenstellen und Sicherheit im Straßenverkehr', 51),
    ('Lärmschutz', '{transport,environment}', 'Volume2', '#0284c7',
     'Straßen- und Schienenlärm, Lärmschutzwände, Luftqualität und Emissionen', 52),

    -- Umwelt, Klima und Energiewirtschaft
    ('Umwelt', '{environment}', 'TreePine', '#16a34a',
     'Sammelthema für Natur-, Gewässer- und Bodenschutz sowie Umweltpolitik im Land', 53),
    ('Klima', '{transport,environment,rural,housing}', 'Leaf', '#16a34a',
     'Klimaziele, CO2-Bilanz, Anpassung an die Folgen des Klimawandels und Klimaschutzgesetz', 54),
    ('Energiewende', '{environment}', 'Wind', '#16a34a',
     'Wind, Solar, Biomasse, Netzausbau und Genehmigungsverfahren', 55),
    ('Versorgung', '{environment}', 'Zap', '#16a34a',
     'Strommarkt, Netze, Speicher, Kraftwerke und Versorgungssicherheit', 56),
    ('Naturschutz', '{environment}', 'Bird', '#16a34a',
     'Biotope, Artenvielfalt, Schutzgebiete und Biodiversitätsstrategie', 57),
    ('Wasser', '{environment,rural}', 'Droplets', '#16a34a',
     'Grundwasser, Flüsse, Seen, Hochwasserschutz und Wasserentnahme', 58),
    ('Recycling', '{environment}', 'Recycle', '#16a34a',
     'Abfallwirtschaft, Kreislaufwirtschaft, Rohstoffe und Verpackungsvermeidung', 59),
    ('Flächenverbrauch', '{environment,rural,housing}', 'Ruler', '#b45309',
     'Flächensparen, Innenentwicklung vor Außenbereich und Ausgleichsflächen', 60),

    -- Ländlicher Raum und Landwirtschaft
    ('Landwirtschaft', '{rural}', 'Tractor', '#65a30d',
     'Betriebe, Agrarförderung, Erträge, Düngung und Pflanzenschutz', 61),
    ('Tierhaltung', '{rural}', 'PawPrint', '#65a30d',
     'Ställe, Tierwohl, Nutztierhaltung und Tierschutz', 62),
    ('Wald', '{rural}', 'Trees', '#65a30d',
     'Waldzustand, Holznutzung, Waldumbau und Jagd', 63),
    ('Dorfentwicklung', '{rural}', 'Map', '#65a30d',
     'Dorfentwicklung, Grundversorgung, Mobilität im ländlichen Raum und gleichwertige Lebensverhältnisse', 64),
    ('Verbraucherschutz', '{rural}', 'ShieldCheck', '#65a30d',
     'Lebensmittelsicherheit, Produktsicherheit und Verbraucherinformation', 65),

    -- Landesentwicklung und Wohnen
    ('Wohnungsbau', '{housing}', 'Home', '#b45309',
     'Neubau, Förderprogramme, Baukosten und Baulandbereitstellung', 66),
    ('Mieten', '{housing}', 'KeyRound', '#b45309',
     'Mietpreise, Sozialwohnungen, Wohnraumversorgung und Mietrecht', 67),
    ('Raumordnung', '{housing}', 'Map', '#b45309',
     'Landesplanung, Regionalpläne, Ziele der Raumordnung und Vorranggebiete', 68),
    ('Städtebau', '{housing}', 'Building', '#b45309',
     'Innenstädte, Quartiere, Sanierungsgebiete und Ortsentwicklung', 69)
  ) AS v(label, lines, icon, color, description, sort)
$$;

REVOKE ALL ON FUNCTION public._ministry_topic_cloud() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Wolke für ein Büro anlegen – idempotent und ohne Verlust eigener Pflege
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_ministry_topic_cloud(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_tenant IS NULL OR NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant) THEN
    RAISE EXCEPTION 'Unbekanntes Büro' USING ERRCODE = '22023';
  END IF;

  -- 2a) Fehlende Themen anlegen; vorhandene Labels werden wiederverwendet.
  INSERT INTO public.topics (tenant_id, name, label, icon, color, description, order_index, is_active)
  SELECT
    p_tenant,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.topics clash
        WHERE clash.tenant_id = p_tenant
          AND clash.name = public.topic_name_from_label(c.label)
      ) THEN public.topic_name_from_label(c.label) || '-' || substr(md5(lower(c.label)), 1, 8)
      ELSE public.topic_name_from_label(c.label)
    END,
    c.label,
    c.icon,
    c.color,
    c.description,
    (base.max_order + row_number() OVER (ORDER BY c.sort))::integer,
    true
  FROM public._ministry_topic_cloud() c
  CROSS JOIN LATERAL (
    SELECT coalesce(max(x.order_index), -1) AS max_order
    FROM public.topics x
    WHERE x.tenant_id = p_tenant
  ) base
  WHERE NOT EXISTS (
    SELECT 1 FROM public.topics existing
    WHERE existing.tenant_id = p_tenant AND lower(existing.label) = lower(c.label)
  )
  ON CONFLICT DO NOTHING;

  -- 2b) Leere Beschreibungen auffüllen, Icon und Farbe vereinheitlichen.
  UPDATE public.topics target
  SET description = CASE
        WHEN target.description IS NULL OR btrim(target.description) = '' THEN c.description
        ELSE target.description
      END,
      icon = c.icon,
      color = c.color
  FROM public._ministry_topic_cloud() c
  WHERE target.tenant_id = p_tenant
    AND lower(target.label) = lower(c.label);

  -- 2c) Mit den Ressortlinien verknüpfen. Zusammengeführte Themen werden auf
  --     ihr Ziel umgebogen, inaktive Ziele übersprungen (keine toten Chips),
  --     unbekannte Linien ausgelassen (der Trigger darf die Büro-Anlage nie
  --     scheitern lassen). Der Selbsttest prüft die vollständige Abdeckung.
  INSERT INTO public.parlis_ministry_topics (tenant_id, line_id, topic_id)
  SELECT DISTINCT p_tenant, line.id, resolved.topic_id
  FROM public._ministry_topic_cloud() c
  CROSS JOIN LATERAL unnest(c.lines) AS l(line_id)
  JOIN public.parlis_ministry_lines line ON line.id = l.line_id
  CROSS JOIN LATERAL (
    SELECT coalesce(merged.id, top.id) AS topic_id,
           coalesce(merged.is_active, top.is_active) AS is_active
    FROM public.topics top
    LEFT JOIN public.topics merged
      ON merged.id = top.merged_into AND merged.tenant_id = top.tenant_id
    WHERE top.tenant_id = p_tenant AND lower(top.label) = lower(c.label)
    ORDER BY (top.merged_into IS NOT NULL), top.order_index, top.id
    LIMIT 1
  ) resolved
  WHERE resolved.is_active
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_ministry_topic_cloud(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Bestehende Büros nachziehen
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT t.id FROM public.tenants t ORDER BY t.created_at LOOP
    PERFORM public.seed_ministry_topic_cloud(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Neue Büros erhalten die Wolke automatisch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_ministry_topic_cloud_on_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.seed_ministry_topic_cloud(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_ministry_topic_cloud_on_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_ministry_topic_cloud ON public.tenants;
CREATE TRIGGER seed_ministry_topic_cloud
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_ministry_topic_cloud_on_tenant();

-- ---------------------------------------------------------------------------
-- 5) Selbsttest: ein neues Büro bekommt die Wolke vollständig und idempotent.
--    Läuft in einer Teilschachtelung und rollt am Ende alles zurück, damit
--    weder Testbüro noch Themen zurückbleiben – auch nicht bei einem Fehlschlag.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ministry_topic_cloud_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new uuid := gen_random_uuid();
  v_topics integer;
  v_links integer;
  v_lines integer;
  v_min integer;
  v_max integer;
  checks jsonb := '{}';
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_tenant_member(p_tenant, auth.uid()) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.tenants(id, name)
    VALUES (v_new, '[SELFTEST] Neues Büro ' || substr(v_new::text, 1, 8));

    SELECT count(*) INTO v_topics FROM public.topics WHERE tenant_id = v_new;
    SELECT count(*) INTO v_links FROM public.parlis_ministry_topics WHERE tenant_id = v_new;
    SELECT count(DISTINCT line_id), min(n), max(n) INTO v_lines, v_min, v_max
    FROM (
      SELECT line_id, count(*)::integer AS n
      FROM public.parlis_ministry_topics
      WHERE tenant_id = v_new
      GROUP BY line_id
    ) per_line;

    checks := jsonb_build_object(
      'tenant_created', true,
      'topics_seeded', v_topics = 69,
      'links_seeded', v_links = 85,
      'all_lines', v_lines = 12,
      'line_span', coalesce(v_min, 0) >= 5 AND coalesce(v_max, 0) <= 10,
      'single_word_labels', NOT EXISTS (
        SELECT 1 FROM public.topics WHERE tenant_id = v_new AND label ~ '\s'
      ),
      'descriptions', NOT EXISTS (
        SELECT 1 FROM public.topics
        WHERE tenant_id = v_new AND (description IS NULL OR btrim(description) = '')
      )
    );

    -- Zweiter Lauf darf nichts verdoppeln.
    PERFORM public.seed_ministry_topic_cloud(v_new);
    checks := checks || jsonb_build_object(
      'idempotent',
      (SELECT count(*) FROM public.topics WHERE tenant_id = v_new) = v_topics
        AND (SELECT count(*) FROM public.parlis_ministry_topics WHERE tenant_id = v_new) = v_links
    );

    -- Eigene Pflege bleibt erhalten, nur leere Beschreibungen werden gefüllt.
    UPDATE public.topics
    SET description = 'Eigener Text'
    WHERE tenant_id = v_new AND label = 'Bildung';
    PERFORM public.seed_ministry_topic_cloud(v_new);
    checks := checks || jsonb_build_object(
      'keeps_own_description',
      (SELECT description FROM public.topics WHERE tenant_id = v_new AND label = 'Bildung') = 'Eigener Text'
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX022';
  EXCEPTION
    WHEN SQLSTATE 'ZX022' THEN NULL;
    WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', NOT EXISTS (SELECT 1 FROM jsonb_each(checks) e WHERE e.value <> 'true'::jsonb),
    'checks', checks
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ministry_topic_cloud_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ministry_topic_cloud_selftest(uuid) TO authenticated;

COMMIT;
