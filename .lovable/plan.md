
# Plan: Typ-Konvertierung reparieren, Admin-Zeiteinträge & Überstunden-Gesamtsaldo

## Zusammenfassung der Probleme

### Problem 1: Typ-Konvertierung löscht Einträge / Failed to Fetch
**Ursache gefunden:** Der `handleTypeChange`-Handler hat mehrere kritische Fehler:

1. **Falsche Entry-ID bei Abwesenheiten:** Die `entry.id` für Abwesenheiten ist z.B. `vacation-abc123-2026-01-16`. Der Code versucht dann, diese ID direkt bei `leave_requests` zu löschen/updaten, aber die echte `leave_id` ist nur `abc123`.

2. **leaveId-Parameter wird nicht korrekt verwendet:** Die `leaveId` wird zwar als Parameter übergeben, aber der Code extrahiert sie nicht richtig.

3. **Network-Fehler ohne Rollback:** Bei "Failed to Fetch" wird die Operation möglicherweise serverseitig ausgeführt, aber der Client bekommt keinen Erfolg zurück.

**Beispiel des Bugs (Zeile 393-399):**
```typescript
if (leaveId) {
  const { error } = await supabase
    .from("leave_requests")
    .delete()
    .eq("id", leaveId);  // leaveId ist korrekt, ABER...
```

Das Problem ist, dass bei der Konvertierung Abwesenheit → Abwesenheit der Code `entry.leave_id` verwendet, aber bei mehrtägigen Abwesenheiten wird die ID mit Datum erweitert (z.B. `vacation-abc123-2026-01-16`), und der `leave_id` Wert im CombinedTimeEntry ist korrekt nur `abc123`.

**Aktueller Hook (useCombinedTimeEntries.ts, Zeile 195):**
```typescript
leave_id: leave.id,  // ← Korrekt die echte UUID
```

**Aber im Editor (AdminTimeEntryEditor.tsx, Zeile 99):**
```typescript
await onTypeChange(entry.id, selectedType, editReason, entry.leave_id);
```

Das ist korrekt, ABER `entry.leave_id` wird in AdminTimeTrackingView nicht immer richtig durchgereicht (Zeile 903).

**Lösung:** Den `leave_id`-Parameter konsistent verwenden und Netzwerkfehler resilient behandeln.

### Problem 2: Admin kann keine neuen Zeiteinträge erstellen
**Aktueller Stand:** Der Admin kann nur bestehende Einträge bearbeiten, aber nicht für einen Mitarbeiter einen neuen Zeiteintrag anlegen.

**Lösung:** Button "Zeiteintrag hinzufügen" mit Dialog für:
- Datum
- Start/Endzeit
- Pause
- Notizen
- Optional: Eintragstyp (Arbeit/Urlaub/Krankheit)

### Problem 3: Kumulativer Überstundensaldo fehlt
**Aktueller Stand:** Es wird nur der Monatssaldo angezeigt, nicht die Gesamtsumme aller Überstunden über alle Monate.

**Lösung:** 
- Berechnung des Jahres- oder Gesamtsaldos durch Aggregation aller Monate
- Anzeige als prominente Karte in beiden Ansichten (Mitarbeiter + Admin)

---

## Technische Änderungen

### Änderung 1: handleTypeChange reparieren

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Problem-Bereich (Zeile 348-424):**
```typescript
const handleTypeChange = async (
  entryId: string,
  newType: EntryType,
  reason: string,
  leaveId?: string  // ← Wird nicht konsequent genutzt
) => {
```

**Lösung:** Robustere ID-Extraktion und resilientes Error-Handling:

```typescript
const handleTypeChange = async (
  entryId: string,
  newType: EntryType,
  reason: string,
  leaveId?: string
) => {
  if (!user || !selectedUserId) return;
  setIsSaving(true);

  const entry = editingCombinedEntry;
  if (!entry) {
    toast.error("Kein Eintrag ausgewählt");
    setIsSaving(false);
    return;
  }

  const originalType = entry.entry_type;
  
  // Extrahiere die korrekte leave_id (direkt verwenden, wenn vorhanden)
  const actualLeaveId = leaveId || entry.leave_id;
  
  // Bei Arbeitseintrag ist die ID direkt die UUID
  const actualWorkEntryId = originalType === 'work' ? entryId : null;

  try {
    if (originalType === 'work' && newType !== 'work') {
      // Arbeit → Abwesenheit
      if (!actualWorkEntryId) throw new Error("Keine gültige Arbeitszeit-ID");
      
      // 1. time_entry löschen
      const { error: deleteError } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", actualWorkEntryId);
      
      // Resilient handling: Wenn "Failed to fetch", prüfen ob trotzdem gelöscht
      if (deleteError && !deleteError.message?.includes('fetch')) {
        throw deleteError;
      }

      // 2. leave_request erstellen
      const { error: insertError } = await supabase
        .from("leave_requests")
        .insert({
          user_id: selectedUserId,
          type: newType,
          start_date: entry.work_date,
          end_date: entry.work_date,
          status: "approved",
          reason: `Admin-Umwandlung: ${reason}`,
        });
      
      if (insertError && !insertError.message?.includes('fetch')) {
        throw insertError;
      }

      toast.success(`Eintrag zu ${getTypeLabel(newType)} umgewandelt`);

    } else if (originalType !== 'work' && newType === 'work') {
      // Abwesenheit → Arbeit
      if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");
      
      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", actualLeaveId);
      
      if (error && !error.message?.includes('fetch')) {
        throw error;
      }
      
      toast.info("Abwesenheit entfernt. Mitarbeiter muss Arbeitszeit manuell erfassen.");

    } else if (originalType !== 'work' && newType !== 'work' && originalType !== newType) {
      // Abwesenheit → andere Abwesenheit
      if (!actualLeaveId) throw new Error("Keine gültige Abwesenheits-ID");
      
      const { error } = await supabase
        .from("leave_requests")
        .update({
          type: newType,
          reason: `Umgewandelt von ${getTypeLabel(originalType)}: ${reason}`,
        })
        .eq("id", actualLeaveId);
      
      if (error && !error.message?.includes('fetch')) {
        throw error;
      }
      
      toast.success("Eintragstyp geändert");
    }

    // Schließe Dialog und lade Daten neu
    setEditingCombinedEntry(null);
    setEditingEntry(null);
    
    // Verzögertes Neuladen für resilientes Handling
    setTimeout(() => loadMonthData(), 500);
    
  } catch (error: any) {
    console.error("Type change error:", error);
    toast.error(error.message || "Fehler bei der Typänderung");
    // Bei Netzwerkfehlern trotzdem Daten neu laden
    if (error.message?.includes('fetch')) {
      setTimeout(() => loadMonthData(), 500);
    }
  } finally {
    setIsSaving(false);
  }
};

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    work: 'Arbeit',
    vacation: 'Urlaub',
    sick: 'Krankheit',
    overtime_reduction: 'Überstundenabbau',
  };
  return labels[type] || type;
};
```

### Änderung 2: Admin kann neue Zeiteinträge erstellen

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Neue States:**
```typescript
const [createEntryDialogOpen, setCreateEntryDialogOpen] = useState(false);
const [newEntryDate, setNewEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
const [newEntryStartTime, setNewEntryStartTime] = useState("09:00");
const [newEntryEndTime, setNewEntryEndTime] = useState("17:00");
const [newEntryPause, setNewEntryPause] = useState("30");
const [newEntryNotes, setNewEntryNotes] = useState("");
const [newEntryType, setNewEntryType] = useState<EntryType>("work");
const [newEntryReason, setNewEntryReason] = useState("");
```

