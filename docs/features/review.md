# Prüfbericht des Funktionskatalogs

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Dieser Bericht trennt **eindeutig nachweisbare Inkonsistenzen** von **heuristischen Prüfkandidaten**. Nur erstere lassen `check:feature-catalog` fehlschlagen; Kandidaten erzeugen Review-Hinweise.

## Ergebnis des letzten Katalogprüflaufs

Eindeutige Fehler werden im CI-Lauf ausgegeben und brechen die Prüfung ab; sie werden hier nicht dupliziert. Dieser Bericht listet die verbleibenden Review-Hinweise und Prüfkandidaten.

- Review-Hinweise: **0**
- Nicht zugeordnete Objekte: **1**, davon ohne Ausnahme: **0**

## Funktionen ohne zugeordneten Test (151)

- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `mobile.app` — Mobile App (Expo)
- `tasks.deadline` — Frist setzen und überwachen
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.archive` — Aufgabe archivieren und wiederherstellen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
- `automation.conditions` — Regelbedingungen und Feldtypen
- `automation.rule-validation` — Regelvalidierung im Editor
- `automation.rule-versions` — Regelversionen und Import/Export
- `automation.runs` — Regelläufe und Fehlerdashboard
- `automation.routine-packages` — Dauerhafte Routineabläufe
- `automation.task-packages` — Aufgabenpakete
- `automation.scheduler` — Zeitgesteuerte Automatisierung
- `automation.webhooks` — Automatisierungs-Webhooks
- `automation.templates` — Automatisierungs-Vorlagen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.export` — Brief als PDF oder DOCX exportieren
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
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.import` — Kontakte importieren
- `contacts.duplicates` — Dubletten finden
- `contacts.distribution-lists` — Verteilerlisten verwalten
- `contacts.stakeholders` — Stakeholder-Netzwerk
- `contacts.tags-topics` — Kontakt-Tags und Themen
- `contacts.privacy` — Kontakt-Datenschutz und Aufbewahrung
- `contacts.bulk` — Kontakte in Massen bearbeiten
- `contacts.activities` — Kontaktaktivitäten und Anrufe
- `contacts.briefing-memory` — Briefingwissen je Kontakt
- `contacts.fundings` — Finanzierungen und Beteiligungen
- `employees.meetings` — Mitarbeitergespräch planen und führen
- `employees.protocol` — Gesprächsprotokoll freigeben und sperren
- `employees.action-tasks` — Maßnahmen als Aufgaben
- `employees.preparation` — Gesprächsvorbereitung und Erinnerungen
- `employees.review` — Vorgesprächs-Review
- `employees.wellbeing` — Wohlbefinden und Trends
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
- `topics.manage` — Themen verwalten
- `topics.convert-catalog` — Thema in Katalog überführen
- `facts.manage` — Fakten und Argumente pflegen
- `integration.calendar-sync` — Externe Kalender synchronisieren
- `integration.email` — Transaktions-E-Mail-Versand
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
- `admin.security-cockpit` — Security-Cockpit
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
- `casefiles.manage` — Fallakte anlegen und führen
- `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
- `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
- `casefiles.notes` — Fallakten-Notizen
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
- `election.history.portraits` — Abgeordnetenporträts
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
- `knowledge.management` — Wissensverwaltung

## Funktionen ohne Dokumentationsverweis (162)

- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
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
- `contacts.tags-topics` — Kontakt-Tags und Themen
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
- `casefiles.notes` — Fallakten-Notizen
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
- `knowledge.tags` — Tags und Themenzuordnung
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

## Funktionen mit Einschränkungen oder offenen Punkten (61)

### `mywork.dashboard`

- Kein Szenario prüft die Dashboard-Aggregation selbst; die Zuordnung stützt sich auf die dort erzeugten Datensätze.

### `mywork.tabs`

- Die Tab-Auswahl ist eine reine UI-Präferenz und hat keine eigene Geschäftsregel.

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

### `tasks.assign`

- Die Regel, wer wem zuweisen darf, liegt teils in RLS und teils im Code; sie ist hier nicht vollständig rekonstruiert.

### `tasks.ball-owner`

- Die reine Regel ist getestet; die Anzeige in allen Listen ist nicht durchgängig geprüft.

### `tasks.snooze`

- Ob Rückstellungen fachlich als Wiedervorlage oder nur als Anzeige-Unterdrückung gelten, ist im Code nicht abschließend dokumentiert.

### `tasks.subtasks`

- Die Unteraufgaben-Oberfläche wurde nicht im Browser geprüft; der Nachweis stützt sich auf Komponenten und Tabelle.

### `tasks.recurring`

- Ob die Wiederholung im Browser sichtbar ausgelöst wurde, ist nicht geprüft; der Nachweis ist die Trigger-/RPC-Kette.

### `tasks.search-filter`

- Die Filterlogik liegt in der Ansicht; eine eigene getestete Regeldatei existiert nicht.

### `tasks.nudge`

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

### `decisions.change-vote`

- Die Änderungsmöglichkeit ist im Szenario nur als Folgepfad, nicht als eigener Prüfschritt abgedeckt.

### `decisions.archive`

- Der Cron-Lauf wurde hier nicht ausgeführt; der Nachweis ist die Funktion plus Einstellungsdialog.

### `decisions.matrix`

- Der Handler ist öffentlich erreichbar und benötigt einen eigenen Signatur-/Secret-Schutz; die Härtung ist offen.
- Sicherheitsklassifikation public-webhook; zusätzlicher Schutz im Code nicht nachgewiesen.

### `chat.matrix-bot`

- Der Bot-Handler ist JWT-geschützt, aber der fachliche Befehlsraum ist nicht dokumentiert.

### `contacts.duplicates`

- Die Trefferheuristik ist nicht qualitätsgetestet; falsche Paare sind möglich.

### `contacts.tags-topics`

- Der Abgleich zwischen Kontakt-Tags und zentralen Tags ist nicht durch einen Test abgedeckt.

### `employees.meetings`

- Für Mitarbeitergespräche existiert kein registriertes Selbsttest-Szenario.

### `employees.protocol`

- Protokollfreigabe ist eine sensible Regel ohne zugeordneten Test.

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
- Funktionen ohne Tabellenbezug erhalten keinen RLS-Bezug; ob das fachlich korrekt ist, bleibt je Funktion zu prüfen.

### `admin.system-pulse`

- Die Testhistorie lädt über get_latest_selftest_runs; bis die Migration 20261125170000_get_latest_selftest_runs.sql angewendet ist, zeigt die Karte „Testlage unbekannt“ statt serverseitiger Ergebnisse.
- Der Live-Teststart schreibt echte Testdaten und Dateien, ist bestätigungspflichtig und räumt anschließend auf; fehlende Rollen führen zu „Voraussetzung fehlt“.
- Die Bereichsampel bewertet ausschließlich funktionale Selbsttests; RLS-Lücken bleiben eine getrennte Kennzahl und ergeben keine Gesamtbewertung.
- Ausgeführt wurden Unit-, Generator- und Komponententests mit gemocktem RPC; RPC-Antwort, angewendete Migration und Darstellung im Browser wurden nicht gegen ein laufendes Backend geprüft.
- Die Ampel zeigt den neuesten Lauf je Szenario über alle Mitglieder des Mandanten, nicht nur den letzten Lauf des angemeldeten Nutzers.
- Migration vor Inbetriebnahme anwenden; ohne sie bleibt die Testlage unbekannt.
- SVG-Flusspfeile und Live-Aktualisierung sind nicht im Browser geprüft.

### `admin.edge-function-security`

- Die Sicherheitsmatrix ist teilweise unvollständig formatiert; der Drift-Check ist als Prüfung vorhanden, wurde hier aber nicht ausgeführt.

### `admin.maintenance`

- Die Läufe sind nicht ausgeführt worden; Löschumfang und Aufbewahrungsfristen sind nicht geprüft.

### `admin.selftest-center`

- Ein grüner Lauf bestätigt nur den angezeigten Prüfumfang; die Läufe wurden hier nicht gegen ein Backend ausgeführt.

### `admin.feature-catalog`

- Die Landkarte leitet Kanten ausschließlich aus deklarierten `dependsOn`-Bezügen ab und behauptet keine Laufzeitaufrufe.
- Das Zustandsartefakt leitet Übergänge nur aus belegten literalen Schreibvorgängen ab und behauptet keinen vollständigen Automaten; Guard-Funktionen werden zitiert, nicht interpretiert.
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

- Die Fallakte hat kein eigenes Selbsttest-Szenario; der Nachweis ist die Komponenten-/RPC-Kette.

### `election.seat-distribution`

- Für seatDistributionModel.ts ist keine dedizierte Testdatei vorhanden.

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

### Datenbankfunktionen ohne Zuordnung (0)

Diese Liste ist heuristisch gefiltert (technische Präfixe gelten als Hilfsfunktionen). Sie ist ein Prüfauftrag, keine automatische Aussage über Verwaistheit.

- Keine.

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
