
# Plan: Mitarbeiterverwaltung - 7 Verbesserungen

## Zusammenfassung

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Urlaubsstornierung funktioniert nicht / verursacht Fehler | TypeScript-Typisierung fuer `cancel_requested` Status korrigieren, Kalendereintrag bei Stornierung entfernen |
| 2 | Ueberstundenabbau, Arzttermine, Krankmeldungen in den Kalender | Kalendereintraege beim Genehmigen erstellen, beim Stornieren entfernen |
| 3 | Arzttermine und Ueberstundenabbau stornierbar machen | Stornieren-Buttons und Logik analog zu Urlaub hinzufuegen |
| 4 | Arzttermin + Weiterarbeit korrekt berechnen | Medical Leaves als Gutschrift NUR fuer die Arzttermin-Zeit, danach Arbeitszeit separat erfassen |
| 5 | Ueberstunden-Saldo bei Antrag: Jahressaldo statt Monatssaldo | yearlyBalance statt monthlyTotals.difference anzeigen |
| 6 | "Ende"-Feld in Meine Zeit Tab: aktuelle Uhrzeit vorausfuellen | `endTime` State mit `format(new Date(), "HH:mm")` initialisieren |
| 7 | Stempeluhr-Button fuer Arbeitsanfang/-pause | Neuen "Stempeln"-Modus mit localStorage-basierter Zeitspeicherung |

---

## Detaillierte Loesungen

### 1. Urlaubsstornierung verursacht Fehler

**Ursache:**

Der Code in `TimeTrackingView.tsx` (Zeile 714) verwendet `as any` Cast fuer den Status:
```typescript
.update({ status: newStatus as any })
```

Das Problem ist vermutlich, dass der TypeScript-Typ in `types.ts` den `cancel_requested` Status nicht korrekt erkennt, obwohl er in der Datenbank existiert (bestaetigt durch Enum-Abfrage: `pending`, `approved`, `rejected`, `cancel_requested`, `cancelled`).

**Loesung:**

Die `types.ts` Datei enthaelt bereits den korrekten Enum-Typ. Das Problem koennte sein, dass die RLS-Policy das Update nicht erlaubt. Der Code verwendet:
```typescript
.eq("user_id", user?.id)
```

Das sollte funktionieren. Moegliche Ursache: Der Status wird als String statt als Enum-Wert uebergeben.

**Aenderungen in `TimeTrackingView.tsx`:**

1. Fehlerbehandlung verbessern mit detailliertem Error-Logging
2. Status-Typ explizit definieren
3. Nach erfolgreicher Stornierung: Benachrichtigung an Admin senden (optional, via Trigger bereits vorhanden)

```typescript
// Zeile 703-730: Verbesserte handleCancelVacationRequest
const handleCancelVacationRequest = async (leaveId: string) => {
  if (!window.confirm('Moechten Sie diesen Urlaubsantrag wirklich stornieren?')) return;
  
  try {
    const leave = vacationLeaves.find(v => v.id === leaveId);
    if (!leave) {
      toast.error("Antrag nicht gefunden");
      return;
    }
    
    // Fuer pending: direkt stornieren, fuer approved: Stornierung anfragen
    const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
    
    const { data, error } = await supabase
      .from("leave_requests")
      .update({ status: newStatus })
      .eq("id", leaveId)
      .eq("user_id", user?.id)
      .select()
      .single();

    if (error) {
      console.error('Cancel request error:', error);
      throw error;
    }
    
    // Bei direkter Stornierung (pending): Kalendereintrag entfernen
    if (newStatus === 'cancelled' && leave) {
      await removeLeaveCalendarEntry(leave, 'vacation');
    }
    
    toast.success(
      newStatus === 'cancelled' 
        ? "Urlaubsantrag storniert" 
        : "Stornierungsanfrage gesendet - Wartet auf Genehmigung"
    );
    loadData();
  } catch (error: any) {
    console.error('Error cancelling vacation request:', error);
    toast.error(`Fehler beim Stornieren: ${error?.message || 'Unbekannter Fehler'}`);
  }
};
```

**Neue Hilfsfunktion zum Entfernen von Kalendereintraegen:**

