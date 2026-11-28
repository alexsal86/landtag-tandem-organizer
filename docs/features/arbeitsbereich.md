# Meine Arbeit & Benachrichtigungen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/arbeitsbereich.json`). Nicht von Hand bearbeiten._

**Zweck:** Tagesarbeitsfläche, Schnellzugriffe, Benachrichtigungen, globale Suche und Schnellnotizen als gemeinsamer Einstieg in alle Fachbereiche.

## Kennzahlen

- Funktionen: **16** in **8** Unterbereichen
- implementiert: **15**, teilweise: **1**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **7**
- ohne Dokumentationsverweis: **11**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `notifications.inbox` Benachrichtigungen lesen und als gelesen markieren | Benachrichtigungen | fachlich | implementiert | UI | Selbsttest |
| `notifications.preferences` Benachrichtigungseinstellungen und Stummschaltung | Benachrichtigungen | fachlich | implementiert | UI | teilweise |
| `mywork.dashboard.today-priorities` Heute zuerst | Meine Arbeit | fachlich | implementiert | rollenabhängig | Selbsttest |
| `mywork.tabs` Meine Arbeit – Bereichsnavigation und Einstellungen | Meine Arbeit | fachlich | implementiert | UI | kein Test |
| `mywork.dashboard` Meine Arbeit – Dashboard | Meine Arbeit | fachlich | implementiert | rollenabhängig | Selbsttest |
| `mywork.quick-access` Schnellzugriff und zuletzt besuchte Seiten | Meine Arbeit | fachlich | implementiert | UI | kein Test |
| `mobile.app` Mobile App (Expo) | Mobile | fachlich | teilweise | ohne Einbindung | kein Test |
| `mywork.navigation-previews` Vorschauen für Kalender, Aufgaben, Akten, Chat und Kontakte | Navigation | fachlich | implementiert | UI | kein Test |
| `profile.edit` Eigenes Profil bearbeiten | Profil | fachlich | implementiert | UI | kein Test |
| `quicknotes.checklists` Checklisten in Schnellnotizen | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.page` Eigene Notizseite mit Deep Links | Schnellnotizen | fachlich | implementiert | UI | Selbsttest |
| `quicknotes.drag-sort` Notizen per Drag-and-drop sortieren | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.offline` Offline-Synchronisation für Schnellnotizen | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.manage` Schnellnotizen anlegen, bearbeiten und verlinken | Schnellnotizen | fachlich | implementiert | UI | Selbsttest |
| `search.global` Globale Suche und Befehlspalette | Suche | fachlich | implementiert | UI | kein Test |
| `platform.auth` Anmeldung und Sitzung | Zugang | sicherheit | implementiert | UI | kein Test |

## Unterbereiche

- Meine Arbeit
- Navigation
- Benachrichtigungen
- Suche
- Schnellnotizen
- Zugang
- Profil
- Mobile

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `oeffentlich`

## Datenbanktabellen

`appointment_contacts`, `appointment_preparations`, `appointments`, `case_file_contacts`, `case_files`, `contacts`, `dashboard_layouts`, `external_events`, `message_confirmations`, `notification_navigation_mapping`, `notification_types`, `notifications`, `profiles`, `quick_note_global_shares`, `quick_note_shares`, `quick_note_versions`, `quick_note_write_receipts`, `quick_notes`, `search_analytics`, `task_snoozes`, `tasks`, `user_mywork_settings`, `user_navigation_visits`, `user_notification_settings`, `user_planning_preferences`, `user_preferences`, `user_sessions`, `user_tenant_memberships`, `widget_configurations`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `appointment-briefing-lifecycle` | Briefing-Lifecycle (vergeben → Aufgabe → vorlegen → freigeben) | 3 | 5 | — |
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 11 | 9 | — |
| `notification-inbox` | Benachrichtigungs-Inbox (Erzeugen, Gelesen-Markieren, Zurücksetzen und Zugriffsgrenze) | 1 | 6 | — |
| `quick-note-lifecycle` | Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv) | 4 | 0 | — |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | 6 | 8 | — |
| `task-stafette-lifecycle` | Aufgaben-Stafette (Am Zug, Wiedervorlage, Freigabe) | 5 | 8 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `appointment-briefing-lifecycle` | `personal-sent-changes` | Gemeldete Änderungen nur heute und persönlich ausblendbar | logic | — |
| `appointment-briefing-lifecycle` | `day-appointment-progress` | Dein Tag: vergangen, laufend und als nächstes | logic | — |
| `appointment-briefing-lifecycle` | `appointment-change-rules` | Terminänderung: Schnellwahl, eigene Zeit, Ort und Hinweis-Chip | logic | — |
| `appointment-briefing-lifecycle` | `dashboard-briefing-status` | Dashboard-Briefing: Auftrag, Entscheidung und Freigabe | logic | — |
| `appointment-briefing-lifecycle` | `appointment-dashboard-focus` | Termin-Fokus: Größe, Abfahrt und laufender Termin | logic | — |
| `appointment-briefing-lifecycle` | `office-debrief-inbox` | Nachbereitung: Zusagen priorisieren und Quelle anzeigen | logic | — |
| `appointment-briefing-lifecycle` | `today-priorities` | Heute zuerst: Rangfolge und Berliner Tagesgrenzen | logic | — |
| `appointment-briefing-lifecycle` | `office-feedback` | Bürorückmeldung: Abschluss, Erinnerung und ältere Termine | logic | — |
| `appointment-briefing-lifecycle` | `office-feedback-promise-suggestions` | Bürorückmeldung: Vorschläge für Zusagen | logic | — |
| `appointment-briefing-lifecycle` | `office-debrief-edit-promise` | Nachbereitung: Zusage und Frist im Büro bearbeiten | logic | — |
| `appointment-briefing-lifecycle` | `day-summary` | Tagesüberblick: leere Tage, laufende Termine, Briefings und offene Rückmeldungen | logic | — |
| `appointment-briefing-lifecycle` | `reminder` | Briefing-Hinweis: Zuständigkeit, Vorlauf und Montag | logic | — |
| `appointment-briefing-lifecycle` | `rules` | Regeln: nur Entscheider geben frei; Frist am Vortag 12:00 | logic | — |
| `appointment-briefing-lifecycle` | `model` | Regeln: Kurz/Dossier-Umrechnung, Live nur am Termintag, Folgeaufgabe, Abschluss | logic | — |
| `appointment-briefing-lifecycle` | `create` | Termin anlegen (Briefing offen) | db | — |
| `appointment-briefing-lifecycle` | `change-alert` | Eil-Änderung mit neuer Zeit und Hinweis speichern | workflow | — |
| `appointment-briefing-lifecycle` | `assign` | Briefing vergeben → Aufgabe entsteht | workflow | — |
| `appointment-briefing-lifecycle` | `submit` | Vorlegen → Ball bei Abgeordnete/r | workflow | — |
| `appointment-briefing-lifecycle` | `approve` | Freigeben → Aufgabe erledigt | workflow | — |
| `appointment-briefing-lifecycle` | `none` | „Kein Briefing“ setzt Status und löst Aufgabe | workflow | — |
| `appointment-briefing-lifecycle` | `accept-with-briefing` | Zusage im Jour Fixe vergibt Briefing in einem Schritt | workflow | — |
| `decision-lifecycle` | `dashboard-nudges` | Anstupsen: zehn Sekunden und 24-Stunden-Sperre | logic | — |
| `decision-lifecycle` | `dashboard-voting` | Dashboard: nur eigene ausstehende Abstimmungen, keine eigenen Anfragen | logic | — |
| `decision-lifecycle` | `create` | Entscheidung anlegen (active) | db | — |
| `decision-lifecycle` | `add-participant` | Teilnehmer (sich selbst) hinzufügen | db | — |
| `decision-lifecycle` | `withdraw-responses` | Ja, Nein und Rückfrage speichern und nachweisbar zurücknehmen | workflow | — |
| `decision-lifecycle` | `withdraw-task-vote` | Rücknahme eines Votums an einer verknüpften Aufgabe | workflow | — |
| `decision-lifecycle` | `check-options` | Default-Antwortoptionen prüfen | db | — |
| `decision-lifecycle` | `change-vote-history` | Antwort ändern und den bisherigen Stand im Verlauf behalten | workflow | — |
| `decision-lifecycle` | `decision-attachments` | Anhang-Metadaten an die Entscheidung hängen, lesen und entfernen | workflow | — |
| `decision-lifecycle` | `comments-and-reactions` | Kommentar, Antwort und Emoji-Reaktion speichern und entfernen | workflow | — |
| `decision-lifecycle` | `notifications` | Meldungen entstehen im Mandanten der Entscheidung | workflow | — |
| `decision-lifecycle` | `invitation-dispatch` | Einladungsversand wird serverseitig eingestellt und übernommen | workflow | — |
| `decision-lifecycle` | `lifecycle-notifications` | Frist, Rückzug, Ergebnis und direkte Antwort melden | workflow | — |
| `decision-lifecycle` | `delivery-preferences` | Persönliche Zustellfrequenz und Ruhezeiten respektieren | workflow | — |
| `decision-lifecycle` | `notification-metrics` | Zustellungen, Abschaltquote, Antwortzeit, Anstupser und Trigger-Fehler messen | workflow | — |
| `decision-lifecycle` | `notification-actions` | Aus der Meldung abstimmen und Antwort aktualisieren | workflow | — |
| `decision-lifecycle` | `digest` | Meldungen werden gebündelt und nur der Digest wird gepusht | workflow | — |
| `decision-lifecycle` | `set-open` | Status auf 'open' | db | — |
| `decision-lifecycle` | `archive` | Archivieren | db | — |
| `decision-lifecycle` | `verify` | Verifikation | db | — |
| `decision-lifecycle` | `nudge-boundary` | Fremde oder unbekannte Entscheidung lässt sich nicht anstupsen | workflow | — |
| `decision-lifecycle` | `nudge-open-decision` | Offene Entscheidung anmahnen: Eintrag, Meldung und 24-Stunden-Sperre | workflow | — |
| `notification-inbox` | `create-notification` | Benachrichtigung erzeugen | db | — |
| `notification-inbox` | `notification-types` | Alle vom Client erzeugten Meldungstypen existieren im Büro | db | — |
| `notification-inbox` | `mark-read` | Benachrichtigung als gelesen markieren | db | — |
| `notification-inbox` | `reset-unread` | Benachrichtigung wieder auf ungelesen zurücksetzen | db | — |
| `notification-inbox` | `access-boundary` | Fremde Benachrichtigungen bleiben unlesbar und unverändert | db | — |
| `notification-inbox` | `tenant-rpc` | Mandantengebundene Meldung nur im eigenen Büro | db | — |
| `quick-note-lifecycle` | `dictation-commands` | Notizen: Diktatbefehle und Rechtszitate erkennen | logic | — |
| `quick-note-lifecycle` | `note-deep-links` | Notizen: Deep Links zeigen auf die eigene Notizseite | logic | — |
| `quick-note-lifecycle` | `notification-types` | Notiz-Meldungstypen sind für den Mandanten geseedet | db | — |
| `quick-note-lifecycle` | `share-notification-tenant` | Notiz-Freigabe meldet im Mandanten der Notiz | db | — |
| `quick-note-lifecycle` | `create` | Notiz mit Priorität, Farbe und Schlagworten anlegen | db | — |
| `quick-note-lifecycle` | `pin` | Anheften + Priorität erhöhen | db | — |
| `quick-note-lifecycle` | `to-task` | Aus Notiz eine Aufgabe machen (verknüpft) | db | — |
| `quick-note-lifecycle` | `decision-links` | Entscheidung atomar verknüpfen und Folgeaufgabe mit Herkunft erzeugen | workflow | — |
| `quick-note-lifecycle` | `archive` | Archivieren | db | — |
| `task-lifecycle` | `status-registry` | Status-Registry führt die fünf Kernstatus | db | — |
| `task-lifecycle` | `create` | Aufgabe anlegen | db | — |
| `task-lifecycle` | `document-link` | Dokument an Aufgabe hängen und wieder lösen | db | — |
| `task-lifecycle` | `subtasks` | Unteraufgaben: Verknüpfung, Hauptliste und Fortschritt | workflow | — |
| `task-lifecycle` | `assign` | Aufgabe zuweisen + Frist setzen | db | — |
| `task-lifecycle` | `deadline-review` | Fristen: Berliner Gruppierung, Verwerfen und Rückgängig | workflow | — |
| `task-lifecycle` | `decision` | Entscheidung aus Aufgabe erstellen | db | — |
| `task-lifecycle` | `jour-fixe` | Für Jour fixe markieren | db | — |
| `task-lifecycle` | `complete` | Status → completed | db | — |
| `task-lifecycle` | `completion-stamp` | Abschluss stempelt completed_at, Wiederöffnen löscht den Stempel | db | — |
| `task-lifecycle` | `recurrence-spawn` | Wiederholung legt beim Abschluss genau eine Folgeaufgabe an | workflow | — |
| `task-lifecycle` | `decision-ball` | Votum holt den Ball zurück; Folgeaufgabe entsteht genau einmal | workflow | — |
| `task-lifecycle` | `decision-ball-withdrawal` | Rücknahme des Votums stellt Ball und Schritt wieder her | workflow | — |
| `task-lifecycle` | `tenant-boundary` | Aufgabe lässt sich keinem fremden Büro zuordnen | workflow | — |
| `task-stafette-lifecycle` | `nudge` | Anstupsen: Empfänger sieht Aufgabe oben, 24h-Limit | logic | — |
| `task-stafette-lifecycle` | `checklist-batch` | Checkpunkt im Verlauf, Frist +1 Woche | logic | — |
| `task-stafette-lifecycle` | `reminder` | Fällige Erinnerung holt wartende Aufgabe in Mein Zug | logic | — |
| `task-stafette-lifecycle` | `set-step` | Frist bleibt sichtbar; eine ausdrückliche Wiedervorlage verschiebt die Anzeige | logic | — |
| `task-stafette-lifecycle` | `handover` | Zur Freigabe vorlegen → Wartet auf andere + Verlauf | logic | — |
| `task-stafette-lifecycle` | `return` | Rückgabe ans Büro → wieder Mein Zug | logic | — |
| `task-stafette-lifecycle` | `complete` | Abschluss: verschwindet aus allen Zonen + Verlauf | logic | — |
| `task-stafette-lifecycle` | `recurrence` | Wiederholung: nächste Frist korrekt berechnet | logic | — |
| `task-stafette-lifecycle` | `template-validation` | Aufgabenpakete: Fristen und Unteraufgaben verbindlich | logic | — |
| `task-stafette-lifecycle` | `template-automation-rule` | Aufgabenpaket ist eine manuelle Automatisierungsregel | logic | — |
| `task-stafette-lifecycle` | `template-subtasks` | Vorlage legt Hauptaufgabe mit verknüpften Unteraufgaben an | logic | — |
| `task-stafette-lifecycle` | `week-review` | Wochenreview findet fehlende Schritte, namenlose Bälle, Stille und Duplikate | logic | — |
| `task-stafette-lifecycle` | `task-command` | Einzeiler-Befehle und SLA-Stufen | logic | — |
| `task-stafette-lifecycle` | `batch-create` | Sammelaktion: Aufgabe ohne Frist wird übersprungen | db | — |
| `task-stafette-lifecycle` | `batch-keeps-step` | Sammelaktion: Freigabe behält den vorhandenen nächsten Schritt | db | — |
| `task-stafette-lifecycle` | `batch-undo` | Sammelaktion: Frist +1 Woche samt Rücknahme | db | — |
| `task-stafette-lifecycle` | `nudge-boundary` | Anstupsen erreicht keine Aufgabe außerhalb des eigenen Büros | workflow | — |
| `task-stafette-lifecycle` | `multi-assign` | Mehrfachzuweisung hält task_assignees und assigned_to synchron | db | — |
| `task-stafette-lifecycle` | `deputy-handover` | Vertretungsübergabe: nur Leitung, nie an sich selbst, verschiebt den Ball | workflow | — |
| `task-stafette-lifecycle` | `nudge-ack` | Anstupsen: 24-Stunden-Sperre der Datenbank und Quittung im Verlauf | workflow | — |
| `task-stafette-lifecycle` | `snooze-rows` | Wiedervorlage: task_snoozes je Person, genau ein Ziel | db | — |
| `task-stafette-lifecycle` | `archive-restore` | Archivieren entfernt Aufgabe und Wiedervorlage, Wiederherstellen holt sie zurück | workflow | — |

## Deklarierter Prüfumfang

### `appointment-briefing-lifecycle`

1. Regeln für Freigabe und Fristvorschlag
2. Aufgabe entsteht beim Vergeben
3. Ball wechselt bei Vorlage
4. Freigabe erledigt Aufgabe
5. Kein Briefing schließt Aufgabe

### `decision-lifecycle`

1. Ja, Nein und Rückfrage werden gespeichert und nachweisbar zurückgenommen
2. Die Rücknahme eines Votums an einer verknüpften Aufgabe gibt Ball und nächsten Schritt zurück und entfernt den Votum-Eintrag
3. Eine geänderte Antwort schreibt den bisherigen und den neuen Stand in task_decision_response_history
4. Anhang-Metadaten hängen an der Entscheidung, sind für Teilnehmende lesbar und wieder entfernbar (ohne Datei-Upload)
5. Kommentar und Antwort werden gespeichert; Emoji-Reaktionen folgen der Allowlist, sind je Person eindeutig und wieder entfernbar
6. Das Anmahnen speichert den Eintrag mit Absender und Notiz und weist die zweite Mahnung innerhalb von 24 Stunden ab
7. Anstupsen ist auf die eigene offene Entscheidung beschränkt; ohne wartenden Abgeordneten wird abgewiesen
8. Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und Abschlussmeldung entstehen im Mandanten der Entscheidung
9. Teilnehmer-Insert stellt genau eine Einladungs-Versandzeile ein, die der Worker übernimmt und verbucht

### `notification-inbox`

1. Eine Benachrichtigung wird mit Mandant, Typ und Deep-Link-Daten angelegt und ist ungelesen
2. Als-gelesen-Markieren setzt is_read und read_at und ist erneut lesbar
3. Zurücksetzen setzt die Benachrichtigung wieder auf ungelesen und leert read_at
4. Alle clientseitig erzeugten Meldungstypen sind im Büro aktiv vorhanden
5. Fremde Benachrichtigungen liefern keine Zeilen, und ein Update mit fremdem Nutzerbezug ändert die eigene Zeile nicht
6. Die mandantengebundene Meldung entsteht im eigenen Mandanten und wird für einen fremden Mandanten mit 42501 abgewiesen

### `quick-note-lifecycle`

Keine Prüfungen deklariert.

### `task-lifecycle`

1. Status-Registry führt die fünf Kernstatus
2. Dokument hängt an der Aufgabe, bleibt auf eigene Aufgaben beschränkt und lässt sich wieder lösen
3. Unteraufgaben tragen parent_task_id, erscheinen nicht als eigene Hauptaufgabe und treiben den Fortschritt auf 50 bzw. 100 Prozent
4. Fristen werden nach Berliner Tagen gruppiert; Verwerfen löscht nur die Frist und Rückgängig stellt sie wieder her
5. Abschluss setzt completed_at, Wiederöffnen entfernt es
6. Wiederholungsregel legt beim Abschluss genau eine Folgeaufgabe an
7. Votum zu einer verknüpften Entscheidung holt den Ball zurück und erzeugt die Folgeaufgabe genau einmal
8. Rücknahme des Votums gibt Ball, nächsten Schritt und Frist zurück und entfernt den Votum-Eintrag; eine weitergelaufene Aufgabe bleibt stehen und wird nur vermerkt

### `task-stafette-lifecycle`

1. Zonen Mein Zug / Wartet / Wiedervorlage
2. Verlaufseinträge bei Übergaben und Erledigungen
3. Sammelaktionen: Vorschau ohne erfundene Frist, ohne überschriebene Schritte, mit Rücknahme
4. Wochenreview, Eskalationsgründe, Einzeiler-Befehle und SLA-Stufen als reine Regeln
5. Mehrfachzuweisung hält task_assignees und assigned_to synchron
6. Vertretungsübergabe verschiebt nur eigene Bälle und verweigert Selbstübergabe
7. Anstupsen: 24-Stunden-Sperre in der Datenbank und Quittung im Verlauf
8. Wiedervorlage kennt genau ein Ziel; Archivieren räumt sie mit ab, Wiederherstellen bringt die Aufgabe zurück

## Funktionsdetails

### `mywork.dashboard` — Meine Arbeit – Dashboard
Aggregiert Fristen, Termine, Aufgaben, Entscheidungen und Jour-fixe-Hinweise auf einer Arbeitsfläche; Kennzahlen kommen aus get_dashboard_data und get_my_work_counts.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/mywork`, `/mywork?tab=dashboard`, `/dashboard/*`
- **Frontend-Komponenten:** `src/features/dashboard/components/MyWorkView.tsx`, `src/components/dashboard/DashboardTasksSection.tsx`, `src/components/dashboard/DashboardDecisionsWidget.tsx`, `src/components/dashboard/DashboardJourFixeWidget.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDashboardData.ts`, `src/hooks/useDashboardDeadlines.ts`, `src/hooks/useDashboardRealtime.ts`, `src/hooks/useCounts.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_dashboard_data`, `get_my_work_counts`, `get_my_work_new_counts`
- **Tabellen:** `dashboard_layouts`, `user_mywork_settings`, `widget_configurations`
- **Abhängigkeiten:** —
- **Selbsttests:** `task-lifecycle`, `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/dashboard/components/MyWorkView.tsx
- src/features/dashboard/components/BlackBoard.tsx
- src/components/my-work/MyWorkDashboardTab.tsx
- src/hooks/useDashboardData.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Kein Szenario prüft die Dashboard-Aggregation selbst; die Zuordnung stützt sich auf die dort erzeugten Datensätze.

### `mywork.dashboard.today-priorities` — Heute zuerst
Priorisiert im Mitarbeiter-Dashboard fällige Terminbriefings, Zusagen ohne Frist, eingegangene Nachbereitungen, fehlende Rückmeldungen und seit mehr als 30 Tagen überfällige Fristen. Öffnet den Briefing-Editor, die Nachbereitung oder den Fristen-Assistenten direkt aus der Übersicht.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/my-work/MyWorkDashboardTab.tsx`, `src/components/my-work/TodayPrioritiesCard.tsx`, `src/components/dashboard/DeadlineReviewDialog.tsx`
- **Services:** —
- **Hooks:** `src/features/appointments/briefing/useOfficeDebriefInbox.ts`, `src/hooks/useDashboardDeadlines.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `list_office_debriefs`, `update_office_debrief`
- **Tabellen:** —
- **Abhängigkeiten:** `mywork.dashboard`, `appointments.briefing`, `appointments.debrief`
- **Selbsttests:** `appointment-briefing-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/my-work/TodayPrioritiesCard.tsx
- src/components/my-work/todayPriorities.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Selbsttest prüft die Reihenfolge und die Berliner Tagesgrenzen. Die Dialoge verwenden die vorhandenen Aktionen.

