
# Plan: 9 Korrekturen und Verbesserungen am Entscheidungssystem

## 1. "Fuer mich" Tab in Meine Arbeit/Entscheidungen angleichen

**Problem:** Der Tab "Fuer mich" in `MyWorkDecisionsTab.tsx` zeigt nur Entscheidungen wo der User Teilnehmer ist und noch nicht geantwortet hat. In `DecisionOverview.tsx` zeigt der gleiche Tab zusaetzlich eigene Entscheidungen mit neuer Aktivitaet.

**Loesung:** Die Filter-Logik in `MyWorkDecisionsTab.tsx` (Zeile 313-315) erweitern:

```
case "for-me":
  // Bisher: nur d.isParticipant && !d.hasResponded
  // Neu: + eigene Entscheidungen mit Rueckfragen oder neuen Antworten
  const forMe = filtered.filter(d => d.isParticipant && !d.hasResponded && !d.isCreator);
  const myWithActivity = filtered.filter(d => {
    if (!d.isCreator) return false;
    const s = getResponseSummary(d.participants);
    return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
  });
  // Zusammenfuehren ohne Duplikate
```

Tab-Count (Zeile 294-295) ebenfalls anpassen.

**Datei:** `src/components/my-work/MyWorkDecisionsTab.tsx`

## 2. Doppelte Darstellung bei Franziska entfernen

**Problem:** In `DecisionOverview.tsx` wird zunaechst `DecisionCardActivity` (Zeile 1017-1027) gerendert, was Rueckfragen mit Inline-Reply zeigt. Direkt danach folgt ein separater "Open questions for creator"-Block (Zeile 1029-1069), der die gleichen Rueckfragen nochmal mit einem Rich-Text-Editor anzeigt.

**Loesung:** Den doppelten Block (Zeile 1029-1069) entfernen. Die `DecisionCardActivity`-Komponente hat bereits Inline-Reply-Funktionalitaet ueber den `onReply`-Prop.

**Datei:** `src/components/task-decisions/DecisionOverview.tsx` (Zeilen 1029-1069 loeschen)

## 3. Rueckfrage-Button Icon aendern

**Problem:** Der Rueckfrage-Button in `TaskDecisionResponse.tsx` verwendet noch `MessageCircle` (Zeile 440). Gewuenscht ist ein runder Pfeil (Antwort-Icon).

**Loesung:** In `TaskDecisionResponse.tsx` das Icon fuer Options mit `requires_comment` auf `CornerDownLeft` (oder `Reply`) aendern. Auch in `DecisionCardActivity.tsx` (Zeile 142) das Icon fuer Rueckfragen auf `Reply` aendern.

**Dateien:** `src/components/task-decisions/TaskDecisionResponse.tsx`, `src/components/task-decisions/DecisionCardActivity.tsx`

## 4. Begruendung: Icon entfernen, Rand hinzufuegen, Pfeil naeher

**Problem:** Der "Begruendung"-Button (Zeile 437-445 in `TaskDecisionResponse.tsx`) hat ein `MessageCircle`-Icon und sieht aus wie ein Ghost-Button. Gewuenscht: kein Icon, dafuer ein Rand wie die anderen Buttons, und der Pfeil (ChevronDown) naeher am Text.

**Loesung:** In `TaskDecisionResponse.tsx`:
- `MessageCircle`-Icon entfernen
- `variant="ghost"` zu `variant="outline"` aendern
- `ml-1` beim ChevronDown auf `ml-0.5` reduzieren

**Datei:** `src/components/task-decisions/TaskDecisionResponse.tsx`

## 5. Beschreibung mit "mehr/weniger" Link

**Problem:** Lange Beschreibungen werden abgeschnitten, aber in `MyWorkDecisionCard.tsx` fehlt die expandierbare Funktionalitaet (dort ist nur `line-clamp-1` ohne "mehr"-Link).

**Loesung:** Die `TruncatedDescription`-Komponente aus `DecisionOverview.tsx` in `MyWorkDecisionCard.tsx` uebernehmen. Alternativ die Komponente in eine separate Datei auslagern und in beiden verwenden.

**Datei:** `src/components/my-work/decisions/MyWorkDecisionCard.tsx`

## 6. Rueckmeldedatum statt Entscheidungsdatum anzeigen

**Problem:** In `DecisionCardActivity.tsx` (Zeile 150) wird `timeAgo(item.createdAt)` angezeigt. Das `createdAt` kommt von `latest.created_at` (Zeile 74), was das Erstellungsdatum der Response ist - sollte korrekt sein. Falls das Problem am `created_at` der Entscheidung statt der Response liegt, ist es wahrscheinlich ein Datenbank-Sortierungsproblem: `responses` werden nach `created_at DESC` sortiert (Zeile 398 in DecisionOverview.tsx), also sollte `responses[0]` die neueste sein.

**Analyse:** Das Problem liegt wahrscheinlich darin, dass bei einem Update (`response_type`-Aenderung) das `created_at` der Response NICHT aktualisiert wird - das Update setzt nur `updated_at`. Beim ersten Anlegen bleibt das `created_at` auf dem urspruenglichen Zeitpunkt. Da die Responses nach `created_at` sortiert werden, zeigt die Aktivitaet das richtige Datum. Aber wenn eine Antwort geupdated wird, bleibt das alte `created_at` bestehen.

