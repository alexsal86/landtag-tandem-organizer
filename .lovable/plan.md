
# Plan: Drei kritische Fehler bei Entscheidungen und Benachrichtigungen beheben

## Problem-Zusammenfassung

Nach detaillierter Analyse wurden drei separate Probleme identifiziert:

### Problem 1: Franziska kann Carlas öffentliche Umfrage-Ergebnisse nicht sehen

**Ursache:** Die Datenbank-Funktion `user_can_access_task_decision` berücksichtigt das Feld `visible_to_all` nicht. Diese Funktion wird in den RLS-Policies für `task_decisions`, `task_decision_participants` und `task_decision_responses` verwendet.

**Aktuelle Funktion:**
```sql
-- Prüft nur: Ersteller, Teilnehmer, Task-Eigentümer
-- FEHLT: visible_to_all + Tenant-Zugehörigkeit
```

### Problem 2: Antworten bei Entscheidungen können nicht geändert werden

**Ursache:** Die RLS-Policy für `task_decision_responses` erlaubt Updates nur für:
- Den Teilnehmer selbst (korrekt)
- Den Entscheidungs-Ersteller (nur für `creator_response`)

Beim Klick auf "Ändern" wird `handleResponse()` in `TaskDecisionResponse.tsx` aufgerufen, die ein UPDATE versucht. Die Policy sollte korrekt sein, aber es könnte ein Problem beim Abrufen der Entscheidungs-Optionen geben, da `loadDecisionOptions()` von der fehlerhaften `user_can_access_task_decision` abhängt.

### Problem 3: "Alle lesen" in Benachrichtigungen zeigt Fehler

**Ursache:** In `useNotifications.tsx` (Zeilen 149-206) wird `markAllAsRead` aufgerufen. Das System holt erst die ungelesenen Notifications und updated sie dann per ID-Liste. Der Fehler könnte auftreten wenn:
- Keine ungelesenen Notifications vorhanden sind (wird abgefangen)
- Oder ein Race-Condition mit dem optimistischen Update existiert

---

## Technische Änderungen

### Änderung 1: SQL-Migration - `user_can_access_task_decision` Funktion erweitern

Die Funktion muss `visible_to_all = true` Entscheidungen für alle Tenant-Mitglieder zugänglich machen:

```sql
CREATE OR REPLACE FUNCTION public.user_can_access_task_decision(_decision_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user created the decision
  IF EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = _decision_id AND created_by = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a participant
  IF EXISTS (
    SELECT 1 FROM public.task_decision_participants 
    WHERE decision_id = _decision_id AND user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns the task
  IF EXISTS (
    SELECT 1 FROM public.task_decisions td
    JOIN public.tasks t ON t.id = td.task_id
    WHERE td.id = _decision_id AND t.user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- NEU: Check if decision is visible_to_all and user is in same tenant
  IF EXISTS (
    SELECT 1 FROM public.task_decisions td
    JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
    WHERE td.id = _decision_id 
      AND td.visible_to_all = true
      AND utm.user_id = _user_id
      AND utm.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$;
```

### Änderung 2: TaskDecisionResponse.tsx - Fehlerbehandlung verbessern

**Datei:** `src/components/task-decisions/TaskDecisionResponse.tsx`
**Betroffene Zeilen:** 103-137 (handleResponse Funktion)

Das Problem: Wenn `loadDecisionOptions()` fehlschlägt (wegen RLS), werden keine Response-Optionen geladen und der Benutzer kann nicht antworten.

**Verbesserung:**

1. Bessere Fehlerbehandlung in `loadDecisionOptions`
2. Fallback auf Default-Optionen bei Fehler
3. Explizite Fehlermeldung beim Update