### `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
Schaltet zwischen Dashboard, Aufgaben, Vorgängen, Entscheidungen, Jour fixe, Planungen, Redaktion und Feedback um und speichert die persönliche Bereichsauswahl.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/mywork?tab=tasks`, `/mywork?tab=cases`, `/mywork?tab=decisions`, `/mywork?tab=jourfixe`, `/mywork?tab=plannings`, `/mywork?tab=redaktion`
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkSettings.tsx`, `src/hooks/useViewPreference.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_mywork_settings`, `user_planning_preferences`
- **Abhängigkeiten:** `mywork.dashboard`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/my-work/MyWorkDashboardTab.tsx
- src/components/my-work/MyWorkDecisionsTab.tsx
- src/components/my-work/MyWorkJourFixeTab.tsx
- src/hooks/useMyWorkSettings.tsx

**Bekannte Einschränkungen**

- Die Tab-Auswahl ist eine reine UI-Präferenz und hat keine eigene Geschäftsregel.

**Offene Prüfpunkte**

- Keine.

### `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
Merkt sich zuletzt besuchte Bereiche und stellt konfigurierbare Schnellzugriffe in der Navigation bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/QuickAccessMenuItem.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useQuickAccessPages.ts`, `src/hooks/useRecentlyVisited.ts`, `src/hooks/useNavCollapse.ts`, `src/hooks/useNavWidth.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_navigation_visits`, `user_preferences`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useQuickAccessPages.ts
- src/hooks/useRecentlyVisited.ts
- src/components/shared/QuickAccessMenuItem.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `mywork.navigation-previews` — Vorschauen für Kalender, Aufgaben, Akten, Chat und Kontakte
Zeigt Vorschauen mit dem nächsten Termin samt Briefingstatus, einer offenen Aufgabe mit Frist und Zuständigkeit, einer kürzlich aktualisierten Fallakte, einem ungelesenen Chat oder einem Kontakt mit Bezug zum nächsten Termin oder einer Fallakte. Verlinkt den jeweiligen Eintrag und die Unterbereiche.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** Keine besondere Rolle deklariert
- **Routen:** —
- **Frontend-Komponenten:** `src/components/navigation/AppNavigation.tsx`, `src/components/navigation/appNavigation/NavGroupPreview.tsx`
- **Services:** —
- **Hooks:** `src/components/navigation/appNavigation/useNavPanelData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `appointments`, `external_events`, `appointment_preparations`, `tasks`, `case_files`, `appointment_contacts`, `case_file_contacts`, `contacts`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/navigation/AppNavigation.tsx
- src/components/navigation/appNavigation/NavGroupPreview.tsx
- src/components/navigation/appNavigation/useNavPanelData.ts
- src/contexts/MatrixUnreadContext.tsx
- src/components/chat/MatrixChatView.tsx

