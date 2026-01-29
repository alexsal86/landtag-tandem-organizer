
# Plan: Zeiterfassung - Fehlerbehebungen und UI-Erweiterungen

## Übersicht der Probleme und Lösungen

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Formatierung zeigt `188:6.000000000001819` | Fließkomma-Ungenauigkeiten bei `dailyHours * 60` | `Math.round()` bei ALLEN Minutenberechnungen anwenden |
| Feiertage 1.1.2026 / 6.1.2026 nicht eingetragen | Edge Function `sync-holidays` nicht deployed (404) | Edge Function deployen, dann manuell aufrufen |
| UI für Arzttermine fehlt | Nicht implementiert | Neues Formular + Tabelle in "Urlaub & Krankmeldungen" Tab |
| UI für Überstundenabbau fehlt | Nicht implementiert | Neues Formular + Tabelle in "Urlaub & Krankmeldungen" Tab |

---

## 1. Formatierungsproblem beheben

**Ursache im Detail:**

Das Problem entsteht durch Fließkomma-Arithmetik:
```typescript
// employee_settings hat z.B. hours_per_month: 171, days_per_month: 20
const dailyHours = 171 / 20;  // = 8.55
const dailyMinutes = dailyHours * 60;  // = 513.0000000000001 (nicht 513!)
```

Wenn dann `fmt(monthlyTotals.target)` aufgerufen wird, passiert:
```typescript
// monthlyTotals.target = workingDays * dailyHours * 60
// z.B. 22 * 8.55 * 60 = 11286.0000000000018

// In fmt():
Math.abs(m) % 60  // = 6.0000000000018 statt 6
```

**Lösung in `TimeTrackingView.tsx`:**

### A. `dailyMinutes` korrekt runden (Zeile 145)
```typescript
// VORHER:
const dailyMinutes = Math.round(dailyHours * 60);  // bereits korrekt

// Aber: dailyHours selbst ist problematisch!
const dailyHours = employeeSettings 
  ? employeeSettings.hours_per_month / employeeSettings.days_per_month 
  : 8;
```

### B. `monthlyTotals` Berechnung korrigieren (Zeile 184-194)
```typescript
const monthlyTotals = useMemo(() => {
  const worked = entries.reduce((s, e) => s + (e.minutes || 0), 0);
  const sick = sickLeaves.reduce((s, l) => {
    if (l.status !== "approved") return s;
    const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
      .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6).length;
    return s + days * dailyMinutes;  // ← dailyMinutes statt dailyHours * 60
  }, 0);
  const workingDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    .filter(d => d.getDay() !== 0 && d.getDay() !== 6 && 
      !holidays.some(h => h.holiday_date === format(d, "yyyy-MM-dd"))).length;
  const target = workingDays * dailyMinutes;  // ← dailyMinutes statt dailyHours * 60
  return { worked, sick, target, difference: worked + sick - target, workingDays };
}, [entries, sickLeaves, holidays, monthStart, monthEnd, dailyMinutes]);  // ← dailyMinutes als Dependency
```

### C. `projectionTotals` Berechnung korrigieren (Zeile 196-210)
```typescript
const projectionTotals = useMemo(() => {
  // ... 
  const targetSoFar = workedDaysSoFar * dailyMinutes;  // ← dailyMinutes statt dailyHours * 60
  // ...
  const sickSoFar = sickLeaves.filter(l => l.status === "approved").reduce((s, l) => {
    const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) })
      .filter(d => d >= monthStart && d <= effectiveEndDate && d.getDay() !== 0 && d.getDay() !== 6).length;
    return s + days * dailyMinutes;  // ← dailyMinutes statt dailyHours * 60
  }, 0);
  // ...
}, [entries, sickLeaves, holidays, monthStart, monthEnd, selectedMonth, dailyMinutes]);  // ← dailyMinutes
```

---

## 2. Edge Function `sync-holidays` deployen und testen

**Problem:** Die Edge Function existiert im Code, ist aber nicht deployed (404-Fehler beim Aufruf).

**Lösung:**
1. Edge Function mit dem Deploy-Tool deployen
2. Manuell für 2025 und 2026 aufrufen
3. Datenbankeinträge verifizieren

**Nach dem Deployment wird die Funktion automatisch beim Laden der TimeTrackingView aufgerufen:**
```typescript
// Zeile 121 - bereits implementiert:
supabase.functions.invoke('sync-holidays', { body: { year } }).catch(console.error);
```

---

## 3. UI für Arzttermine (medical) hinzufügen

**Neue States:**
```typescript
const [medicalDate, setMedicalDate] = useState("");
const [medicalStartTime, setMedicalStartTime] = useState("");
const [medicalEndTime, setMedicalEndTime] = useState("");
const [medicalReason, setMedicalReason] = useState<string>("acute");
const [medicalNotes, setMedicalNotes] = useState("");
```

