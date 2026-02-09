

# Fix: COI Service Worker Syntax-Fehler korrigieren

## Was ist passiert

Der letzte Fix hat im minifizierten Code einen Syntax-Fehler eingefuehrt:

```text
// ORIGINAL (funktioniert - Komma-Operator):
return r.set(...), r.set(...), r.set(...), new Response(e.body, {...})
                                           ^^^^^^^^^^^^^^^^^^^^^^^^
                                           Dieser Wert wird zurueckgegeben

// KAPUTT (nach dem Fix - Semikolon bricht return):
return r.set(...), r.set(...), r.set("same-origin"); const n=...; return new Response(...)
                                                   ^
                                              HIER ENDET DAS RETURN!
                                              -> gibt undefined zurueck
                                              -> const n und zweites return sind unerreichbar
```

Das bedeutet: JEDER Request (nicht nur PATCH/204) gibt `undefined` statt eines Response-Objekts zurueck. Deshalb laedt die Seite gar nichts mehr.

## Loesung

Die Null-Body-Pruefung muss innerhalb der Komma-Operator-Kette bleiben, oder die Kette muss korrekt in Statements umgewandelt werden.

Korrekte Version - die gesamte Return-Logik umschreiben:

```javascript
// Statt Komma-Operator: Einzelne Statements mit explizitem return
const r = new Headers(e.headers);
r.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
coepCredentialless || r.set("Cross-Origin-Resource-Policy", "cross-origin");
r.set("Cross-Origin-Opener-Policy", "same-origin");
const n = [101, 204, 205, 304].includes(e.status);
return new Response(n ? null : e.body, {status: e.status, statusText: e.statusText, headers: r});
```

Da dies minifizierter Code ist, muss die gesamte Zeile korrekt neugeschrieben werden, wobei die Komma-Operator-Kette in separate Statements mit einem einzigen `return` am Ende umgewandelt wird.

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Bearbeiten | `public/coi-serviceworker.js` (Syntax-Fix) |

