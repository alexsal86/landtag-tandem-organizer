

# Plan: Erweiterungen fuer Planungen, Meetings und Animations-System

## Uebersicht der Anforderungen

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Erledigt-Button fehlt in Listenansicht + Detailansicht Planungen | Buttons in EventPlanningTable (Listenansicht) + Detailansicht ergaenzen |
| 2 | Erledigt/Archiv-Buttons in MyWorkPlanningsTab | Buttons in der Planungsliste unter "Meine Arbeit" hinzufuegen |
| 3 | Dynamischer Punkt "Aufgaben" in Meeting-Templates Admin | Neuen Button "Aufgaben" in Administration.tsx hinzufuegen |
| 4 | Aufgaben-Zuordnung via Jour-Fixe-Icon funktioniert nicht | Fehler in handleSelectMeeting/handleMarkForNextJourFixe beheben |
| 5 | Celebration Animations System (Option C) | Komplett eigenstaendiges System mit Admin-UI und mehreren Animationen |

---

## 1. Erledigt-Button in Listenansicht + Detailansicht

### 1.1 EventPlanningTable (Zeile 728-838)

**Problem:** In der Table-Ansicht gibt es nur einen Archiv-Button, aber keinen Erledigt-Button.

**Aenderung:** CheckCircle-Button neben Archive-Button hinzufuegen:

```typescript
// In EventPlanningTable, nach Zeile 815
<TableCell onClick={(e) => e.stopPropagation()}>
  <div className="flex items-center gap-1">
    {/* Erledigt-Button */}
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-7 w-7",
              (planning as any).is_completed && "text-green-600"
            )}
            onClick={() => togglePlanningCompleted(planning.id, !(planning as any).is_completed)}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {(planning as any).is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    
    {/* Archiv-Button (bestehend) */}
    {planning.user_id === user?.id && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button ... />
          </TooltipTrigger>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
</TableCell>
```

**Titel-Durchstreichung in Listenansicht:**
```typescript
<TableCell className={cn(
  "font-medium relative",
  (planning as any).is_completed && "line-through text-muted-foreground"
)}>
```

### 1.2 Detail-Ansicht (Zeile 3520-3528)

**Problem:** In der geoeffneten Planung fehlt der Erledigt-Button.

**Aenderung:** Erledigt-Button neben dem Archiv-Button einfuegen:

```typescript
{/* Erledigt-Button - vor Archivieren-Button */}
<Button 
  variant={selectedPlanning && (selectedPlanning as any).is_completed ? "default" : "outline"}
  className={cn(
    (selectedPlanning as any).is_completed && "bg-green-600 hover:bg-green-700"
  )}
  onClick={() => togglePlanningCompleted(selectedPlanning.id, !(selectedPlanning as any).is_completed)}
>
  <CheckCircle className="mr-2 h-4 w-4" />
  {(selectedPlanning as any).is_completed ? "Erledigt" : "Als erledigt markieren"}
</Button>

{/* Archivieren-Button (bestehend) */}
{selectedPlanning.user_id === user?.id && (
  <Button variant="outline" onClick={() => archivePlanning(selectedPlanning.id)}>
    <Archive className="mr-2 h-4 w-4" />
    Archivieren
  </Button>
)}
```

---

## 2. Erledigt/Archiv-Buttons in MyWorkPlanningsTab

**Datei:** `src/components/my-work/MyWorkPlanningsTab.tsx`

**Aenderungen:**

### 2.1 Plannings-Interface erweitern
```typescript
interface Planning {
  // ... bestehende Felder
  is_completed?: boolean;
  is_archived?: boolean;
}
```

### 2.2 Daten laden mit is_completed
```typescript
.select(`
  id, title, description, location, confirmed_date, created_at, user_id,
  is_completed,
  event_planning_checklist_items (id, is_completed)
`)
```

### 2.3 Handler-Funktionen hinzufuegen
```typescript
const toggleCompleted = async (planningId: string, isCompleted: boolean) => {
  const { error } = await supabase
    .from('event_plannings')
    .update({ 
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null
    })
    .eq('id', planningId);
  
  if (!error) loadPlannings();
};

const archivePlanning = async (planningId: string) => {
  const { error } = await supabase
    .from('event_plannings')
    .update({ 
      is_archived: true,
      archived_at: new Date().toISOString()
    })
    .eq('id', planningId);
  
  if (!error) loadPlannings();
};
```

