# Jour fixe, Dossiers & Themen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/organisation.json`). Nicht von Hand bearbeiten._

**Zweck:** Jour-fixe-Sitzungen mit Agenden und Protokollen führen, Dossiers und Positionen pflegen, Drucksachen, Themen und Fakten verwalten.

## Kennzahlen

- Funktionen: **19** in **5** Unterbereichen
- implementiert: **18**, teilweise: **1**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **12**
- ohne Dokumentationsverweis: **16**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `dossiers.manage` Dossier anlegen und führen | Dossiers | fachlich | implementiert | UI | kein Test |
| `dossiers.entries` Dossier-Einträge und Timeline | Dossiers | fachlich | implementiert | UI | kein Test |
| `dossiers.sources` Dossier-Quellenbeobachtung | Dossiers | integration | implementiert | systemseitig | kein Test |
| `dossiers.links-stakeholders` Dossier-Verknüpfungen und Stakeholder | Dossiers | fachlich | implementiert | UI | kein Test |
| `dossiers.search` Globale Dossier-Suche | Dossiers | fachlich | implementiert | UI | kein Test |
| `dossiers.capture-radar` Schnellerfassung und Mein Radar | Dossiers | fachlich | implementiert | UI | kein Test |
| `dossiers.talking-points` Talking Points und Positionsversionen | Dossiers | fachlich | implementiert | UI | kein Test |
| `drucksachen.view` Drucksachen anzeigen | Drucksachen | fachlich | teilweise | UI | kein Test |
| `facts.manage` Fakten und Argumente pflegen | Fakten | fachlich | implementiert | UI | kein Test |
| `meetings.agenda` Agenda führen | Jour fixe | fachlich | implementiert | UI | Selbsttest |
| `meetings.jour-fixe` Jour-fixe-Sitzung planen und durchführen | Jour fixe | fachlich | implementiert | rollenabhängig | Selbsttest |
| `meetings.zombie-points` Liegengebliebene Agenda-Punkte | Jour fixe | fachlich | implementiert | UI | kein Test |
| `meetings.archive` Sitzung archivieren | Jour fixe | fachlich | implementiert | rollenabhängig | Selbsttest |
| `meetings.decisions` Sitzungsentscheidungen dokumentieren | Jour fixe | fachlich | implementiert | UI | Selbsttest |
| `meetings.protocol` Sitzungsprotokoll | Jour fixe | fachlich | implementiert | rollenabhängig | Selbsttest |
| `meetings.templates` Sitzungsvorlagen | Jour fixe | administrativ | implementiert | rollenabhängig | kein Test |
| `topics.ministry-cloud` Standarddaten für neue Büros | Themen | automatisiert | implementiert | systemseitig | Selbsttest |
| `topics.convert-catalog` Thema in Katalog überführen | Themen | fachlich | implementiert | UI | kein Test |
| `topics.manage` Themen verwalten | Themen | fachlich | implementiert | UI | Selbsttest |

## Unterbereiche

- Jour fixe
- Dossiers
- Drucksachen
- Themen
- Fakten

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `admin`, `system`

## Datenbanktabellen

