# Dokumente, Briefe & Annotationen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/dokumente.json`). Nicht von Hand bearbeiten._

**Zweck:** Dokumente ablegen und versionieren, Briefe im Freigabeworkflow erstellen und archivieren, Annotationen und OCR auf Originalen nutzen.

## Kennzahlen

- Funktionen: **18** in **3** Unterbereichen
- implementiert: **18**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **2**
- ohne Dokumentationsverweis: **14**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `annotations.relocate` Annotationen bei neuer Dateiversion verschieben | Annotationen | fachlich | implementiert | UI | teilweise |
| `annotations.export` Annotationen exportieren | Annotationen | fachlich | implementiert | UI | teilweise |
| `annotations.history` Annotationsverlauf | Annotationen | fachlich | implementiert | UI | Unit-Test |
| `annotations.create` Dokumente annotieren | Annotationen | fachlich | implementiert | UI | Selbsttest |
| `annotations.tasks` Folgeaufgabe aus Annotation | Annotationen | fachlich | implementiert | UI | Selbsttest |
| `annotations.ocr` OCR für gescannte Dokumente | Annotationen | fachlich | implementiert | UI | teilweise |
| `letters.export` Brief als PDF oder DOCX exportieren | Briefe | fachlich | implementiert | UI | Unit-Test |
| `letters.archive` Brief archivieren und Folgeaufgabe anlegen | Briefe | automatisiert | implementiert | systemseitig | Selbsttest |
| `letters.create` Brief erstellen und bearbeiten | Briefe | fachlich | implementiert | rollenabhängig | Unit-Test |
| `letters.workflow` Brief-Freigabeworkflow | Briefe | fachlich | implementiert | rollenabhängig | Selbsttest |
| `letters.collaboration` Brief-Kommentare und Zusammenarbeit | Briefe | fachlich | implementiert | UI | Selbsttest |
| `letters.attachments` Briefanlagen verwalten | Briefe | fachlich | implementiert | UI | Selbsttest |
| `letters.templates` Briefvorlagen und Anlässe | Briefe | administrativ | implementiert | rollenabhängig | kein Test |
| `documents.upload-version` Dokument hochladen und versionieren | Dokumente | fachlich | implementiert | UI | teilweise |
| `documents.details` Dokumentdetails und Verknüpfungen | Dokumente | fachlich | implementiert | UI | teilweise |
| `documents.contacts` Dokumente mit Kontakten verknüpfen | Dokumente | fachlich | implementiert | UI | Selbsttest |
| `documents.email` Dokumente per E-Mail versenden | Dokumente | integration | implementiert | UI | kein Test |
| `documents.list` Dokumentenliste und Suche | Dokumente | fachlich | implementiert | UI | Selbsttest |

## Unterbereiche

- Dokumente
- Annotationen
- Briefe

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `system`, `admin`

## Datenbanktabellen

