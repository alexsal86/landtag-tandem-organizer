

# Plan: Vier Probleme beheben

## Übersicht

| # | Problem | Ursache | Lösung | Aufwand |
|---|---------|---------|--------|---------|
| 1 | Enum-Fehler `cancel_requested` | Datenbank-Enum fehlen 2 Werte | DB-Migration hinzufügen | 10 Min |
| 2 | Entscheidungsergebnisse nicht sichtbar | Query filtert nur Teilnehmer | Query für visible_to_all erweitern | 20 Min |
| 3 | Standard-Mitarbeiter für Planungen | Keine Präferenz-Einstellung | Neue Tabelle + UI in Einstellungen | 45 Min |
| 4 | Checklist-Fehler bei Mitarbeitern | RLS-Policy korrekt, aber UI zeigt Fehler | Debugging + ggf. Policy anpassen | 15 Min |

---

## 1. Datenbank-Enum erweitern für `leave_status`

**Problem:** Die Datenbank hat den Enum-Typ `leave_status` nur mit den Werten `pending`, `approved`, `rejected`. Der Code verwendet jedoch auch `cancel_requested` und `cancelled`.

**Lösung - Neue Migration:**

```sql
-- Add missing values to leave_status enum
ALTER TYPE public.leave_status ADD VALUE IF NOT EXISTS 'cancel_requested';
ALTER TYPE public.leave_status ADD VALUE IF NOT EXISTS 'cancelled';
```

**Datei:** `supabase/migrations/[timestamp]_add_cancel_status_to_leave.sql`

---

## 2. Öffentliche Entscheidungen für alle sichtbar machen

**Problem:** In `MyWorkDecisionsTab.tsx` werden nur Entscheidungen geladen, bei denen der User:
- Teilnehmer ist (Zeile 61-80)
- Ersteller ist (Zeile 85-100)

Öffentliche Entscheidungen (`visible_to_all = true`) werden nicht berücksichtigt.

**Lösung - Query erweitern in `MyWorkDecisionsTab.tsx`:**

```typescript
// NEUE dritte Query für öffentliche Entscheidungen (nach creatorData Query)
const { data: publicDecisions, error: publicError } = await supabase
  .from("task_decisions")
  .select(`
    id,
    title,
    description,
    status,
    created_at,
    created_by,
    visible_to_all,
    task_decision_participants (
      id,
      user_id,
      task_decision_responses (id, response_type)
    )
  `)
  .eq("visible_to_all", true)
  .in("status", ["active", "open"])
  .neq("created_by", user.id); // Nicht doppelt laden

if (publicError) throw publicError;

// Format und merge public decisions
const publicFormatted: Decision[] = (publicDecisions || [])
  .filter(item => !participantDecisions.some(p => p.decision_id === item.id))
  .map(item => {
    const participants = item.task_decision_participants || [];
    const userParticipant = participants.find(p => p.user_id === user.id);
    const responses = participants.flatMap(p => p.task_decision_responses || []);
    const pendingCount = participants.filter(p => !p.task_decision_responses?.length).length;
    
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      created_at: item.created_at,
      created_by: item.created_by,
      participant_id: userParticipant?.id || null,
      hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
      isCreator: false,
      pendingCount,
      responseType: null,
      isPublic: true, // Neues Flag für UI-Anzeige
    };
  });
```

**Änderungen in `MyWorkDecisionsTab.tsx`:**
1. Zeile ~100: Dritte Query für `visible_to_all = true` hinzufügen
2. Zeile ~160: Öffentliche Entscheidungen in die Merge-Logik einbeziehen
3. UI: Badge "Öffentlich" für diese Entscheidungen anzeigen

---

## 3. Standard-Mitarbeiter für neue Planungen

**Problem:** Benutzer müssen bei jeder neuen Planung manuell Mitarbeiter hinzufügen. Es gibt keine Möglichkeit, Standard-Mitarbeiter zu definieren.

**Lösung - Neue Tabelle + UI:**

### 3a. Datenbank-Migration

```sql
-- Create user planning preferences table
CREATE TABLE public.user_planning_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_collaborators JSONB DEFAULT '[]'::jsonb,
  -- Format: [{"user_id": "uuid", "can_edit": true}]
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE public.user_planning_preferences ENABLE ROW LEVEL SECURITY;

-- User can manage own preferences
CREATE POLICY "Users manage own planning preferences"
ON public.user_planning_preferences
FOR ALL USING (user_id = auth.uid());
```

