
# Plan: Zeiterfassung - Kritische Fehler beheben

## Zusammenfassung der Probleme

| Problem | Ursache | Lösung |
|---------|---------|--------|
| **Netto = Brutto** | DB-Trigger `time_entries_calculate_net` wurde nie erstellt | Trigger erstellen + bestehende Daten korrigieren |
| **Feiertage fehlen** (01.01., 06.01.) | Hook überspringt Feiertage wenn Arbeitseintrag existiert | Logik umkehren: Feiertage haben Priorität |
| **Urlaub fehlt** (02.01.) | Hook überspringt Urlaub wenn Arbeitseintrag existiert | Logik umkehren: Urlaub hat Priorität |

---

## 1. Datenbank-Trigger erstellen

**Problem:** Die Funktion `ensure_net_minutes` existiert, aber der Trigger wurde nie erstellt.

**SQL-Migration:**
```sql
-- Trigger erstellen (falls noch nicht vorhanden)
DROP TRIGGER IF EXISTS time_entries_calculate_net ON time_entries;

CREATE TRIGGER time_entries_calculate_net
BEFORE INSERT OR UPDATE ON time_entries
FOR EACH ROW EXECUTE FUNCTION ensure_net_minutes();

-- Bestehende Einträge korrigieren
UPDATE time_entries
SET minutes = ROUND(EXTRACT(EPOCH FROM (ended_at - started_at))/60) - COALESCE(pause_minutes, 0)
WHERE started_at IS NOT NULL 
  AND ended_at IS NOT NULL;
```

---

## 2. Hook `useCombinedTimeEntries` korrigieren

**Aktuelles (falsches) Verhalten:**
1. Arbeitseinträge werden ZUERST hinzugefügt
2. Feiertage/Urlaub werden ÜBERSPRUNGEN wenn Arbeitseintrag existiert

**Neues (korrektes) Verhalten:**
1. **Priorität 1:** Feiertage - werden IMMER angezeigt (kein Arbeiten an Feiertagen)
2. **Priorität 2:** Urlaub/Krankheit - werden angezeigt (statt Arbeit)
3. **Priorität 3:** Arbeitseinträge - NUR wenn kein Feiertag/Urlaub an diesem Tag

**Geänderte Logik in `useCombinedTimeEntries.ts`:**