**Neue Handler-Funktion:**
```typescript
const handleReportMedical = async () => {
  if (!user || !medicalDate || !medicalStartTime || !medicalEndTime) {
    toast.error("Bitte alle Felder ausfüllen");
    return;
  }
  
  // Minuten berechnen
  const [startH, startM] = medicalStartTime.split(':').map(Number);
  const [endH, endM] = medicalEndTime.split(':').map(Number);
  const minutesCounted = (endH * 60 + endM) - (startH * 60 + startM);
  
  if (minutesCounted <= 0) {
    toast.error("Endzeit muss nach Startzeit liegen");
    return;
  }
  
  try {
    await supabase.from("leave_requests").insert({
      user_id: user.id,
      type: "medical",
      start_date: medicalDate,
      end_date: medicalDate,
      medical_reason: medicalReason,
      start_time: medicalStartTime,
      end_time: medicalEndTime,
      minutes_counted: minutesCounted,
      reason: medicalNotes || null,
      status: "pending",
    });
    toast.success("Arzttermin eingereicht");
    setMedicalDate("");
    setMedicalStartTime("");
    setMedicalEndTime("");
    setMedicalReason("acute");
    setMedicalNotes("");
    loadData();
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

**Neue UI-Komponente (nach Krankmeldung):**
```typescript
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <span>🏥</span>
      Arzttermin melden
    </CardTitle>
    <CardDescription>
      Bezahlte Freistellung für akute Arztbesuche, Facharzttermine oder Nachsorge
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label>Datum</Label>
        <Input type="date" value={medicalDate} onChange={e => setMedicalDate(e.target.value)} />
      </div>
      <div>
        <Label>Von</Label>
        <Input type="time" value={medicalStartTime} onChange={e => setMedicalStartTime(e.target.value)} />
      </div>
      <div>
        <Label>Bis</Label>
        <Input type="time" value={medicalEndTime} onChange={e => setMedicalEndTime(e.target.value)} />
      </div>
    </div>
    <div>
      <Label>Art des Termins</Label>
      <Select value={medicalReason} onValueChange={setMedicalReason}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="acute">Akuter Arztbesuch (plötzliche Beschwerden)</SelectItem>
          <SelectItem value="specialist">Unaufschiebbarer Facharzttermin</SelectItem>
          <SelectItem value="follow_up">Nachsorge nach OP</SelectItem>
          <SelectItem value="pregnancy">Schwangerschaftsvorsorge</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label>Notizen</Label>
      <Textarea value={medicalNotes} onChange={e => setMedicalNotes(e.target.value)} placeholder="Optional" />
    </div>
    <Button onClick={handleReportMedical}>Arzttermin einreichen</Button>
  </CardContent>
</Card>
```

**Tabelle für Arzttermine (in separater Card):**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Arzttermine {selectedMonth.getFullYear()}</CardTitle>
  </CardHeader>
  <CardContent>
    {medicalLeaves.length === 0 ? (
      <p className="text-sm text-muted-foreground">Keine Arzttermine vorhanden</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Zeit</TableHead>
            <TableHead>Art</TableHead>
            <TableHead>Dauer</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medicalLeaves.map(m => (
            <TableRow key={m.id}>
              <TableCell>{format(parseISO(m.start_date), "dd.MM.yyyy")}</TableCell>
              <TableCell>{m.start_time} - {m.end_time}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {m.medical_reason === 'acute' ? 'Akut' :
                   m.medical_reason === 'specialist' ? 'Facharzt' :
                   m.medical_reason === 'follow_up' ? 'Nachsorge' :
                   m.medical_reason === 'pregnancy' ? 'Schwangerschaft' : m.medical_reason}
                </Badge>
              </TableCell>
              <TableCell>{fmt(m.minutes_counted || 0)}</TableCell>
              <TableCell>{getStatusBadge(m.status)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </CardContent>
</Card>
```

---

## 4. UI für Überstundenabbau hinzufügen

**Neue States:**
```typescript
const [overtimeStartDate, setOvertimeStartDate] = useState("");
const [overtimeEndDate, setOvertimeEndDate] = useState("");
const [overtimeReason, setOvertimeReason] = useState("");
```

**Überstundensaldo berechnen (vereinfacht für MVP):**
```typescript
const overtimeBalance = useMemo(() => {
  // Vereinfachte Berechnung: Gesamt-Differenz aller Monate
  // Für eine vollständige Implementierung müssten alle Einträge über alle Monate geladen werden
  return monthlyTotals.difference;  // Positive Zahl = Überstunden vorhanden
}, [monthlyTotals]);
```

