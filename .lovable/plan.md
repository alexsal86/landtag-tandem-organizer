
# Plan: Admin-Eintragstyp-Konvertierung & Feiertags-Logik ✅

## Status: IMPLEMENTIERT

### Umgesetzte Änderungen:

1. **Feiertage aus Gutschrift entfernt** ✅
   - `useCombinedTimeEntries.ts`: Feiertage mit `minutes: 0`
   - `TimeTrackingView.tsx`: `holidayMinutes` → `holidayCount` (nur zur Anzeige)
   - `AdminTimeTrackingView.tsx`: `creditMinutes` ohne 'holiday'

2. **Admin kann Abwesenheiten bearbeiten** ✅
   - Bearbeiten-Button für vacation, sick, overtime_reduction aktiviert
   - `editingCombinedEntry` State hinzugefügt

3. **Typwechsel ermöglicht** ✅
   - `AdminTimeEntryEditor.tsx`: Typ-Dropdown mit Warnhinweisen
   - `handleTypeChange` Funktion in AdminTimeTrackingView
   - Arbeit ↔ Abwesenheit Konvertierung implementiert

---

**Lösung:** 
- Neuer Dropdown im `AdminTimeEntryEditor` für Eintragstyp
- Bei Typwechsel:
  - Urlaub → Überstundenabbau: Urlaubstag zurückgeben, Überstunden reduzieren
  - Arbeit → Urlaub: time_entry löschen, leave_request erstellen
  - Urlaub → Arbeit: leave_request löschen, Mitarbeiter muss Zeit manuell erfassen

### 3. Feiertage anders behandeln
**Problem:** Aktuell werden Feiertage als Gutschrift mit `dailyMinutes` gerechnet (Zeile 150 in useCombinedTimeEntries, Zeile 265 in TimeTrackingView).

**Anforderung:** Feiertage sollen KEINE Gutschrift geben, sondern das Soll reduzieren. An Feiertagen wird einfach 0 gearbeitet, und das Soll berücksichtigt diese Tage nicht.

**Aktuelle Berechnung:**
```
Soll = Arbeitstage × 7.9h (Feiertage bereits ausgeschlossen!)
Gutschrift = Urlaub + Krankheit + Feiertage (FALSCH: Feiertage doppelt!)
```

**Korrekte Berechnung:**
```
Soll = Arbeitstage × 7.9h (Feiertage bereits ausgeschlossen - korrekt!)
Gutschrift = Urlaub + Krankheit + Überstundenabbau + Arzttermine (OHNE Feiertage!)
```

---

## Technische Änderungen

### Änderung 1: Feiertage aus der Gutschrift entfernen

**Datei:** `src/components/TimeTrackingView.tsx`

**Zeile 278-279 ändern:**
```typescript
// ALT:
const totalCredit = sickMinutes + vacationMinutes + overtimeMinutes + holidayMinutes + medicalMinutes;

// NEU (ohne holidayMinutes):
const totalCredit = sickMinutes + vacationMinutes + overtimeMinutes + medicalMinutes;
// Feiertage werden NICHT als Gutschrift gezählt - sie reduzieren bereits das Soll!
```

**Zeile 257-265 (holidayMinutes Berechnung) kann entfernt oder auf 0 gesetzt werden:**
```typescript
const holidayMinutes = 0; // Feiertage reduzieren das Soll, keine Gutschrift nötig
```

**Return-Objekt anpassen (Zeile 289-301):**
- `holidayMinutes` auf 0 setzen oder entfernen
- Tooltip-Aufschlüsselung anpassen

---

### Änderung 2: useCombinedTimeEntries - Feiertage mit 0 Minuten

**Datei:** `src/hooks/useCombinedTimeEntries.ts`

**Zeile 145-160 (Holiday-Eintrag) ändern:**
```typescript
// ALT:
combined.push({
  ...
  minutes: dailyMinutes,  // ← FALSCH: Gibt Gutschrift
  ...
});

// NEU:
combined.push({
  ...
  minutes: 0,  // ← KORREKT: Keine Arbeitszeit, keine Gutschrift
  ...
});
```

**Erklärung:** Feiertage erscheinen weiterhin in der Liste (zur Visualisierung), haben aber 0 Minuten, da sie das Soll bereits reduzieren.

---