### 3b. Einstellungs-UI in Profil oder separatem Tab

**Neuer Bereich in EditProfile.tsx oder eigener Dialog:**

```typescript
// Neue Komponente oder Abschnitt:
<Card>
  <CardHeader>
    <CardTitle>Planungs-Voreinstellungen</CardTitle>
    <CardDescription>
      Wählen Sie Mitarbeiter, die bei neuen Planungen automatisch hinzugefügt werden.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {defaultCollaborators.map((collab) => (
        <div key={collab.user_id} className="flex items-center gap-3">
          <Avatar />
          <span>{collab.display_name}</span>
          <Switch checked={collab.can_edit} onChange={...} />
          <Button variant="ghost" onClick={() => removeCollaborator(collab.user_id)}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button onClick={() => setAddCollaboratorOpen(true)}>
        <Plus /> Mitarbeiter hinzufügen
      </Button>
    </div>
  </CardContent>
</Card>
```

### 3c. Automatisches Hinzufügen bei Planung-Erstellung

**Änderung in `EventPlanningView.tsx` - `createPlanning` Funktion (Zeile 829-878):**

```typescript
// Nach erfolgreicher Erstellung:
if (data) {
  // Load user's default collaborators
  const { data: prefs } = await supabase
    .from("user_planning_preferences")
    .select("default_collaborators")
    .eq("user_id", user.id)
    .single();
  
  if (prefs?.default_collaborators?.length > 0) {
    const collabsToInsert = prefs.default_collaborators.map((c: any) => ({
      event_planning_id: data.id,
      user_id: c.user_id,
      can_edit: c.can_edit,
    }));
    
    await supabase
      .from("event_planning_collaborators")
      .insert(collabsToInsert);
  }
}
```

---

## 4. Checklist-Bearbeitung für Mitarbeiter mit Berechtigung

**Problem:** Mitarbeiter mit `can_edit = true` können Checkboxen nicht aktualisieren, obwohl die RLS-Policy dies erlauben sollte.

**Analyse der RLS-Policy (Zeile 171-185):**
```sql
CREATE POLICY "Users can manage checklist items of editable plannings" 
ON public.event_planning_checklist_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
)
```

Die Policy sieht korrekt aus. Das Problem könnte sein:
1. Der Mitarbeiter hat `can_edit = false`
2. Die Policy fehlt für `WITH CHECK` bei INSERT/UPDATE

**Lösung - Policy erweitern:**

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage checklist items of editable plannings" 
ON public.event_planning_checklist_items;

-- Recreate with explicit WITH CHECK
CREATE POLICY "Users can manage checklist items of editable plannings" 
ON public.event_planning_checklist_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.event_plannings ep 
    WHERE ep.id = event_planning_id 
    AND (
      ep.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.event_planning_collaborators epc 
        WHERE epc.event_planning_id = ep.id 
        AND epc.user_id = auth.uid() 
        AND epc.can_edit = true
      )
    )
  )
);
```

**Zusätzlich: Bessere Fehlermeldung in UI:**

```typescript
// EventPlanningView.tsx - toggleChecklistItem
const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
  // Check if user has edit permission
  const canEdit = selectedPlanning?.user_id === user?.id || 
    collaborators.some(c => c.user_id === user?.id && c.can_edit);
  
  if (!canEdit) {
    toast({
      title: "Keine Berechtigung",
      description: "Sie haben keine Bearbeitungsrechte für diese Checkliste.",
      variant: "destructive",
    });
    return;
  }
  
  const { error } = await supabase
    .from("event_planning_checklist_items")
    .update({ is_completed: !isCompleted })
    .eq("id", itemId);
  // ...
};
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/[neue]_add_cancel_status.sql` | Enum erweitern |
| `supabase/migrations/[neue]_user_planning_preferences.sql` | Neue Tabelle |
| `supabase/migrations/[neue]_fix_checklist_rls.sql` | Policy mit WITH CHECK |
| `src/components/my-work/MyWorkDecisionsTab.tsx` | Query für öffentliche Entscheidungen |
| `src/components/EventPlanningView.tsx` | Standard-Collaborators + Berechtigungsprüfung |
| `src/pages/EditProfile.tsx` oder neuer Dialog | UI für Standard-Mitarbeiter |

**Geschätzter Gesamtaufwand:** ~1,5 Stunden

