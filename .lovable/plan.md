

# Fix: trackPageVisit synchronisiert nicht mit useRecentlyVisited

## Problem

`trackPageVisit()` (standalone-Funktion) schreibt korrekt in localStorage, aber der `useRecentlyVisited()`-Hook in AppNavigation liest den State nur einmal beim Mount (`useState(loadPages)`). Danach bekommt er keine Updates mit, wenn Detail-Komponenten `trackPageVisit` aufrufen. Die Eintraege erscheinen erst nach einem kompletten Page-Reload.

## Loesung

Ein Custom Event als Synchronisations-Mechanismus zwischen `trackPageVisit` und dem Hook:

**`src/hooks/useRecentlyVisited.ts`**:
1. `trackPageVisit()` dispatcht nach dem Speichern ein `CustomEvent('recently-visited-updated')` auf `window`
2. `useRecentlyVisited()` registriert einen `useEffect`-Listener fuer dieses Event und ruft `setRecentPages(loadPages())` auf, wenn es gefeuert wird
3. So bleibt die Architektur entkoppelt — Detail-Komponenten brauchen keine Props oder Contexts

Aenderung: nur 1 Datei, ca. 10 Zeilen zusaetzlich.

