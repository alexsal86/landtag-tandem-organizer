
# Plan: Entscheidungssystem - 6 Korrekturen und Verbesserungen

## 1. DB-Constraint entfernen (Kritischer Fehler bei A/B/C-Optionen)

**Problem:** Die Tabelle `task_decision_responses` hat einen CHECK-Constraint `task_decision_responses_response_type_check`, der `response_type` auf `'yes', 'no', 'question'` beschraenkt. Bei Antworttypen wie A/B/C (Keys: `a`, `b`, `c`) oder Bewertungen 1-5 (Keys: `1`-`5`) schlaegt das Insert fehl mit Error 23514.

**Loesung:** DB-Migration zum Entfernen des Constraints:
```sql
ALTER TABLE task_decision_responses DROP CONSTRAINT task_decision_responses_response_type_check;
```

Zusaetzlich muessen die `response_type`-Typisierungen im Frontend von `'yes' | 'no' | 'question'` auf `string` erweitert werden, da die Keys jetzt beliebig sein koennen. Betrifft:
- `src/components/my-work/decisions/types.ts` (response_type in Interfaces)
- `src/components/task-decisions/DecisionCardActivity.tsx` (Participant Interface)
- `src/components/task-decisions/DecisionSidebar.tsx` (NewComment Interface)
- `src/components/task-decisions/DecisionOverview.tsx` (DecisionRequest Interface)
- `getResponseSummary` muss angepasst werden: Alles was nicht `yes`, `no` oder `question` ist, zaehlt als "andere Stimme" (nicht als pending).

## 2. Tooltips fuer A/B/C-Optionen im Editor

**Problem:** Beim Erstellen/Bearbeiten von Entscheidungen mit Vorlage "Option A/B/C" werden die Beschreibungsfelder nicht vorausgefuellt, weil die Vorlage bereits `description`-Felder hat, diese aber beim Template-Wechsel korrekt gesetzt werden muessen.

**Loesung:** Pruefen, ob der Template-Wechsel im Erstellungsdialog die `description`-Felder der Vorlagen korrekt uebernimmt. Falls nicht, den Template-Anwendungscode anpassen, sodass bei Auswahl von "Bewertung 1-5" oder "Option A/B/C" die Beschreibungen automatisch gesetzt werden.

## 3. Texte groesser auf Aufgaben- und Entscheidungsseiten

**Loesung:** 
- In `DecisionOverview.tsx`: Seitenheading von `text-2xl` auf `text-3xl`, Beschreibungstext von `text-sm` auf `text-base`.
- Card-Titel von `text-base` auf `text-lg`, Beschreibungen von `text-xs` auf `text-sm`.
- Metadaten-Texte von `text-[10px]` auf `text-xs`.
- Badges von `text-xs` auf `text-sm`.

## 4. Card-Design gemaess Referenzbild

Basierend auf dem Referenzbild werden folgende Aenderungen vorgenommen:

**Badges:**
- Helle Hintergrundfarbe mit dunklerer Schrift statt ausgefuellter Badge. Z.B. "Ausstehend" = `bg-blue-100 text-blue-700`, "Rueckfrage" = `bg-orange-100 text-orange-700`, "Entschieden" = `bg-green-100 text-green-700`.
- Fetterer Text (`font-bold`) und etwas groesserer Punkt/Icon.

**Titel:**
- `font-bold text-lg` statt `font-semibold text-base`.
- Beim Hover der Card soll der Titel vollstaendig sichtbar sein (kein `line-clamp`). Umsetzung: `group`-Klasse auf Card, `group-hover:line-clamp-none` auf Titel.

**Beschreibung:**
- Groesserer Text (`text-sm` statt `text-xs`).