**Bekannte Einschränkungen**

- In der Desktop-Navigation per Maus oder Pfeil nach rechts verfügbar. Die Terminvorschau blickt fünf Tage voraus und die Aktenvorschau berücksichtigt eigene oder zugewiesene Fallakten.
- Chat-Hervorhebungen stammen von Matrix. Die Vorschau zeigt Raumnamen und Zähler. Der zuletzt geöffnete Chat wird für die aktuelle Sitzung gemerkt.
- Ohne Kontakt am nächsten Termin oder in der jüngsten eigenen oder zugewiesenen Fallakte wird ein eigener Favorit angezeigt.
- Kein Selbsttest: die Vorschauen sind ein reiner Oberflächenpfad der Desktop-Navigation. Geprüft werden nur die zugrunde liegenden Datensätze in den Szenarien der jeweiligen Bereiche.

**Offene Prüfpunkte**

- Keine.

### `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
Zeigt In-App-Benachrichtigungen, ungelesene Zähler und Deep-Links in den auslösenden Fachbereich; Lesen wird pro Nutzer persistiert. Liste, Ungelesen-Zähler, Realtime-Kanal sowie Gelesen-Markieren und Löschen sind auf den aktiven Mandanten begrenzt; beim Mandantenwechsel werden sie geleert und neu geladen. Meldungen aus dem Client laufen über create_tenant_notification und tragen den Mandanten des Fachobjekts; die Funktion weist Fremdmandanten mit 42501 ab. Jeder clientseitig erzeugte Meldungstyp ist im Büro geseedet und hat ein ausdrückliches Deep-Link-Ziel. Die Kategorie-Schlüssel entsprechen den Anzeige-Gruppen der Einstellungsseite (calendar, cases, documents, editorial, team …).

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/notifications`
- **Frontend-Komponenten:** `src/pages/NotificationsPage.tsx`, `src/components/notifications/NotificationCenter.tsx`, `src/components/notifications/NotificationBell.tsx`, `src/components/notifications/NotificationDot.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useNotifications.tsx`, `src/hooks/useNavigationNotifications.tsx`, `src/hooks/useNewItemIndicators.tsx`, `src/hooks/useNotificationHighlight.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_unread_notification_counts`, `get_authored_messages`, `create_tenant_notification`
- **Tabellen:** `notifications`, `notification_types`, `notification_navigation_mapping`, `message_confirmations`
- **Abhängigkeiten:** —
- **Selbsttests:** `notification-inbox`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ci-quality-gates.md`, `docs/tenant-notifications.md`

