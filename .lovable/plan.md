
# Plan: Einstellung für Tab-Badge-Anzeige in "Meine Arbeit" + Realtime-System für neue Elemente

## Übersicht

Der Benutzer wünscht sich:
1. Einstellung pro User: Tab-Badges zeigen entweder **neue Elemente** (Standard) oder **Gesamtzahl**
2. Realtime-Updates für alle Tabs
3. Klare Definition, was "neu" bedeutet für jeden Elementtyp

## Bestandsaufnahme

### Bereits vorhanden:
- `useNewItemIndicators` Hook: Trackt `user_navigation_visits` für "neu seit letztem Besuch"
- `useNavigationNotifications` Hook: Verwaltet Benachrichtigungszähler
- `MyWorkView`: Hat Realtime-Subscriptions für tasks, task_decisions, quick_notes
- `user_navigation_visits` Tabelle: Speichert letzten Besuch pro Kontext

### Noch nicht vorhanden:
- Benutzereinstellung für Badge-Anzeigeart
- "Neu"-Zählung für jeden Tab-Typ
- Einstellungs-UI für "Meine Arbeit"

---

## System-Design: Was ist "neu"?

| Tab | Element ist "neu" wenn... |
|-----|---------------------------|
| **Aufgaben** | `created_at > last_visit` ODER `assigned_to` enthält User und wurde nach `last_visit` zugewiesen |
| **Entscheidungen** | Neue Anfrage seit `last_visit` ODER neue Antwort auf eigene Anfrage seit `last_visit` |
| **Jour Fixe** | Meeting erstellt seit `last_visit` ODER Teilnehmer hinzugefügt seit `last_visit` |
| **FallAkten** | `created_at > last_visit` |
| **Planungen** | `created_at > last_visit` ODER User als Collaborator hinzugefügt seit `last_visit` |

---

## Implementierungsplan

### 1. Datenbank-Änderung

Neue Tabelle für Benutzereinstellungen zu "Meine Arbeit":

```sql
CREATE TABLE user_mywork_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_display_mode TEXT NOT NULL DEFAULT 'new' CHECK (badge_display_mode IN ('new', 'total')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE user_mywork_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_mywork_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON user_mywork_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON user_mywork_settings FOR UPDATE
  USING (user_id = auth.uid());
```

### 2. Neuer Hook: `useMyWorkSettings`

```typescript
// src/hooks/useMyWorkSettings.tsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type BadgeDisplayMode = 'new' | 'total';

export function useMyWorkSettings() {
  const { user } = useAuth();
  const [badgeDisplayMode, setBadgeDisplayMode] = useState<BadgeDisplayMode>('new');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_mywork_settings')
      .select('badge_display_mode')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (data) {
      setBadgeDisplayMode(data.badge_display_mode as BadgeDisplayMode);
    }
    setIsLoading(false);
  };

  const updateBadgeDisplayMode = async (mode: BadgeDisplayMode) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('user_mywork_settings')
      .upsert({
        user_id: user.id,
        badge_display_mode: mode,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    
    if (!error) {
      setBadgeDisplayMode(mode);
    }
    return !error;
  };

  return {
    badgeDisplayMode,
    updateBadgeDisplayMode,
    isLoading
  };
}
```

### 3. Neuer Hook: `useMyWorkNewCounts`

```typescript
// src/hooks/useMyWorkNewCounts.tsx
// Berechnet die Anzahl "neuer" Elemente für jeden Tab

export interface NewCounts {
  tasks: number;
  decisions: number;
  jourFixe: number;
  caseFiles: number;
  plannings: number;
}

export function useMyWorkNewCounts() {
  const { user } = useAuth();
  const [newCounts, setNewCounts] = useState<NewCounts>({...});
  const [lastVisits, setLastVisits] = useState<Record<string, Date>>({});

  // Lade last_visited_at für jeden Kontext
  useEffect(() => {
    loadLastVisits();
    loadNewCounts();
  }, [user]);

  const loadLastVisits = async () => {
    // Hole user_navigation_visits für:
    // - mywork_tasks
    // - mywork_decisions
    // - mywork_jourFixe
    // - mywork_casefiles
    // - mywork_plannings
  };

  const loadNewCounts = async () => {
    // Für jeden Tab: Zähle Elemente mit created_at > last_visit
    // Tasks: created_at > last_visit ODER assigned_to geändert
    // Decisions: created_at > last_visit ODER neue Responses
    // etc.
  };

  return { newCounts, markTabAsVisited };
}
```

### 4. Anpassung `MyWorkView.tsx`

