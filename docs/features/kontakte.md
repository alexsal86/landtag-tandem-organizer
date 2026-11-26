# Kontakte & Netzwerk

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/kontakte.json`). Nicht von Hand bearbeiten._

**Zweck:** Kontakte, Organisationen und Verteilergruppen pflegen, importieren, Duplikate zusammenführen und Datenschutzvorgaben einhalten.

## Kennzahlen

- Funktionen: **14** in **9** Unterbereichen
- implementiert: **14**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **11**
- ohne Dokumentationsverweis: **10**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `contacts.bulk` Kontakte in Massen bearbeiten | Bearbeitung | fachlich | implementiert | rollenabhängig | kein Test |
| `contacts.briefing-memory` Briefingwissen je Kontakt | Beziehungen | fachlich | implementiert | UI | kein Test |
| `contacts.fundings` Finanzierungen und Beteiligungen | Beziehungen | fachlich | implementiert | UI | kein Test |
| `contacts.activities` Kontaktaktivitäten und Anrufe | Beziehungen | fachlich | implementiert | UI | kein Test |
| `contacts.privacy` Kontakt-Datenschutz und Aufbewahrung | Datenschutz | sicherheit | implementiert | UI | kein Test |
| `contacts.import` Kontakte importieren | Import | fachlich | implementiert | UI | kein Test |
| `contacts.stakeholders` Stakeholder-Netzwerk | Netzwerk | fachlich | implementiert | UI | kein Test |
| `contacts.duplicates` Dubletten finden | Qualität | fachlich | implementiert | rollenabhängig | kein Test |
| `contacts.merge` Kontakte zusammenführen | Qualität | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.create` Kontakt anlegen | Stammdaten | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.edit` Kontakt bearbeiten | Stammdaten | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.detail` Kontaktprofil mit Aktivitäten | Stammdaten | fachlich | implementiert | UI | kein Test |
| `contacts.tags-topics` Kontakt-Themen | Struktur | fachlich | implementiert | UI | kein Test |
| `contacts.distribution-lists` Verteilerlisten verwalten | Verteiler | fachlich | implementiert | UI | kein Test |

## Unterbereiche

- Stammdaten
- Import
- Qualität
- Verteiler
- Netzwerk
- Struktur
- Datenschutz
- Bearbeitung
- Beziehungen

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `admin`

## Datenbanktabellen

`audit_log_entries`, `bulk_action_audit`, `call_logs`, `contact_activities`, `contact_briefing_memory`, `contact_topics`, `contacts`, `distribution_list_members`, `distribution_lists`, `document_contacts`, `expense_budgets`, `field_permissions`, `funding_participants`, `fundings`, `map_flag_topics`, `map_flag_types`, `map_flags`, `map_layers`, `party_associations`, `regions`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `contact-lifecycle` | Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche) | 3 | 0 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `contact-lifecycle` | `create` | Kontakt mit allen Stammdaten anlegen | db | — |
| `contact-lifecycle` | `categorize` | Kategorie + Schlagworte ändern | db | — |
| `contact-lifecycle` | `activity` | Aktivität protokollieren | db | — |
| `contact-lifecycle` | `import-duplicate-resolution` | Import-Duplikate werden zusammengeführt oder überschrieben statt neu angelegt | logic | — |
| `contact-lifecycle` | `merge-contact-guardrails` | Zusammenführen verlangt gültige Kontakte und unveränderliche Identitätsfelder | workflow | — |
| `contact-lifecycle` | `merge-contact-atomic` | Zusammenführen ist atomar: Verknüpfungen wandern, Kollisionen behalten ihre Daten | workflow | — |
| `contact-lifecycle` | `search` | Kontakt über Namenssuche auffindbar | db | — |

## Deklarierter Prüfumfang

### `contact-lifecycle`

Keine Prüfungen deklariert.

## Funktionsdetails

### `contacts.create` — Kontakt anlegen
Legt Personen und Organisationen mit Stammdaten, Kategorien, Themen und Zuordnungen an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/contacts/new`, `/contacts?action=new`
- **Frontend-Komponenten:** `src/pages/CreateContact.tsx`, `src/features/contacts/components/ContactEditForm.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `log_contact_creation`, `validate_organization_reference`, `assign_contact_to_organization`
- **Tabellen:** `contacts`, `contact_topics`, `party_associations`, `regions`
- **Abhängigkeiten:** —
- **Selbsttests:** `contact-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/contacts-system-review.md`

