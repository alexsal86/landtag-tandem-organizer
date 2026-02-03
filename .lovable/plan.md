
# Plan: Veranstaltungs- und Terminplanungen - Archiv-Button Fix + Abschliessen & Archivieren

## Zusammenfassung der Probleme und Loesungen

### Problem 1: Archiv-Button funktioniert nicht

**Analyse:** Der Archiv-Button bei Veranstaltungsplanungen (Zeilen 2712-2723) sieht korrekt aus:
```typescript
<Button 
  variant="outline" 
  size="sm"
  onClick={() => {
    fetchArchivedPlannings();
    setShowPlanningArchive(true);
  }}
>
```

Der Dialog (Zeilen 4738-4784) ist ebenfalls vorhanden. Moegliche Ursachen:
1. Der `onClick` Handler wird durch ein uebergeordnetes Element blockiert
2. Der State `showPlanningArchive` wird nicht korrekt gesetzt
3. Es gibt einen Fehler beim Laden der archivierten Planungen

**Loesung:** Den Button ueberpruefen und mit explizitem Event-Handling verbessern.

---

### Problem 2: "Abschliessen und archivieren" Button fehlt

Dieser Button soll in folgenden Bereichen eingefuegt werden:

| Bereich | Ort | Position |
|---------|-----|----------|
| **Veranstaltungsplanungen** | Card-Ansicht | Im Dropdown-Menue (neben "Archivieren") |
| **Veranstaltungsplanungen** | Listen-Ansicht | Im Dropdown-Menue (neben "Archivieren") |
| **Veranstaltungsplanungen** | Detailansicht | Neben "Loeschen" und "+ Mitarbeiter" |
| **Terminplanungen** | Card-Ansicht | Im Dropdown-Menue hinzufuegen |
| **Terminplanungen** | Listen-Ansicht | Im Dropdown-Menue hinzufuegen |

---

## Implementierung

### 1. Archiv-Button fixen (Veranstaltungsplanungen)

**Datei:** `src/components/EventPlanningView.tsx`

Der Button-Handler wird mit zusaetzlichem Logging und explizitem State-Update verbessert:

```typescript
// Zeilen 2712-2723
<Button 
  variant={showPlanningArchive ? "default" : "outline"}
  size="sm"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Archiv-Button clicked, current state:", showPlanningArchive);
    fetchArchivedPlannings();
    setShowPlanningArchive(true);
  }}
>
  <Archive className="h-4 w-4 mr-2" />
  Archiv
</Button>
```

### 2. Neue Funktion: completePlanningAndArchive

**Position:** Nach `archivePlanning` (ca. Zeile 502)

```typescript
const completePlanningAndArchive = async (planningId: string) => {
  const planning = plannings.find(p => p.id === planningId);
  if (planning?.user_id !== user?.id) {
    toast({
      title: "Keine Berechtigung",
      description: "Nur der Ersteller kann diese Planung abschliessen.",
      variant: "destructive",
    });
    return;
  }

  try {
    const { error } = await supabase
      .from("event_plannings")
      .update({ 
        is_archived: true, 
        archived_at: new Date().toISOString(),
        // Optional: Status auf "abgeschlossen" setzen
      })
      .eq("id", planningId)
      .eq("user_id", user?.id);

    if (error) throw error;

    toast({
      title: "Planung abgeschlossen",
      description: "Die Veranstaltungsplanung wurde abgeschlossen und archiviert.",
    });
    
    // Falls Detailansicht offen, zurueck zur Liste
    if (selectedPlanning?.id === planningId) {
      setSelectedPlanning(null);
    }
    
    fetchPlannings();
  } catch (error) {
    console.error('Error completing planning:', error);
    toast({
      title: "Fehler",
      description: "Planung konnte nicht abgeschlossen werden.",
      variant: "destructive",
    });
  }
};
```

### 3. Card-Ansicht: Button hinzufuegen (Veranstaltungsplanungen)

**Position:** Zeilen 2826-2834 (im DropdownMenuContent)

```typescript
<DropdownMenuContent align="end" className="bg-popover">
  <DropdownMenuItem onClick={(e) => {
    e.stopPropagation();
    completePlanningAndArchive(planning.id);
  }}>
    <CheckCircle className="h-4 w-4 mr-2" />
    Abschliessen
  </DropdownMenuItem>
  <DropdownMenuItem onClick={(e) => {
    e.stopPropagation();
    archivePlanning(planning.id);
  }}>
    <Archive className="h-4 w-4 mr-2" />
    Archivieren
  </DropdownMenuItem>
</DropdownMenuContent>
```

### 4. Listen-Ansicht: Button hinzufuegen (Veranstaltungsplanungen)

**Position:** Zeilen 758-763 (im DropdownMenuContent der Tabelle)

```typescript
<DropdownMenuContent align="end" className="bg-popover">
  <DropdownMenuItem onClick={() => completePlanningAndArchive(planning.id)}>
    <CheckCircle className="h-4 w-4 mr-2" />
    Abschliessen
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => archivePlanning(planning.id)}>
    <Archive className="h-4 w-4 mr-2" />
    Archivieren
  </DropdownMenuItem>
</DropdownMenuContent>
```

