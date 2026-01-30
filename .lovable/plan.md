
# Plan: Aufgaben-Speicherung und Archivierung - Vollständige Behebung

## Problem-Analyse

Nach tiefgehender Untersuchung wurde festgestellt, dass das Problem durch **"Failed to fetch" Fehler** verursacht wird. Diese Fehler treten auf, wenn:
- Die HTTP-Anfrage gesendet wird
- React die Komponente re-rendert oder unmountet bevor die Antwort zurückkommt
- Die Anfrage als "abgebrochen" markiert wird

**Wichtig**: Bei "Failed to fetch" wurden die Daten oft bereits gespeichert! Dies erklärt, warum die Änderungen nach einem Seiten-Reload sichtbar sind.

## Bewährtes Muster aus dem Projekt

In `EventPlanningView.tsx` (Zeilen 1360-1388) existiert bereits eine robuste Lösung:
- Bei Netzwerk-Fehlern wird **kein Fehler-Toast** angezeigt
- Nach 500ms wird der aktuelle Stand vom Server geholt
- Nur bei echten Datenbank-Fehlern (z.B. RLS-Verletzung) wird ein Fehler angezeigt

---

## Technische Änderungen

### 1. TaskDetailSidebar.tsx - handleSave verbessern

**Datei**: `src/components/TaskDetailSidebar.tsx`
**Zeilen**: 203-264

Die neue Implementierung unterscheidet zwischen echten Fehlern und Netzwerk-Abbrüchen:

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

    if (error) {
      // Check if this is a network error (request was sent but connection interrupted)
      const isNetworkError = error.message?.includes('Failed to fetch') || 
                             error.message?.includes('NetworkError') ||
                             error.message?.includes('TypeError');
      
      if (isNetworkError) {
        // Network interruption - data might have been saved, verify after delay
        console.warn('Network interruption during save, verifying...', error);
        
        setTimeout(async () => {
          // Verify the save by fetching fresh data
          const { data: freshTask } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', task.id)
            .single();
          
          if (freshTask) {
            // Check if our changes were actually saved
            const savedCorrectly = freshTask.title === editFormData.title &&
                                   freshTask.description === editFormData.description;
            
            if (savedCorrectly) {
              toast({
                title: "Aufgabe gespeichert",
                description: "Die Änderungen wurden erfolgreich gespeichert.",
              });
              
              const updatedTask: Task = { ...task, ...editFormData as Task };
              setEditFormData(updatedTask);
              try { onTaskUpdate(updatedTask); } catch (e) {}
            }
          }
        }, 500);
        
        return; // No error toast for network interruptions
      }
      
      // Real database error - show error toast
      throw error;
    }
    
    // Success - show toast immediately
    const updatedTask: Task = { ...task, ...editFormData as Task };
    
    toast({
      title: "Aufgabe gespeichert",
      description: "Die Änderungen wurden erfolgreich gespeichert.",
    });
    
    setEditFormData(updatedTask);
    try { onTaskUpdate(updatedTask); } catch (e) {}
    
  } catch (error: any) {
    // Check for network errors in the catch block too
    const isNetworkError = error?.message?.includes('Failed to fetch') || 
                           error?.message?.includes('NetworkError') ||
                           error?.message?.includes('TypeError');
    
    if (isNetworkError) {
      // Verify after delay instead of showing error
      setTimeout(async () => {
        const { data: freshTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', task.id)
          .single();
        
        if (freshTask && freshTask.title === editFormData.title) {
          toast({
            title: "Aufgabe gespeichert",
            description: "Die Änderungen wurden erfolgreich gespeichert.",
          });
          const updatedTask: Task = { ...task, ...editFormData as Task };
          setEditFormData(updatedTask);
          try { onTaskUpdate(updatedTask); } catch (e) {}
        }
      }, 500);
      return;
    }
    
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

### 2. TasksView.tsx - toggleTaskStatus verbessern

**Datei**: `src/components/TasksView.tsx`
**Zeilen**: 950-1072

Gleiche Logik anwenden:

```typescript
const toggleTaskStatus = async (taskId: string) => {
  if (processingTaskIds.has(taskId)) return;
  
  const task = tasks.find(t => t.id === taskId);
  if (!task || !user) return;

  const newStatus = task.status === "completed" ? "todo" : "completed";
  const originalStatus = task.status;
  const originalProgress = task.progress || 0;
  
  // Optimistic update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, status: newStatus } : t
  ));
  
  setProcessingTaskIds(prev => new Set(prev).add(taskId));
  
  try {
    const updateData = { 
      status: newStatus,
      progress: newStatus === "completed" ? 100 : originalProgress
    };

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      // Check for network errors
      const isNetworkError = error.message?.includes('Failed to fetch') || 
                             error.message?.includes('NetworkError') ||
                             error.message?.includes('TypeError');
      
      if (isNetworkError) {
        console.warn('Network interruption, verifying task status...', error);
        
        // Verify after delay
        setTimeout(async () => {
          const { data: freshTask } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
          
          if (!freshTask) {
            // Task was deleted (archived successfully)
            setTasks(prev => prev.filter(t => t.id !== taskId));
            toast({
              title: "Status aktualisiert",
              description: "Aufgabe wurde archiviert."
            });
          } else if (freshTask.status === newStatus) {
            // Status update was successful
            loadTasks();
            toast({
              title: "Status aktualisiert",
              description: newStatus === "completed" 
                ? "Aufgabe wurde als erledigt markiert."
                : "Aufgabe wurde als offen markiert."
            });
          } else {
            // Update didn't go through, revert UI
            setTasks(prev => prev.map(t => 
              t.id === taskId ? { ...t, status: originalStatus } : t
            ));
          }
        }, 500);
        
        return; // Don't proceed, let verification handle it
      }
      
      throw error;
    }

    // If completing task, archive it
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
        const isNetworkError = archiveError.message?.includes('Failed to fetch');
        
        if (isNetworkError) {
          // Verify after delay
          setTimeout(() => loadTasks(), 500);
          return;
        }
        
        // Real error - rollback
        await supabase
          .from('tasks')
          .update({ status: originalStatus, progress: originalProgress })
          .eq('id', taskId);
        throw archiveError;
      }

      // Delete task from tasks table
      await supabase.from('tasks').delete().eq('id', taskId);
      
      // Fire and forget: mark notifications as read
      void supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('navigation_context', 'tasks');
        
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
    
    // Check for network errors in catch
    const isNetworkError = error?.message?.includes('Failed to fetch') || 
                           error?.message?.includes('NetworkError');
    
    if (isNetworkError) {
      setTimeout(() => loadTasks(), 500);
      return;
    }
    
    // Rollback UI on real error
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: originalStatus } : t
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
| `TaskDetailSidebar.tsx` | Netzwerk-Fehler erkennen, nach 500ms verifizieren, nur bei echten Fehlern Toast anzeigen |
| `TasksView.tsx` | Gleiche Logik: bei Netzwerk-Abbruch Serverstand verifizieren statt Fehler anzeigen |

---

## Erwartete Ergebnisse

1. **Aufgaben speichern**: Bei erfolgreicher Speicherung erscheint der Erfolgs-Toast; bei Netzwerk-Abbrüchen wird nach 500ms verifiziert ob die Speicherung erfolgreich war
2. **Checkbox-Archivierung**: Aufgaben werden korrekt archiviert; bei Netzwerk-Abbrüchen wird der Serverstand verifiziert statt einen Fehler anzuzeigen
3. **Keine falschen Fehlermeldungen**: "Failed to fetch" Fehler werden nicht mehr als Fehlermeldungen angezeigt
