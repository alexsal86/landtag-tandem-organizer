
# Plan: 5 Entscheidungssystem-Fehler endgueltig beheben

## Zusammenfassung der Root Causes

Durch die Analyse der Datenbank-Logs, RLS-Policies, Trigger-Funktionen und des Frontend-Codes wurden die **tatsaechlichen** Ursachen identifiziert, die beim letzten Fix-Versuch nicht erkannt wurden:

### Warum die vorherigen Fixes nicht gewirkt haben

Die RLS-Policy-Bereinigung und der CHECK-Constraint-Fix waren korrekt und wurden erfolgreich angewendet (DB-Abfrage bestaetigt). Die Fehler kommen aber aus **zwei anderen Stellen**:

1. **Trigger-Bug (KRITISCH):** Die Trigger-Funktion `check_archive_after_creator_response` ruft `PERFORM auto_archive_completed_decisions()` auf - aber `auto_archive_completed_decisions` ist als `RETURNS trigger` definiert. PostgreSQL verbietet den Aufruf von Trigger-Funktionen ausserhalb von Triggern. Dieser Fehler wird bei jedem UPDATE auf `task_decision_responses` ausgeloest, wenn `creator_response` gesetzt wird.

2. **TaskDecisionDetails.tsx (KRITISCH):** Die Archivierung in `TaskDecisionDetails.tsx` (Detail-Dialog) verwendet `.select()` nach dem UPDATE. Nach dem Statuswechsel auf `archived` gibt die SELECT-RLS-Policy keine Zeile zurueck (da die Policy nach `status IN (active, open)` filtert in der Participant-Query). Der Code interpretiert leere Ergebnisse als Fehler (Zeile 201-219: `if (!data || data.length === 0) throw new Error(...)`).

| Nr | Problem | Tatsaechliche Ursache | Loesung |
|----|---------|----------------------|---------|
| 1 | Archivieren zeigt Fehler | `TaskDecisionDetails.tsx` Zeile 195: `.select()` nach UPDATE liefert leere Daten wegen RLS, was als Fehler geworfen wird | `.select()` entfernen, nur `error` pruefen |
| 2 | Wiederherstellen zeigt Fehler | Gleiche Logik falls aus Detail-Dialog; oder `loadDecisionRequests` wirft bei Reload | `.select()` entfernen |
| 3 | Bearbeiten zeigt Fehler | `DecisionEditDialog.tsx` hat keinen offensichtlichen Bug - moeglicherweise wird der Fehler vom Reload-Callback ausgeloest | Fehlerbehandlung verbessern |
| 4 | Antwort auf Begruendungen scheitert | `check_archive_after_creator_response` Trigger ruft `auto_archive_completed_decisions()` auf, was `RETURNS trigger` ist und nicht als regulaere Funktion aufrufbar | Trigger-Funktion reparieren: `auto_archive_completed_decisions` als `RETURNS void` Version erstellen |
| 5 | Standard-Teilnehmer nicht uebernommen | Der Code ist vorhanden, aber die Filterung `userIds.includes(id)` kann fehlschlagen, wenn die Default-IDs nicht mit den Tenant-Memberships uebereinstimmen; oder `loadProfiles` wird mehrfach aufgerufen und resettet die Auswahl | Debugging hinzufuegen und Logik robuster machen |

---

## Technische Details

### Fix 1+2: TaskDecisionDetails.tsx - `.select()` entfernen

**Datei:** `src/components/task-decisions/TaskDecisionDetails.tsx`

**Problem (Zeilen 187-219):**
```typescript
const { data, error } = await supabase
  .from('task_decisions')
  .update({ status: 'archived', ... })
  .eq('id', decision.id)
  .select();  // <-- PROBLEM: RLS filtert archived-Zeilen aus

if (!data || data.length === 0) {
  throw new Error("Keine Berechtigung..."); // <-- FALSE POSITIVE
}
```

**Loesung:** `.select()` entfernen und nur den `error` pruefen:
```typescript
const { error } = await supabase
  .from('task_decisions')
  .update({ status: 'archived', ... })
  .eq('id', decision.id);

if (error) throw error;
// Direkt Erfolg melden, keine data-Pruefung noetig
```

Die gesamte Fallback-Pruefung (Zeilen 201-220) entfernen.

### Fix 3: DecisionEditDialog.tsx - robustere Fehlerbehandlung

**Datei:** `src/components/task-decisions/DecisionEditDialog.tsx`

Der Code sieht korrekt aus (Zeilen 112-119 verwenden kein `.select()`). Der Fehler kann von der `loadDecisionRequests`-Funktion kommen, die nach `onUpdated()` aufgerufen wird. 

Falls die Ursache die gleiche `.select()`-Problematik in einem anderen Aufrufpfad ist, pruefen wir alle Stellen wo `.update()` mit `.select()` kombiniert wird.

### Fix 4 (KRITISCH): Trigger-Funktion reparieren

**Problem:** 
```sql
-- check_archive_after_creator_response ruft:
PERFORM auto_archive_completed_decisions();
-- Aber auto_archive_completed_decisions ist RETURNS trigger!
-- -> ERROR: trigger functions can only be called as triggers
```

**Loesung via DB-Migration:**

Eine neue Funktion `check_and_archive_decision` erstellen, die als `RETURNS void` definiert ist und die gleiche Logik wie `auto_archive_completed_decisions` enthaelt, aber einen `decision_id`-Parameter akzeptiert statt `NEW.decision_id` zu verwenden:

