# Prüfbericht des Funktionskatalogs

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Dieser Bericht trennt **eindeutig nachweisbare Inkonsistenzen** von **heuristischen Prüfkandidaten**. Nur erstere lassen `check:feature-catalog` fehlschlagen; Kandidaten erzeugen Review-Hinweise.

## Ergebnis des letzten Katalogprüflaufs

Eindeutige Fehler werden im CI-Lauf ausgegeben und brechen die Prüfung ab; sie werden hier nicht dupliziert. Dieser Bericht listet die verbleibenden Review-Hinweise und Prüfkandidaten.

- Review-Hinweise: **1**
- Nicht zugeordnete Objekte: **2**, davon ohne Ausnahme: **1**

### Review-Hinweise

- Prüfkandidat ohne Funktionszuordnung (rpc): rename_config_item_unprotected

## Funktionen ohne zugeordneten Test (121)

- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `mywork.navigation-previews` — Vorschauen für Kalender, Aufgaben, Akten, Chat und Kontakte
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `mobile.app` — Mobile App (Expo)
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `automation.conditions` — Regelbedingungen und Feldtypen
- `automation.rule-validation` — Regelvalidierung im Editor
- `automation.rule-versions` — Regelversionen und Import/Export
- `automation.runs` — Regelläufe und Fehlerdashboard
- `automation.routine-packages` — Dauerhafte Routineabläufe
- `automation.task-packages` — Aufgabenpakete
- `automation.scheduler` — Zeitgesteuerte Automatisierung
- `automation.webhooks` — Automatisierungs-Webhooks
- `automation.templates` — Automatisierungs-Vorlagen
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
- `letters.attachments` — Briefanlagen verwalten
- `decisions.change-vote` — Antwort ändern und Verlauf einsehen
- `decisions.comments` — Kommentare und Reaktionen
- `decisions.attachments` — Anhänge an Entscheidungen
- `decisions.remind` — Offene Entscheidungen anmahnen
- `decisions.archive` — Entscheidungen archivieren
- `decisions.email` — Entscheidungs-E-Mails
- `decisions.matrix` — Entscheidungen über Matrix beantworten
- `redaktion.planner` — Social-Media-Planung
- `redaktion.approval` — Social-Media-Freigabe
- `redaktion.assets-campaigns` — Social-Assets und Kampagnen
- `redaktion.themenspeicher` — Themenspeicher und Hashtags
- `redaktion.calendar-reminders` — Redaktionskalender und Erinnerungen
- `press.releases` — Pressemitteilungen erstellen und freigeben
- `press.ghost` — Pressemitteilung nach Ghost veröffentlichen
- `news.articles` — News-Artikel und Lesestatus
- `news.email` — News per E-Mail versenden
- `chat.messages` — Interner Chat über Matrix
- `news.matrix` — News über Matrix verteilen
- `chat.matrix-bot` — Matrix-Bot und morgendliche Begrüßung
- `chat.team-announcements` — Team-Ankündigungen
- `widget.matrix-website` — Matrix-Website-Widget
- `employees.requests` — Gesprächsanfragen der Mitarbeitenden
- `employees.export-stats` — Gesprächs-PDF und Jahresstatistik
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.admin` — Zeiterfassung administrieren
- `meetings.templates` — Sitzungsvorlagen
- `meetings.zombie-points` — Liegengebliebene Agenda-Punkte
- `dossiers.manage` — Dossier anlegen und führen
- `dossiers.entries` — Dossier-Einträge und Timeline
- `dossiers.links-stakeholders` — Dossier-Verknüpfungen und Stakeholder
- `dossiers.talking-points` — Talking Points und Positionsversionen
- `dossiers.capture-radar` — Schnellerfassung und Mein Radar
- `dossiers.sources` — Dossier-Quellenbeobachtung
- `dossiers.search` — Globale Dossier-Suche
- `drucksachen.view` — Drucksachen anzeigen
- `topics.convert-catalog` — Thema in Katalog überführen
- `facts.manage` — Fakten und Argumente pflegen
- `integration.calendar-sync` — Externe Kalender synchronisieren
- `integration.push` — Push-Benachrichtigungen
- `integration.geocoding` — Adress-Geocoding
- `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
- `integration.transcription` — Sprachaufnahme transkribieren
- `integration.unsplash` — Bildsuche für Beiträge
- `integration.egress-monitoring` — Egress-Überwachung
- `calendar.edit-move` — Termin bearbeiten und verschieben
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `calendar.reminders` — Terminerinnerungen
- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `appointments.feedback` — Termin-Feedback erfassen
- `appointments.preparation` — Terminvorbereitung mit Vorschlägen
- `calendar.categories-locations` — Terminkategorien und -orte pflegen
- `calendar.holidays` — Feiertage synchronisieren
- `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
- `events.invitations` — Veranstaltungseinladungen versenden
- `events.legacy-rsvp` — Legacy-Einladungslinks
- `admin.feature-flags` — Feature Flags
- `admin.audit-log` — Audit-Trail einsehen und exportieren
- `admin.bulk-audit` — Massenaktions-Audit
- `admin.gdpr` — DSGVO-Löschanträge
- `admin.edge-function-security` — Edge-Function-Sicherheitsklassifikation
- `admin.data-lint` — Datenqualitätsprüfung
- `admin.performance` — Performance- und Größen-Dashboard
- `admin.tenants` — Mandantenverwaltung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.configuration` — Konfigurierbare Stammdaten pflegen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.templates-senders` — Administrative Vorlagen und Absenderdaten
- `admin.maintenance` — Wartungs- und Aufräumläufe
- `platform.notification-dispatch` — Benachrichtigungs- und Audit-Trigger
- `cases.interactions` — Kontakte und Interaktionen am Vorgang
- `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
- `cases.escalation` — Eskalationsvorschläge
- `cases.legacy-routes` — Legacy-Vorgangsrouten
- `election.analysis-map` — Analyse-Karten und Wahlkreiszuschnitt
- `election.turnout` — Wahlbeteiligung
- `election.seat-distribution` — Sitzverteilung und Hemizykel
- `election.research-workbench` — Analyse-Workbench und Kommunalpanel
- `election.districts-import` — Wahlkreise und Gebiete importieren
- `election.representatives` — Abgeordnete und Parteiassoziationen importieren
- `election.history.state-lists` — Landeslisten verwalten
- `election.history.factions` — Historische Fraktionen
- `election.history.audit` — Wahlhistorien-Audit
- `election.history.assembly` — Historien-Assemblierung
- `election.history.districts-geometry` — Historische Wahlkreise und Geometrie
- `election.parliament-protocols` — Plenarprotokolle auswerten
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
- `knowledge.management` — Wissensverwaltung

