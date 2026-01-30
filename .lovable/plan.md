
# Plan: Checkbox-Archivierung und Archiv-Wiederherstellung beheben

## Problem-Zusammenfassung

### Problem 1: Aufgabe verschwindet nicht nach Checkbox-Klick
Wenn eine Aufgabe als erledigt markiert wird (Checkbox), passiert folgendes:
1. Die Aufgabe wird optimistisch auf `status: "completed"` gesetzt
2. Die Aufgabe wird in `archived_tasks` eingefuegt
3. Die Aufgabe wird aus `tasks` geloescht
4. `loadTasks()` wird aufgerufen, aber...
5. **Die Aufgabe wird NICHT sofort aus der UI entfernt** - sie wartet auf das Nachladen

**Ursache**: Der Code ruft `loadTasks()` auf (Zeile 1105), loescht die Aufgabe aber nicht aus dem lokalen State. Das Nachladen ist asynchron und die UI zeigt weiterhin die alte Liste.

### Problem 2: Archiv-Wiederherstellung zeigt Fehler
Beim Wiederherstellen einer Aufgabe aus dem Archiv:
1. Es wird geprueft, ob die Aufgabe mit `task_id` noch existiert
2. Falls nicht, wird eine neue Aufgabe mit `tenant_id: currentTenant?.id` erstellt
3. **Problem**: Wenn `currentTenant` leer oder `undefined` ist, wird eine leere `tenant_id` geschrieben
4. Die RLS-Policy fuer `tasks` erfordert `tenant_id = ANY (get_user_tenant_ids(auth.uid()))`
5. Eine leere `tenant_id` kann die RLS-Pruefung fehlschlagen lassen

---

## Technische Aenderungen

### Aenderung 1: TasksView.tsx - Aufgabe nach Archivierung sofort aus UI entfernen

**Datei**: `src/components/TasksView.tsx`
**Zeilen**: 1090-1106

Nach dem erfolgreichen Loeschen der Aufgabe aus der Datenbank muss der lokale State sofort aktualisiert werden, anstatt auf `loadTasks()` zu warten:

```typescript
// Nach Zeile 1093: Delete task from tasks table
await supabase.from('tasks').delete().eq('id', taskId);

// SOFORT aus lokalem State entfernen (NEU)
setTasks(prev => prev.filter(t => t.id !== taskId));

// Fire and forget: mark notifications as read
void supabase
  .from('notifications')
  .update({ is_read: true })
  // ...
```

Zusaetzlich muss der `loadTasks()` Aufruf bedingt gemacht werden, da die UI bereits aktualisiert ist:

```typescript
// loadTasks() nur aufrufen wenn Task NICHT geloescht wurde
if (newStatus !== "completed") {
  loadTasks();
}
```

### Aenderung 2: TaskArchiveModal.tsx - Bessere tenant_id Behandlung

**Datei**: `src/components/TaskArchiveModal.tsx`
**Zeilen**: 204-223

Das Problem ist, dass `currentTenant?.id` moeglicherweise undefined ist. Die Loesung:

1. Den `tenant_id` aus der archivierten Aufgabe laden (falls gespeichert)
2. Oder vom User-Profil holen
3. Fallback auf den ersten verfuegbaren Tenant des Users

```typescript
// Hole tenant_id sicher
let tenantId = currentTenant?.id;

if (!tenantId) {
  // Fallback: Hole vom User's Tenant-Zuordnung
  const { data: tenantData } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();
  
  tenantId = tenantData?.tenant_id;
}

if (!tenantId) {
  throw new Error('Kein Tenant gefunden - bitte Admin kontaktieren');
}

// Dann insert mit valider tenant_id
const { error: insertError } = await supabase
  .from('tasks')
  .insert({
    id: task.task_id,
    user_id: user.id,
    tenant_id: tenantId, // Jetzt garantiert vorhanden
    // ...
  });
```

### Aenderung 3: Netzwerkfehler-Behandlung verbessern

Die Verifizierung nach Netzwerkfehlern in `toggleTaskStatus` (Zeilen 1054-1081) hat eine Luecke: Wenn das Archivieren erfolgreich war, aber der Netzwerkfehler beim Loeschen auftritt, wird die Aufgabe nicht aus dem State entfernt.

```typescript
if (isNetworkError) {
  setTimeout(async () => {
    // Pruefe ob Aufgabe archiviert wurde
    const { data: archived } = await supabase
      .from('archived_tasks')
      .select('id')
      .eq('task_id', taskId)
      .single();
    
    if (archived) {
      // Archiv erfolgreich - entferne aus UI
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Versuche nochmal zu loeschen (falls es beim ersten Mal fehlschlug)
      await supabase.from('tasks').delete().eq('id', taskId);
      
      setShowUnicorn(true);
      toast({ title: "Status aktualisiert", description: "Aufgabe wurde archiviert." });
    } else {
      // Archiv fehlgeschlagen - revert
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: originalStatus } : t
      ));
    }
  }, 500);
  return;
}
```

---

## Zusammenfassung der Aenderungen

| Datei | Zeilen | Aenderung |
|-------|--------|-----------|
| `TasksView.tsx` | 1093-1106 | `setTasks(prev => prev.filter(t => t.id !== taskId))` nach erfolgreichem Loeschen |
| `TasksView.tsx` | 1105 | `loadTasks()` nur aufrufen wenn `newStatus !== "completed"` |
| `TasksView.tsx` | 1054-1081 | Netzwerkfehler-Behandlung: UI sofort aktualisieren wenn Archiv erfolgreich |
| `TaskArchiveModal.tsx` | 204-223 | `tenant_id` sicher aus `tenant_users` holen falls `currentTenant` undefined |

---

## Erwartete Ergebnisse

1. **Checkbox-Klick**: Aufgabe verschwindet **sofort** aus der Liste nach erfolgreichem Archivieren
2. **Archiv-Wiederherstellung**: Funktioniert zuverlaessig, auch wenn `currentTenant` nicht geladen ist
3. **Netzwerkfehler**: Bei Unterbrechungen wird der Status verifiziert und die UI korrekt aktualisiert