`archived_meeting_protocol_tasks`, `case_item_topics`, `case_items`, `committees`, `documents`, `dossier_entries`, `dossier_links`, `dossier_position_versions`, `dossier_source_watchers`, `dossier_stakeholders`, `dossier_talking_points`, `dossiers`, `employee_responsibilities`, `facts`, `knowledge_question_topics`, `meeting_agenda_documents`, `meeting_agenda_items`, `meeting_participants`, `meeting_protocol_details`, `meeting_templates`, `meetings`, `parlis_ministry_lines`, `parlis_ministry_topics`, `protocol_agenda_items`, `protocol_sessions`, `protocol_speeches`, `regions`, `tasks`, `tenants`, `topic_catalog_links`, `topic_module_settings`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `meeting-lifecycle` | Meeting-Lifecycle (vollständig + Field-Verifikation) | 9 | 0 | — |
| `topic-linking` | Themenverknüpfung und Modul-Steuerung | 5 | 11 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `meeting-lifecycle` | `create-meeting` | Meeting anlegen | db | — |
| `meeting-lifecycle` | `create-appointment` | Verknüpften Kalender-Termin erzeugen | db | — |
| `meeting-lifecycle` | `add-participant` | Teilnehmer (sich selbst) hinzufügen | db | — |
| `meeting-lifecycle` | `add-regular-agenda` | Reguläre Agenda-Punkte (3) anlegen | db | — |
| `meeting-lifecycle` | `add-system-agenda` | System-Agenda-Punkte (Geburtstage, Termine, Notes, Aufgaben, Vorgänge, Entscheidungen) | db | — |
| `meeting-lifecycle` | `add-sub-agenda` | Sub-Agenda-Punkt mit parent_id anlegen | db | — |
| `meeting-lifecycle` | `add-agenda-document` | Agenda-Dokument anhängen | db | — |
| `meeting-lifecycle` | `create-task-link` | Aufgabe erzeugen und mit Sub-Agenda verknüpfen | db | — |
| `meeting-lifecycle` | `complete-agenda-item` | Agenda-Punkt abschließen (notes + result) | db | — |
| `meeting-lifecycle` | `mark-carryover` | Carry-Over markieren | db | — |
| `meeting-lifecycle` | `create-followup-meeting` | Folge-Meeting (rekursiv) mit Carry-Over anlegen | db | — |
| `meeting-lifecycle` | `verify-links` | Verknüpfungen vollständig prüfen | db | — |
| `meeting-lifecycle` | `complete-task` | Aufgabe abschließen | db | — |
| `meeting-lifecycle` | `archive-meetings` | Meetings archivieren | db | — |
| `meeting-lifecycle` | `protocol-record` | Anwesenheit, Protokollführung und Nachtrag dokumentieren | workflow | — |
| `meeting-lifecycle` | `agenda-template-icon` | Symbole aus der Meeting-Vorlage übernehmen | workflow | — |
| `meeting-lifecycle` | `jour-fixe-reservations` | Vormerkungen ausschließlich im übernommenen Jour fixe kennzeichnen | workflow | — |
| `meeting-lifecycle` | `system-agenda-subpoints` | System-Unterpunkte nummerieren und Reihenfolge erhalten | logic | — |
| `meeting-lifecycle` | `live-agenda-position` | Position der laufenden Tagesordnung bestimmen | logic | — |
| `meeting-lifecycle` | `agenda-drop-level` | Agenda-Punkte per Ziehen hoch- und herunterstufen | logic | — |
| `meeting-lifecycle` | `protocol-task-status` | Aufgabenstatus und Rückblickquote berechnen | logic | — |
| `topic-linking` | `catalog` | Thema anlegen, bereinigen und wiederfinden | db | — |
| `topic-linking` | `module-settings` | Modul-Steuerung lesen und Wertebereiche prüfen | db | — |
| `topic-linking` | `module-write` | Modul-Steuerung ändern und wiederherstellen | db | — |
| `topic-linking` | `module-policy` | Anlageregel je Modul beachten | db | — |
| `topic-linking` | `case-item-link` | Vorgang mit Thema verknüpfen und Duplikate sperren | db | — |
| `topic-linking` | `merge-redirect` | Themen zusammenführen und Weiterleitung prüfen | db | — |
| `topic-linking` | `usage` | Verwendung je Modul zählen | db | — |
| `topic-linking` | `ministry-topic-cloud` | Neue Büros erhalten die Themen-Wolke automatisch | db | — |
| `topic-linking` | `module-rules-seed` | Neue Büros erhalten die Modul-Steuerung automatisch | db | — |
| `topic-linking` | `knowledge-topics` | Wissensfragen-Verknüpfung lesen und Schreibversuch abweisen | db | — |

## Deklarierter Prüfumfang

### `meeting-lifecycle`

Keine Prüfungen deklariert.

### `topic-linking`

1. ensure_topic bereinigt Leerzeichen, bildet den Schlüssel aus dem Label und liefert für dieselbe Bezeichnung dasselbe Thema
2. Themenlabels außerhalb von 2–40 Zeichen werden abgewiesen (22023)
3. Die Modul-Steuerung führt alle zehn Module; Wertebereiche für Modul und max_topics sind gesperrt (23514)
4. Nur die Büroleitung ändert die Modul-Steuerung; die Prüfung stellt die Ausgangswerte wieder her
5. ensure_topic mit Modul folgt creation_policy: bei 'admins' nur für die Büroleitung, bei 'members' auch für Mitglieder
6. Ein Vorgang verknüpft Themen über intake_payload; der Trigger setzt tenant_id und created_by, Entfernen im Payload löscht die Verknüpfung
7. Doppelte Verknüpfungen sind gesperrt (23505); auch ein direkter Insert ohne tenant_id wird dem Büro zugeordnet
8. merge_topics zieht Verknüpfungen auf das Zielthema, deaktiviert die Quelle als Weiterleitung und ensure_topic folgt der Weiterleitung
9. topic_usage zählt die Verknüpfungen je Modul und liefert die Summe
10. Ein neu angelegtes Büro erhält über den Trigger 69 Themen und 85 Ressortverknüpfungen (5–10 je Linie); ein zweiter Lauf verdoppelt nichts und eigene Beschreibungen bleiben stehen
11. Ein neu angelegtes Büro erhält alle zehn Modul-Regeln der Themen-Steuerung mit den Standardwerten; ein zweiter Lauf verdoppelt nichts

