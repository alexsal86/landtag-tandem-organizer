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
-- Reine Datenmigration: keine Funktion, kein RPC, keine neue Tabelle.
-- Neue Büros erhalten die Wolke, indem dieser Block mit ihrer tenant_id
-- ausgeführt wird (die Einfügungen sind idempotent).
--
-- Klassifikationen (Kategorien, Status, Orte) bleiben unverändert.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Die Wolke: ein Thema pro Zeile, Ressortlinien als Array.
--    Die Reihenfolge der Zeilen bestimmt die Sortierung im Themenkatalog.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _topic_cloud (
  label text PRIMARY KEY,
  lines text[] NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  description text NOT NULL,
  sort serial,
  CONSTRAINT _topic_cloud_hashtag CHECK (
    label = btrim(label) AND label !~ '\s' AND char_length(label) BETWEEN 2 AND 20
  )
) ON COMMIT DROP;

INSERT INTO _topic_cloud (label, lines, icon, color, description) VALUES
  -- Staatsministerium
  ('Bürokratie', '{state}', 'Settings', '#475569',
   'Anträge, Verfahren und Fristen vereinfachen; Abbau von Berichts-, Nachweis- und Genehmigungspflichten'),
  ('Verwaltung', '{state}', 'Workflow', '#475569',
   'Leistungsfähige Verwaltung, Personalgewinnung, Bürgerbüros und schnellere Bearbeitungszeiten'),
  ('Medien', '{state}', 'Radio', '#475569',
   'Presse- und Rundfunkangebote, Medienförderung, Lokaljournalismus und Medienkompetenz'),
  ('Europa', '{state}', 'Globe', '#475569',
   'EU-Gesetzgebung, Ausschuss der Regionen, Landesinteressen in Brüssel und EU-Fördermittel'),
  ('Ehrenamt', '{state,rural}', 'HeartHandshake', '#475569',
   'Vereine, Feuerwehren, Freiwilligendienste, Anerkennung und Entlastung von Engagierten'),
  ('Digitalisierung', '{state,interior}', 'MonitorSmartphone', '#2563eb',
   'Sammelthema für E-Government, Onlinezugangsgesetz, IT-Infrastruktur, Registermodernisierung und Breitband'),

  -- Inneres und Digitalisierung
  ('Sicherheit', '{interior}', 'Shield', '#2563eb',
   'Sammelthema für Innere Sicherheit: Kriminalitätsbekämpfung, Gefahrenabwehr und Schutz der Bevölkerung'),
  ('Polizei', '{interior}', 'Siren', '#2563eb',
   'Personal, Ausstattung, Ausbildung, Organisation und Präsidien der Polizei des Landes'),
  ('Extremismus', '{interior}', 'AlertTriangle', '#2563eb',
   'Rechtsextremismus, Linksextremismus, Islamismus, Prävention und Demokratieförderung'),
  ('Katastrophenschutz', '{interior,environment}', 'Network', '#2563eb',
   'Feuerwehren, Rettungsdienst, Warnsysteme und Bewältigung von Großschadenslagen'),
  ('Cybersicherheit', '{interior}', 'Lock', '#2563eb',
   'IT-Sicherheit von Land und Kommunen, Angriffe auf Verwaltungsnetze und Sicherheitsforschung'),
  ('Kommunen', '{interior}', 'Landmark', '#2563eb',
   'Kommunalaufsicht, Städte und Gemeinden, Landkreise und interkommunale Zusammenarbeit'),
  ('Datenschutz', '{interior,justice}', 'ShieldCheck', '#7c3aed',
   'Datenschutzaufsicht, Informationsfreiheit, Akteneinsicht und Umgang mit personenbezogenen Daten'),
  ('Finanzausgleich', '{interior,finance}', 'Landmark', '#059669',
   'Verteilung der Landesmittel an die Kommunen, Schlüsselzuweisungen und Bedarfszuweisungen'),

  -- Justiz und Migration
  ('Justiz', '{justice}', 'Scale', '#7c3aed',
   'Gerichte, Staatsanwaltschaften, Personal und Ausstattung der ordentlichen Gerichtsbarkeit'),
  ('Strafvollzug', '{justice}', 'Building2', '#7c3aed',
   'Justizvollzugsanstalten, Unterbringung, Resozialisierung und Opferschutz'),
  ('Migration', '{justice}', 'Users', '#7c3aed',
   'Aufenthalt, Asylverfahren, Aufnahme, Integration und Sprachförderung'),
  ('Rechtsstaat', '{justice}', 'BookOpen', '#7c3aed',
   'Verfassung, Grundrechte, Verfahrensrechte und Unabhängigkeit der Gerichte'),

  -- Finanzen
  ('Haushalt', '{finance}', 'Wallet', '#059669',
   'Landeshaushalt, Nachtragshaushalt, Einzelpläne und Haushaltsberatungen'),
  ('Steuern', '{finance}', 'Coins', '#059669',
   'Landessteuern, Steuerpolitik, Grunderwerbsteuer und Vollzug der Steuergesetze'),
  ('Beteiligungen', '{finance}', 'PieChart', '#059669',
   'Landesbeteiligungen, Aufsichtsräte, Beteiligungsbericht und Landesvermögen'),
  ('Vergabe', '{finance}', 'FileCheck', '#059669',
   'Öffentliche Ausschreibungen, Vergaberecht, Vergabekammer und Beschaffung des Landes'),

  -- Kultus und Schule
  ('Bildung', '{education}', 'School', '#d97706',
   'Sammelthema für Schulen, Unterricht und Bildungswege von der Grundschule bis zum Schulabschluss'),
  ('Lehrkräfte', '{education}', 'Users', '#d97706',
   'Einstellung, Ausbildung, Fortbildung, Arbeitsbelastung und Unterrichtsversorgung'),
  ('Ganztag', '{education}', 'Clock', '#d97706',
   'Ganztagsschulen, Betreuungsangebote, Kooperationen mit Vereinen und freien Trägern'),
  ('Ausbildung', '{education}', 'Wrench', '#d97706',
   'Duale Ausbildung, Berufsschulen, Ausbildungsmarkt und Übergänge von der Schule in den Beruf'),
  ('Schulbau', '{education}', 'Building', '#d97706',
   'Schulgebäude, Sanierungsstau, Förderprogramme und Ausstattung mit digitaler Technik'),

  -- Wissenschaft, Forschung und Kunst
  ('Wissenschaft', '{science}', 'GraduationCap', '#ea580c',
   'Sammelthema für Hochschulen, Forschung und den wissenschaftlichen Nachwuchs im Land'),
  ('Forschung', '{science}', 'Microscope', '#ea580c',
   'Spitzenforschung, Transfer, Forschungsförderung und Innovationen aus den Hochschulen'),
  ('Kultur', '{science}', 'Palette', '#ea580c',
   'Kulturförderung, Theater, Museen, Soziokultur und die freie Szene'),
  ('Denkmalpflege', '{science}', 'Castle', '#ea580c',
   'Denkmalschutz, Schlösser und Burgen, Archive und Bibliotheken'),
  ('Studium', '{science}', 'Euro', '#ea580c',
   'Studienfinanzierung, BAföG, Stipendien, Zulassung und Studienbedingungen'),

  -- Wirtschaft und Tourismus
  ('Wirtschaft', '{economy}', 'TrendingUp', '#0891b2',
   'Sammelthema für Standortpolitik, Unternehmen und wirtschaftliche Entwicklung im Land'),
  ('Handwerk', '{economy}', 'Store', '#0891b2',
   'Handwerksbetriebe, Kammern, Betriebsnachfolge und Fachkräfte im Handwerk'),
  ('Industrie', '{economy}', 'Factory', '#0891b2',
   'Automobil- und Zulieferindustrie, Strukturwandel und Transformationsförderung'),
  ('Tourismus', '{economy,rural}', 'MapPin', '#0891b2',
   'Gastgewerbe, Destinationen, Tourismusmarketing und Förderung des Tourismus'),
  ('Fachkräfte', '{economy,education,social}', 'UserCheck', '#0891b2',
   'Gewinnung, Qualifizierung und Bindung von Arbeits- und Fachkräften'),
  ('Gründung', '{economy}', 'Rocket', '#0891b2',
   'Existenzgründungen, Start-ups, Gründungsförderung und Finanzierung'),
  ('Arbeitsmarkt', '{economy,social}', 'Briefcase', '#db2777',
   'Arbeitslosigkeit, Beschäftigungsförderung, Löhne und Arbeitsbedingungen'),

  -- Soziales und Gesundheit
  ('Gesundheit', '{social}', 'HeartPulse', '#db2777',
   'Gesundheitsversorgung, Prävention, Ärztemangel und öffentlicher Gesundheitsdienst'),
  ('Pflege', '{social}', 'Heart', '#db2777',
   'Pflegekräfte, Pflegeeinrichtungen, Pflegebedürftigkeit und Entlastung Angehöriger'),
  ('Krankenhäuser', '{social}', 'Building2', '#db2777',
   'Klinikstandorte, Krankenhausfinanzierung, Notfallversorgung und Qualität'),
  ('Soziales', '{social}', 'Heart', '#db2777',
   'Sammelthema für soziale Sicherung, Grundsicherung und Armutsbekämpfung'),
  ('Inklusion', '{social}', 'Accessibility', '#db2777',
   'Menschen mit Behinderung, Barrierefreiheit und Teilhabe am Arbeitsleben'),
  ('Jugendhilfe', '{social}', 'Baby', '#db2777',
   'Jugendämter, Hilfen zur Erziehung, Kinderschutz und Frühe Hilfen'),

  -- Verkehr
  ('Verkehr', '{transport}', 'Car', '#0284c7',
   'Sammelthema für Straßen, Schiene, Nahverkehr und Verkehrspolitik im Land'),
  ('Straßen', '{transport}', 'Route', '#0284c7',
   'Landesstraßen, Brücken, Sanierung und Baustellen'),
  ('Nahverkehr', '{transport}', 'Bus', '#0284c7',
   'Busse und Bahnen vor Ort, Nahverkehrspläne, Ticketangebote und Verkehrsverbünde'),
  ('Schiene', '{transport}', 'Train', '#0284c7',
   'Bahnstrecken, Bahnhöfe, Takte, Elektrifizierung und Güterverkehr'),
  ('Radverkehr', '{transport}', 'Bike', '#0284c7',
   'Radwege, Fußgängerführung, Verkehrswende und sichere Schulwege'),
  ('Verkehrssicherheit', '{transport}', 'AlertTriangle', '#0284c7',
   'Unfälle, Tempolimits, Gefahrenstellen und Sicherheit im Straßenverkehr'),
  ('Lärmschutz', '{transport,environment}', 'Volume2', '#0284c7',
   'Straßen- und Schienenlärm, Lärmschutzwände, Luftqualität und Emissionen'),

  -- Umwelt, Klima und Energiewirtschaft
  ('Umwelt', '{environment}', 'TreePine', '#16a34a',
   'Sammelthema für Natur-, Gewässer- und Bodenschutz sowie Umweltpolitik im Land'),
  ('Klima', '{transport,environment,rural,housing}', 'Leaf', '#16a34a',
   'Klimaziele, CO2-Bilanz, Anpassung an die Folgen des Klimawandels und Klimaschutzgesetz'),
  ('Energiewende', '{environment}', 'Wind', '#16a34a',
   'Wind, Solar, Biomasse, Netzausbau und Genehmigungsverfahren'),
  ('Versorgung', '{environment}', 'Zap', '#16a34a',
   'Strommarkt, Netze, Speicher, Kraftwerke und Versorgungssicherheit'),
  ('Naturschutz', '{environment}', 'Bird', '#16a34a',
   'Biotope, Artenvielfalt, Schutzgebiete und Biodiversitätsstrategie'),
  ('Wasser', '{environment,rural}', 'Droplets', '#16a34a',
   'Grundwasser, Flüsse, Seen, Hochwasserschutz und Wasserentnahme'),
  ('Recycling', '{environment}', 'Recycle', '#16a34a',
   'Abfallwirtschaft, Kreislaufwirtschaft, Rohstoffe und Verpackungsvermeidung'),
  ('Flächenverbrauch', '{environment,rural,housing}', 'Ruler', '#b45309',
   'Flächensparen, Innenentwicklung vor Außenbereich und Ausgleichsflächen'),

  -- Ländlicher Raum und Landwirtschaft
  ('Landwirtschaft', '{rural}', 'Tractor', '#65a30d',
   'Betriebe, Agrarförderung, Erträge, Düngung und Pflanzenschutz'),
  ('Tierhaltung', '{rural}', 'PawPrint', '#65a30d',
   'Ställe, Tierwohl, Nutztierhaltung und Tierschutz'),
  ('Wald', '{rural}', 'Trees', '#65a30d',
   'Waldzustand, Holznutzung, Waldumbau und Jagd'),
  ('Dorfentwicklung', '{rural}', 'Map', '#65a30d',
   'Dorfentwicklung, Grundversorgung, Mobilität im ländlichen Raum und gleichwertige Lebensverhältnisse'),
  ('Verbraucherschutz', '{rural}', 'ShieldCheck', '#65a30d',
   'Lebensmittelsicherheit, Produktsicherheit und Verbraucherinformation'),

  -- Landesentwicklung und Wohnen
  ('Wohnungsbau', '{housing}', 'Home', '#b45309',
   'Neubau, Förderprogramme, Baukosten und Baulandbereitstellung'),
  ('Mieten', '{housing}', 'KeyRound', '#b45309',
   'Mietpreise, Sozialwohnungen, Wohnraumversorgung und Mietrecht'),
  ('Raumordnung', '{housing}', 'Map', '#b45309',
   'Landesplanung, Regionalpläne, Ziele der Raumordnung und Vorranggebiete'),
  ('Städtebau', '{housing}', 'Building', '#b45309',
   'Innenstädte, Quartiere, Sanierungsgebiete und Ortsentwicklung');

