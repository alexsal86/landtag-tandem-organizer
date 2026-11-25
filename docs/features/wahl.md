# Wahlanalyse & Wahlhistorie

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/wahl.json`). Nicht von Hand bearbeiten._

**Zweck:** Aktuelle und historische Wahlergebnisse auswerten, Wahlkreiskarten darstellen, Mandate, Kandidaturen und Landeslisten pflegen und Datenqualität sichern.

## Kennzahlen

- Funktionen: **23** in **4** Unterbereichen
- implementiert: **23**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **12**
- ohne Dokumentationsverweis: **15**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `election.deputy-results` Abgeordneten- und Kandidatenergebnisse | Analyse | fachlich | implementiert | UI | Unit-Test |
| `election.analysis-map` Analyse-Karten und Wahlkreiszuschnitt | Analyse | fachlich | implementiert | UI | kein Test |
| `election.analysis-navigation` Analyse-Navigation und gespeicherte Szenarien | Analyse | fachlich | implementiert | UI | Unit-Test |
| `election.research-workbench` Analyse-Workbench und Kommunalpanel | Analyse | fachlich | implementiert | rollenabhängig | kein Test |
| `election.state-history` Landesweite Zeitreihen | Analyse | fachlich | implementiert | UI | Unit-Test |
| `election.parliament-protocols` Plenarprotokolle auswerten | Analyse | integration | implementiert | systemseitig | kein Test |
| `election.seat-distribution` Sitzverteilung und Hemizykel | Analyse | fachlich | implementiert | UI | kein Test |
| `election.analysis` Wahlanalyse durchführen | Analyse | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.turnout` Wahlbeteiligung | Analyse | fachlich | implementiert | UI | kein Test |
| `election.history.audit` Wahlhistorien-Audit | Datenqualität | sicherheit | implementiert | rollenabhängig | kein Test |
| `election.history.quality` Wahlhistorien-Datenqualität | Datenqualität | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.history.portraits` Abgeordnetenporträts | Wahlhistorie | integration | implementiert | rollenabhängig | Selbsttest |
| `election.history.assembly` Historien-Assemblierung | Wahlhistorie | automatisiert | implementiert | systemseitig | kein Test |
| `election.history.factions` Historische Fraktionen | Wahlhistorie | fachlich | implementiert | rollenabhängig | kein Test |
| `election.history.mandates` Historische Mandate pflegen | Wahlhistorie | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.history.districts-geometry` Historische Wahlkreise und Geometrie | Wahlhistorie | fachlich | implementiert | rollenabhängig | kein Test |
| `election.history.candidacies` Kandidaturen und Ergebnisse pflegen | Wahlhistorie | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.history.state-lists` Landeslisten verwalten | Wahlhistorie | fachlich | implementiert | rollenabhängig | kein Test |
| `election.history.people` Personenregister und Karrieren | Wahlhistorie | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.history.periods` Wahlperioden verwalten | Wahlhistorie | fachlich | implementiert | rollenabhängig | Selbsttest |
| `election.representatives` Abgeordnete und Parteiassoziationen importieren | Wahlkreiskarte | integration | implementiert | rollenabhängig | kein Test |
| `election.districts-import` Wahlkreise und Gebiete importieren | Wahlkreiskarte | integration | implementiert | rollenabhängig | kein Test |
| `election.map` Wahlkreiskarte anzeigen | Wahlkreiskarte | fachlich | implementiert | UI | Selbsttest |

## Unterbereiche

- Analyse
- Wahlkreiskarte
- Wahlhistorie
- Datenqualität

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `superadmin`, `admin`, `system`

## Datenbanktabellen