```typescript
const loadDecisionOptions = async () => {
  try {
    const { data, error } = await supabase
      .from('task_decisions')
      .select('response_options')
      .eq('id', decisionId)
      .single();

    if (error) {
      console.error('Error loading decision options:', error);
      // Fallback auf Standard-Optionen statt Fehler
      return;
    }
    if (data?.response_options && Array.isArray(data.response_options)) {
      setResponseOptions(data.response_options as unknown as ResponseOption[]);
    }
  } catch (error) {
    console.error('Error loading decision options:', error);
    // Behalte Standard-Optionen bei Fehler
  }
};

const handleResponse = async (responseType: string, comment?: string) => {
  setIsLoading(true);
  try {
    // Check if response already exists
    const { data: existingResponse, error: checkError } = await supabase
      .from('task_decision_responses')
      .select('id')
      .eq('participant_id', participantId)
      .eq('decision_id', decisionId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing response:', checkError);
      throw new Error('Antwort konnte nicht überprüft werden');
    }

    if (existingResponse) {
      // UPDATE existing response
      const { error } = await supabase
        .from('task_decision_responses')
        .update({
          response_type: responseType,
          comment: comment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingResponse.id);

      if (error) {
        console.error('Error updating response:', error);
        throw new Error('Antwort konnte nicht aktualisiert werden');
      }
    } else {
      // INSERT new response (existing code)
      // ...
    }
    // Rest bleibt gleich
  } catch (error: any) {
    console.error('Error submitting response:', error);
    toast({
      title: "Fehler",
      description: error?.message || "Antwort konnte nicht gespeichert werden.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};
```

### Änderung 3: useNotifications.tsx - markAllAsRead robuster machen

**Datei:** `src/hooks/useNotifications.tsx`
**Betroffene Zeilen:** 149-206 (markAllAsRead Funktion)

**Verbesserungen:**

1. Prüfung ob optimistisches Update bereits angewendet wurde
2. Bessere Fehlerbehandlung bei leerem Ergebnis
3. Vermeidung von Race-Conditions

```typescript
const markAllAsRead = useCallback(async () => {
  if (!user) return;

  // Prüfe ob es überhaupt ungelesene gibt
  const hasUnread = notifications.some(n => !n.is_read);
  if (!hasUnread) {
    // Keine ungelesenen Notifications - nichts zu tun
    return;
  }

  // Optimistic update
  const previousNotifications = [...notifications];
  const previousUnreadCount = unreadCount;
  
  setNotifications(prev => 
    prev.map(n => ({ ...n, is_read: true }))
  );
  setUnreadCount(0);

  try {
    // Get unread notification IDs
    const { data: unreadNotifications, error: fetchError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (fetchError) throw fetchError;

    // Nichts zu aktualisieren
    if (!unreadNotifications || unreadNotifications.length === 0) {
      return; // Optimistisches Update ist bereits korrekt
    }

    // Update by ID list
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .in('id', unreadNotifications.map(n => n.id));

    if (error) throw error;

    // Cross-tab sync
    localStorage.setItem(`notifications-update-${user.id}`, Date.now().toString());
    localStorage.removeItem(`notifications-update-${user.id}`);
    localStorage.setItem('notifications_marked_read', Date.now().toString());
    localStorage.removeItem('notifications_marked_read');
    
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    
    // Revert optimistic update
    setNotifications(previousNotifications);
    setUnreadCount(previousUnreadCount);
    
    toast({
      title: 'Fehler',
      description: 'Benachrichtigungen konnten nicht als gelesen markiert werden.',
      variant: 'destructive',
    });
  }
}, [user, toast, notifications, unreadCount]);
```

---

## Zusammenfassung der Änderungen

| Typ | Datei/Ressource | Problem | Lösung |
|-----|-----------------|---------|--------|
| SQL-Migration | `user_can_access_task_decision` | Öffentliche Entscheidungen nicht sichtbar für Viewer | `visible_to_all + tenant_membership` Prüfung hinzufügen |
| Frontend | `TaskDecisionResponse.tsx` | Antworten können nicht geändert werden | Bessere Fehlerbehandlung, explizite Fehlermeldungen |
| Frontend | `useNotifications.tsx` | "Alle lesen" zeigt Fehler | Race-condition vermeiden, frühere Prüfung auf ungelesene Notifications |

---

## Erwartete Ergebnisse

1. **Franziska kann Carlas Umfragen sehen:** Nach der SQL-Migration kann jeder Benutzer im selben Tenant öffentliche Entscheidungen (`visible_to_all = true`) sehen
2. **Antworten ändern funktioniert:** Die verbesserte Fehlerbehandlung zeigt spezifische Fehlermeldungen
3. **"Alle lesen" funktioniert:** Die Race-Condition wird vermieden und der Button funktioniert korrekt
