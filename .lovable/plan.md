
# Plan: 5 Fehler in Entscheidungen, Aufgaben und Admin-Bereich beheben

## Uebersicht der identifizierten Probleme

| # | Problem | Ursache | Loesung |
|---|---------|---------|---------|
| 1 | Task-Status im Admin: Fehler, aber funktioniert | Timing/State-Problem nach erfolgreichem Save | Optimistic UI Pattern einsetzen |
| 2 | Entscheidung bearbeiten: Fehler, aber funktioniert | Timing-Problem mit Dialog-Schliessen | Reihenfolge optimieren |
| 3 | **Task-Status setzen schlaegt fehl (nicht gespeichert)** | **CHECK-Constraint `tasks_status_check` erlaubt nur 3 Werte** | **CHECK-Constraint entfernen** |
| 4 | Rueckfrage bearbeiten: Vorheriger Text fehlt | `questionComment` wird nicht vorausgefuellt | State vorausfuellen beim Edit-Start |
| 5 | Antwort aendern: Fehler, aber funktioniert | Timing-Problem | Optimistic UI Pattern |

---

## Problem 3 (Kritisch): CHECK-Constraint blockiert Status-Aenderungen

### Detaillierte Analyse

Die Datenbank hat eine CHECK-Constraint:
```sql
CHECK (status = ANY (ARRAY['todo'::text, 'in-progress'::text, 'completed'::text]))
```

Die `task_statuses`-Tabelle enthaelt aber diese Werte:
- `to-do` (nicht `todo`)
- `in_progress` (nicht `in-progress`)
- `review`
- `done` (nicht `completed`)
- `cancelled`

**Ergebnis:** Jeder Versuch, einen Status aus der dynamischen Tabelle zu setzen, schlaegt fehl!

### Loesung

**DB-Migration:** Die CHECK-Constraint muss entfernt werden, da die Status-Werte jetzt dynamisch verwaltet werden.

```sql
-- Remove the static check constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
```

---

## Problem 4: Rueckfrage bearbeiten zeigt vorherigen Text nicht

### Analyse

In `TaskDecisionResponse.tsx`:
- Zeile 283: `onClick={() => setShowEdit(true)}` startet den Bearbeitungsmodus
- Der `questionComment` State bleibt aber leer
- Der vorhandene `currentResponse.comment` wird nicht in den Editor geladen

### Loesung

**Datei:** `src/components/task-decisions/TaskDecisionResponse.tsx`

Beim Klick auf "Aendern" muss der vorhandene Kommentar geladen werden:

```typescript
// Zeile 280-288 aendern
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    // Vorherigen Kommentar in den Editor laden
    setQuestionComment(currentResponse?.comment || "");
    setShowEdit(true);
  }}
  className="text-xs"
>
  <Edit2 className="h-3 w-3 mr-1" />
  Ändern
</Button>
```

---

## Probleme 1, 2, 5: Fehler trotz erfolgreichem Speichern

### Analyse

Die Fehler treten auf, obwohl die Daten gespeichert werden. Die wahrscheinliche Ursache ist:
1. Die DB-Operation ist erfolgreich
2. Dann wird `loadItems()` oder `loadDecisionRequests()` aufgerufen
3. Waehrend des Reloads gibt es einen State-Konflikt oder unerwarteten Fehler
4. Der Error-Handler wird faelschlicherweise getriggert

### Loesung: Optimistic UI mit expliziter Fehlerbehandlung

**Datei:** `src/components/administration/ConfigurableTypeSettings.tsx`

```typescript
const handleSave = async () => {
  if (!editingItem?.label.trim()) return;

  // Optimistic UI: Sofort State aktualisieren
  const previousItems = [...items];
  const updatedItems = items.map(item => 
    item.id === editingItem.id 
      ? { ...item, label: editingItem.label, color: editingItem.color, icon: editingItem.icon }
      : item
  );
  setItems(updatedItems);
  setEditingItem(null);

  try {
    const updateData: any = {
      name: editingItem.label.toLowerCase().replace(/\s+/g, '_'),
      label: editingItem.label
    };

    if (hasColor) {
      updateData.color = editingItem.color;
    }
    if (hasIcon) {
      updateData.icon = editingItem.icon || null;
    }

    const { error } = await supabase.from(tableName).update(updateData).eq('id', editingItem.id);
    
    if (error) {
      // Rollback bei echtem Fehler
      setItems(previousItems);
      throw error;
    }

    toast({ title: "Erfolg", description: `${entityName} wurde erfolgreich aktualisiert.` });
  } catch (error: any) {
    console.error(`Error updating ${entityName}:`, error);
    toast({ title: "Fehler", description: `${entityName} konnte nicht aktualisiert werden.`, variant: "destructive" });
  }
};
```

**Datei:** `src/components/task-decisions/DecisionEditDialog.tsx`

Aehnliche Anpassung: Toast vor dem Schliessen zeigen, dann erst onClose() aufrufen.

```typescript
// Zeile 175-184 anpassen
toast({
  title: "Erfolgreich",
  description: "Entscheidung wurde aktualisiert.",
});

// Erst Toast zeigen, dann Callbacks
setTimeout(() => {
  onUpdated();
  onClose();
}, 100);
```

**Datei:** `src/components/task-decisions/TaskDecisionResponse.tsx`

Bei `handleResponse`: Optimistic Update fuer den Response-Status.

---

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|-------|-----------|
| **DB-Migration** | `tasks_status_check` Constraint entfernen |
| `src/components/task-decisions/TaskDecisionResponse.tsx` | Vorherigen Kommentar beim Bearbeiten vorausfuellen |
| `src/components/administration/ConfigurableTypeSettings.tsx` | Optimistic UI Pattern fuer alle CRUD-Operationen |
| `src/components/task-decisions/DecisionEditDialog.tsx` | Toast-Timing optimieren |

---

## Technische Details

### Check-Constraint Entfernung

Die `tasks_status_check` Constraint ist veraltet, da die Status-Werte jetzt dynamisch ueber die `task_statuses`-Tabelle verwaltet werden. Die Constraint verhindert, dass benutzerdefinierte Status-Werte verwendet werden koennen.

**Vorher:**
```
Status in DB: todo, in-progress, completed (nur diese erlaubt)
Status in UI: to-do, in_progress, review, done, cancelled (dynamisch)
```

**Nachher:**
```
Status in DB: Alle Werte aus task_statuses sind erlaubt
Status in UI: Alle Werte aus task_statuses werden angezeigt
```

### Optimistic UI Pattern

```
1. User klickt "Speichern"
2. UI aktualisiert sich SOFORT (optimistisch)
3. API-Call wird im Hintergrund ausgefuehrt
4. Bei Fehler: UI wird zurueckgesetzt (Rollback)
5. Bei Erfolg: Toast zeigt Bestaetigung
```

Dieses Muster verhindert falsche Fehlermeldungen bei Netzwerk-Timing-Problemen.
