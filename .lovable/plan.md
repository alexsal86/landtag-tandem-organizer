
Ich kenne die wahrscheinliche Ursache jetzt deutlich genauer:

### Wahrscheinlichstes Problem
Der Fehler liegt sehr wahrscheinlich nicht mehr primär am Service Worker, sondern am Abruf des VAPID Public Keys beim Aktivieren von Push.

In `src/hooks/useNotifications.tsx` wird der Key per direktem Browser-`fetch()` von  
`https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-push-notification` geladen.

Diese Edge Function läuft durch `withSafeHandler()` aus `supabase/functions/_shared/security.ts`. Dort sind aber aktuell nur diese Origins erlaubt:

- `https://app.landtag-tandem.de`
- `http://localhost:5173`
- `http://localhost:3000`

Nicht erlaubt sind die aktuell genutzten Lovable-Domains wie z. B.:

- `https://7d09a65d-5cbe-421b-a580-38a4fe244277.lovableproject.com`
- `https://id-preview--...lovable.app`

Wenn du also die App in einem normalen Browserfenster auf der `lovableproject.com`-Domain öffnest, ist das zwar kein iframe-Problem mehr, aber weiterhin ein CORS-Problem. Dann schlägt genau der VAPID-Key-Request beim Aktivieren fehl und `subscribeToPush()` endet mit dem generischen Fehler „Push-Benachrichtigungen konnten nicht aktiviert werden“.

### Zusätzliche Schwachstelle
Es gibt noch eine zweite unnötige Fehlerquelle:
- `requestPushPermission()` ruft intern schon `subscribeToPush()` auf
- `NotificationSettings.tsx` ruft danach bei Erfolg nochmal `subscribeToPush()` auf

Das ist doppelt und macht die Fehlerdiagnose unnötig unklar.

### Umsetzung
1. **CORS für Edge Functions korrigieren**
   - Datei: `supabase/functions/_shared/security.ts`
   - Die Origin-Prüfung so erweitern, dass auch die aktuellen Lovable-Hosts akzeptiert werden:
     - `*.lovableproject.com`
     - `*.lovable.app`
   - Dabei keine pauschale `*`-Freigabe, sondern kontrollierte Host-Regeln.

2. **VAPID-Key-Abruf im Frontend robuster machen**
   - Datei: `src/hooks/useNotifications.tsx`
   - Den hart codierten Supabase-Function-URL-String entfernen.
   - Stattdessen die URL aus `VITE_SUPABASE_URL` ableiten.
   - Keine hartcodierten Keys im Frontend mehr verwenden.
   - Den Fehlertext beim VAPID-Abruf präziser loggen, damit klar ist, ob es ein CORS-, HTTP-, SW- oder Subscription-Fehler ist.

3. **Doppelten Subscribe-Flow bereinigen**
   - Dateien:
     - `src/hooks/useNotifications.tsx`
     - `src/components/NotificationSettings.tsx`
   - Entweder:
     - `requestPushPermission()` kümmert sich nur um die Berechtigung
     - und `NotificationSettings` startet danach genau einmal `subscribeToPush()`
   - oder umgekehrt, aber nicht beides doppelt.

4. **Service-Worker-Registrierung konsistent machen**
   - Dateien:
     - `src/main.tsx`
     - `src/hooks/useNotifications.tsx`
   - Beide Stellen sollen dieselbe `sw.js`-URL verwenden (aktuell einmal mit Query-String, einmal ohne), damit keine unnötigen Re-Registrierungen oder inkonsistenten Zustände entstehen.

5. **Diagnose für wiederkehrende Fehler verbessern**
   - Datei: `src/hooks/useNotifications.tsx`
   - Im Catch-Block den konkreten Schritt unterscheiden:
     - SW-Registrierung fehlgeschlagen
     - VAPID-Key-Request fehlgeschlagen
     - `pushManager.subscribe()` fehlgeschlagen
     - DB-Upsert fehlgeschlagen

### Betroffene Dateien
- `supabase/functions/_shared/security.ts`
- `src/hooks/useNotifications.tsx`
- `src/components/NotificationSettings.tsx`
- `src/main.tsx`
- optional: `src/components/VapidKeyTest.tsx` zur gleichen URL-/CORS-Logik

### Erwartetes Ergebnis
- Push-Aktivierung funktioniert wieder in normalen Browserfenstern auf der Lovable-Domain
- Kein CORS-Fehler mehr beim Abrufen des VAPID-Keys
- Klarere Fehlerdiagnose, falls danach noch ein echter Subscription- oder DB-Fehler bleibt
- Kein doppelter Aktivierungsversuch mehr
