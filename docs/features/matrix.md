# Funktions- und Testabdeckungsmatrix

_Auto-generiert mit `npm run update:feature-catalog`. Nicht von Hand bearbeiten._

Die Spalten zählen **zugeordnete** Prüfungen, nicht bestandene Läufe. „Ergebnis" stammt aus `src/features/selftest/last-runs.json" (importiert mit `npm run sync:selftest-results`); ohne Laufnachweis steht dort der deklarierte Katalogwert `nicht-ausgefuehrt` oder `unbekannt`.

| Funktion | Bereich | Kategorie | Implementierung | Einbindung | Abdeckung | Ergebnis | Selbsttests | Unit | Integration | Browser | Doku |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---|
| `notifications.inbox` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `notifications.preferences` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `mywork.dashboard.today-priorities` | arbeitsbereich | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `mywork.tabs` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `mywork.dashboard` | arbeitsbereich | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | ja |
| `mywork.quick-access` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `mobile.app` | arbeitsbereich | fachlich | teilweise | ohne Einbindung | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `mywork.navigation-previews` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `profile.edit` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `quicknotes.checklists` | arbeitsbereich | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `quicknotes.drag-sort` | arbeitsbereich | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `quicknotes.offline` | arbeitsbereich | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | nein |
| `quicknotes.manage` | arbeitsbereich | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `search.global` | arbeitsbereich | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `platform.auth` | arbeitsbereich | sicherheit | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `tasks.archive` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `tasks.complete` | aufgaben | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 1 | 0 | 0 | ja |
| `tasks.edit` | aufgaben | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `tasks.subtasks` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `tasks.create` | aufgaben | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `tasks.nudge` | aufgaben | automatisiert | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `tasks.snooze` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `tasks.deadline` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `tasks.annual` | aufgaben | automatisiert | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `tasks.handover-stafette` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `tasks.ball-owner` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `tasks.search-filter` | aufgaben | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `tasks.link-document` | aufgaben | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `tasks.link-decision` | aufgaben | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | ja |
| `tasks.link-case` | aufgaben | fachlich | implementiert | systemseitig | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | nein |
| `tasks.templates` | aufgaben | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `tasks.recurring` | aufgaben | automatisiert | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `tasks.assign` | aufgaben | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | nein |
| `automation.runs` | automation | automatisiert | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `automation.office-packages` | automation | automatisiert | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `automation.annual-routines` | automation | administrativ | implementiert | rollenabhängig | Unit-Test | unbekannt | 1 | 2 | 0 | 0 | nein |
| `automation.rss` | automation | integration | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `automation.templates` | automation | administrativ | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `automation.rules` | automation | administrativ | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `automation.conditions` | automation | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `automation.rule-validation` | automation | administrativ | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `automation.rule-versions` | automation | administrativ | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `automation.task-packages` | automation | automatisiert | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `automation.routine-packages` | automation | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `automation.workflows` | automation | administrativ | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `automation.webhooks` | automation | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `automation.calendar-schedule` | automation | technisch | implementiert | systemseitig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `automation.scheduler` | automation | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `annotations.relocate` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `annotations.export` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `annotations.history` | dokumente | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `annotations.create` | dokumente | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `annotations.tasks` | dokumente | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `annotations.ocr` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `letters.export` | dokumente | fachlich | implementiert | UI | Unit-Test | nicht-ausgefuehrt | 0 | 3 | 0 | 0 | nein |
| `letters.archive` | dokumente | automatisiert | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `letters.create` | dokumente | fachlich | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 3 | 0 | 0 | ja |
| `letters.workflow` | dokumente | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 1 | 0 | ja |
| `letters.collaboration` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `letters.attachments` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `letters.templates` | dokumente | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `documents.upload-version` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `documents.contacts` | dokumente | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `documents.email` | dokumente | integration | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `documents.list` | dokumente | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `decisions.vote` | entscheidungen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `decisions.change-vote` | entscheidungen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.comments` | entscheidungen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `decisions.attachments` | entscheidungen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.create` | entscheidungen | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `decisions.archive` | entscheidungen | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.email` | entscheidungen | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.remind` | entscheidungen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.matrix` | entscheidungen | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `decisions.participants` | entscheidungen | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `chat.messages` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `chat.matrix-bot` | kommunikation | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `chat.team-announcements` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `widget.matrix-website` | kommunikation | integration | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `news.email` | kommunikation | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `news.matrix` | kommunikation | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `news.articles` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `press.ghost` | kommunikation | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `press.releases` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `redaktion.calendar-reminders` | kommunikation | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `redaktion.assets-campaigns` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `redaktion.approval` | kommunikation | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `redaktion.planner` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `redaktion.themenspeicher` | kommunikation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `contacts.bulk` | kontakte | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.briefing-memory` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.fundings` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.activities` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | nein |
| `contacts.privacy` | kontakte | sicherheit | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `contacts.import` | kontakte | fachlich | implementiert | UI | teilweise | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `contacts.stakeholders` | kontakte | fachlich | implementiert | UI | teilweise | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.duplicates` | kontakte | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.merge` | kontakte | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | ja |
| `contacts.create` | kontakte | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `contacts.edit` | kontakte | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.detail` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.tags-topics` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `contacts.distribution-lists` | kontakte | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `employees.export-stats` | mitarbeit | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `employees.requests` | mitarbeit | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `employees.protocol` | mitarbeit | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | ja |
| `employees.preparation` | mitarbeit | automatisiert | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `employees.action-tasks` | mitarbeit | fachlich | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 2 | 0 | 0 | 0 | nein |
| `employees.meetings` | mitarbeit | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `employees.review` | mitarbeit | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `employees.wellbeing` | mitarbeit | sicherheit | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `hr.templates` | mitarbeit | administrativ | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | nein |
| `hr.offboarding` | mitarbeit | fachlich | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `hr.onboarding` | mitarbeit | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 2 | 0 | 0 | ja |
| `teamrituals.games` | mitarbeit | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `teamrituals.weekly` | mitarbeit | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 2 | 0 | 0 | ja |
| `timetracking.entries` | mitarbeit | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `timetracking.annual-tasks` | mitarbeit | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `timetracking.vacation` | mitarbeit | fachlich | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `timetracking.admin` | mitarbeit | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `responsibilities.coverage` | mitarbeit | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `responsibilities.matrix` | mitarbeit | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 2 | 0 | 0 | nein |
| `responsibilities.suggest` | mitarbeit | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | nein |
| `dossiers.manage` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `dossiers.entries` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `dossiers.sources` | organisation | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `dossiers.links-stakeholders` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `dossiers.search` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `dossiers.capture-radar` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `dossiers.talking-points` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `drucksachen.view` | organisation | fachlich | teilweise | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `facts.manage` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `meetings.agenda` | organisation | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `meetings.jour-fixe` | organisation | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `meetings.zombie-points` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `meetings.archive` | organisation | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `meetings.decisions` | organisation | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `meetings.protocol` | organisation | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `meetings.templates` | organisation | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `topics.convert-catalog` | organisation | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `topics.manage` | organisation | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `integration.push` | schnittstellen | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `integration.edge-contract-tests` | schnittstellen | sicherheit | implementiert | nicht anwendbar | Security-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `integration.egress-monitoring` | schnittstellen | sicherheit | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `integration.email` | schnittstellen | integration | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `integration.geocoding` | schnittstellen | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `integration.calendar-sync` | schnittstellen | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `integration.ics` | schnittstellen | integration | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `integration.ai-suggestions` | schnittstellen | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `integration.transcription` | schnittstellen | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `integration.unsplash` | schnittstellen | integration | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `appointments.briefing-live` | termine | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `appointments.briefing` | termine | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `appointments.jour-fixe` | termine | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `calendar.holidays` | termine | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `calendar.guests` | termine | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `calendar.create-appointment` | termine | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `calendar.edit-move` | termine | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `calendar.invitations` | termine | integration | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `calendar.reminders` | termine | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `calendar.view` | termine | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `calendar.categories-locations` | termine | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `appointments.debrief` | termine | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `appointments.feedback` | termine | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `daily.briefing` | termine | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 2 | 8 | 0 | 0 | ja |
| `calendar.polls` | termine | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `appointments.requests` | termine | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `appointments.preparation` | termine | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `events.legacy-rsvp` | veranstaltungen | fachlich | veraltet | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `events.rsvp-public` | veranstaltungen | integration | implementiert | UI | Integrationstest | unbekannt | 0 | 0 | 0 | 1 | ja |
| `events.invitations` | veranstaltungen | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `events.speakers-documents` | veranstaltungen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `events.plan` | veranstaltungen | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `events.checklist` | veranstaltungen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `polls.respond` | veranstaltungen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `polls.manage` | veranstaltungen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `polls.availability` | veranstaltungen | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `admin.workspace` | verwaltung | administrativ | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | ja |
| `admin.audit-log` | verwaltung | sicherheit | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `admin.bulk-audit` | verwaltung | sicherheit | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.performance` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `admin.maintenance` | verwaltung | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.data-lint` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.gdpr` | verwaltung | sicherheit | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `admin.templates-senders` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.configuration` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.onboarding-login` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.users-sessions` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `admin.tenants` | verwaltung | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `admin.feature-catalog` | verwaltung | administrativ | implementiert | rollenabhängig | Unit-Test | unbekannt | 0 | 7 | 0 | 0 | ja |
| `admin.selftest-center` | verwaltung | administrativ | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 0 | 3 | 0 | 1 | ja |
| `admin.system-pulse` | verwaltung | administrativ | implementiert | rollenabhängig | Unit-Test | bestanden | 0 | 3 | 0 | 0 | ja |
| `admin.action-permissions` | verwaltung | sicherheit | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `admin.roles` | verwaltung | administrativ | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `admin.feature-flags` | verwaltung | administrativ | implementiert | Feature Flag | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `admin.field-permissions` | verwaltung | sicherheit | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `admin.permissions-explorer` | verwaltung | administrativ | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `admin.edge-function-security` | verwaltung | sicherheit | implementiert | nicht anwendbar | kein Test | unbekannt | 0 | 0 | 0 | 0 | ja |
| `admin.security-cockpit` | verwaltung | sicherheit | implementiert | rollenabhängig | Unit-Test | bestanden | 0 | 2 | 0 | 0 | ja |
| `admin.access-boundaries` | verwaltung | sicherheit | implementiert | nicht anwendbar | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `platform.notification-dispatch` | verwaltung | technisch | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `cases.close-archive` | vorgaenge | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `cases.escalation` | vorgaenge | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `cases.interactions` | vorgaenge | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `cases.timeline` | vorgaenge | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `cases.steps` | vorgaenge | fachlich | implementiert | systemseitig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `cases.legacy-routes` | vorgaenge | fachlich | veraltet | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `cases.create` | vorgaenge | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `casefiles.manage` | vorgaenge | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `casefiles.links` | vorgaenge | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `casefiles.notes` | vorgaenge | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `casefiles.status-workflow` | vorgaenge | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `cases.triage` | vorgaenge | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `cases.handover` | vorgaenge | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `cases.link-letter` | vorgaenge | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `cases.link-decision` | vorgaenge | fachlich | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `cases.link-appointment` | vorgaenge | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `election.deputy-results` | wahl | fachlich | implementiert | UI | Unit-Test | unbekannt | 1 | 0 | 0 | 0 | nein |
| `election.analysis-map` | wahl | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `election.analysis-navigation` | wahl | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `election.research-workbench` | wahl | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `election.state-history` | wahl | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `election.parliament-protocols` | wahl | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `election.seat-distribution` | wahl | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.analysis` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 2 | 0 | 0 | ja |
| `election.turnout` | wahl | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.history.audit` | wahl | sicherheit | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.history.quality` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `election.history.portraits` | wahl | integration | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `election.history.assembly` | wahl | automatisiert | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.history.factions` | wahl | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.history.mandates` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `election.history.districts-geometry` | wahl | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `election.history.candidacies` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `election.history.state-lists` | wahl | fachlich | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.history.people` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | nein |
| `election.history.periods` | wahl | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | ja |
| `election.representatives` | wahl | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.districts-import` | wahl | integration | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `election.map` | wahl | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 1 | ja |
| `knowledge.management` | wissen | administrativ | implementiert | rollenabhängig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `knowledge.answer` | wissen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `knowledge.short-answer` | wissen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 1 | 0 | 0 | nein |
| `knowledge.global-question` | wissen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | ja |
| `knowledge.ask` | wissen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `knowledge.validity` | wissen | automatisiert | implementiert | systemseitig | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | ja |
| `knowledge.versions` | wissen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `knowledge.review` | wissen | fachlich | implementiert | rollenabhängig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `knowledge.permissions` | wissen | sicherheit | implementiert | systemseitig | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 0 | ja |
| `knowledge.attachments` | wissen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `knowledge.sources` | wissen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `knowledge.tags` | wissen | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 2 | 0 | 0 | nein |
| `knowledge.persons` | wissen | fachlich | implementiert | UI | Unit-Test | unbekannt | 0 | 1 | 0 | 0 | nein |
| `knowledge.search` | wissen | fachlich | implementiert | UI | Selbsttest | nicht-ausgefuehrt | 1 | 0 | 0 | 2 | nein |
| `knowledge.collaboration` | wissen | integration | implementiert | systemseitig | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
| `knowledge.comments-follow` | wissen | fachlich | implementiert | UI | kein Test | nicht-ausgefuehrt | 0 | 0 | 0 | 0 | nein |
