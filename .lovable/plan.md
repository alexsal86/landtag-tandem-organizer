
# Plan: Zeiterfassung - 8 Verbesserungen

## Übersicht der Anforderungen

| # | Anforderung | Lösung |
|---|-------------|--------|
| 1 | Pausenzeiten werden nicht abgezogen (Netto = Brutto) | Bestehende Einträge korrigieren + DB-Trigger für automatische Berechnung |
| 2 | Fehlermeldungen beim Löschen/Bearbeiten | Fehlerbehandlung verbessern, RLS prüfen |
| 3 | Krankheitstage in Zeiteinträge-Liste | Automatische Pseudo-Einträge für genehmigte Krankmeldungen anzeigen |
| 4 | Urlaubstage in Zeiteinträge-Liste | Automatische Pseudo-Einträge für genehmigte Urlaubstage anzeigen |
| 5 | Feiertage wie Kranktage/Urlaubstage behandeln | Feiertage als besondere Einträge anzeigen + API für zuverlässige Daten |
| 6 | Soll/Ist Vergleich: max. 2 Nachkommastellen | `fmt`-Funktion anpassen (bereits korrekt mit Minuten, aber Stunden-Dezimal prüfen) |
| 7 | Arzttermine als Arbeitszeit | Neuer `leave_type` "medical" + Workflow mit Benachrichtigung |
| 8 | Überstundenabbau statt Urlaub | Neuer `leave_type` "overtime_reduction" + Verrechnung mit Mehrstunden |

---

## 1. Pausenzeiten werden nicht abgezogen

**Problem-Analyse:**
Die Datenbank zeigt, dass viele Einträge `minutes = calculated_gross` haben (504 statt 474 bei 30 Min Pause). Der Code in Zeile 205 speichert zwar `minutes: gross - pause`, aber offenbar wurden ältere Einträge falsch gespeichert oder die Bearbeitung zieht die Pause nicht korrekt ab.

**Ursache in handleUpdateEntry (Zeile 252-258):**
```typescript
.update({
  work_date: entryDate,
  started_at: start.toISOString(),
  ended_at: end.toISOString(),
  minutes: gross - pause,  // ← korrekt
  pause_minutes: pause,
  notes: notes || null,
})
```

Der Code sieht korrekt aus. Das Problem könnte sein, dass die Einträge über eine andere Methode erstellt wurden oder die Pause-Minuten bei der Erstellung nicht richtig übergeben wurden.

**Lösung:**

### A. Einmalige Korrektur bestehender Daten (SQL-Migration)
```sql
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL
  AND minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60);
```

### B. Database Trigger für zukünftige Sicherheit
```sql
CREATE OR REPLACE FUNCTION ensure_net_minutes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    NEW.minutes := ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60) 
                   - COALESCE(NEW.pause_minutes, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_entries_calculate_net
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION ensure_net_minutes();
```

---

## 2. Fehlermeldungen bei Löschen/Bearbeiten

**Problem-Analyse:**
Die RLS-Policies sehen korrekt aus:
- `time_entries_delete_scoped`: `auth.uid() = user_id OR is_admin_of(user_id)`
- `time_entries_update_scoped`: gleich

**Mögliche Ursachen:**
1. Der User ist nicht korrekt authentifiziert
2. Die `is_admin_of` Funktion hat ein Problem
3. Es fehlt ein `.select()` nach Update/Delete für bessere Fehlerbehandlung

**Lösung in TimeTrackingView.tsx:**

```typescript
const handleDeleteEntry = async (entryId: string) => {
  if (!window.confirm("Eintrag wirklich löschen?")) return;

  try {
    // Wichtig: .select() hinzufügen für RLS-Validierung
    const { data, error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user!.id)
      .select();

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.warning("Eintrag wurde möglicherweise bereits gelöscht");
    } else {
      toast.success("Eintrag gelöscht");
    }
    
    loadData();
  } catch (error: any) {
    console.error("Delete error:", error);
    toast.error("Fehler beim Löschen: " + error.message);
  }
};

const handleUpdateEntry = async () => {
  // ... validation ...
  
  try {
    await validateDailyLimit(entryDate, gross, editingEntry.id);

    const { data, error } = await supabase
      .from("time_entries")
      .update({
        work_date: entryDate,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        minutes: gross - pause,
        pause_minutes: pause,
        notes: notes || null,
      })
      .eq("id", editingEntry.id)
      .eq("user_id", user.id)
      .select();  // ← Wichtig!

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.error("Keine Berechtigung zum Bearbeiten dieses Eintrags");
      return;
    }

    toast.success("Eintrag aktualisiert");
    // ... reset state ...
  } catch (error: any) {
    console.error("Update error:", error);
    toast.error("Fehler: " + error.message);
  }
};
```