`election_analysis_bw_polls`, `election_analysis_candidate_coverage`, `election_analysis_candidates`, `election_analysis_correction_audit`, `election_analysis_districts`, `election_analysis_flows`, `election_analysis_geographies`, `election_analysis_local_results`, `election_analysis_scenarios`, `election_analysis_source_reviews`, `election_analysis_state`, `election_analysis_state_totals`, `election_analysis_turnout`, `election_analysis_versions`, `election_analysis_workbook_audit`, `election_analysis_years`, `election_district_municipalities`, `election_district_notes`, `election_districts`, `election_history_1952_result_sources`, `election_history_assembly_issues`, `election_history_audit`, `election_history_candidacies`, `election_history_candidate_workbook_audit`, `election_history_connection_people`, `election_history_districts`, `election_history_factions`, `election_history_mandate_birthdays`, `election_history_mandates`, `election_history_people`, `election_history_periods`, `election_history_state_list_entries`, `election_history_state_lists`, `election_representatives`, `karlsruhe_districts`, `map_layers`, `map_routes`, `parliament_protocols`, `party_associations`, `protocol_sessions`, `protocol_speeches`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `election-analysis` | Wahlanalyse: Datenqualität und Vergleichbarkeit | 0 | 4 |
| `election-deputy-reader` | Wahlanalyse: Abgeordnetenübersicht | 0 | 0 |
| `election-history-workbench` | Wahldaten: Problemfälle und Landeslisten | 0 | 0 |
| `election-map` | Wahlkreiskarte: Suche und Grenzdaten | 0 | 0 |
| `security-hardening` | Sicherheitsregeln: Porträtdateien und E-Mail-Inhalte | 0 | 4 |

## Funktionsdetails

### `election.analysis` — Wahlanalyse durchführen
Wertet Ergebnisse nach Jahren, Parteien, Wahlkreisen und Mandaten aus und stellt Vergleichs- und Detailansichten bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/daten`
- **Frontend-Komponenten:** `src/features/election-analysis/ElectionAnalysis.tsx`, `src/features/election-analysis/AnalysisToolbar.tsx`, `src/features/election-analysis/AnalysisInfo.tsx`
- **Services:** —
- **Hooks:** `src/features/election-analysis/useElectionAnalysis.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_analysis_comparison`, `get_analysis_district_history`, `get_analysis_district_series`
- **Tabellen:** `election_analysis_years`, `election_analysis_districts`, `election_analysis_flows`, `election_analysis_state_totals`, `election_analysis_versions`
- **Abhängigkeiten:** —
- **Selbsttests:** `election-analysis`
- **Unit-Tests:** `src/features/election-analysis/ElectionAnalysis.test.tsx`, `src/features/election-analysis/rowTypes.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/wahlanalyse.md`

**Nachweise im Quellcode**

- src/features/election-analysis/ElectionAnalysis.tsx
- src/features/election-analysis/useElectionAnalysis.ts
- src/features/selftest/scenarios/election-analysis.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.analysis-navigation` — Analyse-Navigation und gespeicherte Szenarien
Navigiert zwischen Analyseebenen und speichert Analyse-Szenarien.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/research/SavedScenariosPanel.tsx`
- **Services:** `src/features/election-analysis/navigation.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `guard_analysis_scenario`
- **Tabellen:** `election_analysis_scenarios`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/election-analysis/navigation.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-analysis/navigation.ts
- src/features/election-analysis/research/SavedScenariosPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.analysis-map` — Analyse-Karten und Wahlkreiszuschnitt
Zeigt Analyseergebnisse auf Karten und verknüpft Wahlkreise mit Analyseversionen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/research/AnalysisMap.tsx`
- **Services:** `src/features/election-analysis/research/mapModel.ts`, `src/features/election-analysis/research/confirmedGeometry.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `match_analysis_history_district`, `guard_analysis_version_link`, `guard_analysis_period_link`
- **Tabellen:** `election_analysis_geographies`, `election_analysis_districts`, `election_history_districts`
- **Abhängigkeiten:** `election.analysis`, `election.history.districts-geometry`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/wahlkreiskarte.md`

**Nachweise im Quellcode**

