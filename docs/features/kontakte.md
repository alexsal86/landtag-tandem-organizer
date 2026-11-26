# Kontakte & Netzwerk

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/kontakte.json`). Nicht von Hand bearbeiten._

**Zweck:** Kontakte, Organisationen und Verteilergruppen pflegen, importieren, Duplikate zusammenführen und Datenschutzvorgaben einhalten.

## Kennzahlen

- Funktionen: **14** in **9** Unterbereichen
- implementiert: **14**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **0**
- ohne Dokumentationsverweis: **10**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `contacts.bulk` Kontakte in Massen bearbeiten | Bearbeitung | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.briefing-memory` Briefingwissen je Kontakt | Beziehungen | fachlich | implementiert | UI | Selbsttest |
| `contacts.fundings` Finanzierungen und Beteiligungen | Beziehungen | fachlich | implementiert | UI | Selbsttest |
| `contacts.activities` Kontaktaktivitäten und Anrufe | Beziehungen | fachlich | implementiert | UI | Selbsttest |
| `contacts.privacy` Kontakt-Datenschutz und Aufbewahrung | Datenschutz | sicherheit | implementiert | UI | Selbsttest |
| `contacts.import` Kontakte importieren | Import | fachlich | implementiert | UI | Selbsttest |
| `contacts.stakeholders` Stakeholder-Netzwerk | Netzwerk | fachlich | implementiert | UI | Selbsttest |
| `contacts.duplicates` Dubletten finden | Qualität | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.merge` Kontakte zusammenführen | Qualität | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.create` Kontakt anlegen | Stammdaten | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.edit` Kontakt bearbeiten | Stammdaten | fachlich | implementiert | rollenabhängig | Selbsttest |
| `contacts.detail` Kontaktprofil mit Aktivitäten | Stammdaten | fachlich | implementiert | UI | Selbsttest |
| `contacts.tags-topics` Kontakt-Themen | Struktur | fachlich | implementiert | UI | Selbsttest |
| `contacts.distribution-lists` Verteilerlisten verwalten | Verteiler | fachlich | implementiert | UI | Selbsttest |

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

`audit_log_entries`, `bulk_action_audit`, `call_logs`, `contact_activities`, `contact_briefing_memory`, `contact_topics`, `contacts`, `distribution_list_members`, `distribution_lists`, `document_contacts`, `expense_budgets`, `field_permissions`, `funding_participants`, `fundings`, `gdpr_requests`, `map_flag_topics`, `map_flag_types`, `map_flags`, `map_layers`, `party_associations`, `regions`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `contact-lifecycle` | Kontakt-Lifecycle (Anlegen → Kategorie/Tags → Aktivität → Suche) | 3 | 0 | — |
| `contact-relations` | Kontakt-Beziehungen (Datenschutz → Themen → Duplikate → Sammelaktion → Verteiler → Wissen → Förderungen) | 13 | 20 | — |

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
| `contact-relations` | `setup` | Ausgangskontakt für die Beziehungsprüfungen anlegen | db | — |
| `contact-relations` | `retention-defaults` | Aufbewahrungsfristen werden beim Anlegen aus der Kategorie gesetzt | db | — |
| `contact-relations` | `retention-rules` | Aufbewahrungsregeln rechnen und prüfen | logic | — |
| `contact-relations` | `gdpr-four-eyes` | Vier-Augen-Regel der Löschanfrage als reine Regel prüfen | logic | — |
| `contact-relations` | `gdpr-deletion` | Löschanfrage anlegen, Eigenfreigabe abweisen und zweite berechtigte Person prüfen | db | — |
| `contact-relations` | `import-mapping` | Import liest CSV und VCF ein, ordnet Spalten zu und bereitet Zeilen auf | logic | — |
| `contact-relations` | `import-assignment` | Importzeile anlegen und über die Verteiler-Spalte zuordnen | db | — |
| `contact-relations` | `activity-triggers` | Anlegen, Bearbeiten und Anrufe protokollieren Aktivitäten automatisch | db | — |
| `contact-relations` | `topics` | Themen verknüpfen, Duplikate sperren und Verwendung zählen | db | — |
| `contact-relations` | `duplicate-scan` | Dubletten-Scan findet Kontakte im eigenen Büro und bleibt mandantengetrennt | db | — |
| `contact-relations` | `bulk-update` | Sammelbearbeitung ändert mehrere Kontakte und protokolliert die Rücknahme | db | — |
| `contact-relations` | `distribution-list` | Verteiler mit Stakeholder und Personen anlegen, prüfen und löschen | db | — |
| `contact-relations` | `stakeholder-flag` | Kartenflag mit Flag-Typ und Koordinaten anlegen, lesen und löschen | db | — |
| `contact-relations` | `briefing-memory` | Briefingwissen je Kontakt anlegen, ändern und löschen | db | — |
| `contact-relations` | `fundings` | Förderung mit Kontaktbeteiligung anlegen und eindeutig halten | db | — |
| `contact-relations` | `secured-read` | Gesicherte Kontaktlesung liefert eigene Daten und keine fremden Büros | db | — |
| `contact-relations` | `merge-links` | Zusammenführen verschiebt Themen und Briefingwissen mit | workflow | — |

## Deklarierter Prüfumfang

### `contact-lifecycle`

Keine Prüfungen deklariert.

### `contact-relations`

1. Der Datenbank-Trigger setzt Rechtsgrundlage und Prüffrist: Bürger 24 Monate ab Erfassung, alle anderen bis 31.03.2031
2. Die reinen Aufbewahrungsregeln (Fristberechnung, Fälligkeit, Regeltext) stimmen mit dem Trigger überein
3. Eine Löschanfrage entsteht ausstehend unter der eigenen Identität; Eigenfreigabe per Update und per approve_gdpr_delete wird abgewiesen, Anfrage und Gegenstand bleiben unverändert
4. Die Vier-Augen-Regel erlaubt nur einer zweiten angemeldeten Person die Freigabe und verlangt deren eingetragenen Zustimmungszeitpunkt
5. Importzuordnung ordnet deutsche und englische Spalten zu und zerlegt die Verteiler-Spalte an ; , und |
6. CSV-Text (Komma und Semikolon) und VCF-Text werden eingelesen, zugeordnet und zu Kontaktwerten mit Anzeigename übersetzt
7. Zeilen ohne Namen und mit ungültiger E-Mail-Adresse werden abgewiesen; eine echte Importzeile legt den Kontakt an und ordnet ihn den Verteilern zu, ohne Mitgliedschaften zu verdoppeln
8. Die Import-Duplikaterkennung findet gleiche E-Mail- oder Telefonnummern und ignoriert unähnliche Kontakte
9. Anlegen, Bearbeiten und ein Anrufprotokoll erzeugen die passenden contact_activities über Trigger
10. Themen werden über contact_topics verknüpft, doppelte Verknüpfungen sind gesperrt und topic_usage zählt Kontakte
11. find_contact_duplicates_trgm findet ein Dublettenpaar im Büro und weist fremde Mandanten ab
12. bulk_update_contact_fields ändert Kategorie und Schlagworte für mehrere Kontakte, protokolliert die Sammelaktion und weist ungültige Eingaben ab
13. undo_contact_bulk_action stellt die vorherigen Werte wieder her (Büroleitung) bzw. wird für Mitglieder abgewiesen
14. Verteilerlisten nehmen mehrere Kontakte auf, doppelte Mitglieder sind gesperrt, das Löschen der Liste entfernt die Mitglieder
15. Ein Stakeholder wird als Organisation angelegt und die zugeordnete Person über assign_contact_to_organization verknüpft
16. Ein Kartenflag wird mit eigenem Flag-Typ und Koordinaten angelegt, mit Typ, Büro und Tags zurückgelesen und wieder gelöscht
17. Briefingwissen wird angelegt, geändert und gelöscht
18. Eine Förderung mit Beteiligung des Kontakts wird angelegt, gelesen und doppelte Beteiligungen sind gesperrt
19. Die gesicherte Kontaktlesung liefert den eigenen Kontakt und keine Zeilen aus fremden Büros
20. Zusammenführen verschiebt Themen und Briefingwissen mit und löscht den Zweitkontakt

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
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/contacts/:id`
- **Frontend-Komponenten:** `src/pages/ContactDetail.tsx`, `src/features/contacts/components/ContactDetailPanel.tsx`, `src/components/contacts/ContactInfoTab.tsx`, `src/components/contacts/ActivityTimeline.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `read_secured_contacts`
- **Tabellen:** `contacts`, `contact_activities`, `contact_topics`, `document_contacts`, `fundings`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/ContactDetail.tsx
- src/features/contacts/components/ContactDetailPanel.tsx

**Bekannte Einschränkungen**

- Gerendert wird das Detail-Sheet nicht; geprüft werden die gesicherte Kontaktlesung und die verknüpften Datenpfade (Aktivitäten, Briefingwissen, Förderungen).

**Offene Prüfpunkte**

- Keine.

### `contacts.import` — Kontakte importieren
Importiert Kontakte aus CSV/XLSX/VCF, erkennt Dubletten und ordnet Spalten samt Verteilern zu.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/contacts-overhaul-proposals.md`