## Funktionsdetails

### `meetings.jour-fixe` — Jour-fixe-Sitzung planen und durchführen
Legt Sitzungen mit Teilnehmenden, Agenda und Vorlagen an, lädt ein und führt durch die Sitzung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/meetings`
- **Frontend-Komponenten:** `src/features/meetings/components/MeetingsView.tsx`, `src/components/meetings/MeetingCreateDialog.tsx`, `src/components/meetings/MeetingParticipantsManager.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useMeetingParticipants.tsx`
- **Edge Functions:** `check-meeting-reminders`
- **Datenbankfunktionen:** —
- **Tabellen:** `meetings`, `meeting_participants`, `meeting_templates`
- **Abhängigkeiten:** —
- **Selbsttests:** `meeting-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/team-rituals.md`

**Nachweise im Quellcode**

- src/features/meetings/components/MeetingsView.tsx
- src/features/selftest/scenarios/meeting-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.agenda` — Agenda führen
Füllt und sortiert Agenda-Punkte aus Vorgängen, Aufgaben, Geburtstagen, Dokumenten und manuellen Einträgen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/meetings/AgendaEditorPanel.tsx`, `src/components/meetings/SystemAgendaItem.tsx`, `src/components/meetings/AgendaResultEditor.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `meeting_agenda_items`, `meeting_agenda_documents`, `case_items`, `tasks`
- **Abhängigkeiten:** `meetings.jour-fixe`
- **Selbsttests:** `meeting-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/meetings/AgendaEditorPanel.tsx
- src/features/selftest/scenarios/meeting-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.protocol` — Sitzungsprotokoll
Schreibt und aktualisiert Protokolle, erlaubt Wiedereröffnung und erzeugt bestätigte Aufgaben.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/meetings/components/MeetingProtocolView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `update_meeting_protocol`, `reopen_meeting_protocol`, `create_acknowledged_meeting_tasks`
- **Tabellen:** `meeting_protocol_details`, `protocol_sessions`, `protocol_speeches`, `protocol_agenda_items`
- **Abhängigkeiten:** `meetings.agenda`, `tasks.create`
- **Selbsttests:** `meeting-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/meetings/components/MeetingProtocolView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.decisions` — Sitzungsentscheidungen dokumentieren
Hält Entscheidungen zu Agenda-Punkten fest, ohne Abstimmungen zu erfinden, und verknüpft Dokumente.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/meetings/components/MeetingDecisionDialog.tsx`, `src/features/meetings/components/OpenDecisionsCockpit.tsx`
- **Services:** `src/features/meetings/meetingDecision.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `document_meeting_decision`, `guard_meeting_decision_documentation`
- **Tabellen:** `meetings`, `meeting_agenda_items`, `documents`
- **Abhängigkeiten:** `meetings.agenda`, `decisions.create`
- **Selbsttests:** `meeting-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/meetings/meetingDecision.ts
- src/features/meetings/components/MeetingDecisionDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.archive` — Sitzung archivieren
Archiviert Sitzungen samt Stafette-Folgen und hält die Herkunft je Sitzung eindeutig.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/meetings/components/MeetingArchiveView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `archive_meeting_with_stafette`
- **Tabellen:** `meetings`, `archived_meeting_protocol_tasks`, `tasks`
- **Abhängigkeiten:** `meetings.protocol`, `tasks.create`
- **Selbsttests:** `meeting-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/meetings/components/MeetingArchiveView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.templates` — Sitzungsvorlagen
Verwaltet Sitzungsvorlagen mit Standardagenda und Teilnehmern.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/MeetingTemplateManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `ensure_single_default_meeting_template`, `get_meeting_protocol_participants`
- **Tabellen:** `meeting_templates`
- **Abhängigkeiten:** `meetings.agenda`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/administration/MeetingTemplateManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `meetings.zombie-points` — Liegengebliebene Agenda-Punkte
Erkennt seit mehreren Sitzungen offene Punkte und zeigt sie im Entscheidungs-Cockpit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `abgeordneter`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/meetings/zombiePoints.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `meeting_agenda_items`
- **Abhängigkeiten:** `meetings.agenda`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/meetings/zombiePoints.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Für zombiePoints.ts ist keine Testdatei vorhanden.

