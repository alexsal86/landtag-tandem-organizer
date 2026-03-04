

## Problem: Weißer Bildschirm im Preview-iframe

### Ursache (3 Quellen von COOP/COEP)

1. **`vite.config.ts` Zeile 19-23**: Der Dev-Server setzt `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: credentialless` als Server-Header auf ALLE Responses. Diese Header verhindern die Einbettung im Lovable Preview-iframe.

2. **`coi-serviceworker.js`**: Selbst wenn `shouldRegister()` jetzt `false` liefert, bleibt ein zuvor registrierter Service Worker aktiv und injiziert COOP/COEP-Header in alle Fetch-Responses. `shouldDeregister()` löst einen Reload-Loop aus.

3. **`index.html` Zeile 9 (CSP Meta-Tag)**: `frame-ancestors` in einem `<meta>` CSP-Tag wird von Browsern **ignoriert** — das ist kein Problem, aber auch kein Schutz. (Nur informativ, nicht ursächlich.)

### Warum die bisherige Lösung nicht half
Die `window.coi`-Konfiguration wurde hinzugefügt, aber:
- Der Service Worker war **bereits registriert** beim User und läuft persistent weiter
- `vite.config.ts` setzt COOP/COEP **unabhängig** vom Service Worker auf Server-Ebene
- Beides zusammen blockiert das iframe-Rendering

### Lösung

#### 1. `vite.config.ts` — COOP/COEP-Header entfernen
Die Server-Level-Header `Cross-Origin-Opener-Policy` und `Cross-Origin-Embedder-Policy` aus der `server.headers`-Konfiguration entfernen. Der Service Worker übernimmt das bei Bedarf (nur auf `/chat`).

#### 2. `index.html` — Service Worker aggressiver deregistrieren
Das `window.coi`-Script erweitern: Wenn im iframe und nicht auf `/chat`, sofort ALLE registrierten Service Worker deregistrieren (nicht nur per Message, sondern direkt via `getRegistrations()`) und hart neu laden. Das räumt den alten persistenten Worker auf.

```text
Ablauf:
┌──────────────────────────────────────────────┐
│ Seite lädt im iframe (nicht /chat)           │
│  → Prüfe: Gibt es registrierte SW?          │
│    → Ja: Deregistriere alle, reload          │
│    → Nein: Normal weiter (kein COOP/COEP)    │
│                                              │
│ Seite lädt NICHT im iframe ODER auf /chat    │
│  → coi-serviceworker.js registrieren         │
│  → COOP/COEP aktiv für SharedArrayBuffer     │
└──────────────────────────────────────────────┘
```

#### 3. Push-Benachrichtigungen — weiterhin funktionsfähig
Push-Handler sind im `coi-serviceworker.js` integriert. Da der Worker nur im iframe deregistriert wird (Preview-Umgebung), bleibt er im produktiven Einsatz (direkt im Browser) aktiv. Push-Benachrichtigungen funktionieren nur außerhalb des Lovable-Previews — das ist erwartetes Verhalten, da Push ohnehin nur im deployten/direkten Zugriff relevant ist.

Alternativ: Die Push-Handler in einen separaten, schlanken Service Worker auslagern (ohne COOP/COEP), der immer registriert bleibt. Das wäre ein Follow-up.

### Dateien

| Datei | Änderung |
|---|---|
| `vite.config.ts` | COOP/COEP-Header aus `server.headers` entfernen |
| `index.html` | Aggressives SW-Cleanup-Script vor `coi-serviceworker.js` |

### Zu den Benachrichtigungen
Push-Benachrichtigungen im Browser funktionieren weiterhin, wenn die App **direkt** aufgerufen wird (nicht im Lovable-Preview). Im Preview-iframe waren sie ohnehin nicht nutzbar. Die bestehende Architektur (VAPID + `coi-serviceworker.js` mit Push-Handlern) bleibt unverändert.

