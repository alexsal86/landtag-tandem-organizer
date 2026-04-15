
Do I know what the issue is? Ja — deutlich genauer als vorher.

### Wahrscheinlicher tatsächlicher Fehler
Der Fehler ist sehr wahrscheinlich jetzt **nicht mehr primär CORS**, denn die Logs zeigen, dass `send-push-notification` per `GET` noch aufgerufen wird. Der Bruch passiert also **danach**.

Der kritischste Bug sitzt aktuell im Frontend-Flow in `src/hooks/useNotifications.tsx`:

- Wenn Browser-Subscription und Datenbankstatus nicht zusammenpassen, wird die **bestehende Browser-Subscription sofort abgemeldet**:
  - in `subscribeToPush()`
  - und zusätzlich automatisch in `checkAndRenewSubscription()`
- Erst **danach** wird versucht, eine neue Subscription zu erzeugen.
- Wenn dieser zweite Schritt fehlschlägt (z. B. ungültiger VAPID-Key, `pushManager.subscribe()`-Fehler oder DB-Upsert-Fehler), ist die vorher funktionierende Subscription schon weg.

Das passt exakt zu deinem Verlauf:
- bis ca. 23 Uhr lief es,
- dann gab es offenbar einen Mismatch/Fehler,
- der Auto-Renew-Flow hat die alte Subscription zerstört,
- seitdem kann sie nicht sauber repariert werden.

### Umsetzung
1. **Renew-/Repair-Logik nicht-destruktiv umbauen**
   - Datei: `src/hooks/useNotifications.tsx`
   - Wenn `pushManager.getSubscription()` bereits eine Subscription liefert:
     - **nicht** sofort `unsubscribe()`
     - stattdessen die vorhandene Browser-Subscription direkt in `push_subscriptions` **reparieren/upserten**
   - Nur wenn im Browser **gar keine** Subscription existiert, darf `pushManager.subscribe()` aufgerufen werden.

2. **Auto-Renew sicher machen**
   - Datei: `src/hooks/useNotifications.tsx`
   - `checkAndRenewSubscription()` darf bei DB-Mismatch nicht mehr zuerst die Browser-Subscription löschen.
   - Stattdessen:
     - vorhandene Browser-Subscription bevorzugen,
     - DB-Eintrag darauf synchronisieren,
     - alte/stale DB-Endpunkte erst **nach erfolgreicher Reparatur** deaktivieren.

3. **Fehlerursache sichtbar machen**
   - Datei: `src/hooks/useNotifications.tsx`
   - Den generischen Fehler in konkrete Schritte aufteilen:
     - Service Worker Registrierung
     - VAPID-Key Abruf
     - `pushManager.subscribe()`
     - DB-Upsert `push_subscriptions`
   - So sieht man sofort, ob das Problem aktuell ein kaputter VAPID-Key oder ein Frontend-/DB-Repair-Fehler ist.

4. **VAPID-Health explizit prüfen**
   - Dateien:
     - `src/hooks/useNotifications.tsx`
     - optional `supabase/functions/send-push-notification/index.ts`
   - GET-Antwort robuster prüfen:
     - `publicKey` vorhanden
     - plausibles Format
   - Falls nötig zusätzlich eine kleine Health-Response ergänzen, damit fehlende/kaputte Secrets sofort erkennbar sind.

5. **Bestehende kaputte Zustände bereinigen**
   - Nach der Code-Anpassung:
     - vorhandene Browser-Subscription wiederverwenden, wenn sie noch existiert
     - nur veraltete DB-Zeilen deaktivieren
     - keinen “unsubscribe first”-Flow mehr

### Betroffene Dateien
- `src/hooks/useNotifications.tsx` — Hauptfix
- optional `supabase/functions/send-push-notification/index.ts` — bessere VAPID-Diagnose
- optional `src/components/NotificationSettings.tsx` — präzisere UI-Fehlermeldung

### Erwartetes Ergebnis
- Die Erneuerung zerstört nicht mehr zuerst die funktionierende Subscription
- Ein DB-Mismatch führt zu einer **Reparatur**, nicht zu einem Totalausfall
- Push lässt sich wieder aktivieren/erneuern
- Falls danach noch etwas scheitert, ist der exakte Fehler eindeutig sichtbar statt nur „konnte nicht aktiviert werden“

### Technische Kurzbegründung
Die Logs sprechen gegen einen reinen CORS-Blocker, weil der VAPID-Endpoint noch erreicht wird. Der gefährlichste reale Fehler im aktuellen Code ist das **vorzeitige `unsubscribe()`**. Das ist genau die Art Bug, die aus einem kleinen Inkonsistenzproblem innerhalb weniger Minuten einen dauerhaften Push-Ausfall macht.
