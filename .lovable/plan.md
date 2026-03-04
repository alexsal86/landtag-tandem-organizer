
Ziel: Preview-iframe zuverlässig sichtbar machen, dabei COOP/COEP-Isolation im Direkt-Tab erhalten (deine Priorität).

1) Wahrscheinliche Hauptursache (aus aktuellem Code)
- In `index.html` wird im iframe zwar deregistriert, aber `unregister()` wird nicht abgewartet.
- Der Reload kann dadurch zu früh kommen, während der alte Controller noch aktiv ist.
- Ergebnis: alter SW kann weiterhin Dokument-Responses beeinflussen → Preview bleibt weiß.

2) Geplanter Fix (minimal, robust)
- Datei: `index.html`
  - Iframe-Branch auf Promise-basiertes Cleanup umbauen:
    - `getRegistrations()`
    - `Promise.all(regs.map(r => r.unregister()))`
    - erst danach einmaliger Reload mit Guard
  - Guard verbessern:
    - State-Maschine statt nur `coi-cleaned` (z. B. `coi-cleanup-state = started|reloaded|done`)
    - verhindert sowohl Endlosschleife als auch „zu früh fertig“
  - Optionaler Cache-Buster beim Reload (`location.replace(path + '?coi_reset=...')`), danach Parameter wieder entfernen.

- Datei: `public/coi-serviceworker.js`
  - bestehende iframe-/embedded-navigation-Checks behalten.
  - zusätzliche Härtung im Fetch-Handler:
    - COOP/COEP nur bei Top-Level-Navigationen setzen (`mode=navigate` + `Sec-Fetch-Site=none`) und bei Ressourcen wie bisher.
    - für potenziell eingebettete Dokumentnavigationsfälle konsequent `skipIsolation=true`.
  - keine iframe-Reloads aus Client-Scope auslösen (Guard bleibt).

3) Warum dieser Plan besser ist als bisher
- Er löst das Timing-Problem zwischen Deregistrierung und Reload.
- Er beseitigt die race condition mit „altem Controller noch aktiv“.
- Er hält Isolation im externen Tab weiterhin aktiv.

4) Konkrete Implementierungsschritte
- Schritt A: `index.html` Iframe-Cleanup auf `await`-Logik + robusten Guard umstellen.
- Schritt B: `coi-serviceworker.js` Header-Entscheidung noch enger an echte Top-Level-Isolation koppeln.
- Schritt C: SW-Version im Script-URL erhöhen (erneut), damit Clients sicher aktualisieren.
- Schritt D: kleine Debug-Logs (temporär) für:
  - „iframe detected“
  - Anzahl deregistrierter SWs
  - Cleanup-State
  - ob Reload ausgelöst wurde

5) Validierung (End-to-End)
- Test 1: Externer Tab offen lassen, Preview neu laden → UI/Login sichtbar.
- Test 2: Externen Tab hard reload → kein Loop, App lädt.
- Test 3: Konsole prüfen:
  - Preview: `crossOriginIsolated === false`
  - Direkt-Tab: `crossOriginIsolated === true`
- Test 4: Matrix-Chat im Direkt-Tab kurz öffnen (Smoke-Test), Preview bleibt stabil.

Technische Hinweise
- Aktueller Engpass sitzt sehr wahrscheinlich nicht in React/Auth, sondern vor App-Bootstrap im SW-Lifecycle.
- Dass in Preview keine Console-/Network-Logs erscheinen, passt zu einem früh blockierten/instabilen Dokument-Ladepfad.