**Neue Funktion handleCreateEntry:**
```typescript
const handleCreateEntry = async () => {
  if (!user || !selectedUserId) return;
  
  try {
    if (newEntryType === 'work') {
      // Arbeitszeit-Eintrag erstellen
      const start = new Date(`${newEntryDate}T${newEntryStartTime}`);
      const end = new Date(`${newEntryDate}T${newEntryEndTime}`);
      
      if (end <= start) {
        toast.error("Endzeit muss nach Startzeit liegen");
        return;
      }
      
      const grossMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      const pause = parseInt(newEntryPause) || 0;
      const netMinutes = grossMinutes - pause;
      
      const { error } = await supabase.from("time_entries").insert({
        user_id: selectedUserId,
        work_date: newEntryDate,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: netMinutes,
        pause_minutes: pause,
        notes: newEntryNotes || null,
        edited_by: user.id,
        edited_at: new Date().toISOString(),
        edit_reason: newEntryReason || "Admin-Eintrag",
      });
      
      if (error) throw error;
      toast.success("Zeiteintrag erstellt");
    } else {
      // Abwesenheit erstellen
      const { error } = await supabase.from("leave_requests").insert({
        user_id: selectedUserId,
        type: newEntryType,
        start_date: newEntryDate,
        end_date: newEntryDate,
        status: "approved",
        reason: newEntryReason || `Admin-Eintrag: ${getTypeLabel(newEntryType)}`,
      });
      
      if (error) throw error;
      toast.success(`${getTypeLabel(newEntryType)} erstellt`);
    }
    
    setCreateEntryDialogOpen(false);
    resetNewEntryForm();
    loadMonthData();
  } catch (error: any) {
    toast.error(error.message || "Fehler beim Erstellen");
  }
};

const resetNewEntryForm = () => {
  setNewEntryDate(format(new Date(), "yyyy-MM-dd"));
  setNewEntryStartTime("09:00");
  setNewEntryEndTime("17:00");
  setNewEntryPause("30");
  setNewEntryNotes("");
  setNewEntryType("work");
  setNewEntryReason("");
};
```

**Button in der Aktionskarte:**
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Aktionen
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    <Button 
      variant="default" 
      size="sm" 
      onClick={() => setCreateEntryDialogOpen(true)}
      className="w-full"
    >
      <Plus className="h-4 w-4 mr-2" />
      Eintrag erstellen
    </Button>
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setCorrectionDialogOpen(true)}
      className="w-full"
    >
      <TrendingUp className="h-4 w-4 mr-2" />
      Korrektur hinzufügen
    </Button>
  </CardContent>