**Nachweise im Quellcode**

- src/pages/NotificationsPage.tsx
- src/components/notifications/NotificationCenter.tsx
- src/hooks/useNotifications.tsx
- scripts/check-notification-types.mjs
- src/features/selftest/notificationTypeExpectations.ts
- supabase/migrations/20261128214000_create_tenant_notification.sql

**Bekannte Einschränkungen**

- Erzeugen, Gelesen-Markieren und Zurücksetzen laufen über die Inbox-Tabelle; die Zustellung je Fach-Trigger (Aufgaben, Termine, Nachrichten, Freigaben) sowie Push und Oberfläche prüft das Szenario nicht. Die mandantenscharfe Begrenzung von Liste, Zähler und Realtime ist eine Client-Regel und wird dort nicht geprüft. Der Schritt notification-types prüft nur die Existenz der Typen im Büro, nicht ihre Auslösung; check:notification-types prüft Seed, Client-Aufrufe und Deep-Link-Ziele statisch.

**Offene Prüfpunkte**

- Benachrichtigungen entstehen über viele Datenbank-Trigger; die Zuordnung ist bereichsübergreifend und nicht vollständig je Trigger geprüft.

### `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
Steuert Anzeige- und Versandpräferenzen je Benachrichtigungstyp und verwaltet zurückgestellte Fristen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/notifications/NotificationSettings.tsx`, `src/components/notifications/SnoozeManagementSidebar.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useNotificationDisplayPreferences.ts`, `src/hooks/useSnoozeDeadline.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_notification_settings`, `task_snoozes`
- **Abhängigkeiten:** —
- **Selbsttests:** `task-stafette-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/notifications/NotificationSettings.tsx
- src/hooks/useNotificationDisplayPreferences.ts

