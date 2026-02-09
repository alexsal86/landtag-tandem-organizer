
# Plan: 4 verbleibende Entscheidungssystem-Fehler beheben

## Analyse der tatsaechlichen Fehlerursachen

Durch Analyse der DB-Policies, Trigger, Netzwerk-Logs und des Codes wurden die echten Root Causes gefunden:

### Warum die bisherigen Fixes nicht geholfen haben

Die RLS-Bereinigung und Trigger-Entfernung waren erfolgreich (bestaetigt durch DB-Abfragen). Die Fehler kommen aus dem **Frontend-Code selbst**:

| Nr | Problem | Tatsaechliche Ursache | Loesung |
|----|---------|----------------------|---------|
| 1 | Antwort auf Rueckfrage speichert, zeigt aber Fehler | `sendCreatorResponse` in `DecisionOverview.tsx` (Zeile 452-462): Die JOIN-Query `task_decision_participants!inner(user_id), task_decisions!inner(title)` mit `.single()` kann fehlschlagen. Danach sendet es eine Notification per RPC. Wenn eins davon scheitert, wird der Fehler-Toast gezeigt, obwohl das eigentliche UPDATE bereits erfolgreich war. | Update ZUERST ausfuehren, Notification-Logik in separaten try/catch verschieben |
| 2 | Fehler beim Archivieren in TaskDecisionDetails | In `archiveDecision()` (Zeile 209-213): Nach dem erfolgreichen UPDATE wird `await supabase.from('notifications').update(...)` aufgerufen. Netzwerk-Logs zeigen: `PATCH .../notifications... Error: Failed to fetch`. Dieser Fehler ist im selben try/catch und blockiert den Erfolgs-Toast und Dialog-Schliessen. | Notification-Update in separaten try/catch verschieben |
| 3 | Standard-Teilnehmer fehlt bei TaskDecisionCreator (aus Aufgaben) | `profilesLoaded` wird nach dem Zuruecksetzen des Formulars (Zeile 443-455) NICHT zurueckgesetzt. Beim zweiten Oeffnen ist `profilesLoaded = true`, sodass `loadProfiles` nicht erneut aufgerufen wird und `selectedUsers = []` bleibt. | `profilesLoaded` zuruecksetzen wenn Dialog schliesst |
| 4 | Inline-Antwort auf Rueckmeldungen direkt aus der Card | Noch nicht implementiert | Button und Inline-Editor in DecisionCardActivity hinzufuegen |

---

## Technische Details

### Fix 1: sendCreatorResponse resilient machen

**Dateien:** `DecisionOverview.tsx`, `TaskDecisionDetails.tsx`

In `DecisionOverview.tsx` Zeile 445-509: Die Funktion fuehrt 3 Schritte aus:
1. JOIN-Query um participant_user_id und decision_title zu holen (fuer Notification)
2. UPDATE der creator_response
3. Notification senden

Problem: Wenn Schritt 1 oder 3 fehlschlaegt, wird der Fehler-Toast gezeigt, obwohl Schritt 2 erfolgreich war.

**Neue Reihenfolge:**
```
1. UPDATE der creator_response (Kernoperation)
2. Bei Erfolg: Erfolgs-Toast zeigen + State zuruecksetzen
3. Danach in separatem try/catch: Notification senden (best-effort)
4. Liste neu laden
```

In `TaskDecisionDetails.tsx` Zeile 154-183: Gleiche Logik - Update funktioniert, aber `loadDecisionDetails()` koennte theoretisch scheitern. Ist aber bereits korrekt implementiert mit eigenem try/catch.

### Fix 2: archiveDecision im TaskDecisionDetails resilient machen

**Datei:** `TaskDecisionDetails.tsx` Zeile 186-232

Das Problem ist klar: Die Zeilen 209-213 markieren Notifications als gelesen:
```typescript
// INNERHALB des try/catch - blockiert den Erfolgsfluss!
await supabase
  .from('notifications')
  .update({ is_read: true })
  .eq('user_id', currentUserId)
  .eq('navigation_context', 'decisions');
```

