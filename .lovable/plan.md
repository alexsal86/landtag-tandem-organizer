
# Plan: Zwei Verbesserungen für die Veranstaltungsplanung

## Übersicht

| # | Problem | Ursache | Lösung | Aufwand |
|---|---------|---------|--------|---------|
| 1 | Checklist-UI aktualisiert nicht | Fehlendes optimistisches Update | Lokalen State sofort aktualisieren | 15 Min |
| 2 | Standard-Mitarbeiter an falscher Stelle | UI in Profil statt Planungsübersicht | Dialog auf Planungsseite verschieben + vereinfachen | 30 Min |

---

## 1. Checklist-Fehler beheben: Optimistisches UI-Update

**Problem:** Wenn man eine Checkbox in der Checkliste anklickt, erscheint ein Fehler-Toast und die Änderung wird erst nach Neuladen der Seite sichtbar. Die Datenbank wird aktualisiert, aber das UI nicht sofort.

**Ursache:** In `toggleChecklistItem` (Zeile 1186-1250) wird nach dem erfolgreichen Datenbank-Update `fetchPlanningDetails()` aufgerufen, was mehrere asynchrone Queries startet. Während dieser Zeit zeigt das UI den alten Zustand.

**Lösung - Optimistisches Update:**

```typescript
// In EventPlanningView.tsx - toggleChecklistItem Funktion

const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
  // Permission check (bleibt gleich)
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

  // NEU: Optimistisches Update - UI sofort aktualisieren
  const previousItems = [...checklistItems];
  setChecklistItems(prev => 
    prev.map(item => 
      item.id === itemId ? { ...item, is_completed: !isCompleted } : item
    )
  );

  // Datenbank-Update
  const { error } = await supabase
    .from("event_planning_checklist_items")
    .update({ is_completed: !isCompleted })
    .eq("id", itemId);

  if (error) {
    // NEU: Bei Fehler zurückrollen
    setChecklistItems(previousItems);
    toast({
      title: "Fehler",
      description: "Checkliste konnte nicht aktualisiert werden.",
      variant: "destructive",
    });
    return;
  }

  // E-Mail-Automation bleibt gleich...

  // Erfolgs-Toast
  toast({
    title: "Erfolg",
    description: "Checkliste wurde aktualisiert.",
  });

  // Kein fetchPlanningDetails() mehr nötig - State ist bereits aktuell
};
```

**Vorteile:**
- UI reagiert sofort auf Klick
- Kein Flackern oder Verzögerung
- Bei Datenbank-Fehler wird der alte Zustand wiederhergestellt

---

## 2. Standard-Mitarbeiter auf Planungsübersicht verschieben

**Problem:** 
- Die Einstellung für Standard-Mitarbeiter ist im Profil versteckt, gehört aber auf die Planungsseite
- Die aktuelle UI zeigt keine Teammitglieder zum Auswählen an (Query-Problem)
- Die UI soll so einfach sein wie bei "Meine Notizen" Freigabe

### 2a. PlanningPreferencesCard aus Profil entfernen

**Datei:** `src/pages/EditProfile.tsx`

```typescript
// Import und Verwendung von PlanningPreferencesCard entfernen
// Die Karte wird von dort gelöscht
```

### 2b. Neuen Dialog nach dem Muster von GlobalNoteShareDialog erstellen

**Neue Datei:** `src/components/event-planning/PlanningDefaultCollaboratorsDialog.tsx`

Die neue Komponente basiert auf dem bewährten `GlobalNoteShareDialog`-Muster:

```typescript
// Vereinfachtes UI wie bei Notizen-Freigabe:
// - Suchfeld für Teammitglieder
// - Checkbox + Avatar + Name in einer Zeile
// - Bei Auswahl: Berechtigung wählen (Ansehen/Bearbeiten)
// - Sofortiges Speichern

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        Standard-Mitarbeiter festlegen
      </DialogTitle>
      <DialogDescription>
        Diese Mitarbeiter werden bei neuen Planungen automatisch hinzugefügt.
      </DialogDescription>
    </DialogHeader>

    {/* Suchfeld */}
    <div className="relative">
      <Search className="absolute left-3 top-1/2 ..." />
      <Input placeholder="Teammitglieder suchen..." />
    </div>

    {/* Team-Liste mit Checkboxen (wie bei Meine Notizen) */}
    <ScrollArea className="max-h-[300px]">
      {filteredMembers.map((member) => (
        <div className={cn(
          "flex items-center justify-between gap-2 p-2 rounded-md",
          isSelected(member.id) ? "bg-primary/10" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected(member.id)}
              onCheckedChange={() => handleToggle(member)}
            />
            <Avatar />
            <span>{member.display_name}</span>
          </div>
          
          {isSelected(member.id) && (
            <Select value={getPermission(member.id)}>
              <SelectItem value="view">Ansehen</SelectItem>
              <SelectItem value="edit">Bearbeiten</SelectItem>
            </Select>
          )}
        </div>
      ))}
    </ScrollArea>

    {/* Zusammenfassung */}
    {defaultCollaborators.length > 0 && (
      <div className="text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        {defaultCollaborators.length} Mitarbeiter werden automatisch hinzugefügt
      </div>
    )}
  </DialogContent>
</Dialog>
```

