# Rollen- und Berechtigungszuordnungen

_Auto-generiert mit `npm run update:feature-catalog`. Nicht aus den Selbsttests, sondern aus den Funktionsdefinitionen. Nicht von Hand bearbeiten._

Die Angaben sind deklarierte Mindestrollen. Die tatsächlich wirksame Berechtigung liegt zusätzlich in RLS-Policies, Feldrechten und Aktionsberechtigungen; ein Rollenlabel ist kein Sicherheitsnachweis.

## Funktionen je Rolle

### `abgeordneter` — 186 Funktionen

- `mywork.dashboard` — Meine Arbeit – Dashboard
- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
- `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
- `quicknotes.checklists` — Checklisten in Schnellnotizen
- `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
- `quicknotes.page` — Eigene Notizseite mit Deep Links
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `mobile.app` — Mobile App (Expo)
- `tasks.create` — Aufgabe erstellen
- `tasks.edit` — Aufgabe bearbeiten
- `tasks.complete` — Aufgabe abschließen
- `tasks.assign` — Aufgabe zuweisen
- `tasks.handover-stafette` — Aufgabe weitergeben (Stafette)
- `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
- `tasks.deadline` — Frist setzen und überwachen
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-decision` — Aufgabe mit Entscheidung verknüpfen
- `tasks.link-case` — Aufgabe mit Vorgang verknüpfen
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.archive` — Aufgabe archivieren und wiederherstellen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
- `documents.list` — Dokumentenliste und Suche
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.create` — Dokumente annotieren
- `annotations.history` — Annotationsverlauf
- `annotations.tasks` — Folgeaufgabe aus Annotation
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.create` — Brief erstellen und bearbeiten
- `letters.workflow` — Brief-Freigabeworkflow
- `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.export` — Brief als PDF oder DOCX exportieren
- `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
- `letters.attachments` — Briefanlagen verwalten
- `decisions.create` — Entscheidung anlegen
- `decisions.participants` — Teilnehmende und Antwort-Token verwalten
- `decisions.vote` — Abstimmen
- `decisions.withdraw-vote` — Votum zurücknehmen
- `decisions.change-vote` — Antwort ändern und Verlauf einsehen
- `decisions.comments` — Kommentare und Reaktionen
- `decisions.notification-digest` — Gebündelte Entscheidungs-Meldungen
- `decisions.attachments` — Anhänge an Entscheidungen
- `decisions.remind` — Offene Entscheidungen anmahnen
- `decisions.email` — Entscheidungs-E-Mails
- `decisions.matrix` — Entscheidungen über Matrix beantworten
- `redaktion.planner` — Social-Media-Planung
- `redaktion.approval` — Social-Media-Freigabe
- `redaktion.assets-campaigns` — Social-Assets und Kampagnen
- `redaktion.themenspeicher` — Themenspeicher und Hashtags
- `redaktion.calendar-reminders` — Redaktionskalender und Erinnerungen
- `press.releases` — Pressemitteilungen erstellen und freigeben
- `news.articles` — News-Artikel und Lesestatus
- `chat.messages` — Interner Chat über Matrix
- `chat.matrix-bot` — Matrix-Bot und morgendliche Begrüßung
- `chat.team-announcements` — Team-Ankündigungen
- `contacts.create` — Kontakt anlegen
- `contacts.edit` — Kontakt bearbeiten
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.archive` — Kontakte archivieren und wiederherstellen
- `contacts.list-search` — Kontaktliste mit Suche und Filtern
- `contacts.import` — Kontakte importieren
- `contacts.duplicates` — Dubletten finden
- `contacts.merge` — Kontakte zusammenführen
- `contacts.distribution-lists` — Verteilerlisten verwalten
- `contacts.stakeholders` — Stakeholder-Netzwerk
- `contacts.tags-topics` — Kontakt-Themen
- `contacts.bulk` — Kontakte in Massen bearbeiten
- `contacts.activities` — Kontaktaktivitäten und Anrufe
- `contacts.briefing-memory` — Briefingwissen je Kontakt
- `contacts.fundings` — Finanzierungen und Beteiligungen
- `employees.meetings` — Mitarbeitergespräch planen und führen
- `employees.protocol` — Gesprächsprotokoll freigeben und sperren
- `employees.action-tasks` — Maßnahmen als Aufgaben
- `employees.review` — Vorgesprächs-Review
- `employees.requests` — Gesprächsanfragen der Mitarbeitenden
- `employees.export-stats` — Gesprächs-PDF und Jahresstatistik
- `responsibilities.suggest` — Zuständigkeitsvorschläge
- `teamrituals.weekly` — Wöchentliche Teamfrage
- `teamrituals.games` — Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts)
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.vacation` — Urlaub und Resturlaub
- `timetracking.annual-tasks` — Jahresaufgaben im Zeitbereich
- `meetings.jour-fixe` — Jour-fixe-Sitzung planen und durchführen
- `meetings.agenda` — Agenda führen
- `meetings.protocol` — Sitzungsprotokoll
- `meetings.decisions` — Sitzungsentscheidungen dokumentieren
- `meetings.archive` — Sitzung archivieren
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
- `facts.manage` — Fakten und Argumente pflegen
- `integration.calendar-sync` — Externe Kalender synchronisieren
- `integration.ics` — ICS-Feeds und Einladungsdateien
- `integration.push` — Push-Benachrichtigungen
- `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
- `integration.transcription` — Sprachaufnahme transkribieren
- `integration.unsplash` — Bildsuche für Beiträge
- `calendar.view` — Terminkalender anzeigen
- `calendar.create-appointment` — Termin anlegen
- `calendar.edit-move` — Termin bearbeiten und verschieben
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `calendar.reminders` — Terminerinnerungen
- `calendar.invitations` — Termineinladungen und Kalendereinträge versenden
- `appointments.requests` — Terminanfrage stellen und entscheiden
- `appointments.briefing` — Terminbriefing erstellen
- `appointments.briefing-live` — Live-Briefing und Nachbereitung
- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `appointments.feedback` — Termin-Feedback erfassen
- `appointments.preparation` — Terminvorbereitung mit Vorschlägen
- `appointments.jour-fixe` — Jour-fixe-Agende und Systempunkte
- `daily.briefing` — Tagesbriefing und Tageszettel
- `calendar.polls` — Terminumfrage erstellen
- `events.plan` — Veranstaltung planen
- `events.checklist` — Veranstaltungs-Checkliste und Aufgaben
- `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
- `events.invitations` — Veranstaltungseinladungen versenden
- `polls.respond` — An Umfrage teilnehmen
- `polls.manage` — Umfragen verwalten und auswerten
- `polls.availability` — Verfügbarkeit und Zeitfenster
- `admin.action-permissions` — Aktionsberechtigungen
- `admin.access-boundaries` — Zugriffsschutzprüfung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.selftest-center` — Selbsttest-Center
- `cases.create` — Vorgang erfassen
- `cases.triage` — Vorgang triagieren (Wer ist am Zug?)
- `cases.handover` — Vorgang weitergeben
- `cases.steps` — Vorgangsschritte und Aufgaben
- `cases.interactions` — Kontakte und Interaktionen am Vorgang
- `cases.timeline` — Vorgangs-Timeline und Änderungsprotokoll
- `cases.link-appointment` — Vorgang mit Termin verknüpfen
- `cases.link-letter` — Vorgang mit Brief verknüpfen
- `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
- `cases.close-archive` — Vorgang abschließen und archivieren
- `cases.legacy-routes` — Legacy-Vorgangsrouten
- `casefiles.manage` — Fallakte anlegen und führen
- `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
- `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
- `casefiles.document-upload` — Datei aus der Akte ablegen
- `casefiles.notes` — Fallakten-Notizen
- `parlis.ministry-topics` — Ministerien und zentrale Themen zuordnen
- `election.analysis` — Wahlanalyse durchführen
- `election.analysis-navigation` — Analyse-Navigation und gespeicherte Szenarien
- `election.analysis-map` — Analyse-Karten und Wahlkreiszuschnitt
- `election.turnout` — Wahlbeteiligung
- `election.seat-distribution` — Sitzverteilung und Hemizykel
- `election.deputy-results` — Abgeordneten- und Kandidatenergebnisse
- `election.state-history` — Landesweite Zeitreihen
- `election.map` — Wahlkreiskarte anzeigen
- `election.history.periods` — Wahlperioden verwalten
- `election.history.people` — Personenregister und Karrieren
- `election.history.state-lists` — Landeslisten verwalten
- `election.history.districts-geometry` — Historische Wahlkreise und Geometrie
- `knowledge.ask` — Wissensfrage stellen
- `knowledge.answer` — Frage beantworten
- `knowledge.short-answer` — Kurzantwort neben der Langantwort
- `knowledge.tags` — Themenzuordnung im Wissen
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.search` — Wissenssuche
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.permissions` — Zugriffsrechte auf Wissensdokumente
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
- `knowledge.persons` — Wissenspersonen und Zuständigkeit

