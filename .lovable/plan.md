

# Plan: Social Planner Kalenderansicht & Erstellen-Debugging

## Übersicht

Zwei Aufgaben: (1) Kanban durch Kalenderansicht ersetzen/ergänzen, (2) Erstellen-Funktion debuggen und reparieren.

---

## 1. Social Planner Kalenderansicht

**Ansatz:** Das Kanban-Board durch eine Kalenderansicht (Wochen-/Monatsansicht) ersetzen, mit Toggle um zwischen Ansichten zu wechseln. `react-big-calendar` ist bereits im Projekt vorhanden.

**Neue Komponente: `SocialPlannerCalendar.tsx`**
- Nutzt `react-big-calendar` mit `dateFnsLocalizer` (de), analog zu `ProperReactBigCalendar.tsx`
- Zeigt `SocialPlannerItem`-Einträge als Kalenderevents an, basierend auf `scheduled_for`
- Items ohne `scheduled_for` erscheinen in einer Sidebar-Liste "Ungeplante Beiträge"
- Wochen- und Monatsansicht per Toggle
- Event-Klick öffnet Detail-/Bearbeitungsdialog
- Drag & Drop zum Umplanen (ändert `scheduled_for`)
- Farbkodierung nach `workflow_status` (Idee=grau, In Arbeit=blau, Freigegeben=grün, etc.)

**Änderungen an `MyWorkSocialPlannerBoard.tsx`:**
- View-Toggle hinzufügen: "Kanban" | "Kalender" (default: Kalender)
- Bei Kalender-Ansicht: `SocialPlannerCalendar` rendern statt DragDropContext
- Filter bleiben in beiden Ansichten verfügbar

**Änderungen an `SocialMediaPlannerPanel.tsx`:**
- Übergibt den View-State an das Board

---

## 2. Erstellen-Funktion reparieren

**Diagnose:** Die RLS-Policies erfordern `has_active_tenant_role(uid, tenant_id, ['mitarbeiter', 'bueroleitung', 'abgeordneter'])` für INSERT. Der Code sieht korrekt aus, aber:

1. **Problem A:** `createTopic` in `useTopicBacklog` verwendet `.select().single()` nach INSERT. Wenn RLS den SELECT blockiert, scheitert die gesamte Operation stillschweigend. Der Fehler wird zwar gecatcht, aber die Toast-Fehlermeldung könnte untergehen.

2. **Problem B:** Der `ThemenspeicherPanel.createTopic()` macht nach dem INSERT noch einen separaten `.update()` für `short_description` — das scheitert wenn die Rolle fehlt.

**Fixes:**
- Besseres Error-Handling: Bei INSERT-Fehlern explizit RLS-Hinweis in Toast anzeigen ("Keine Berechtigung" wenn 42501 oder "new row violates row-level security")
- `createTopic` in `useTopicBacklog`: `short_description` direkt im INSERT mitgeben statt separatem UPDATE
- `createItem` in `useSocialPlannerItems`: Nach INSERT nicht `.select("id").single()` verwenden, sondern client-seitige UUID generieren (`crypto.randomUUID()`) und im INSERT mitgeben — so entfällt die Abhängigkeit vom SELECT-Rückgabewert
- Console-Logging für alle Mutations-Fehler hinzufügen, damit Probleme sichtbar werden

**Änderungen an `useTopicBacklog.ts`:**
- `createTopic` Payload um `short_description` erweitern
- Direkt im INSERT mitgeben

**Änderungen an `ThemenspeicherPanel.tsx`:**
- `short_description` direkt an `createBacklogTopic()` übergeben statt separatem UPDATE
- Bessere Fehlermeldungen

**Änderungen an `useSocialPlannerItems.ts`:**
- `createItem`: Client-seitige UUID für `id` generieren
- Fehler-Details in Toast anzeigen

---

## Technische Schritte

1. `useTopicBacklog.ts` — `createTopic` um `short_description` im INSERT erweitern
2. `ThemenspeicherPanel.tsx` — `short_description` direkt übergeben, separates UPDATE entfernen
3. `useSocialPlannerItems.ts` — Client-seitige ID, besseres Error-Handling
4. `SocialPlannerCalendar.tsx` erstellen — Wochen-/Monatsansicht mit react-big-calendar
5. `MyWorkSocialPlannerBoard.tsx` — View-Toggle (Kanban/Kalender) einbauen
6. Alle Mutations-Fehler mit sprechenden Toast-Meldungen versehen

