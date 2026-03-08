

## Problem

`supabase.auth.signOut()` verwendet standardmäßig `scope: 'global'`, was den Refresh-Token serverseitig invalidiert und **alle Geräte/Tabs** abmeldet. Deshalb wird das Handy mit abgemeldet, wenn du dich am Desktop ausloggst.

## Lösung

Eine einzige Zeile ändern in `src/hooks/useAuth.tsx` (Zeile 115):

```typescript
// Vorher:
await supabase.auth.signOut();

// Nachher:
await supabase.auth.signOut({ scope: 'local' });
```

Mit `scope: 'local'` wird nur das aktuelle Browser-Token gelöscht. Andere Geräte/Tabs behalten ihre eigene Session.

Die bestehende `global-logout` Edge Function bleibt als **bewusste** Option erhalten, wenn der Nutzer sich explizit von allen Geräten abmelden will (z.B. über die Session-Verwaltung im Profil).

**1 Datei, 1 Zeile** — keine weiteren Änderungen nötig.

