

## Briefing-Ansicht für Abgeordnete + Build-Fehler beheben

### Konzept

Die Idee ist hervorragend. Die Terminvorbereitung (`appointment_preparations`) enthält bereits die relevanten Datenfelder — sie werden bisher nur in einer Editor-Ansicht für Mitarbeiter dargestellt. Die Briefing-Ansicht extrahiert die wichtigsten Informationen daraus in ein kompaktes, **read-only** Format, das der Abgeordnete schnell vor dem Termin scannen kann.

### Daten-Mapping (vorhandene Felder → Briefing-Sektionen)

```text
preparation_data Feld       → Briefing-Sektion
──────────────────────────────────────────────────
audience / facts_figures     → Organisation / Hintergrund
position_statements          → Meine Position / Linie
objectives                   → Was will ich erreichen?
questions_answers            → Mögliche kritische Fragen
key_topics (neu nutzen)      → Kernbotschaft
checklist_items (incomplete) → ToDos vor Termin
companions                   → Begleitpersonen (kompakt)
program                      → Ablauf (kompakt)
```

Kein neues DB-Schema nötig — die Felder existieren bereits in `preparation_data` (JSON).

### Umsetzung

**1. Neue Komponente `AppointmentBriefingView.tsx`** (read-only)

- Klare, scanbare Darstellung wie im Beispiel
- Sektionen mit `→`-Pfeilen für Bullet-Points
- ToDo-Checkliste (nur Anzeige, kein Toggle)
- Termin-Header oben (Datum, Uhrzeit, Ort — aus `appointmentInfo`)
- Kompakte Begleitpersonen- und Ablauf-Anzeige
- Kein Edit-Modus, keine Buttons außer "Zurück"

**2. Neuer Tab "Briefing" in `AppointmentPreparationDetail.tsx`**

- Wird als erster Tab angezeigt wenn Rolle = `abgeordneter`
- Für andere Rollen bleibt die bisherige Tab-Reihenfolge
- Der Tab ist für alle Rollen sichtbar, aber für Abgeordnete vorausgewählt

**3. Prominente Platzierung**

- Auf dem Dashboard ("Meine Arbeit") könnte ein Briefing-Widget die nächsten anstehenden Termine mit Vorbereitung anzeigen — das wäre ein Folgeschritt
- Zunächst: Briefing-Tab als Standard-Tab für Abgeordnete in der Terminvorbereitung

### Build-Fehler beheben

Zusätzlich werden drei Build-Fehler behoben:

1. **`EventPlanningDetailView.tsx` (Zeile 85)**: `updateChecklistItemColor` wird destrukturiert, ist aber nicht im Return von `useEventPlanningData` enthalten → Hinzufügen in `useEventPlanningData.ts` (Zeile ~868): `updateChecklistItemColor: checklist.updateChecklistItemColor`

2. **`AppointmentPreparationDataTab.tsx` (Zeile 78)**: `preparation_data` enthält `companions` (Array) und `program` (Array), kann daher nicht als `Record<string, string>` typisiert werden → State-Typ ändern zu `Record<string, unknown>` oder die komplexen Felder beim Spread ausschließen

3. **Supabase Edge Function Fehler** (TS2589/TS2322 in `respond-public-event-invitation`): Diese sind vorexistent und nicht Teil dieser Änderung — werden separat behandelt falls gewünscht.

### Dateien

| Datei | Aktion |
|---|---|
| `src/components/appointment-preparations/AppointmentBriefingView.tsx` | Neu erstellen |
| `src/pages/AppointmentPreparationDetail.tsx` | Briefing-Tab hinzufügen, rollenbasiert vorauswählen |
| `src/components/event-planning/useEventPlanningData.ts` | `updateChecklistItemColor` im Return ergänzen |
| `src/components/appointment-preparations/AppointmentPreparationDataTab.tsx` | Typ-Fehler bei `Record<string, string>` beheben |