`case_file_documents`, `contacts`, `document_annotation_events`, `document_annotation_tasks`, `document_annotations`, `document_categories`, `document_contacts`, `document_folders`, `document_topics`, `documents`, `email_logs`, `letter_archive_settings`, `letter_attachments`, `letter_collaborators`, `letter_comments`, `letter_occasions`, `letter_template_assets`, `letter_template_settings`, `letter_templates`, `letter_workflow_history`, `letters`, `sender_information`, `tasks`, `topics`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `case-file-lifecycle` | Fallakte mit Folgetabellen (Container) im Unterschied zum Vorgang | 17 | 10 | — |
| `document-annotation` | Dokument-Annotation | 6 | 14 | — |
| `document-list` | Dokumente: Suche, Kategorien, Sortierung und Auswahl | 0 | 0 | — |
| `letter-lifecycle` | Brief-Lifecycle (Entwurf → Prüfung → Freigabe → Archiv und Folgeaufgabe) | 6 | 4 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `case-file-lifecycle` | `create` | Fallakte anlegen und Standardwerte prüfen | db | — |
| `case-file-lifecycle` | `scale-guard` | Ungültige Akten-Größe wird abgewiesen | db | — |
| `case-file-lifecycle` | `processing-status` | Bearbeitungsstatus setzen und Statusverlauf schreiben | db | — |
| `case-file-lifecycle` | `participants` | Beteiligte eintragen; Doppelung ist gesperrt | db | — |
| `case-file-lifecycle` | `notes-and-timeline` | Notiz und Verlaufseintrag zur Akte speichern | db | — |
| `case-file-lifecycle` | `links-contact-task` | Kontakt verknüpfen und Aufgabe über die Akten-RPC erzeugen | db | — |
| `case-file-lifecycle` | `links-appointment-letter` | Termin und Brief mit der Akte verknüpfen | db | — |
| `case-file-lifecycle` | `upload-document` | Datei in der Akte ablegen und über die Dokumentensuche finden | db | — |
| `case-file-lifecycle` | `document-contact-link` | Dokument mit Kontakt verknüpfen; Doppelung ist gesperrt | db | — |
| `case-file-lifecycle` | `counts` | Akten-RPC zählt die Verknüpfungen | db | — |
| `case-file-lifecycle` | `vorgang-vs-akte` | Unterschied zum Vorgang: eigener Ball, geerbte Sichtbarkeit | db | — |
| `case-file-lifecycle` | `delete-detaches` | Akte löschen: Folgetabellen weg, Vorgang bleibt | db | — |
| `document-annotation` | `search-navigation` | Kommentar, Antwort und Text durchsuchen und Treffer zyklisch anspringen | logic | — |
| `document-annotation` | `ocr-export-version-history` | OCR-Bruchteile, PDF-Exportkoordinaten, Textanker und Verlauf | logic | — |
| `document-annotation` | `multipage-text-selection` | Mehrseitige Textmarkierungen bleiben seitengetreu bearbeitbar | logic | — |
| `document-annotation` | `annotation-task-status` | Aufgabenstatus anzeigen und Anmerkungen bewusst abschließen | logic | — |
| `document-annotation` | `file-kind` | Unterstützte Dateitypen | logic | — |
| `document-annotation` | `fractions` | Koordinaten normalisieren und begrenzen | logic | — |
| `document-annotation` | `polygon` | Polygon benötigt mindestens drei Punkte | logic | — |
| `document-annotation` | `edit-geometry` | Markierungen verschieben, Eckpunkte anpassen und Zoom begrenzen | logic | — |
| `document-annotation` | `annotation-presentation` | Nummern, Filter, Anker und Polygonabschluss | logic | — |
| `document-annotation` | `edit-history` | Bearbeitungen rückgängig und wiederholen, ohne fremde Änderungen zu überschreiben | logic | — |
| `document-annotation` | `arrow-note-shortcuts` | Pfeile, Notiz-Nadeln und Tastaturbelegung | logic | — |
| `document-annotation` | `arrow-pin-anchor` | Pfeilnummer bleibt bei jeder Richtung am Startpunkt | logic | — |
| `document-annotation` | `pdf-text-layer` | PDF-Textmarker ist direkt aktiv und Textschicht erhält ihre Skalierungswerte | logic | — |
| `document-annotation` | `zoom-invariance` | Zoom- und Koordinatentreue bei 25 bis 400 Prozent | logic | — |
| `document-annotation` | `permission-matrix` | Autor, Mitarbeitende, Leitung und fehlende Mitgliedschaft unterscheiden | logic | — |
| `document-annotation` | `mention-link` | Erwähnungen eindeutig auflösen und direkt zum Thread verlinken | logic | — |
| `document-annotation` | `annotation-task-rules` | Zuständigkeit, Mein-Filter und Stafette-Vorgaben | logic | — |
| `document-annotation` | `annotation-task-storage` | Zuweisung und eindeutige Stafette-Aufgabe atomar speichern | workflow | — |
| `document-annotation` | `schema` | Antwortspalte im aktiven Backend vorhanden | db | — |
| `document-annotation` | `server-mentions` | Client und Datenbank erkennen dieselben erwähnten Personen | db | — |
| `document-annotation` | `server-permissions` | Serverrollen, Löschpolicy und aktive Schutz-Trigger prüfen | db | — |
| `document-annotation` | `persistence` | Anlegen → Antworten → Erledigen → Löschen; Rechte prüfen | db | — |
| `document-list` | `filters` | Suche und Kategorie-Chips im aktuellen Ordner kombinieren | logic | — |
| `document-list` | `sort` | Titel und Erstelldatum in beiden Richtungen sortieren | logic | — |
| `document-list` | `selection` | Mehrfachauswahl und Alle auswählen auf sichtbare Dokumente begrenzen | logic | — |
| `letter-lifecycle` | `create-letter` | Briefentwurf mit Empfänger anlegen | db | — |
| `letter-lifecycle` | `invalid-transition` | Direkter Sprung vom Entwurf zu versendet ist verboten | logic | — |
| `letter-lifecycle` | `db-invalid-transition` | Datenbank weist Entwurf → versendet ab | workflow | — |
| `letter-lifecycle` | `attachment` | Echte Anlage hochladen und Inhalt zurücklesen | workflow | — |
| `letter-lifecycle` | `return-targets` | Rückgabeziele folgen dem Freigabemodell | logic | — |
| `letter-lifecycle` | `assign-reviewer` | Aktuelles Konto als Prüfer zuweisen | workflow | — |
| `letter-lifecycle` | `comment-on-passage` | Kommentar mit Textstelle anlegen und als erledigt markieren | workflow | — |
| `letter-lifecycle` | `return-with-reason` | Brief mit Begründung aus der Prüfung zurückgeben | workflow | — |
| `letter-lifecycle` | `resubmit-after-return` | Nach der Rückgabe erneut zur Prüfung einreichen | workflow | — |
| `letter-lifecycle` | `archive` | Versandstatus, Archiv-PDF und Folgeaufgabe über Anwendungsfunktion | workflow | — |
| `letter-lifecycle` | `verify-archive` | Archivdatei und Folgeaufgabe sind tatsächlich vorhanden | db | — |

