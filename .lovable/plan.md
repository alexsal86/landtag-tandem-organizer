## Problem
Im Lovable-Editor-Vorschaufenster bleibt die App leer, im normalen Browser läuft sie. Konsole im Vorschau-Iframe zeigt:

```
[security] Failed to execute 'postMessage' on 'DOMWindow':
  The target origin provided ('https://gptengineer.app') does not match
  the recipient window's origin ('https://...lovableproject.com').
```

Außerdem ist in `vite.config.ts` ein restriktiver `Content-Security-Policy: frame-ancestors`-Header gesetzt:

```
frame-ancestors https://*.lovable.app https://*.lovableproject.com https://lovable.dev
```

Die Lovable-Editor-Vorschau läuft aber unter **`https://gptengineer.app`** (siehe `cdn.gpteng.co`-Skript und postMessage-Targets). Da gptengineer.app NICHT in `frame-ancestors` steht, blockiert der Browser den Iframe komplett bzw. die Lovable-Tagger/postMessage-Brücke kann nicht aufgebaut werden → das Vorschaufenster bleibt grau.

Zusätzlich setzt der Service Worker in `public/sw.js` für alle Top-Level-Navigationen `Cross-Origin-Opener-Policy: same-origin`. Das verhindert zwar nicht das Embedding direkt (da der SW-Header für Iframe-Requests übersprungen wird), aber das Ping-Pong zum Editor läuft über postMessage und erfordert konsistente Origins/Frame-Regeln.

## Lösung
Zwei kleine, gezielte Änderungen — keine Refactors.

### 1. CSP `frame-ancestors` erweitern (`vite.config.ts`)
Die Lovable-Editor-Hosts ergänzen:

```text
frame-ancestors
  https://*.lovable.app
  https://*.lovableproject.com
  https://lovable.dev
  https://*.lovable.dev
  https://gptengineer.app
  https://*.gptengineer.app
```

Damit darf der Editor (gptengineer.app + lovable.dev-Subdomains) den Vorschau-Iframe einbetten.

### 2. CSP `script-src`/`connect-src` ergänzen
Damit `cdn.gpteng.co`-Skript + Editor-postMessage sauber laufen:

- `script-src`: bleibt mit `https://cdn.gpteng.co`, zusätzlich `https://gptengineer.app` aufnehmen, falls Editor inline-Bridge nachlädt.
- `connect-src`: `https:` ist bereits offen, hier reicht keine Änderung.
- `frame-src`: hinzufügen `https://gptengineer.app https://*.lovable.dev`, falls die App selbst Lovable-Toolings einbettet.

### 3. Verifikation
- Build muss durchlaufen.
- Manuell im Editor-Vorschaufenster prüfen, dass die App geladen wird (User-Test).
- Console im Editor-Frame sollte keine `frame-ancestors`-Verstöße mehr zeigen.

## Out of scope
- Service-Worker-COOP/COEP-Logik wird **nicht** geändert (sie überspringt bereits `secFetchDest === 'iframe'`).
- Keine App-Code-Änderungen, nur Header/CSP.
