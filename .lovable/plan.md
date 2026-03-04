

## Analyse

### 1. Monatssaldo berücksichtigt Überstundenabbau nicht
`balanceMinutes = totalActual - monthlyTargetMinutes` (Zeile 768), wobei `totalActual = workedMinutes + creditMinutes` (Zeile 765). Überstundenabbau fehlt hier komplett. Der Monatssaldo muss den Überstundenabbau abziehen. Außerdem soll die Monatssaldo-Card einen Tooltip bekommen wie die Monats-Badges im Überstundensaldo.

### 2. "Gearbeitet" Diskrepanz Cards vs. Überstundensaldo
Die Cards berechnen `workedMinutes` aus `combinedEntries` (nur aktueller Monat), während `useYearlyBalance` die Daten direkt aus Supabase lädt. In `useYearlyBalance` werden Arbeitseinträge an Abwesenheitstagen gefiltert (`monthAbsenceDates`), aber `combinedEntries` filtert ebenfalls — die Logik sollte identisch sein. Das Problem: `useYearlyBalance` filtert `monthWorked` an ALLEN `monthAbsenceDates` inkl. `overtime_reduction`-Tagen. Falls ein Mitarbeiter an einem Überstundenabbau-Tag trotzdem einen Arbeitseintrag hat, wird dieser in `useYearlyBalance` ignoriert, aber in den Cards möglicherweise angezeigt (oder umgekehrt). Die Werte müssen konsistent sein.

### 3. Tooltip im Überstundensaldo zeigt keine Gutschriften für laufenden Monat
Die `MonthlyBreakdown` aus `useYearlyBalance` hat `creditMinutes`, aber der Tooltip (Zeile 887-890) zeigt sie schon an. Problem: Wenn der aktuelle Monat März ist und `mEffectiveEnd = today`, werden Gutschriften für März korrekt berechnet, ABER der Tooltip zeigt nur `mb.creditMinutes` — das muss geprüft werden ob es tatsächlich 0 ist bei Franziska März. Da `overtime_reduction` aus Credits rausgefiltert wurde und keine anderen Abwesenheiten im März existieren, ist `creditMinutes = 0` korrekt. Was fehlt: Überstundenabbau wird im Tooltip nicht angezeigt.

### 4. Überstundenabbau im Tooltip und Aufschlüsselung
Der Tooltip bei den Monats-Badges zeigt nur Soll/Gearbeitet/Gutschriften/Saldo. Überstundenabbau fehlt. Die Aufschlüsselungs-Tabelle hat keine Überstundenabbau-Spalte. `MonthlyBreakdown` muss um `overtimeReductionMinutes` erweitert werden.

### 5. Anfangsbestand für Überstunden aus dem Vorjahr
Es soll möglich sein, einen Übertrag vom Vorjahr einzutragen. Das kann über eine spezielle Korrektur am 01.01. des Jahres gelöst werden, mit einem dedizierten UI-Element.

---

## Umsetzungsplan

### A. MonthlyBreakdown erweitern
**Datei:** `src/types/timeTracking.ts`
- `overtimeReductionMinutes: number` hinzufügen

### B. useYearlyBalance: Überstundenabbau tracken
**Datei:** `src/hooks/useYearlyBalance.ts`
- Überstundenabbau-Minuten pro Monat berechnen (Anzahl overtimeReductionDates × dailyMin)
- In `monthlyBreakdown` als `overtimeReductionMinutes` speichern
- `monthBalance = monthWorked + monthCredit - monthTarget` bleibt korrekt (overtime_reduction hat keine Gutschrift, also wirkt es automatisch als Defizit)

### C. Monatssaldo-Card: Überstundenabbau abziehen + Tooltip
**Datei:** `AdminTimeTrackingView.tsx`
- `balanceMinutes = totalActual - monthlyTargetMinutes` → Das ist bereits korrekt, WENN `totalActual` keinen Überstundenabbau enthält (tut es nicht). Aber die Monatssaldo-Karte muss trotzdem einen Tooltip bekommen mit Aufschlüsselung (Soll, Gearbeitet, Gutschriften, ÜA-Abbau, Saldo).

### D. Tooltips bei Monats-Badges: Überstundenabbau anzeigen
**Datei:** `AdminTimeTrackingView.tsx`, Zeilen 876-897
- Neue Zeile für Überstundenabbau: `mb.overtimeReductionMinutes`
- Saldo-Formel im Tooltip: Gearbeitet + Gutschriften − Soll (Überstundenabbau ist implizit, da keine Gutschrift)

### E. Aufschlüsselungs-Dialog: Überstundenabbau-Spalte
**Datei:** `AdminTimeTrackingView.tsx`, Zeilen 1472-1522
- Neue Spalte "ÜA-Abbau" in der Tabelle
- Wert aus `mb.overtimeReductionMinutes`

### F. Anfangsbestand aus Vorjahr
**Datei:** `AdminTimeTrackingView.tsx`
- Im Korrektur-Dialog: Option "Übertrag aus Vorjahr" hinzufügen
- Setzt `correction_date` auf den 01.01. des aktuellen Jahres
- Eigener Button in der Überstundensaldo-Card: "Anfangsbestand eintragen"
- Im Aufschlüsselungs-Dialog: Übertrag als erste Zeile anzeigen (Korrekturen am 01.01.)

### G. Konsistenz Cards vs. Überstundensaldo
Prüfen, ob `workedMinutes` in den Cards und `mb.workedMinutes` in `useYearlyBalance` gleich berechnet werden. Beide filtern Arbeit an Abwesenheitstagen raus — die Logik ist konsistent. Falls trotzdem Abweichungen auftreten, liegt es an der `effectiveEnd`-Logik in `useYearlyBalance` (begrenzt auf heute), während die Cards den gesamten Monat zeigen. Fix: sicherstellen, dass für vergangene Monate `mEffectiveEnd = mEnd` gilt.

