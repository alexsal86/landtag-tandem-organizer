# RSVP-Widget: Plesk Node.js Proxy + Ghost Frontend

## Übersicht

Das RSVP-Widget besteht aus zwei Teilen:

1. **Ghost-Frontend** (`custom-einladung.hbs`) — wird auf `www.alexander-salomon.de/einladung/{code}` angezeigt
2. **Node.js-Proxy** (`app.js`) — läuft auf `einladung.alexander-salomon.de` und leitet API-Anfragen sicher an Supabase weiter

Im Browser sind keine Supabase-URLs oder API-Keys sichtbar.

## Schritt 1: Proxy auf Plesk einrichten

### 1.1 Subdomain anlegen

Falls noch nicht geschehen: In Plesk eine Subdomain `einladung.alexander-salomon.de` anlegen.

### 1.2 `app.js` hochladen

Die Datei `app.js` in das Anwendungsverzeichnis der Subdomain kopieren (z.B. `/einladung.alexander-salomon.de/`).

**Keine `npm install` nötig** — der Proxy nutzt nur Node.js-Standardbibliotheken.

### 1.3 Node.js in Plesk aktivieren

In Plesk → Subdomain → **Node.js** Einstellungen:

| Einstellung | Wert |
|---|---|
| Node.js-Version | 21.7.3 (oder neueste verfügbare) |
| Startdatei | `app.js` |
| Document Root | `httpdocs` (Standard) |

### 1.4 Umgebungsvariablen setzen

In den Node.js-Einstellungen unter **Umgebungsvariablen**:

| Variable | Wert |
|---|---|
| `SUPABASE_URL` | `https://wawofclbehbkebjivdte.supabase.co` |
| `SUPABASE_ANON_KEY` | *(den Anon-Key aus dem Supabase-Dashboard kopieren)* |
| `ALLOWED_ORIGIN` | `https://www.alexander-salomon.de` *(optional, ist Standard)* |

### 1.5 DNS prüfen

Sicherstellen, dass `einladung.alexander-salomon.de` korrekt auf den Server zeigt. Plesk zeigt ggf. eine DNS-Warnung — diese beheben.

### 1.6 SSL aktivieren

In Plesk → Subdomain → **SSL/TLS-Zertifikate** → Let's Encrypt aktivieren.

### 1.7 Testen

```bash
# Health-Check
curl https://einladung.alexander-salomon.de/health
# Sollte {"status":"ok"} zurückgeben

# API-Test (mit echtem Code)
curl -X POST https://einladung.alexander-salomon.de/pruefe \
  -H "Content-Type: application/json" \
  -d '{"public_code":"TEST_CODE"}'
```

## Schritt 2: Ghost-Template deployen

### 2.1 Template-Datei kopieren

`custom-einladung.hbs` in das aktive Ghost-Theme:

```
content/themes/DEIN-THEME/custom-einladung.hbs
```

### 2.2 `routes.yaml` anpassen

In Ghost Admin → **Settings** → **Labs** → **Routes**:

```yaml
routes:
  /einladung/:
    template: custom-einladung
```

### 2.3 Theme hochladen / Ghost neu starten

Theme als ZIP hochladen oder Ghost neu starten.

## Schritt 3: Testen

Öffnen Sie eine Test-URL mit einem echten RSVP-Code:

```
https://www.alexander-salomon.de/einladung/DEIN_TEST_CODE
```

## Architektur

```text
Browser → Ghost (www.alexander-salomon.de/einladung/CODE)
  │
  │  HTML-Seite wird geladen (custom-einladung.hbs)
  │  Kein Supabase-Hinweis im Quellcode
  │
  ├─ POST https://einladung.alexander-salomon.de/pruefe
  │    → Proxy injiziert Auth-Header
  │    → Supabase get-public-event-invitation
  │    → Proxy entfernt Supabase-Header
  │    ← JSON-Antwort
  │
  └─ POST https://einladung.alexander-salomon.de/antwort
       → Proxy injiziert Auth-Header
       → Supabase respond-public-event-invitation
       → Proxy entfernt Supabase-Header
       ← JSON-Antwort
```

## Sicherheit

- **Keine Credentials im Browser**: Supabase-URL und API-Key liegen nur als Umgebungsvariablen auf dem Server
- **Header-Stripping**: Supabase-spezifische Response-Header (`x-kong-*`, `sb-gateway-*`, `x-envoy-*`) werden entfernt
- **CORS**: Nur Anfragen von `www.alexander-salomon.de` werden akzeptiert
- **Body-Limit**: Maximal 16 KB pro Request
- **Timeout**: 15 Sekunden für Upstream-Anfragen

## Anpassungen

### Andere Domain

`ALLOWED_ORIGIN` Umgebungsvariable in Plesk ändern.

### Proxy-URL im Widget

In `custom-einladung.hbs` die Variable `PROXY_BASE` anpassen:

```javascript
var PROXY_BASE = 'https://einladung.alexander-salomon.de';
```