### `bueroleitung` — 231 Funktionen

- `mywork.dashboard` — Meine Arbeit – Dashboard
- `mywork.dashboard.today-priorities` — Heute zuerst
- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
- `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
- `quicknotes.checklists` — Checklisten in Schnellnotizen
- `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
- `quicknotes.page` — Eigene Notizseite mit Deep Links
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `mobile.app` — Mobile App (Expo)
- `tasks.create` — Aufgabe erstellen
- `tasks.edit` — Aufgabe bearbeiten
- `tasks.complete` — Aufgabe abschließen
- `tasks.assign` — Aufgabe zuweisen
- `tasks.handover-stafette` — Aufgabe weitergeben (Stafette)
- `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
- `tasks.deadline` — Frist setzen und überwachen
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-decision` — Aufgabe mit Entscheidung verknüpfen
- `tasks.link-case` — Aufgabe mit Vorgang verknüpfen
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
- `tasks.archive` — Aufgabe archivieren und wiederherstellen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
- `tasks.annual` — Jahresaufgaben und Jahresabschluss
- `automation.rules` — Automatisierungsregel verwalten
- `automation.rule-validation` — Regelvalidierung im Editor
- `automation.rule-versions` — Regelversionen und Import/Export
- `automation.runs` — Regelläufe und Fehlerdashboard
- `automation.annual-routines` — Jahresroutinen verwalten
- `automation.office-packages` — Saisonale Büropakete
- `automation.routine-packages` — Dauerhafte Routineabläufe
- `automation.task-packages` — Aufgabenpakete
- `automation.workflows` — Workflow-Definitionen und -Läufe
- `automation.rss` — RSS-Quellen und Monitoring
- `automation.templates` — Automatisierungs-Vorlagen
- `documents.list` — Dokumentenliste und Suche
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.create` — Dokumente annotieren
- `annotations.history` — Annotationsverlauf
- `annotations.tasks` — Folgeaufgabe aus Annotation
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.create` — Brief erstellen und bearbeiten
- `letters.workflow` — Brief-Freigabeworkflow
- `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.export` — Brief als PDF oder DOCX exportieren
- `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
- `letters.attachments` — Briefanlagen verwalten
- `decisions.create` — Entscheidung anlegen
- `decisions.participants` — Teilnehmende und Antwort-Token verwalten
- `decisions.vote` — Abstimmen
- `decisions.withdraw-vote` — Votum zurücknehmen
- `decisions.change-vote` — Antwort ändern und Verlauf einsehen
- `decisions.comments` — Kommentare und Reaktionen
- `decisions.notification-digest` — Gebündelte Entscheidungs-Meldungen
- `decisions.attachments` — Anhänge an Entscheidungen
- `decisions.remind` — Offene Entscheidungen anmahnen
- `decisions.archive` — Entscheidungen archivieren
- `decisions.email` — Entscheidungs-E-Mails
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
- `contacts.create` — Kontakt anlegen
- `contacts.edit` — Kontakt bearbeiten
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.archive` — Kontakte archivieren und wiederherstellen
- `contacts.list-search` — Kontaktliste mit Suche und Filtern
- `contacts.import` — Kontakte importieren
- `contacts.duplicates` — Dubletten finden
- `contacts.merge` — Kontakte zusammenführen
- `contacts.distribution-lists` — Verteilerlisten verwalten
- `contacts.stakeholders` — Stakeholder-Netzwerk
- `contacts.tags-topics` — Kontakt-Themen
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
- `hr.onboarding` — Onboarding-Ablauf
- `hr.templates` — HR-Vorlagen und DSGVO-Erklärung
- `hr.offboarding` — Offboarding mit Übergaben
- `responsibilities.matrix` — Zuständigkeitsmatrix
- `responsibilities.suggest` — Zuständigkeitsvorschläge
- `responsibilities.coverage` — Abdeckungsprüfung
- `teamrituals.weekly` — Wöchentliche Teamfrage
- `teamrituals.games` — Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts)
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.vacation` — Urlaub und Resturlaub
- `timetracking.admin` — Zeiterfassung administrieren
- `timetracking.annual-tasks` — Jahresaufgaben im Zeitbereich
- `meetings.jour-fixe` — Jour-fixe-Sitzung planen und durchführen
- `meetings.agenda` — Agenda führen
- `meetings.protocol` — Sitzungsprotokoll
- `meetings.decisions` — Sitzungsentscheidungen dokumentieren
- `meetings.archive` — Sitzung archivieren
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
- `integration.ics` — ICS-Feeds und Einladungsdateien
- `integration.push` — Push-Benachrichtigungen
- `integration.geocoding` — Adress-Geocoding
- `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
- `integration.transcription` — Sprachaufnahme transkribieren
- `integration.unsplash` — Bildsuche für Beiträge
- `calendar.view` — Terminkalender anzeigen
- `calendar.create-appointment` — Termin anlegen
- `calendar.edit-move` — Termin bearbeiten und verschieben
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `calendar.reminders` — Terminerinnerungen
- `calendar.invitations` — Termineinladungen und Kalendereinträge versenden
- `appointments.requests` — Terminanfrage stellen und entscheiden
- `appointments.briefing` — Terminbriefing erstellen
- `appointments.briefing-live` — Live-Briefing und Nachbereitung
- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `appointments.feedback` — Termin-Feedback erfassen
- `appointments.preparation` — Terminvorbereitung mit Vorschlägen
- `appointments.jour-fixe` — Jour-fixe-Agende und Systempunkte
- `daily.briefing` — Tagesbriefing und Tageszettel
- `calendar.categories-locations` — Terminkategorien und -orte pflegen
- `calendar.polls` — Terminumfrage erstellen
- `events.plan` — Veranstaltung planen
- `events.checklist` — Veranstaltungs-Checkliste und Aufgaben
- `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
- `events.invitations` — Veranstaltungseinladungen versenden
- `polls.respond` — An Umfrage teilnehmen
- `polls.manage` — Umfragen verwalten und auswerten
- `polls.availability` — Verfügbarkeit und Zeitfenster
- `admin.workspace` — Administrationsbereich und Zugriff
- `admin.roles` — Benutzerrollen verwalten
- `admin.permissions-explorer` — Rechte-Explorer und Rechteerklärung
- `admin.field-permissions` — Feldschutz
- `admin.action-permissions` — Aktionsberechtigungen
- `admin.audit-log` — Audit-Trail einsehen und exportieren
- `admin.bulk-audit` — Massenaktions-Audit
- `admin.access-boundaries` — Zugriffsschutzprüfung
- `admin.data-lint` — Datenqualitätsprüfung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.configuration` — Konfigurierbare Stammdaten pflegen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.templates-senders` — Administrative Vorlagen und Absenderdaten
- `admin.selftest-center` — Selbsttest-Center
- `cases.create` — Vorgang erfassen
- `cases.triage` — Vorgang triagieren (Wer ist am Zug?)
- `cases.handover` — Vorgang weitergeben
- `cases.steps` — Vorgangsschritte und Aufgaben
- `cases.interactions` — Kontakte und Interaktionen am Vorgang
- `cases.timeline` — Vorgangs-Timeline und Änderungsprotokoll
- `cases.link-appointment` — Vorgang mit Termin verknüpfen
- `cases.link-letter` — Vorgang mit Brief verknüpfen
- `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
- `cases.escalation` — Eskalationsvorschläge
- `cases.close-archive` — Vorgang abschließen und archivieren
- `cases.legacy-routes` — Legacy-Vorgangsrouten
- `casefiles.manage` — Fallakte anlegen und führen
- `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
- `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
- `casefiles.document-upload` — Datei aus der Akte ablegen
- `casefiles.notes` — Fallakten-Notizen
- `parlis.ministry-topics` — Ministerien und zentrale Themen zuordnen
- `election.analysis` — Wahlanalyse durchführen
- `election.analysis-navigation` — Analyse-Navigation und gespeicherte Szenarien
- `election.analysis-map` — Analyse-Karten und Wahlkreiszuschnitt
- `election.turnout` — Wahlbeteiligung
- `election.seat-distribution` — Sitzverteilung und Hemizykel
- `election.deputy-results` — Abgeordneten- und Kandidatenergebnisse
- `election.state-history` — Landesweite Zeitreihen
- `election.research-workbench` — Analyse-Workbench und Kommunalpanel
- `election.map` — Wahlkreiskarte anzeigen
- `election.history.periods` — Wahlperioden verwalten
- `election.history.people` — Personenregister und Karrieren
- `election.history.districts-geometry` — Historische Wahlkreise und Geometrie
- `election.parliament-protocols` — Plenarprotokolle auswerten
- `knowledge.ask` — Wissensfrage stellen
- `knowledge.answer` — Frage beantworten
- `knowledge.short-answer` — Kurzantwort neben der Langantwort
- `knowledge.review` — Wissensantwort prüfen und freigeben
- `knowledge.validity` — Gültigkeit und Veraltung
- `knowledge.tags` — Themenzuordnung im Wissen
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.search` — Wissenssuche
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.permissions` — Zugriffsrechte auf Wissensdokumente
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
- `knowledge.persons` — Wissenspersonen und Zuständigkeit
- `knowledge.management` — Wissensverwaltung