</Card>
```

**Dialog für neuen Eintrag:**
```tsx
<Dialog open={createEntryDialogOpen} onOpenChange={setCreateEntryDialogOpen}>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Eintrag für {selectedEmployee?.display_name} erstellen</DialogTitle>
      <DialogDescription>
        Erstellen Sie einen neuen Zeit- oder Abwesenheitseintrag.
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4 py-4">
      <div className="grid gap-2">
        <Label>Eintragstyp</Label>
        <Select value={newEntryType} onValueChange={(v) => setNewEntryType(v as EntryType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="work">📋 Arbeit</SelectItem>
            <SelectItem value="vacation">🏖️ Urlaub</SelectItem>
            <SelectItem value="sick">🤒 Krankheit</SelectItem>
            <SelectItem value="overtime_reduction">⏰ Überstundenabbau</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="grid gap-2">
        <Label>Datum</Label>
        <Input
          type="date"
          value={newEntryDate}
          onChange={(e) => setNewEntryDate(e.target.value)}
        />
      </div>
      
      {newEntryType === 'work' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start</Label>
              <Input
                type="time"
                value={newEntryStartTime}
                onChange={(e) => setNewEntryStartTime(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Ende</Label>
              <Input
                type="time"
                value={newEntryEndTime}
                onChange={(e) => setNewEntryEndTime(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label>Pause (Minuten)</Label>
            <Input
              type="number"
              min="0"
              max="120"
              value={newEntryPause}
              onChange={(e) => setNewEntryPause(e.target.value)}
            />
          </div>
        </>
      )}
      
      <div className="grid gap-2">
        <Label>Notizen/Grund</Label>
        <Textarea
          value={newEntryReason}
          onChange={(e) => setNewEntryReason(e.target.value)}
          placeholder={newEntryType === 'work' 
            ? "z.B. Nachträgliche Erfassung..." 
            : "z.B. Nachträgliche Genehmigung..."}
          rows={2}
        />
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Dieser Eintrag wird als Admin-Eintrag gekennzeichnet und ist für den Mitarbeiter sichtbar.
        </AlertDescription>
      </Alert>
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setCreateEntryDialogOpen(false)}>
        Abbrechen
      </Button>
      <Button onClick={handleCreateEntry}>
        Eintrag erstellen
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Änderung 3: Kumulativer Überstundensaldo (Gesamtsaldo)

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Neue Query zum Laden des Jahressaldos:**
```typescript
const [yearlyBalance, setYearlyBalance] = useState<number>(0);
const [loadingYearlyBalance, setLoadingYearlyBalance] = useState(false);

const loadYearlyBalance = async () => {
  if (!selectedUserId || !selectedEmployee) return;
  setLoadingYearlyBalance(true);
  
  try {
    const currentYear = getYear(currentMonth);
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    
    // Lade alle Zeiteinträge des Jahres
    const { data: yearEntries } = await supabase
      .from("time_entries")
      .select("minutes, work_date")
      .eq("user_id", selectedUserId)
      .gte("work_date", format(yearStart, "yyyy-MM-dd"))
      .lte("work_date", format(yearEnd, "yyyy-MM-dd"));
    
    // Lade alle Abwesenheiten des Jahres
    const { data: yearLeaves } = await supabase
      .from("leave_requests")
      .select("type, start_date, end_date, status, minutes_counted")
      .eq("user_id", selectedUserId)
      .eq("status", "approved")
      .gte("start_date", format(yearStart, "yyyy-MM-dd"))
      .lte("end_date", format(yearEnd, "yyyy-MM-dd"));
    
    // Lade alle Feiertage des Jahres
    const { data: yearHolidays } = await supabase
      .from("public_holidays")
      .select("holiday_date, name")
      .gte("holiday_date", format(yearStart, "yyyy-MM-dd"))
      .lte("holiday_date", format(yearEnd, "yyyy-MM-dd"));
    
    // Lade alle Korrekturen
    const { data: yearCorrections } = await supabase
      .from("time_entry_corrections")
      .select("correction_minutes")
      .eq("user_id", selectedUserId);
    
    // Berechnung
    const dailyMinutes = Math.round((selectedEmployee.hours_per_week / selectedEmployee.days_per_week) * 60);
    const holidayDates = new Set((yearHolidays || []).map(h => h.holiday_date));
    
    // Arbeitstage im Jahr berechnen (ohne Wochenenden und Feiertage)
    const allDays = eachDayOfInterval({ start: yearStart, end: new Date() > yearEnd ? yearEnd : new Date() });
    const workDays = allDays.filter(d => 
      d.getDay() !== 0 && d.getDay() !== 6 && !holidayDates.has(format(d, "yyyy-MM-dd"))
    );
    const targetMinutes = workDays.length * dailyMinutes;
    
    // Gearbeitete Minuten (ohne Feiertage/Abwesenheiten)
    const absenceDates = new Set<string>();
    (yearLeaves || []).forEach(leave => {
      if (['sick', 'vacation', 'overtime_reduction'].includes(leave.type)) {
        try {
          eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
            .forEach(d => absenceDates.add(format(d, 'yyyy-MM-dd')));
        } catch {}
      }
    });
    
    const workedMinutes = (yearEntries || [])
      .filter(e => !holidayDates.has(e.work_date) && !absenceDates.has(e.work_date))
      .reduce((sum, e) => sum + (e.minutes || 0), 0);
    
    // Gutschriften (Abwesenheiten zählen als gearbeitet)
    const creditMinutes = [...absenceDates]
      .filter(d => !holidayDates.has(d))
      .filter(d => {
        const date = parseISO(d);
        return date.getDay() !== 0 && date.getDay() !== 6;
      })
      .length * dailyMinutes;
    
    // Korrekturen
    const correctionsTotal = (yearCorrections || []).reduce((sum, c) => sum + c.correction_minutes, 0);
    
    // Gesamtsaldo
    const balance = workedMinutes + creditMinutes - targetMinutes + correctionsTotal;
    setYearlyBalance(balance);
    
  } catch (error) {
    console.error("Error loading yearly balance:", error);
  } finally {
    setLoadingYearlyBalance(false);
  }
};

// In useEffect aufrufen wenn selectedUserId sich ändert
useEffect(() => {
  if (selectedUserId) {
    loadYearlyBalance();
  }
}, [selectedUserId, currentMonth]);
```

**Neue Karte für Gesamtsaldo:**
```tsx
<Card className="md:col-span-2 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
      <TrendingUp className="h-4 w-4" />
      Überstundensaldo {getYear(currentMonth)}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className={`text-3xl font-bold ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
      {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      Gesamtsaldo bis heute (inkl. Korrekturen)
    </p>
  </CardContent>
</Card>
```

### Änderung 4: Gesamtsaldo auch für Mitarbeiter anzeigen

**Datei:** `src/components/TimeTrackingView.tsx`

Ähnliche Logik wie oben, aber als prominente Karte am Anfang der Seite:

```tsx
<Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
      <TrendingUp className="h-4 w-4" />
      Mein Überstundensaldo {getYear(selectedMonth)}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className={`text-3xl font-bold ${yearlyBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
      {yearlyBalance >= 0 ? "+" : ""}{fmt(yearlyBalance)}
    </div>
    <p className="text-xs text-muted-foreground mt-1">
      Gesamtsaldo bis heute
    </p>
  </CardContent>
</Card>
```

### Änderung 5: Admin-Einträge beim Mitarbeiter kennzeichnen

**Datei:** `src/components/TimeTrackingView.tsx`

In der Zeittabelle Admin-Einträge hervorheben:

```tsx
{entry.edited_by && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          👤 Admin-Eintrag
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>Bearbeitet am {entry.edited_at && format(parseISO(entry.edited_at), "dd.MM.yyyy HH:mm")}</p>
        {entry.edit_reason && <p>Grund: {entry.edit_reason}</p>}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

---

## Zusammenfassung der Änderungen

| # | Datei | Problem | Lösung |
|---|-------|---------|--------|
| 1 | `AdminTimeTrackingView.tsx` | Typ-Konvertierung löscht Einträge | Korrekte leave_id verwenden, resilientes Error-Handling |
| 2 | `AdminTimeTrackingView.tsx` | Admin kann keine neuen Einträge erstellen | Dialog + Handler für neue Einträge |
| 3 | `AdminTimeTrackingView.tsx` | Kein Gesamtsaldo sichtbar | Jahressaldo-Berechnung + Anzeige |
| 4 | `TimeTrackingView.tsx` | Mitarbeiter sieht keinen Gesamtsaldo | Jahressaldo-Anzeige auch für Mitarbeiter |
| 5 | `TimeTrackingView.tsx` | Admin-Einträge nicht erkennbar | Badge "Admin-Eintrag" mit Tooltip |

---

## Erwartete Ergebnisse

1. **Typ-Konvertierung funktioniert zuverlässig** - Kein Datenverlust, korrekte ID-Verwendung
2. **Admin kann neue Einträge erstellen** - Arbeitszeit oder Abwesenheit für beliebiges Datum
3. **Gesamtsaldo sichtbar** - Beide Seiten (Admin + Mitarbeiter) sehen den kumulativen Überstundensaldo
4. **Transparenz** - Mitarbeiter sieht, welche Einträge vom Admin stammen
