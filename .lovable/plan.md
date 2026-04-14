

## Plan: Tenant-Kontext-Verlust und Benachrichtigungsfehler beheben

### Problem 1: "Kein Zugriff" nach einiger Zeit auf der Kontakte-Seite

**Root Cause**: Der `useTenant`-Hook wird bei jedem `user`-Objekt-Wechsel neu ausgeführt (Zeile 173: `useEffect` mit `[user]` dependency). Bei einem Supabase Token-Refresh erzeugt `useAuth` ein neues `user`-Objekt (gleiche ID, neue Referenz). Das löst `fetchTenants()` erneut aus, welches **sofort `setLoading(true)` setzt** — und während der Netzwerkanfrage ist `currentTenant` kurzzeitig `null`. Wenn die Anfrage fehlschlägt (z.B. kurzer Netzwerkfehler, RLS-Problem), bleibt `currentTenant = null` und die "Kein Zugriff"-Meldung erscheint.

Zusätzlich setzt der `catch`-Block (Zeile 148-151) destruktiv alle States auf leer, statt die vorherigen Werte beizubehalten.

**Fix**:
1. **`useTenant.tsx`**: `useEffect`-Dependency auf `user?.id` statt `user` ändern, damit Token-Refreshes keinen Re-Fetch auslösen
2. **`useTenant.tsx`**: Im `catch`-Block die vorherigen Tenant-Daten beibehalten statt destruktiv zu löschen — nur bei echtem User-Wechsel zurücksetzen
3. **`useTenant.tsx`**: Beim Re-Fetch (gleicher User) den `loading`-State nicht auf `true` setzen, wenn bereits Daten vorhanden sind (stale-while-revalidate Muster)

### Problem 2: Benachrichtigungen laden nicht / Toast-Fehler

**Root Cause**: Gleicher Effekt — der `loadNotifications` Callback hat `[user, toast]` als Dependencies. Bei Token-Refresh ändert sich die `user`-Referenz, was den Realtime-Channel neu aufbaut (Zeile 731: `[user, toast, loadNotifications]`). Wenn dabei der Supabase-Client kurzzeitig keinen gültigen Token hat, schlägt die Abfrage fehl und zeigt den destruktiven Toast "Benachrichtigungen konnten nicht geladen werden."

**Fix**:
1. **`useNotifications.tsx`**: `loadNotifications` Dependency auf `user?.id` statt `user` stabilisieren
2. **`useNotifications.tsx`**: Realtime-Subscription useEffect ebenfalls auf `user?.id` stabilisieren, damit Token-Refreshes nicht den Channel neu aufbauen
3. **`useNotifications.tsx`**: Bei Fehlern im `loadNotifications` die vorherigen Notifications beibehalten (stale data > no data)

### Problem 3: Build-Fehler in ContactDetailPanel.tsx

**Root Cause**: Der Type-Guard `channel is ContactChannel` ist nicht kompatibel mit den Array-Elementen, weil die Lucide-Icons und die Custom-Social-Icons unterschiedliche Signatur-Typen haben.

**Fix**: Die `.filter()` einfach mit `Boolean` tippen statt mit einem inkompatiblen Type-Predicate.

### Betroffene Dateien
- `src/hooks/useTenant.tsx` — Stabilisierung gegen Token-Refresh
- `src/hooks/useNotifications.tsx` — Stabilisierung gegen Token-Refresh
- `src/components/ContactDetailPanel.tsx` — Build-Fehler beheben