### 2.4 Buttons in der Karte
```typescript
<div className="flex items-center gap-1">
  {/* Erledigt-Button */}
  <Button
    variant="ghost"
    size="icon"
    className={cn("h-7 w-7", planning.is_completed && "text-green-600")}
    onClick={(e) => {
      e.stopPropagation();
      toggleCompleted(planning.id, !planning.is_completed);
    }}
  >
    <CheckCircle className="h-4 w-4" />
  </Button>
  
  {/* Archiv-Button */}
  {planning.user_id === user?.id && (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={(e) => {
        e.stopPropagation();
        archivePlanning(planning.id);
      }}
    >
      <Archive className="h-4 w-4" />
    </Button>
  )}
  
  {/* Externer Link (bestehend) */}
  <Button variant="ghost" size="icon" ... />
</div>
```

### 2.5 Titel-Durchstreichung
```typescript
<span className={cn(
  "font-medium text-sm",
  planning.is_completed && "line-through text-muted-foreground"
)}>
  {planning.title}
</span>
```

---

## 3. Dynamischer Punkt "Aufgaben" in Meeting-Templates Admin

**Datei:** `src/pages/Administration.tsx`

### 3.1 Import erweitern
```typescript
import { ListTodo } from "lucide-react";
```

### 3.2 addSystemTemplateItem erweitern (falls nicht schon vorhanden)
```typescript
const addSystemTemplateItem = (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks', parentIdx?: number) => {
  const titles: Record<string, string> = {
    upcoming_appointments: 'Kommende Termine',
    quick_notes: 'Meine Notizen',
    tasks: 'Aufgaben'
  };
  
  const newItem = {
    type: 'system',
    system_type: systemType,
    title: titles[systemType],
  };
  
  if (parentIdx !== undefined) {
    // Als Kind hinzufuegen
    const updated = [...templateItems];
    updated[parentIdx].children = [...(updated[parentIdx].children || []), newItem];
    setTemplateItems(updated);
  } else {
    // Als Hauptpunkt
    setTemplateItems([...templateItems, newItem]);
  }
  
  saveTemplateItems([...templateItems, newItem]);
};
```

### 3.3 Button fuer "Aufgaben" hinzufuegen (Zeile 1581-1598)

```typescript
{/* Bestehende Buttons */}
<Button ... onClick={() => addSystemTemplateItem('upcoming_appointments')}>
  <CalendarDays className="h-4 w-4 mr-2" />
  Termine
</Button>
<Button ... onClick={() => addSystemTemplateItem('quick_notes')}>
  <StickyNote className="h-4 w-4 mr-2" />
  Notizen
</Button>

{/* NEU: Aufgaben-Button */}
<Button 
  variant="outline" 
  size="sm"
  className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
  onClick={() => addSystemTemplateItem('tasks')}
>
  <ListTodo className="h-4 w-4 mr-2" />
  Aufgaben
</Button>
```

### 3.4 Auch im Child-Popover (Zeile 1374-1402)
```typescript
<div className="flex flex-wrap gap-1">
  <Button ... onClick={() => addSystemTemplateItem('upcoming_appointments', index)}>
    Termine
  </Button>
  <Button ... onClick={() => addSystemTemplateItem('quick_notes', index)}>
    Notizen
  </Button>
  {/* NEU */}
  <Button 
    variant="outline" 
    size="sm"
    className="flex-1 justify-start border-green-200 text-green-700 h-7 text-xs"
    onClick={() => {
      addSystemTemplateItem('tasks', index);
      setChildPopoverOpen(null);
    }}
  >
    <ListTodo className="h-3 w-3 mr-1" />
    Aufgaben
  </Button>
</div>
```

### 3.5 Rendering fuer "tasks" in Template-Items (Zeile 1215-1225)

```typescript
{item.system_type === 'tasks' && (
  <ListTodo className="h-4 w-4 text-green-600" />
)}
```

**Farblogik erweitern:**
```typescript
className={`flex items-center gap-2 p-2 bg-card rounded border ${
  item.type === 'system' 
    ? item.system_type === 'upcoming_appointments' 
      ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
      : item.system_type === 'quick_notes'
      ? 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
      : item.system_type === 'tasks'
      ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20'
      : ''
    : ''
}`}
```

---

## 4. Aufgaben-Zuordnung zu Meeting reparieren

**Datei:** `src/components/my-work/MyWorkTasksTab.tsx`

**Problem:** Der Fehler tritt auf, wenn `pending_for_jour_fixe` oder `meeting_id` nicht in der Datenbank existieren oder ein Fehler beim Update auftritt.

### 4.1 Verbesserte Fehlerbehandlung

