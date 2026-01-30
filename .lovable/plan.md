
# Plan: Aufgaben-Speicherung und Checkbox-Archivierung reparieren

## Zusammenfassung

Da die Datenbank-Logs zeigen, dass **keine neuen Fehler** nach dem letzten Deployment auftreten (die Fehler `text @>` und `created_at does not exist` sind von **vor** den Änderungen), liegt das Problem wahrscheinlich an:

1. **Browser-Cache**: Die alte Version wird noch verwendet
2. **Fehlerbehandlung**: Toast-Nachrichten werden falsch angezeigt
3. **Race Conditions**: Bei schnellen Klicks oder Netzwerkproblemen

---

## Identifizierte Probleme

### Problem 1: Fehlermeldung beim Speichern (obwohl es funktioniert)

In `TaskDetailSidebar.tsx` wird nach dem erfolgreichen Speichern `onTaskUpdate(updatedTask)` aufgerufen. Wenn dieser Callback eine Exception wirft (z.B. wegen eines anderen Problems auf der Seite), wird der catch-Block ausgeführt und zeigt "Fehler" an, obwohl die Daten bereits gespeichert wurden.

**Lösung**: Fehlerbehandlung verbessern - Toast erst nach onTaskUpdate anzeigen, mit try-catch um den Callback.

### Problem 2: Checkbox-Archivierung schlägt fehl

Die `toggleTaskStatus` Funktion in `TasksView.tsx` (Zeile 950-1048) macht ein **optimistisches Update**, aber:
- Der `archiveError` wird nur geloggt, nicht geworfen (Zeile 997-999)
- Der `deleteError` wird auch nur geloggt (Zeile 1007-1009)
- Die Toast-Nachricht "Status aktualisiert" erscheint auch wenn das Archivieren fehlschlägt

**Lösung**: Fehlerbehandlung verbessern - bei Archivierungs-/Löschfehler auch Rollback und Fehlermeldung anzeigen.

### Problem 3: Veraltete Version im Browser

Die alten DB-Fehler in den Logs deuten darauf hin, dass der Benutzer möglicherweise noch die alte Version verwendet.

**Lösung**: Benutzer sollte die Seite hart neu laden (Ctrl+Shift+R) oder den Cache leeren.

---

## Technische Änderungen

### 1. TaskDetailSidebar.tsx - Zeile 203-246 (handleSave)

```typescript
const handleSave = async () => {
  if (!task) return;

  setSaving(true);
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

    const updatedTask: Task = {
      ...task,
      ...editFormData as Task,
    };

    // Update local form data first
    setEditFormData(updatedTask);
    
    // Show success toast BEFORE calling onTaskUpdate
    toast({
      title: "Aufgabe gespeichert",
      description: "Die Änderungen wurden erfolgreich gespeichert.",
    });

    // Call onTaskUpdate in a try-catch to prevent it from affecting our flow
    try {
      onTaskUpdate(updatedTask);
    } catch (callbackError) {
      console.error('Error in onTaskUpdate callback:', callbackError);
      // Don't show error toast here - save was successful
    }
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
};
```

### 2. TasksView.tsx - Zeile 950-1048 (toggleTaskStatus)

Die Archivierungs- und Löschfehler werden jetzt korrekt behandelt:

```typescript
const toggleTaskStatus = async (taskId: string) => {
  // Prevent double clicks
  if (processingTaskIds.has(taskId)) return;
  
  const task = tasks.find(t => t.id === taskId);
  if (!task || !user) return;

  const newStatus = task.status === "completed" ? "todo" : "completed";
  
  // Optimistic update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, status: newStatus } : t
  ));
  
  setProcessingTaskIds(prev => new Set(prev).add(taskId));
  
  try {
    const updateData: any = { 
      status: newStatus,
      progress: newStatus === "completed" ? 100 : task.progress || 0
    };

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) throw error;

    // If task is completed, archive it
    if (newStatus === "completed") {
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
        } as any);

      if (archiveError) {
        console.error('Error archiving task:', archiveError);
        // Throw to trigger rollback - archiving failed
        throw new Error('Archivierung fehlgeschlagen: ' + archiveError.message);
      }

      // Delete the task from the tasks table
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (deleteError) {
        console.error('Error deleting completed task:', deleteError);
        // Task is archived but not deleted - this is okay, just log it
        // We don't throw here because the archive was successful
      }
      
      // Mark task-related notifications as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('navigation_context', 'tasks');
        
      // Trigger unicorn animation
      setShowUnicorn(true);
    }

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
      t.id === taskId ? { ...t, status: task.status } : t
    ));
    toast({
      title: "Fehler",
      description: error.message || "Status konnte nicht aktualisiert werden.",
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

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `src/components/TaskDetailSidebar.tsx` | Toast vor `onTaskUpdate` anzeigen; `onTaskUpdate` in try-catch wrappen |
| `src/components/TasksView.tsx` | Bei Archivierungsfehler Exception werfen und Rollback durchführen; Fehlermeldung mit Details anzeigen |

---

## Wichtiger Hinweis für den Benutzer

Nach der Implementierung dieser Änderungen sollte der Benutzer:
1. Die Seite **hart neu laden** (Ctrl+Shift+R oder Cmd+Shift+R auf Mac)
2. Alternativ: Browser-Cache leeren
3. Falls die Probleme bestehen bleiben, prüfen ob es spezifische Fehlermeldungen in der Browser-Konsole gibt (F12 → Console)

---

## Erwartete Ergebnisse

1. **Aufgaben bearbeiten**: Erfolgs-Toast wird angezeigt, wenn die Daten erfolgreich gespeichert wurden - unabhängig von nachfolgenden UI-Updates
2. **Checkbox-Archivierung**: Bei Fehlern wird ein Rollback durchgeführt und eine aussagekräftige Fehlermeldung angezeigt
3. **Checkbox-Status**: Wird korrekt zurückgesetzt wenn die Archivierung fehlschlägt