```typescript
const removeLeaveCalendarEntry = async (leave: LeaveRow, type: 'vacation' | 'sick' | 'medical' | 'overtime_reduction') => {
  if (!user) return;
  
  try {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const userName = userProfile?.display_name || "Mitarbeiter";
    
    const categoryMap = {
      vacation: 'vacation',
      sick: 'sick',
      medical: 'medical',
      overtime_reduction: 'overtime_reduction',
    };
    
    const titleMap = {
      vacation: `Urlaub von ${userName}`,
      sick: `Krankheit: ${userName}`,
      medical: `Arzttermin: ${userName}`,
      overtime_reduction: `Ueberstundenabbau: ${userName}`,
    };
    
    await supabase
      .from("appointments")
      .delete()
      .eq("category", categoryMap[type])
      .ilike("title", `%${userName}%`)
      .gte("start_time", new Date(leave.start_date).toISOString());
      
  } catch (error) {
    console.error("Error removing calendar entry:", error);
  }
};
```

---

### 2. Ueberstundenabbau, Arzttermine und Krankmeldungen in den Kalender

**Aktueller Stand:**

Nur Urlaubsantraege werden als Kalendereintraege erstellt (in `EmployeesView.tsx`, Zeile 641-706: `createVacationCalendarEntry`).

**Loesung:**

Die `createVacationCalendarEntry`-Funktion generalisieren zu `createLeaveCalendarEntry` die alle Typen unterstuetzt.

**Aenderungen in `EmployeesView.tsx`:**

1. `createVacationCalendarEntry` umbenennen zu `createLeaveCalendarEntry` und fuer alle Typen erweitern
2. Bei `handleLeaveAction` fuer alle Typen Kalendereintraege erstellen

```typescript
// Neue generische Funktion
const createLeaveCalendarEntry = async (
  leaveRequest: PendingLeaveRequest, 
  userId: string, 
  leaveType: LeaveType
) => {
  try {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    const { data: tenantData } = await supabase
      .from("user_tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user?.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!tenantData) return;

    const userName = userProfile?.display_name || "Mitarbeiter";
    const workingDays = calculateWorkingDays(leaveRequest.start_date, leaveRequest.end_date);
    
    // Typ-spezifische Konfiguration
    const config = {
      vacation: {
        title: `Urlaub von ${userName}`,
        description: `Urlaubsantrag genehmigt (${workingDays} Arbeitstage)`,
        category: 'vacation',
        requestTitle: `Anfrage Urlaub von ${userName}`,
        requestCategory: 'vacation_request',
      },
      sick: {
        title: `Krankheit: ${userName}`,
        description: `Krankmeldung (${workingDays} Arbeitstage)`,
        category: 'sick',
        requestTitle: `Anfrage Krankheit: ${userName}`,
        requestCategory: 'sick_request',
      },
      medical: {
        title: `Arzttermin: ${userName}`,
        description: `Arzttermin genehmigt`,
        category: 'medical',
        requestTitle: `Anfrage Arzttermin: ${userName}`,
        requestCategory: 'medical_request',
      },
      overtime_reduction: {
        title: `Ueberstundenabbau: ${userName}`,
        description: `Ueberstundenabbau genehmigt (${workingDays} Arbeitstage)`,
        category: 'overtime_reduction',
        requestTitle: `Anfrage Ueberstundenabbau: ${userName}`,
        requestCategory: 'overtime_request',
      },
      other: {
        title: `Abwesenheit: ${userName}`,
        description: `Abwesenheit (${workingDays} Arbeitstage)`,
        category: 'other',
        requestTitle: `Anfrage: ${userName}`,
        requestCategory: 'other_request',
      },
    };
    
    const typeConfig = config[leaveType] || config.other;
    
    // Bestehenden Antrag-Eintrag aktualisieren oder neuen erstellen
    const { data: existingEntry } = await supabase
      .from("appointments")
      .select("id")
      .eq("title", typeConfig.requestTitle)
      .eq("start_time", new Date(leaveRequest.start_date).toISOString())
      .eq("category", typeConfig.requestCategory)
      .single();

    if (existingEntry) {
      await supabase
        .from("appointments")
        .update({
          title: typeConfig.title,
          description: typeConfig.description,
          category: typeConfig.category,
          status: "confirmed"
        })
        .eq("id", existingEntry.id);
    } else {
      await supabase
        .from("appointments")
        .insert({
          user_id: user?.id,
          tenant_id: tenantData.tenant_id,
          start_time: new Date(leaveRequest.start_date).toISOString(),
          end_time: new Date(leaveRequest.end_date + "T23:59:59").toISOString(),
          title: typeConfig.title,
          description: typeConfig.description,
          category: typeConfig.category,
          priority: "medium",
          status: "confirmed",
          is_all_day: true
        });
    }
  } catch (error) {
    console.error("Fehler beim Erstellen des Kalendereintrags:", error);
  }
};
```

