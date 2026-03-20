

## RSVP-Widget: Ghost-Frontend + Plesk Node.js Proxy

### Situation

- Ghost CMS auf `www.alexander-salomon.de` liefert das Frontend (custom-einladung.hbs)
- Plesk Hosting mit Node.js auf `einladung.alexander-salomon.de` verfügbar
- Startdatei muss `app.js` heißen (Plesk-Konvention)
- Document Root: `/einladung.alexander-salomon.de/httpdocs`
- Keine Supabase-Informationen sollen im Browser sichtbar sein

### Architektur

```text
Ghost (www.alexander-salomon.de)         Plesk Node.js (einladung.alexander-salomon.de)
┌──────────────────────────┐             ┌──────────────────────────────────────┐
│ custom-einladung.hbs     │             │ app.js                               │
│                          │             │                                      │
│ fetch('https://einladung │────────────►│ POST /pruefe  → Supabase get-...     │
│ .alexander-salomon.de    │             │ POST /antwort → Supabase respond-... │
│ /pruefe', ...)           │◄────────────│                                      │
│                          │             │ + injiziert Auth-Header              │
│ Kein Key, keine URL      │             │ + entfernt Supabase-Header           │
└──────────────────────────┘             └──────────────────────────────────────┘
```

### Dateien

**1. `docs/ghost-rsvp-widget/app.js` (Neu)**

Minimaler Node.js-Server für Plesk (~60 Zeilen, keine externen Dependencies):
- Verwendet nur `http` und `https` (Node.js stdlib)
- `POST /pruefe` → leitet an `get-public-event-invitation` weiter, injiziert `Authorization` + `apikey`
- `POST /antwort` → leitet an `respond-public-event-invitation` weiter, injiziert Header
- Entfernt Supabase-Response-Header (`x-kong-*`, `sb-gateway-*`, `x-envoy-*`)
- Liest Credentials aus Umgebungsvariablen (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- CORS für `https://www.alexander-salomon.de`
- Plesk/Passenger-kompatibel (lauscht auf `process.env.PORT || 3000`)

**2. `docs/ghost-rsvp-widget/custom-einladung.hbs` (Ändern)**

- `API_BASE` und `ANON_KEY` Variablen komplett entfernen
- Neue Variable: `PROXY_BASE = 'https://einladung.alexander-salomon.de'`
- `loadInvitation()`: fetch auf `PROXY_BASE + '/pruefe'`, ohne Authorization/apikey Header
- `submitResponse()`: fetch auf `PROXY_BASE + '/antwort'`, ohne Authorization/apikey Header

**3. `docs/ghost-rsvp-widget/SETUP.md` (Neu schreiben)**

Anleitung für Plesk:
1. `app.js` in `/einladung.alexander-salomon.de/` ablegen
2. Umgebungsvariablen in Plesk setzen (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
3. DNS für `einladung.alexander-salomon.de` korrigieren (Plesk zeigt bereits DNS-Warnung)
4. Node.js in Plesk aktivieren und Startdatei auf `app.js` setzen
5. Ghost-Template deployen
6. Testen

### Ergebnis

- Im Ghost-Template steht nur `fetch('https://einladung.alexander-salomon.de/pruefe')` — kein Supabase-Hinweis
- Credentials liegen als Umgebungsvariablen in Plesk
- Keine npm-Dependencies nötig — nur eine einzelne `app.js`-Datei
- Supabase-Response-Header werden vom Proxy entfernt