```typescript
const handleSelectMeeting = async (meetingId: string, meetingTitle: string) => {
  if (!meetingTaskId || !user) return;
  
  try {
    console.log('Adding task to meeting:', { taskId: meetingTaskId, meetingId });
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ meeting_id: meetingId, pending_for_jour_fixe: false })
      .eq('id', meetingTaskId)
      .select();

    if (error) {
      console.error('Error adding task to meeting:', error);
      toast({ 
        title: "Fehler", 
        description: error.message || "Aufgabe konnte nicht zugeordnet werden.",
        variant: "destructive" 
      });
      return;
    }
    
    if (!data || data.length === 0) {
      toast({ 
        title: "Warnung", 
        description: "Keine Aufgabe aktualisiert. Moeglicherweis fehlende Berechtigung.",
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: `Aufgabe zu "${meetingTitle}" hinzugefuegt` });
    loadTasks();
  } catch (error: any) {
    console.error('Error adding task to meeting:', error);
    toast({ title: "Fehler", description: error.message, variant: "destructive" });
  } finally {
    setMeetingTaskId(null);
  }
};

const handleMarkForNextJourFixe = async () => {
  if (!meetingTaskId || !user) return;
  
  try {
    console.log('Marking task for next jour fixe:', meetingTaskId);
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ pending_for_jour_fixe: true, meeting_id: null })
      .eq('id', meetingTaskId)
      .select();

    if (error) {
      console.error('Error marking task:', error);
      toast({ 
        title: "Fehler", 
        description: error.message || "Aufgabe konnte nicht vorgemerkt werden.",
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: "Aufgabe fuer naechsten Jour Fixe vorgemerkt" });
    loadTasks();
  } catch (error: any) {
    console.error('Error marking task for next jour fixe:', error);
    toast({ title: "Fehler", description: error.message, variant: "destructive" });
  } finally {
    setMeetingTaskId(null);
  }
};
```

### 4.2 Sicherstellen dass Felder in Migration existieren

Die Migration in der letzten Implementierung sollte diese Felder bereits hinzugefuegt haben. Falls nicht, pruefen ob sie angelegt wurden:

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_for_jour_fixe BOOLEAN DEFAULT false;
```

---

## 5. Celebration Animations System (Option C - Eigenstaendig)

Dies ist das umfangreichste Feature. Wir erstellen ein komplett eigenstaendiges System mit Admin-Konfiguration.

### 5.1 Datenbankschema

**Neue Tabelle: `celebration_animations`**

```sql
CREATE TABLE celebration_animations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- z.B. "Einhorn", "Konfetti", "Feuerwerk"
  type TEXT NOT NULL,                    -- 'builtin' oder 'custom'
  animation_key TEXT NOT NULL,           -- z.B. 'unicorn', 'confetti', 'fireworks'
  custom_svg TEXT,                       -- Fuer benutzerdefinierte SVGs
  custom_gif_url TEXT,                   -- Fuer benutzerdefinierte GIFs
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vordefinierte Animationen einfuegen
INSERT INTO celebration_animations (name, type, animation_key, order_index) VALUES
  ('Einhorn', 'builtin', 'unicorn', 0),
  ('Konfetti', 'builtin', 'confetti', 1),
  ('Feuerwerk', 'builtin', 'fireworks', 2),
  ('Sterne', 'builtin', 'stars', 3),
  ('Daumen hoch', 'builtin', 'thumbsup', 4);
```

**Tenant-Einstellungen erweitern (app_settings):**

```sql
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_enabled BOOLEAN DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_mode TEXT DEFAULT 'random';
  -- 'random', 'sequential', 'specific'
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_selected_animation TEXT DEFAULT 'unicorn';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_frequency TEXT DEFAULT 'always';
  -- 'always', 'sometimes' (50%), 'rarely' (20%)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_speed TEXT DEFAULT 'normal';
  -- 'slow', 'normal', 'fast'
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS celebration_size TEXT DEFAULT 'medium';
  -- 'small', 'medium', 'large'
```

### 5.2 Neue Komponenten

#### `CelebrationAnimationSystem.tsx`
Hauptkomponente, die alle Animationen verwaltet:

```typescript
interface CelebrationSettings {
  enabled: boolean;
  mode: 'random' | 'sequential' | 'specific';
  selectedAnimation: string;
  frequency: 'always' | 'sometimes' | 'rarely';
  speed: 'slow' | 'normal' | 'fast';
  size: 'small' | 'medium' | 'large';
}

interface CelebrationAnimationSystemProps {
  isVisible: boolean;
  onAnimationComplete?: () => void;
}