---

## 3 + 4. Krankheitstage und Urlaubstage in Zeiteinträge-Liste

**Konzept:**
Genehmigte Krankmeldungen und Urlaubstage sollen in der Zeiteinträge-Tabelle als "virtuelle Einträge" erscheinen, aber:
- Nicht löschbar
- Nur Notizen bearbeitbar
- Mit dem Netto-Stundensatz eines Arbeitstages berechnet

**Implementierung:**

### A. Erweiterte Datenstruktur
```typescript
interface CombinedTimeEntry {
  id: string;
  work_date: string;
  started_at: string | null;
  ended_at: string | null;
  minutes: number | null;
  pause_minutes?: number;
  notes: string | null;
  entry_type: 'work' | 'sick' | 'vacation' | 'holiday' | 'medical' | 'overtime_reduction';
  is_editable: boolean;
  is_deletable: boolean;
  leave_id?: string; // Referenz zur leave_requests Tabelle
  holiday_id?: string; // Referenz zur public_holidays Tabelle
}
```

### B. Laden der kombinierten Einträge
```typescript
const loadData = async () => {
  // ... existing queries ...
  
  // Dann: Kombinierte Liste erstellen
  const combinedEntries: CombinedTimeEntry[] = [];
  
  // 1. Reguläre Zeiteinträge
  entries.forEach(e => combinedEntries.push({
    ...e,
    entry_type: 'work',
    is_editable: true,
    is_deletable: true,
  }));
  
  // 2. Genehmigte Krankheitstage im aktuellen Monat
  sickLeaves.filter(l => l.status === 'approved').forEach(leave => {
    eachDayOfInterval({ 
      start: parseISO(leave.start_date), 
      end: parseISO(leave.end_date) 
    })
    .filter(d => d >= monthStart && d <= monthEnd)
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6) // nur Werktage
    .forEach(day => {
      combinedEntries.push({
        id: `sick-${leave.id}-${format(day, 'yyyy-MM-dd')}`,
        work_date: format(day, 'yyyy-MM-dd'),
        started_at: null,
        ended_at: null,
        minutes: Math.round(dailyHours * 60),
        pause_minutes: 0,
        notes: leave.reason || 'Krankheit',
        entry_type: 'sick',
        is_editable: true, // Nur notes
        is_deletable: false,
        leave_id: leave.id,
      });
    });
  });
  
  // 3. Genehmigte Urlaubstage (ähnlich)
  // 4. Feiertage im Monat
  // 5. Arzttermine (wenn implementiert)
  // 6. Überstundenabbau (wenn implementiert)
  
  // Sortieren nach Datum
  combinedEntries.sort((a, b) => 
    new Date(b.work_date).getTime() - new Date(a.work_date).getTime()
  );
  
  setCombinedEntries(combinedEntries);
};
```

