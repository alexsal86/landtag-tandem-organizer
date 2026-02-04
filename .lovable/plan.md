

# Plan: Behebung von Bugs und Verbesserungen in Meeting-Templates, Planungen und Celebration System

## Zusammenfassung der Probleme und Loesungen

| # | Problem | Ursache | Loesung |
|---|---------|---------|---------|
| 1 | "Aufgaben" wird zu "Meine Notizen" bei Unterpunkt-Verschiebung | `addSystemTemplateItem` setzt Titel nur fuer `upcoming_appointments` oder `quick_notes`, ignoriert `tasks` | Titel-Logik um `tasks` erweitern |
| 2 | Fehler beim Aendern des Template-Namens | Nach `loadData()` wird `selectedTemplate` nicht aktualisiert | `selectedTemplate` nach dem Speichern korrekt aktualisieren |
| 3 | Fehlende Oeffentlichkeits-Option und Rollen bei Teilnehmern | `MeetingTemplateParticipantsEditor` hat keine Felder dafuer | Erweitern um `default_visibility` und Teilnehmer-Rollen |
| 4 | Erledigt-Button auch bei fremden Planungen sichtbar | Button wird immer angezeigt, nicht nur bei Eigentuemer | Berechtigung pruefen bevor Button angezeigt wird |
| 5 | Celebration Animation System nicht in UI integriert | TasksView und MyWorkTasksTab verwenden noch `UnicornAnimation` | Ersetzen durch `CelebrationAnimationSystem` + Admin-UI hinzufuegen |

---

## 1. Bug: "Aufgaben" wird zu "Meine Notizen" bei Unterpunkt-Verschiebung

### Ursache

In `Administration.tsx` Zeile 497-503 hat die Funktion `addSystemTemplateItem` eine unvollstaendige Titel-Logik:

```typescript
// Aktuell (fehlerhaft):
const title = systemType === 'upcoming_appointments' ? 'Kommende Termine' : 'Meine Notizen';
```

Das bedeutet: Wenn `systemType === 'tasks'`, wird trotzdem "Meine Notizen" als Titel gesetzt.

Zusaetzlich fehlt in Zeile 497-498 die Pruefung auf `tasks`:

```typescript
description: `"${systemType === 'upcoming_appointments' ? 'Kommende Termine' : 'Meine Notizen'}" ist bereits in der Agenda.`
```

### Aenderungen in `Administration.tsx`

**Zeile 497-503:**
```typescript
// NEU:
const getTitleForSystemType = (type: string) => {
  switch (type) {
    case 'upcoming_appointments': return 'Kommende Termine';
    case 'quick_notes': return 'Meine Notizen';
    case 'tasks': return 'Aufgaben';
    default: return type;
  }
};

// In der Funktion verwenden:
toast({ 
  title: "Bereits vorhanden", 
  description: `"${getTitleForSystemType(systemType)}" ist bereits in der Agenda.`,
  variant: "destructive" 
});

const title = getTitleForSystemType(systemType);
```

