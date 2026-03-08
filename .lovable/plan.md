

## Problem

Die Route `/:section` in `routes.tsx` fängt **jeden** einstelligen Pfad ab und leitet ihn an `Index.tsx` weiter. Dort trifft ein unbekannter Section-Name auf den `default`-Case im Switch (Zeile 218-219), der das statische `<Dashboard />` rendert statt einer 404-Seite.

## Lösung

**1. `src/pages/Index.tsx` — Default-Case auf NotFound umleiten**

Im `renderActiveSection()` Switch den `default`-Case ändern: Statt `<Dashboard />` wird `<Navigate to="/404" replace />` zurückgegeben, oder direkt die `NotFound`-Komponente gerendert.

Konkret: Zeile 218-219 ändern von:
```tsx
default:
  return <Dashboard />;
```
zu:
```tsx
default:
  return <NotFound />;
```

Dazu `NotFound` lazy importieren (wie bereits in `routes.tsx`).

**2. `src/pages/NotFound.tsx` — Schöne 404-Seite gestalten**

Die aktuelle NotFound-Seite ist minimalistisch (grauer Hintergrund, blauer Link). Stattdessen eine ansprechende 404-Seite im App-Design:
- Großes illustratives Icon (z.B. `SearchX` oder `FileQuestion` aus lucide)
- Überschrift "Seite nicht gefunden"
- Beschreibungstext auf Deutsch
- Button "Zurück zur Startseite" im App-Styling (Primary-Button mit `useNavigate`)
- Hintergrund passend zum App-Theme (`bg-gradient-subtle`)
- Optional: Button "Zurück" (Browser-History)

**Dateien:**
- `src/pages/NotFound.tsx` — Redesign
- `src/pages/Index.tsx` — Default-Case ändern + Import