## Funktionen ohne Dokumentationsverweis (168)

- `mywork.dashboard.today-priorities` — Heute zuerst
- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `mywork.navigation-previews` — Vorschauen für Kalender, Aufgaben, Akten, Chat und Kontakte
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
- `quicknotes.checklists` — Checklisten in Schnellnotizen
- `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
- `profile.edit` — Eigenes Profil bearbeiten
- `tasks.edit` — Aufgabe bearbeiten
- `tasks.assign` — Aufgabe zuweisen
- `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-case` — Aufgabe mit Vorgang verknüpfen
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `automation.rule-validation` — Regelvalidierung im Editor
- `automation.rule-versions` — Regelversionen und Import/Export
- `automation.runs` — Regelläufe und Fehlerdashboard
- `automation.annual-routines` — Jahresroutinen verwalten
- `automation.office-packages` — Saisonale Büropakete
- `automation.task-packages` — Aufgabenpakete
- `automation.templates` — Automatisierungs-Vorlagen
- `automation.calendar-schedule` — Kalenderbezogene Zeitberechnung
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.history` — Annotationsverlauf
- `annotations.tasks` — Folgeaufgabe aus Annotation
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.export` — Brief als PDF oder DOCX exportieren
- `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
- `letters.attachments` — Briefanlagen verwalten
- `decisions.participants` — Teilnehmende und Antwort-Token verwalten
- `decisions.vote` — Abstimmen
- `decisions.change-vote` — Antwort ändern und Verlauf einsehen
- `decisions.attachments` — Anhänge an Entscheidungen
- `decisions.remind` — Offene Entscheidungen anmahnen
- `decisions.archive` — Entscheidungen archivieren
- `decisions.email` — Entscheidungs-E-Mails
- `decisions.matrix` — Entscheidungen über Matrix beantworten
- `redaktion.approval` — Social-Media-Freigabe
- `redaktion.assets-campaigns` — Social-Assets und Kampagnen
- `redaktion.themenspeicher` — Themenspeicher und Hashtags
- `redaktion.calendar-reminders` — Redaktionskalender und Erinnerungen
- `press.releases` — Pressemitteilungen erstellen und freigeben
- `news.articles` — News-Artikel und Lesestatus
- `news.email` — News per E-Mail versenden
- `chat.messages` — Interner Chat über Matrix
- `chat.matrix-bot` — Matrix-Bot und morgendliche Begrüßung
- `chat.team-announcements` — Team-Ankündigungen
- `contacts.edit` — Kontakt bearbeiten
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.duplicates` — Dubletten finden
- `contacts.distribution-lists` — Verteilerlisten verwalten
- `contacts.stakeholders` — Stakeholder-Netzwerk
- `contacts.tags-topics` — Kontakt-Themen
- `contacts.bulk` — Kontakte in Massen bearbeiten
- `contacts.activities` — Kontaktaktivitäten und Anrufe
- `contacts.briefing-memory` — Briefingwissen je Kontakt
- `contacts.fundings` — Finanzierungen und Beteiligungen
- `employees.action-tasks` — Maßnahmen als Aufgaben
- `employees.review` — Vorgesprächs-Review
- `employees.wellbeing` — Wohlbefinden und Trends
- `employees.requests` — Gesprächsanfragen der Mitarbeitenden
- `employees.export-stats` — Gesprächs-PDF und Jahresstatistik
- `hr.templates` — HR-Vorlagen und DSGVO-Erklärung
- `hr.offboarding` — Offboarding mit Übergaben
- `responsibilities.matrix` — Zuständigkeitsmatrix
- `responsibilities.suggest` — Zuständigkeitsvorschläge
- `responsibilities.coverage` — Abdeckungsprüfung
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.vacation` — Urlaub und Resturlaub
- `timetracking.admin` — Zeiterfassung administrieren
- `timetracking.annual-tasks` — Jahresaufgaben im Zeitbereich
- `meetings.agenda` — Agenda führen
- `meetings.protocol` — Sitzungsprotokoll
- `meetings.decisions` — Sitzungsentscheidungen dokumentieren
- `meetings.archive` — Sitzung archivieren
- `meetings.templates` — Sitzungsvorlagen
- `meetings.zombie-points` — Liegengebliebene Agenda-Punkte
- `dossiers.entries` — Dossier-Einträge und Timeline
- `dossiers.links-stakeholders` — Dossier-Verknüpfungen und Stakeholder
- `dossiers.talking-points` — Talking Points und Positionsversionen
- `dossiers.capture-radar` — Schnellerfassung und Mein Radar
- `dossiers.sources` — Dossier-Quellenbeobachtung
- `dossiers.search` — Globale Dossier-Suche
- `drucksachen.view` — Drucksachen anzeigen
- `topics.manage` — Themen verwalten
- `facts.manage` — Fakten und Argumente pflegen
- `integration.email` — Transaktions-E-Mail-Versand
- `integration.geocoding` — Adress-Geocoding
- `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
- `integration.transcription` — Sprachaufnahme transkribieren
- `integration.unsplash` — Bildsuche für Beiträge
- `calendar.create-appointment` — Termin anlegen
- `calendar.edit-move` — Termin bearbeiten und verschieben
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `calendar.invitations` — Termineinladungen und Kalendereinträge versenden
- `appointments.briefing-live` — Live-Briefing und Nachbereitung
- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `appointments.feedback` — Termin-Feedback erfassen
- `appointments.preparation` — Terminvorbereitung mit Vorschlägen
- `calendar.categories-locations` — Terminkategorien und -orte pflegen
- `calendar.polls` — Terminumfrage erstellen
- `calendar.holidays` — Feiertage synchronisieren
- `events.checklist` — Veranstaltungs-Checkliste und Aufgaben
- `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
- `events.legacy-rsvp` — Legacy-Einladungslinks
- `polls.respond` — An Umfrage teilnehmen
- `polls.manage` — Umfragen verwalten und auswerten
- `polls.availability` — Verfügbarkeit und Zeitfenster
- `admin.feature-flags` — Feature Flags
- `admin.action-permissions` — Aktionsberechtigungen
- `admin.bulk-audit` — Massenaktions-Audit
- `admin.data-lint` — Datenqualitätsprüfung
- `admin.configuration` — Konfigurierbare Stammdaten pflegen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.templates-senders` — Administrative Vorlagen und Absenderdaten
- `admin.maintenance` — Wartungs- und Aufräumläufe
- `platform.notification-dispatch` — Benachrichtigungs- und Audit-Trigger
- `cases.steps` — Vorgangsschritte und Aufgaben
- `cases.timeline` — Vorgangs-Timeline und Änderungsprotokoll
- `cases.link-appointment` — Vorgang mit Termin verknüpfen
- `cases.link-letter` — Vorgang mit Brief verknüpfen
- `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
- `cases.escalation` — Eskalationsvorschläge
- `cases.close-archive` — Vorgang abschließen und archivieren
- `cases.legacy-routes` — Legacy-Vorgangsrouten
- `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
- `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
- `casefiles.document-upload` — Datei aus der Akte ablegen
- `casefiles.notes` — Fallakten-Notizen
- `parlis.proceedings` — Parlamentarische Vorgänge auswerten
- `election.analysis-navigation` — Analyse-Navigation und gespeicherte Szenarien
- `election.turnout` — Wahlbeteiligung
- `election.seat-distribution` — Sitzverteilung und Hemizykel
- `election.deputy-results` — Abgeordneten- und Kandidatenergebnisse
- `election.state-history` — Landesweite Zeitreihen
- `election.districts-import` — Wahlkreise und Gebiete importieren
- `election.representatives` — Abgeordnete und Parteiassoziationen importieren
- `election.history.mandates` — Historische Mandate pflegen
- `election.history.candidacies` — Kandidaturen und Ergebnisse pflegen
- `election.history.people` — Personenregister und Karrieren
- `election.history.state-lists` — Landeslisten verwalten
- `election.history.factions` — Historische Fraktionen
- `election.history.quality` — Wahlhistorien-Datenqualität
- `election.history.audit` — Wahlhistorien-Audit
- `election.history.assembly` — Historien-Assemblierung
- `knowledge.answer` — Frage beantworten
- `knowledge.short-answer` — Kurzantwort neben der Langantwort
- `knowledge.tags` — Themenzuordnung im Wissen
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.search` — Wissenssuche
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.persons` — Wissenspersonen und Zuständigkeit
- `knowledge.management` — Wissensverwaltung