### `dossiers.manage` — Dossier anlegen und führen
Führt Dossiers mit Zusammenfassung, Qualitätsfeldern, Review-Erinnerungen und Verknüpfungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/DossiersMainView.tsx`, `src/features/dossiers/components/DossierDetailView.tsx`, `src/features/dossiers/components/DossierQualityFields.tsx`
- **Services:** —
- **Hooks:** `src/features/dossiers/hooks/useDossiers.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `dossier_is_duplicate_entry`
- **Tabellen:** `dossiers`, `dossier_entries`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/dossier-umsetzungsplan.md`

**Nachweise im Quellcode**

- src/features/dossiers/components/DossiersMainView.tsx
- src/features/dossiers/hooks/useDossiers.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.entries` — Dossier-Einträge und Timeline
Erfasst Einträge, ordnet sie chronologisch und verknüpft Quellen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/EntryCard.tsx`, `src/features/dossiers/components/EntryTimeline.tsx`
- **Services:** —
- **Hooks:** `src/features/dossiers/hooks/useDossierEntries.ts`, `src/features/dossiers/hooks/useEntryFollowups.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `dossier_entries`, `dossiers`
- **Abhängigkeiten:** `dossiers.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/EntryCard.tsx
- src/features/dossiers/hooks/useDossierEntries.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.links-stakeholders` — Dossier-Verknüpfungen und Stakeholder
Verknüpft Dossiers mit Kontakten, Dokumenten und anderen Dossiers und zeigt Beteiligte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/DossierLinksView.tsx`, `src/features/dossiers/components/DossierStakeholdersTab.tsx`
- **Services:** —
- **Hooks:** `src/features/dossiers/hooks/useDossierLinks.ts`, `src/features/dossiers/hooks/useDossierStakeholders.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `dossier_links`, `dossier_stakeholders`
- **Abhängigkeiten:** `dossiers.manage`, `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/DossierLinksView.tsx
- src/features/dossiers/components/DossierStakeholdersTab.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.talking-points` — Talking Points und Positionsversionen
Hält Gesprächspunkte und Positionsfassungen je Dossier fest.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/DossierTalkingPoints.tsx`
- **Services:** —
- **Hooks:** `src/features/dossiers/hooks/useTalkingPoints.ts`, `src/features/dossiers/hooks/usePositionVersions.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `dossier_talking_points`, `dossier_position_versions`
- **Abhängigkeiten:** `dossiers.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/DossierTalkingPoints.tsx
- src/features/dossiers/hooks/usePositionVersions.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.capture-radar` — Schnellerfassung und Mein Radar
Erfasst Dossier-Einträge aus dem Alltag und zeigt persönlich relevante Dossiers mit Review-Hinweisen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/SmartCapture.tsx`, `src/features/dossiers/components/QuickCapture.tsx`, `src/features/dossiers/components/MeinRadarView.tsx`, `src/features/dossiers/components/DossierReviewReminder.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `dossiers`, `dossier_entries`
- **Abhängigkeiten:** `dossiers.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/SmartCapture.tsx
- src/features/dossiers/components/MeinRadarView.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.sources` — Dossier-Quellenbeobachtung
Beobachtet externe Quellen und synchronisiert neue Einträge in Dossiers.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/DossierSourceWatchersPanel.tsx`
- **Services:** —
- **Hooks:** `src/features/dossiers/hooks/useDossierSourceWatchers.ts`
- **Edge Functions:** `sync-dossier-external-sources`
- **Datenbankfunktionen:** —
- **Tabellen:** `dossier_source_watchers`, `dossier_entries`
- **Abhängigkeiten:** `dossiers.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/DossierSourceWatchersPanel.tsx
- supabase/functions/sync-dossier-external-sources/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `dossiers.search` — Globale Dossier-Suche
Durchsucht Dossier-Einträge und Dossiers zentral und öffnet Treffer im Kontext.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/dossiers/components/GlobalEntrySearch.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `dossier_entries`, `dossiers`
- **Abhängigkeiten:** `dossiers.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/dossiers/components/GlobalEntrySearch.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `drucksachen.view` — Drucksachen anzeigen
Listet parlamentarische Drucksachen mit Bezug zu Themen und Dokumenten.

- **Kategorie:** fachlich
- **Implementierung:** teilweise
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/drucksachen/components/DrucksachenView.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `documents`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/drucksachen/components/DrucksachenView.tsx
- src/components/drucksachen

**Bekannte Einschränkungen**

- Eine eigene Drucksachen-Tabelle existiert in den generierten Typen nicht; die Anzeige arbeitet auf Dokumenten.

**Offene Prüfpunkte**

- Fachlicher Umfang der Drucksachenansicht ist unklar; nur die Ansicht ist nachgewiesen.

### `topics.manage` — Themen verwalten
Pflegt Themen mit Zuständigkeiten, Verknüpfungen und Sichtbarkeit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/topics/TopicOverview.tsx`, `src/components/topics/TopicSelector.tsx`
- **Services:** `src/features/topics/moduleRules.ts`
- **Hooks:** `src/hooks/useTopics.tsx`, `src/features/topics/useTopicModuleSettings.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `ensure_topic`, `merge_topics`, `topic_name_from_label`, `topic_usage`
- **Tabellen:** `topics`, `committees`, `regions`, `case_item_topics`, `knowledge_question_topics`, `topic_module_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** `topic-linking`
- **Unit-Tests:** `src/features/topics/moduleRules.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/topics/TopicOverview.tsx
- src/hooks/useTopics.tsx
- src/features/selftest/scenarios/topic-linking.ts

**Bekannte Einschränkungen**

- knowledge_question_topics hat nur eine Lesepolicy; Clients können Wissensfragen noch nicht selbst mit Themen verknüpfen, das Szenario prüft Lesbarkeit und die Abweisung des direkten Inserts.
- merge_topics und Änderungen an topic_module_settings setzen eine Büroleitung voraus; als Mitglied prüft das Szenario die Abweisung.

**Offene Prüfpunkte**

- Keine.

### `topics.convert-catalog` — Thema in Katalog überführen
Wandelt ein Thema atomar in einen Katalogeintrag um, erhält historische Verknüpfungen und übernimmt Zuständigkeiten.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/topics/TopicConversionButton.tsx`
- **Services:** —
- **Hooks:** `src/features/topics/useTopicCatalogLinks.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `convert_topic_to_catalog`
- **Tabellen:** `topics`, `topic_catalog_links`, `employee_responsibilities`
- **Abhängigkeiten:** `topics.manage`, `responsibilities.matrix`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/entity-map.md`

