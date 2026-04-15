

## Plan: Push-Notification Service Worker Konflikt beheben

### Ursache
Das Problem ist ein **Service-Worker-Scope-Konflikt**: `main.tsx` registriert `coi-serviceworker.js` mit dem Default-Scope `/`. Die letzte Änderung registriert `sw.js` (Push-Worker) mit Scope `/push/`. Obwohl Push-Events theoretisch unabhängig vom Scope zugestellt werden, verursacht die doppelte Registrierung Probleme — insbesondere, weil `sw.js` mit einem eingeschränkten Scope registriert wird, was in manchen Browsern die Push-Subscription scheitern lässt.

### Lösung

**1. `src/hooks/useNotifications.tsx` — `getPushRegistration` korrigieren**
- `scope: '/push/'` entfernen → stattdessen ohne Scope registrieren (Default = `/`)
- Das überschreibt zwar den COI-SW, aber:
  - COI wird nur für SharedArrayBuffer/WASM benötigt (in dieser App nicht verwendet)
  - Der Push-SW (`sw.js`) übernimmt die Push-Event-Handler korrekt

**2. `public/sw.js` — COI-Header-Injection nachrüsten**
- `fetch`-Event-Listener hinzufügen, der die gleichen COOP/COEP-Header setzt wie der bisherige COI-SW
- Damit bleibt Cross-Origin Isolation erhalten, auch wenn der Push-SW den COI-SW ersetzt

**3. `src/main.tsx` — Doppelregistrierung vermeiden**
- Die COI-SW-Registrierung (`coi-serviceworker.js`) durch `/sw.js`-Registrierung ersetzen
- So gibt es nur noch einen SW mit beiden Funktionen (Push + COI-Headers)
- Logik für Iframe-Erkennung (Lovable Preview) bleibt unverändert

### Betroffene Dateien
- `src/hooks/useNotifications.tsx` — Scope entfernen aus `getPushRegistration`
- `public/sw.js` — COI-Header-Injection im fetch-Handler ergänzen
- `src/main.tsx` — `coi-serviceworker.js` durch `sw.js` ersetzen

### Erwartetes Ergebnis
- Ein einziger Service Worker für Push und COI
- Kein Scope-Konflikt mehr
- Push-Subscriptions funktionieren korrekt
- COI-Isolation bleibt erhalten

