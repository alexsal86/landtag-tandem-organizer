# Plan: Zeiterfassung - Gutschrift-Modell & Admin-Übersicht

## ✅ Abgeschlossen

### 1. Gutschrift-Modell implementiert (TimeTrackingView.tsx)

**Änderungen:**
- `monthlyTotals` berechnet jetzt alle Abwesenheitstypen als Gutschriften:
  - 🎉 Feiertage
  - 🤒 Krankheit
  - 🏖️ Urlaub
  - ⏰ Überstundenabbau
  - 🏥 Arzttermine
- Arbeitseinträge an Feiertagen/Urlaub/Krankheit werden **nicht** zur Arbeitszeit gezählt
- Formel: `Gesamt-Ist = Gearbeitet + Gutschriften`
- UI zeigt Gutschriften mit Tooltip-Aufschlüsselung

**Beispiel Januar 2026:**
- Soll: 150:06 (19 AT × 7.9h)
- Gearbeitet: 126:24 (16 Tage)
- Gutschriften: +23:42 (2× Urlaub, 1× Feiertag)
- **Gesamt-Ist: 150:06 → Saldo: 0h ✓**

### 2. Hochrechnung korrigiert (projectionTotals)

- Verwendet jetzt `combinedEntries` statt rohe `entries`
- Gutschriften werden auch in der Hochrechnung berücksichtigt
- Zeigt: Gearbeitet + Gutschriften = Gesamt-Ist

### 3. Admin-Zeiterfassung synchronisiert (AdminTimeTrackingView.tsx)

**Änderungen:**
- Verwendet jetzt `useCombinedTimeEntries` Hook
- Zeittabelle zeigt alle Eintragstypen (Arbeit, Urlaub, Krank, Feiertage)
- 5 Übersichtskarten statt 4:
  - Soll (dynamisch)
  - Gearbeitet
  - **Gutschriften** (NEU, mit Tooltip)
  - Saldo
  - Aktionen
- Farbige Zeilen für verschiedene Eintragstypen
- `workedMinutes` zählt nur echte Arbeit
- `creditMinutes` zählt alle Abwesenheiten
- `balanceMinutes = (worked + credit) - target + corrections`

---

## 🔜 Noch offen

### Admin-Editor mit Typwechsel
- Dropdown für Eintragstyp (Arbeit → Urlaub/Krank/Überstundenabbau)
- Typwechsel-Logik mit korrekter Verrechnung

### Datenbereinigung
- Cleanup-Query für historische Einträge an Feiertagen/Abwesenheiten

### Weitere Features (optional)
- Jahresübersicht pro Mitarbeiter
- Export der Zeiten (PDF/Excel)
- Massen-Aktionen für Admin

---

## Technische Details

### Gutschrift-Berechnung (TimeTrackingView.tsx, Zeile 203-296)

```typescript
// Gutschriften berechnen (ohne Doppelzählung bei Feiertagen)
const sickMinutes = [...sickDates].filter(d => !holidayDates.has(d)).length * dailyMinutes;
const vacationMinutes = [...vacationDates].filter(d => !holidayDates.has(d) && !sickDates.has(d)).length * dailyMinutes;
const overtimeMinutes = [...overtimeDates].filter(...).length * dailyMinutes;
const holidayMinutes = [...holidayDates].filter(...).length * dailyMinutes;
const medicalMinutes = medicalLeaves.reduce(...);

const totalCredit = sickMinutes + vacationMinutes + overtimeMinutes + holidayMinutes + medicalMinutes;
const totalActual = worked + totalCredit;
const difference = totalActual - target;
```

### Admin-Ansicht (AdminTimeTrackingView.tsx)

```typescript
// Combined entries für alle Eintragstypen
const combinedEntries = useCombinedTimeEntries({
  entries: timeEntries,
  sickLeaves, vacationLeaves, medicalLeaves, overtimeLeaves,
  holidays, monthStart, monthEnd, dailyMinutes,
});

// Nur echte Arbeit zählen
const workedMinutes = combinedEntries.filter(e => e.entry_type === 'work').reduce(...);

// Alle Abwesenheiten als Gutschrift
const creditMinutes = combinedEntries.filter(e => 
  ['sick', 'vacation', 'holiday', 'overtime_reduction', 'medical'].includes(e.entry_type)
).reduce(...);

// Saldo = Ist - Soll + Korrekturen
const totalActual = workedMinutes + creditMinutes;
const balanceMinutes = totalActual - monthlyTargetMinutes + totalCorrectionMinutes;
```
