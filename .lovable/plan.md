
# Plan: Zeiterfassung für Team - 5 Korrekturen

## Zusammenfassung der gefundenen Probleme

### Problem 1: Berechnung der täglichen Arbeitszeit falsch
**Aktuell (Zeile 158, TimeTrackingView.tsx):**
```typescript
const dailyHours = employeeSettings.hours_per_month / employeeSettings.days_per_month
```
**Richtig sollte sein:**
```typescript
const dailyHours = employeeSettings.hours_per_week / employeeSettings.days_per_week
```
Bei 39,5 Stunden und 5 Tagen ergibt das 7,9 Stunden (7 Std. 54 Min.) pro Tag.

### Problem 2: Pause wird nicht von Bruttozeit abgezogen
**Ursache:** Es gibt zwei konkurrierende Datenbank-Trigger:
1. `trg_time_entries_set_minutes` → Berechnet `minutes = Bruttozeit` (ohne Pause)
2. `time_entries_calculate_net` → Sollte `minutes = Bruttozeit - Pause` berechnen

Der erste Trigger überschreibt den zweiten. Aktuelle Daten zeigen:
- `gross_minutes = 570`, `pause_minutes = 30`, aber `minutes = 570` (sollte 540 sein)

### Problem 3: Überstundenabbau/Arzttermine werden als "Sonstiges" angezeigt
**Ursache (Zeile 27+1339, EmployeesView.tsx):**
```typescript
type LeaveType = "vacation" | "sick" | "other"; // Fehlt: medical, overtime_reduction

// Zeile 1340:
{req.type === "vacation" ? "Urlaub" : req.type === "sick" ? "Krank" : "Sonstiges"}
```
Die Typen `medical` und `overtime_reduction` werden nicht erkannt und fallen auf "Sonstiges" zurück.

### Problem 4: "Failed to fetch" bei Ablehnung von Anträgen
**Ursache (Zeile 707-758):** Die `handleLeaveAction` Funktion hat keine Fehlerbehandlung für Netzwerkunterbrechungen, die das resiliente Mutation-Pattern erfordert.

### Problem 5: Abgeordneter kann Zeiteinträge nicht bearbeiten
**Ursache:** 
- RLS-Policies erlauben Admin-Zugriff (`is_admin_of(user_id)`)
- Aber Frontend-Code filtert auf `.eq("user_id", user.id)` (Zeile 399)
- Es fehlt eine Admin-Bearbeitungsfunktion in der UI

---

## Technische Änderungen

### Änderung 1: SQL-Migration - Trigger-Konflikt beheben

Der `trg_time_entries_set_minutes` Trigger muss entfernt werden, da `time_entries_calculate_net` die korrekte Logik hat:

```sql
-- Entferne den alten Trigger der die Bruttozeit berechnet
DROP TRIGGER IF EXISTS trg_time_entries_set_minutes ON public.time_entries;

-- Aktualisiere den ensure_net_minutes Trigger um auch Endzeit-Validierung zu machen
CREATE OR REPLACE FUNCTION public.ensure_net_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    -- Validierung: Endzeit muss nach Startzeit liegen
    IF NEW.ended_at < NEW.started_at THEN
      RAISE EXCEPTION 'ended_at cannot be earlier than started_at';
    END IF;
    -- Berechne Nettozeit = Brutto - Pause
    NEW.minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60) 
                   - COALESCE(NEW.pause_minutes, 0);
  END IF;
  RETURN NEW;
END;
$function$;

-- Korrigiere alle existierenden Einträge (einmalig)
UPDATE time_entries 
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL AND ended_at IS NOT NULL;
```

### Änderung 2: TimeTrackingView.tsx - Tägliche Arbeitszeit korrekt berechnen

**Datei:** `src/components/TimeTrackingView.tsx`
**Zeile 158:**

```typescript
// ALT:
const dailyHours = employeeSettings ? employeeSettings.hours_per_month / employeeSettings.days_per_month : 8;

// NEU:
const dailyHours = employeeSettings ? employeeSettings.hours_per_week / employeeSettings.days_per_week : 7.9;
```

### Änderung 3: EmployeesView.tsx - Antragstypen korrekt anzeigen

**Datei:** `src/components/EmployeesView.tsx`