## Deklarierter Prüfumfang

### `case-file-lifecycle`

1. Fallakte wird mit Typ, Größe, Status und Standard-Sichtbarkeit „private“ angelegt und zurückgelesen
2. Ungültige Größe (case_scale) wird von der Datenbank abgewiesen
3. Bearbeitungsstatus und Statusverlauf werden gespeichert; derselbe Beteiligte kann nicht doppelt eingetragen werden
4. Kontakt, Aufgabe, Termin und Brief werden über die jeweilige Folgetabelle verknüpft; doppelte Verknüpfungen sind gesperrt
5. Das Akten-Dokument lässt sich mit dem Akten-Kontakt verknüpfen; Beziehung und Notiz werden gespeichert, eine Doppelung ist gesperrt
6. Die Aufgabe entsteht über create_case_file_task als offene Aufgabe für die anlegende Person mit source_type 'case_file' und Quellbezug; eine Wiederholung liefert dieselbe Aufgabe und keine zweite Verknüpfung
7. Eine hochgeladene Datei ist mit der Akte verknüpft und über die serverseitige Dokumentensuche auffindbar
8. get_case_files_with_counts liefert die Verknüpfungen der Akte als Zählwerte
9. Ein Vorgang an einer privaten Akte ist für Büro-Kolleginnen unsichtbar, an einer öffentlichen Akte sichtbar (Sichtbarkeitsvererbung)
10. Das Löschen der Akte entfernt ihre Folgetabellen, lässt den Vorgang aber mit case_file_id = null bestehen

### `document-annotation`

1. Mehrseitige Textauswahl
2. Suche und Navigation
3. OCR-Geometrie
4. PDF-Exportkoordinaten
5. Textanker und Änderungsverlauf
6. Dateityp
7. Bruchteil-Koordinaten
8. Polygon-Mindestpunkte
9. Verschieben und Eckpunkte
10. Zoomgrenzen
11. Anlegen, Antworten, Erledigen und Löschen
12. Fremde Autorenschaft und Mandatsgrenzen
13. Serverrollen und aktive RLS/Trigger
14. Erwähnungen mit Thread-Link

### `document-list`

Keine Prüfungen deklariert.

### `letter-lifecycle`

1. Datei hochladen und wieder herunterladen
2. Prüfung und Freigabe über Anwendungsfunktionen
3. Archivfunktion erzeugt PDF, Dokument und Folgeaufgabe
4. Prüferzuordnung und Kommentar mit Textstelle werden gespeichert, erledigt markiert und wieder entfernt

## Funktionsdetails