-- Tippfehler in den Ressortlinien sollen die Migration nicht still verpuffen lassen.
DO $$
DECLARE v_unknown text;
BEGIN
  SELECT string_agg(DISTINCT l.line_id, ', ' ORDER BY l.line_id) INTO v_unknown
  FROM _topic_cloud c
  CROSS JOIN LATERAL unnest(c.lines) AS l(line_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.parlis_ministry_lines line WHERE line.id = l.line_id
  );

  IF v_unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Themen-Wolke: unbekannte Ressortlinien (%)', v_unknown;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Themen je Büro anlegen, vorhandene Labels wiederverwenden
-- ---------------------------------------------------------------------------
INSERT INTO public.topics (tenant_id, name, label, icon, color, description, order_index, is_active)
SELECT
  t.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.topics clash
      WHERE clash.tenant_id = t.id
        AND clash.name = public.topic_name_from_label(c.label)
    ) THEN public.topic_name_from_label(c.label) || '-' || substr(md5(lower(c.label)), 1, 8)
    ELSE public.topic_name_from_label(c.label)
  END,
  c.label,
  c.icon,
  c.color,
  c.description,
  (base.max_order + row_number() OVER (PARTITION BY t.id ORDER BY c.sort))::integer,
  true
FROM public.tenants t
CROSS JOIN _topic_cloud c
CROSS JOIN LATERAL (
  SELECT coalesce(max(x.order_index), -1) AS max_order
  FROM public.topics x
  WHERE x.tenant_id = t.id
) base
WHERE NOT EXISTS (
  SELECT 1 FROM public.topics existing
  WHERE existing.tenant_id = t.id AND lower(existing.label) = lower(c.label)
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Vorhandene Themen der Wolke auffüllen
--    Leere Beschreibungen erhalten die ausführliche Fassung aus dieser
--    Migration, eigene Beschreibungen bleiben stehen. Icon und Farbe werden
--    auf die Ressortfarbe vereinheitlicht, damit die Wolke einheitlich wirkt.
--    Themen außerhalb der Wolke bleiben unberührt.
-- ---------------------------------------------------------------------------
UPDATE public.topics top
SET description = CASE
      WHEN top.description IS NULL OR btrim(top.description) = '' THEN c.description
      ELSE top.description
    END,
    icon = c.icon,
    color = c.color
FROM _topic_cloud c
WHERE lower(top.label) = lower(c.label);

-- ---------------------------------------------------------------------------
-- 4) Mit den Ressortlinien verknüpfen
--    Zusammengeführte Themen werden auf ihr Ziel umgebogen; inaktive Ziele
--    werden übersprungen, damit die Administration keine toten Chips zeigt.
-- ---------------------------------------------------------------------------
INSERT INTO public.parlis_ministry_topics (tenant_id, line_id, topic_id)
SELECT DISTINCT t.id, l.line_id, resolved.topic_id
FROM public.tenants t
CROSS JOIN _topic_cloud c
CROSS JOIN LATERAL unnest(c.lines) AS l(line_id)
CROSS JOIN LATERAL (
  SELECT coalesce(merged.id, top.id) AS topic_id,
         coalesce(merged.is_active, top.is_active) AS is_active
  FROM public.topics top
  LEFT JOIN public.topics merged
    ON merged.id = top.merged_into AND merged.tenant_id = top.tenant_id
  WHERE top.tenant_id = t.id AND lower(top.label) = lower(c.label)
  ORDER BY (top.merged_into IS NOT NULL), top.order_index, top.id
  LIMIT 1
) resolved
WHERE resolved.is_active
ON CONFLICT DO NOTHING;

COMMIT;