**Zeile 27 - Type erweitern:**
```typescript
type LeaveType = "vacation" | "sick" | "other" | "medical" | "overtime_reduction";
```

**Zeile 1338-1341 - Anzeige erweitern:**
```tsx
<TableCell>
  <Badge variant="outline" className={
    req.type === "medical" ? "bg-purple-50 text-purple-700 border-purple-200" :
    req.type === "overtime_reduction" ? "bg-amber-50 text-amber-700 border-amber-200" :
    undefined
  }>
    {req.type === "vacation" ? "Urlaub" : 
     req.type === "sick" ? "Krank" : 
     req.type === "medical" ? "🏥 Arzttermin" :
     req.type === "overtime_reduction" ? "⏰ Überstundenabbau" :
     "Sonstiges"}
  </Badge>
</TableCell>
```

**Zeile 376-379 - Aggregation für neue Typen:**
```typescript
const initAgg = (): LeaveAgg => ({
  counts: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
  approved: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
  pending: { vacation: 0, sick: 0, other: 0, medical: 0, overtime_reduction: 0 },
  lastDates: {},
});
```

### Änderung 4: EmployeesView.tsx - Resilientes Mutation-Pattern für Anträge

**Datei:** `src/components/EmployeesView.tsx`
**Zeilen 707-758:**

```typescript
const handleLeaveAction = async (leaveId: string, action: "approved" | "rejected") => {
  const leaveRequest = pendingLeaves.find(req => req.id === leaveId);
  
  // Optimistic update
  const previousLeaves = [...pendingLeaves];
  setPendingLeaves(prev => prev.filter(l => l.id !== leaveId));
  
  try {
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: action })
      .eq("id", leaveId);

    if (error) throw error;

    if (leaveRequest && action === "approved") {
      await createVacationCalendarEntry(leaveRequest, leaveRequest.user_id);
    } else if (leaveRequest && action === "rejected") {
      // Kalendereintrag löschen bei Ablehnung
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", leaveRequest.user_id)
        .single();
      
      const userName = userProfile?.display_name || "Mitarbeiter";
      await supabase
        .from("appointments")
        .delete()
        .eq("title", `Anfrage Urlaub von ${userName}`)
        .eq("start_time", new Date(leaveRequest.start_date).toISOString())
        .eq("category", "vacation_request");
    }

    toast({
      title: action === "approved" ? "Antrag genehmigt" : "Antrag abgelehnt",
    });
    
    // Reload data ohne page reload
    loadData();
  } catch (error: any) {
    // "Failed to fetch" Handling - Netzwerk-Problem
    if (error?.message?.includes('Failed to fetch')) {
      // Warte kurz und prüfe den tatsächlichen Status
      await new Promise(r => setTimeout(r, 500));
      const { data: checkData } = await supabase
        .from("leave_requests")
        .select("status")
        .eq("id", leaveId)
        .single();
      
      if (checkData?.status === action) {
        // Operation war erfolgreich
        toast({ title: action === "approved" ? "Antrag genehmigt" : "Antrag abgelehnt" });
        loadData();
        return;
      }
    }
    
    // Rollback bei echtem Fehler
    setPendingLeaves(previousLeaves);
    toast({
      title: "Fehler",
      description: error?.message ?? "Antrag konnte nicht aktualisiert werden.",
      variant: "destructive",
    });
  }
};
```

### Änderung 5: time_entries Tabelle - Spalte für Admin-Bearbeitung hinzufügen

**SQL-Migration:**
```sql
-- Spalten für Admin-Bearbeitung
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at timestamptz,
ADD COLUMN IF NOT EXISTS edit_reason text;

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_time_entries_edited_by ON time_entries(edited_by) WHERE edited_by IS NOT NULL;
```

### Änderung 6: TimeTrackingView.tsx - Admin-Bearbeitungsfunktion

**Neue Funktion und UI-Erweiterung:**