**Neue Handler-Funktion:**
```typescript
const handleRequestOvertimeReduction = async () => {
  if (!user || !overtimeStartDate || !overtimeEndDate) {
    toast.error("Bitte beide Felder ausfüllen");
    return;
  }
  
  // Arbeitstage berechnen
  const days = eachDayOfInterval({ 
    start: parseISO(overtimeStartDate), 
    end: parseISO(overtimeEndDate) 
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
  
  const requiredMinutes = days * dailyMinutes;
  
  // Hinweis: Vollständige Überstundenprüfung erfordert Laden aller historischen Daten
  // Für MVP zeigen wir nur einen Hinweis
  
  try {
    await supabase.from("leave_requests").insert({
      user_id: user.id,
      type: "overtime_reduction",
      start_date: overtimeStartDate,
      end_date: overtimeEndDate,
      reason: overtimeReason || null,
      status: "pending",
    });
    toast.success("Überstundenabbau beantragt");
    setOvertimeStartDate("");
    setOvertimeEndDate("");
    setOvertimeReason("");
    loadData();
  } catch (error: any) {
    toast.error(error.message);
  }
};
```

**Neue UI-Komponente:**
```typescript
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <span>⏰</span>
      Überstundenabbau beantragen
    </CardTitle>
    <CardDescription>
      Mehrstunden als freie Tage nehmen statt Urlaub
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Info-Box mit aktuellem Stand */}
    <div className="p-3 rounded-lg bg-muted/50 text-sm">
      <div className="flex justify-between">
        <span>Überstunden (aktueller Monat):</span>
        <span className={`font-mono font-bold ${monthlyTotals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {monthlyTotals.difference >= 0 ? '+' : ''}{fmt(monthlyTotals.difference)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Hinweis: Der Gesamtstand wird bei der Genehmigung geprüft.
      </p>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Von</Label>
        <Input type="date" value={overtimeStartDate} onChange={e => setOvertimeStartDate(e.target.value)} />
      </div>
      <div>
        <Label>Bis</Label>
        <Input type="date" value={overtimeEndDate} onChange={e => setOvertimeEndDate(e.target.value)} />
      </div>
    </div>
    <div>
      <Label>Anmerkung</Label>
      <Textarea value={overtimeReason} onChange={e => setOvertimeReason(e.target.value)} placeholder="Optional" />
    </div>
    <Button onClick={handleRequestOvertimeReduction}>Überstundenabbau beantragen</Button>
  </CardContent>
</Card>
```

**Tabelle für Überstundenabbau:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Überstundenabbau {selectedMonth.getFullYear()}</CardTitle>
  </CardHeader>
  <CardContent>
    {overtimeLeaves.length === 0 ? (
      <p className="text-sm text-muted-foreground">Keine Überstundenabbau-Anträge vorhanden</p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Von</TableHead>
            <TableHead>Bis</TableHead>
            <TableHead>Tage</TableHead>
            <TableHead>Anmerkung</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overtimeLeaves.map(o => {
            const d = eachDayOfInterval({ start: parseISO(o.start_date), end: parseISO(o.end_date) })
              .filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
            return (
              <TableRow key={o.id}>
                <TableCell>{format(parseISO(o.start_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{format(parseISO(o.end_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{d}</TableCell>
                <TableCell>{o.reason || "-"}</TableCell>
                <TableCell>{getStatusBadge(o.status)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    )}
  </CardContent>
</Card>
```

---

## Zusammenfassung der Änderungen

| Datei | Änderungen |
|-------|------------|
| `src/components/TimeTrackingView.tsx` | 1) Formatierung korrigieren (dailyMinutes verwenden), 2) UI für Arzttermine, 3) UI für Überstundenabbau |
| `supabase/functions/sync-holidays/index.ts` | Edge Function deployen |

---

## Zusätzlich benötigt: Import für Select-Komponente

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

---

## Layout-Struktur im "Urlaub & Krankmeldungen" Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Ausstehende Anträge (falls vorhanden)                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│ Urlaub beantragen         │  │ Urlaubskonto 2026         │
└───────────────────────────┘  └───────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│ Krankmeldung              │  │ Krankmeldungen 2026       │
└───────────────────────────┘  └───────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│ Arzttermin melden 🏥      │  │ Arzttermine 2026          │
│ - Datum, Von, Bis         │  │ (Tabelle)                 │
│ - Art des Termins         │  │                           │
│ - Notizen                 │  │                           │
└───────────────────────────┘  └───────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│ Überstundenabbau ⏰       │  │ Überstundenabbau 2026     │
│ - Überstunden-Info        │  │ (Tabelle)                 │
│ - Von, Bis                │  │                           │
│ - Anmerkung               │  │                           │
└───────────────────────────┘  └───────────────────────────┘
```

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Formatierung korrigieren | 10 Min |
| Edge Function deployen | 5 Min |
| UI Arzttermine | 25 Min |
| UI Überstundenabbau | 20 Min |
| **Gesamt** | **~60 Min** |