**Bekannte Einschränkungen**

- Geprüft ist die Wiedervorlage je Person in task_snoozes (genau ein Ziel, Aufräumen). user_notification_settings und die Stummschaltung je Benachrichtigungstyp haben im Selbsttest keinen Schritt; sie werden nur über die Oberfläche gesetzt.

**Offene Prüfpunkte**

- Keine.

### `search.global` — Globale Suche und Befehlspalette
Durchsucht Kontakte, Aufgaben, Dokumente und weitere Objekte über eine Befehlspalette, öffnet Treffer über eine zentrale Ziel-Registry und protokolliert Suchanfragen für die Auswertung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/search/GlobalSearchCommand.tsx`, `src/components/search/GlobalQuickNoteDialog.tsx`
- **Services:** `src/components/search/postgrestSearch.ts`, `src/lib/appTargets.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `search_analytics`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/search/GlobalSearchCommand.tsx
- src/components/search/postgrestSearch.ts
- src/lib/appTargets.ts

**Bekannte Einschränkungen**

- Die Suche bleibt ein PostgREST-Fan-out je Entität: kein serverseitiges Ranking, keine Tippfehler-Toleranz und keine Volltextsuche über Dokument- oder Briefinhalte.
- Fehlgeschlagene Quellen werden sichtbar gemeldet und können erneut geladen werden; die übrigen Bereiche bleiben nutzbar.