```typescript
// Neue Prop für Admin-Modus
interface TimeTrackingViewProps {
  userId?: string; // Falls als Admin für anderen User angezeigt
  isAdminView?: boolean;
}

// Neue Funktion für Admin-Update (nach handleUpdateEntry)
const handleAdminUpdateEntry = async (entryId: string, entryData: {
  work_date: string;
  started_at: string;
  ended_at: string;
  pause_minutes: number;
  notes: string;
  edit_reason: string;
}) => {
  if (!user) return;
  
  const start = new Date(`${entryData.work_date}T${entryData.started_at}`);
  const end = new Date(`${entryData.work_date}T${entryData.ended_at}`);
  
  if (end <= start) {
    toast.error("Endzeit muss nach Startzeit liegen");
    return;
  }
  
  const gross = Math.round((end.getTime() - start.getTime()) / 60000);
  
  try {
    const { error } = await supabase
      .from("time_entries")
      .update({
        work_date: entryData.work_date,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        pause_minutes: entryData.pause_minutes,
        notes: entryData.notes,
        edited_by: user.id,
        edited_at: new Date().toISOString(),
        edit_reason: entryData.edit_reason,
      })
      .eq("id", entryId);
      // KEIN .eq("user_id", user.id) - RLS prüft is_admin_of()

    if (error) throw error;
    
    toast.success("Eintrag vom Administrator bearbeitet");
    loadData();
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

**UI-Erweiterung in der Tabelle:**
```tsx
// Neue Spalte in TableHeader
<TableHead>Bearbeitet von</TableHead>

// Neue Zelle in TableRow (nach Notizen)
<TableCell>
  {entry.edited_by && entry.edited_at && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            ✏️ Bearbeitet
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Bearbeitet am {format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}</p>
          {entry.edit_reason && <p>Grund: {entry.edit_reason}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
</TableCell>
```

### Änderung 7: Neue Komponente AdminTimeEntryEditor

**Neue Datei:** `src/components/AdminTimeEntryEditor.tsx`

Diese Komponente ermöglicht dem Abgeordneten, Zeiteinträge anderer Mitarbeiter zu bearbeiten:

```typescript
interface AdminTimeEntryEditorProps {
  entry: TimeEntryRow & { 
    user_name: string;
    edited_by?: string;
    edited_at?: string;
    edit_reason?: string;
  };
  onSave: (data: AdminEditData) => Promise<void>;
  onClose: () => void;
}

// Dialog mit:
// - Anzeige des Mitarbeiternamens
// - Bearbeitungsfelder (Datum, Start, Ende, Pause, Notizen)
// - Pflichtfeld "Grund der Änderung"
// - Hinweis "Diese Änderung wird protokolliert"
```

---

## Zusammenfassung der Änderungen

| # | Datei/Ressource | Problem | Lösung |
|---|-----------------|---------|--------|
| 1 | SQL-Migration | Zwei Trigger-Konflikte | Alten Trigger löschen, korrekten Trigger behalten |
| 2 | `TimeTrackingView.tsx` | dailyHours falsch berechnet | `hours_per_week / days_per_week` verwenden |
| 3 | `EmployeesView.tsx` | medical/overtime_reduction als "Sonstiges" | LeaveType erweitern, Labels anpassen |
| 4 | `EmployeesView.tsx` | "Failed to fetch" Fehler | Resilientes Mutation-Pattern implementieren |
| 5 | SQL-Migration | Admin-Bearbeitung nicht nachvollziehbar | Spalten `edited_by`, `edited_at`, `edit_reason` hinzufügen |
| 6 | `TimeTrackingView.tsx` | Admin kann nicht bearbeiten | `handleAdminUpdateEntry` ohne user_id Filter |
| 7 | Neue Komponente | UI für Admin-Bearbeitung | `AdminTimeEntryEditor.tsx` erstellen |

---

## Erwartete Ergebnisse

1. **Tägliche Arbeitszeit:** Bei 39,5h/Woche und 5 Tagen = 7,9h (7:54) pro Tag
2. **Nettozeit:** Pause wird korrekt abgezogen (z.B. 9:30 Brutto - 0:30 Pause = 9:00 Netto)
3. **Antragstypen:** "🏥 Arzttermin" und "⏰ Überstundenabbau" werden deutlich angezeigt
4. **Ablehnung:** Keine "Failed to fetch" Fehler mehr, optimistisches Update mit Rollback
5. **Admin-Bearbeitung:** Abgeordneter kann alle Einträge bearbeiten, Änderungen werden protokolliert und für den Mitarbeiter sichtbar markiert