- src/features/election-analysis/research/AnalysisMap.tsx
- src/features/election-analysis/research/mapModel.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.turnout` — Wahlbeteiligung
Stellt Wahlbeteiligung im Zeitvergleich und je Gebiet dar.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/TurnoutPanel.tsx`
- **Services:** `src/features/election-analysis/research/turnoutModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_analysis_turnout_comparison`
- **Tabellen:** `election_analysis_turnout`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-analysis/TurnoutPanel.tsx
- src/features/election-analysis/research/turnoutModel.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.seat-distribution` — Sitzverteilung und Hemizykel
Berechnet Sitzverteilungen und stellt sie als Hemizykel und Parteienvergleich dar.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/ParliamentHemicycle.tsx`, `src/features/election-analysis/StateSeatDistribution.tsx`
- **Services:** `src/features/election-analysis/seatDistributionModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `valid_bw_poll_shares`
- **Tabellen:** `election_analysis_state`, `election_analysis_bw_polls`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-analysis/seatDistributionModel.ts
- src/features/election-analysis/ParliamentHemicycle.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Für seatDistributionModel.ts ist keine dedizierte Testdatei vorhanden.

### `election.deputy-results` — Abgeordneten- und Kandidatenergebnisse
Zeigt persönliche Wahlergebnisse, Kandidaturen und Mandatszeiträume je Person.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/DeputyElectionResult.tsx`, `src/features/election-analysis/DeputyCandidacyResult.tsx`, `src/features/election-analysis/DeputySeatDistribution.tsx`
- **Services:** `src/features/election-analysis/deputyElectionResult.ts`, `src/features/election-analysis/deputyTenure.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_analysis_deputy_election_result`, `list_analysis_deputies`, `list_analysis_deputy_factions`
- **Tabellen:** `election_analysis_candidates`, `election_history_candidacies`, `election_history_mandates`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** `election-deputy-reader`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-analysis/DeputyElectionResult.tsx
- src/features/election-analysis/deputyElectionResult.ts
- src/features/election-analysis/deputyTenure.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.state-history` — Landesweite Zeitreihen
Stellt landesweite Ergebnisse, Parteienanteile und historische Vergleichsreihen dar.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/StateHistoryPanels.tsx`, `src/features/election-analysis/StateShareChart.tsx`
- **Services:** `src/features/election-analysis/stateHistoryModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `election_analysis_state`, `election_analysis_state_totals`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/election-analysis/StateHistoryPanels.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-analysis/StateHistoryPanels.tsx
- src/features/election-analysis/stateHistoryModel.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.research-workbench` — Analyse-Workbench und Kommunalpanel
Führt Forschungsauswertungen, kommunale Ergebnisse, Kandidatenabdeckung und Release-Prüfungen zusammen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-analysis/research/ResearchWorkbench.tsx`, `src/features/election-analysis/research/MunicipalPanel.tsx`, `src/features/election-analysis/research/CandidateCoverageReview.tsx`, `src/features/election-analysis/research/ReleaseCockpit.tsx`
- **Services:** —
- **Hooks:** `src/features/election-analysis/research/hooks.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_analysis_local_page`, `import_analysis_local_rows`, `confirm_analysis_candidate_identity`, `invalidate_election_candidate_coverage`
- **Tabellen:** `election_analysis_local_results`, `election_analysis_candidate_coverage`, `election_analysis_source_reviews`, `election_analysis_correction_audit`
- **Abhängigkeiten:** `election.analysis`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/wahlanalyse.md`

**Nachweise im Quellcode**