### `documents.list` — Dokumentenliste und Suche
Durchsucht Titel, Beschreibung und Dateinamen serverseitig über alle Ordner des Büros oder optional im aktuellen Ordner und wendet Kategorien sowie Sortierung vor der Seiteneinteilung an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/documents`
- **Frontend-Komponenten:** `src/features/documents/components/DocumentsView.tsx`
- **Services:** `src/features/documents/documentListModel.ts`, `src/features/documents/documentSearch.ts`
- **Hooks:** `src/components/documents/hooks/useDocumentsData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `documents`, `document_categories`, `document_folders`, `document_contacts`, `document_topics`
- **Abhängigkeiten:** —
- **Selbsttests:** `document-list`, `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/knowledge-validity.md`

**Nachweise im Quellcode**

- src/features/documents/components/DocumentsView.tsx
- src/features/documents/documentListModel.ts
- src/features/selftest/scenarios/document-list.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `documents.details` — Dokumentdetails und Verknüpfungen
Öffnet ein Dokument aus der Liste oder einer Akte und zeigt berechtigte Verweise auf Akten, Kontakte und Aufgaben aus Annotationen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/documents/components/DocumentDetailsDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `documents`, `case_file_documents`, `document_contacts`, `document_annotation_tasks`
- **Abhängigkeiten:** `documents.list`
- **Selbsttests:** `case-file-lifecycle`, `document-annotation`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/documents/components/DocumentDetailsDialog.tsx

**Bekannte Einschränkungen**

- Die Detailansicht selbst (Zählwerte, Vorschau, Sprungziele) hat keinen Schritt. Geprüft sind die Verknüpfungen dahinter: Akten-Dokument, Dokument-Kontakt und die Aufgabenanlage aus einer Anmerkung.

**Offene Prüfpunkte**

- Keine.

### `documents.upload-version` — Dokument hochladen und versionieren
Lädt Dateien hoch, legt Versionen an, verknüpft Themen über document_topics und protokolliert Löschungen nachvollziehbar.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/documents/DocumentDialogs.tsx`, `src/components/topics/TopicPicker.tsx`
- **Services:** `src/components/documents/operationsContract.ts`, `src/features/topics/useEntityTopics.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `update_document_version`, `audit_document_deletion`
- **Tabellen:** `documents`, `document_topics`, `topics`, `document_annotation_events`
- **Abhängigkeiten:** —
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/documents/DocumentDialogs.tsx
- src/components/documents/operationsContract.ts

**Bekannte Einschränkungen**

- Hochladen samt Ablage, Suche und Aktenverknüpfung ist geprüft; eine zweite Dateiversion und die Versionskennzeichnung haben keinen Schritt.

**Offene Prüfpunkte**

- Keine.

### `documents.contacts` — Dokumente mit Kontakten verknüpfen
Ordnet Dokumente Kontakten zu und zeigt sie im Kontaktprofil.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/documents/DocumentContactManager.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useContactDocuments.tsx`, `src/hooks/useDocumentContacts.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `document_contacts`, `documents`, `contacts`
- **Abhängigkeiten:** `contacts.create`
- **Selbsttests:** `case-file-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/documents/DocumentContactManager.tsx
- src/hooks/useContactDocuments.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `documents.email` — Dokumente per E-Mail versenden
Versendet Dokumente als E-Mail-Anhang über eine Edge Function und protokolliert den Versand.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-document-email`
- **Datenbankfunktionen:** —
- **Tabellen:** `email_logs`, `documents`
- **Abhängigkeiten:** `documents.upload-version`, `integration.email`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/send-document-email/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `annotations.create` — Dokumente annotieren
Setzt Markierungen, Hervorhebungen und Kommentare auf PDF- und Bildseiten in relativen Koordinaten, ohne Originale zu verändern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/annotations/components`
- **Services:** —
- **Hooks:** `src/features/annotations/useAnnotations.ts`, `src/features/annotations/useAnnotationMembers.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `document_annotations_validate`, `document_annotations_guard_edit`, `document_annotations_permissions_selftest`, `document_annotation_assignment_guard`, `document_annotation_can_manage`, `document_annotation_mention_ids`, `document_annotation_mention_members`, `document_annotation_mentions`, `document_annotation_reply_guard`
- **Tabellen:** `document_annotations`, `documents`
- **Abhängigkeiten:** `documents.upload-version`
- **Selbsttests:** `document-annotation`
- **Unit-Tests:** `src/features/annotations/annotationModel.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/dangerouslysetinnerhtml-inventory.md`

**Nachweise im Quellcode**