### `mitarbeiter` — 191 Funktionen

- `mywork.dashboard` — Meine Arbeit – Dashboard
- `mywork.dashboard.today-priorities` — Heute zuerst
- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
- `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
- `quicknotes.checklists` — Checklisten in Schnellnotizen
- `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
- `quicknotes.page` — Eigene Notizseite mit Deep Links
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `mobile.app` — Mobile App (Expo)
- `tasks.create` — Aufgabe erstellen
- `tasks.edit` — Aufgabe bearbeiten
- `tasks.complete` — Aufgabe abschließen
- `tasks.assign` — Aufgabe zuweisen
- `tasks.handover-stafette` — Aufgabe weitergeben (Stafette)
- `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
- `tasks.deadline` — Frist setzen und überwachen
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-decision` — Aufgabe mit Entscheidung verknüpfen
- `tasks.link-case` — Aufgabe mit Vorgang verknüpfen
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
- `tasks.archive` — Aufgabe archivieren und wiederherstellen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
- `documents.list` — Dokumentenliste und Suche
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `documents.contacts` — Dokumente mit Kontakten verknüpfen
- `documents.email` — Dokumente per E-Mail versenden
- `annotations.create` — Dokumente annotieren
- `annotations.history` — Annotationsverlauf
- `annotations.tasks` — Folgeaufgabe aus Annotation
- `annotations.ocr` — OCR für gescannte Dokumente
- `annotations.export` — Annotationen exportieren
- `annotations.relocate` — Annotationen bei neuer Dateiversion verschieben
- `letters.create` — Brief erstellen und bearbeiten
- `letters.workflow` — Brief-Freigabeworkflow
- `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
- `letters.templates` — Briefvorlagen und Anlässe
- `letters.export` — Brief als PDF oder DOCX exportieren
- `letters.collaboration` — Brief-Kommentare und Zusammenarbeit
- `letters.attachments` — Briefanlagen verwalten
- `decisions.create` — Entscheidung anlegen
- `decisions.participants` — Teilnehmende und Antwort-Token verwalten
- `decisions.vote` — Abstimmen
- `decisions.withdraw-vote` — Votum zurücknehmen
- `decisions.change-vote` — Antwort ändern und Verlauf einsehen
- `decisions.comments` — Kommentare und Reaktionen
- `decisions.notification-digest` — Gebündelte Entscheidungs-Meldungen
- `decisions.attachments` — Anhänge an Entscheidungen
- `decisions.email` — Entscheidungs-E-Mails
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
- `chat.team-announcements` — Team-Ankündigungen
- `contacts.create` — Kontakt anlegen
- `contacts.edit` — Kontakt bearbeiten
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.archive` — Kontakte archivieren und wiederherstellen
- `contacts.list-search` — Kontaktliste mit Suche und Filtern
- `contacts.import` — Kontakte importieren
- `contacts.duplicates` — Dubletten finden
- `contacts.merge` — Kontakte zusammenführen
- `contacts.distribution-lists` — Verteilerlisten verwalten
- `contacts.stakeholders` — Stakeholder-Netzwerk
- `contacts.tags-topics` — Kontakt-Themen
- `contacts.privacy` — Kontakt-Datenschutz und Aufbewahrung
- `contacts.bulk` — Kontakte in Massen bearbeiten
- `contacts.activities` — Kontaktaktivitäten und Anrufe
- `contacts.briefing-memory` — Briefingwissen je Kontakt
- `contacts.fundings` — Finanzierungen und Beteiligungen
- `employees.meetings` — Mitarbeitergespräch planen und führen
- `employees.protocol` — Gesprächsprotokoll freigeben und sperren
- `employees.action-tasks` — Maßnahmen als Aufgaben
- `employees.preparation` — Gesprächsvorbereitung und Erinnerungen
- `employees.wellbeing` — Wohlbefinden und Trends
- `employees.requests` — Gesprächsanfragen der Mitarbeitenden
- `employees.export-stats` — Gesprächs-PDF und Jahresstatistik
- `hr.onboarding` — Onboarding-Ablauf
- `hr.offboarding` — Offboarding mit Übergaben
- `responsibilities.matrix` — Zuständigkeitsmatrix
- `responsibilities.suggest` — Zuständigkeitsvorschläge
- `teamrituals.weekly` — Wöchentliche Teamfrage
- `teamrituals.games` — Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts)
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.vacation` — Urlaub und Resturlaub
- `timetracking.annual-tasks` — Jahresaufgaben im Zeitbereich
- `meetings.jour-fixe` — Jour-fixe-Sitzung planen und durchführen
- `meetings.agenda` — Agenda führen
- `meetings.protocol` — Sitzungsprotokoll
- `meetings.decisions` — Sitzungsentscheidungen dokumentieren
- `meetings.archive` — Sitzung archivieren
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
- `facts.manage` — Fakten und Argumente pflegen
- `integration.calendar-sync` — Externe Kalender synchronisieren
- `integration.push` — Push-Benachrichtigungen
- `integration.geocoding` — Adress-Geocoding
- `integration.ai-suggestions` — KI-Vorschläge für Vorbereitung und Eingang
- `integration.transcription` — Sprachaufnahme transkribieren
- `integration.unsplash` — Bildsuche für Beiträge
- `calendar.view` — Terminkalender anzeigen
- `calendar.create-appointment` — Termin anlegen
- `calendar.edit-move` — Termin bearbeiten und verschieben
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `calendar.reminders` — Terminerinnerungen
- `calendar.invitations` — Termineinladungen und Kalendereinträge versenden
- `appointments.requests` — Terminanfrage stellen und entscheiden
- `appointments.briefing` — Terminbriefing erstellen
- `appointments.briefing-live` — Live-Briefing und Nachbereitung
- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `appointments.feedback` — Termin-Feedback erfassen
- `appointments.preparation` — Terminvorbereitung mit Vorschlägen
- `appointments.jour-fixe` — Jour-fixe-Agende und Systempunkte
- `daily.briefing` — Tagesbriefing und Tageszettel
- `calendar.polls` — Terminumfrage erstellen
- `events.plan` — Veranstaltung planen
- `events.checklist` — Veranstaltungs-Checkliste und Aufgaben
- `events.speakers-documents` — Redner und Dokumente zur Veranstaltung
- `events.invitations` — Veranstaltungseinladungen versenden
- `polls.respond` — An Umfrage teilnehmen
- `polls.manage` — Umfragen verwalten und auswerten
- `polls.availability` — Verfügbarkeit und Zeitfenster
- `admin.action-permissions` — Aktionsberechtigungen
- `admin.access-boundaries` — Zugriffsschutzprüfung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.selftest-center` — Selbsttest-Center
- `cases.create` — Vorgang erfassen
- `cases.triage` — Vorgang triagieren (Wer ist am Zug?)
- `cases.handover` — Vorgang weitergeben
- `cases.steps` — Vorgangsschritte und Aufgaben
- `cases.interactions` — Kontakte und Interaktionen am Vorgang
- `cases.timeline` — Vorgangs-Timeline und Änderungsprotokoll
- `cases.link-appointment` — Vorgang mit Termin verknüpfen
- `cases.link-letter` — Vorgang mit Brief verknüpfen
- `cases.link-decision` — Vorgang mit Entscheidung verknüpfen
- `cases.close-archive` — Vorgang abschließen und archivieren
- `cases.legacy-routes` — Legacy-Vorgangsrouten
- `casefiles.manage` — Fallakte anlegen und führen
- `casefiles.status-workflow` — Fallakten-Status und Bearbeitungsstatus
- `casefiles.links` — Fallakte verknüpfen (Dokumente, Kontakte, Themen, Notizen)
- `casefiles.document-upload` — Datei aus der Akte ablegen
- `casefiles.notes` — Fallakten-Notizen
- `election.analysis` — Wahlanalyse durchführen
- `election.analysis-navigation` — Analyse-Navigation und gespeicherte Szenarien
- `election.analysis-map` — Analyse-Karten und Wahlkreiszuschnitt
- `election.turnout` — Wahlbeteiligung
- `election.seat-distribution` — Sitzverteilung und Hemizykel
- `election.deputy-results` — Abgeordneten- und Kandidatenergebnisse
- `election.state-history` — Landesweite Zeitreihen
- `election.map` — Wahlkreiskarte anzeigen
- `knowledge.ask` — Wissensfrage stellen
- `knowledge.answer` — Frage beantworten
- `knowledge.short-answer` — Kurzantwort neben der Langantwort
- `knowledge.review` — Wissensantwort prüfen und freigeben
- `knowledge.validity` — Gültigkeit und Veraltung
- `knowledge.tags` — Themenzuordnung im Wissen
- `knowledge.sources` — Quellen und Belege
- `knowledge.attachments` — Anhänge an Wissensfragen
- `knowledge.comments-follow` — Kommentare und Folgen
- `knowledge.search` — Wissenssuche
- `knowledge.versions` — Snapshots und Versionen
- `knowledge.permissions` — Zugriffsrechte auf Wissensdokumente
- `knowledge.collaboration` — Kollaborative Wissensbearbeitung
- `knowledge.global-question` — Globale Wissensfrage aus jedem Bereich
- `knowledge.persons` — Wissenspersonen und Zuständigkeit
- `knowledge.management` — Wissensverwaltung