### Änderung 3: AdminTimeTrackingView - Auch Abwesenheiten bearbeitbar

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Zeile 676 ändern:**
```typescript
// ALT:
{entry.is_editable && entry.entry_type === 'work' && (

// NEU:
{(entry.entry_type === 'work' || ['vacation', 'sick', 'overtime_reduction'].includes(entry.entry_type)) && (
```

**Neuer State für Abwesenheits-Bearbeitung:**
```typescript
const [editingLeave, setEditingLeave] = useState<{
  id: string;
  type: string;
  work_date: string;
  leave_id: string;
} | null>(null);
```

**Neue Funktion handleEditAbsence:**
```typescript
const handleEditAbsence = (entry: CombinedTimeEntry) => {
  if (!entry.leave_id) return;
  setEditingLeave({
    id: entry.id,
    type: entry.entry_type,
    work_date: entry.work_date,
    leave_id: entry.leave_id,
  });
};
```

---

### Änderung 4: AdminTimeEntryEditor erweitern für Typwechsel

**Datei:** `src/components/AdminTimeEntryEditor.tsx`

**Neue Props und State:**
```typescript
interface AdminTimeEntryEditorProps {
  entry: TimeEntryForEdit;
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryId: string, data: AdminEditData) => Promise<void>;
  onTypeChange?: (entryId: string, newType: string, reason: string) => Promise<void>;
  isLoading?: boolean;
  currentEntryType?: 'work' | 'vacation' | 'sick' | 'overtime_reduction';
  allowTypeChange?: boolean;
}

// Neuer State:
const [selectedType, setSelectedType] = useState(currentEntryType || 'work');
```

**Neues Dropdown im Dialog:**
```tsx
{allowTypeChange && (
  <div className="grid gap-2">
    <Label>Eintragstyp</Label>
    <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
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
    {selectedType !== currentEntryType && (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {selectedType === 'vacation' && 'Achtung: Ein Urlaubstag wird vom Kontingent abgezogen.'}
          {selectedType === 'overtime_reduction' && currentEntryType === 'vacation' && 
            'Der Urlaubstag wird zurückgegeben und stattdessen Überstunden reduziert.'}
          {selectedType === 'work' && currentEntryType !== 'work' &&
            'Die Abwesenheit wird entfernt. Der Mitarbeiter muss die Arbeitszeit manuell erfassen.'}
        </AlertDescription>
      </Alert>
    )}
  </div>
)}
```

---

### Änderung 5: Typwechsel-Handler in AdminTimeTrackingView

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Neue Funktion handleTypeChange:**
```typescript
const handleTypeChange = async (
  entry: CombinedTimeEntry,
  newType: 'work' | 'vacation' | 'sick' | 'overtime_reduction',
  reason: string
) => {
  if (!user || !selectedUserId) return;
  const originalType = entry.entry_type;
  
  try {
    if (originalType === 'work' && newType !== 'work') {
      // Arbeit → Abwesenheit
      // 1. time_entry löschen
      await supabase.from("time_entries").delete().eq("id", entry.id);
      // 2. leave_request erstellen (direkt genehmigt)
      await supabase.from("leave_requests").insert({
        user_id: selectedUserId,
        type: newType,
        start_date: entry.work_date,
        end_date: entry.work_date,
        status: "approved",
        reason: `Admin-Umwandlung: ${reason}`,
      });
      toast.success("Eintrag zu " + (newType === 'vacation' ? 'Urlaub' : newType === 'sick' ? 'Krankheit' : 'Überstundenabbau') + " umgewandelt");
      
    } else if (originalType !== 'work' && newType === 'work') {
      // Abwesenheit → Arbeit
      // leave_request löschen
      if (entry.leave_id) {
        await supabase.from("leave_requests").delete().eq("id", entry.leave_id);
      }
      toast.info("Abwesenheit entfernt. Mitarbeiter muss Arbeitszeit manuell erfassen.");
      
    } else if (originalType !== 'work' && newType !== 'work' && originalType !== newType) {
      // Abwesenheit → andere Abwesenheit (z.B. Urlaub → Überstundenabbau)
      if (entry.leave_id) {
        await supabase.from("leave_requests")
          .update({ 
            type: newType, 
            reason: `Umgewandelt von ${originalType}: ${reason}` 
          })
          .eq("id", entry.leave_id);
      }
      toast.success("Eintragstyp geändert");
    }
    
    loadMonthData();
  } catch (error: any) {
    toast.error(error.message || "Fehler bei der Typänderung");
  }
};
```

