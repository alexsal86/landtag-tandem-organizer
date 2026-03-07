

# Plan: Dashboard Cards, Fristen-Uebersicht, News-Anpassung, Termin-Links

## 1. Cards um Aufgaben, Termine und News

Alle drei Sektionen im Dashboard-Grid mit `<Card>` umschliessen:
- **Links**: `<Card>` um `DashboardTasksSection`
- **Rechts oben**: `<Card>` um `DashboardAppointments`
- **Rechts unten**: `<Card>` um `NewsWidget compact`

Aenderung in `MyWorkView.tsx` im Dashboard-Tab-Bereich.

## 2. Aufgabenstatus erweitern zu Fristen-Uebersicht

`DashboardTasksSection.tsx` wird komplett ueberarbeitet:

- **Header**: "Fristen" (statt "Aufgabenstatus")
- **Datenquellen**: Parallel laden aus 4 Tabellen:
  - `tasks` (due_date, status != completed)
  - `quick_notes` (follow_up_date, nicht archiviert/geloescht)
  - `case_items` (due_at, status nicht completed/closed)
  - `task_decisions` (response_deadline, status != resolved)
- **Gruppierung** nach Fristigkeit:
  - **Heute**: Frist = heute
  - **Diese Woche**: Frist innerhalb der laufenden Woche (nach heute)
  - **Spaeter**: Frist nach dieser Woche
- Jeder Eintrag zeigt: Icon (je Typ), Titel, Fristdatum
- Alle Eintraege behalten das bestehende `draggable` + `GripVertical` fuer Tageszettel-Drag&Drop
- Click navigiert zum jeweiligen Tab (tasks, capture, cases, decisions)

## 3. News: Herkunft als Text statt Badge

In `NewsWidget.tsx` im compact-Modus:
- Badge durch `<span>` ersetzen mit `text-primary` (oder source-abhaengiger Farbe)
- Herkunft unter dem Titel anzeigen statt daneben

## 4. Besonderer Tag hervorheben

In `DashboardAppointments.tsx`:
- `specialDayHint` mit auffaelligerem Styling: z.B. `bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 px-3 py-1.5 rounded` statt einfacher Text

## 5. Termine mit Kalender-Link

In `DashboardAppointments.tsx`:
- Jeder Termin wird klickbar und navigiert zu `/calendar?date=YYYY-MM-DD&event=ID`
- `navigate()` statt statischem Text, mit hover-Underline

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/components/MyWorkView.tsx` | Cards um die 3 Sektionen |
| `src/components/dashboard/DashboardTasksSection.tsx` | Komplett neu: Fristen-Uebersicht mit 4 Datenquellen, gruppiert |
| `src/components/dashboard/DashboardAppointments.tsx` | Special Day hervorheben, Termine klickbar mit Kalender-Link |
| `src/components/widgets/NewsWidget.tsx` | Compact: Badge -> farbiger Text unter Titel |