### `praktikant` — 43 Funktionen

- `mywork.dashboard` — Meine Arbeit – Dashboard
- `mywork.dashboard.today-priorities` — Heute zuerst
- `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
- `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
- `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
- `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
- `search.global` — Globale Suche und Befehlspalette
- `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
- `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
- `quicknotes.checklists` — Checklisten in Schnellnotizen
- `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
- `quicknotes.page` — Eigene Notizseite mit Deep Links
- `platform.auth` — Anmeldung und Sitzung
- `profile.edit` — Eigenes Profil bearbeiten
- `tasks.create` — Aufgabe erstellen
- `tasks.edit` — Aufgabe bearbeiten
- `tasks.complete` — Aufgabe abschließen
- `tasks.assign` — Aufgabe zuweisen
- `tasks.ball-owner` — Wer ist am Zug? (Ball-Owner)
- `tasks.deadline` — Frist setzen und überwachen
- `tasks.snooze` — Aufgabe zurückstellen (Wiedervorlage)
- `tasks.subtasks` — Unteraufgaben
- `tasks.link-document` — Aufgabe mit Dokument verknüpfen
- `tasks.search-filter` — Aufgaben suchen, filtern und sortieren
- `documents.list` — Dokumentenliste und Suche
- `documents.details` — Dokumentdetails und Verknüpfungen
- `documents.upload-version` — Dokument hochladen und versionieren
- `news.articles` — News-Artikel und Lesestatus
- `chat.messages` — Interner Chat über Matrix
- `contacts.create` — Kontakt anlegen
- `contacts.detail` — Kontaktprofil mit Aktivitäten
- `contacts.archive` — Kontakte archivieren und wiederherstellen
- `contacts.list-search` — Kontaktliste mit Suche und Filtern
- `contacts.activities` — Kontaktaktivitäten und Anrufe
- `teamrituals.weekly` — Wöchentliche Teamfrage
- `teamrituals.games` — Teamspiele (Bingo, Zwei Wahrheiten, Fun Facts)
- `timetracking.entries` — Arbeitszeit erfassen
- `timetracking.vacation` — Urlaub und Resturlaub
- `calendar.view` — Terminkalender anzeigen
- `calendar.create-appointment` — Termin anlegen
- `calendar.guests` — Gäste und Teilnehmende verwalten
- `cases.create` — Vorgang erfassen
- `knowledge.ask` — Wissensfrage stellen

### `admin` — 54 Funktionen

- `tasks.templates` — Aufgabenvorlagen anwenden und pflegen
- `tasks.annual` — Jahresaufgaben und Jahresabschluss
- `automation.rules` — Automatisierungsregel verwalten
- `automation.conditions` — Regelbedingungen und Feldtypen
- `automation.rule-validation` — Regelvalidierung im Editor
- `automation.rule-versions` — Regelversionen und Import/Export
- `automation.runs` — Regelläufe und Fehlerdashboard
- `automation.annual-routines` — Jahresroutinen verwalten
- `automation.office-packages` — Saisonale Büropakete
- `automation.routine-packages` — Dauerhafte Routineabläufe
- `automation.task-packages` — Aufgabenpakete
- `automation.workflows` — Workflow-Definitionen und -Läufe
- `automation.rss` — RSS-Quellen und Monitoring
- `automation.templates` — Automatisierungs-Vorlagen
- `letters.templates` — Briefvorlagen und Anlässe
- `decisions.archive` — Entscheidungen archivieren
- `widget.matrix-website` — Matrix-Website-Widget
- `contacts.duplicates` — Dubletten finden
- `contacts.privacy` — Kontakt-Datenschutz und Aufbewahrung
- `hr.onboarding` — Onboarding-Ablauf
- `hr.templates` — HR-Vorlagen und DSGVO-Erklärung
- `hr.offboarding` — Offboarding mit Übergaben
- `responsibilities.matrix` — Zuständigkeitsmatrix
- `responsibilities.coverage` — Abdeckungsprüfung
- `timetracking.admin` — Zeiterfassung administrieren
- `meetings.templates` — Sitzungsvorlagen
- `topics.convert-catalog` — Thema in Katalog überführen
- `integration.ics` — ICS-Feeds und Einladungsdateien
- `integration.email` — Transaktions-E-Mail-Versand
- `integration.egress-monitoring` — Egress-Überwachung
- `calendar.categories-locations` — Terminkategorien und -orte pflegen
- `admin.workspace` — Administrationsbereich und Zugriff
- `admin.roles` — Benutzerrollen verwalten
- `admin.permissions-explorer` — Rechte-Explorer und Rechteerklärung
- `admin.field-permissions` — Feldschutz
- `admin.feature-flags` — Feature Flags
- `admin.action-permissions` — Aktionsberechtigungen
- `admin.audit-log` — Audit-Trail einsehen und exportieren
- `admin.bulk-audit` — Massenaktions-Audit
- `admin.gdpr` — DSGVO-Löschanträge
- `admin.security-cockpit` — Security-Cockpit
- `admin.system-pulse` — System-Puls
- `admin.data-lint` — Datenqualitätsprüfung
- `admin.performance` — Performance- und Größen-Dashboard
- `admin.tenants` — Mandantenverwaltung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.configuration` — Konfigurierbare Stammdaten pflegen
- `admin.onboarding-login` — Onboarding-Folien und Login-Anpassung
- `admin.templates-senders` — Administrative Vorlagen und Absenderdaten
- `admin.selftest-center` — Selbsttest-Center
- `election.districts-import` — Wahlkreise und Gebiete importieren
- `election.representatives` — Abgeordnete und Parteiassoziationen importieren
- `knowledge.review` — Wissensantwort prüfen und freigeben
- `knowledge.management` — Wissensverwaltung

