

## Passwort-basiertes Matrix-Login

Aktuell muss man den Access Token manuell aus Element kopieren. Stattdessen wird ein Passwort-Login direkt in der MatrixLoginForm integriert, das die Matrix Client-Server API nutzt.

### Funktionsweise

1. Der Benutzer gibt **Matrix User ID**, **Passwort** und **Homeserver URL** ein
2. Die App ruft `POST /_matrix/client/v3/login` mit `type: "m.login.password"` auf
3. Der Server antwortet mit `access_token`, `device_id` und `user_id`
4. Diese werden automatisch in die Formularfelder uebernommen, in Supabase gespeichert und die Matrix-Verbindung wird hergestellt

### Aenderungen in `src/components/chat/MatrixLoginForm.tsx`

**Neuer State:**
- `password` (string) -- Passwort-Eingabefeld
- `isLoggingIn` (boolean) -- Ladezustand fuer den Login-Button

**Neue Funktion `handlePasswordLogin`:**
- Validiert `matrixUserId` und `password`
- Extrahiert den Homeserver aus der User ID (z.B. `@user:matrix.bw-messenger.de` -> `https://matrix.bw-messenger.de`), oder nutzt die manuell eingegebene Homeserver URL
- Sendet einen `fetch`-Request an `${homeserverUrl}/_matrix/client/v3/login`:

```typescript
const response = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'm.login.password',
    identifier: {
      type: 'm.id.user',
      user: matrixUserId.split(':')[0].substring(1), // @user:server -> user
    },
    password: password,
    initial_device_display_name: 'Lovable App',
  }),
});
```

- Bei Erfolg: `access_token`, `device_id` in die Formularfelder setzen, Passwort-Feld leeren, Zugangsdaten in Supabase speichern, `connect()` aufrufen
- Bei Fehler: Toast mit Fehlermeldung anzeigen

**UI-Aenderungen:**
- Neues Passwort-Eingabefeld nach der Matrix User ID
- Neuer "Mit Passwort anmelden"-Button
- Trennung zwischen Passwort-Login (primaer) und manuellem Access-Token (erweitert/optional)
- Die Access-Token-Hilfe am Ende wird angepasst, da sie nicht mehr der primaere Weg ist

### Technische Details

| Bereich | Detail |
|---|---|
| API-Endpunkt | `POST /_matrix/client/v3/login` |
| Auth-Typ | `m.login.password` mit `m.id.user` Identifier |
| Device-Name | `Lovable App` (wird dem Server als `initial_device_display_name` mitgeteilt) |
| Sicherheit | Passwort wird nicht gespeichert, nur fuer den Login-Request verwendet |
| Datei | `src/components/chat/MatrixLoginForm.tsx` |

