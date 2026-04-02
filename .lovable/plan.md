

# Navigation-Fixes: 5 Punkte

## 1. Navigationsbreite: Nav füllt nicht den Container

**Problem**: In `Index.tsx` wird `style={{ width: navWidth }}` auf den äußeren Wrapper gesetzt, aber `AppNavigation` hat keine explizite `w-full`-Klasse — es wächst nicht mit dem Container mit.

**Fix**: In `AppNavigation.tsx` dem äußeren `<nav>` ein `w-full` hinzufügen, damit es den gesamten vom Parent vorgegebenen Platz ausfüllt.

## 2. Chevron-Pfeile ans Ende der Zeile verschieben

**Problem**: Aktuell steht der Chevron (Expand/Collapse) VOR dem Icon in der Gruppe:
```
> 📅 Kalender
```

**Fix**: Reihenfolge in `renderNavGroup` ändern — Icon kommt zuerst, dann Label, dann Chevron ganz rechts mit `ml-auto`:
```
📅 Kalender          >
```

Gleiches für den Team-Bereich am unteren Rand (Zeilen 470-474).

## 3. Benachrichtigungen in der Navigation anzeigen (nicht im Content)

**Problem**: Klick auf Bell-Button navigiert zu `notifications` Section, die im Hauptinhalt rendert.

**Fix**: 
- State `showNotificationsPanel` in `AppNavigation` einführen
- Klick auf Bell-Button toggled diesen State statt `handleNavigationClick('notifications')` aufzurufen
- Wenn aktiv: unterhalb der Quick-Actions einen eingebetteten Benachrichtigungs-Panel rendern (ScrollArea innerhalb der Sidebar)
- Dafür die Notification-Liste aus `NotificationsPage` als kompakte Variante direkt in der Nav einbetten (useNotifications-Hook, Liste mit markAsRead + deleteNotification)
- Der Bell-Button bekommt visuelles Feedback wenn aktiv (hinterlegt + Label "Inbox" sichtbar)

## 4. Suche als Dialog statt Header-Input

**Problem**: Nav-Search-Button dispatcht `open-global-search` (falscher Event-Name!). Der richtige Event heißt `openGlobalSearch`.

**Fix**:
- In `AppNavigation.tsx`: Event-Name auf `openGlobalSearch` korrigieren
- In `AppHeader.tsx`: `<HeaderSearch />` Komponente entfernen
- Die `HeaderSearch`-Komponente wird nicht mehr benötigt (globale Suche wird nur noch über den Nav-Button und Cmd+K geöffnet)

## 5. Quick-Action Buttons: hinterlegt + Label bei aktiv

**Problem**: Buttons sind nackt (kein Hintergrund), zeigen nie den Text.

**Fix**: 
- Allen Quick-Action Buttons einen leichten Hintergrund geben: `bg-[hsl(var(--nav-hover))]`
- Wenn ein Button aktiv ist (z.B. Notifications-Panel offen, oder aktuelle Section = mywork/casefiles), den Button mit `bg-[hsl(var(--nav-active-bg))]` hinterlegen UND den Label-Text neben dem Icon anzeigen (z.B. `🏠 Home` statt nur `🏠`)
- Inaktive Buttons zeigen weiterhin nur das Icon

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/AppNavigation.tsx` | w-full auf nav, Chevrons ans Ende, Notifications-Panel inline, Search-Event-Fix, Quick-Action-Styling |
| `src/components/layout/AppHeader.tsx` | HeaderSearch entfernen |