**Anpassung in handleLeaveAction (Zeile 708-760):**

```typescript
if (action === "approved") {
  // Bei Genehmigung: Kalendereintrag fuer ALLE Typen erstellen
  await createLeaveCalendarEntry(leaveRequest, leaveRequest.user_id, leaveRequest.type);
} else {
  // Bei Ablehnung: Antragseintrag loeschen (falls vorhanden)
  // ... bestehende Logik
}
```

**Anpassung bei handleCancelApproval (Zeile 796-845):**

Erweitern, um auch Arzttermine, Krankmeldungen und Ueberstundenabbau-Eintraege zu entfernen:

```typescript
if (approve && leaveRequest) {
  const typeConfig = {
    vacation: `Urlaub von ${userName}`,
    sick: `Krankheit: ${userName}`,
    medical: `Arzttermin: ${userName}`,
    overtime_reduction: `Ueberstundenabbau: ${userName}`,
    other: `Abwesenheit: ${userName}`,
  };
  
  const calendarCategory = leaveRequest.type;
  
  await supabase
    .from("appointments")
    .delete()
    .ilike("title", `%${userName}%`)
    .eq("category", calendarCategory)
    .gte("start_time", new Date(leaveRequest.start_date).toISOString());
}
```

---

### 3. Arzttermine und Ueberstundenabbau stornierbar machen

**Aenderungen in `TimeTrackingView.tsx`:**

1. `handleCancelMedicalRequest` Funktion hinzufuegen (analog zu Urlaub)
2. `handleCancelOvertimeRequest` Funktion hinzufuegen
3. Stornieren-Buttons in den Arzttermin- und Ueberstundenabbau-Tabellen hinzufuegen

```typescript
// Neue Funktion: Arzttermin stornieren
const handleCancelMedicalRequest = async (leaveId: string) => {
  if (!window.confirm('Moechten Sie diesen Arzttermin wirklich stornieren?')) return;
  
  try {
    const leave = medicalLeaves.find(m => m.id === leaveId);
    if (!leave) {
      toast.error("Termin nicht gefunden");
      return;
    }
    
    const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
    
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: newStatus })
      .eq("id", leaveId)
      .eq("user_id", user?.id);

    if (error) throw error;
    
    if (newStatus === 'cancelled') {
      await removeLeaveCalendarEntry(leave, 'medical');
    }
    
    toast.success(
      newStatus === 'cancelled' 
        ? "Arzttermin storniert" 
        : "Stornierungsanfrage gesendet"
    );
    loadData();
  } catch (error: any) {
    console.error('Error cancelling medical request:', error);
    toast.error("Fehler beim Stornieren");
  }
};

// Neue Funktion: Ueberstundenabbau stornieren
const handleCancelOvertimeRequest = async (leaveId: string) => {
  if (!window.confirm('Moechten Sie diesen Ueberstundenabbau wirklich stornieren?')) return;
  
  try {
    const leave = overtimeLeaves.find(o => o.id === leaveId);
    if (!leave) {
      toast.error("Antrag nicht gefunden");
      return;
    }
    
    const newStatus = leave.status === 'pending' ? 'cancelled' : 'cancel_requested';
    
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: newStatus })
      .eq("id", leaveId)
      .eq("user_id", user?.id);

    if (error) throw error;
    
    if (newStatus === 'cancelled') {
      await removeLeaveCalendarEntry(leave, 'overtime_reduction');
    }
    
    toast.success(
      newStatus === 'cancelled' 
        ? "Ueberstundenabbau storniert" 
        : "Stornierungsanfrage gesendet"
    );
    loadData();
  } catch (error: any) {
    console.error('Error cancelling overtime request:', error);
    toast.error("Fehler beim Stornieren");
  }
};
```

**UI-Anpassungen (Arzttermine-Tabelle, ca. Zeile 1460-1490):**

Spalte "Aktion" hinzufuegen mit Stornieren-Button.

**UI-Anpassungen (Ueberstundenabbau-Tabelle, ca. Zeile 1572-1590):**

Spalte "Aktion" hinzufuegen mit Stornieren-Button.

---

### 4. Arzttermin + Weiterarbeit korrekt berechnen

**Aktueller Stand:**

