

# Benachrichtigungs-Deep-Links in der Sidebar + Archiv/Gelöscht-Handling

## Problem

Die Benachrichtigungen im Sidebar-Panel navigieren aktuell nicht zum jeweiligen Element. Der `onClick`-Handler markiert nur als gelesen, nutzt aber nicht `buildDeepLinkPath` für die Navigation. Zudem gibt es kein Handling für archivierte oder gelöschte Ziel-Elemente.

## Änderungen

### 1. Navigation bei Klick auf Benachrichtigung (`AppNavigation.tsx`)

Im `renderNotificationsPanel` den `onClick`-Handler erweitern:
- `buildDeepLinkPath(n)` aufrufen um den Zielpfad zu ermitteln
- Bei externen URLs (`https://...`) via `window.location.href` öffnen
- Bei internen Pfaden via `navigate(path)` navigieren (Deep-Link mit `?highlight=` Parameter)
- Sidebar auf mobile schließen
- Als gelesen markieren

Das ist exakt das gleiche Muster wie in `NotificationCenter.tsx` Zeile 157-171.

### 2. Archiv- und Gelöscht-Handling (`notificationDeepLinks.ts`)

Die bestehende `buildDeepLinkPath`-Funktion wird erweitert, damit sie den Status des Ziel-Elements berücksichtigen kann. Dafür:

- Für **archivierte** Elemente: Die Deep-Link-Pfade bereits korrekt auf Archiv-Tabs verweisen (z.B. `/tasks?tab=archived&highlight=xxx`, `/decisions?tab=archived&highlight=xxx`). Das erfordert ein neues optionales Feld im Notification-Data (`target_status: 'active' | 'archived' | 'deleted'`), das vom Backend beim Archivieren/Löschen gesetzt werden kann.

- Für **gelöschte** Elemente: Wenn `target_status === 'deleted'`, wird statt der Navigation ein Toast/Dialog angezeigt ("Dieses Element wurde gelöscht und ist nicht mehr verfügbar").

- **Fallback ohne Backend-Änderung** (pragmatischer Ansatz): Die Zielseiten selbst (Tasks, Decisions, etc.) prüfen beim Laden mit `highlight`-Parameter, ob das Element existiert. Falls nicht gefunden, wird eine Info-Meldung angezeigt. Falls archiviert, wird automatisch zum Archiv-Tab gewechselt.

### 3. Highlight-Handling auf Zielseiten verbessern

Die Zielseiten (Tasks, Decisions, Meetings, etc.) nutzen bereits `useNotificationHighlight`. Erweitert wird:

- **Automatischer Tab-Wechsel**: Wenn ein `highlight`-Element nicht im aktiven Tab gefunden wird, archivierte Tabs durchsuchen und ggf. dorthin wechseln
- **Nicht-gefunden-Meldung**: Toast anzeigen wenn das Element in keinem Tab existiert ("Dieses Element existiert nicht mehr")

Das betrifft primär:
- `DecisionsOverview.tsx` — hat bereits Archiv-Tab
- `TaskList` / Tasks-Seite — hat bereits Archiv-Logik
- Weitere Seiten: Meetings, Dokumente

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/AppNavigation.tsx` | onClick-Handler: navigate + buildDeepLinkPath + markAsRead |
| `src/utils/notificationDeepLinks.ts` | Keine Änderung nötig (Pfade sind bereits korrekt) |
| `src/components/task-decisions/DecisionsOverview.tsx` | Auto-Tab-Wechsel zu Archiv wenn highlight-Element dort liegt |
| `src/pages/TasksPage.tsx` (o.ä.) | Analog: Archiv-Suche bei highlight |
| Betroffene Zielseiten | Toast "Element nicht mehr vorhanden" wenn highlight-ID nirgends gefunden |

### Umsetzungsreihenfolge

1. **Sidebar-Navigation** einbauen (Hauptfix, ~5 Zeilen in AppNavigation.tsx)
2. **Archiv-Auto-Switch** auf den wichtigsten Seiten (Decisions, Tasks)
3. **Nicht-gefunden-Toast** als Fallback auf allen highlight-fähigen Seiten