**Nachweise im Quellcode**

- src/pages/ImportContacts.tsx
- src/features/contacts/components/ContactImport.tsx
- src/components/contact-import

**Bekannte Einschränkungen**

- CSV-Text (Komma und Semikolon) und VCF-Text werden eingelesen, Spalten automatisch zugeordnet und Zeilen samt Namen, E-Mail-Prüfung und Verteiler-Spalte zu Kontaktwerten verarbeitet; eine daraus gebaute Zeile wird gespeichert und über denselben Verteilerpfad wie die Oberfläche zugeordnet.
- Der Datei-Dialog selbst, das Excel-/ODS-Einlesen und die Duplikatdialoge der Oberfläche laufen nicht im Selbsttest.

**Offene Prüfpunkte**

- Keine.

### `contacts.duplicates` — Dubletten finden
Findet ähnliche Kontakte über Trigramm-Suche und zeigt Dublettenprüfungen in der Administration.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/contacts/components/DuplicateWarning.tsx
- src/components/administration/DuplicateScanDashboard.tsx

**Bekannte Einschränkungen**

- Der Trigramm-Scan wird mit zwei eigens angelegten Kontakten geprüft; die Trefferqualität für den Bestand bleibt ungemessen.

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
- **Selbsttests:** `contact-lifecycle`, `contact-relations`
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
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/CreateDistributionList.tsx
- src/pages/EditDistributionList.tsx
- src/features/contacts/components/DistributionListForm.tsx

