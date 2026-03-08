

## Plan: Termine-Card mit Titel und Separator

### Was sich ändert

1. **`src/components/MyWorkView.tsx`** (Zeilen 463-466): Die Card bekommt `CardHeader` mit `CardTitle` "Deine Termine heute/morgen" (mit 📅 Emoji), und der Inhalt kommt in `CardContent`.

2. **`src/components/dashboard/DashboardAppointments.tsx`**: 
   - Die `<h3>` Überschrift "Deine Termine heute" (Zeile 117-119) wird entfernt, da sie jetzt als Card-Titel im Parent sitzt.
   - Eine `<Separator />` wird zwischen dem Special-Day-Hinweis / den kontextuellen Nachrichten und der Terminliste eingefügt, um die Bereiche visuell zu trennen.
   - Der Titel (heute/morgen) wird als Prop oder direkt aus `data.isShowingTomorrow` im Parent genutzt.

### Konkreter Aufbau der Card

```text
┌─ CardHeader ──────────────────────────┐
│ 📅 Deine Termine heute               │
├─ CardContent ─────────────────────────┤
│ Rollenzeile (italic)                  │
│ Kontextuelle Nachricht                │
│                                       │
│ [Special Day Hinweis]                 │
│                                       │
│ ── Separator ──────────────────────── │
│                                       │
│ Ganzt.  Termin 1                      │
│ 18:00   Termin 2                      │
│                                       │
│ [Feedback Reminder]                   │
└───────────────────────────────────────┘
```

### Dateien
- `src/components/MyWorkView.tsx` — Card mit CardHeader/CardTitle/CardContent wrappen
- `src/components/dashboard/DashboardAppointments.tsx` — h3 entfernen, Separator einfügen

