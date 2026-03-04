
Ziel: Den weiterhin weißen Preview-iframe zuverlässig beheben, auch wenn parallel ein externer Tab offen ist, ohne Matrix/Push im Direkt-Tab zu verlieren.

1) Ursache robust adressieren (nicht nur `Sec-Fetch-Dest`)
- Problem: Für die Haupt-Dokumentnavigation im eingebetteten Preview-iframe ist `Sec-Fetch-Dest` oft `document` (nicht `iframe`), daher greift die aktuelle Ausnahme im Service Worker nicht.
- Umsetzung in `public/coi-serviceworker.js`:
  - COOP/COEP **nicht setzen**, wenn Request ein eingebettetes Dokument ist:
    - `request.mode === "navigate"`
    - `request.destination === "document"` (Fallback: leer/`document`)
    - `Sec-Fetch-Site` ist `cross-site` oder `same-site`
  - Bestehende Ausnahme für `Sec-Fetch-Dest === "iframe"` als zusätzliche Safety behalten.
  - Für normale Direkt-Tab-Navigation (`Sec-Fetch-Site: none`) Header weiterhin setzen, damit `SharedArrayBuffer`/Matrix E2EE erhalten bleibt.

2) Stale-Worker sicher ablösen (Cache/Update-Problem)
- Problem: Ein alter Worker kann weiterhin aktiv sein und den iframe blockieren, bevor neuer Code greift.
- Umsetzung in `index.html`:
  - Worker-Script mit Version laden, z. B. `/coi-serviceworker.js?v=2026-03-04-2`, damit Browser sicher ein Update zieht.
  - Bestehende iframe-Guard-Logik (im iframe nicht neu registrieren, ggf. deregistrieren) beibehalten.
  - Reload-Guard via `sessionStorage` beibehalten, damit kein Loop entsteht.

3) Registrierung/Reload-Logik härten
- In `public/coi-serviceworker.js` (Client-Teil):
  - `shouldRegister: () => !inIframe` und `doReload`-Guard im iframe beibehalten.
  - Nur dann reloaden, wenn wirklich ein Update aktiv wurde (kein unnötiger Blank-State).

Technische Änderungen (kompakt)
- Datei: `public/coi-serviceworker.js`
  - Fetch-Entscheidungslogik erweitern um „embedded document navigation“ via `mode/destination/Sec-Fetch-Site`.
  - Bestehende iframe/client Guards beibehalten.
- Datei: `index.html`
  - Versionierten Worker-URL-Load ergänzen.
  - Bestehende iframe-Deregistration + einmaliger Reload-Guard beibehalten.

Akzeptanzkriterien
- Preview in Lovable-iframe rendert wieder statt weiß.
- Externer Direkt-Tab bleibt funktionsfähig (Matrix/Push weiterhin möglich).
- Kein Reload-Loop im iframe.
- Bei gleichzeitig geöffnetem externen Tab + Preview kein gegenseitiges „kaputt registrieren“ mehr.

Kurztest nach Umsetzung
1. Externen Tab offen lassen, Preview neu laden → Preview zeigt Login/UI.
2. Externen Tab hard reload → App lädt normal, keine Dauer-Reloads.
3. Optional: Prüfen `window.crossOriginIsolated` im Direkt-Tab (sollte `true` sein), im Preview-iframe `false`.
