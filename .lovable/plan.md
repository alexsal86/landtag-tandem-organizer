

## Problem

Du hast zwei Tabs im gleichen Browser:
- **Tab A**: Externe Seite (direkter Tab) → hat den COI Service Worker **registriert und aktiv**
- **Tab B**: Lovable Preview (iframe) → der **gleiche** Service Worker fängt auch hier alle Requests ab

Das ist das Kernproblem: Service Worker sind **pro Origin** registriert, nicht pro Tab. Der SW aus Tab A bedient auch Tab B — und der alte, gecachte SW (ohne iframe-Fix) liefert COOP/COEP-Header aus, **bevor** irgendein JavaScript in `index.html` laufen kann.

Der `Sec-Fetch-Dest: iframe`-Check im SW-Fetch-Handler greift nicht, weil der Browser für die Hauptnavigation innerhalb des iframes `Sec-Fetch-Dest: document` sendet (nicht `iframe`). `iframe` wird nur vom **äußeren** Dokument gesendet, wenn es den iframe-src lädt.

## Lösung

Doppelter Ansatz:

### 1. `index.html` — SW im iframe deregistrieren

```javascript
(function() {
  var inIframe = false;
  try { inIframe = window.self !== window.top; }
  catch (e) { inIframe = true; }

  if (inIframe) {
    // Im iframe: KEINEN COI-Worker laden, bestehende deregistrieren
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        var hadWorker = false;
        regs.forEach(function(r) { r.unregister(); hadWorker = true; });
        if (hadWorker && !sessionStorage.getItem('coi-cleaned')) {
          sessionStorage.setItem('coi-cleaned', '1');
          window.location.reload();
        }
      });
    }
  } else {
    // Direkter Tab: COI-Worker normal laden
    window.coi = {
      shouldRegister: function() { return true; },
      shouldDeregister: function() { return false; },
      quiet: true
    };
    var s = document.createElement('script');
    s.src = '/coi-serviceworker.js';
    document.head.appendChild(s);
  }
})();
```

### 2. `public/coi-serviceworker.js` — Client-Block iframe-sicher

Im Client-Side-Block (ab Zeile 136): iframe-Erkennung hinzufügen. Falls im iframe → `shouldRegister: false` setzen und `doReload` deaktivieren, damit kein Endlos-Reload entsteht.

```javascript
} else {
  // ── Client (browser) scope ──
  
  // Iframe detection
  var inIframe = false;
  try { inIframe = window.self !== window.top; }
  catch (e) { inIframe = true; }
  
  const e = {
    shouldRegister: () => !inIframe,   // Nicht im iframe registrieren
    shouldDeregister: () => inIframe,  // Im iframe deregistrieren
    coepCredentialless: () => !(window.chrome || window.netscape),
    doReload: () => {
      if (!inIframe) window.location.reload();  // Kein Reload im iframe
    },
    quiet: false,
    ...window.coi
  };
  // ... rest bleibt gleich
}
```

### Ergebnis

| Szenario | SW aktiv | COOP/COEP | Rendering |
|---|---|---|---|
| Tab A (direkt) | Ja | Ja | ✓ + E2EE + Push |
| Tab B (Preview iframe) | Nein (deregistriert) | Nein | ✓ |
| Nach Schließen von Tab B, Tab A reload | Ja (neu registriert) | Ja | ✓ |

Zwei Dateien: `index.html`, `public/coi-serviceworker.js`.

