

## Problem
Im Preview-Fenster (rechts) erscheint dauerhaft nur "Laden ...". Die wahrscheinliche Ursache ist die bekannte Lovable-Stack-Overflow-Pattern: **Auth-/Daten-Fetch im Preview-iframe scheitert**, während es auf der Published-URL funktionieren würde.

## Analyse — Hypothesen (priorisiert)

1. **Supabase egress-quota gesperrt (HTTP 402)**
   Aus dem vorherigen Verlauf bekannt: Das Projekt liefert auf Edge Functions HTTP 402 (`exceed_egress_quota`). Wenn auch PostgREST/REST-Aufrufe oder Auth davon betroffen sind, hängt die App im Initial-Loading.

2. **Iframe-Cookies / Third-Party-Cookies blockiert**
   Safari oder strikte Browser blockieren Supabase-Auth-Cookies im Lovable-Preview-iframe. Die App wartet ewig auf Session.

3. **COI-Service-Worker stört Initial-Requests**
   Der unified `sw.js` aus den heutigen Änderungen registriert sich auch im Preview-iframe und kann Top-Level-Requests modifizieren.

4. **Loading-Guard ohne Timeout**
   Komponente zeigt "Laden …", solange `loading === true`. Wenn ein einzelner Fetch hängt, bleibt der Spinner für immer.

## Plan — diagnostisch, ohne Code-Änderung

Ich werde **nur lesen und prüfen**, keine Patches:

1. **Root-Cause verifizieren**: 
   - Edge-Function-Status (HTTP 402 noch aktiv?) per `supabase--curl_edge_functions`
   - Browser-Network-Logs aus dem Preview per `code--read_network_requests` (Filter: supabase, 402, 401)
   - Console-Logs nach echten Fehlern durchsuchen

2. **Welche Komponente "Laden …" rendert** finden:
   - Suche im Code nach `"Laden..."` / `"Laden …"` im MyWork-Dashboard-Pfad
   - Prüfen, an welchem Loading-State sie hängt (Auth? Profile? Tasks?)

3. **Iframe-Verhalten prüfen**:
   - Ist `coiRuntime` aktiv? Welche Headers liegen an?
   - SW-Registrierungs-Verhalten im iframe

## Erwartetes Ergebnis der Diagnose

Eines von drei klaren Resultaten:
- **A)** Egress-Sperre noch aktiv → keine Code-Lösung möglich, Supabase-Billing muss bereinigt werden.
- **B)** Auth-/Cookie-Problem nur im Preview-iframe → Test auf Published-URL erwartbar erfolgreich; Empfehlung: Published-URL nutzen.
- **C)** Konkreter Code-Bug (hängender Fetch ohne Timeout, fehlerhafte Loading-Bedingung) → minimaler, gezielter Einzelfix.

## Danach

Erst nach klarer Diagnose schlage ich genau **eine** isolierte Änderung vor — kein "Herumdoktern" mehr.