**Zeile 1380-1408 - Fehlender "Aufgaben" Button im Child-Popover:**
```typescript
<div className="flex gap-1 flex-wrap">
  <Button ... onClick={() => addSystemTemplateItem('upcoming_appointments', index)}>
    Termine
  </Button>
  <Button ... onClick={() => addSystemTemplateItem('quick_notes', index)}>
    Notizen
  </Button>
  {/* NEU: Aufgaben-Button */}
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

**Zeile 1497-1507 - Fehlende Icon-Darstellung fuer "tasks" bei Child-Items:**
```typescript
{child.system_type ? (
  <>
    {child.system_type === 'upcoming_appointments' ? (
      <CalendarDays className="h-3.5 w-3.5 text-blue-600 shrink-0" />
    ) : child.system_type === 'tasks' ? (
      <ListTodo className="h-3.5 w-3.5 text-green-600 shrink-0" />
    ) : (
      <StickyNote className="h-3.5 w-3.5 text-amber-600 shrink-0" />
    )}
    <span className="text-sm">{child.title}</span>
    <span className="text-[10px] ...">Dynamisch</span>
  </>
) : ...}
```

**Zeile 1436-1444 - Farblogik fuer Child-Items erweitern:**
```typescript
className={`flex items-center gap-2 p-2 rounded-md border ${
  child.system_type
    ? child.system_type === 'upcoming_appointments'
      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
      : child.system_type === 'tasks'
      ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
      : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
    : 'bg-muted/30 border-border'
}`}
```

---

## 2. Bug: Fehler beim Aendern des Template-Namens

### Ursache

Nach dem Speichern des neuen Namens wird `loadData()` aufgerufen (Zeile 1126), aber `selectedTemplate` wird nicht mit den neuen Daten aktualisiert. Wenn die Templates neu geladen werden, verliert `selectedTemplate` den Bezug.

### Loesung in `Administration.tsx`

**Zeile 1119-1131:**
```typescript
<Button size="sm" className="h-8 w-8 p-0" onClick={async () => {
  try {
    const { error } = await supabase
      .from('meeting_templates')
      .update({ name: editingTemplateName.value })
      .eq('id', selectedTemplate.id);
    if (error) throw error;
    
    // Lokalen State zuerst aktualisieren (vor loadData)
    setSelectedTemplate({
      ...selectedTemplate,
      name: editingTemplateName.value
    });
    
    // Dann Daten neu laden
    await loadData();
    setEditingTemplateName(null);
    toast({ title: "Gespeichert", description: "Template-Name aktualisiert." });
  } catch (error: any) {
    toast({ title: "Fehler", description: "Fehler beim Speichern.", variant: "destructive" });
  }
}}>
```

---

## 3. Fehlende Oeffentlichkeits-Option und Rollen bei Teilnehmern

### Aktuelle Situation

Die `MeetingTemplateParticipantsEditor` speichert nur User-IDs als `default_participants`. Es fehlen:
- `default_visibility` (public/private) fuer Meetings
- Rollen pro Teilnehmer (organizer, participant, optional)

### Datenbankschema erweitern

```sql
ALTER TABLE meeting_templates ADD COLUMN IF NOT EXISTS default_visibility TEXT DEFAULT 'private';
-- 'private' oder 'public'
```

Die Teilnehmer-Struktur muss von `string[]` zu einem komplexeren Format geaendert werden:

```typescript
// Neues Format fuer default_participants:
interface DefaultParticipant {
  user_id: string;
  role: 'organizer' | 'participant' | 'optional';
}
```

### Aenderungen in `MeetingTemplateParticipantsEditor.tsx`

**Neue Props:**
```typescript
interface MeetingTemplateParticipantsEditorProps {
  templateId: string;
  defaultParticipants: Array<{ user_id: string; role: string }> | string[];
  defaultRecurrence: RecurrenceData | null;
  defaultVisibility?: 'private' | 'public';
  autoCreateCount?: number;
  compact?: boolean;
  onSave: (
    participants: Array<{ user_id: string; role: string }>,
    recurrence: RecurrenceData | null,
    autoCreateCount?: number,
    visibility?: 'private' | 'public'
  ) => void;
}
```

**Neue State-Variablen:**
```typescript
const [visibility, setVisibility] = useState<'private' | 'public'>(defaultVisibility || 'private');
const [participantRoles, setParticipantRoles] = useState<Map<string, string>>(new Map());
```

**UI-Erweiterungen:**

1. **Sichtbarkeits-Toggle:**
```typescript
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-base flex items-center gap-2">
      <Eye className="h-4 w-4" />
      Standard-Sichtbarkeit
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <div>
        <Label>Oeffentlich fuer alle Teammitglieder</Label>
        <p className="text-sm text-muted-foreground">
          Meetings werden fuer alle Mandantenmitglieder sichtbar sein
        </p>
      </div>
      <Switch
        checked={visibility === 'public'}
        onCheckedChange={(checked) => {
          const newVis = checked ? 'public' : 'private';
          setVisibility(newVis);
          onSave(participantsWithRoles, recurrence.enabled ? recurrence : null, autoCreateCount, newVis);
        }}
      />
    </div>
  </CardContent>