**Bekannte Einschränkungen**

- Geprüft werden Anlegen, Mitglieder, Duplikatsperre und Löschen; die Umwandlung im Stakeholder-Dialog nutzt denselben Schreibpfad, wird aber nicht gerendert.

**Offene Prüfpunkte**

- Keine.

### `contacts.stakeholders` — Stakeholder-Netzwerk
Zeigt Stakeholder auf Karten, verwaltet Kartenflags mit Flag-Typ und Koordinaten, Ebenen und Netzwerk-Tags.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/contacts/components/StakeholderView.tsx
- src/components/contacts/StakeholderNetworkPage.tsx

**Bekannte Einschränkungen**

- Geprüft werden Stakeholder-Organisation, Personenzuordnung, Verteilerbildung sowie ein Kartenflag mit Flag-Typ und Koordinaten (anlegen, lesen, löschen); Kartenebenen (map_layers) und Flag-Themen (map_flag_topics) bleiben ausgeklammert.

**Offene Prüfpunkte**

- Die Trefferheuristik der Netzwerkansicht ist nicht qualitätsgetestet; geprüft wird die Datenbasis, nicht die Darstellung.

### `contacts.tags-topics` — Kontakt-Themen
Vergibt Themen an Kontakte über contact_topics und zeigt sie in Liste, Detail und Bearbeitung; die früheren Tag-Textarrays werden nicht mehr fortgeschrieben.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
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
- Geprüft wird contact_topics samt Zählung; die Themenauswahl im Dialog wird nicht gerendert.

