
# Plan: Entscheidungssystem - 7 Verbesserungen

## Uebersicht der Aenderungen

### 1. Ersteller duerfen keine eigenstaendige Abstimmung abgeben

**Problem:** Wenn der Ersteller sich selbst als Teilnehmer hinzufuegt, kann er eine eigene Stimme abgeben, die als regulaere Stimme gezaehlt wird. Das verfaelscht das Ergebnis.

**Loesung:** 
- In `TaskDecisionResponse.tsx`: Wenn der aktuelle Benutzer der Ersteller der Entscheidung ist, werden die Abstimmungsbuttons NICHT angezeigt. Stattdessen erscheint ein Hinweis "Als Ersteller koennen Sie nur auf Rueckmeldungen antworten."
- In `DecisionOverview.tsx` und `MyWorkDecisionCard.tsx`: Der Inline-Voting-Bereich wird fuer Ersteller ausgeblendet.
- Die `TaskDecisionDetails.tsx` zeigt im Bereich "Ihre Antwort" ebenfalls keine Voting-Buttons fuer den Ersteller.
- Dafuer muss die `created_by`-Information an `TaskDecisionResponse` weitergegeben werden (neues Prop `creatorId`).

### 2. Person mit Avatar + Name bei Rueckmeldungen anzeigen

**Problem:** In der Darstellung der Rueckmeldungen (DecisionCardActivity, TaskDecisionDetails) fehlt die klare Zuordnung wer die Rueckmeldung gegeben hat.

**Loesung:**
- In `DecisionCardActivity.tsx`: Avatar + Name werden bereits angezeigt (ueber `item.name` und `item.avatarUrl`). Das Problem liegt wahrscheinlich bei der `creator_response`-Darstellung - hier fehlt der Ersteller-Name/Avatar. Die Antwort des Erstellers bekommt ebenfalls einen Avatar + Namen.
- In `TaskDecisionDetails.tsx`: Bei der `creator_response`-Anzeige (Zeile 434-438) den Ersteller-Namen und -Avatar anzeigen, nicht nur "Antwort:".

### 3. Antwort-Kette: Teilnehmer kann auf Ersteller-Antwort reagieren

**Problem:** Aktuell ist die Konversation einseitig: Teilnehmer stellt Rueckfrage -> Ersteller antwortet -> Ende. Der Teilnehmer soll nochmal antworten koennen, und darauf soll der Ersteller wieder antworten koennen.

**Loesung:**
- Das Feld `parent_response_id` existiert bereits in der DB.
- In `TaskDecisionDetails.tsx`: Wenn eine `creator_response` auf eine Rueckfrage existiert, zeigt sich fuer den Teilnehmer ein "Antworten"-Button. Diese Antwort wird als neuer `task_decision_responses`-Eintrag mit `parent_response_id` gespeichert (response_type = 'question', comment = Antworttext).
- In `TaskDecisionDetails.tsx`: Fuer verschachtelte Antworten (parent_response_id != null) wird die Konversation als Thread dargestellt. Der Ersteller kann darauf wiederum mit `creator_response` antworten.
- Die Abfrage in `loadDecisionDetails` muss angepasst werden, um die Reply-Kette zu laden und korrekt darzustellen.

### 4. Sidebar "Aktionen" erweitern: Alle relevanten Aktivitaeten anzeigen

**Problem:** Die Sidebar in "Meine Arbeit/Entscheidungen" zeigt nur Rueckfragen und Begruendungen. Sie soll auch Kommentare, @Mentions und alle relevanten Aktivitaeten anzeigen.

**Loesung:**
- In `MyWorkDecisionsTab.tsx` (sidebarData useMemo): Zusaetzlich `task_decision_comments` laden fuer Entscheidungen wo der User Creator oder Teilnehmer ist.
- Kommentare mit @Mentions des aktuellen Users aus allen zugaenglichen Entscheidungen einbeziehen.
- In `MyWorkDecisionSidebar.tsx`: Neue Sektion "Neue Kommentare" mit Avatar, Name und Kommentartext hinzufuegen, zusaetzlich zu Rueckfragen und Begruendungen.
- Mentions-Erkennung: Kommentare pruefen ob sie den aktuellen User per `data-mention-user-id` erwaehnen.

### 5. Antwortfehler bei bestimmten Antworttypen beheben

**Problem:** Nicht alle Antworttypen funktionieren fehlerfrei. Die Edge Function `process-decision-response` validiert den `responseType` gegen `response_options`.

**Loesung:**
- Pruefen ob der Frontend-Code in `TaskDecisionResponse.tsx` den korrekten Key verwendet. Der `handleResponse`-Aufruf bei regulaeren Optionen (Zeile 400) sendet `option.key`.
- In der Edge Function: Das Problem koennte sein, dass Optionen wie Bewertungen (1-5) oder ABC-Optionen kein `requires_comment`-Feld haben und der Code trotzdem versucht, `validOption.requires_comment` zu pruefen - aber das funktioniert korrekt (false/undefined).
- **Wahrscheinlicher Fehler:** Der Inline-Voting in den Karten verwendet `TaskDecisionResponse` direkt - der Fehler koennte von der Edge Function kommen, die im Frontend gar nicht aufgerufen wird (der Frontend-Code schreibt direkt in die DB). Ich pruefe ob der `response_type` bei benutzerdefinierten Keys wie `option_1234567` korrekt validiert wird. Falls die Edge Function fuer externe Votes genutzt wird, muss auch dort der Key korrekt matchen.
- Konkreter Fix: In `TaskDecisionResponse.tsx` Zeile 400: Bei regulaeren Optionen wird `questionComment.trim()` uebergeben, das koennte leer sein aber nie undefined - muss `undefined` sein wenn leer, sonst schreibt es einen leeren String.

