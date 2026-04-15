

## Plan: Push-Benachrichtigungs-Fehler beheben

### Ursache

Das Problem hat zwei Teile:

1. **`sw.js` (Push Service Worker) wird nirgends registriert.** `main.tsx` registriert nur `coi-serviceworker.js` (für Cross-Origin Isolation). Der Push-SW in `public/sw.js` mit den Push-Event-Handlern wird nie geladen.

2. **Auto-Renewal zeigt Fehler-Toast bei jedem Seitenaufruf.** Wenn der User zuvor Push-Berechtigung erteilt hat (`permission === 'granted'`), läuft `checkAndRenewSubscription` automatisch (Zeile 806). Dieser versucht über `navigator.serviceWorker.ready` eine Push-Subscription zu erneuern — bekommt aber den COI-SW statt eines Push-SW. Wenn das fehlschlägt, zeigt `subscribeToPush()` den Toast "Push-Benachrichtigungen konnten nicht aktiviert werden." bei **jedem** Seitenaufruf.

### Lösung

**1. Push-SW separat registrieren** (`src/hooks/useNotifications.tsx`)
- Statt `navigator.serviceWorker.ready` (gibt den COI-SW zurück) wird `sw.js` explizit mit eigenem Scope registriert: `navigator.serviceWorker.register('/sw.js', { scope: '/push/' })`
- Eine Helper-Funktion `getPushRegistration()` kapselt die Registrierung und wird in `subscribeToPush` und `checkAndRenewSubscription` verwendet

**2. Fehler-Toast nur bei expliziter User-Aktion** (`src/hooks/useNotifications.tsx`)
- `subscribeToPush` bekommt einen optionalen Parameter `silent?: boolean`
- `checkAndRenewSubscription` ruft `subscribeToPush({ silent: true })` auf → kein Toast bei Auto-Renewal-Fehler, nur `debugConsole.error`
- `requestPushPermission` (explizite User-Aktion) ruft weiterhin `subscribeToPush()` mit Toast auf

**3. `loadNotifications`-Fehler prüfen** (`src/hooks/useNotifications.tsx`)
- Zusätzlich den Fehler im `catch` loggen, damit bei künftigen Problemen die genaue Fehlermeldung sichtbar ist (aktuell wird nur "Error loading notifications:" geloggt, aber der Toast gibt keine Details)

### Betroffene Dateien
- `src/hooks/useNotifications.tsx` — Push-SW-Registrierung, silent-Parameter, besseres Error-Logging

### Erwartetes Ergebnis
- Kein Fehler-Toast mehr bei jedem Seitenaufruf
- Push-Notifications nutzen den korrekten Service Worker mit Push-Event-Handlern
- Auto-Renewal läuft still im Hintergrund, Fehler nur in der Console

