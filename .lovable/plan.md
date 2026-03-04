

## Diagnose

Der Service Worker (`coi-serviceworker.js`) fängt **alle** Fetch-Requests ab und setzt COOP/COEP-Header — auch wenn die Seite in einem iframe geladen wird. Der Browser blockiert dann das Rendering, weil `Cross-Origin-Opener-Policy: same-origin` das Embedding in einem Cross-Origin-iframe verhindert.

Das Cleanup-Script in `index.html` kommt **zu spät**: Der SW hat den HTML-Response bereits mit COOP/COEP-Headern ausgeliefert, bevor das Script ausgeführt wird.

## Lösung: Iframe-aware COI Worker

Der Service Worker selbst prüft bei jeder Fetch-Response den `Sec-Fetch-Dest`-Header des Requests. Der Browser sendet bei iframe-Navigationen `Sec-Fetch-Dest: iframe`. In diesem Fall werden COOP/COEP-Header **nicht** gesetzt.

```text
Fetch-Event im Service Worker:
┌─────────────────────────────────────────────┐
│ request.headers['Sec-Fetch-Dest'] === ?     │
│   'iframe'  → Response OHNE COOP/COEP      │
│   andere    → Response MIT COOP/COEP        │
└─────────────────────────────────────────────┘
```

### Datei 1: `public/coi-serviceworker.js`

Die minifizierte Fetch-Handler-Zeile wird durch eine lesbare Version ersetzt. Kernänderung im `fetch`-Event:

```javascript
self.addEventListener("fetch", function(e) {
  const r = e.request;
  if ("only-if-cached" === r.cache && "same-origin" !== r.mode) return;

  // Detect iframe navigation — skip COOP/COEP to allow embedding
  const isIframeNavigation = r.headers.get("Sec-Fetch-Dest") === "iframe";

  const s = coepCredentialless && "no-cors" === r.mode
    ? new Request(r, { credentials: "omit" })
    : r;

  e.respondWith(
    fetch(s).then(function(response) {
      if (0 === response.status) return response;

      const headers = new Headers(response.headers);

      if (!isIframeNavigation) {
        headers.set("Cross-Origin-Embedder-Policy",
          coepCredentialless ? "credentialless" : "require-corp");
        if (!coepCredentialless) {
          headers.set("Cross-Origin-Resource-Policy", "cross-origin");
        }
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
      }

      const noBody = [101, 204, 205, 304].includes(response.status);
      return new Response(noBody ? null : response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    }).catch(function(err) { console.error(err); })
  );
});
```

Push-Handler und der Client-Side-Block bleiben unverändert.

### Datei 2: `index.html`

Das Inline-Script wird vereinfacht. Da der SW jetzt selbst iframe-aware ist, braucht das Script keine aggressive Deregistrierung mehr. Es reicht eine einfache Konfiguration:

```javascript
(function() {
  window.coi = {
    shouldRegister: function() { return true; },
    shouldDeregister: function() { return false; },
    quiet: true
  };
  var s = document.createElement('script');
  s.src = '/coi-serviceworker.js';
  document.head.appendChild(s);
})();
```

Kein iframe-Detection-Code mehr nötig in `index.html` — der SW regelt das selbst.

### Ergebnis

| Umgebung | COOP/COEP | Push | Matrix E2EE |
|---|---|---|---|
| Preview iframe | Nicht gesetzt — App rendert | Nicht verfügbar (kein eigener Tab) | Nicht verfügbar |
| Direkter Browser-Tab | Aktiv | Voll funktionsfähig | Voll funktionsfähig |

Zwei Dateien geändert: `public/coi-serviceworker.js`, `index.html`.

