

## Briefing direkt im Dashboard anzeigen — vor Terminbeginn

### Problem
Aktuell erscheinen Termine im Feedback-Widget erst **nach** Terminende (`.lte('end_time', now)`). Das Briefing ist damit erst nach dem Termin zugänglich. Der Abgeordnete sitzt aber **vor** dem Termin im Dashboard und will das Briefing dort sehen und ggf. schon Notizen hinterlassen.

### Lösung
Die Terminliste im Dashboard-Greeting zeigt bereits heutige/morgige Termine an. Wir machen jeden Termin, der eine Vorbereitung hat, direkt klickbar — mit einem aufklappbaren Briefing-Bereich inline im Dashboard.

### Umsetzung

**1. Neue Komponente: `DashboardAppointmentList`**
- Ersetzt die reine Text-Auflistung der Termine in `DashboardGreetingSection` (Zeilen 76-84)
- Jeder Termin wird als kompakte Zeile dargestellt (Zeit + Titel)
- Termine mit Vorbereitung erhalten ein 📋-Icon/Button
- Klick öffnet ein aufklappbares `AppointmentBriefingView` (compact-Modus) direkt darunter
- Zusätzlich: Quick-Action-Buttons für „Notiz" und „Aufgabe erstellen" unterhalb des Briefings

**2. Daten laden: Preparations für Dashboard-Termine**
- In `DashboardGreetingSection` (oder der neuen Komponente): Query auf `appointment_preparations` für die IDs der angezeigten Termine
- Die Dashboard-Appointments haben eine `id` — damit Batch-Query `.in('appointment_id', ids)`
- Nur laden wenn Termine vorhanden sind

**3. Feedback vor Terminbeginn ermöglichen**
- `useAppointmentFeedback` Zeitfilter erweitern: Neben vergangenen Terminen (letzte 7 Tage) auch heutige/morgige Termine einbeziehen, die eine Vorbereitung haben
- Alternativ: Eigener leichtgewichtiger Hook für Dashboard-Briefing-Aktionen (Notiz speichern, Aufgabe erstellen), der unabhängig vom Feedback-Widget arbeitet
- Wenn eine Notiz/Aufgabe aus dem Dashboard-Briefing erstellt wird, wird automatisch ein `appointment_feedback`-Eintrag angelegt (Status: `completed`), sodass der Termin nach dem Ende nicht mehr als offene Rückmeldung erscheint

**4. Anpassungen `DashboardGreetingSection`**
- Termin-Platzhalter `{{APPOINTMENTS_PLACEHOLDER}}` statt inline Text
- Neue Komponente dort rendern mit Collapsible-Briefings

### Dateien

| Datei | Änderung |
|---|---|
| `src/components/dashboard/DashboardAppointmentList.tsx` | **Neu**: Termin-Liste mit klickbaren Briefings, Notiz-/Aufgaben-Buttons |
| `src/components/dashboard/DashboardGreetingSection.tsx` | Termine über neue Komponente rendern statt als reinen Text |
| `src/hooks/useAppointmentFeedback.tsx` | Zeitfilter erweitern: auch zukünftige Termine mit Preparation einbeziehen |
| `src/components/appointment-preparations/AppointmentBriefingView.tsx` | Ggf. kleinere Anpassungen für Dashboard-Kontext |