### 2c. Button in EventPlanningView Header hinzufügen

**Datei:** `src/components/EventPlanningView.tsx` (Zeile ~2505)

```typescript
// Neuer Button neben "Neue Planung":
<div className="flex items-center gap-4">
  {/* View Toggle bleibt */}
  
  {/* NEU: Standard-Mitarbeiter Button */}
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => setShowDefaultCollaboratorsDialog(true)}
  >
    <Users className="h-4 w-4 mr-2" />
    Standard-Mitarbeiter
  </Button>
  
  {/* Neue Planung Dialog bleibt */}
</div>

{/* Dialog am Ende der Komponente */}
<PlanningDefaultCollaboratorsDialog
  open={showDefaultCollaboratorsDialog}
  onOpenChange={setShowDefaultCollaboratorsDialog}
/>
```

### 2d. Hook für Planungs-Voreinstellungen

**Neue Datei:** `src/hooks/usePlanningPreferences.tsx`

```typescript
// Nach dem Muster von useGlobalNoteSharing:
export const usePlanningPreferences = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [defaultCollaborators, setDefaultCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);

  // Laden der Voreinstellungen
  const loadPreferences = async () => { ... };

  // Mitarbeiter hinzufügen
  const addCollaborator = async (userId, canEdit) => {
    // Speichert in user_planning_preferences.default_collaborators
  };

  // Mitarbeiter entfernen
  const removeCollaborator = async (userId) => { ... };

  // Berechtigung ändern
  const updatePermission = async (userId, canEdit) => { ... };

  return {
    defaultCollaborators,
    loading,
    addCollaborator,
    removeCollaborator,
    updatePermission,
    refreshPreferences: loadPreferences,
  };
};
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/EventPlanningView.tsx` | 1) Optimistisches Update in toggleChecklistItem, 2) Button + Dialog-State für Standard-Mitarbeiter |
| `src/pages/EditProfile.tsx` | PlanningPreferencesCard entfernen |
| `src/components/profile/PlanningPreferencesCard.tsx` | Löschen oder umbauen |
| `src/components/event-planning/PlanningDefaultCollaboratorsDialog.tsx` | NEU: Vereinfachter Dialog nach GlobalNoteShareDialog-Muster |
| `src/hooks/usePlanningPreferences.tsx` | NEU: Hook für Voreinstellungen |

---

## Technische Details

### Optimistisches Update Pattern

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. User klickt Checkbox                                     │
├─────────────────────────────────────────────────────────────┤
│ 2. Sofort: setChecklistItems() mit neuem Wert              │
│    → UI zeigt sofort neuen Zustand                          │
├─────────────────────────────────────────────────────────────┤
│ 3. Async: supabase.update()                                 │
│    ├─ Erfolg: Toast anzeigen, fertig                        │
│    └─ Fehler: setChecklistItems(previousItems) → Rollback  │
└─────────────────────────────────────────────────────────────┘
```

### Dialog-Vergleich: Notizen vs. Planungen

| Aspekt | Meine Notizen (Referenz) | Planungen (Neu) |
|--------|--------------------------|-----------------|
| Dialog-Komponente | `GlobalNoteShareDialog` | `PlanningDefaultCollaboratorsDialog` |
| Hook | `useGlobalNoteSharing` | `usePlanningPreferences` |
| Tabelle | `quick_note_global_shares` | `user_planning_preferences` |
| Datenstruktur | Zeilen pro User | JSONB Array |
| UI | Checkbox + Avatar + Permission | Identisch |

**Geschätzter Gesamtaufwand:** ~45 Minuten
