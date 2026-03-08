

## Problem

Die Preview bleibt bei **"Laden…"** hängen, weil React nie mountet. Der Runtime-Error verrät die Ursache:

```
Error: @vitejs/plugin-react-swc can't detect preamble. Something is wrong.
Location: useAuth.tsx
```

### Ursache

Der **COI Service Worker** (`coi-serviceworker.js`) fängt **alle** Fetch-Requests ab und erstellt neue `Response`-Objekte. Dabei geht das von Vite injizierte React-Refresh-Preamble verloren. 

Obwohl `main.tsx` den SW im Iframe deregistriert, gibt es eine **Race Condition**: Der SW aus einer früheren Session (externer Tab) ist bereits aktiv und interceptet die Vite-Modul-Requests, **bevor** `main.tsx` überhaupt ausgeführt wird, um ihn zu deregistrieren.

### Warum es im externen Tab funktioniert

Im externen Tab werden COOP/COEP-Header korrekt gesetzt — die Response-Neuverpackung stört dort nicht, weil im Production-Build kein Vite-Preamble benötigt wird. Im Dev-Modus (Preview) ist das Preamble aber essentiell für React.

## Lösung

**`public/coi-serviceworker.js`** — Vite-Dev-Requests im Fetch-Handler durchlassen:

Im `fetch`-Event-Handler eine Prüfung hinzufügen, die Vite-spezifische Requests erkennt und **nicht** interceptet (kein `e.respondWith`). Dadurch werden diese Requests direkt vom Browser verarbeitet, ohne das Preamble zu zerstören.

Erkennungsmuster für Vite-Dev-Requests:
- URL enthält `node_modules/.vite/`
- URL enthält `/@vite/` oder `/@react-refresh`
- URL enthält `/src/` mit `.tsx` oder `.ts` Extension (HMR-Requests)
- URL enthält `?t=` (Vite HMR Timestamp)

```js
// Im fetch-Handler, ganz am Anfang nach dem cache-check:
const url = new URL(r.url);
const isViteDevRequest = 
  url.pathname.includes('node_modules/.vite/') ||
  url.pathname.includes('/@vite/') ||
  url.pathname.includes('/@react-refresh') ||
  url.pathname.startsWith('/src/') ||
  url.searchParams.has('t');  // Vite HMR timestamp

if (isViteDevRequest) return; // Don't intercept — let browser handle natively
```

**Dateien:**
- `public/coi-serviceworker.js` — Vite-Dev-Bypass im Fetch-Handler

Dies löst das Problem dauerhaft: Der SW wird weiterhin für Produktions-Requests (API-Calls, Assets) die COOP/COEP-Header setzen, aber Vite-Dev-Module unberührt lassen.