**Nachweise im Quellcode**

- src/features/topics/TopicConversionButton.tsx
- src/features/topics/useTopicCatalogLinks.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `topics.ministry-cloud` — Standarddaten für neue Büros
Legt im Themenkatalog jedes Büros automatisch den Grundbestand an ministerienbezogenen Themen an, füllt leere Beschreibungen, verknüpft die Ressortlinien der Parlamentsdokumentation und legt die zehn Modul-Regeln der Themen-Steuerung an. Der Anlage-Dialog zählt diese Daten nach dem Anlegen aus der Datenbank nach.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `ministry_topic_cloud_selftest`, `topic_module_settings_selftest`
- **Tabellen:** `topics`, `parlis_ministry_lines`, `parlis_ministry_topics`, `topic_module_settings`, `tenants`
- **Abhängigkeiten:** `topics.manage`
- **Selbsttests:** `topic-linking`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/migrations/20261128020000_seed_ministry_topic_cloud.sql
- src/features/selftest/scenarios/topic-linking.ts

**Bekannte Einschränkungen**

- Der Selbsttest legt ein Testbüro an und rollt es zurück; die Anzeige der Themen in der Administration wird dabei nicht über die Oberfläche geprüft.
- Der Erfolgsdialog des Anlage-Wizards zählt die Standarddaten nur; ob sie fachlich passen, prüft er nicht.

**Offene Prüfpunkte**

- Keine.

### `facts.manage` — Fakten und Argumente pflegen
Verwaltet Fakten mit Quellen, Nutzungszähler und CSV-Import/-Export.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/facts/components`
- **Services:** `src/features/facts/csvIo.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `increment_fact_usage`
- **Tabellen:** `facts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/facts/csvIo.ts
- src/features/facts/hooks

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
