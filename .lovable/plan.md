

# Fix: Fristen-Gruppierung korrigiert überfällige Einträge

## Problem

Die Gruppierungslogik in `DashboardTasksSection.tsx` (Zeile 94-108) hat einen logischen Fehler:

```
if (isToday(d))           → Heute
else if (isAfter(d, now) && !isAfter(d, weekEnd)) → Diese Woche
else                      → Später     ← HIER landen auch ÜBERFÄLLIGE Items!
```

Items mit Fristdatum VOR heute fallen durch beide Bedingungen und landen im "Später"-Bucket. Das ist falsch - überfällige Fristen müssen als erstes und hervorgehoben angezeigt werden.

## Lösung

**Datei: `src/components/dashboard/DashboardTasksSection.tsx`**

1. Neue Gruppe **"Überfällig"** hinzufügen (vor "Heute")
2. Gruppierungslogik korrigieren:
   - `isBefore(d, startOfDay(now))` → **Überfällig** (rot hervorgehoben)
   - `isToday(d)` → **Heute**
   - `isAfter(d, startOfDay(now)) && !isAfter(d, weekEnd)` → **Diese Woche**
   - Rest → **Später**
3. "Überfällig"-Gruppe mit roter Akzentfarbe (`text-red-500`) im Header darstellen