### C. UI-Anpassung in der Tabelle
```typescript
<TableBody>
  {combinedEntries.map(entry => {
    const gross = entry.started_at && entry.ended_at 
      ? Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000)
      : entry.minutes || 0;
    
    const typeConfig = {
      work: { icon: null, label: null, className: '' },
      sick: { icon: '🤒', label: 'Krankheit', className: 'bg-orange-50' },
      vacation: { icon: '🏖️', label: 'Urlaub', className: 'bg-blue-50' },
      holiday: { icon: '🎉', label: 'Feiertag', className: 'bg-green-50' },
      medical: { icon: '🏥', label: 'Arzttermin', className: 'bg-purple-50' },
      overtime_reduction: { icon: '⏰', label: 'Überstundenabbau', className: 'bg-amber-50' },
    };
    
    const config = typeConfig[entry.entry_type];
    
    return (
      <TableRow key={entry.id} className={config.className}>
        <TableCell>
          {config.icon && <span className="mr-1">{config.icon}</span>}
          {format(parseISO(entry.work_date), "dd.MM.yyyy")}
        </TableCell>
        <TableCell>
          {entry.started_at ? format(parseISO(entry.started_at), "HH:mm") : "-"}
        </TableCell>
        <TableCell>
          {entry.ended_at ? format(parseISO(entry.ended_at), "HH:mm") : "-"}
        </TableCell>
        <TableCell>{entry.pause_minutes || 0} Min</TableCell>
        <TableCell>{fmt(gross)}</TableCell>
        <TableCell>{fmt(entry.minutes || 0)}</TableCell>
        <TableCell>
          {config.label && <Badge variant="outline" className="mr-1">{config.label}</Badge>}
          {entry.notes || "-"}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {entry.is_editable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => entry.entry_type === 'work' 
                  ? handleEditEntry(entry) 
                  : handleEditLeaveNotes(entry)}
                title="Bearbeiten"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {entry.is_deletable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteEntry(entry.id)}
                title="Löschen"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  })}
</TableBody>
```

---

## 5. Feiertage zuverlässig ermitteln

**Problem:** Die `public_holidays` Tabelle hat nur Daten für 2025. Es fehlen Feiertage für 2026 und Baden-Württemberg-spezifische Feiertage.

**Lösung A: Manuelle Datenpflege (einfach)**
- Admin-Oberfläche zum Hinzufügen von Feiertagen
- Jährliche Wartung erforderlich

**Lösung B: Edge Function mit Feiertags-API (empfohlen)**

```typescript
// supabase/functions/sync-holidays/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Feiertage für Deutschland (bundesweit + Baden-Württemberg)
function calculateGermanHolidays(year: number) {
  // Ostersonntag berechnen (Gauß-Algorithmus)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return [
    // Bundesweite Feiertage
    { date: `${year}-01-01`, name: 'Neujahr', is_nationwide: true },
    { date: formatDate(addDays(easter, -2)), name: 'Karfreitag', is_nationwide: true },
    { date: formatDate(addDays(easter, 1)), name: 'Ostermontag', is_nationwide: true },
    { date: `${year}-05-01`, name: 'Tag der Arbeit', is_nationwide: true },
    { date: formatDate(addDays(easter, 39)), name: 'Christi Himmelfahrt', is_nationwide: true },
    { date: formatDate(addDays(easter, 50)), name: 'Pfingstmontag', is_nationwide: true },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit', is_nationwide: true },
    { date: `${year}-12-25`, name: 'Erster Weihnachtstag', is_nationwide: true },
    { date: `${year}-12-26`, name: 'Zweiter Weihnachtstag', is_nationwide: true },
    // Baden-Württemberg spezifisch
    { date: `${year}-01-06`, name: 'Heilige Drei Könige', is_nationwide: false, state: 'BW' },
    { date: formatDate(addDays(easter, 60)), name: 'Fronleichnam', is_nationwide: false, state: 'BW' },
    { date: `${year}-11-01`, name: 'Allerheiligen', is_nationwide: false, state: 'BW' },
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { year } = await req.json();
  const holidays = calculateGermanHolidays(year);

  // Upsert holidays
  const { error } = await supabase
    .from('public_holidays')
    .upsert(
      holidays.map(h => ({
        holiday_date: h.date,
        name: h.name,
        is_nationwide: h.is_nationwide,
        state: h.state || null,
      })),
      { onConflict: 'holiday_date,name' }
    );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, count: holidays.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
```

**Aufruf beim Laden der TimeTrackingView:**
```typescript
useEffect(() => {
  // Sync holidays for current and next year
  const currentYear = new Date().getFullYear();
  supabase.functions.invoke('sync-holidays', { body: { year: currentYear } });
  supabase.functions.invoke('sync-holidays', { body: { year: currentYear + 1 } });
}, []);
```