**Offene Prüfpunkte**

- Die Suche nutzt PostgREST-Abfragen je Entität; eine vollständige Liste der durchsuchten Tabellen ist nicht zentral deklariert.
- Sprungziele sind zentral in appTargets.ts hinterlegt; neue Trefferarten und Quick-Access-Ziele müssen dort ergänzt werden.
- Kategorie- und Statusfilter gelten nur im gewählten Bereich, weil die Wertelisten je Bereich unterschiedlich sind.

### `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
Erfasst Notizen mit Priorität, Anheften, Verknüpfungen zu Entscheidungen und Aufgaben sowie Teilen mit anderen Nutzern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/QuickNotesList.tsx`, `src/components/shared/NoteCard.tsx`, `src/components/shared/NoteShareDialog.tsx`, `src/components/shared/NoteDecisionCreator.tsx`
- **Services:** —
- **Hooks:** `src/features/quick-notes/useQuickNoteActions.ts`, `src/features/quick-notes/useQuickNoteEditor.ts`, `src/features/quick-notes/useQuickNoteLinks.ts`, `src/features/quick-notes/useQuickNoteFollowUps.ts`, `src/features/quick-notes/useQuickNotesData.ts`, `supabase/migrations/20261125140000_topic_mention_selftest.sql`
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_quick_note`, `delete_quick_note_with_links`, `list_quick_notes`, `quick_note_access`, `create_note_work`, `quick_note_member`, `quick_note_owned`, `topic_mention_selftest`, `quick_note_share_notification_selftest`
- **Tabellen:** `quick_notes`, `quick_note_shares`, `quick_note_global_shares`, `quick_note_versions`, `quick_note_write_receipts`, `notification_types`
- **Abhängigkeiten:** —
- **Selbsttests:** `quick-note-lifecycle`
- **Unit-Tests:** `src/features/quick-notes/repository.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/quick-notes`