```typescript
// Neue Imports
import { useMyWorkSettings } from '@/hooks/useMyWorkSettings';
import { useMyWorkNewCounts } from '@/hooks/useMyWorkNewCounts';

export function MyWorkView() {
  const { badgeDisplayMode } = useMyWorkSettings();
  const { newCounts, markTabAsVisited } = useMyWorkNewCounts();
  const [totalCounts, setTotalCounts] = useState<TabCounts>({...});
  
  // Bei Tab-Wechsel: Tab als besucht markieren
  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab);
    markTabAsVisited(`mywork_${tab}`);
  };

  // Badge zeigt je nach Einstellung:
  const getDisplayCount = (countKey: keyof TabCounts) => {
    if (badgeDisplayMode === 'new') {
      return newCounts[countKey] || 0;
    }
    return totalCounts[countKey] || 0;
  };

  // In Tab-Rendering:
  {getDisplayCount(tab.countKey) > 0 && (
    <Badge 
      variant={badgeDisplayMode === 'new' ? 'destructive' : 'secondary'}
      className="..."
    >
      {getDisplayCount(tab.countKey)}
    </Badge>
  )}
}
```

### 5. Einstellungs-UI in `SettingsView.tsx`

Neuer Bereich "Meine Arbeit":

```typescript
{/* My Work Settings */}
<Card className="bg-card shadow-card border-border">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <ClipboardList className="h-5 w-5" />
      Meine Arbeit
    </CardTitle>
    <CardDescription>
      Einstellungen für die Anzeige in "Meine Arbeit"
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Tab-Badge Anzeige</Label>
      <Select 
        value={badgeDisplayMode} 
        onValueChange={updateBadgeDisplayMode}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="new">
            Nur neue Elemente anzeigen (Standard)
          </SelectItem>
          <SelectItem value="total">
            Gesamtzahl der Elemente anzeigen
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Wählen Sie, ob die Badges die Anzahl neuer oder aller Elemente anzeigen sollen.
      </p>
    </div>
  </CardContent>
</Card>
```

### 6. Erweiterte Realtime-Subscriptions

```typescript
// In MyWorkView.tsx - erweiterte Channels
const channel = supabase
  .channel('my-work-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'task_decisions' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'task_decision_participants' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'task_decision_responses' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'quick_notes' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'case_files' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'event_plannings' }, handleUpdate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'event_planning_collaborators' }, handleUpdate)
  .subscribe();
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| **Migration** | Neue Tabelle `user_mywork_settings` |
| `src/hooks/useMyWorkSettings.tsx` | Neuer Hook für Einstellungen |
| `src/hooks/useMyWorkNewCounts.tsx` | Neuer Hook für "Neu"-Zählung |
| `src/components/MyWorkView.tsx` | Integration der Hooks + Realtime-Erweiterung |
| `src/components/SettingsView.tsx` | Neuer Einstellungsbereich |

---

## Visuelle Darstellung

```text
Einstellung: "Nur neue Elemente" (Standard)
┌─────────────────────────────────────────────────────────────┐
│ Quick Notes | Aufgaben [2] | Entscheidungen [1] | Jour Fixe │
│                    ↑              ↑                         │
│              2 neue Tasks   1 neue Anfrage                  │
│              (rot Badge)    (rot Badge)                     │
└─────────────────────────────────────────────────────────────┘

Einstellung: "Gesamtzahl anzeigen"
┌─────────────────────────────────────────────────────────────┐
│ Quick Notes | Aufgaben [15] | Entscheidungen [8] | Jour Fixe│
│                    ↑              ↑                         │
│              15 offene      8 aktive                        │
│              (grau Badge)   (grau Badge)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technische Details

### Navigation-Kontext für "Meine Arbeit" Tabs
Jeder Tab bekommt einen eigenen Kontext für `user_navigation_visits`:
- `mywork_tasks`
- `mywork_decisions`
- `mywork_jourFixe`
- `mywork_casefiles`
- `mywork_plannings`
- `mywork_time`
- `mywork_team`

### "Neu"-Logik im Detail

**Aufgaben:**
```sql
SELECT COUNT(*) FROM tasks
WHERE (user_id = :user_id OR :user_id = ANY(assigned_to))
  AND status != 'completed'
  AND created_at > :last_visit_tasks
```

**Entscheidungen:**
```sql
-- Neue Anfragen an mich
SELECT COUNT(*) FROM task_decision_participants p
JOIN task_decisions d ON d.id = p.decision_id
WHERE p.user_id = :user_id
  AND d.status IN ('active', 'open')
  AND d.created_at > :last_visit_decisions

-- ODER neue Antworten auf meine Anfragen
UNION
SELECT COUNT(*) FROM task_decision_responses r
JOIN task_decision_participants p ON p.id = r.participant_id
JOIN task_decisions d ON d.id = p.decision_id
WHERE d.created_by = :user_id
  AND r.created_at > :last_visit_decisions
```

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Migration + RLS | 10 Min |
| useMyWorkSettings Hook | 15 Min |
| useMyWorkNewCounts Hook | 45 Min |
| MyWorkView Anpassung | 30 Min |
| SettingsView Einstellungsbereich | 20 Min |
| Realtime-Erweiterung | 15 Min |
| **Gesamt** | **~135 Min** |