## Nicht nachweisbar eingebundene Funktionen (1)

- `mobile.app` — Mobile App (Expo) (ohne-einbindung)

## Potenziell verwaiste oder unklare Funktionen (0)

- Keine.

## Deaktivierte, veraltete und entfernte Funktionen (2)

- `events.legacy-rsvp` — Legacy-Einladungslinks (veraltet)
- `cases.legacy-routes` — Legacy-Vorgangsrouten (veraltet)

## Funktionen mit Einschränkungen oder offenen Punkten (86)

### `mywork.dashboard`

- Kein Szenario prüft die Dashboard-Aggregation selbst; die Zuordnung stützt sich auf die dort erzeugten Datensätze.

### `mywork.dashboard.today-priorities`

- Der Selbsttest prüft die Reihenfolge und die Berliner Tagesgrenzen. Die Dialoge verwenden die vorhandenen Aktionen.

### `mywork.tabs`

- Die Tab-Auswahl ist eine reine UI-Präferenz und hat keine eigene Geschäftsregel.

### `mywork.navigation-previews`

- In der Desktop-Navigation per Maus oder Pfeil nach rechts verfügbar. Die Terminvorschau blickt fünf Tage voraus und die Aktenvorschau berücksichtigt eigene oder zugewiesene Fallakten.
- Chat-Hervorhebungen stammen von Matrix. Die Vorschau zeigt Raumnamen und Zähler. Der zuletzt geöffnete Chat wird für die aktuelle Sitzung gemerkt.
- Ohne Kontakt am nächsten Termin oder in der jüngsten eigenen oder zugewiesenen Fallakte wird ein eigener Favorit angezeigt.

