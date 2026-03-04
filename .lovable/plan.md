

## Analyse der 5 Punkte

### 1. Soll-Anzeige zeigt "7.9h" statt "7:54"
Zeile 909: `dailyHours.toFixed(1)` gibt `"7.9"` aus. Bei 39,5h/5d = 7,9h = 7h 54min. Die Anzeige muss im HH:MM-Format sein, also `fmt(dailyMinutes)` statt `dailyHours.toFixed(1)`.

### 2. Gutschriften-Tooltip: Stunden fehlen
Zeilen 949-978: Der Tooltip zeigt nur Tagesanzahlen ("3 Tage"), aber keine Stundensumme. Insbesondere bei Arztterminen (minutes_counted) und Teil-Überstundenabbau ist das irreführend. Lösung: Neben der Tagesanzahl auch die Minutensumme der jeweiligen Kategorie anzeigen, z.B. "3 Tage (23:42)".

### 3. Diskrepanz zwischen Monatskarten und Überstundensaldo
**Kernproblem in `useYearlyBalance.ts`:** Medizinische Termine werden **doppelt** gezählt:
- Zeile 84: `medical` wird in `monthAbsenceDates` aufgenommen
- Zeile 118-124: `dayBasedCredit` zählt **alle** Einträge in `monthAbsenceDates` × `dailyMin` — also auch medical als vollen Tag
- Zeile 127-136: `medicalCredit` addiert nochmal `minutes_counted`
- Ergebnis: Medical bekommt `dailyMin + minutes_counted` statt nur `minutes_counted`

**Fix:** Bei `dayBasedCredit` die medical-Tage ausfiltern (sie haben ihre eigene Berechnung). Dazu muss nachverfolgt werden, welche Absence-Dates von medical stammen.

### 4. Erinnerung bei fehlenden Einträgen
Neue Funktion: Nach x Tagen ohne Zeiteintrag soll eine Benachrichtigung an den Mitarbeiter gesendet werden. Dies erfordert eine Edge Function oder einen Cron-artigen Mechanismus. Alternativ: beim Login / beim Laden der "Meine Arbeit"-Seite prüfen, ob Einträge fehlen, und dann per `create_notification` RPC benachrichtigen.

### 5. Überstundenabbau soll Überstunden tatsächlich abbauen
**Aktuelles Verhalten:** Überstundenabbau wird als Gutschrift (`dailyMin`) gezählt. Da der Tag auch im Soll (`dailyMin`) steht, ist die Wirkung neutral (0 + dailyMin - dailyMin = 0). Überstunden werden also **nie** konsumiert.

**Korrektes Verhalten:** Ein Überstundenabbau-Tag soll den Saldo um `dailyMin` reduzieren. Dafür darf Überstundenabbau **keine Gutschrift** sein. Der Tag bleibt im Soll, es wird nichts gearbeitet, keine Gutschrift → Balance = -dailyMin. Das konsumiert korrekt die Überstunden.

---

## Umsetzungsplan

### A. Soll-Format korrigieren
**Datei:** `AdminTimeTrackingView.tsx`, Zeile 909
- `{dailyHours.toFixed(1)}h` → `{fmt(dailyMinutes)}` (gibt z.B. "7:54" aus)

### B. Gutschriften-Tooltip um Stunden erweitern
**Datei:** `AdminTimeTrackingView.tsx`, Zeilen 949-978
- Für jede Kategorie (Krankheit, Urlaub, Arzttermin, Überstundenabbau): die Minutensumme der jeweiligen Einträge berechnen und neben der Tageszahl anzeigen, z.B. `"3 Tage (23:42)"`.

### C. useYearlyBalance: Credit-Berechnung korrigieren
**Datei:** `useYearlyBalance.ts`
1. **Medical aus dayBasedCredit ausfiltern:** Separate Menge `medicalAbsenceDates` führen. Bei `dayBasedCredit` (Zeile 118-124) nur Nicht-Medical-Absence-Dates zählen. Medical behält seine eigene `medicalCredit`-Berechnung.
2. **Overtime_reduction aus Credits entfernen:** `overtime_reduction` nicht mehr in `dayBasedCredit` zählen. Stattdessen separate Menge `overtimeReductionDates`. Damit wird Überstundenabbau-Tagen keine Gutschrift gegeben → Balance sinkt um `dailyMin` pro Tag → Überstunden werden abgebaut.
3. Overtime_reduction-Tage aber weiterhin in `monthAbsenceDates` belassen, damit etwaige Arbeitszeiteinträge an dem Tag nicht doppelt gezählt werden.

### D. Admin-Karten: Überstundenabbau separat darstellen
**Datei:** `AdminTimeTrackingView.tsx`
- `creditMinutes` (Zeile 458-463): `overtime_reduction` aus dem Filter entfernen. Überstundenabbau ist keine Gutschrift mehr.
- Neuer `overtimeReductionMinutes`-Wert für separate Anzeige.
- Monatssaldo-Berechnung: `totalActual = workedMinutes + creditMinutes` (ohne Überstundenabbau). Die Überstunden werden korrekt durch das Soll-Defizit abgebaut.
- Im Gutschriften-Tooltip: Überstundenabbau gesondert kennzeichnen (z.B. "⏰ Überstundenabbau: 2 Tage (15:48) — reduziert Saldo").

### E. Erinnerung bei fehlenden Zeiteinträgen
**Ansatz:** Client-seitige Prüfung beim Laden der Mitarbeiter-Zeitübersicht (oder "Meine Arbeit"). Beim Laden wird geprüft, ob in den letzten x Tagen Werktage ohne Eintrag existieren. Falls ja:
- Nach x Tagen (konfigurierbar, Standard: 3): Toast-Hinweis
- Nach y Tagen (Standard: 7): `create_notification` RPC an den Mitarbeiter
- Prüfung nur einmal pro Session (via State/localStorage-Flag)

**Dateien:**
- Neuer Hook `useTimeEntryReminder.ts`: prüft fehlende Einträge, sendet ggf. Notification
- Integration in `MyWorkTimeTab.tsx` oder vergleichbare Komponente

### F. Überstundenabbau-Validierung anpassen
Die bestehende Validierung (Zeile 362-365) bleibt bestehen, muss aber angepasst werden: Da Überstundenabbau nun den Saldo tatsächlich reduziert, stimmt die Validierung `yearlyBalance < dailyMinutes` weiterhin — man kann nur abbauen, was man hat.

---

## Zusammenfassung der betroffenen Dateien
- `src/components/admin/AdminTimeTrackingView.tsx` — Punkte A, B, D, F
- `src/hooks/useYearlyBalance.ts` — Punkt C
- `src/hooks/useTimeEntryReminder.ts` (neu) — Punkt E
- Integration in Employee-View — Punkt E