**Metadaten-Reihenfolge (ohne Trennstriche, mit mehr Freiraum):**
1. Kalender-Icon + Datum
2. Avatar + Name des Erstellers
3. Kommentar-Icon + "X Kommentare" oder "Kommentar schreiben" falls 0
4. Globe-Icon + "Oeffentlich" (nur wenn oeffentlich, sonst weglassen)

Die `border-t` wird entfernt und durch `mt-4` (mehr Freiraum) ersetzt.

**Rueckfrage-Button:** Bekommt ein spezielleres Icon (z.B. `CornerDownLeft` oder das aktuelle `MessageCircle` beibehalten, das dem Bild entspricht).

**Begruendung:** Kein Button mehr, stattdessen ein Bereich mit Rand (`border rounded-md px-3 py-1.5`) und der Pfeil (`ChevronDown`) rueckt naeher an den Text.

**Abstimmungsergebnis:** Deutlich groesser (`text-sm font-bold`) und zusammen mit den Avataren in die untere rechte Ecke auf Hoehe der Abstimmungsbuttons verschoben.

## 5. "Hinweis hinterlassen" entfernen

Die `DecisionViewerComment`-Komponente und alle Referenzen darauf werden entfernt:
- `src/components/task-decisions/DecisionViewerComment.tsx` (Datei loeschen)
- `DecisionOverview.tsx` Zeilen 1012-1022 (Import + Verwendung entfernen)
- `MyWorkDecisionCard.tsx` Zeilen 239-248 (Import + Verwendung entfernen)

## 6. Tab "Fuer mich" erweitern: Abgeschlossene eigene Entscheidungen anzeigen

**Problem:** Wenn der Benutzer eine Entscheidung an andere sendet und diese antworten, muss er auf "Von mir" wechseln um das Ergebnis zu sehen.

**Loesung:** Im Tab "Fuer mich" zusaetzlich zu den offenen Entscheidungen auch die eigenen Entscheidungen anzeigen, bei denen neue Aktivitaet (neue Antworten, Rueckfragen) vorhanden ist. Diese werden visuell getrennt unter einem "Ihre Entscheidungen - Neue Aktivitaet" Bereich angezeigt und z.B. mit einem dezenten Label "Von Ihnen erstellt" gekennzeichnet.

Die Filter-Logik in `filteredDecisions` wird erweitert:
```text
case "for-me":
  // Offene Entscheidungen fuer mich (wie bisher)
  + Eigene Entscheidungen mit neuen Rueckfragen oder ungelesenen Antworten
```

Die Tab-Reihenfolge bleibt gleich, aber "Fuer mich" wird zum Hauptarbeitsbereich fuer alles Relevante.

---

## Betroffene Dateien

| Datei | Aenderungen |
|-------|-------------|
| **DB-Migration** | DROP CONSTRAINT `task_decision_responses_response_type_check` |
| `src/components/my-work/decisions/types.ts` | `response_type: string` statt Union-Type, `getResponseSummary` anpassen |
| `src/components/task-decisions/DecisionCardActivity.tsx` | `response_type: string`, Card-Design |
| `src/components/task-decisions/DecisionOverview.tsx` | Card-Design, Textgroessen, Badge-Farben, "Fuer mich" Tab-Logik, DecisionViewerComment entfernen |
| `src/components/task-decisions/DecisionSidebar.tsx` | `responseType: string` |
| `src/components/task-decisions/TaskDecisionResponse.tsx` | Begruendungs-Bereich anpassen |
| `src/components/my-work/decisions/MyWorkDecisionCard.tsx` | Card-Design, DecisionViewerComment entfernen |
| `src/components/task-decisions/DecisionViewerComment.tsx` | Datei loeschen |

## Reihenfolge

1. DB-Migration (Constraint entfernen) - blockiert alles andere
2. Type-Fixes (`response_type: string`)
3. Card-Design-Aenderungen (beide Overview-Dateien)
4. "Hinweis hinterlassen" entfernen
5. Tab-Logik "Fuer mich" erweitern
6. Textgroessen anpassen