### `notifications.inbox`

- Benachrichtigungen entstehen über viele Datenbank-Trigger; die Zuordnung ist bereichsübergreifend und nicht vollständig je Trigger geprüft.

### `search.global`

- Die Suche nutzt PostgREST-Abfragen je Entität; eine vollständige Liste der durchsuchten Tabellen ist nicht zentral deklariert.

### `quicknotes.manage`

- Das Szenario prüft den Lebenszyklus, nicht jede Teilen-Variante.

### `quicknotes.offline`

- Offline-Verhalten ist nur über Unit-Tests belegt; ein echter Browser-Offline-Test existiert nicht.

### `platform.auth`

- Der Login ist in den Browser-Smokes öffentlich geprüft, aber ohne echtes Testkonto nicht erfolgreich durchlaufen.

### `mobile.app`

- Der Funktionsumfang der Mobile-App wurde nicht zeilenweise inventarisiert; die Web-Plattform ist die Referenz.
- Mobile-Bildschirme und -Aktionen sind als eigener Bereich noch nicht im Detail katalogisiert.

### `tasks.create`

- Das Szenario deckt den Standardpfad ab, nicht jede Feldkombination.

### `tasks.edit`

- Ein Statuswechsel ist nur auf einen Namen aus der konfigurierbaren Liste task_statuses möglich; der Trigger enforce_task_status lehnt andere Werte ab. Der frühere Bindestrich-Wert ist migriert und wird nicht mehr geschrieben. Die technischen Namen der Kernstatus (todo, in_progress, completed, cancelled, review) sind gegen Umbenennen und Löschen geschützt, weil Spalten-Default, Client und Datenbankfunktionen sie direkt schreiben; ändern lässt sich der Anzeigename. Fehlte ein Kernstatus, stellt die Migration 20261126130000 ihn wieder her.

### `tasks.assign`

- Die positive Vertretungsübergabe läuft nur, wenn die gewählte Vertretung keine eigenen offenen Aufgaben hat; sonst prüft der Selbsttest ausschließlich die Selbstübergabe-Sperre, damit keine fremden Bälle verschoben werden.
- Die Regel, wer wem zuweisen darf, liegt teils in RLS und teils im Code; sie ist hier nicht vollständig rekonstruiert.

### `tasks.ball-owner`

- Die Zonenregel ist im Selbsttest als Logic-Step und über die Stafette-RPCs geprüft; die Anzeige in allen Listen ist nicht durchgängig geprüft.

### `tasks.deadline`

- Der Step prüft Gruppierung und Verwerfen/Rückgängig; Widget-Darstellung und der stündliche Erinnerungsversand werden nicht ausgelöst.

### `tasks.snooze`

- Der Selbsttest prüft die task_snoozes-Zeile samt Zielregel und das Aufräumen beim Archivieren; das Verschieben der Frist im Dashboard deckt nur der Unit-Test ab.
- Ob Rückstellungen fachlich als Wiedervorlage oder nur als Anzeige-Unterdrückung gelten, ist im Code nicht abschließend dokumentiert.

### `tasks.subtasks`

- Der Step prüft die Aufgaben-basierten Unteraufgaben (parent_task_id); die ältere Tabelle subtasks wird von der Oberfläche nicht gelesen.
- Die Unteraufgaben-Oberfläche wurde nicht im Browser geprüft; der Nachweis stützt sich auf Komponenten und Tabelle.

### `tasks.link-document`

- Der Selbsttest prüft die Datenbank-Verknüpfung, nicht den Upload in den Storage-Bucket.

### `tasks.recurring`

- Der Selbsttest löst den Trigger über einen Statuswechsel aus und vergleicht die Folgeffrist mit der reinen Regel; die Anzeige im Browser ist nicht geprüft.

### `tasks.archive`

- Der Selbsttest archiviert eine Aufgabe samt Wiedervorlage, prüft die Fremdarchivierungssperre und stellt sie zurück; die Archivansicht selbst ist nicht im Browser geprüft.

### `tasks.search-filter`

- Die Filterlogik liegt in der Ansicht; eine eigene getestete Regeldatei existiert nicht.

### `tasks.nudge`

- Der Selbsttest prüft die 24-Stunden-Sperre, die Quittung mit Verlaufseintrag und die Zugriffssperre der RPCs; der stündliche Cron-Versand, escalate_task und task_approval_sla werden nicht ausgelöst.
- Der Cron-Versand ist nicht in dieser Umgebung ausgeführt worden.

### `automation.routine-packages`

- Der Fortschrittsdienst ist als Datenbankfunktion nachgewiesen; ein Szenario dafür existiert nicht.

### `automation.scheduler`

- Cron-Zeitpläne und Service-Role-Prüfungen wurden nicht in dieser Umgebung ausgeführt.

### `automation.webhooks`

- Secret-Prüfung ist dokumentiert; ein eigener Webhook-Test existiert nicht.