### 6. Bewertungen 1-5 und Optionen A/B/C: Beschreibungen (Hover-Tooltips)

**Referenz:** Das hochgeladene Bild zeigt zwei Varianten:
- **Variante 1 (Tooltip beim Hovern):** Jede Option hat ein Info-Icon, beim Hover erscheint die Beschreibung.
- **Variante 2 (Ausklappbare Info-Box):** Ein "Optionen anzeigen"-Collapsible zeigt alle Beschreibungen.

**Loesung - Variante 1 (Hover-Tooltips):**
- `ResponseOption`-Interface in `decisionTemplates.ts` erweitern: Neues optionales Feld `description?: string`.
- Templates aktualisieren:
  - rating5: `{key: "1", label: "1", description: "Schlecht / Nicht geeignet", ...}`, ... bis `{key: "5", label: "5", description: "Sehr gut / Vollste Zustimmung", ...}`
  - optionABC: Beschreibungen optional (werden vom Benutzer im Editor definiert)
- `ResponseOptionsEditor.tsx`: Neues Eingabefeld "Beschreibung" pro Option hinzufuegen.
- `TaskDecisionResponse.tsx`: Buttons mit `Tooltip` umwickeln, Info-Icon (i) hinzufuegen wenn `option.description` vorhanden.
- `ResponseOptionsPreview.tsx`: Ebenfalls Tooltips anzeigen.

### 7. Card-Design verbessern (Referenz-Bild)

**Referenz:** Das zweite hochgeladene Bild zeigt ein ueberarbeitetes Card-Design mit:
- Farbige Status-Badges (Ausstehend = Blau, Rueckfrage = Orange, Entschieden = Gruen)
- Ersteller-Name mit User-Icon statt Avatar
- Kommentar-Zaehler prominent
- Voting-Buttons mit farbigen Outlines und Icons
- Ersteller-Antwort mit Avatar + Name + Haken + Zeitangabe

**Loesung:**
- `DecisionOverview.tsx` (`renderCompactCard`): Badges werden bereits farbig dargestellt - das passt zum Referenzbild. Kleinere Anpassungen:
  - "Ausstehend" Badge in Blau statt Grau (wie im Bild: blauer Punkt + "Ausstehend")
  - Kommentar-Zaehler Text statt nur Zahl ("0 Kommentare" / "1 Kommentar")
- `DecisionCardActivity.tsx`: Bei der Ersteller-Antwort (creatorResponse) einen Check-Haken und Zeitangabe "vor X Tagen" hinzufuegen.

---

## Technische Details

### Betroffene Dateien

| Datei | Aenderungen |
|-------|-------------|
| `src/lib/decisionTemplates.ts` | `description`-Feld zu `ResponseOption` + Template-Beschreibungen |
| `src/components/task-decisions/TaskDecisionResponse.tsx` | Ersteller-Voting blockieren (neues `creatorId`-Prop), Tooltips |
| `src/components/task-decisions/TaskDecisionDetails.tsx` | Reply-Kette fuer Teilnehmer, Ersteller-Avatar bei Antworten, `creatorId` durchreichen |
| `src/components/task-decisions/DecisionCardActivity.tsx` | Ersteller-Info bei Antworten, Check + Zeitangabe |
| `src/components/task-decisions/DecisionOverview.tsx` | creatorId-Prop an TaskDecisionResponse, Badge-Farben, Kommentar-Text |
| `src/components/task-decisions/ResponseOptionsEditor.tsx` | Beschreibungs-Eingabefeld |
| `src/components/task-decisions/ResponseOptionsPreview.tsx` | Tooltip-Anzeige |
| `src/components/my-work/MyWorkDecisionsTab.tsx` | Sidebar-Daten erweitern (Kommentare + Mentions) |
| `src/components/my-work/decisions/MyWorkDecisionCard.tsx` | Ersteller-Voting blockieren, Badge-Farben |
| `src/components/my-work/decisions/MyWorkDecisionSidebar.tsx` | Kommentar-Sektion hinzufuegen |
| `src/components/my-work/decisions/types.ts` | Neuer SidebarComment-Typ |
| `src/components/task-decisions/DecisionSidebar.tsx` | Kommentar-Sektion hinzufuegen |

### Reihenfolge der Implementierung

1. `decisionTemplates.ts` - Interface + Beschreibungen erweitern
2. `TaskDecisionResponse.tsx` - Ersteller-Blockierung + Tooltips
3. `TaskDecisionDetails.tsx` - Reply-Kette + Ersteller-Avatar
4. `DecisionCardActivity.tsx` - UI-Verbesserungen
5. `ResponseOptionsEditor.tsx` + `ResponseOptionsPreview.tsx` - Beschreibungsfelder
6. `DecisionOverview.tsx` + `MyWorkDecisionCard.tsx` - Card-Design + creatorId
7. Sidebar-Dateien - Erweiterte Aktionen
