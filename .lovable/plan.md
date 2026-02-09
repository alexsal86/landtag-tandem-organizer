

# Plan: COI Service Worker Fix - Endgueltige Loesung fuer alle Entscheidungs-Fehler

## Root Cause (endlich gefunden!)

Die Fehler kommen weder aus dem Frontend-Code noch aus der Datenbank. Der Uebeltaeter ist die Datei `public/coi-serviceworker.js`.

### Was passiert

```text
Browser sendet PATCH-Request an Supabase
        |
        v
COI Service Worker faengt den Request ab
        |
        v
Supabase antwortet mit HTTP 204 (No Content)
        |
        v
Service Worker versucht: new Response(body, {status: 204})
        |
        v
FEHLER: "Response with null body status cannot have body"
(HTTP 204 darf laut Web-Standard keinen Body haben)
        |
        v
Promise wird rejected -> "Failed to fetch"
        |
        v
Frontend zeigt Fehler-Toast
```

Supabase gibt 204 zurueck wenn ein UPDATE ohne `.select()` ausgefuehrt wird (was korrekt ist - wir haben `.select()` absichtlich entfernt wegen RLS-Problemen). Die Daten werden tatsaechlich gespeichert, aber die Antwort kommt nie beim Frontend an.

### Warum das 4 Iterationen lang unentdeckt blieb

- Die DB-Logs zeigten keine Fehler (weil Supabase den Request korrekt verarbeitet)
- Die RLS-Policies waren in Ordnung (die Mutation funktioniert ja)
- Die Frontend-Fehlerbehandlung war korrekt (der Fehler kommt von ausserhalb des App-Codes)
- Der Fehler tritt in einer **Service-Worker-Datei** auf, die normalerweise nicht zum App-Code gehoert

## Loesung

### Einzige Aenderung: `public/coi-serviceworker.js`

Die problematische Zeile im Service Worker:
```javascript
new Response(e.body, {status: e.status, statusText: e.statusText, headers: r})
```

Muss null-body Status-Codes beruecksichtigen (101, 204, 205, 304):
```javascript
const isNullBodyStatus = [101, 204, 205, 304].includes(e.status);
new Response(isNullBodyStatus ? null : e.body, {status: e.status, statusText: e.statusText, headers: r})
```

Das ist ein bekannter Bug in coi-serviceworker v0.1.7. Neuere Versionen haben diesen Fix bereits integriert.

### Kein weiterer Code muss geaendert werden

- Kein `.select()` hinzufuegen
- Keine `.maybeSingle()` Aenderungen noetig (die bestehenden sind trotzdem sinnvoll)
- Keine Notification-Isolation noetig (die bestehende ist trotzdem sinnvoll)
- Die bisherigen Verbesserungen (resilientes Error-Handling, best-effort Notifications) bleiben bestehen

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Bearbeiten | `public/coi-serviceworker.js` (null-body-status Fix) |

## Verifizierung

Nach dem Fix werden alle drei Operationen getestet:
1. Archivieren - kein Fehler mehr
2. Wiederherstellen - kein Fehler mehr
3. Bearbeiten/Speichern - kein Fehler mehr

