

# Drei neue Sidebar-Features

## 1. Kürzlich besucht

**Hook: `useRecentlyVisited.ts`**
- Speichert die letzten 8 besuchten Seiten im `localStorage` (Key: `nav-recently-visited`)
- Interface: `{ id: string, label: string, icon: string, route: string, visitedAt: number }`
- `trackVisit(id, label, icon, route)` — fügt hinzu / verschiebt nach oben, begrenzt auf 8 Einträge
- `recentPages` — sortiert nach `visitedAt` desc
- Deduplizierung nach `id`

**Integration in `AppNavigation.tsx`**
- In `handleNavigationClick` wird `trackVisit()` aufgerufen (Label/Icon aus `navigationGroups` oder `availableQuickPages` ermitteln)
- Im `renderHomePanel()` wird oberhalb des Schnellzugriffs eine "Kürzlich besucht"-Sektion eingefügt
- Design: Gleicher Stil wie Schnellzugriff, aber mit `Clock`-Icon statt `Star`, kleinere Schrift (11px), max 5 Einträge sichtbar
- Klick navigiert zur Seite

## 2. Benachrichtigungs-Gruppierung nach Datum

**In `renderNotificationsPanel()`**
- Die bestehende flache Liste (`filteredNotifications.map(...)`) wird ersetzt durch gruppierte Darstellung
- Gruppierung: `isToday()` → "Heute", `isYesterday()` → "Gestern", Rest → "Älter" (oder konkretes Datum bei < 7 Tagen)
- Gruppen-Header: `text-[11px] font-semibold text-muted uppercase tracking-wider px-2 mb-1` (gleicher Stil wie Appointments-Panel)
- Hilfsfunktion `groupNotificationsByDate(notifications)` liefert `{ label: string, items: Notification[] }[]`
- Keine externen Abhängigkeiten nötig, `isToday`/`isTomorrow` aus `date-fns` sind bereits importiert; `isYesterday` wird zusätzlich importiert

## 3. Beliebige Elemente in den Schnellzugriff pinnen

**Konzept: Drei-Punkte-Menü ("...") auf Element-Ebene**

Auf den jeweiligen Seiten (Fallakten, Planungen, Meetings, Aufgaben, Entscheidungen, Dokumente) wird in den Zeilen/Cards ein `MoreHorizontal`-Icon mit DropdownMenu ergänzt, das u.a. "Zum Schnellzugriff hinzufügen" enthält.

**Erweiterung `useQuickAccessPages`**
- Das Interface `QuickAccessPage` bekommt ein optionales Feld `type?: 'page' | 'item'` und `entityId?: string`
- Neue Convenience-Funktion: `addItem(id, label, icon, route)` für Einzelelemente (z.B. eine Fallakte mit Route `/casefiles?highlight=uuid`)
- `isInQuickAccess(id)` — prüft ob ein Element bereits gepinnt ist

**Shared Component: `QuickAccessMenuItem`**
- Wiederverwendbare DropdownMenu-Option: `<QuickAccessMenuItem id={...} label={...} icon={...} route={...} />`
- Nutzt `useQuickAccessPages` intern
- Zeigt "Zum Schnellzugriff" oder "Aus Schnellzugriff entfernen" je nach Status
- Icon: `Star` (outline) / `StarOff`

**Integration auf den Seiten** (Drei-Punkte-Menü erweitern):
- `CaseFilesView` — bei jeder Fallakte im Kontextmenü
- `EventPlanningListView` — bei jeder Planung
- `MeetingsView` — bei jedem Jour fixe
- `DecisionOverview` — bei jeder Entscheidung
- `KnowledgeBaseView` — bei jedem Dokument

Falls Seiten bereits ein `MoreHorizontal`-Menü haben, wird `QuickAccessMenuItem` als zusätzlicher Eintrag hinzugefügt. Falls nicht, wird ein kleines Drei-Punkte-Menü ergänzt.

**Darstellung im Schnellzugriff**
- Items mit `type === 'item'` zeigen das jeweilige Icon (z.B. `Briefcase` für Fallakte) statt `Star`
- Beim Klick wird zur gespeicherten Route navigiert

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/hooks/useRecentlyVisited.ts` | Neuer Hook |
| `src/hooks/useQuickAccessPages.ts` | `type`, `entityId`, `isInQuickAccess` ergänzen |
| `src/components/AppNavigation.tsx` | Kürzlich-besucht-Sektion, Notifications-Gruppierung, trackVisit-Aufruf |
| `src/components/shared/QuickAccessMenuItem.tsx` | Neue shared Component |
| `src/components/my-work/cases/...` | Drei-Punkte-Menü mit QuickAccessMenuItem |
| `src/components/event-planning/...` | Drei-Punkte-Menü mit QuickAccessMenuItem |
| `src/components/meetings/...` | Drei-Punkte-Menü mit QuickAccessMenuItem |
| `src/components/task-decisions/...` | Drei-Punkte-Menü mit QuickAccessMenuItem |
| `src/components/KnowledgeBaseView.tsx` | Drei-Punkte-Menü mit QuickAccessMenuItem |

### Umsetzungsreihenfolge

1. `useRecentlyVisited` Hook + Integration in AppNavigation
2. Notifications-Gruppierung in `renderNotificationsPanel`
3. `QuickAccessPages`-Erweiterung + `QuickAccessMenuItem`-Component
4. Drei-Punkte-Menüs auf den 5 wichtigsten Seiten einbauen