**Nachweise im Quellcode**

- src/features/quick-notes/useQuickNoteActions.ts
- src/features/quick-notes/useQuickNoteEditor.ts
- src/components/shared/QuickNotesList.tsx
- supabase/functions/_shared/tenant-seed.ts
- supabase/migrations/20261128160000_quick_note_notification_types.sql
- src/utils/shareNotifications.ts
- supabase/migrations/20261128170000_quick_note_share_notification_tenant.sql

**Bekannte Einschränkungen**

- Das Szenario prüft den Lebenszyklus, nicht jede Teilen-Variante.
- Die Meldungstypen note_follow_up und quick_note_shared werden je Mandant per Migration nachgezogen und für neue Mandanten per Tenant-Trigger angelegt; der Selbsttest prüft nur den aktuellen Mandanten.
- Freigabe-Meldungen entstehen per Trigger auf quick_note_shares im Mandanten der Notiz. Erwähnungen in Vorgangs-Interaktionen meldet der Trigger auf case_item_interactions ebenfalls dort, wo der Vorgang liegt.

**Offene Prüfpunkte**

- Keine.

### `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
Hält Notizen lokal vor, synchronisiert Schreibvorgänge mit Belegquittungen und zeigt den Sync-Status an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/quick-notes/QuickNotesSyncStatus.tsx`
- **Services:** `src/features/quick-notes/storage.ts`, `src/features/quick-notes/repository.ts`, `src/features/quick-notes/api.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`, `quick_note_write_receipts`, `quick_note_versions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/repository.test.ts`, `src/features/quick-notes/tenant-offline.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/storage.ts
- src/features/quick-notes/repository.ts
- src/features/quick-notes/QuickNotesSyncStatus.tsx
- scripts/viteQuickNotesOffline.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Offline-Verhalten ist nur über Unit-Tests belegt; ein echter Browser-Offline-Test existiert nicht.