export function CelebrationAnimationSystem({ isVisible, onAnimationComplete }: CelebrationAnimationSystemProps) {
  const [settings, setSettings] = useState<CelebrationSettings | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  useEffect(() => {
    if (isVisible && settings?.enabled) {
      const shouldAnimate = shouldShowAnimation(settings.frequency);
      if (shouldAnimate) {
        const animKey = selectAnimation(settings);
        setCurrentAnimation(animKey);
      }
    }
  }, [isVisible, settings]);
  
  // Render basierend auf currentAnimation
  switch (currentAnimation) {
    case 'unicorn': return <UnicornAnimation ... />;
    case 'confetti': return <ConfettiAnimation ... />;
    case 'fireworks': return <FireworksAnimation ... />;
    case 'stars': return <StarsAnimation ... />;
    case 'thumbsup': return <ThumbsUpAnimation ... />;
    default: return null;
  }
}
```

#### Neue Animationskomponenten

**`ConfettiAnimation.tsx`:**
```typescript
// Buntes Konfetti, das von oben faellt
export function ConfettiAnimation({ speed, size, onComplete }: AnimationProps) {
  // Canvas-basierte Animation mit vielen bunten Partikeln
  // Konfetti-Stuecke in verschiedenen Formen und Farben
}
```

**`FireworksAnimation.tsx`:**
```typescript
// Feuerwerk-Explosion
export function FireworksAnimation({ speed, size, onComplete }: AnimationProps) {
  // SVG-basierte Explosionen mit leuchtenden Partikeln
  // Mehrere Explosionen an verschiedenen Stellen
}
```

**`StarsAnimation.tsx`:**
```typescript
// Glitzernde Sterne
export function StarsAnimation({ speed, size, onComplete }: AnimationProps) {
  // Goldene/silberne Sterne, die funkeln und sich bewegen
}
```

**`ThumbsUpAnimation.tsx`:**
```typescript
// Daumen hoch mit Bewegung
export function ThumbsUpAnimation({ speed, size, onComplete }: AnimationProps) {
  // Emoji-aehnlicher Daumen hoch, der nach oben schwebt
}
```

### 5.3 Admin-UI in Administration.tsx

**Neuer Tab oder Bereich unter "Allgemein":**

```typescript
// Celebration Animation Settings
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Sparkles className="h-5 w-5" />
      Erfolgs-Animationen
    </CardTitle>
    <CardDescription>
      Konfigurieren Sie die Animationen, die bei erledigten Aufgaben angezeigt werden.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    
    {/* Aktivierung */}
    <div className="flex items-center justify-between">
      <div>
        <Label>Animationen aktiviert</Label>
        <p className="text-sm text-muted-foreground">
          Zeigt Animationen bei erfolgreichen Aktionen
        </p>
      </div>
      <Switch 
        checked={celebrationSettings.enabled}
        onCheckedChange={(checked) => updateCelebrationSettings({ enabled: checked })}
      />
    </div>
    
    <Separator />
    
    {/* Auswahl-Modus */}
    <div className="space-y-2">
      <Label>Animations-Modus</Label>
      <Select 
        value={celebrationSettings.mode}
        onValueChange={(value) => updateCelebrationSettings({ mode: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="random">
            <div className="flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Zufaellige Auswahl
            </div>
          </SelectItem>
          <SelectItem value="sequential">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" />
              Der Reihe nach
            </div>
          </SelectItem>
          <SelectItem value="specific">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Feste Animation
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    
    {/* Animation auswaehlen (bei mode="specific") */}
    {celebrationSettings.mode === 'specific' && (
      <div className="space-y-2">
        <Label>Animation</Label>
        <div className="grid grid-cols-3 gap-2">
          {animations.map(anim => (
            <Button
              key={anim.animation_key}
              variant={celebrationSettings.selectedAnimation === anim.animation_key ? "default" : "outline"}
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => updateCelebrationSettings({ selectedAnimation: anim.animation_key })}
            >
              <AnimationPreview type={anim.animation_key} />
              <span className="text-sm">{anim.name}</span>
            </Button>
          ))}
        </div>
      </div>
    )}
    
    {/* Haeufigkeit */}
    <div className="space-y-2">
      <Label>Haeufigkeit</Label>
      <Select 
        value={celebrationSettings.frequency}
        onValueChange={(value) => updateCelebrationSettings({ frequency: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always">Immer (100%)</SelectItem>
          <SelectItem value="sometimes">Manchmal (50%)</SelectItem>
          <SelectItem value="rarely">Selten (20%)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    
    {/* Geschwindigkeit */}
    <div className="space-y-2">
      <Label>Geschwindigkeit</Label>
      <ToggleGroup 
        type="single" 
        value={celebrationSettings.speed}
        onValueChange={(value) => value && updateCelebrationSettings({ speed: value })}
      >
        <ToggleGroupItem value="slow">Langsam</ToggleGroupItem>
        <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
        <ToggleGroupItem value="fast">Schnell</ToggleGroupItem>
      </ToggleGroup>
    </div>
    
    {/* Groesse */}
    <div className="space-y-2">
      <Label>Groesse</Label>
      <ToggleGroup 
        type="single" 
        value={celebrationSettings.size}
        onValueChange={(value) => value && updateCelebrationSettings({ size: value })}
      >
        <ToggleGroupItem value="small">Klein</ToggleGroupItem>
        <ToggleGroupItem value="medium">Mittel</ToggleGroupItem>
        <ToggleGroupItem value="large">Gross</ToggleGroupItem>
      </ToggleGroup>
    </div>
    
    {/* Vorschau-Button */}
    <Button 
      variant="outline" 
      onClick={() => triggerPreview()}
      className="w-full"
    >
      <Eye className="mr-2 h-4 w-4" />
      Vorschau anzeigen
    </Button>
    
  </CardContent>
</Card>
```

### 5.4 Hook: useCelebrationSettings

```typescript
export function useCelebrationSettings() {
  const [settings, setSettings] = useState<CelebrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('celebration_*')
      .single();
    
    if (data) {
      setSettings({
        enabled: data.celebration_enabled ?? true,
        mode: data.celebration_mode ?? 'random',
        selectedAnimation: data.celebration_selected_animation ?? 'unicorn',
        frequency: data.celebration_frequency ?? 'always',
        speed: data.celebration_speed ?? 'normal',
        size: data.celebration_size ?? 'medium',
      });
    }
    setLoading(false);
  };
  
  const updateSettings = async (updates: Partial<CelebrationSettings>) => {
    // Update local state + database
  };
  
  return { settings, loading, updateSettings };
}
```

### 5.5 Integration in bestehenden Code

**Ersetze UnicornAnimation durch CelebrationAnimationSystem:**

```typescript
// In TasksView, MyWorkTasksTab, etc.
// Alt:
<UnicornAnimation isVisible={showUnicorn} onAnimationComplete={() => setShowUnicorn(false)} />

// Neu:
<CelebrationAnimationSystem isVisible={showCelebration} onAnimationComplete={() => setShowCelebration(false)} />
```

---

## Zusammenfassung der Dateiänderungen

| Datei | Aenderungen |
|-------|-------------|
| **Migration** | Neue Tabelle `celebration_animations`, neue Spalten in `app_settings` |
| **`EventPlanningView.tsx`** | Erledigt-Button in Listenansicht + Detailansicht |
| **`MyWorkPlanningsTab.tsx`** | Erledigt/Archiv-Buttons + Handler |
| **`Administration.tsx`** | "Aufgaben"-Button bei Meeting-Templates + Celebration Settings UI |
| **`MyWorkTasksTab.tsx`** | Verbesserte Fehlerbehandlung fuer Meeting-Zuordnung |
| **Neu: `CelebrationAnimationSystem.tsx`** | Haupt-Animations-Controller |
| **Neu: `ConfettiAnimation.tsx`** | Konfetti-Animation |
| **Neu: `FireworksAnimation.tsx`** | Feuerwerk-Animation |
| **Neu: `StarsAnimation.tsx`** | Sterne-Animation |
| **Neu: `ThumbsUpAnimation.tsx`** | Daumen-hoch-Animation |
| **Neu: `useCelebrationSettings.ts`** | Hook fuer Einstellungen |
| **`UnicornAnimation.tsx`** | Anpassung fuer dynamische Groesse/Geschwindigkeit |
| **`TasksView.tsx`** | Ersetzen von UnicornAnimation durch CelebrationAnimationSystem |

---

## Animations-Designs

### Konfetti
- Bunte Papierstuecke in verschiedenen Farben (Regenbogen)
- Fallen von oben nach unten mit Rotation
- Flatternde Bewegung
- 50-100 Partikel

### Feuerwerk
- 3-5 Explosionen an zufaelligen Positionen
- Leuchtende Partikel, die nach aussen fliegen
- Verschiedene Farben pro Explosion
- Nachleuchten-Effekt

### Sterne
- Goldene und silberne Sterne
- Funkeln/Glitzern-Effekt
- Schweben nach oben
- Groessenvariation

### Daumen hoch
- Grosser Emoji-aehnlicher Daumen
- Schwebt von unten nach oben
- Leichte Drehung
- Pulsierender Glow-Effekt

