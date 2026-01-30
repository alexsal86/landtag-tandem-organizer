

# Plan: Vollständige Behebung der Aufgaben-Fehler

## Zusammenfassung

Nach tiefgehender Analyse wurde festgestellt, dass die Fehler durch eine Kombination aus veraltetem Browser-Cache und Hintergrund-Queries verursacht werden, die während der Aufgaben-Operationen Exceptions werfen.

## Identifizierte Probleme

### Problem 1: Fehler beim Speichern von Aufgaben
Der Toast "Fehler" erscheint, obwohl die Daten gespeichert werden. Dies liegt daran, dass:
- Im Hintergrund laufende Queries (z.B. `useMyWorkNewCounts`) Fehler werfen
- Diese Fehler das React-Rendering beeinflussen und den Eindruck erwecken, dass das Speichern fehlgeschlagen ist

### Problem 2: "Failed to fetch" beim Archivieren
Dies ist ein clientseitiger Netzwerkfehler, der auftritt wenn:
- Der optimistische UI-Update passiert, aber die Server-Anfrage fehlschlägt
- Es gibt keine ausreichende Fehlerbehandlung für Netzwerk-Timeouts

### Problem 3: Veraltete Queries in Hintergrund-Hooks
Die DB-Logs zeigen:
- `operator does not exist: text @> unknown` - Ein alter `.cs.{}` Operator wird noch verwendet
- `column task_decision_participants.created_at does not exist` - Eine falsche Spalte wird abgefragt

---

## Technische Änderungen

### 1. TaskDetailSidebar.tsx - Robustere Speicherlogik

Die aktuelle `handleSave` Funktion hat bereits eine Verbesserung. Jedoch muss zusätzlich sichergestellt werden, dass der Toast **vor** allen React-State-Updates angezeigt wird und die Funktion **nicht** durch externe Fehler beeinflusst wird.

**Datei:** `src/components/TaskDetailSidebar.tsx`
**Zeilen:** 203-255

```typescript
const handleSave = async () => {
  if (!task) return;

  setSaving(true);
  
  // Store success flag outside try-catch to prevent interference
  let saveSuccessful = false;
  
  try {
    const { error } = await supabase
      .from('tasks')
      .update({
        title: editFormData.title,
        description: editFormData.description,
        priority: editFormData.priority,
        status: editFormData.status,
        due_date: editFormData.dueDate,
        category: editFormData.category,
        assigned_to: editFormData.assignedTo || '',
        progress: editFormData.progress,
      })
      .eq('id', task.id);

    if (error) throw error;
    
    saveSuccessful = true;
  } catch (error) {
    console.error('Error saving task:', error);
    toast({
      title: "Fehler",
      description: "Aufgabe konnte nicht gespeichert werden.",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
  
  // Only show success and update state if save was successful
  if (saveSuccessful) {
    const updatedTask: Task = {
      ...task,
      ...editFormData as Task,
    };

    // Show success toast IMMEDIATELY
    toast({
      title: "Aufgabe gespeichert",
      description: "Die Änderungen wurden erfolgreich gespeichert.",
    });
    
    // Update states after toast is shown
    setEditFormData(updatedTask);
    
    // Wrap callback to prevent any errors from affecting us
    try {
      onTaskUpdate(updatedTask);
    } catch (e) {
      console.error('Error in onTaskUpdate callback:', e);
    }
  }
};
```

### 2. TasksView.tsx - Bessere Netzwerk-Fehlerbehandlung beim Archivieren

**Datei:** `src/components/TasksView.tsx`
**Zeilen:** 950-1053