### 5. Detailansicht: Button hinzufuegen (Veranstaltungsplanungen)

**Position:** Zeilen 3327-3350 (neben Loeschen-Button)

Neuer Button zwischen "+ Mitarbeiter" und "Loeschen":

```typescript
{/* Abschliessen-Button - nur fuer Ersteller */}
{selectedPlanning.user_id === user?.id && (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="outline">
        <CheckCircle className="mr-2 h-4 w-4" />
        Abschliessen
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Planung abschliessen</AlertDialogTitle>
        <AlertDialogDescription>
          Moechten Sie diese Planung abschliessen und archivieren? 
          Die Planung wird ins Archiv verschoben.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <AlertDialogAction onClick={() => completePlanningAndArchive(selectedPlanning!.id)}>
          Abschliessen
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}
```

### 6. Terminplanungen: Dropdown-Menue hinzufuegen

**Neue Funktion:** `completePreparationAndArchive`

```typescript
const completePreparationAndArchive = async (preparationId: string) => {
  try {
    const { error } = await supabase
      .from("appointment_preparations")
      .update({ 
        is_archived: true, 
        archived_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq("id", preparationId);

    if (error) throw error;

    toast({
      title: "Terminplanung abgeschlossen",
      description: "Die Terminplanung wurde abgeschlossen und archiviert.",
    });
    
    fetchAppointmentPreparations();
  } catch (error) {
    console.error('Error completing preparation:', error);
    toast({
      title: "Fehler",
      description: "Terminplanung konnte nicht abgeschlossen werden.",
      variant: "destructive",
    });
  }
};

const archivePreparation = async (preparationId: string) => {
  try {
    const { error } = await supabase
      .from("appointment_preparations")
      .update({ 
        is_archived: true, 
        archived_at: new Date().toISOString()
      })
      .eq("id", preparationId);

    if (error) throw error;

    toast({
      title: "Terminplanung archiviert",
      description: "Die Terminplanung wurde ins Archiv verschoben.",
    });
    
    fetchAppointmentPreparations();
  } catch (error) {
    console.error('Error archiving preparation:', error);
    toast({
      title: "Fehler",
      description: "Terminplanung konnte nicht archiviert werden.",
      variant: "destructive",
    });
  }
};
```

**Card-Ansicht (Zeilen 3015-3049):** Dropdown-Menue hinzufuegen

```typescript
<Card 
  key={preparation.id} 
  className="cursor-pointer hover:shadow-md transition-shadow relative"
>
  <NewItemIndicator isVisible={isItemNew(preparation.id, preparation.created_at)} />
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <span 
        className="truncate cursor-pointer" 
        onClick={() => handlePreparationClick(preparation)}
      >
        {preparation.title}
      </span>
      <div className="flex items-center gap-2">
        <Badge ...>...</Badge>
        {/* NEUES Dropdown-Menue */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              completePreparationAndArchive(preparation.id);
            }}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Abschliessen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              archivePreparation(preparation.id);
            }}>
              <Archive className="h-4 w-4 mr-2" />
              Archivieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3" onClick={() => handlePreparationClick(preparation)}>
    ...
  </CardContent>
</Card>
```

**Listen-Ansicht (Zeilen 780-828):** Spalte mit Dropdown hinzufuegen

Neue Spalte in TableHeader und TableBody fuer das Dropdown-Menue.

---

## Zusammenfassung der Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `EventPlanningView.tsx` | Archiv-Button mit Event-Handling fixen |
| `EventPlanningView.tsx` | Neue Funktion `completePlanningAndArchive` |
| `EventPlanningView.tsx` | Neue Funktionen `completePreparationAndArchive` + `archivePreparation` |
| `EventPlanningView.tsx` | Card-Ansicht (Veranstaltungen): Dropdown erweitern |
| `EventPlanningView.tsx` | Listen-Ansicht (Veranstaltungen): Dropdown erweitern |
| `EventPlanningView.tsx` | Detailansicht (Veranstaltungen): "Abschliessen" Button hinzufuegen |
| `EventPlanningView.tsx` | Card-Ansicht (Terminplanungen): Dropdown hinzufuegen |
| `EventPlanningView.tsx` | Listen-Ansicht (Terminplanungen): Aktions-Spalte hinzufuegen |

---

## Visuelle Darstellung

**Veranstaltungsplanungen - Header:**
```
[Standard-Mitarbeiter] [Archiv] [Grid|List] [+ Neue Planung]
```

**Veranstaltungsplanungen - Card-Dropdown:**
```
[...]
  ✓ Abschliessen
  📁 Archivieren
```

**Veranstaltungsplanungen - Detailansicht:**
```
[+ Mitarbeiter] [✓ Abschliessen] [🗑 Loeschen]
```

**Terminplanungen - Header:**
```
[Grid|List] [Aktive (X)] [Archiv (X)]
```

**Terminplanungen - Card-Dropdown:**
```
[...]
  ✓ Abschliessen
  📁 Archivieren
```