### `superadmin` — 29 Funktionen

- `appointments.debrief` — Nachbereitung und Büro-Feedback
- `admin.workspace` — Administrationsbereich und Zugriff
- `admin.roles` — Benutzerrollen verwalten
- `admin.permissions-explorer` — Rechte-Explorer und Rechteerklärung
- `admin.feature-flags` — Feature Flags
- `admin.audit-log` — Audit-Trail einsehen und exportieren
- `admin.gdpr` — DSGVO-Löschanträge
- `admin.security-cockpit` — Security-Cockpit
- `admin.system-pulse` — System-Puls
- `admin.edge-function-security` — Edge-Function-Sicherheitsklassifikation
- `admin.performance` — Performance- und Größen-Dashboard
- `admin.tenants` — Mandantenverwaltung
- `admin.users-sessions` — Benutzer, MFA und Sitzungen
- `admin.feature-catalog` — Funktionskatalog und Inventarisierung
- `parlis.ministry-history` — Ministerien-Historie seit 1952 nachschlagen und pflegen
- `election.research-workbench` — Analyse-Workbench und Kommunalpanel
- `election.districts-import` — Wahlkreise und Gebiete importieren
- `election.representatives` — Abgeordnete und Parteiassoziationen importieren
- `election.history.periods` — Wahlperioden verwalten
- `election.history.mandates` — Historische Mandate pflegen
- `election.history.candidacies` — Kandidaturen und Ergebnisse pflegen
- `election.history.people` — Personenregister und Karrieren
- `election.history.state-lists` — Landeslisten verwalten
- `election.history.factions` — Historische Fraktionen
- `election.history.quality` — Wahlhistorien-Datenqualität
- `election.history.audit` — Wahlhistorien-Audit
- `election.history.assembly` — Historien-Assemblierung
- `election.history.districts-geometry` — Historische Wahlkreise und Geometrie
- `election.history.portraits` — Abgeordnetenporträts