**Offene Prüfpunkte**

- Die Zuordnung über die Oberfläche (TopicPicker) wird nur mittelbar über denselben contact_topics-Schreibpfad geprüft.

### `contacts.privacy` — Kontakt-Datenschutz und Aufbewahrung
Zeigt Datenschutzhinweise, berechnet Aufbewahrungsfristen, verwaltet DSGVO-Löschanträge mit Vier-Augen-Prinzip und maskiert geschützte Kontaktdaten.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/contacts/privacy/ContactPrivacyCard.tsx`
- **Services:** `src/features/contacts/privacy/retention.ts`, `src/features/contacts/privacy/gdprApproval.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `contacts_default_retention`, `read_secured_contacts`, `mask_secured_record`, `mutate_secured_records`, `contacts_secured`, `approve_gdpr_delete`
- **Tabellen:** `contacts`, `gdpr_requests`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/security-function-matrix.md`

**Nachweise im Quellcode**

- src/features/contacts/privacy/ContactPrivacyCard.tsx
- src/features/contacts/privacy/retention.ts
- src/features/contacts/privacy/gdprApproval.ts

**Bekannte Einschränkungen**

- Rechtsgrundlage, Prüffrist und Fälligkeit werden als Regel und über den Datenbank-Trigger geprüft; eine konfigurierte Feldmaskierung (field_permissions) verändert der Selbsttest nicht.
- Löschanfragen werden angelegt und die Eigenfreigabe per Update und approve_gdpr_delete abgewiesen; die positive Freigabe durch eine zweite berechtigte Person verlangt deren persönliche Anmeldung und wird im Selbsttest nur als Regel geprüft.

**Offene Prüfpunkte**

- Keine.

### `contacts.bulk` — Kontakte in Massen bearbeiten
Aktualisiert Felder für viele Kontakte gleichzeitig, protokolliert die Aktion und erlaubt die Rücknahme.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/contacts/BulkActionsToolbar.tsx

**Bekannte Einschränkungen**

- Die Rücknahme verlangt Büroleitung oder Abgeordneten-Mandat; als Mitglied wird nur die Abweisung geprüft.

**Offene Prüfpunkte**

- Keine.

### `contacts.activities` — Kontaktaktivitäten und Anrufe
Protokolliert Anrufe, E-Mails, Treffen und Notizen am Kontakt und zeigt sie im Verlauf.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-lifecycle`, `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/contacts/ActivityTimeline.tsx
- src/components/my-work/CallNoteQuickCapture.tsx

**Bekannte Einschränkungen**

- Geprüft werden die Datenbank-Trigger für Anlegen, Bearbeiten und Anrufprotokolle; die Quick-Capture-Oberflächen werden nicht gerendert.

**Offene Prüfpunkte**

- Keine.

### `contacts.briefing-memory` — Briefingwissen je Kontakt
Merkt sich Gesprächswissen und Vorlieben je Kontakt für Terminbriefings.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useContactBriefingMemory.ts
- src/components/contacts/ContactBriefingMemoryTab.tsx

**Bekannte Einschränkungen**

- Die Leserechte folgen der Profil-Mandantenzuordnung; bei mehreren Büros kann die Sichtbarkeit eingeschränkt sein.

**Offene Prüfpunkte**

- Keine.

### `contacts.fundings` — Finanzierungen und Beteiligungen
Erfasst Finanzierungen, beteiligte Kontakte und Budgetbezüge.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `contact-relations`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useContactFundings.tsx
- src/components/contacts/FundingDialog.tsx

**Bekannte Einschränkungen**

- Geprüft werden Förderung und Beteiligung samt eindeutiger Zuordnung; Budgetbezüge (expense_budgets) bleiben unberührt.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