- src/features/election-analysis/research/ResearchWorkbench.tsx
- src/features/election-analysis/research/MunicipalPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.map` — Wahlkreiskarte anzeigen
Zeigt Wahlkreise auf einer interaktiven Karte mit Ergebnissen, Notizen und Ebenen. Die Zeitreise beginnt immer bei der ältesten freigegebenen Legislaturperiode, läuft dann in Wahljahresfolge durch alle Perioden, hält die Karte samt Ausschnitt fest und lädt die nächste Periode mit ihrem bestätigten Grenzstand vor, bevor sie erscheint. Die Parteifilter-Auswahl bleibt beim Wechsel der Legislaturperiode erhalten. Der Wechsel morpht Wahlkreise mit gleichem Namen oder klar überlappender Fläche in projizierten Pixeln und blendet Wahlkreise ohne Gegenstück über; Nummern gelten nie als periodenübergreifende Identität. Der Fortschritt steht als Statusanzeige auf der Karte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/karten`, `/maps`
- **Frontend-Komponenten:** `src/pages/MapsView.tsx`, `src/features/election-districts/components`
- **Services:** —
- **Hooks:** `src/hooks/useElectionDistricts.tsx`, `src/hooks/useMapLayers.ts`, `src/hooks/useHeatmapData.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `election_districts`, `election_district_municipalities`, `election_district_notes`, `map_layers`, `map_routes`
- **Abhängigkeiten:** `election.districts-import`
- **Selbsttests:** `election-map`
- **Unit-Tests:** `src/features/election-districts/mapModel.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** `e2e/election-map.spec.ts`
- **Dokumentation:** `docs/wahlkreiskarte.md`

**Nachweise im Quellcode**

- src/pages/MapsView.tsx
- src/features/election-districts/mapModel.ts
- src/features/election-districts/components/ElectionDistrictsView.tsx
- src/features/selftest/scenarios/election-map.ts

**Bekannte Einschränkungen**

- Schlägt das Vorabladen der nächsten Periode fehl, hält die Zeitreise an und nennt die betroffene Periode, statt sie zu überspringen.
- Sehr große Grenzstände über dem Punktbudget sowie aktivierte Bewegungseinschränkung wechseln ohne Morph.
- Wahlkreise mit neuem Namen und ohne gemeinsame Fläche (Reformen) blenden über, statt zu morphen.

**Offene Prüfpunkte**

- Keine.

