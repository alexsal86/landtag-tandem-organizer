## Ziel
Drei neue Bausteine ins Dashboard `MyWorkDashboardTab.tsx` integrieren, ohne die bestehende Struktur (Briefings + 3 Spalten) zu sprengen:

1. **Jour-fixe-Widget** (rechte Spalte unter News).
2. **Entscheidungen-Widget** (mittlere Spalte unter Termine, mit Ja/Nein/Frage-Buttons).
3. **Verbesserte Zeit-/Ort-Darstellung im Fristen-Widget** (Inline-Format `Heute 17:00 · Kontext`, farbiger linker Statusbalken).

## 1. Fristen-Widget verfeinern (`DashboardTasksSection.tsx`)
- Pro Item linker 2-px-Balken mit Statusfarbe: rot (überfällig), grün (heute), amber (nächste 7 Tage), neutral (später).
- Datum statt `dd.MM.` als sprechender Text:
  - überfällig → `überfällig · 09.04.`
  - heute → `Heute HH:MM` (falls Uhrzeit vorhanden, sonst „Heute")
  - morgen → `Morgen HH:MM`
  - sonst Wochentag-Kurzform `Do, 18.04.`
- Kontext-Suffix nach `·`:
  - tasks → `category` (falls vorhanden) sonst Typ-Label
  - notes → „Notiz"
  - cases → „Vorgang"
  - decisions → „Entscheidung"
  - eventPlanning → „Veranstaltung"
- Helper `formatDeadlineLabel(item)` neu in `src/utils/deadlineFormatting.ts` (mit `formatDistanceToNowStrict` / `format`-Mix). Reine Frontend-Änderung, Datenstruktur bleibt.
- Die bestehende Gruppierung („Überfällig", „Heute", „Nächste 7 Tage", „Später") bleibt – Statusbalken ist Redundanz für schnelles Scannen, kein Ersatz.

## 2. Entscheidungen-Widget (neu)
Neue Komponente `DashboardDecisionsWidget.tsx` in `src/components/dashboard/`.
- Datenquelle: `useMyWorkDecisionsData(user?.id)` (existiert), filtern auf `status !== 'resolved'`, `archived_at IS NULL`, sortiert nach `response_deadline ASC` (NULLs ans Ende), Top 3.
- Pro Karte:
  - Titel (1 Zeile, truncate)
  - Fälligkeit oben rechts (`fällig in X Tagen` / `fällig heute` / `überfällig`).
  - Mini-Balken (4 Segmente) für `getResponseSummary` (yes/no/question/pending) – nur visuell, keine Pflicht zu echtem Stacked Bar; reicht: 4 colored dots/segments.
  - Buttons `Ja` / `Nein` / `Frage` → ruft existierende `respondToDecision`-Mutation aus dem MyWork-Decisions-Layer (in `decisions/` schon vorhanden, wird durch das Widget importiert; falls nur als Hook verfügbar: `useDecisionResponses` o. ä. wiederverwenden, sonst Klick navigiert auf `/mywork?tab=decisions&highlight=<id>`).
- Empty State: „Keine ausstehenden Entscheidungen".
- Skeleton wie andere Widgets.

Damit der Scope nicht ausufert: Wenn die Inline-Antwort-Mutation aus dem bestehenden Decisions-Tab nicht ohne Refactor wiederverwendbar ist, im ersten Schritt nur **Buttons als Schnell-Navigation** zum Decisions-Tab mit vorgewählter Antwort (Querystring `?respond=yes|no|question`). Decisions-Tab versteht den Param dann und öffnet das Antwortdialog automatisch. Das ist sauberer und reduziert Duplikat-Logik.

## 3. Jour-fixe-Widget (neu)
Neue Komponente `DashboardJourFixeWidget.tsx`.
- Datenquelle: `useMyWorkJourFixeMeetings(user?.id)`, nimm Top 2 aus `upcomingMeetings`.
- Pro Karte:
  - Datum als `Wochentag, DD.MM. · HH:MM` (oder „ganztägig").
  - Titel (truncate).
  - Sub-Zeile: `X TOPs · Y Teilnehmende` – TOP-Anzahl aus existierender Agenda nicht trivial; falls Hook das nicht liefert, im ersten Schritt nur `Y Teilnehmende` anzeigen (`meetingParticipants[meeting.id]?.length`).
  - Klick → `navigate('/meetings?id=' + meeting.id)`.
- Empty State: „Keine anstehenden Jour fixes".
- Skeleton.

## 4. Layout-Anpassung (`MyWorkDashboardTab.tsx`)
Aktuell: `grid-cols-[35fr_35fr_30fr]` mit `DeadlinesWidget | AppointmentsWidget | NewsWidgetCard`.

Neu:
```
Spalte 1 (Fristen) | Spalte 2 (Termine + Entscheidungen) | Spalte 3 (News + Jour fixe)
```
Jede Spalte ein `flex flex-col gap-6`. Reihenfolge in Spalte 2: Termine zuerst (häufiger gebraucht), darunter Entscheidungen. In Spalte 3: News oben (gewohnter Platz), darunter Jour fixe.

## 5. Edge-Cases & QA
- Keine Daten → Empty States.
- Loading → vorhandene Skeleton-Pattern aus `DashboardWidgetContainer`.
- Realtime: `useMyWorkDecisionsData` und `useMyWorkJourFixeMeetings` haben bereits Realtime-Subscriptions / Refetch.
- A11y: Buttons mit `aria-label`, Statusbalken `aria-hidden`.
- QA: `/` mit Daten / ohne Daten prüfen; Klick auf Decision-Button öffnet richtigen Tab; Klick auf Jour-fixe-Karte öffnet richtige Sitzung.

## Out of scope (bewusst nicht übernommen)
- Header-Datum/KW-Zeile (vom User explizit abgelehnt).
- Rückmeldungen/Vorgänge/Quick-Capture aus dem Referenz-Screenshot.