### `automation.calendar-schedule`

- Reine Hilfsfunktion; fachlich den Kalender- und Automatisierungsfunktionen zugeordnet.

### `annotations.ocr`

- OCR-Qualität hängt vom Scan ab; ein automatisierter Qualitätstest existiert nicht.

### `letters.create`

- Der Dirty-Guard vergleicht den geladenen Stand mit einem Snapshot der Editor-Felder; Änderungen außerhalb des Editors (z. B. Revisionsfelder) lösen keine Rückfrage aus.
- Nach dem Speichern wird der gespeicherte Stand zur neuen Vergleichsbasis, sonst würde jede Schließung nachfragen.

### `letters.workflow`

- Die Statusmenge ist geschlossen (draft, review, pending_approval, approved, revision_requested, sent, archived); der CHECK-Constraint letters_status_check und der Client lehnen andere Werte ab.
- Die erlaubten Wechsel prüft der Trigger enforce_letter_status_transition gegen letter_status_transitions; Quelle ist ALLOWED_TRANSITIONS, beide werden von check:state-artifact abgeglichen. Ein direkter Sprung wie draft → sent wird abgewiesen. Neuanlagen prüft weiterhin nur die Wertemenge.
- Rückgaben laufen ausschließlich über das RPC return_letter_for_revision (SECURITY DEFINER): Es prüft Anmeldung, aktive Mandantzugehörigkeit und die Prüferzuordnung in letter_collaborators, setzt Status und Revisionsfelder in einem Schritt und benachrichtigt den Ersteller. Der Guard-Trigger guard_letter_return_transition weist direkte Statuswechsel review → draft bzw. pending_approval → revision_requested ohne das transaktionslokale Merkmal ab.

### `letters.archive`

- Die Folgeaufgabe hat genau einen Erzeuger: den Trigger trigger_letter_followup_task beim Wechsel auf sent. Die Archivfunktion erzeugt keine zweite Aufgabe, sondern liefert die bestehende ID über create_letter_archive_follow_up_task; ein Fehler dabei wird als followUpTaskError gemeldet, ohne den abgeschlossenen Versand abzubrechen. Der Client zieht die Aufgabe nur nach, wenn die Funktion keine ID liefert. Trigger und RPC verknüpfen die Aufgabe über source_type letter_followup und source_id des Briefes; der zusammengebaute Titel dient nur noch dem Altbestand und wird dabei in die Verknüpfung überführt.

### `decisions.change-vote`

- Die Änderungsmöglichkeit ist im Szenario nur als Folgepfad, nicht als eigener Prüfschritt abgedeckt.

### `decisions.archive`

- Der Cron-Lauf wurde hier nicht ausgeführt; der Nachweis ist die Funktion plus Einstellungsdialog.

### `decisions.matrix`

- Der Handler ist öffentlich erreichbar und benötigt einen eigenen Signatur-/Secret-Schutz; die Härtung ist offen.
- Sicherheitsklassifikation public-webhook; zusätzlicher Schutz im Code nicht nachgewiesen.

### `chat.matrix-bot`

- Der Bot-Handler ist JWT-geschützt, aber der fachliche Befehlsraum ist nicht dokumentiert.

### `contacts.detail`

- Gerendert wird das Detail-Sheet nicht; geprüft werden die gesicherte Kontaktlesung und die verknüpften Datenpfade (Aktivitäten, Briefingwissen, Förderungen).

### `contacts.import`

- CSV-Text (Komma und Semikolon) und VCF-Text werden eingelesen, Spalten automatisch zugeordnet und Zeilen samt Namen, E-Mail-Prüfung und Verteiler-Spalte zu Kontaktwerten verarbeitet; eine daraus gebaute Zeile wird gespeichert und über denselben Verteilerpfad wie die Oberfläche zugeordnet.
- Der Datei-Dialog selbst, das Excel-/ODS-Einlesen und die Duplikatdialoge der Oberfläche laufen nicht im Selbsttest.

### `contacts.duplicates`

- Der Trigramm-Scan wird mit zwei eigens angelegten Kontakten geprüft; die Trefferqualität für den Bestand bleibt ungemessen.
- Die Administrationsliste zeigt höchstens 200 Paare; bei gleicher Punktzahl entscheidet die Zeilenreihenfolge. Der Selbsttest fragt sein Paar deshalb kontaktbezogen ab (find_contact_duplicates_trgm mit _contact_id).
- Die Trefferheuristik ist nicht qualitätsgetestet; falsche Paare sind möglich.

### `contacts.distribution-lists`

- Geprüft werden Anlegen, Mitglieder, Duplikatsperre und Löschen; die Umwandlung im Stakeholder-Dialog nutzt denselben Schreibpfad, wird aber nicht gerendert.

### `contacts.stakeholders`

- Geprüft werden Stakeholder-Organisation, Personenzuordnung, Verteilerbildung sowie ein Kartenflag mit Flag-Typ und Koordinaten (anlegen, lesen, löschen); Kartenebenen (map_layers) und Flag-Themen (map_flag_topics) bleiben ausgeklammert.
- Die Trefferheuristik der Netzwerkansicht ist nicht qualitätsgetestet; geprüft wird die Datenbasis, nicht die Darstellung.

### `contacts.tags-topics`

