

## Anpassung: Query-Parameter statt URL-Segment

### Problem
Ghost `routes.yaml` unterstützt keine dynamischen Segmente (`/einladung/{code}/`). Der `{code}`-Platzhalter wird nicht aufgelöst.

### Lösung
Statische Ghost-Route `/einladung/` mit dem Code als Query-Parameter: `?code=ABC123`

### Änderungen

**1. `docs/ghost-rsvp-widget/custom-einladung.hbs`**

Die `extractCode()`-Funktion ändern — statt aus dem Pfad wird der Code aus dem Query-Parameter gelesen:

```javascript
// Vorher:
var match = path.match(/\/einladung\/([^\/]+)/);
return match ? decodeURIComponent(match[1]) : null;

// Nachher:
var params = new URLSearchParams(window.location.search);
return params.get('code') || null;
```

**2. `docs/ghost-rsvp-widget/SETUP.md`**

`routes.yaml`-Anweisung korrigieren:

```yaml
routes:
  /einladung/:
    template: custom-einladung
```

Kein `{code}` mehr — es ist eine statische Route. Test-URL wird zu:
`https://www.alexander-salomon.de/einladung/?code=DEIN_TEST_CODE`

**3. `supabase/functions/send-event-invitation/index.ts`**

Den Einladungslink in der E-Mail anpassen (Zeile 239):

```javascript
// Vorher:
const invitationUrl = `https://www.alexander-salomon.de/einladung/${publicLink.public_code}`;

// Nachher:
const invitationUrl = `https://www.alexander-salomon.de/einladung/?code=${encodeURIComponent(publicLink.public_code)}`;
```

**4. `src/pages/LegacyEventRSVPRedirect.tsx`**

Den Redirect anpassen, damit alte Links mit `?code=` korrekt weitergeleitet werden — da die Zielseite jetzt ebenfalls `?code=` nutzt, wird der Redirect zu:

```javascript
return <Navigate to={`/einladung/?code=${encodeURIComponent(code)}`} replace />;
```

### Ergebnis
- Ghost-Route funktioniert als statische Seite
- Code wird sauber per Query-Parameter übergeben
- E-Mail-Links zeigen auf `www.alexander-salomon.de/einladung/?code=CODE`