Der `useCombinedTimeEntries` Hook (Zeile 288-316) behandelt Medical Leaves so, dass sie als eigene Eintraege erscheinen, aber Arbeitseintraege am selben Tag NICHT blockieren (anders als bei Urlaub/Krankheit).

Das ist bereits korrekt implementiert! Der Code in Zeile 318-338 filtert Arbeitseintraege nur fuer Feiertage, Krankheit, Urlaub und Ueberstundenabbau - NICHT fuer Arzttermine.

**Verifizierung:**

Die Logik ist bereits korrekt:
- Arzttermin-Tage werden NICHT in die `medicalDates` Set aufgenommen, die Arbeit blockieren wuerden
- Arzttermine werden separat als Eintraege hinzugefuegt
- Arbeitseintraege am selben Tag bleiben erhalten

**Moegliche Verbesserung:**

In der Anzeige koennte man visuell klarer machen, dass an einem Tag sowohl ein Arzttermin als auch Arbeitszeit erfasst wurde.

---

### 5. Ueberstunden-Saldo bei Antrag: Jahressaldo statt Monatssaldo anzeigen

**Aktueller Stand (Zeile 1507-1517):**

```typescript
<div className="flex justify-between">
  <span>Ueberstunden (aktueller Monat):</span>
  <span>{monthlyTotals.difference >= 0 ? '+' : ''}{fmt(monthlyTotals.difference)}</span>
</div>
```

**Loesung:**

Statt `monthlyTotals.difference` den `yearlyBalance` anzeigen:

```typescript
<div className="flex justify-between">
  <span>Ueberstundensaldo (gesamt):</span>
  <span className={`font-mono font-bold ${yearlyBalance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
    {yearlyBalance >= 0 ? '+' : ''}{fmt(yearlyBalance)}
  </span>
</div>
<p className="text-xs text-muted-foreground mt-1">
  Jahressaldo inkl. aller Monate bis heute
</p>
```

---

### 6. "Ende"-Feld in Meine Zeit Tab: aktuelle Uhrzeit vorausfuellen

**Aktueller Stand in `MyWorkTimeTrackingTab.tsx` (Zeile 46):**

```typescript
const [endTime, setEndTime] = useState("");
```

**Loesung:**

Den `endTime` State mit der aktuellen Uhrzeit initialisieren:

```typescript
const [endTime, setEndTime] = useState(() => format(new Date(), "HH:mm"));
```

**Zusaetzlich:** Bei jedem Tab-Wechsel/Mount aktualisieren:

```typescript
useEffect(() => {
  // Aktuelle Zeit als Ende-Zeit setzen wenn noch leer oder beim Mounten
  setEndTime(format(new Date(), "HH:mm"));
}, []); // Nur beim initialen Mount
```

Oder alternativ: Jedes Mal wenn der Tab geoeffnet wird, die Zeit aktualisieren. Da der Tab als Komponente gemountet wird, reicht das `useState` mit Initialisierung.

---

### 7. Stempeluhr-Button fuer Arbeitsbeginn und Pause

**Konzept:**

Ein "Stempeln"-System mit folgenden Funktionen:
1. "Arbeit beginnen" - speichert aktuelle Zeit in localStorage
2. "Pause beginnen" - speichert Pausenstart
3. "Pause beenden" - berechnet Pausenzeit
4. "Feierabend" - erstellt automatisch den Zeiteintrag

**Implementierung:**

Neue State-Variablen und localStorage-Integration in `MyWorkTimeTrackingTab.tsx`:

```typescript
// Stempeluhr States
const [clockedIn, setClockedIn] = useState<string | null>(null);
const [pauseStart, setPauseStart] = useState<string | null>(null);
const [totalPauseMinutes, setTotalPauseMinutes] = useState(0);

// Beim Mount: Gespeicherte Stempelzeit laden
useEffect(() => {
  const savedClockIn = localStorage.getItem('timetracking_clock_in');
  const savedPauseStart = localStorage.getItem('timetracking_pause_start');
  const savedPauseTotal = localStorage.getItem('timetracking_pause_total');
  
  if (savedClockIn) setClockedIn(savedClockIn);
  if (savedPauseStart) setPauseStart(savedPauseStart);
  if (savedPauseTotal) setTotalPauseMinutes(parseInt(savedPauseTotal) || 0);
}, []);

const handleClockIn = () => {
  const now = format(new Date(), "HH:mm");
  setClockedIn(now);
  setStartTime(now);
  localStorage.setItem('timetracking_clock_in', now);
  localStorage.setItem('timetracking_date', format(new Date(), "yyyy-MM-dd"));
  toast.success(`Arbeit begonnen um ${now}`);
};

const handlePauseStart = () => {
  const now = format(new Date(), "HH:mm");
  setPauseStart(now);
  localStorage.setItem('timetracking_pause_start', now);
  toast.info(`Pause begonnen um ${now}`);
};

const handlePauseEnd = () => {
  if (!pauseStart) return;
  
  const pauseStartTime = new Date(`1970-01-01T${pauseStart}:00`);
  const pauseEndTime = new Date();
  const minutes = Math.round((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000);
  
  const newTotal = totalPauseMinutes + minutes;
  setTotalPauseMinutes(newTotal);
  setPauseMinutes(newTotal.toString());
  setPauseStart(null);
  
  localStorage.setItem('timetracking_pause_total', newTotal.toString());
  localStorage.removeItem('timetracking_pause_start');
  
  toast.success(`Pause beendet (+${minutes} Min)`);
};

const handleClockOut = () => {
  const now = format(new Date(), "HH:mm");
  setEndTime(now);
  
  // Formular ist jetzt vorausgefuellt und kann abgeschickt werden
  toast.success(`Feierabend um ${now} - Bitte Eintrag speichern`);
  
  // LocalStorage aufraumen nach erfolgreicher Speicherung
};

const clearClockData = () => {
  setClockedIn(null);
  setPauseStart(null);
  setTotalPauseMinutes(0);
  localStorage.removeItem('timetracking_clock_in');
  localStorage.removeItem('timetracking_pause_start');
  localStorage.removeItem('timetracking_pause_total');
  localStorage.removeItem('timetracking_date');
};
```

**UI-Komponente - Stempeluhr-Card:**

```text
+------------------------------------------+
|  Stempeluhr                              |
+------------------------------------------+
|  [Nicht gestempelt]                      |
|                                          |
|  [Arbeit beginnen]                       |
+------------------------------------------+

ODER (wenn eingestempelt):

+------------------------------------------+
|  Stempeluhr                 [Abbrechen]  |
+------------------------------------------+
|  Arbeitsbeginn: 08:30                    |
|  Pausenzeit: 45 Min                      |
|                                          |
|  [Pause]  oder  [Feierabend]             |
+------------------------------------------+

ODER (in Pause):

+------------------------------------------+
|  Stempeluhr                              |
+------------------------------------------+
|  Arbeitsbeginn: 08:30                    |
|  In Pause seit: 12:00                    |
|                                          |
|  [Pause beenden]                         |
+------------------------------------------+
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `TimeTrackingView.tsx` | 1) Fehlerbehandlung bei Stornierung, 2) `removeLeaveCalendarEntry` Funktion, 3) Arzttermin/Ueberstunden stornieren, 4) Jahressaldo statt Monatssaldo anzeigen |
| `MyWorkTimeTrackingTab.tsx` | 1) endTime mit aktueller Zeit initialisieren, 2) Stempeluhr-Feature komplett |
| `EmployeesView.tsx` | 1) `createVacationCalendarEntry` generalisieren zu `createLeaveCalendarEntry`, 2) handleLeaveAction fuer alle Typen erweitern, 3) handleCancelApproval fuer alle Typen |

---

## Technische Architektur

```text
Mitarbeiter                         Admin (Abgeordneter)
    |                                      |
    |  1. Urlaub/Krankheit/etc. beantragen |
    |------------------------------------->|
    |                                      |
    |  2. Genehmigt                        |
    |<-------------------------------------|
    |                                      |
    |  [Kalendereintrag wird erstellt]     |
    |                                      |
    |  3. Stornierung anfragen             |
    |------------------------------------->|
    |     (status = cancel_requested)      |
    |                                      |
    |  4. Stornierung genehmigen           |
    |<-------------------------------------|
    |     (status = cancelled)             |
    |     [Kalendereintrag wird geloescht] |
    |     [Urlaubstage werden gutgeschrieben]
```

### Stempeluhr Datenfluss

```text
localStorage:
- timetracking_clock_in: "08:30"
- timetracking_date: "2026-02-04"
- timetracking_pause_start: null | "12:00"
- timetracking_pause_total: "45"

State:
- clockedIn: string | null
- pauseStart: string | null
- totalPauseMinutes: number

Formularfelder (automatisch befuellt):
- startTime <- clockedIn
- endTime <- beim Feierabend
- pauseMinutes <- totalPauseMinutes
```