```typescript
export function useCombinedTimeEntries({...}): CombinedTimeEntry[] {
  return useMemo(() => {
    const combined: CombinedTimeEntry[] = [];
    const config = typeConfig;
    
    // Hilfsfunktionen für Datum-Checks
    const holidayDates = new Set(
      holidays
        .filter(h => {
          const d = parseISO(h.holiday_date);
          return d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6;
        })
        .map(h => h.holiday_date)
    );
    
    const vacationDates = new Set<string>();
    vacationLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => vacationDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {}
    });
    
    const sickDates = new Set<string>();
    sickLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => sickDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {}
    });
    
    const overtimeDates = new Set<string>();
    overtimeLeaves.filter(l => l.status === 'approved').forEach(leave => {
      try {
        eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
          .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
          .forEach(day => overtimeDates.add(format(day, 'yyyy-MM-dd')));
      } catch (e) {}
    });

    // 1. PRIORITÄT: Feiertage (IMMER anzeigen)
    holidays.forEach(holiday => {
      const holidayDate = parseISO(holiday.holiday_date);
      if (holidayDate < monthStart || holidayDate > monthEnd) return;
      if (holidayDate.getDay() === 0 || holidayDate.getDay() === 6) return;
      
      combined.push({
        id: `holiday-${holiday.id}`,
        work_date: holiday.holiday_date,
        started_at: null,
        ended_at: null,
        minutes: dailyMinutes,
        pause_minutes: 0,
        notes: holiday.name,
        entry_type: 'holiday',
        is_editable: false,
        is_deletable: false,
        holiday_id: holiday.id,
        type_label: config.holiday.label,
        type_icon: config.holiday.icon,
        type_class: config.holiday.className,
      });
    });

    // 2. PRIORITÄT: Krankmeldungen (nur wenn KEIN Feiertag)
    sickLeaves.filter(l => l.status === 'approved').forEach(leave => {
      eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
        .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
        .forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (holidayDates.has(dateStr)) return; // Feiertag hat Vorrang
          if (combined.some(c => c.work_date === dateStr)) return; // Bereits eingetragen
          
          combined.push({...sick entry...});
        });
    });

    // 3. PRIORITÄT: Urlaub (nur wenn KEIN Feiertag und KEINE Krankheit)
    vacationLeaves.filter(l => l.status === 'approved').forEach(leave => {
      eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
        .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
        .forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (holidayDates.has(dateStr)) return; // Feiertag hat Vorrang
          if (sickDates.has(dateStr)) return; // Krankheit hat Vorrang
          if (combined.some(c => c.work_date === dateStr)) return;
          
          combined.push({...vacation entry...});
        });
    });

    // 4. PRIORITÄT: Überstundenabbau
    overtimeLeaves.filter(l => l.status === 'approved').forEach(leave => {
      eachDayOfInterval({ start: parseISO(leave.start_date), end: parseISO(leave.end_date) })
        .filter(d => d >= monthStart && d <= monthEnd && d.getDay() !== 0 && d.getDay() !== 6)
        .forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (holidayDates.has(dateStr)) return;
          if (sickDates.has(dateStr)) return;
          if (vacationDates.has(dateStr)) return;
          if (combined.some(c => c.work_date === dateStr)) return;
          
          combined.push({...overtime entry...});
        });
    });

    // 5. PRIORITÄT: Arzttermine (können parallel zu Arbeit existieren)
    medicalLeaves.filter(l => l.status === 'approved').forEach(leave => {
      const dateStr = leave.start_date;
      const date = parseISO(dateStr);
      if (date < monthStart || date > monthEnd) return;
      // Arzttermine werden IMMER hinzugefügt (können zusätzlich zur Arbeit sein)
      combined.push({...medical entry...});
    });

    // 6. PRIORITÄT: Arbeitseinträge (NUR wenn kein Feiertag/Urlaub/Krankheit/Überstundenabbau)
    entries.forEach(e => {
      const dateStr = e.work_date;
      
      // WICHTIG: Arbeitseinträge an Feiertagen/Urlaub/Krankheit NICHT anzeigen
      if (holidayDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Feiertag ignoriert: ${dateStr}`);
        return;
      }
      if (vacationDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Urlaubstag ignoriert: ${dateStr}`);
        return;
      }
      if (sickDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Krankheitstag ignoriert: ${dateStr}`);
        return;
      }
      if (overtimeDates.has(dateStr)) {
        console.warn(`Arbeitseintrag an Überstundenabbau-Tag ignoriert: ${dateStr}`);
        return;
      }
      
      combined.push({...work entry...});
    });

    combined.sort((a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime());
    return combined;
  }, [...]);
}
```

---

## 3. Visuelle Darstellung nach der Korrektur

**Vor der Korrektur (aktuell):**
```
01.01.2026  Arbeit   08:00  16:24  30 Min  8:24  8:24  Feiertag, System erkennt...
02.01.2026  Arbeit   08:00  16:24  30 Min  8:24  8:24  Urlaub, System verrechnet...
06.01.2026  Arbeit   08:00  16:24  30 Min  8:24  8:24  Feiertag, System erkennt...
```

**Nach der Korrektur:**
```
01.01.2026  🎉 Feiertag    -      -     0 Min  8:33  8:33  Neujahr
02.01.2026  🏖️ Urlaub      -      -     0 Min  8:33  8:33  Weihnachten
06.01.2026  🎉 Feiertag    -      -     0 Min  8:33  8:33  Heilige Drei Könige
07.01.2026  Arbeit   08:43  17:09  30 Min  8:26  7:56  -  ← Netto jetzt korrekt!
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| **SQL-Migration** | 1) Trigger `time_entries_calculate_net` erstellen, 2) Bestehende Einträge korrigieren |
| `src/hooks/useCombinedTimeEntries.ts` | Prioritätslogik umkehren: Feiertage > Urlaub > Krankheit > Arbeit |

---

## Wichtige Hinweise

1. **Bestehende Arbeitseinträge** an Feiertagen/Urlaubstagen werden **nicht gelöscht**, aber **nicht mehr angezeigt** in der kombinierten Liste
2. Der Admin sollte prüfen, ob diese Einträge manuell gelöscht werden sollen
3. Neue Einträge an Feiertagen/Urlaubstagen können weiterhin erstellt werden (für Sonderfälle), aber die Anzeige priorisiert Feiertage/Urlaub

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| SQL-Migration (Trigger + Datenkorrektur) | 5 Min |
| Hook-Logik umschreiben | 20 Min |
| Testen | 10 Min |
| **Gesamt** | **~35 Min** |
