## Feature: Wiedervorlage („Snooze") für Fristen im Dashboard

### Verhalten

- **Beim Hover** auf einen Fristen-Eintrag erscheint **hinter dem Datum** ein dezenter Button mit `AlarmClockPlus`-Icon — analog zum bereits etablierten Drag-Handle (sanftes Einsliden via `max-w` + `opacity`, kein reservierter Platz im Ruhezustand).
- **Klick auf das Icon** = sofort **+7 Tage ab heute** (nicht ab altem Fälligkeitsdatum). Eine drei Wochen überfällige Frist landet also auf `heute + 7`, nicht auf `vor 14 Tagen`.
- **Klick auf das kleine ▾ daneben** öffnet ein Popover mit Schnellauswahl:
  - Morgen
  - In 3 Tagen
  - In 7 Tagen *(Standard)*
  - In 14 Tagen
  - In 30 Tagen
  - Eigenes Datum… *(öffnet shadcn `Calendar` mit `pointer-events-auto`)*
- Nach erfolgreichem Update: Toast „Frist verschoben auf TT.MM.YYYY" + Neuberechnung der Gruppen via React-Query-Invalidierung.

### Geltungsbereich — „nur eigene Items"

| Typ | „Eigen", wenn | Snooze möglich |
|---|---|---|
| **Aufgabe** (`tasks`) | `assigned_to === user.id` oder CSV enthält user.id oder `user_id === user.id` | ✅ |
| **Notiz** (`quick_notes`) | `user_id === user.id` (immer eigen) | ✅ |
| **Entscheidung** (`task_decisions`) | `created_by === user.id` | ✅ |
| **Vorgang** (`case_items`) | — meist mit anderen abgestimmt | ❌ |
| **Veranstaltungsplanung** | — Timeline-Termine sind kollaborativ | ❌ |

### Datenbank-Updates pro Typ

| Typ | Tabelle | Feld | Datentyp |
|---|---|---|---|
| `task` | `tasks` | `due_date` | `date` |
| `note` | `quick_notes` | `follow_up_date` | `timestamptz` |
| `decision` | `task_decisions` | `response_deadline` | `timestamptz` |

Bestehende RLS-Policies regeln die Berechtigung; das Frontend filtert defensiv via `canSnooze`.

### Technische Umsetzung

1. **Neue Komponente** `src/components/dashboard/DeadlineSnoozeButton.tsx`
   - Split-Button: `AlarmClockPlus` (h-3.5 w-3.5) für +7 Tage, daneben kleiner `ChevronDown` als Popover-Trigger
   - Popover mit Presets + shadcn `Calendar` für „Eigenes Datum"
   - Hover-Animation analog zum Drag-Handle: `max-w-0 opacity-0` → `group-hover:max-w-12 group-hover:opacity-100`, `transition-all duration-200`
   - `e.stopPropagation()` auf allen Klicks

2. **Neuer Hook** `src/hooks/useSnoozeDeadline.ts`
   - `mutate({ item, newDate })` → switch auf `item.type`, schreibt das richtige Feld
   - Datums-Helper: `addDays(startOfDay(new Date()), n)` → garantiert „ab heute, nie rückwärts"
   - Bei Erfolg: `queryClient.invalidateQueries(['dashboard-deadlines'])` + Toast

3. **Erweiterung** `src/types/dashboardDeadlines.ts` — `DeadlineItem` bekommt `canSnooze: boolean`

4. **Erweiterung** `src/hooks/useDashboardDeadlines.ts`
   - `tasks`-Select um `assigned_to, user_id` erweitern
   - `task_decisions`-Select um `created_by` erweitern
   - `canSnooze` pro Item berechnen; Vorgang & EventPlanning: `false`

5. **Integration** `src/components/dashboard/DashboardTasksSection.tsx`
   - In `renderItem` hinter dem Datum: `{item.canSnooze && <DeadlineSnoozeButton item={item} />}`

### Betroffene Dateien

- **Neu:** `src/components/dashboard/DeadlineSnoozeButton.tsx`
- **Neu:** `src/hooks/useSnoozeDeadline.ts`
- **Edit:** `src/types/dashboardDeadlines.ts`
- **Edit:** `src/hooks/useDashboardDeadlines.ts`
- **Edit:** `src/components/dashboard/DashboardTasksSection.tsx`

### Keine DB-Migration nötig

Alle benötigten Spalten existieren bereits, RLS bleibt unberührt.

### Verifikation

- Hover über eigene Aufgabe → Snooze-Icon gleitet hinter dem Datum sanft ein.
- Klick → Datum springt auf `heute + 7`, Eintrag wandert in die richtige Gruppe.
- ▾-Klick → Popover, „Eigenes Datum…" öffnet Kalender mit funktionierender Auswahl.
- Vorgang & Veranstaltungsplanung: kein Snooze-Icon, auch nicht bei Hover.
- Aufgabe, die jemand anderem zugewiesen ist: kein Snooze-Icon.
- Verlässt man die Maus, verschwindet das Icon ohne Layout-Sprung.