- src/features/annotations/annotationModel.ts
- src/features/annotations/useAnnotations.ts
- src/features/selftest/scenarios/document-annotation.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `annotations.history` — Annotationsverlauf
Führt einen ausschließlich per Trigger geschriebenen, für Clients lesenden Verlauf aller Annotationsänderungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/annotations/annotationHistory.ts`
- **Hooks:** `src/features/annotations/useAnnotationHistory.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `record_document_annotation_event`
- **Tabellen:** `document_annotation_events`, `document_annotations`
- **Abhängigkeiten:** `annotations.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/annotations/annotationModel.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/annotations/annotationHistory.ts
- src/features/annotations/useAnnotationHistory.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `annotations.tasks` — Folgeaufgabe aus Annotation
Erzeugt atomar eine Stafette-Aufgabe aus einer Annotation und hält die Verknüpfung unveränderlich.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/annotations/taskModel.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_document_annotation_task`, `document_annotation_task_selftest`
- **Tabellen:** `document_annotation_tasks`, `document_annotations`, `tasks`
- **Abhängigkeiten:** `tasks.create`, `annotations.create`
- **Selbsttests:** `document-annotation`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/annotations/taskModel.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `annotations.ocr` — OCR für gescannte Dokumente
Erkennt Text lokal über selbst gehostete Tesseract-Assets und erlaubt das Anlegen von Textmarkierungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/annotations/ocrModel.ts`
- **Hooks:** `src/features/annotations/useAnnotationOcr.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `documents`, `document_annotations`
- **Abhängigkeiten:** `documents.upload-version`
- **Selbsttests:** `document-annotation`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/annotations/ocrModel.ts
- src/features/annotations/useAnnotationOcr.ts
- scripts/viteAnnotationOcr.ts

**Bekannte Einschränkungen**

- Der Schritt prüft nur die Umrechnung der OCR-Bruchteile (Pixel → Seitenanteile), das Verwerfen leerer Wörter und die Textanker. Die lokale Tesseract-Erkennung mit Worker und Sprachpaketen läuft nicht; Trefferqualität und Textauswahl bleiben offen.
- OCR-Qualität hängt vom Scan ab; ein automatisierter Qualitätstest existiert nicht.

**Offene Prüfpunkte**

- Keine.

### `annotations.export` — Annotationen exportieren
Exportiert annotierte Dokumente als separate PDF-Kopie, ohne das Original zu verändern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/annotations/exportModel.ts`, `src/features/annotations/exportPdf.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `documents`, `document_annotations`
- **Abhängigkeiten:** `annotations.create`
- **Selbsttests:** `document-annotation`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/annotations/exportModel.ts
- src/features/annotations/exportPdf.ts
- src/lib/pdfjs.ts

**Bekannte Einschränkungen**

- Die Exportkoordinaten sind als Regel geprüft; das erzeugte PDF und seine Darstellung nicht. Die Originaldatei bleibt unverändert, weil der Export eine eigene Kopie erzeugt.

**Offene Prüfpunkte**

- Keine.

### `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
Schlägt bei geänderter Dateiversion einen eindeutigen Textanker vor und verlangt eine ausdrückliche Bestätigung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/annotations/relocateText.ts`, `src/features/annotations/textAnchors.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `document_annotations`, `documents`
- **Abhängigkeiten:** `annotations.create`, `documents.upload-version`
- **Selbsttests:** `document-annotation`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/annotations/relocateText.ts
- src/features/annotations/textAnchors.ts

**Bekannte Einschränkungen**

- Der eindeutige Textanker ist als Regel geprüft; das Anbieten und Bestätigen einer Verschiebung nach neuer Dateiversion hat keinen Datenbankschritt.

**Offene Prüfpunkte**

- Keine.