### `election.districts-import` — Wahlkreise und Gebiete importieren
Importiert Wahlkreise, Karlsruher Stadtteile und administrative Grenzen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/GeoDataImport.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `import-election-districts`, `import-karlsruhe-districts`, `fetch-karlsruhe-districts`, `import-administrative-boundaries`
- **Datenbankfunktionen:** —
- **Tabellen:** `election_districts`, `karlsruhe_districts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/import-election-districts/index.ts
- supabase/functions/import-karlsruhe-districts/index.ts
- src/components/administration/GeoDataImport.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.representatives` — Abgeordnete und Parteiassoziationen importieren
Importiert Mandatsträger und Parteiassoziationen und ordnet sie Wahlkreisen zu.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `import-representatives`, `import-party-associations`
- **Datenbankfunktionen:** —
- **Tabellen:** `election_representatives`, `party_associations`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/import-representatives/index.ts
- supabase/functions/import-party-associations/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.periods` — Wahlperioden verwalten
Pflegt Legislaturperioden mit Sitzzahlen, Parteien-Snapshots und Veröffentlichungsstatus; nur Superadmins schreiben.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `abgeordneter`, `bueroleitung`
- **Routen:** `/daten?tab=wahlhistorie`
- **Frontend-Komponenten:** `src/features/election-history/ElectionHistoryAdmin.tsx`, `src/features/election-history/PeriodSeatSummary.tsx`, `src/features/election-history/ElectionPeriodPreview.tsx`
- **Services:** —
- **Hooks:** `src/features/election-history/useElectionHistory.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_election_history_period`, `get_election_history_period_overview`, `set_current_election_history_period`, `guard_election_history_period_dates`, `guard_election_period_seats`
- **Tabellen:** `election_history_periods`, `election_history_mandates`, `election_history_factions`
- **Abhängigkeiten:** —
- **Selbsttests:** `election-history-workbench`
- **Unit-Tests:** `src/features/election-history/ElectionHistoryAdmin.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/elections`

**Nachweise im Quellcode**

- src/features/election-history/ElectionHistoryAdmin.tsx
- src/features/selftest/scenarios/election-history-workbench.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.mandates` — Historische Mandate pflegen
Erfasst Mandatszeiträume mit Vererbung aus der Periode, Nachfolge- und Überschneidungsprüfungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/admin/HistoryDataGrid.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `inherit_election_mandate_dates`, `guard_election_history_dates`, `connect_matching_election_history_mandate`, `assign_election_mandate_connection`, `merge_election_history_deputies`
- **Tabellen:** `election_history_mandates`, `election_history_connection_people`, `election_history_mandate_birthdays`
- **Abhängigkeiten:** `election.history.periods`, `election.history.people`, `election.history.districts-geometry`, `election.history.factions`
- **Selbsttests:** `election-history-workbench`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/mandateLabel.ts
- src/features/election-history/admin/HistoryDataGrid.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.candidacies` — Kandidaturen und Ergebnisse pflegen
Erfasst Kandidaturen mit persönlichen Ergebnissen, getrennt von tatsächlichen Mandatszeiträumen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/CandidateDistrictResults.tsx`, `src/features/election-history/admin/CandidacyImportDialog.tsx`
- **Services:** `src/features/election-history/candidateResults.ts`, `src/features/election-history/admin/candidacyImport.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `import_election_history_candidacies`, `guard_election_history_candidacy`, `guard_local_result_coherence`
- **Tabellen:** `election_history_candidacies`, `election_history_districts`, `election_history_candidate_workbook_audit`
- **Abhängigkeiten:** `election.history.periods`, `election.history.people`
- **Selbsttests:** `election-history-workbench`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/candidateResults.ts
- src/features/election-history/admin/CandidacyImportDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.people` — Personenregister und Karrieren
Führt Personen über Perioden hinweg, verknüpft Kandidaturen und Mandate und zeigt Karriereverläufe.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/ElectionDeputyDirectory.tsx`, `src/features/election-history/PersonCareer.tsx`, `src/features/election-history/PersonElectionSummary.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_election_candidate_person`, `get_election_person_career`, `get_election_person_summary`, `search_election_person_careers`, `search_election_state_list_people`, `list_election_history_deputies`, `confirm_election_history_deputy`, `connect_election_history_mandates`
- **Tabellen:** `election_history_people`, `election_history_candidacies`, `election_history_mandates`
- **Abhängigkeiten:** `election.history.periods`
- **Selbsttests:** `election-deputy-reader`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/PersonCareer.tsx
- src/features/election-history/useElectionHistory.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.state-lists` — Landeslisten verwalten
Erfasst Landeslisten und Listenplätze ab Periode 18 ohne Personen, Mandate oder Ergebnisse zu erzeugen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `abgeordneter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/DeputyStateListPlaces.tsx`
- **Services:** `src/features/election-history/stateListPlaces.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_deputy_state_list_places`, `guard_election_period_state_lists`, `guard_election_state_list`, `link_election_state_list_entry`, `refresh_state_lists_after_birth_change`
- **Tabellen:** `election_history_state_lists`, `election_history_state_list_entries`
- **Abhängigkeiten:** `election.history.periods`, `election.history.people`, `election.history.factions`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/stateListPlaces.ts
- src/features/election-history/DeputyStateListPlaces.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.factions` — Historische Fraktionen
Pflegt Fraktionskatalog, Aliase und relationale Verweise in Mandaten, Kandidaturen und Sitz-Snapshots.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/admin/FactionsAdmin.tsx`
- **Services:** `src/features/election-history/factions.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `guard_history_faction_catalog`, `normalize_history_faction_reference`, `propagate_history_faction_name`, `normalize_history_seat_factions`, `resolve_history_faction`, `history_faction_key`, `history_list_person_key`, `history_result_party`
- **Tabellen:** `election_history_factions`, `election_history_mandates`, `election_history_candidacies`, `election_history_periods`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/factions.ts
- src/features/election-history/admin/FactionsAdmin.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.quality` — Wahlhistorien-Datenqualität
Prüft Datenqualität und Quellenabgleich, zeigt Befunde paginiert und lädt nur den gewählten Datensatz.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/admin/ElectionDataChecks.tsx`
- **Services:** `src/features/election-history/admin/historyQuality.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_election_history_issues`, `election_history_issue_rows`, `get_election_history_assembly_status`
- **Tabellen:** `election_history_assembly_issues`, `election_history_audit`, `election_analysis_workbook_audit`
- **Abhängigkeiten:** `election.history.periods`
- **Selbsttests:** `election-history-workbench`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/admin/ElectionDataChecks.tsx
- src/features/election-history/admin/historyQuality.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.audit` — Wahlhistorien-Audit
Protokolliert Änderungen an historischen Daten und zeigt Audit-Einträge.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/ElectionHistoryAudit.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `audit_election_history`
- **Tabellen:** `election_history_audit`
- **Abhängigkeiten:** `election.history.quality`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/ElectionHistoryAudit.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.assembly` — Historien-Assemblierung
Setzt bestätigte Verbindungen in Personen und ursprüngliche Kandidaturen um, ohne neue Wahlen zu erfinden.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/CandidacyAssemblyStatus.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `assemble_election_history`, `sync_assembled_election_history`, `apply_verified_election_period`, `election_history_1952_source`
- **Tabellen:** `election_history_candidacies`, `election_history_people`, `election_history_1952_result_sources`
- **Abhängigkeiten:** `election.history.candidacies`, `election.history.mandates`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/election-history/CandidacyAssemblyStatus.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `election.history.districts-geometry` — Historische Wahlkreise und Geometrie
Ordnet historische Wahlkreise zu, zeigt Grenzverläufe und kennzeichnet Rekonstruktionen und Quellen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`, `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/DistrictBoundaryMap.tsx`, `src/features/election-history/DistrictBoundarySection.tsx`, `src/features/election-history/HistoricalGeometryNotice.tsx`
- **Services:** `src/features/election-history/historicalDistrictNames.ts`, `src/features/election-history/mapProjection.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `guard_analysis_version_link`, `guard_election_history_1988_district_name`, `election_history_source_district_name`, `invalidate_election_history_geometry`
- **Tabellen:** `election_history_districts`, `election_analysis_geographies`
- **Abhängigkeiten:** `election.history.periods`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/election-analysis`, `docs/wahlkreiskarte.md`