### `oeffentlich` — 6 Funktionen

- `platform.auth` — Anmeldung und Sitzung
- `decisions.participants` — Teilnehmende und Antwort-Token verwalten
- `widget.matrix-website` — Matrix-Website-Widget
- `events.rsvp-public` — Öffentliche Veranstaltungs-Rückmeldung
- `events.legacy-rsvp` — Legacy-Einladungslinks
- `polls.respond` — An Umfrage teilnehmen

### `system` — 36 Funktionen

- `tasks.recurring` — Wiederkehrende Aufgabe
- `tasks.nudge` — Aufgabe anmahnen und Erinnerungen versenden
- `tasks.annual` — Jahresaufgaben und Jahresabschluss
- `automation.conditions` — Regelbedingungen und Feldtypen
- `automation.routine-packages` — Dauerhafte Routineabläufe
- `automation.scheduler` — Zeitgesteuerte Automatisierung
- `automation.webhooks` — Automatisierungs-Webhooks
- `automation.calendar-schedule` — Kalenderbezogene Zeitberechnung
- `letters.archive` — Brief archivieren und Folgeaufgabe anlegen
- `decisions.archive` — Entscheidungen archivieren
- `decisions.matrix` — Entscheidungen über Matrix beantworten
- `redaktion.calendar-reminders` — Redaktionskalender und Erinnerungen
- `news.matrix` — News über Matrix verteilen
- `chat.matrix-bot` — Matrix-Bot und morgendliche Begrüßung
- `employees.action-tasks` — Maßnahmen als Aufgaben
- `employees.preparation` — Gesprächsvorbereitung und Erinnerungen
- `dossiers.sources` — Dossier-Quellenbeobachtung
- `topics.ministry-cloud` — Standarddaten für neue Büros
- `integration.calendar-sync` — Externe Kalender synchronisieren
- `integration.email` — Transaktions-E-Mail-Versand
- `integration.push` — Push-Benachrichtigungen
- `integration.geocoding` — Adress-Geocoding
- `integration.egress-monitoring` — Egress-Überwachung
- `integration.edge-contract-tests` — Edge-Function-Vertragstests
- `calendar.reminders` — Terminerinnerungen
- `appointments.feedback` — Termin-Feedback erfassen
- `calendar.holidays` — Feiertage synchronisieren
- `admin.edge-function-security` — Edge-Function-Sicherheitsklassifikation
- `admin.access-boundaries` — Zugriffsschutzprüfung
- `admin.maintenance` — Wartungs- und Aufräumläufe
- `platform.notification-dispatch` — Benachrichtigungs- und Audit-Trigger
- `cases.steps` — Vorgangsschritte und Aufgaben
- `cases.escalation` — Eskalationsvorschläge
- `election.history.assembly` — Historien-Assemblierung
- `election.parliament-protocols` — Plenarprotokolle auswerten
- `knowledge.validity` — Gültigkeit und Veraltung