### `letters.create` — Brief erstellen und bearbeiten
Erstellt Briefe im Lexical-Editor mit DIN-5008-Layout, direkt auf dem Blatt beschreibbarem Briefkopf (Empfänger, Betreff, Anrede), Adressen, Vorlagen und Anlagen; die Blattvorschau setzt den Fließtext auf das gespeicherte Zeilenraster (layout.content.lineHeight) und denselben Absatzabstand wie der PDF-Export und paginiert ohne leere Folgeseite. Speichern schreibt den Brief und lässt den Editor offen; Schließen und Verwerfen sind eigene Aktionen, die bei ungespeicherten Änderungen nachfragen. Auch das Verlassen der Briefseite (Browser-Zurück, interne Links, Reload) ist bei ungespeicherten Änderungen abgesichert.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/letters/:letterId`
- **Frontend-Komponenten:** `src/pages/LetterDetail.tsx`, `src/features/letters/useUnsavedChangesGuard.ts`, `src/features/letters/components/LetterEditor.tsx`, `src/components/letters/LetterEditorCanvas.tsx`, `src/components/letters/DIN5008LetterLayout.tsx`, `src/components/letters/InlineEditableText.tsx`, `src/components/letters/DIN5008AddressInfoSection.tsx`, `src/components/letters/din5008/headerMetrics.ts`, `src/components/letters/din5008/pagination.ts`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `letters`, `letter_template_settings`, `letter_attachments`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/letters/components/__tests__/LetterEditorClose.test.tsx`, `src/features/letters/__tests__/useUnsavedChangesGuard.test.tsx`, `src/components/letters/__tests__/types.test.ts`, `src/components/letters/din5008/headerMetrics.test.ts`, `src/components/letters/din5008/pagination.test.ts`, `src/components/letters/hooks/useLetterOperations.integration.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/workflow-consistency.md`

**Nachweise im Quellcode**

- src/features/letters/components/LetterEditor.tsx
- src/pages/LetterDetail.tsx
- src/components/letters/LetterEditorCanvas.tsx

**Bekannte Einschränkungen**

- Der Dirty-Guard vergleicht den geladenen Stand mit einem Snapshot der Editor-Felder; Änderungen außerhalb des Editors (z. B. Revisionsfelder) lösen keine Rückfrage aus.
- Nach dem Speichern wird der gespeicherte Stand zur neuen Vergleichsbasis, sonst würde jede Schließung nachfragen.

**Offene Prüfpunkte**

- Keine.

### `letters.workflow` — Brief-Freigabeworkflow
Führt Briefe durch Entwurf, Prüfung, Freigabe und Versand, protokolliert Statuswechsel und verhindert falsche Erfolgsmeldungen. Eine Rückgabe speichert Begründung, Prüfer und Zeitpunkt am Brief und benachrichtigt den Ersteller.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/services/letterWorkflow.ts`
- **Hooks:** —
- **Edge Functions:** `archive-letter`
- **Datenbankfunktionen:** `handle_letter_status_change`, `log_letter_workflow_change`, `return_letter_for_revision`, `guard_letter_return_transition`
- **Tabellen:** `letters`, `letter_workflow_history`, `letter_archive_settings`, `documents`
- **Abhängigkeiten:** `letters.create`
- **Selbsttests:** `letter-lifecycle`
- **Unit-Tests:** `src/services/letterWorkflow.test.ts`
- **Integrationstests:** `src/components/letters/hooks/useLetterOperations.integration.test.tsx`
- **Browser-Tests:** —
- **Dokumentation:** `docs/workflow-consistency.md`, `docs/selftest-center.md`

**Nachweise im Quellcode**

- src/services/letterWorkflow.ts
- src/features/selftest/scenarios/letter-lifecycle.ts
- supabase/functions/archive-letter/index.ts

**Bekannte Einschränkungen**

- Die Statusmenge ist geschlossen (draft, review, pending_approval, approved, revision_requested, sent, archived); der CHECK-Constraint letters_status_check und der Client lehnen andere Werte ab.
- Die erlaubten Wechsel prüft der Trigger enforce_letter_status_transition gegen letter_status_transitions; Quelle ist ALLOWED_TRANSITIONS, beide werden von check:state-artifact abgeglichen. Ein direkter Sprung wie draft → sent wird abgewiesen. Neuanlagen prüft weiterhin nur die Wertemenge.
- Rückgaben laufen ausschließlich über das RPC return_letter_for_revision (SECURITY DEFINER): Es prüft Anmeldung, aktive Mandantzugehörigkeit und die Prüferzuordnung in letter_collaborators, setzt Status und Revisionsfelder in einem Schritt und benachrichtigt den Ersteller. Der Guard-Trigger guard_letter_return_transition weist direkte Statuswechsel review → draft bzw. pending_approval → revision_requested ohne das transaktionslokale Merkmal ab.

**Offene Prüfpunkte**

- Keine.

### `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
Erzeugt beim Versand ein PDF-Archivdokument, verknüpft es und sichert die Folgeaufgabe: Die Archivfunktion legt keine eigene Aufgabe mehr an, sondern ermittelt die des Briefes über das RPC create_letter_archive_follow_up_task, das sie nur anlegt, wenn keine existiert.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useLetterArchiving.tsx`
- **Edge Functions:** `archive-letter`
- **Datenbankfunktionen:** `create_letter_followup_task`, `create_letter_archive_follow_up_task`
- **Tabellen:** `letters`, `documents`, `letter_attachments`, `tasks`
- **Abhängigkeiten:** `letters.workflow`, `tasks.create`
- **Selbsttests:** `letter-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useLetterArchiving.tsx
- supabase/functions/archive-letter/index.ts
- src/components/letters/ArchivedLetterDetails.tsx