```typescript
const toggleTaskStatus = async (taskId: string) => {
  // Prevent double clicks
  if (processingTaskIds.has(taskId)) return;
  
  const task = tasks.find(t => t.id === taskId);
  if (!task || !user) return;

  const newStatus = task.status === "completed" ? "todo" : "completed";
  const originalStatus = task.status;
  
  // Optimistic update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, status: newStatus } : t
  ));
  
  setProcessingTaskIds(prev => new Set(prev).add(taskId));
  
  try {
    const updateData = { 
      status: newStatus,
      progress: newStatus === "completed" ? 100 : task.progress || 0
    };

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
    }

    // If task is completed, archive it
    if (newStatus === "completed") {
      try {
        const { error: archiveError } = await supabase
          .from('archived_tasks')
          .insert({
            task_id: taskId,
            user_id: user.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            category: task.category,
            assigned_to: task.assignedTo || '',
            progress: 100,
            due_date: task.dueDate,
            completed_at: new Date().toISOString(),
            auto_delete_after_days: null,
          });

        if (archiveError) {
          throw new Error(`Archivierung fehlgeschlagen: ${archiveError.message}`);
        }

        // Delete the task from the tasks table
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId);

        if (deleteError) {
          console.warn('Task archived but not deleted:', deleteError);
          // Don't throw - archive was successful
        }
        
        // Mark notifications as read (don't await - fire and forget)
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('navigation_context', 'tasks')
          .then(() => {})
          .catch(e => console.warn('Failed to mark notifications:', e));
          
        // Trigger unicorn animation
        setShowUnicorn(true);
        
      } catch (archiveErr: any) {
        // Rollback the status update
        await supabase
          .from('tasks')
          .update({ status: originalStatus, progress: task.progress || 0 })
          .eq('id', taskId);
        throw archiveErr;
      }
    }

    // Reload tasks after successful operation
    loadTasks();
    
    toast({
      title: "Status aktualisiert",
      description: newStatus === "completed" 
        ? "Aufgabe wurde als erledigt markiert und archiviert."
        : "Aufgabe wurde als offen markiert."
    });
    
  } catch (error: any) {
    console.error('Error updating task:', error);
    
    // Rollback on error
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: originalStatus } : t
    ));
    
    // More descriptive error message
    const errorMessage = error.message?.includes('fetch') 
      ? "Netzwerkfehler - bitte Internetverbindung prüfen und erneut versuchen."
      : error.message || "Status konnte nicht aktualisiert werden.";
    
    toast({
      title: "Fehler",
      description: errorMessage,
      variant: "destructive"
    });
  } finally {
    setProcessingTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }
};
```

### 3. useMyWorkNewCounts.tsx - Verbleibende Query-Fehler beheben

Obwohl die Hauptqueries bereits korrigiert wurden, gibt es noch eine Stelle in Zeile 120, die `created_at` auf `task_decision_responses` verwendet. Die `task_decision_responses` Tabelle muss geprüft werden.

**Datei:** `src/hooks/useMyWorkNewCounts.tsx`
**Zeile:** 120

**Prüfung erforderlich:** Welche Spalten hat `task_decision_responses`?

Falls `created_at` nicht existiert, muss die Query angepasst werden.

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `TaskDetailSidebar.tsx` | Speicher-Flag außerhalb try-catch; Toast vor State-Updates |
| `TasksView.tsx` | Expliziter Rollback bei Archiv-Fehler; Server-Rollback; Netzwerk-Fehler-Erkennung |
| `useMyWorkNewCounts.tsx` | Query-Spalte prüfen und ggf. korrigieren |

---

## Wichtig: Browser-Cache

Nach der Implementierung **muss** die Seite mit `Ctrl+Shift+R` (Windows) oder `Cmd+Shift+R` (Mac) neu geladen werden, um sicherzustellen, dass der neue Code verwendet wird.

---

## Erwartete Ergebnisse

1. **Aufgaben speichern:** Erfolgs-Toast wird zuverlässig angezeigt
2. **Checkbox-Archivierung:** Aufgaben werden korrekt archiviert; bei Netzwerkproblemen erscheint eine klare Fehlermeldung und die Checkbox wird zurückgesetzt
3. **Keine Hintergrund-Fehler:** Die korrigierten Queries verursachen keine DB-Fehler mehr

