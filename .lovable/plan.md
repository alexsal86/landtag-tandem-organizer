

## Dossiers für Abgeordnetenbüros: nächste Ausbaustufe

### Kurze Antwort zur xWiki-Frage

**xWiki ist das falsche Vorbild.** Es ist ein generisches Enterprise-Wiki (Page-Tree, Wiki-Syntax, Makros, Berechtigungen). Was es gut macht, hast du im Kern schon: Lexical-Block-Editor (≈ strukturierte Seiten), Verknüpfungen, Tags, Volltext (`GlobalEntrySearch`), Tenant-/Rollen-RLS.

Was Abgeordnetenbüros wirklich brauchen, **kann xWiki nicht**: Bezug zu Wahlkreis, Stakeholdern, parlamentarischen Vorgängen, Pressestand, Positionierung gegenüber Fraktion, Briefing-zu-Termin-Anbindung. Genau hier setzen wir an – nicht bei „mehr Wiki", sondern bei **politischer Arbeitslogik**.

Übernehmenswert aus xWiki ist genau **eine** Idee: **hierarchische Eltern-Kind-Dossiers** (Mobilität → Mobilität/ÖPNV → Mobilität/ÖPNV/Streckenausbau X). Das fehlt heute.

---

### Lücken im heutigen Dossier-System

Heute vorhanden: Übersicht, Notizen (Lexical), Einträge (Inbox-Typen), Verknüpfungen, Briefing, Quality-Fields (offene Fragen, Positionen, Risiken), Quellen-Watcher, Review-Reminder, globale Suche.

Was für MdB-Arbeit fehlt:

1. **Hierarchie/Struktur** – Themen sind verschachtelt (Klima > Energie > Wasserstoff). Heute flach.
2. **Stakeholder-Mapping** – Wer ist „pro/contra/neutral", welche Forderungen, letzte Berührung? Heute nur lose Kontakt-Links.
3. **Positionsentwicklung über Zeit** – `positions` ist ein Freitextfeld. Es fehlt die Versionierung („Wie hieß unsere Linie im März?").
4. **Parlamentarischer Kontext** – Drucksachen, Anfragen, Reden, Abstimmungen, Ausschuss-Sitzungen zum Thema. Heute nicht abbildbar.
5. **Sprechzettel/Q&A** – Briefing erzeugt heute nur Lagebild; Mitarbeitende brauchen schnell „3 Kernbotschaften + 5 kritische Fragen mit Antwort".
6. **Wahlkreis-Bezug** – „Was bedeutet das Thema *konkret* für meinen Wahlkreis?" (betroffene Orte, Zahlen, lokale Akteure).
7. **Anliegen/Fallakten-Aggregation** – Wenn 12 Bürger:innen zum gleichen Thema schreiben, sollte das Dossier das spiegeln (heute nur 1:1-Verknüpfung).
8. **Wiedervorlage je Eintrag** – Heute nur Review-Intervall fürs ganze Dossier.

---

### Vorschlag – 6 Bausteine, MVP-tauglich, baut auf bestehendem auf

**1) Eltern-Kind-Hierarchie (xWiki-Idee, schlank umgesetzt)**
- Spalte `dossiers.parent_id uuid null` + Breadcrumb in `DossierDetailView`-Header.
- Sidepanel zeigt Dossier-Liste als Tree (collapsible), max. 3 Ebenen sinnvoll.
- Beim Anlegen: optional „Unter-Dossier von …".

**2) Stakeholder-Mapping (eigener Tab)**
- Neue Tabelle `dossier_stakeholders`: `dossier_id`, `contact_id`, `stance` ('pro'|'contra'|'neutral'|'unklar'), `influence` (1–5), `last_touch_at`, `note`.
- Neuer Tab **„Akteure"** im Detail: Matrix (Einfluss × Position) als kleines Quadranten-Diagramm + Liste mit Stance-Badge.
- Jeder Akteur verlinkt auf `Contact` → letzte Interaktion aus Kontakthistorie wird inline gezeigt.

**3) Positions-Verlauf (Versionierung)**
- Neue Tabelle `dossier_position_versions`: `dossier_id`, `content_html`, `valid_from`, `created_by`, `change_reason`.
- Im Quality-Fields-Block: „Position aktualisieren" → speichert alte Fassung, behält Audit-Spur. Anzeige als kompakter Verlauf („Stand 12.03., geändert wegen Fraktionsbeschluss X").

**4) Parlamentarischer Kontext (eigener Eintragstyp)**
- `EntryType` um 4 Werte erweitern: `drucksache`, `anfrage`, `rede`, `abstimmung`.
- `EntryCard` zeigt typ-spezifisches Icon + strukturierte Felder aus `metadata` (z. B. Drucksachen-Nr., Datum, Ausschuss, Abstimmungsergebnis ja/nein/enth.).
- Im Briefing-Tab eigene Sektion „Parlamentarischer Stand" zieht diese Einträge automatisch chronologisch.

