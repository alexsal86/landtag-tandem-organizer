

# Themenspeicher-Fehler in Redaktion diagnostizieren und beheben

## Situation

Der Redaktion-Tab zeigt einen Fehler (ErrorBoundary-Fallback "Redaktion konnte nicht geladen werden"). Die genaue Ursache ist nicht aus dem Code oder Build-Logs ersichtlich -- es gibt keine TypeScript-Fehler, keine Build-Fehler, und keine sichtbaren Runtime-Errors in den Logs. Der Fehler tritt erst zur Laufzeit auf und wird von der ErrorBoundary gefangen.

## Diagnose-Ansatz

Da der Fehler nicht reproduzierbar ist (Auth-Gate), werde ich diagnostische `console.error`-Ausgaben einfügen, damit beim nächsten Auftreten die genaue Fehlermeldung sichtbar wird.

### Schritt 1: ErrorBoundary um Fehlerdetails erweitern

In `src/components/ErrorBoundary.tsx`:
- Im `componentDidCatch` den Fehlernamen und die Message zusätzlich per `console.error` mit einem eindeutigen Prefix ausgeben
- Im Fallback-Render den `error.message` anzeigen, damit der User sehen kann, was genau schiefgeht

### Schritt 2: Try-Catch in RedaktionFeature und PlannerBoard

In `src/features/redaktion/components/RedaktionFeature.tsx`:
- Console.log beim Mount, um zu bestätigen dass die Komponente geladen wird

In `src/features/redaktion/components/PlannerBoard.tsx`:
- Console.log am Anfang der Komponente mit den wesentlichen States (currentTenant, user vorhanden ja/nein)
- Das hilft herauszufinden, ob der Fehler beim initialen Render oder beim Datenladen passiert

### Schritt 3: Mögliche Ursachen präventiv absichern

Basierend auf Code-Review könnten diese Stellen Probleme verursachen:

1. **`Kalenderansicht.tsx` Zeile 18**: `withDragAndDrop<CalendarEvent>(Calendar)` wird bei jedem Modul-Load ausgeführt. Falls `CalendarEvent` nicht definiert ist bevor diese Zeile läuft, gibt es einen Runtime-Error.

2. **`PlannerBoard.tsx`**: `useSearchParams()` wird verwendet, was einen `RouterContext` voraussetzt. Das sollte vorhanden sein, aber zur Sicherheit prüfen.

3. **Supabase-Queries in `useTopicBacklog`/`useSocialPlannerItems`**: Falls eine Query einen unerwarteten Fehler wirft der nicht gefangen wird, könnte das den Render-Zyklus brechen.

## Umsetzung

### Datei 1: `src/components/ErrorBoundary.tsx`
- `error.message` und `error.stack` im Fallback sichtbar machen (in einer kleinen, scrollbaren `<pre>`-Box), damit der User den Fehler direkt melden kann

### Datei 2: `src/features/redaktion/components/RedaktionFeature.tsx`
- `console.log("[RedaktionFeature] mounted")` am Anfang der Komponente

### Datei 3: `src/features/redaktion/components/PlannerBoard.tsx`
- `console.log("[PlannerBoard] render", { hasTenant, hasUser })` am Anfang

## Ergebnis

Nach dem Deploy werden beim nächsten Besuch des Redaktion-Tabs die genaue Fehlermeldung in der Konsole und auf dem Bildschirm sichtbar. Damit kann die eigentliche Ursache gezielt behoben werden.