- Das frühere Tag-Feld bleibt als historischer Bestand in contacts.tags erhalten.
- Geprüft wird contact_topics samt Zählung; die Themenauswahl im Dialog wird nicht gerendert.
- Die Zuordnung über die Oberfläche (TopicPicker) wird nur mittelbar über denselben contact_topics-Schreibpfad geprüft.

### `contacts.privacy`

- Rechtsgrundlage, Prüffrist und Fälligkeit werden als Regel und über den Datenbank-Trigger geprüft; eine konfigurierte Feldmaskierung (field_permissions) verändert der Selbsttest nicht.
- Löschanfragen werden angelegt und die Eigenfreigabe per Update und approve_gdpr_delete abgewiesen; der eigene ausstehende Antrag wird anschließend zurückgezogen (Löschrecht nur für eigene, ausstehende Zeilen). Die positive Freigabe durch eine zweite berechtigte Person verlangt deren persönliche Anmeldung und wird im Selbsttest nur als Regel geprüft.

### `contacts.bulk`

- Die Rücknahme verlangt Büroleitung oder Abgeordneten-Mandat; als Mitglied wird nur die Abweisung geprüft.

### `contacts.activities`

- Geprüft werden die Datenbank-Trigger für Anlegen, Bearbeiten und Anrufprotokolle; die Quick-Capture-Oberflächen werden nicht gerendert.

### `contacts.briefing-memory`

- Die Leserechte folgen der Profil-Mandantenzuordnung; bei mehreren Büros kann die Sichtbarkeit eingeschränkt sein.

### `contacts.fundings`

- Geprüft werden Förderung und Beteiligung samt eindeutiger Zuordnung; Budgetbezüge (expense_budgets) bleiben unberührt.

### `employees.meetings`

- Freigabe, Bestätigung, Wiedereröffnung und Einspruch prüft nur `selftest_employee_protocol`: Der Aufruf führt die echten RPCs aus und rollt alle Schreibzugriffe zurück, weil `guard_employee_protocol` ein Gespräch mit Auditzeilen absichtlich unlöschbar macht. Ein dauerhaft freigegebenes Gespräch hinterlässt der Selbsttest deshalb nicht.
- Das Szenario führt Mitarbeitende Person und Gesprächsleitung im selben Konto; die Rollentrennung deckt access-boundaries ab.

### `employees.protocol`

- Ein dauerhaft freigegebenes Gespräch bleibt absichtlich unlöschbar; `selftest_employee_protocol` prüft den positiven Pfad deshalb nur mit vollständigem Rollback. Nicht geprüft: die Zustellung der Freigabe-Benachrichtigung und Wirkungen nach dem Aufräumen.
- Freigabe und Bestätigung sind nur im zurückgerollten Prüfpfad ausgeführt; einen persistenten Freigabelauf gibt es im Selbsttest bewusst nicht.

### `employees.action-tasks`

- Die Aufgabe entsteht im Selbsttest nur innerhalb des zurückgerollten Freigabepfads; ein persistierter Aufgabenlauf wird nicht erzeugt.

### `employees.preparation`

- Cron-Versand wurde nicht ausgeführt.

### `employees.wellbeing`

- Schwellenwerte liegen im reinen Modul; teamweite Auswertungen sind ausdrücklich ausgeschlossen.
- Kein Test für die Datenbankpolitik der Wohlbefindensdaten vorhanden.

### `timetracking.entries`

- Arbeitszeitregeln sind als reine Funktionen vorhanden, aber ohne dedizierten Test für arbzg.ts.

### `meetings.zombie-points`

- Für zombiePoints.ts ist keine Testdatei vorhanden.

### `drucksachen.view`

- Eine eigene Drucksachen-Tabelle existiert in den generierten Typen nicht; die Anzeige arbeitet auf Dokumenten.
- Fachlicher Umfang der Drucksachenansicht ist unklar; nur die Ansicht ist nachgewiesen.

### `topics.manage`

- knowledge_question_topics hat nur eine Lesepolicy; Clients können Wissensfragen noch nicht selbst mit Themen verknüpfen, das Szenario prüft Lesbarkeit und die Abweisung des direkten Inserts.
- merge_topics und Änderungen an topic_module_settings setzen eine Büroleitung voraus; als Mitglied prüft das Szenario die Abweisung.

### `integration.calendar-sync`

- Ein echter Sync gegen einen externen Anbieter ist nicht ausgeführt worden; nur Code und Contract-Tests liegen vor.

### `integration.email`

- Ein echter Mailversand ist in dieser Umgebung nicht geprüft; Zustellbarkeit und Bounce-Verhalten sind offen.
- Zentrale Vorlagenpflege und Versand sind über mehrere Funktionen verteilt; eine vollständige Liste der Absender liegt nicht zentral vor.

### `integration.ai-suggestions`

- Der Vorschlag erzeugt keine Datenbankeinträge; die Übernahme bleibt eine bewusste Benutzeraktion.
- Kein Test für Prompt-Grenzen oder Ratenbegrenzung vorhanden.

### `integration.edge-contract-tests`

- Die Contract-Tests wurden hier nicht ausgeführt; der Nachweis ist die Datei.

### `appointments.requests`

- Ein direkter Statuswechsel wird durch einen Trigger blockiert; der Negativpfad ist im Szenario geprüft.

### `daily.briefing`

