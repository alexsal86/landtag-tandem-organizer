

## Plan: Tageszettel — Bug-Fix "Tag abschließen" + Verbesserungen

### Problem 1: Zuweisungen erzeugen keine Einträge

**Ursache:** `persistResolvedItems()` (Zeile 450-461 in `useDaySlipStore.ts`) wird korrekt aufgerufen und enthält die richtige Insert-Logik. Allerdings gibt es **zwei kritische Probleme**:

1. **Keine Fehlerbehandlung mit Feedback** — Fehler werden nur geloggt (`logStoreEvent`), aber der Nutzer sieht keinen Hinweis, wenn ein Insert fehlschlägt (z. B. wegen RLS-Policies oder fehlender `tenant_id`).

2. **Keine Duplikat-Vermeidung** — Wenn der Nutzer den Tag zweimal abschließt (z. B. Panel nochmal öffnet), werden die gleichen Items erneut eingefügt. Es fehlt ein `persisted`-Flag pro `ResolvedItem`.

3. **Decision-Insert unvollständig** — `task_decisions` wird nur mit `created_by`, `title`, `description`, `status` insertet. Es fehlt `tenant_id`, was bei RLS-Policies zum stillen Fehler führen kann.

**Fix:**

- **`persistResolvedItems` erweitern:**
  - `tenant_id` beim Decision-Insert mitgeben
  - Jedes erfolgreich persistierte Item mit `persisted: true` markieren, um Duplikate zu vermeiden
  - Fehler als Toast anzeigen (`sonner`), damit der Nutzer sieht, wenn etwas schiefgeht
  - Erfolg ebenfalls als Toast bestätigen ("3 Einträge erstellt: 1 Notiz, 2 Aufgaben")

### Problem 2: Build-Error `PlannerNoteCard.tsx`

`NOTE_COLORS`-Objekte haben kein `label`-Property, aber Zeile 110 nutzt `colorOption.label` im aria-label.

**Fix:** `label`-Property zu jedem Eintrag in `NOTE_COLORS` hinzufügen (z. B. "Gelb", "Orange", "Blau", etc.)

### Verbesserungsvorschläge für den Tageszettel

1. **Erfolgsfeedback nach Persistierung** — Toast mit Zusammenfassung ("2 Aufgaben, 1 Notiz erstellt")
2. **Verknüpfung anzeigen** — Nach dem Erstellen die ID des erzeugten Items auf dem `ResolvedItem` speichern, damit man später darauf verlinken könnte
3. **Snooze mit Datum** — Aktuell wird "Snoozen" nur als Label gespeichert, aber es gibt kein Zieldatum. Man könnte ein einfaches "+1 Tag" / "+3 Tage" / "Nächste Woche" Auswahlmenü anbieten
4. **Prioritäts-Übernahme** — Items mit `!!` oder `!` Prefix könnten als "high"/"medium" Priorität in die erstellte Aufgabe übernommen werden (statt immer "medium")
5. **Bestätigungs-Zusammenfassung** — Vor dem endgültigen Abschließen eine kompakte Zusammenfassung zeigen: "Es werden erstellt: 2 Aufgaben, 1 Notiz, 1 Entscheidung. 3 archiviert."

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/dayslip/hooks/useDaySlipStore.ts` | `persistResolvedItems` fixen: tenant_id für decisions, persisted-Flag, Toast-Feedback, Prioritäts-Übernahme |
| `src/components/dayslip/dayslipTypes.ts` | `ResolvedItem` Type um `persisted?: boolean` erweitern |
| `src/features/redaktion/hooks/usePlannerNotes.ts` | `label` Property zu `NOTE_COLORS` hinzufügen |
| `src/features/redaktion/components/PlannerNoteCard.tsx` | Kein Code-Change nötig (nutzt dann das neue `label`) |

### Scope-Vorschlag

Für diese Iteration schlage ich vor, den **Bug-Fix** (persistieren funktioniert + Duplikat-Schutz + Feedback) und den **Build-Error** zu beheben. Die weitergehenden Verbesserungen (Snooze-Datum, Bestätigungs-Zusammenfassung) können in einem Folgeschritt umgesetzt werden.