---

### Änderung 6: AdminTimeTrackingView - Gutschriften ohne Feiertage

**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`

**Zeile 285-289 ändern:**
```typescript
// ALT:
const creditMinutes = useMemo(() => 
  combinedEntries
    .filter(e => ['sick', 'vacation', 'holiday', 'overtime_reduction', 'medical'].includes(e.entry_type))
    .reduce((sum, e) => sum + (e.minutes || 0), 0),
  [combinedEntries]
);

// NEU (ohne 'holiday'):
const creditMinutes = useMemo(() => 
  combinedEntries
    .filter(e => ['sick', 'vacation', 'overtime_reduction', 'medical'].includes(e.entry_type))
    .reduce((sum, e) => sum + (e.minutes || 0), 0),
  [combinedEntries]
);
```

**Tooltip-Anzeige anpassen (Zeile 512-516):**
```typescript
// Feiertage-Zeile entfernen oder anpassen:
{combinedEntries.filter(e => e.entry_type === 'holiday').length > 0 && (
  <div className="flex justify-between gap-4">
    <span>🎉 Feiertage:</span>
    <span>{combinedEntries.filter(e => e.entry_type === 'holiday').length} Tage (kein Soll)</span>
  </div>
)}
```

---

## Zusammenfassung der Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `TimeTrackingView.tsx` | `holidayMinutes` aus `totalCredit` entfernen |
| 2 | `useCombinedTimeEntries.ts` | Feiertage mit `minutes: 0` statt `dailyMinutes` |
| 3 | `AdminTimeTrackingView.tsx` | Bearbeiten-Button für Abwesenheiten aktivieren |
| 4 | `AdminTimeTrackingView.tsx` | `creditMinutes` ohne Feiertage berechnen |
| 5 | `AdminTimeTrackingView.tsx` | `handleTypeChange` Funktion implementieren |
| 6 | `AdminTimeEntryEditor.tsx` | Typ-Dropdown und Warnhinweise hinzufügen |

---

## Weitere offene Punkte

### 4. Was fehlt noch?

**Bereits implementiert:**
- Monatssoll dynamisch berechnet
- Gutschrift-Modell für Abwesenheiten
- Saldo-Korrekturen für Admins
- Audit-Trail für Bearbeitungen

**Noch zu prüfen/implementieren:**

1. **Jahresübergreifender Saldo:** Aktuell werden Korrekturen nicht monatsbezogen gespeichert - sie gelten für alle Monate. Soll das so sein?

2. **Urlaubskontingent-Rückgabe:** Wenn Urlaub → Überstundenabbau, wird der Urlaubstag automatisch zurückgegeben? → Muss geprüft werden ob vacation_balance korrekt aktualisiert.

3. **Hochrechnung (projectionTotals):** Zeile 325 filtert noch auf `'holiday'` - muss angepasst werden.

4. **Datenbereinigung:** Bestehende time_entries an Feiertagen sollten optional bereinigt werden können.

5. **Export-Funktion:** PDF/Excel-Export der Zeiten für Mitarbeiter und Admin.

---

## Erwartete Ergebnisse

1. **Feiertage korrekt:** Feiertage reduzieren das Soll, geben aber keine Gutschrift
2. **Admin kann Abwesenheiten bearbeiten:** Urlaubstag zu Überstundenabbau umwandeln
3. **Admin kann Arbeitszeit zu Abwesenheit umwandeln:** und umgekehrt
4. **Urlaubskontingent korrekt:** Bei Typwechsel wird Urlaubstag zurückgegeben

**Beispiel Januar 2026 (korrigiert):**
```
Arbeitstage im Monat: 22
Feiertage: 2 (Neujahr, Hl. Drei Könige)
→ Effektive Arbeitstage: 20

Soll: 20 × 7.9h = 158h
Gearbeitet: 16 Tage = 126:24
Urlaub: 2 Tage = 15:48 (Gutschrift)
Krankheit: 2 Tage = 15:48 (Gutschrift)
Gesamt-Ist: 126:24 + 15:48 + 15:48 = 158:00
Saldo: 0h ✓
```

(Feiertage erscheinen in der Liste mit 0h, zählen aber nicht zur Gutschrift, da sie das Soll bereits reduzieren)