- Frühere Tage sind schreibgeschützt; abgeschlossen werden kann nur der aktuelle Tag.
- Wochentag-Vorlage, Wochenplan und wiederkehrende Punkte werden als eine Startentscheidung einmal pro Tag getroffen: Vorlage und Wochenplan kommen nur in noch unbegonnene Zettel und auch nach späterem Leeren nicht nachträglich; Routinen höchstens einmal, auch auf einem bereits begonnenen Zettel. Die Entscheidung wird auch dann festgehalten, wenn nichts eingefügt wurde. Manuell gewählte Vorlagen ersetzen sie für den Tag. Fehlende Wochenplan-Zeilen eines bereits begonnenen Zettels zeigt der Zettel mit Anzahl und manueller Übernahme an, statt sie stillschweigend zu übergehen.
- Kürzel belegen die Zuordnung nur vor; mehrdeutige Namen und unbekannte Fälligkeiten bleiben Text und werden in der Zuordnung geklärt.

### `calendar.holidays`

- Der Sync-Lauf wurde nicht ausgeführt; Datenquelle und Aktualisierungsintervall sind nicht dokumentiert.

### `events.rsvp-public`

- Ein vollständiger öffentlicher RSVP-Durchlauf gegen ein echtes Backend ist nicht in dieser Umgebung ausgeführt worden.

### `events.legacy-rsvp`

- Bewusst nur Kompatibilität; das Entfernungsdatum hängt vom Ende alter Mailings ab.
- Offen: Prüfen, ob noch Altlinks aktiv sind, bevor die Route entfernt wird.

### `admin.workspace`

- Der Zugriff ist über Hook-Tests abgedeckt, aber nicht in einem Selbsttest-Szenario.

### `admin.feature-flags`

- Die Menge der tatsächlich ausgewerteten Flags ist nicht zentral deklariert; UI-Flächen wurden nicht einzeln geprüft.

### `admin.gdpr`

- Der Vier-Augen-Prozess ist nur über Code und Migration nachgewiesen; kein Testlauf gegen eine Datenbank in dieser Umgebung.

### `admin.security-cockpit`

- Eine vorhandene RLS-Policy ist kein Nachweis für korrekte Mandantentrennung; das Cockpit liefert nur Befunde.
- Policy-Details stammen live aus pg_policies und bewerten weder die Funktion noch ihre Tests.
- Der Nachtest führt die Selbsttests aus, die die Tabelle laut Coverage-Übersicht abdecken; er beweist nicht, dass genau die beanstandete Policy korrekt ist.
- Für Tabellen ohne abdeckendes Selbsttest-Szenario bleibt die Nachtest-Zelle leer; diese Lücke schließt nur ein neues Szenario in src/features/selftest/scenarios.
- Funktionen ohne Tabellenbezug erhalten keinen RLS-Bezug; ob das fachlich korrekt ist, bleibt je Funktion zu prüfen.

### `admin.system-pulse`

- Die Testhistorie lädt über get_latest_selftest_runs und get_selftest_run_history; beide RPCs sowie die Qualitätsfelder app_version, keep_data und cleanup sind im Backend vorhanden (per PostgREST geprüft). Fehlen sie in einer Umgebung, zeigt die Karte „Testlage unbekannt“ statt serverseitiger Ergebnisse.
- Dynamisch erzeugte Schritte (z. B. die Plattformquellen im Jour fixe) stehen erst nach einem Lauf in der Kette; sie werden dann aus den gespeicherten Schritten ergänzt und als nicht deklariert gekennzeichnet.
- Verlauf und Dauertrend benötigen die separate RPC get_selftest_run_history; ohne sie bleibt die Ampel nutzbar, aber ohne Trend und Wiederholungszähler.
- Der Live-Teststart schreibt echte Testdaten und Dateien, ist bestätigungspflichtig und räumt anschließend auf; fehlende Rollen führen zu „Voraussetzung fehlt“.
- Die Bereichsampel bewertet ausschließlich funktionale Selbsttests; RLS-Lücken bleiben eine getrennte Kennzahl und ergeben keine Gesamtbewertung.
- Die Fehlertabelle über den Bereichskacheln zeigt nur den neuesten gespeicherten Lauf je Szenario; ältere Läufe ohne Schrittliste erscheinen dort als eine Zeile „gesamter Testlauf“.
- Die Übersicht der längsten Testabschnitte misst die gespeicherten Schritt-Dauern des neuesten Laufs je Szenario; Tests ohne Dauer bleiben ohne Abschnitte gelistet, und die Laufzeit der Schritte außerhalb des Tests (Aufräumen) zählt nicht dazu.
- Ausgeführt wurden Unit-, Generator- und Komponententests mit gemocktem RPC; RPC-Antwort, angewendete Migration und Darstellung im Browser wurden nicht gegen ein laufendes Backend geprüft.
- Die Ampel zeigt den neuesten Lauf je Szenario über alle Mitglieder des Mandanten, nicht nur den letzten Lauf des angemeldeten Nutzers.
- Migration vor Inbetriebnahme anwenden; ohne sie bleibt die Testlage unbekannt.
- SVG-Flusspfeile und Live-Aktualisierung sind nicht im Browser geprüft.

### `admin.edge-function-security`

- Die Sicherheitsmatrix ist teilweise unvollständig formatiert; der Drift-Check ist als Prüfung vorhanden, wurde hier aber nicht ausgeführt.

### `admin.configuration`

- Bei den Kernstatus der Aufgaben (todo, in_progress, completed, cancelled, review) ändert Umbenennen nur den Anzeigenamen; der technische Name bleibt stabil, weil Spalten-Default, Client und Datenbankfunktionen ihn schreiben. Löschen und direktes Umbenennen weist die Datenbank ab (22023). Der Aufgaben-Selbsttest prüft vor dem Anlegen einer Aufgabe, ob die fünf Kernstatus registriert sind, und meldet fehlende Einträge als eigenen Schritt.