**Nachweise im Quellcode**

- src/pages/CreateContact.tsx
- src/features/contacts/components/ContactEditForm.tsx
- src/features/selftest/scenarios/contact-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.edit` — Kontakt bearbeiten
Ändert Kontaktfelder mit Feldrechten, protokolliert Änderungen und aktualisiert abhängige Anzeigen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/contacts/:id/edit`
- **Frontend-Komponenten:** `src/pages/EditContact.tsx`, `src/features/contacts/components/ContactEditForm.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useFieldPermission.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `log_contact_edit_activity`, `audit_contact_field_updates`, `handle_contact_birthday_change`, `update_contact_usage`
- **Tabellen:** `contacts`, `contact_activities`, `audit_log_entries`, `field_permissions`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** `contact-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/EditContact.tsx
- src/features/contacts/components/ContactEditForm.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.detail` — Kontaktprofil mit Aktivitäten
Zeigt Stammdaten, Aktivitäten, Dokumente, Finanzierungen, Themen, Vorgänge und Briefingwissen eines Kontakts.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/contacts/:id`
- **Frontend-Komponenten:** `src/pages/ContactDetail.tsx`, `src/features/contacts/components/ContactDetailPanel.tsx`, `src/components/contacts/ContactInfoTab.tsx`, `src/components/contacts/ActivityTimeline.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `contacts`, `contact_activities`, `contact_topics`, `document_contacts`, `fundings`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/ContactDetail.tsx
- src/features/contacts/components/ContactDetailPanel.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.import` — Kontakte importieren
Importiert Kontakte aus CSV/VCF/MSG, erkennt Dubletten und ordnet Spalten zu.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/contacts/import`
- **Frontend-Komponenten:** `src/pages/ImportContacts.tsx`, `src/features/contacts/components/ContactImport.tsx`, `src/components/contacts/ContactImportDuplicateDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `insert_sample_contacts`
- **Tabellen:** `contacts`, `contact_activities`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/contacts-overhaul-proposals.md`

**Nachweise im Quellcode**

- src/pages/ImportContacts.tsx
- src/features/contacts/components/ContactImport.tsx
- src/components/contact-import

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.duplicates` — Dubletten finden
Findet ähnliche Kontakte über Trigramm-Suche und zeigt Dublettenprüfungen in der Administration.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `admin`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/contacts/components/DuplicateWarning.tsx`, `src/components/contacts/DuplicateContactsSheet.tsx`, `src/components/administration/DuplicateScanDashboard.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `find_contact_duplicates_trgm`
- **Tabellen:** `contacts`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/contacts/components/DuplicateWarning.tsx
- src/components/administration/DuplicateScanDashboard.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Trefferheuristik ist nicht qualitätsgetestet; falsche Paare sind möglich.

### `contacts.merge` — Kontakte zusammenführen
Führt zwei Kontakte transaktional zusammen, verschiebt alle Verweise und bricht bei nicht verifizierbaren Referenzen ab.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/contacts/MergeContactsDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `merge_contacts`
- **Tabellen:** `contacts`, `contact_activities`, `contact_topics`, `document_contacts`, `fundings`
- **Abhängigkeiten:** `contacts.create`, `contacts.edit`
- **Selbsttests:** `contact-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/contacts-system-review.md`

**Nachweise im Quellcode**