---

## 6. Soll/Ist Vergleich: max. 2 Nachkommastellen

**Analyse:**
Die `fmt`-Funktion (Zeile 297) formatiert bereits korrekt in Stunden:Minuten Format:
```typescript
const fmt = (m: number) => `${m < 0 ? "-" : ""}${Math.floor(Math.abs(m) / 60)}:${(Math.abs(m) % 60).toString().padStart(2, "0")}`;
```

Das Ergebnis ist z.B. "8:24" (8 Stunden, 24 Minuten). Das sind keine Nachkommastellen, sondern Minuten.

**Falls Dezimalstunden gewünscht:**
```typescript
const fmtDecimal = (m: number) => {
  const hours = m / 60;
  return `${hours >= 0 ? "" : "-"}${Math.abs(hours).toFixed(2)}h`;
};
// Beispiel: 504 Min → "8.40h"
```

**Falls das aktuelle Format (Stunden:Minuten) gemeint ist:**
Das funktioniert bereits korrekt. Vielleicht ist das "Problem" ein UI-Layout-Thema, wo sehr lange Werte abgeschnitten werden?

**Lösung:** Klären mit dem User, ob Dezimalstunden oder Stunden:Minuten gewünscht sind.

---

## 7. Arzttermine als bezahlte Arbeitszeit

**Konzept:**
In Deutschland können Arztbesuche während der Arbeitszeit als bezahlte Arbeitszeit gelten bei:
- Akuten Beschwerden
- Unaufschiebbaren Facharztterminen
- Nachsorge nach OP
- Schwangerschaftsvorsorge

**Implementierung:**

### A. Datenbank-Erweiterung
```sql
-- leave_type erweitern
ALTER TYPE leave_type ADD VALUE 'medical';

-- Oder falls enum nicht erweiterbar:
ALTER TABLE leave_requests 
ADD COLUMN medical_reason TEXT CHECK (
  type != 'medical' OR medical_reason IN (
    'acute', -- Akute Beschwerden
    'specialist', -- Facharzttermin
    'follow_up', -- Nachsorge
    'pregnancy' -- Schwangerschaft
  )
);
```

### B. UI für Arzttermine hinzufügen (TimeTrackingView)
```typescript
// Neuer State
const [medicalDate, setMedicalDate] = useState("");
const [medicalStartTime, setMedicalStartTime] = useState("");
const [medicalEndTime, setMedicalEndTime] = useState("");
const [medicalReason, setMedicalReason] = useState<string>("acute");
const [medicalNotes, setMedicalNotes] = useState("");

const handleReportMedical = async () => {
  if (!user || !medicalDate || !medicalStartTime || !medicalEndTime) {
    toast.error("Bitte alle Felder ausfüllen");
    return;
  }
  
  try {
    await supabase.from("leave_requests").insert({
      user_id: user.id,
      type: "medical",
      start_date: medicalDate,
      end_date: medicalDate,
      reason: JSON.stringify({
        type: medicalReason,
        start_time: medicalStartTime,
        end_time: medicalEndTime,
        notes: medicalNotes,
      }),
      status: "pending", // Benachrichtigt den Abgeordneten
    });
    
    toast.success("Arzttermin eingereicht");
    // Reset
    loadData();
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

### C. Benachrichtigung für Abgeordneten
Die bestehende Notification-Logik für `leave_requests` mit `status: 'pending'` sollte bereits greifen und den Abgeordneten benachrichtigen.

---

## 8. Überstundenabbau statt Urlaub

**Konzept:**
Ein Mitarbeiter kann einen Tag frei nehmen und diesen mit seinen Überstunden verrechnen lassen, statt einen Urlaubstag zu nehmen.

**Implementierung:**

### A. Datenbank-Erweiterung
```sql
-- leave_type erweitern
ALTER TYPE leave_type ADD VALUE 'overtime_reduction';
```

### B. Prüfung ob genug Überstunden vorhanden
```typescript
const calculateOvertimeBalance = async (): Promise<number> => {
  if (!user) return 0;
  
  // Alle Zeiteinträge bis heute
  const { data: entries } = await supabase
    .from("time_entries")
    .select("minutes, work_date")
    .eq("user_id", user.id)
    .lte("work_date", format(new Date(), "yyyy-MM-dd"));
  
  // Alle Krankheitstage
  const { data: sickLeaves } = await supabase
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("user_id", user.id)
    .eq("type", "sick")
    .eq("status", "approved");
  
  // Alle Feiertage
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("holiday_date")
    .lte("holiday_date", format(new Date(), "yyyy-MM-dd"));
  
  // Bereits genommene Überstunden-Tage
  const { data: overtimeReductions } = await supabase
    .from("leave_requests")
    .select("start_date, end_date")
    .eq("user_id", user.id)
    .eq("type", "overtime_reduction")
    .eq("status", "approved");
  
  // Berechnung:
  // 1. Summe aller gearbeiteten Minuten
  const workedMinutes = entries?.reduce((s, e) => s + (e.minutes || 0), 0) || 0;
  
  // 2. Soll-Minuten berechnen (alle Arbeitstage * Tages-Soll)
  // ... (komplexe Berechnung unter Berücksichtigung von Urlaub, Krankheit, Feiertagen)
  
  // 3. Differenz = Überstunden
  return workedMinutes - sollMinutes;
};

