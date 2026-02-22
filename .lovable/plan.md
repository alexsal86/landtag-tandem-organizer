

# Absturz nach Build verhindern (Stale-Chunk-Fehler)

## Problem

Nach jedem neuen Build aendert Vite die Dateinamen der Code-Chunks (z.B. `MyWorkQuickCapture-Ckl1f7M2.js` wird zu `MyWorkQuickCapture-Xyz789.js`). Wenn der Browser noch eine aeltere Version der Hauptdatei (`index.js`) im Cache hat, versucht er die alten Chunk-Dateien zu laden, die nicht mehr existieren. Das fuehrt zu einem 404-Fehler und einem Seitenabsturz.

Das Projekt nutzt ueber 40 `lazy()`-Imports in `Index.tsx` und `MyWorkView.tsx`, die alle davon betroffen sein koennen.

## Loesung

Eine zentrale Hilfsfunktion `lazyWithRetry` erstellen, die bei einem fehlgeschlagenen dynamischen Import automatisch die Seite neu laedt -- aber nur einmal, um Endlosschleifen zu vermeiden.

### Neue Datei: `src/lib/lazyWithRetry.ts`

```typescript
import { lazy } from "react";

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((error) => {
      const key = "chunk-reload-retry";
      const hasRetried = sessionStorage.getItem(key);

      if (!hasRetried) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        // Return a never-resolving promise to prevent React from rendering
        return new Promise(() => {});
      }

      sessionStorage.removeItem(key);
      throw error;
    })
  );
}
```

### Aenderungen in bestehenden Dateien

**`src/pages/Index.tsx`** und **`src/components/MyWorkView.tsx`**:
- `lazy` durch `lazyWithRetry` ersetzen (ca. 40 Stellen)
- Import von `lazy` aus React entfernen bzw. durch Import von `lazyWithRetry` aus `@/lib/lazyWithRetry` ersetzen

Beispiel:
```
// Vorher:
const MyWorkView = lazy(() => import("@/components/MyWorkView").then(...));

// Nachher:
const MyWorkView = lazyWithRetry(() => import("@/components/MyWorkView").then(...));
```

### Wie es funktioniert

1. Benutzer oeffnet die App mit gecachter alter Version
2. Lazy-Import schlaegt fehl (404 fuer alten Chunk)
3. `lazyWithRetry` setzt ein Flag in `sessionStorage` und laedt die Seite neu
4. Der Reload holt die neue `index.html` mit den aktuellen Chunk-Namen
5. Die Imports funktionieren jetzt
6. Wenn der Reload das Problem nicht loest (z.B. anderer Fehler), wird das Flag entfernt und der Fehler normal an die ErrorBoundary weitergereicht -- keine Endlosschleife

### Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/lib/lazyWithRetry.ts` | **Neu** -- Hilfsfunktion fuer fehlertolerantes Lazy-Loading |
| `src/pages/Index.tsx` | `lazy` durch `lazyWithRetry` ersetzen (25 Stellen) |
| `src/components/MyWorkView.tsx` | `lazy` durch `lazyWithRetry` ersetzen (11 Stellen) |