- src/components/contacts/MergeContactsDialog.tsx
- src/features/selftest/scenarios/contact-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.distribution-lists` — Verteilerlisten verwalten
Erstellt und bearbeitet Verteilerlisten, ordnet Mitglieder zu und wandelt Stakeholder in Verteiler um.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/contacts?tab=distributionlists`
- **Frontend-Komponenten:** `src/pages/CreateDistributionList.tsx`, `src/pages/EditDistributionList.tsx`, `src/features/contacts/components/DistributionListForm.tsx`, `src/components/contacts/DistributionListsTab.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `distribution_lists`, `distribution_list_members`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/CreateDistributionList.tsx
- src/pages/EditDistributionList.tsx
- src/features/contacts/components/DistributionListForm.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.stakeholders` — Stakeholder-Netzwerk
Zeigt Stakeholder auf Karten, verwaltet Flags, Ebenen und Netzwerk-Tags.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/contacts/netzwerk`, `/contacts/stakeholder`
- **Frontend-Komponenten:** `src/features/contacts/components/StakeholderView.tsx`, `src/components/contacts/StakeholderNetworkPage.tsx`, `src/components/dashboard/StakeholderNetworkWidget.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useMapFlags.tsx`, `src/hooks/useMapLayers.ts`, `src/hooks/useMapFlagStakeholders.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `map_flags`, `map_flag_topics`, `map_flag_types`, `map_layers`, `contacts`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/contacts/components/StakeholderView.tsx
- src/components/contacts/StakeholderNetworkPage.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.tags-topics` — Kontakt-Themen
Vergibt Themen an Kontakte über contact_topics und zeigt sie in Liste, Detail und Bearbeitung; die früheren Tag-Textarrays werden nicht mehr fortgeschrieben.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/features/topics/useEntityTopics.ts`, `src/components/topics/TopicPicker.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `contact_topics`, `topics`
- **Abhängigkeiten:** `contacts.create`, `topics.manage`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/topics/useEntityTopics.ts
- src/components/topics/TopicPicker.tsx
- src/hooks/useContactDocuments.tsx

**Bekannte Einschränkungen**

- Das frühere Tag-Feld bleibt als historischer Bestand in contacts.tags erhalten.

**Offene Prüfpunkte**

- Die Junction-Schreibpfade sind durch keinen eigenen Szenario-Schritt abgedeckt.

### `contacts.privacy` — Kontakt-Datenschutz und Aufbewahrung
Zeigt Datenschutzhinweise, berechnet Aufbewahrungsfristen und maskiert geschützte Kontaktdaten.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/contacts/privacy/ContactPrivacyCard.tsx`
- **Services:** `src/features/contacts/privacy/retention.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `contacts_default_retention`, `read_secured_contacts`, `mask_secured_record`, `mutate_secured_records`, `contacts_secured`
- **Tabellen:** `contacts`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/features/contacts/privacy/ContactPrivacyCard.tsx
- src/features/contacts/privacy/retention.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.bulk` — Kontakte in Massen bearbeiten
Aktualisiert Felder für viele Kontakte gleichzeitig, protokolliert die Aktion und erlaubt die Rücknahme.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/contacts/BulkActionsToolbar.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `bulk_update_contact_fields`, `undo_contact_bulk_action`, `cleanup_bulk_action_audit`
- **Tabellen:** `contacts`, `bulk_action_audit`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/contacts/BulkActionsToolbar.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.activities` — Kontaktaktivitäten und Anrufe
Protokolliert Anrufe, E-Mails, Treffen und Notizen am Kontakt und zeigt sie im Verlauf.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/contacts/ActivityTimeline.tsx`, `src/components/my-work/CallNoteQuickCapture.tsx`, `src/components/my-work/EmailQuickCapture.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `log_contact_activity`, `log_call_log_activity`
- **Tabellen:** `contact_activities`, `call_logs`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/contacts/ActivityTimeline.tsx
- src/components/my-work/CallNoteQuickCapture.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.briefing-memory` — Briefingwissen je Kontakt
Merkt sich Gesprächswissen und Vorlieben je Kontakt für Terminbriefings.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/contacts/ContactBriefingMemoryTab.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useContactBriefingMemory.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `contact_briefing_memory`, `contacts`
- **Abhängigkeiten:** `appointments.briefing`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useContactBriefingMemory.ts
- src/components/contacts/ContactBriefingMemoryTab.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `contacts.fundings` — Finanzierungen und Beteiligungen
Erfasst Finanzierungen, beteiligte Kontakte und Budgetbezüge.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/contacts/FundingDialog.tsx`, `src/components/contacts/ContactFundingsList.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useContactFundings.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `fundings`, `funding_participants`, `expense_budgets`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useContactFundings.tsx
- src/components/contacts/FundingDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