```sql
-- 1. Neue Helper-Funktion (RETURNS void, nicht trigger)
CREATE OR REPLACE FUNCTION public.check_and_archive_decision(p_decision_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_participants INTEGER;
  total_responses INTEGER;
  open_questions INTEGER;
  decision_status TEXT;
  decision_title TEXT;
  decision_creator UUID;
BEGIN
  SELECT status, title, created_by INTO decision_status, decision_title, decision_creator
  FROM task_decisions WHERE id = p_decision_id;
  
  IF decision_status NOT IN ('active', 'open') THEN RETURN; END IF;

  SELECT COUNT(*) INTO total_participants
  FROM task_decision_participants WHERE decision_id = p_decision_id;
  
  SELECT COUNT(DISTINCT participant_id) INTO total_responses
  FROM (
    SELECT DISTINCT ON (participant_id) participant_id, response_type
    FROM task_decision_responses WHERE decision_id = p_decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses;
  
  SELECT COUNT(*) INTO open_questions
  FROM (
    SELECT DISTINCT ON (participant_id) *
    FROM task_decision_responses WHERE decision_id = p_decision_id
    ORDER BY participant_id, created_at DESC
  ) latest_responses
  WHERE response_type = 'question' AND creator_response IS NULL;
  
  IF total_participants = total_responses AND open_questions = 0 THEN
    UPDATE task_decisions SET status = 'archived', archived_at = NOW(), archived_by = decision_creator
    WHERE id = p_decision_id;
    
    PERFORM create_notification(decision_creator, 'task_decision_completed',
      'Entscheidung automatisch archiviert',
      'Die Entscheidung "' || decision_title || '" wurde automatisch archiviert.',
      jsonb_build_object('decision_id', p_decision_id), 'low');
  END IF;
END;
$$;

-- 2. check_archive_after_creator_response reparieren
CREATE OR REPLACE FUNCTION public.check_archive_after_creator_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.creator_response IS NOT NULL AND (OLD.creator_response IS NULL OR OLD.creator_response = '') THEN
    PERFORM check_and_archive_decision(NEW.decision_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. auto_archive_completed_decisions ebenfalls reparieren
-- (wird als INSERT-Trigger auf task_decision_responses aufgerufen)
CREATE OR REPLACE FUNCTION public.auto_archive_completed_decisions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM check_and_archive_decision(NEW.decision_id);
  RETURN NEW;
END;
$$;
```

### Fix 5: NoteDecisionCreator - Default-Teilnehmer robuster laden

**Datei:** `src/components/shared/NoteDecisionCreator.tsx`

Das Problem: Der Code liest `default_decision_participants` korrekt (Zeile 113), aber die Filterung bei Zeile 121 (`userIds.includes(id) && id !== user?.id`) koennte scheitern, wenn die gespeicherten IDs nicht zum aktuellen Tenant passen, oder wenn der einzige gespeicherte Default der aktuelle User selbst ist.

**Loesung:** Wenn `validDefaults` leer ist OBWOHL `defaultIds` nicht leer war, zum Fallback wechseln. Ausserdem Logging hinzufuegen fuer Debugging:

```typescript
if (defaultIds.length > 0) {
  const validDefaults = defaultIds.filter(id => 
    userIds.includes(id) && id !== user?.id
  );
  if (validDefaults.length > 0) {
    setSelectedUsers(validDefaults);
    return; // WICHTIG: Early return, damit Fallback nicht greift
  }
  // Falls alle Defaults ungueltig -> zum Fallback weiter
}
// Fallback: Abgeordnete
```

Zusaetzlich: pruefen, ob `loadProfiles` moeglicherweise mehrfach aufgerufen wird und `setSelectedUsers` dadurch resettet wird. Die `useEffect`-Dependency `[open, currentTenant?.id]` koennte dazu fuehren, dass die Funktion bei jedem Oeffnen nochmal laeuft und die vorherige Auswahl ueberschreibt.

---

## Zusaetzliche Pruefungen

Alle Stellen durchsuchen, an denen `.update().select()` auf `task_decisions` aufgerufen wird, um sicherzustellen, dass nirgends eine leere Ergebnismenge als Fehler interpretiert wird.

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | Trigger-Funktionen reparieren (`check_archive_after_creator_response`, `auto_archive_completed_decisions`, neue `check_and_archive_decision`) |
| Bearbeiten | `src/components/task-decisions/TaskDecisionDetails.tsx` (`.select()` entfernen, false-positive Fehlerbehandlung entfernen) |
| Bearbeiten | `src/components/task-decisions/DecisionOverview.tsx` (falls `.select()` nach Updates verwendet wird) |
| Bearbeiten | `src/components/shared/NoteDecisionCreator.tsx` (Default-Teilnehmer Logik robuster machen) |

## Reihenfolge

1. **DB-Migration** - Trigger-Funktionen reparieren (behebt Punkt 4 komplett, moeglicherweise auch Teile von 1-3)
2. **TaskDecisionDetails.tsx** - `.select()` nach archive/restore Updates entfernen (behebt Punkte 1+2)
3. **DecisionOverview.tsx** - `.select()` Muster pruefen und bereinigen (behebt Punkt 3)
4. **NoteDecisionCreator.tsx** - Default-Teilnehmer robuster laden (behebt Punkt 5)
5. Alle Aenderungen per Browser-Test verifizieren