const handleRequestOvertimeReduction = async () => {
  const overtimeBalance = await calculateOvertimeBalance();
  const requiredMinutes = dailyHours * 60;
  
  if (overtimeBalance < requiredMinutes) {
    toast.error(`Nicht genug Überstunden. Vorhanden: ${fmt(overtimeBalance)}, benötigt: ${fmt(requiredMinutes)}`);
    return;
  }
  
  // ... Insert leave_request mit type: 'overtime_reduction'
};
```

### C. UI-Erweiterung (neuer Tab oder Abschnitt)
```typescript
<Card>
  <CardHeader>
    <CardTitle>Überstundenabbau beantragen</CardTitle>
    <CardDescription>
      Aktuelles Überstundenkonto: {fmt(overtimeBalance)}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Von</Label>
        <Input 
          type="date" 
          value={overtimeStartDate} 
          onChange={e => setOvertimeStartDate(e.target.value)} 
        />
      </div>
      <div>
        <Label>Bis</Label>
        <Input 
          type="date" 
          value={overtimeEndDate} 
          onChange={e => setOvertimeEndDate(e.target.value)} 
        />
      </div>
    </div>
    <div>
      <Label>Anmerkung</Label>
      <Textarea 
        value={overtimeReason} 
        onChange={e => setOvertimeReason(e.target.value)} 
        placeholder="Optional" 
      />
    </div>
    <Button onClick={handleRequestOvertimeReduction}>
      Überstundenabbau beantragen
    </Button>
  </CardContent>
</Card>
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| **SQL-Migration** | Bestehende Einträge korrigieren, leave_type erweitern, Trigger |
| `src/components/TimeTrackingView.tsx` | Kombinierte Eintrags-Liste, Arzttermine, Überstundenabbau |
| `supabase/functions/sync-holidays/index.ts` | Edge Function für Feiertage |

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| 1. Pausenzeiten korrigieren (DB + Trigger) | 15 Min |
| 2. Fehlerbehandlung verbessern | 10 Min |
| 3+4. Kranktage/Urlaubstage in Liste | 45 Min |
| 5. Feiertage Edge Function | 30 Min |
| 6. Formatierung prüfen (falls nötig) | 5 Min |
| 7. Arzttermine implementieren | 45 Min |
| 8. Überstundenabbau implementieren | 60 Min |
| **Gesamt** | **~3.5 Stunden** |

---

## Reihenfolge der Implementierung

1. **Prio 1:** Pausenzeiten korrigieren (betrifft alle Berechnungen)
2. **Prio 2:** Fehlerbehandlung für Delete/Update
3. **Prio 3:** Feiertage-Sync (wichtig für korrekte Soll-Berechnung)
4. **Prio 4:** Kombinierte Liste mit Kranktagen, Urlaub, Feiertagen
5. **Prio 5:** Überstundenabbau
6. **Prio 6:** Arzttermine