**Loesung:** In separaten try/catch verschieben:
```typescript
try {
  const { error } = await supabase
    .from('task_decisions')
    .update({ status: 'archived', ... })
    .eq('id', decision.id);
  if (error) throw error;

  // Erfolg melden BEVOR optionale Operationen laufen
  toast({ title: "Erfolgreich", ... });
  onArchived?.();
  onClose();

  // Best-effort: Notifications als gelesen markieren
  try {
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', currentUserId)
      .eq('navigation_context', 'decisions');
  } catch (e) {
    console.warn('Notifications update failed:', e);
  }
} catch (error) {
  // Nur echte Archivierungsfehler zeigen
  toast({ title: "Fehler", ... });
}
```

### Fix 3: TaskDecisionCreator profilesLoaded zuruecksetzen

**Datei:** `TaskDecisionCreator.tsx`

Problem: Nach dem Submit wird das Formular zurueckgesetzt (Zeile 443-455), aber `profilesLoaded` bleibt `true`. Beim naechsten Oeffnen wird `loadProfiles` nicht aufgerufen.

**Loesung:** `setProfilesLoaded(false)` beim Schliessen hinzufuegen:

```typescript
// Im useEffect oder handleOpenChange:
useEffect(() => {
  if (isControlled && isOpen && !profilesLoaded) {
    loadProfiles();
  }
  if (isControlled && !isOpen) {
    setProfilesLoaded(false); // Reset beim Schliessen
  }
}, [isControlled, isOpen, profilesLoaded]);
```

Und im Form-Reset nach Submit ebenfalls:
```typescript
setSelectedUsers([]);
setProfilesLoaded(false); // NEU
```

### Fix 4: Inline-Antwort-Button in DecisionCardActivity

**Dateien:** `DecisionCardActivity.tsx`, `MyWorkDecisionCard.tsx`

Erweitere `DecisionCardActivity` um eine optionale Inline-Antwort-Funktion fuer offene Rueckfragen:

- Bei Rueckfragen ohne `creator_response`: Einen kleinen "Antworten"-Button anzeigen
- Beim Klick: Ein kompaktes Textfeld (SimpleRichTextEditor) einblenden, direkt unter der Rueckfrage
- "Senden"-Button fuehrt ein UPDATE auf `task_decision_responses` aus (setzt `creator_response`)
- Die Komponente erhaelt neue Props: `onReply(responseId, text)` und `isCreator`

```text
+------------------------------------------+
| Letzte Aktivitaet:                        |
| [orange] Erwin: "Was ist mit Budget?"     |
|          [Antworten]                       |
|   -> [Textfeld: Ihre Antwort...]          |
|      [Senden] [Abbrechen]                 |
| [gruen]  Carla: Ja - "Gute Idee!"        |
+------------------------------------------+
```

Die `onReply`-Funktion wird in `DecisionOverview.tsx` und `MyWorkDecisionCard.tsx` implementiert - sie ruft das bestehende `sendCreatorResponse`-Pattern auf (resiliente Version).

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Bearbeiten | `src/components/task-decisions/DecisionOverview.tsx` (sendCreatorResponse resilient, onReply prop) |
| Bearbeiten | `src/components/task-decisions/TaskDecisionDetails.tsx` (archiveDecision resilient) |
| Bearbeiten | `src/components/task-decisions/TaskDecisionCreator.tsx` (profilesLoaded reset) |
| Bearbeiten | `src/components/task-decisions/DecisionCardActivity.tsx` (Inline-Antwort UI) |
| Bearbeiten | `src/components/my-work/decisions/MyWorkDecisionCard.tsx` (onReply prop durchreichen) |

## Reihenfolge

1. `TaskDecisionDetails.tsx` - archiveDecision resilient machen (Fix 2)
2. `DecisionOverview.tsx` - sendCreatorResponse resilient machen (Fix 1)
3. `TaskDecisionCreator.tsx` - profilesLoaded Reset (Fix 3)
4. `DecisionCardActivity.tsx` + Eltern-Komponenten - Inline-Antwort (Fix 4)
