

## Analyse

### Problem 1: Laufende Summe (Gesamt-Ist) falsch bei mehreren Einträgen am selben Tag
Die Tabelle zeigt Einträge **absteigend** (neuester zuerst), aber die laufende Summe wird **aufsteigend** (chronologisch) berechnet. Bei zwei Einträgen am 13.01. sieht man zuerst den späteren Eintrag mit hoher Summe, dann den früheren mit niedrigerer Summe – die Zahl "springt zurück". Die Gesamt-Ist-Spalte muss in **Anzeigereihenfolge** (absteigend) akkumulieren, sodass die Zahl beim Lesen nach unten wächst.

### Problem 2: Überstundenabbau zählt nicht ins Gesamt-Ist
In `AdminTimeTrackingView.tsx` Zeile 448-453 enthält `creditMinutes` nur `sick`, `vacation`, `medical` – **nicht** `overtime_reduction`. Ebenso in `actualAfterEntryById` (Zeile 463) und in `useYearlyBalance.ts` (Zeile 84). Dadurch wird ein Überstundenabbau-Tag weder als Gutschrift gezählt noch reduziert er das Soll → der Mitarbeiter rutscht ins Minus.

**Konzept für Überstundenabbau:**
- Überstundenabbau soll wie Urlaub/Krankheit als Gutschrift (= `dailyMinutes`) ins Gesamt-Ist fließen
- Er reduziert damit den Jahresüberstundensaldo korrekt (Tag wird gutgeschrieben, aber der Mitarbeiter hat ja auch nicht gearbeitet → Saldo sinkt)
- **Validierung bei Antragstellung:** Überstundenabbau soll nur möglich sein, wenn genug Überstunden vorhanden sind (ganzer Tag = `dailyMinutes`, Teiltage ggf. anteilig). Das erfordert eine Prüfung des aktuellen Jahressaldos vor Genehmigung.

### Problem 3: Korrekturen werden bei jedem Monat angezeigt
In Zeile 981-983 wird `totalCorrectionMinutes` in der Monatssaldo-Karte angezeigt. Korrekturen sind aber jahresbezogen und sollen **nur** in der Jahres-Gesamtsumme erscheinen.

---

## Umsetzungsplan

### A. Gesamt-Ist in Anzeigereihenfolge berechnen
**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`
- Die `actualAfterEntryById`-Berechnung (Zeile 462-483) umstellen: statt chronologisch aufsteigend **absteigend** sortieren (wie die Tabelle), sodass die laufende Summe beim Lesen von oben nach unten wächst.
- `overtime_reduction` zum Set `actualTypes` hinzufügen.

### B. Überstundenabbau als Gutschrift zählen
**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`
- `creditMinutes` (Zeile 448-453): `overtime_reduction` zum Filter hinzufügen.
- `totalActual` und `balanceMinutes` fließen dann automatisch korrekt.

**Datei:** `src/hooks/useYearlyBalance.ts`
- Zeile 84: `overtime_reduction` in die Liste der Abwesenheitstypen aufnehmen, sodass Überstundenabbau-Tage als Gutschrift (`dailyMin`) in die Monatsberechnung einfließen.

### C. Validierung: Überstundenabbau nur bei positivem Saldo
**Datei:** `src/components/admin/AdminTimeTrackingView.tsx` (Eintrag erstellen)
- Beim Erstellen eines `overtime_reduction`-Eintrags: aktuellen `yearlyBalance` prüfen.
- Nur erlauben, wenn `yearlyBalance >= dailyMinutes` (ein ganzer Tag).
- Fehlermeldung anzeigen, falls nicht genug Überstunden vorhanden.

**Hinweis:** Für den Employee-Self-Service (Abwesenheitsanträge) sollte dieselbe Validierung greifen – das wird als Folgethema behandelt, sofern ein separater Antragsprozess existiert.

### D. Korrekturen nur in Jahressumme anzeigen
**Datei:** `src/components/admin/AdminTimeTrackingView.tsx`
- In der Monatssaldo-Karte (Zeile 981-983): den Korrektur-Hinweis entfernen.
- Korrekturen werden weiterhin in der Jahres-Karte (Zeile 826-829) und im Korrekturen-Tab angezeigt – nur nicht mehr im Monatskontext.