**Bekannte Einschränkungen**

- Die Folgeaufgabe hat genau einen Erzeuger: den Trigger trigger_letter_followup_task beim Wechsel auf sent. Die Archivfunktion erzeugt keine zweite Aufgabe, sondern liefert die bestehende ID über create_letter_archive_follow_up_task; ein Fehler dabei wird als followUpTaskError gemeldet, ohne den abgeschlossenen Versand abzubrechen. Der Client zieht die Aufgabe nur nach, wenn die Funktion keine ID liefert. Trigger und RPC verknüpfen die Aufgabe über source_type letter_followup und source_id des Briefes; der zusammengebaute Titel dient nur noch dem Altbestand und wird dabei in die Verknüpfung überführt.

**Offene Prüfpunkte**

- Keine.

### `letters.templates` — Briefvorlagen und Anlässe
Verwaltet Briefvorlagen und Briefanlässe in zwei Reitern einer gemeinsamen Administrationsseite. Absenderdaten und Textbausteine bleiben Teil der Briefverwaltung.

- **Kategorie:** administrativ
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/letters/components/LetterTemplateManager.tsx`, `src/components/letters/LetterTemplateIntegration.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `letter_templates`, `letter_occasions`, `letter_template_assets`, `letter_template_settings`, `sender_information`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/letters/components/LetterTemplateManager.tsx
- src/components/administration/LetterOccasionManager.tsx
- src/components/administration/SenderInformationManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `letters.export` — Brief als PDF oder DOCX exportieren
Erzeugt PDF- und DOCX-Ausgaben aus dem Editorinhalt inklusive Layout und Anlagen; Betreff, Anrede und Fließtext folgen derselben DIN-Berechnung wie die Vorschau: Briefkopf und Fließtext werden mit einer eingebetteten Carlito-Teilmenge gesetzt, und Zeilenraster (layout.content.lineHeight) sowie Absatzabstand gelten in Vorschau und Export identisch, damit die Seitenumbrüche übereinstimmen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/letters/components/LetterPDFExport.tsx`, `src/features/letters/components/LetterDOCXExport.tsx`, `src/components/letter-pdf`, `src/components/letter-pdf/carlitoFont.ts`, `src/components/letters/din5008/headerMetrics.ts`, `src/components/letters/din5008/pagination.ts`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `letters`
- **Abhängigkeiten:** `letters.create`
- **Selbsttests:** —
- **Unit-Tests:** `src/components/letter-pdf/carlitoFont.test.ts`, `src/components/letters/din5008/headerMetrics.test.ts`, `src/components/letters/din5008/pagination.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/letters/components/LetterPDFExport.tsx
- src/features/letters/components/LetterDOCXExport.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
Erlaubt Kommentare, Mitwirkende und Zugriffsschutz für gemeinsam bearbeitete Briefe.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/letters/LetterCommentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `can_access_letter_for_collaboration`, `letters_secured`
- **Tabellen:** `letter_comments`, `letter_collaborators`, `letters`
- **Abhängigkeiten:** `letters.create`
- **Selbsttests:** `letter-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/letters/LetterCommentDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `letters.attachments` — Briefanlagen verwalten
Fügt Anlagen hinzu, entfernt sie und hält sie beim Archivieren am Dokument.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/letters/LetterAttachmentManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `letter_attachments`, `letters`
- **Abhängigkeiten:** `letters.create`
- **Selbsttests:** `letter-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/letters/LetterAttachmentManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
