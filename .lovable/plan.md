

# Plan: Vorgänge-Dialog reparieren und Struktur weiterentwickeln

## Problemanalyse

Der Dialog "Neues Anliegen" zeigt einen Fehler. Es gibt zwei mögliche Ursachen:

1. **Kein Sitzungskontext**: `user` oder `currentTenant` ist `null` → Dialog zeigt "Kein aktiver Mandanten-/Sitzungskontext". Dies passiert, wenn der Nutzer nicht eingeloggt ist oder kein Mandant ausgewählt wurde.

2. **DB-Insert schlägt fehl**: `createCaseItem` gibt `null` zurück → Dialog zeigt "Anliegen konnte nicht erstellt werden". Die Fehlermeldung im Catch-Block ist zu generisch - der tatsächliche DB-Fehler wird nur in die Konsole geloggt, nicht dem Nutzer angezeigt.

Zusätzlich: In `MyWorkCaseItemsTab.tsx` (Zeile 114) wird die Edge Function `suggest-case-escalations` aufgerufen. Wenn diese fehlschlägt, bricht der gesamte `loadCaseItems`-Aufruf ab.

## Umsetzung

### 1. Fehlerdetails im Dialog anzeigen
In `useCaseItems.createCaseItem`: Den tatsächlichen DB-Fehler (z.B. RLS-Verletzung, fehlende Spalte) als Toast-Beschreibung anzeigen statt nur "Vorgang konnte nicht erstellt werden." — so sieht man sofort, ob es ein Auth-Problem, ein RLS-Problem oder ein Schema-Problem ist.

### 2. CaseItemCreateDialog verbessern
- Wenn `hasContext` false ist, den Button komplett deaktivieren UND eine klarere Meldung zeigen
- Den tatsächlichen Fehlertext vom Server im `submitError` anzeigen, nicht nur eine generische Meldung

### 3. Edge-Function-Aufruf in MyWorkCaseItemsTab entkoppeln
Der `suggest-case-escalations`-Aufruf in `loadCaseItems` (Zeile 100-117) ist in einem `Promise.all` mit dem Laden der Vorgänge. Wenn die Edge Function fehlschlägt, werden auch keine Vorgänge angezeigt. Fix: Den Edge-Function-Aufruf in einen separaten try/catch auslagern, sodass Vorgänge auch ohne Eskalationsvorschläge geladen werden.

### 4. MyWorkCasesWorkspace: subject-Feld in der Anzeige verwenden
Aktuell zeigt der Workspace `resolution_summary` als Titel (Zeile 273). Besser: `subject || resolution_summary || "Ohne Titel"` — konsistent mit dem, was im Dialog eingegeben wird.

### 5. Vorgangs-CaseItem-Typ um subject erweitern
In `MyWorkCasesWorkspace.tsx` fehlt `subject` im lokalen `CaseItem`-Type (Zeile 21-32). Es wird im SELECT nicht abgefragt (Zeile 115) und daher nie angezeigt.