**Loesung:** In `DecisionCardActivity.tsx` bei `createdAt` statt `latest.created_at` besser `latest.updated_at || latest.created_at` verwenden. Dafuer muss `updated_at` in die Response-Queries aufgenommen werden.

**Dateien:** `src/components/task-decisions/DecisionOverview.tsx` (Query erweitern um `updated_at`), `src/components/task-decisions/DecisionCardActivity.tsx` (updatedAt-Feld nutzen), `src/components/my-work/MyWorkDecisionsTab.tsx` (Query erweitern)

## 7. "Letzte Aktivitaet" fett und groesser

**Problem:** In `DecisionCardActivity.tsx` Zeile 118 steht `text-[10px]` - zu klein.

**Loesung:** Von `text-[10px] font-medium` auf `text-xs font-bold` aendern.

**Datei:** `src/components/task-decisions/DecisionCardActivity.tsx`

## 8. DB-Constraint auf `task_decision_response_history` entfernen

**Problem:** Der vorherige Fix hat nur den Constraint auf `task_decision_responses` entfernt. Es gibt aber einen Trigger `log_decision_response_change`, der bei jedem INSERT/UPDATE auf `task_decision_responses` einen Eintrag in `task_decision_response_history` schreibt. Diese History-Tabelle hat NOCH den CHECK-Constraint: `CHECK (response_type IN ('yes', 'no', 'question'))` (Zeile 7 der Migration `20251008093259`).

**Loesung:** Neue DB-Migration:
```sql
ALTER TABLE task_decision_response_history 
  DROP CONSTRAINT IF EXISTS task_decision_response_history_response_type_check;
```

**Datei:** Neue Migration

## 9. Tooltip-Beschreibungen fuer alle Templates (nicht nur Benutzerdefiniert)

**Problem:** Die `ResponseOptionsEditor`-Komponente (die Beschreibungsfelder zeigt) wird nur angezeigt wenn `selectedTemplateId === "custom"` (Zeile 535 in StandaloneDecisionCreator.tsx, Zeile 560 in TaskDecisionCreator.tsx).

**Loesung:** In `StandaloneDecisionCreator.tsx` und `TaskDecisionCreator.tsx`:
- Die Template-Optionen muessen editierbar gemacht werden, wenn ein nicht-Standard-Template gewaehlt wird.
- Wenn ein Template wie "optionABC" oder "rating5" gewaehlt wird, die Optionen in den `customOptions`-State kopieren und die `ResponseOptionsEditor` anzeigen.
- Alternative (einfacher): Die `ResponseOptionsEditor` auch fuer Nicht-Custom-Templates anzeigen, aber dann die Template-Optionen in den editierbaren State laden.

Konkret: Den Code aendern, sodass bei Template-Wechsel die Template-Optionen in `customOptions` kopiert werden, und `currentOptions` immer `customOptions` verwendet (nicht direkt die Template-Optionen). Der Editor wird fuer alle Templates ausser "yesNoQuestion" und "yesNo" angezeigt (da diese keine sinnvollen Beschreibungen brauchen).

**Dateien:** `src/components/task-decisions/StandaloneDecisionCreator.tsx`, `src/components/task-decisions/TaskDecisionCreator.tsx`

---

## Technische Details

### Betroffene Dateien

| Datei | Aenderungen |
|-------|-------------|
| **Neue DB-Migration** | DROP CONSTRAINT auf `task_decision_response_history` |
| `src/components/my-work/MyWorkDecisionsTab.tsx` | "Fuer mich" Tab-Logik erweitern, Query um `updated_at` erweitern |
| `src/components/task-decisions/DecisionOverview.tsx` | Doppelten Rueckfrage-Block entfernen (Zeilen 1029-1069), Query um `updated_at` erweitern |
| `src/components/task-decisions/TaskDecisionResponse.tsx` | Rueckfrage-Icon auf Reply, Begruendung-Icon entfernen + Rand |
| `src/components/task-decisions/DecisionCardActivity.tsx` | "Letzte Aktivitaet" groesser/fetter, updatedAt nutzen, Reply-Icon |
| `src/components/my-work/decisions/MyWorkDecisionCard.tsx` | TruncatedDescription einbauen |
| `src/components/task-decisions/StandaloneDecisionCreator.tsx` | ResponseOptionsEditor fuer alle Templates anzeigen |
| `src/components/task-decisions/TaskDecisionCreator.tsx` | ResponseOptionsEditor fuer alle Templates anzeigen |

### Reihenfolge

1. DB-Migration (History-Constraint entfernen) - blockiert Punkt 8
2. Doppelten Block entfernen (Punkt 2) 
3. Icons und Styling (Punkte 3, 4, 7)
4. TruncatedDescription (Punkt 5)
5. Datum-Fix (Punkt 6)
6. Tab-Logik (Punkt 1)
7. Template-Editor (Punkt 9)
