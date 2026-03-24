

## Briefing + Rückmeldung verzahnen

### Konzept

Das Briefing (schreibgeschützte Terminvorbereitung) wird direkt in den Feedback-Workflow integriert. Wenn ein Termin eine Vorbereitung hat, wird das Briefing prominent oberhalb der Feedback-Aktionen angezeigt. Der Nutzer kann direkt im Briefing-Kontext Notizen hinterlassen, Aufgaben erstellen und den Termin als erledigt markieren — alles in einem Fluss.

### Architektur

```text
┌──────────────────────────────────────────┐
│  AppointmentFeedbackWidget               │
│  ┌────────────────────────────────────┐  │
│  │ Termin-Karte (bestehend)           │  │
│  │  Titel · Zeit · Ort · Kategorie   │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ 📋 BRIEFING (aufklappbar)    │  │  │
│  │  │  Gesprächspartner, Themen,   │  │  │
│  │  │  Ablauf, Notizen etc.        │  │  │
│  │  │  (AppointmentBriefingView)   │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  [Erledigt] | [Notiz] [Aufgabe]   │  │
│  │  [Anhang]                          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Umsetzung

**1. Build-Fehler beheben** (`briefingPdfGenerator.ts`)
- Die Funktion `renderCircularAvatar` wird referenziert aber existiert nicht. Entweder als lokale Hilfsfunktion implementieren (Canvas → circular crop → data URL) oder den Variablennamen korrigieren.

**2. Briefing in Feedback-Widget einbetten** (`AppointmentFeedbackWidget.tsx`)
- Für jeden Termin mit `feedback_status === 'pending'` prüfen, ob eine `appointment_preparation` existiert (via `appointment_id`).
- Neuer Query in `useAppointmentFeedback` oder direkt im Widget: Lade `appointment_preparations` für die angezeigten Termin-IDs.
- Im Termin-Block einen aufklappbaren Bereich mit `AppointmentBriefingView` einfügen, zwischen Header und Aktions-Buttons.
- Toggle-Button „Briefing anzeigen/ausblenden" mit Chevron-Icon.

**3. Feedback als "erledigt" markieren bei Briefing-Nutzung**
- Wenn der Nutzer über das Briefing eine Notiz hinterlässt oder eine Aufgabe erstellt, wird `feedback_status` automatisch auf `completed` gesetzt (wie bisher).
- Neuer Button „Briefing gelesen & erledigt" als Alternative zu „Erledigt", der signalisiert, dass das Briefing bewusst zur Kenntnis genommen wurde.

**4. Daten-Verknüpfung** (`useAppointmentFeedback.tsx`)
- Nach dem Laden der Termine: Batch-Query auf `appointment_preparations` mit `.in('appointment_id', appointmentIds)`.
- Die Preparation-Daten als Map bereitstellen und im Widget nutzen.

### Dateien

| Datei | Änderung |
|---|---|
| `briefingPdfGenerator.ts` | Build-Fehler: `renderCircularAvatar` Funktion implementieren |
| `useAppointmentFeedback.tsx` | Preparations für angezeigte Termine mitladen |
| `AppointmentFeedbackWidget.tsx` | Briefing-View aufklappbar einbetten, oberhalb der Aktions-Buttons |
| `AppointmentBriefingView.tsx` | Evtl. kompaktere Variante für Inline-Darstellung (optional prop `compact`) |