### `admin.maintenance`

- Die Läufe sind nicht ausgeführt worden; Löschumfang und Aufbewahrungsfristen sind nicht geprüft.

### `admin.selftest-center`

- Ein grüner Lauf bestätigt nur den angezeigten Prüfumfang; die Läufe wurden hier nicht gegen ein Backend ausgeführt.
- Fehlercode, Details und Hinweis stammen aus der tatsächlich fehlgeschlagenen Operation; ein Befund ohne diese Zuordnung bleibt offen.

### `admin.feature-catalog`

- Die Landkarte leitet Kanten ausschließlich aus deklarierten `dependsOn`-Bezügen ab und behauptet keine Laufzeitaufrufe.
- Das Zustandsartefakt leitet Übergänge nur aus belegten Schreibvorgängen, Defaults, INSERTs und validierten Funktionsparametern ab; ein vollständiger Automat wird nicht behauptet. Guards liefern geprüfte Werte und blockierte Zustände, aber keine Kontrollfluss-Auswertung.
- Der Abgleich mit TS-Regelmodulen und Client-Schreibvorgängen ist ein Prüfauftrag: Er vergleicht registrierte Quellen und Literale, keine Laufzeitaufrufe und keine dynamischen Statuswerte.
- Der Katalog ist so vollständig wie die manuelle Inventarisierung; heuristische Lücken werden im Review-Bericht ausgewiesen.

### `platform.notification-dispatch`

- Reine Querschnittsfunktion; den zugehörigen Fachfunktionen untergeordnet, kein eigenständiger Fachumfang.
- Die Liste der Trigger ist exemplarisch und nicht vollständig aus allen 881 Migrationen rekonstruiert.

### `cases.link-decision`

- Die Verknüpfung wird nur über eine Validierungsfunktion und nicht über einen eigenen UI-Nachweis belegt.

### `cases.escalation`

- Der Vorschlagsalgorithmus ist nicht durch einen Test abgedeckt.

### `cases.legacy-routes`

- Reine Kompatibilitätsweiterleitung ohne eigenen Fachumfang.
- Offen: Altlinks zählen, bevor die Routen entfernt werden.

### `casefiles.manage`

- Die Akte bleibt der Container: kein Ball und kein nächster Schritt wie beim Vorgang, dafür Typ, Sichtbarkeit und Bearbeitungsstatus.

### `casefiles.links`

- Die Themenverknüpfung prüft kein Szenario, weil der Themenkatalog einem eigenen Szenario gehört.

### `casefiles.document-upload`

- Der Selbsttest deckt Upload, Verknüpfung, Verlauf und einen Suchtreffer ab. Die Bedienoberfläche ist nicht abgedeckt.

### `election.seat-distribution`

- Für seatDistributionModel.ts ist keine dedizierte Testdatei vorhanden.

### `election.map`

- Schlägt das Vorabladen der nächsten Periode fehl, hält die Zeitreise an und nennt die betroffene Periode, statt sie zu überspringen.
- Sehr große Grenzstände über dem Punktbudget sowie aktivierte Bewegungseinschränkung wechseln ohne Morph.
- Wahlkreise mit neuem Namen und ohne gemeinsame Fläche (Reformen) blenden über, statt zu morphen.

### `election.history.districts-geometry`

- Rekonstruierte Grenzstände sind ausdrücklich nicht als verifizierte historische Identität behandelt.

### `election.parliament-protocols`

- Die Analysefunktion ist nicht dokumentiert; Eingabeformat und Ausgabequalität sind ungeprüft.

### `election.history.portraits`

- Ein Upload gilt erst nach Veröffentlichung des Repository-Commits durch den Hosting-Anbieter als sichtbar.

### `knowledge.collaboration`

- Öffentlicher Kollaborationsendpunkt; ein zusätzlicher serverseitiger Guard ist laut Sicherheitsmatrix empfohlen.
- Sicherheitsklassifikation public-webhook; Schutzbedarf prüfen.

## Nicht zugeordnete Prüfkandidaten

### Routen (0)

- Keine.

### Edge Functions (0)

- Keine.

### Datenbankfunktionen ohne Zuordnung (1)

Diese Liste ist heuristisch gefiltert (technische Präfixe gelten als Hilfsfunktionen). Sie ist ein Prüfauftrag, keine automatische Aussage über Verwaistheit.

- `rename_config_item_unprotected` (src/integrations/supabase/types.ts)

### Registrierte Selbsttests ohne Funktionszuordnung (0)

- Keine.

### Seitenmodule ohne Funktionszuordnung (0)

Heuristik: Seiten unter `src/pages` ohne Verweis in `evidence` oder `components` einer Funktion. Der Befund ist ein Prüfauftrag, keine Löschfreigabe.

- Keine.

## Dokumentierte Ausnahmen

Ausnahmen liegen versioniert in `src/features/feature-catalog/exceptions.json`; jede benötigt `kind`, `key` und `reason`.

| Art | Objekt | Begründung |
|---|---|---|
| page | `src/pages/NotFound.tsx` | Technische Fallback-Seite für unbekannte Routen ohne eigenständigen fachlichen Funktionsumfang; Verhalten wird durch den Router bestimmt. |