## Rollen je Funktion

| Funktion | Rollen |
|---|---|
| `admin.access-boundaries` | `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `admin.action-permissions` | `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter` |
| `admin.audit-log` | `admin`, `bueroleitung`, `superadmin` |
| `admin.bulk-audit` | `admin`, `bueroleitung` |
| `admin.configuration` | `admin`, `bueroleitung` |
| `admin.data-lint` | `admin`, `bueroleitung` |
| `admin.edge-function-security` | `system`, `superadmin` |
| `admin.feature-catalog` | `superadmin` |
| `admin.feature-flags` | `admin`, `superadmin` |
| `admin.field-permissions` | `admin`, `bueroleitung` |
| `admin.gdpr` | `admin`, `superadmin` |
| `admin.maintenance` | `system` |
| `admin.onboarding-login` | `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter` |
| `admin.performance` | `admin`, `superadmin` |
| `admin.permissions-explorer` | `admin`, `bueroleitung`, `superadmin` |
| `admin.roles` | `admin`, `bueroleitung`, `superadmin` |
| `admin.security-cockpit` | `admin`, `superadmin` |
| `admin.selftest-center` | `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter` |
| `admin.system-pulse` | `admin`, `superadmin` |
| `admin.templates-senders` | `admin`, `bueroleitung` |
| `admin.tenants` | `superadmin`, `admin` |
| `admin.users-sessions` | `admin`, `superadmin`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `admin.workspace` | `admin`, `bueroleitung`, `superadmin` |
| `annotations.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `annotations.export` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `annotations.history` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `annotations.ocr` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `annotations.relocate` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `annotations.tasks` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `appointments.briefing` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `appointments.briefing-live` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `appointments.debrief` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `superadmin` |
| `appointments.feedback` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `appointments.jour-fixe` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `appointments.preparation` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `appointments.requests` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `automation.annual-routines` | `admin`, `bueroleitung` |
| `automation.calendar-schedule` | `system` |
| `automation.conditions` | `system`, `admin` |
| `automation.office-packages` | `admin`, `bueroleitung` |
| `automation.routine-packages` | `system`, `admin`, `bueroleitung` |
| `automation.rss` | `admin`, `bueroleitung` |
| `automation.rule-validation` | `admin`, `bueroleitung` |
| `automation.rule-versions` | `admin`, `bueroleitung` |
| `automation.rules` | `admin`, `bueroleitung` |
| `automation.runs` | `admin`, `bueroleitung` |
| `automation.scheduler` | `system` |
| `automation.task-packages` | `admin`, `bueroleitung` |
| `automation.templates` | `admin`, `bueroleitung` |
| `automation.webhooks` | `system` |
| `automation.workflows` | `admin`, `bueroleitung` |
| `calendar.categories-locations` | `admin`, `bueroleitung` |
| `calendar.create-appointment` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `calendar.edit-move` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `calendar.guests` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `calendar.holidays` | `system` |
| `calendar.invitations` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `calendar.polls` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `calendar.reminders` | `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `calendar.view` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `casefiles.document-upload` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `casefiles.links` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `casefiles.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `casefiles.notes` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `casefiles.status-workflow` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.close-archive` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `cases.escalation` | `system`, `bueroleitung` |
| `cases.handover` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.interactions` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.legacy-routes` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.link-appointment` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.link-decision` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.link-letter` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.steps` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `cases.timeline` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `cases.triage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `chat.matrix-bot` | `system`, `abgeordneter`, `bueroleitung` |
| `chat.messages` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `chat.team-announcements` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.activities` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `contacts.archive` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `contacts.briefing-memory` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.bulk` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `contacts.detail` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `contacts.distribution-lists` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.duplicates` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `admin` |
| `contacts.edit` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.fundings` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.import` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.list-search` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `contacts.merge` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.privacy` | `admin`, `bueroleitung`, `mitarbeiter` |
| `contacts.stakeholders` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `contacts.tags-topics` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `daily.briefing` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.archive` | `admin`, `bueroleitung`, `system` |
| `decisions.attachments` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.change-vote` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.comments` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.email` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.matrix` | `system`, `abgeordneter` |
| `decisions.notification-digest` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.participants` | `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.remind` | `abgeordneter`, `bueroleitung` |
| `decisions.vote` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `decisions.withdraw-vote` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `documents.contacts` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `documents.details` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `documents.email` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `documents.list` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `documents.upload-version` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `dossiers.capture-radar` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `dossiers.entries` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `dossiers.links-stakeholders` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `dossiers.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `dossiers.search` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `dossiers.sources` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `dossiers.talking-points` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `drucksachen.view` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.analysis` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.analysis-map` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.analysis-navigation` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.deputy-results` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.districts-import` | `admin`, `superadmin` |
| `election.history.assembly` | `superadmin`, `system` |
| `election.history.audit` | `superadmin` |
| `election.history.candidacies` | `superadmin` |
| `election.history.districts-geometry` | `superadmin`, `abgeordneter`, `bueroleitung` |
| `election.history.factions` | `superadmin` |
| `election.history.mandates` | `superadmin` |
| `election.history.people` | `superadmin`, `abgeordneter`, `bueroleitung` |
| `election.history.periods` | `superadmin`, `abgeordneter`, `bueroleitung` |
| `election.history.portraits` | `superadmin` |
| `election.history.quality` | `superadmin` |
| `election.history.state-lists` | `superadmin`, `abgeordneter` |
| `election.map` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.parliament-protocols` | `system`, `bueroleitung` |
| `election.representatives` | `admin`, `superadmin` |
| `election.research-workbench` | `superadmin`, `bueroleitung` |
| `election.seat-distribution` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.state-history` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `election.turnout` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `employees.action-tasks` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `employees.export-stats` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `employees.meetings` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `employees.preparation` | `mitarbeiter`, `bueroleitung`, `system` |
| `employees.protocol` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `employees.requests` | `mitarbeiter`, `bueroleitung`, `abgeordneter` |
| `employees.review` | `abgeordneter`, `bueroleitung` |
| `employees.wellbeing` | `mitarbeiter`, `bueroleitung` |
| `events.checklist` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `events.invitations` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `events.legacy-rsvp` | `oeffentlich` |
| `events.plan` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `events.rsvp-public` | `oeffentlich` |
| `events.speakers-documents` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `facts.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `hr.offboarding` | `bueroleitung`, `admin`, `mitarbeiter` |
| `hr.onboarding` | `bueroleitung`, `admin`, `mitarbeiter` |
| `hr.templates` | `admin`, `bueroleitung` |
| `integration.ai-suggestions` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `integration.calendar-sync` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `integration.edge-contract-tests` | `system` |
| `integration.egress-monitoring` | `system`, `admin` |
| `integration.email` | `system`, `admin` |
| `integration.geocoding` | `system`, `mitarbeiter`, `bueroleitung` |
| `integration.ics` | `admin`, `bueroleitung`, `abgeordneter` |
| `integration.push` | `system`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `integration.transcription` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `integration.unsplash` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.answer` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.ask` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `knowledge.attachments` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.collaboration` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.comments-follow` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.global-question` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.management` | `bueroleitung`, `admin`, `mitarbeiter` |
| `knowledge.permissions` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.persons` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.review` | `bueroleitung`, `admin`, `mitarbeiter` |
| `knowledge.search` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.short-answer` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.sources` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.tags` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `knowledge.validity` | `system`, `bueroleitung`, `mitarbeiter` |
| `knowledge.versions` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `letters.archive` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `letters.attachments` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `letters.collaboration` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `letters.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `letters.export` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `letters.templates` | `admin`, `bueroleitung`, `abgeordneter`, `mitarbeiter` |
| `letters.workflow` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.agenda` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.archive` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.decisions` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.jour-fixe` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.protocol` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `meetings.templates` | `admin`, `bueroleitung` |
| `meetings.zombie-points` | `bueroleitung`, `abgeordneter`, `mitarbeiter` |
| `mobile.app` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `mywork.dashboard` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `mywork.dashboard.today-priorities` | `bueroleitung`, `mitarbeiter`, `praktikant` |
| `mywork.navigation-previews` | Keine besondere Rolle deklariert |
| `mywork.quick-access` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `mywork.tabs` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `news.articles` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `news.email` | `bueroleitung`, `mitarbeiter` |
| `news.matrix` | `bueroleitung`, `mitarbeiter`, `system` |
| `notifications.inbox` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `notifications.preferences` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `parlis.initiative-rankings` | Keine besondere Rolle deklariert |
| `parlis.ministry-history` | `superadmin` |
| `parlis.ministry-topics` | `abgeordneter`, `bueroleitung` |
| `parlis.proceedings` | Keine besondere Rolle deklariert |
| `platform.auth` | `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `platform.notification-dispatch` | `system` |
| `platform.theme-selection` | Keine besondere Rolle deklariert |
| `polls.availability` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `polls.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `polls.respond` | `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `press.ghost` | `bueroleitung`, `mitarbeiter` |
| `press.releases` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `profile.edit` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `quicknotes.checklists` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `quicknotes.drag-sort` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `quicknotes.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `quicknotes.offline` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `quicknotes.page` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `redaktion.approval` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `redaktion.assets-campaigns` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `redaktion.calendar-reminders` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `redaktion.planner` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `redaktion.themenspeicher` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `responsibilities.coverage` | `bueroleitung`, `admin` |
| `responsibilities.matrix` | `bueroleitung`, `admin`, `mitarbeiter` |
| `responsibilities.suggest` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `search.global` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.annual` | `bueroleitung`, `admin`, `system` |
| `tasks.archive` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `tasks.assign` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.ball-owner` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.complete` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.create` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.deadline` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.edit` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.handover-stafette` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `tasks.link-case` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `tasks.link-decision` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `tasks.link-document` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.nudge` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system` |
| `tasks.recurring` | `system` |
| `tasks.search-filter` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.snooze` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.subtasks` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `tasks.templates` | `bueroleitung`, `mitarbeiter`, `admin` |
| `teamrituals.games` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `teamrituals.weekly` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `timetracking.admin` | `bueroleitung`, `admin` |
| `timetracking.annual-tasks` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `timetracking.entries` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `timetracking.vacation` | `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant` |
| `topics.convert-catalog` | `bueroleitung`, `admin` |
| `topics.manage` | `abgeordneter`, `bueroleitung`, `mitarbeiter` |
| `topics.ministry-cloud` | `system` |
| `widget.matrix-website` | `oeffentlich`, `admin`, `bueroleitung` |
