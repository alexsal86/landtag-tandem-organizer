

## Briefing Live-Ansicht für Tablet

### Konzept

Eine neue, eigenständige Fullscreen-Seite `/briefing-live/:preparationId` — optimiert für Tablet-Nutzung während eines Termins. Sie zeigt das vollständige Briefing (read-only) und darunter direkt editierbare Bereiche für Notizen und Aufgaben. Kein Dialog, kein Overlay — alles auf einer Seite, scrollbar.

### Aufbau

```text
┌─────────────────────────────────────────────┐
│ ← Zurück          LIVE BRIEFING    [PDF] ↗ │
│ Termintitel · 14:00–15:30 · Rathaus        │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ Briefing (vollständig, read-only) ───┐ │
│  │  Gesprächspartner · Themen · Ablauf   │ │
│  │  Anlass · Notizen · Checkliste        │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌─ Meine Notizen (inline editierbar) ──┐ │
│  │  [SimpleRichTextEditor]               │ │
│  │  [Speichern]                          │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  ┌─ Aufgabe erstellen (inline) ─────────┐ │
│  │  Titel:    [_______________]          │ │
│  │  Priorität: [Medium ▾]  Fällig: [__] │ │
│  │  [Aufgabe erstellen]                  │ │
│  │  ── Erstellte Aufgaben ──             │ │
│  │  ✓ Aufgabe 1 · hoch · 01.04.         │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [✓ Termin als erledigt markieren]         │
│                                             │
└─────────────────────────────────────────────┘
```

### Zugang

Von überall, wo ein Briefing-Icon erscheint, wird ein Link/Button hinzugefügt:
- **Dashboard** (`DashboardAppointmentList`): Neuer Button "Live-Briefing öffnen" neben dem bestehenden 📋-Toggle
- **Rückmeldungen** (`AppointmentFeedbackWidget`): Link "Briefing öffnen" bei Terminen mit Preparation
- **Terminvorbereitung** (`AppointmentPreparationDetail`): Button im Briefing-Tab

### Umsetzung

**1. Neue Seite: `BriefingLivePage.tsx`**
- Route: `briefing-live` als neuer section-Case in `Index.tsx`
- URL-Parameter: `preparationId` (und optional `appointmentId`)
- Lädt Preparation via `useAppointmentPreparation` und Appointment-Info via Query
- Rendert `AppointmentBriefingView` (volle Variante, nicht compact)
- Darunter: Inline-Notizfeld mit `SimpleRichTextEditor` + Speichern-Button
- Darunter: Inline-Aufgabenformular (Titel, Beschreibung, Priorität, Fälligkeitsdatum) + Button
- Liste bereits erstellter Aufgaben aus dieser Session
- "Termin erledigt"-Button → erstellt/aktualisiert `appointment_feedback` mit Status `completed`
- Tablet-optimiert: große Touch-Targets, `max-w-3xl mx-auto`, großzügige Abstände

**2. Einstiegspunkte verknüpfen**
- `DashboardAppointmentList.tsx`: Bei Terminen mit Preparation einen "Live öffnen"-Button hinzufügen → navigiert zu `/?section=briefing-live&preparationId=X&appointmentId=Y`
- `AppointmentFeedbackWidget.tsx`: "Briefing öffnen"-Link bei Terminen mit Preparation
- `AppointmentPreparationDetail.tsx`: Button im Briefing-Tab-Header

**3. Feedback-Logik**
- `ensureFeedbackCompleted`-Logik wird in die neue Seite übernommen (upsert auf `appointment_feedback`)
- Beim Speichern einer Notiz oder Aufgabe wird automatisch der Feedback-Status auf `completed` gesetzt

### Dateien

| Datei | Änderung |
|---|---|
| `src/pages/BriefingLivePage.tsx` | **Neu**: Fullscreen-Briefing mit Inline-Notizen und Aufgaben |
| `src/pages/Index.tsx` | Neuer Case `briefing-live` → `BriefingLivePage` |
| `src/components/dashboard/DashboardAppointmentList.tsx` | "Live öffnen"-Button bei Terminen mit Preparation |
| `src/components/dashboard/AppointmentFeedbackWidget.tsx` | "Briefing öffnen"-Link |
| `src/pages/AppointmentPreparationDetail.tsx` | Button im Briefing-Tab |

