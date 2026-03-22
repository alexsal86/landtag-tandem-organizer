

## Zwei Themen: Auto-Save optimieren + Briefing im Dashboard

### Problem 1: Auto-Save refresht die ganze Seite

**Ursache:** Die Kette ist: `handleFieldChange` → `debouncedSave` (500ms) → `onUpdate` → `updatePreparation` → `fetchPreparation()`. Nach jedem Save wird die gesamte Preparation neu vom Server geladen, was den lokalen State überschreibt und die UI "springt".

**Lösung:**

1. **`useAppointmentPreparation.tsx`**: `updatePreparation` soll nach dem DB-Update **nicht** `fetchPreparation()` aufrufen, sondern den lokalen State optimistisch aktualisieren (`setPreparation(prev => ({ ...prev, ...updates }))`).
2. **`AppointmentPreparationDataTab.tsx`**: Debounce von 500ms auf **2000ms** erhöhen. Toast bei Auto-Save entfernen (nur bei manuellem Save anzeigen). Der `useEffect` auf `[preparation]` (Zeile 132-149), der den lokalen State zurücksetzt, muss so angepasst werden, dass er nur bei echten externen Änderungen greift (z.B. per Ref-Vergleich), nicht nach eigenem Save.

### Problem 2: Briefing im Dashboard

**Konzept:** In `TodaySchedule.tsx` wird für jeden Termin geprüft, ob eine `appointment_preparation` existiert. Falls ja:
- Ein **Briefing-Icon-Button** (z.B. `FileText`) erscheint rechts am Termin
- Ein **Chevron** zum Aufklappen der Briefing-Kurzfassung direkt unter dem Termin
- Beim Klick auf den Briefing-Button wird ein **Briefing-PDF** generiert (via Edge Function oder clientseitig)

**Umsetzung:**

1. **`TodaySchedule.tsx`**: Erweitern um einen Join auf `appointment_preparations` (über `appointment_id`). Für Termine mit Vorbereitung:
   - Chevron-Button → Toggle für inline `AppointmentBriefingView` (kompakt)
   - PDF-Button → Generiert ein Briefing-PDF

2. **Briefing-PDF**: Da keine Server-Side-Rendering möglich ist, clientseitig mit einer leichtgewichtigen Library (z.B. `jspdf` oder `html2canvas` + `jspdf`). Die `AppointmentBriefingView`-Daten werden als strukturiertes PDF gerendert.

3. **Neuer State** in TodaySchedule: `expandedAppointmentId` für das Auf-/Zuklappen, plus die geladenen Preparation-Daten.

### Dateien

| Datei | Änderung |
|---|---|
| `useAppointmentPreparation.tsx` | Optimistisches Update statt Refetch |
| `AppointmentPreparationDataTab.tsx` | Debounce auf 2s, kein Toast bei Auto-Save, useEffect-Guard |
| `TodaySchedule.tsx` | Briefing-Link, Chevron-Expand, Preparation-Daten laden |
| Neue Utility / Edge Function | Briefing-PDF-Generierung |

