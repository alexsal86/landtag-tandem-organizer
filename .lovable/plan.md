
# Plan: Planungen - Archiv-Fixes und UI-Verbesserungen

## Zusammenfassung der Probleme

| Problem | Ursache | Loesung |
|---------|---------|---------|
| Fehler beim Wiederherstellen/Archivieren | Fehlende `.select()` bei Supabase-Update | `.select()` hinzufuegen |
| "Abschliessen" vs "Archivieren" verwirrend | Zwei Funktionen die dasselbe tun | Nur "Archivieren" behalten |
| Button hinter Menue versteckt | DropdownMenu verwendet | Direkter Archive-Icon-Button |
| Archiv oeffnet nicht direkt | Moegliches State/Timing-Problem | Dialog-Logik korrigieren |

---

## 1. Bugfix: `.select()` zu allen Archiv-Funktionen hinzufuegen

Das ist das Hauptproblem! Ohne `.select()` kann der Client nicht korrekt auf Erfolg/Fehler reagieren, und es erscheinen falsche Fehlermeldungen.

### archivePlanning (Zeilen 481-485)

**Vorher:**
```typescript
const { error } = await supabase
  .from("event_plannings")
  .update({ is_archived: true, archived_at: new Date().toISOString() })
  .eq("id", planningId)
  .eq("user_id", user?.id);
```

**Nachher:**
```typescript
const { data, error } = await supabase
  .from("event_plannings")
  .update({ is_archived: true, archived_at: new Date().toISOString() })
  .eq("id", planningId)
  .eq("user_id", user?.id)
  .select();

if (error || !data || data.length === 0) throw error || new Error("Update failed");
```

### restorePlanning (Zeilen 506-510)

**Nachher:**
```typescript
const { data, error } = await supabase
  .from("event_plannings")
  .update({ is_archived: false, archived_at: null })
  .eq("id", planningId)
  .eq("user_id", user?.id)
  .select();

if (error || !data || data.length === 0) throw error || new Error("Update failed");
```

### archivePreparation (Zeilen 605-611)

**Nachher:**
```typescript
const { data, error } = await supabase
  .from("appointment_preparations")
  .update({ is_archived: true, archived_at: new Date().toISOString() })
  .eq("id", preparationId)
  .select();

if (error || !data || data.length === 0) throw error || new Error("Update failed");
```

---

## 2. "Abschliessen" entfernen - nur "Archivieren" behalten

Da beide Funktionen praktisch dasselbe machen, wird `completePlanningAndArchive` und `completePreparationAndArchive` entfernt. Nur die Archiv-Funktionen bleiben.

### Zu entfernende Funktionen:
- `completePlanningAndArchive` (Zeilen 530-571)
- `completePreparationAndArchive` (Zeilen 574-600)

---

## 3. Direkter Archiv-Icon-Button statt Dropdown-Menue

### Veranstaltungsplanungen - Card-Ansicht (Zeilen 2948-2973)

**Vorher:** DropdownMenu mit "Abschliessen" und "Archivieren"

**Nachher:** Einzelner Icon-Button mit Tooltip
```typescript
{planning.user_id === user?.id && (
  <Tooltip>
    <TooltipTrigger asChild>
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
    </TooltipTrigger>
    <TooltipContent>Archivieren</TooltipContent>
  </Tooltip>
)}
```

### Veranstaltungsplanungen - Listen-Ansicht (Zeilen 851-870)

Analog: DropdownMenu durch einzelnen Icon-Button ersetzen.

### Veranstaltungsplanungen - Detailansicht (Zeilen 3495-3520)

**Vorher:** AlertDialog mit "Abschliessen"

**Nachher:** Button "Archivieren" (ohne Bestaetigung, da einfache Aktion)
```typescript
{selectedPlanning.user_id === user?.id && (
  <Button 
    variant="outline"
    onClick={() => archivePlanning(selectedPlanning.id)}
  >
    <Archive className="mr-2 h-4 w-4" />
    Archivieren
  </Button>
)}
```

### Terminplanungen - Card-Ansicht (Zeilen 3175-3198)

**Nachher:** Einzelner Icon-Button
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-7 w-7"
      onClick={(e) => {
        e.stopPropagation();
        archivePreparation(preparation.id);
      }}
    >
      <Archive className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Archivieren</TooltipContent>
</Tooltip>
```

### Terminplanungen - Listen-Ansicht (Zeilen 929-948)

Analog: DropdownMenu durch einzelnen Icon-Button ersetzen.

---

## 4. Archiv-Button-Dialog sofort oeffnen

Das Problem ist, dass der Dialog sich nicht oeffnet, wenn man auf "Archiv" klickt. Die Ursache koennte sein, dass das Event irgendwie blockiert wird oder der State nicht korrekt gesetzt wird.

### Loesung: Direkte State-Aenderung ohne async-Abhaengigkeit

**Vorher (Zeilen 2843-2849):**
```typescript
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  console.log("Archiv-Button clicked, current state:", showPlanningArchive);
  fetchArchivedPlannings();
  setShowPlanningArchive(true);
}}
```

**Nachher:**
```typescript
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  // Sofort Dialog oeffnen - nicht auf fetch warten!
  setShowPlanningArchive(true);
  // Dann Daten laden
  fetchArchivedPlannings();
}}
```

Die Reihenfolge ist wichtig: Erst den Dialog oeffnen, dann die Daten laden. So sieht der Benutzer sofort den Dialog (ggf. mit Ladezustand) und muss nicht warten.

---

## 5. Zusammenfassung aller Aenderungen

| Datei | Zeilen (ca.) | Aenderung |
|-------|--------------|-----------|
| EventPlanningView.tsx | 481-485 | `.select()` zu archivePlanning |
| EventPlanningView.tsx | 506-510 | `.select()` zu restorePlanning |
| EventPlanningView.tsx | 605-611 | `.select()` zu archivePreparation |
| EventPlanningView.tsx | 530-571 | `completePlanningAndArchive` entfernen |
| EventPlanningView.tsx | 574-600 | `completePreparationAndArchive` entfernen |
| EventPlanningView.tsx | 2843-2849 | Archiv-Dialog-Reihenfolge aendern |
| EventPlanningView.tsx | 2948-2973 | Card-Ansicht: DropdownMenu -> Icon-Button |
| EventPlanningView.tsx | 851-870 | Listen-Ansicht: DropdownMenu -> Icon-Button |
| EventPlanningView.tsx | 3495-3520 | Detailansicht: "Abschliessen" -> "Archivieren" |
| EventPlanningView.tsx | 3175-3198 | Termin Card: DropdownMenu -> Icon-Button |
| EventPlanningView.tsx | 929-948 | Termin Liste: DropdownMenu -> Icon-Button |

---

## Visuelle Vorschau

**Vorher (Card):**
```
[Titel]                  [Privat] [...]
                                   |
                         +---------+------+
                         | Abschliessen   |
                         | Archivieren    |
                         +----------------+
```

**Nachher (Card):**
```
[Titel]                  [Privat] [📁]
                                   ^
                                   |
                            Tooltip: "Archivieren"
```

**Vorher (Detail):**
```
[+ Mitarbeiter] [✓ Abschliessen] [🗑 Loeschen]
```

**Nachher (Detail):**
```
[+ Mitarbeiter] [📁 Archivieren] [🗑 Loeschen]
```