</Card>
```

2. **Rollen-Auswahl pro Teilnehmer:**
```typescript
{participantUsers.map((user) => (
  <div key={user.id} className="flex items-center gap-3 p-2 rounded-md border bg-muted/50">
    <Avatar ... />
    <div className="flex-1 min-w-0">
      <span className="font-medium text-sm">{user.display_name}</span>
    </div>
    
    {/* Rollen-Selector */}
    <Select
      value={participantRoles.get(user.id) || 'participant'}
      onValueChange={(role) => updateParticipantRole(user.id, role)}
    >
      <SelectTrigger className="w-28 h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="organizer">Organisator</SelectItem>
        <SelectItem value="participant">Teilnehmer</SelectItem>
        <SelectItem value="optional">Optional</SelectItem>
      </SelectContent>
    </Select>
    
    <Button size="icon" variant="ghost" onClick={() => handleRemoveParticipant(user.id)}>
      <X className="h-3 w-3" />
    </Button>
  </div>
))}
```

---

## 4. Erledigt-Button bei fremden Planungen verstecken

### Problem

In `EventPlanningView.tsx` Zeile 817-838 und `MyWorkPlanningsTab.tsx` Zeile 273-293 wird der Erledigt-Button immer angezeigt, auch wenn der Benutzer keine Bearbeitungsrechte hat.

### Loesung

**EventPlanningView.tsx (Listenansicht, Zeile 817-838):**
```typescript
<TableCell onClick={(e) => e.stopPropagation()}>
  <div className="flex items-center gap-1">
    {/* Erledigt-Button - nur fuer Eigentuemer/Bearbeiter */}
    {(planning.user_id === user?.id || hasEditPermission(planning)) && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-7 w-7", (planning as any).is_completed && "text-green-600")}
              onClick={() => togglePlanningCompleted(planning.id, !(planning as any).is_completed)}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>...</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
    {/* Archiv-Button bleibt nur fuer Eigentuemer */}
    ...
  </div>
</TableCell>
```

**Hilfsfunktion hinzufuegen:**
```typescript
const hasEditPermission = (planning: EventPlanning) => {
  // Pruefe ob User ein Collaborator mit can_edit ist
  const collab = collaborators.find(c => 
    c.event_planning_id === planning.id && c.user_id === user?.id
  );
  return collab?.can_edit === true;
};
```

**MyWorkPlanningsTab.tsx (Zeile 273-293):**
```typescript
{/* Erledigt-Button - nur fuer Eigentuemer */}
{planning.user_id === user?.id && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent>...</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

**Detailansicht (Zeile 3545-3554):**

Hier fehlt der Erledigt-Button komplett. Hinzufuegen vor dem Archiv-Button:

```typescript
{/* Erledigt-Button - nur fuer Eigentuemer/Bearbeiter */}
{(selectedPlanning.user_id === user?.id || canEdit) && (
  <Button 
    variant={(selectedPlanning as any).is_completed ? "default" : "outline"}
    className={cn((selectedPlanning as any).is_completed && "bg-green-600 hover:bg-green-700")}
    onClick={() => togglePlanningCompleted(selectedPlanning.id, !(selectedPlanning as any).is_completed)}
  >
    <CheckCircle className="mr-2 h-4 w-4" />
    {(selectedPlanning as any).is_completed ? "Erledigt" : "Als erledigt markieren"}
  </Button>
)}

{/* Archivieren-Button */}
{selectedPlanning.user_id === user?.id && (
  <Button variant="outline" onClick={() => archivePlanning(selectedPlanning.id)}>
    <Archive className="mr-2 h-4 w-4" />
    Archivieren
  </Button>
)}
```

---

## 5. Celebration Animation System integrieren

### Aktueller Stand

- Komponenten existieren in `src/components/celebrations/`
- `TasksView.tsx` und `MyWorkTasksTab.tsx` verwenden noch `UnicornAnimation`
- Keine Admin-UI fuer Einstellungen

### Aenderungen

**TasksView.tsx:**
```typescript
// Import aendern
import { CelebrationAnimationSystem } from '@/components/celebrations';

// State umbenennen
const [showCelebration, setShowCelebration] = useState(false);

// Bei Task-Completion:
setShowCelebration(true);

// Render:
<CelebrationAnimationSystem 
  isVisible={showCelebration} 
  onAnimationComplete={() => setShowCelebration(false)} 
/>
```

**MyWorkTasksTab.tsx:**
```typescript
// Gleiche Aenderungen wie oben
import { CelebrationAnimationSystem } from '@/components/celebrations';
const [showCelebration, setShowCelebration] = useState(false);
// ... ersetze alle setShowUnicorn(true) durch setShowCelebration(true)
```

### Admin-UI fuer Celebration Settings

**Neuer Bereich in Administration.tsx unter "Allgemein" oder als eigener Sub-Tab:**

```typescript
// Neuer Case in renderContent oder als Teil des "general" Tabs:
case "celebrations":
  return (
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
            checked={celebrationSettings?.enabled ?? true}
            onCheckedChange={(checked) => updateCelebrationSettings({ enabled: checked })}
          />
        </div>
        
        <Separator />
        
        {/* Modus */}
        <div className="space-y-2">
          <Label>Animations-Modus</Label>
          <Select 
            value={celebrationSettings?.mode ?? 'random'}
            onValueChange={(value) => updateCelebrationSettings({ mode: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Zufaellige Auswahl</SelectItem>
              <SelectItem value="sequential">Der Reihe nach</SelectItem>
              <SelectItem value="specific">Feste Animation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Animation auswaehlen bei specific */}
        {celebrationSettings?.mode === 'specific' && (
          <div className="space-y-2">
            <Label>Animation</Label>
            <div className="grid grid-cols-5 gap-2">
              {['unicorn', 'confetti', 'fireworks', 'stars', 'thumbsup'].map(anim => (
                <Button
                  key={anim}
                  variant={celebrationSettings.selectedAnimation === anim ? "default" : "outline"}
                  className="h-16 flex flex-col items-center justify-center gap-1"
                  onClick={() => updateCelebrationSettings({ selectedAnimation: anim })}
                >
                  {anim === 'unicorn' && '🦄'}
                  {anim === 'confetti' && '🎊'}
                  {anim === 'fireworks' && '🎆'}
                  {anim === 'stars' && '⭐'}
                  {anim === 'thumbsup' && '👍'}
                  <span className="text-xs capitalize">{anim}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        
        {/* Haeufigkeit */}
        <div className="space-y-2">
          <Label>Haeufigkeit</Label>
          <Select 
            value={celebrationSettings?.frequency ?? 'always'}
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
          <ToggleGroup type="single" value={celebrationSettings?.speed ?? 'normal'} onValueChange={(v) => v && updateCelebrationSettings({ speed: v })}>
            <ToggleGroupItem value="slow">Langsam</ToggleGroupItem>
            <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
            <ToggleGroupItem value="fast">Schnell</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* Groesse */}
        <div className="space-y-2">
          <Label>Groesse</Label>
          <ToggleGroup type="single" value={celebrationSettings?.size ?? 'medium'} onValueChange={(v) => v && updateCelebrationSettings({ size: v })}>
            <ToggleGroupItem value="small">Klein</ToggleGroupItem>
            <ToggleGroupItem value="medium">Mittel</ToggleGroupItem>
            <ToggleGroupItem value="large">Gross</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* Vorschau */}
        <Button 
          variant="outline" 
          onClick={() => setShowPreviewCelebration(true)}
          className="w-full"
        >
          <Eye className="mr-2 h-4 w-4" />
          Vorschau anzeigen
        </Button>
      </CardContent>
    </Card>
  );
```

**Celebration Settings State und Handler:**
```typescript
const [celebrationSettings, setCelebrationSettings] = useState<CelebrationSettings | null>(null);
const [showPreviewCelebration, setShowPreviewCelebration] = useState(false);

useEffect(() => {
  loadCelebrationSettings();
}, [user]);

const loadCelebrationSettings = async () => {
  if (!user) return;
  const { data } = await supabase
    .from('celebration_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();
  
  if (data) {
    setCelebrationSettings({
      enabled: data.enabled,
      mode: data.mode,
      selectedAnimation: data.selected_animation,
      frequency: data.frequency,
      speed: data.speed,
      size: data.size,
    });
  }
};

const updateCelebrationSettings = async (updates: Partial<CelebrationSettings>) => {
  const newSettings = { ...celebrationSettings, ...updates };
  setCelebrationSettings(newSettings as CelebrationSettings);
  
  await supabase
    .from('celebration_settings')
    .upsert({
      user_id: user?.id,
      enabled: newSettings.enabled,
      mode: newSettings.mode,
      selected_animation: newSettings.selectedAnimation,
      frequency: newSettings.frequency,
      speed: newSettings.speed,
      size: newSettings.size,
    });
};
```

---

## Zusammenfassung der Dateiänderungen

| Datei | Aenderungen |
|-------|-------------|
| **Migration** | `default_visibility` zu `meeting_templates` hinzufuegen |
| **`Administration.tsx`** | 1) `getTitleForSystemType` Funktion, 2) "Aufgaben" im Child-Popover, 3) Icon+Farbe fuer tasks bei Children, 4) Template-Name-Fix, 5) Celebration Admin-UI |
| **`MeetingTemplateParticipantsEditor.tsx`** | Sichtbarkeits-Toggle und Rollen-Auswahl hinzufuegen |
| **`EventPlanningView.tsx`** | Erledigt-Button nur fuer Eigentuemer/Bearbeiter, Erledigt-Button in Detailansicht |
| **`MyWorkPlanningsTab.tsx`** | Erledigt-Button nur fuer Eigentuemer |
| **`TasksView.tsx`** | `UnicornAnimation` durch `CelebrationAnimationSystem` ersetzen |
| **`MyWorkTasksTab.tsx`** | `UnicornAnimation` durch `CelebrationAnimationSystem` ersetzen |