**5) Sprechzettel-Generator (Erweiterung Briefing-Tab)**
- Im bestehenden `DossierBriefingTab`: zusätzlicher Modus **„Sprechzettel"** neben Lagebild.
- Strukturierte Felder: 3 Kernbotschaften, 5 kritische Fragen + Antworten, „Was nicht sagen", Quellenfußnoten.
- Speicherung in `dossier_talking_points` (`dossier_id`, `for_appointment_id` optional, `content_jsonb`, `valid_until`). Termin-Sidebar bekommt Button „Sprechzettel aus Dossier ziehen".

**6) Wahlkreis- und Anliegen-Aggregation**
- `dossiers.constituency_relevance` (text, Markdown) + `dossiers.affected_locations` (text[]).
- Auf Übersichts-Tab eine Kachel **„Anliegen aus dem Wahlkreis"**: zählt Fallakten/Vorgänge mit gleichem `topic_id` oder via neuer Tag-Heuristik, zeigt Trend (letzte 30 Tage) und Top-3-Anfragen mit Deep-Link.

**Plus: Wiedervorlage pro Eintrag**
- `dossier_entries.followup_at timestamptz null`. „Mein Radar"-View bekommt Sektion „Fällige Eintragsfollowups". Minimaler Aufwand, hoher Nutzen.

---

### Was wir bewusst NICHT bauen (um Fokus zu halten)

- Echte Wiki-Hierarchie mit Wiki-Syntax/Makros (overkill, Lexical reicht).
- KI-Auto-Zusammenfassung – existiert als Out-of-Scope im Umsetzungsplan, kommt später.
- Externe Drucksachen-API-Anbindung (Bundestag-OpenData) – erst wenn manuelle Erfassung im Alltag ankommt.
- Komplexe Berechtigungsmatrix pro Dossier – Tenant-RLS reicht.

---

### Migration (ein Schritt)

```sql
ALTER TABLE dossiers
  ADD COLUMN parent_id uuid REFERENCES dossiers(id) ON DELETE SET NULL,
  ADD COLUMN constituency_relevance text,
  ADD COLUMN affected_locations text[] DEFAULT '{}';

ALTER TABLE dossier_entries
  ADD COLUMN followup_at timestamptz;

CREATE TABLE dossier_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  stance text NOT NULL DEFAULT 'unklar',
  influence smallint NOT NULL DEFAULT 3,
  last_touch_at timestamptz,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, contact_id)
);

CREATE TABLE dossier_position_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  content_html text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  change_reason text,
  created_by uuid NOT NULL
);

CREATE TABLE dossier_talking_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  for_appointment_id uuid,
  content jsonb NOT NULL,
  valid_until timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS analog zu `dossiers` (tenant-basiert).

---

### Files (geplante Änderungen)

- **Edit** `src/features/dossiers/types.ts` – neue Typen, EntryType erweitern.
- **Edit** `src/features/dossiers/components/DossiersSidePanel.tsx` – Tree-Darstellung mit `parent_id`.
- **Edit** `src/features/dossiers/components/DossierDetailView.tsx` – Tabs „Akteure", „Sprechzettel"; Breadcrumb.
- **Edit** `src/features/dossiers/components/DossierSummaryTab.tsx` – Kachel „Anliegen aus Wahlkreis".
- **Edit** `src/features/dossiers/components/DossierBriefingTab.tsx` – Sprechzettel-Modus.
- **Edit** `src/features/dossiers/components/DossierQualityFields.tsx` – „Position aktualisieren" mit Verlauf.
- **Edit** `src/features/dossiers/components/EntryCard.tsx` – Drucksache/Rede/Abstimmung-Rendering, Followup-Datum.
- **Edit** `src/features/dossiers/components/MeinRadarView.tsx` – Sektion „Eintragsfollowups".
- **Neu** `src/features/dossiers/components/DossierStakeholdersTab.tsx` (+ Quadranten-Visual).
- **Neu** `src/features/dossiers/components/DossierTalkingPoints.tsx`.
- **Neu** `src/features/dossiers/hooks/useDossierStakeholders.ts`, `usePositionVersions.ts`, `useTalkingPoints.ts`.
- **Edit** `src/components/calendar/AppointmentDetailsSidebar.tsx` – Button „Sprechzettel aus Dossier ziehen".

### Rollout in 2 Sprints

- **Sprint 1**: Migration + Hierarchie (1) + Stakeholder-Tab (2) + Followup-Felder.
- **Sprint 2**: Positions-Versionierung (3) + parlamentarische Eintragstypen (4) + Sprechzettel (5) + Wahlkreis-Aggregation (6).