### `quicknotes.checklists` — Checklisten in Schnellnotizen
Wandelt Notizinhalte in Checklisten um und hält Erledigt-Zustände beim Speichern stabil.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/quick-notes/checklists.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`
- **Abhängigkeiten:** `quicknotes.manage`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/checklists.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/checklists.ts
- src/features/quick-notes/checklists.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
Ordnet angeheftete Notizen per Ziehen neu und persistiert die Reihenfolge.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/quick-notes/noteDrag.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`
- **Abhängigkeiten:** `quicknotes.manage`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/noteDrag.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/noteDrag.ts
- src/features/quick-notes/noteDrag.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `quicknotes.page` — Eigene Notizseite mit Deep Links
Öffnet Schnellnotizen unter /notes mit Erfassung, Filtern, Archiv und Hervorhebung der verlinkten Notiz. Benachrichtigungen, Tageszettel und Suche verlinken dorthin; der Quick-Notes-Reiter in Meine Arbeit bleibt als eigener Einstieg mit unveränderter Oberfläche bestehen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/notes`
- **Frontend-Komponenten:** `src/pages/QuickNotes.tsx`, `src/features/quick-notes/components/QuickNotesWorkspace.tsx`
- **Services:** —
- **Hooks:** `src/utils/notificationDeepLinks.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** `quicknotes.manage`
- **Selbsttests:** `quick-note-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/QuickNotes.tsx
- src/features/quick-notes/components/QuickNotesWorkspace.tsx
- src/utils/notificationDeepLinks.ts
- src/lib/appTargets.ts

**Bekannte Einschränkungen**

- Die Seite teilt Erfassung und Liste mit dem Reiter in Meine Arbeit; ein eigener Layout-Selbsttest existiert nicht.

**Offene Prüfpunkte**

- Keine.

### `platform.auth` — Anmeldung und Sitzung
Meldet Benutzer an, stellt die Sitzung wieder her und leitet auf die geschützte Arbeitsfläche weiter.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/auth`
- **Frontend-Komponenten:** `src/pages/Auth.tsx`, `src/components/layout`
- **Services:** —
- **Hooks:** `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `profiles`, `user_sessions`, `user_tenant_memberships`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ci-quality-gates.md`

**Nachweise im Quellcode**

- src/pages/Auth.tsx
- src/hooks/useAuth.tsx
- src/router/ProtectedRoute.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Login ist in den Browser-Smokes öffentlich geprüft, aber ohne echtes Testkonto nicht erfolgreich durchlaufen.

### `profile.edit` — Eigenes Profil bearbeiten
Ändert Profildaten, Benachrichtigungspräferenzen und persönliche Anzeigeeinstellungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/profile/edit`, `/profile-edit`
- **Frontend-Komponenten:** `src/pages/EditProfile.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useUserPreference.ts`, `src/hooks/useCurrentProfileId.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_user_status`
- **Tabellen:** `profiles`, `user_preferences`, `user_notification_settings`
- **Abhängigkeiten:** `platform.auth`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/EditProfile.tsx
- src/hooks/useUserPreference.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `mobile.app` — Mobile App (Expo)
Eigenständige Expo-App im Workspace mit eigener Navigation und Build-Profilen; nutzt dieselbe Supabase-Instanz.

- **Kategorie:** fachlich
- **Implementierung:** teilweise
- **Einbindung:** ohne Einbindung
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/mobile`

**Nachweise im Quellcode**

- apps/mobile/package.json
- apps/mobile/app
- apps/mobile/src

**Bekannte Einschränkungen**

- Der Funktionsumfang der Mobile-App wurde nicht zeilenweise inventarisiert; die Web-Plattform ist die Referenz.

**Offene Prüfpunkte**

- Mobile-Bildschirme und -Aktionen sind als eigener Bereich noch nicht im Detail katalogisiert.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