**Nachweise im Quellcode**

- src/features/election-history/DistrictBoundaryMap.tsx
- src/features/election-history/HistoricalGeometryNotice.tsx

**Bekannte Einschränkungen**

- Rekonstruierte Grenzstände sind ausdrücklich nicht als verifizierte historische Identität behandelt.

**Offene Prüfpunkte**

- Keine.

### `election.parliament-protocols` — Plenarprotokolle auswerten
Analysiert Plenarprotokolle und ordnet Reden und Sitzungen auswertbar zu.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `analyze-parliament-protocol`
- **Datenbankfunktionen:** —
- **Tabellen:** `parliament_protocols`, `protocol_sessions`, `protocol_speeches`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/wahlanalyse.md`

**Nachweise im Quellcode**

- supabase/functions/analyze-parliament-protocol/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Analysefunktion ist nicht dokumentiert; Eingabeformat und Ausgabequalität sind ungeprüft.

### `election.history.portraits` — Abgeordnetenporträts
Schneidet Porträts zu, erzeugt WebP und Thumbnail und committet sie über einen serverseitigen GitHub-Schreibvorgang.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `superadmin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/election-history/DeputyPortrait.tsx`, `src/features/election-history/DeputyPortraitEditor.tsx`
- **Services:** `supabase/functions/_shared/deputyPortrait.ts`
- **Hooks:** —
- **Edge Functions:** `save-deputy-portrait`, `extract-photo-data`
- **Datenbankfunktionen:** —
- **Tabellen:** `election_history_connection_people`
- **Abhängigkeiten:** `election.history.people`
- **Selbsttests:** `security-hardening`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/features/election-history/DeputyPortraitEditor.tsx
- supabase/functions/_shared/deputyPortrait.ts
- supabase/functions/save-deputy-portrait/index.ts

**Bekannte Einschränkungen**

- Ein Upload gilt erst nach Veröffentlichung des Repository-Commits durch den Hosting-Anbieter als sichtbar.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
