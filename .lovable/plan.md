## RSVP-Widget: Ghost-Frontend + Plesk Node.js Proxy ✅

Umgesetzt: Ghost-Template (`custom-einladung.hbs`) als Frontend, Node.js-Proxy (`app.js`) auf `einladung.alexander-salomon.de` als API-Bridge zu Supabase. Keine Supabase-Credentials oder URLs im Browser sichtbar.

### Query-Parameter statt URL-Segment ✅

Ghost unterstützt keine dynamischen Routen. Einladungscodes werden jetzt per Query-Parameter (`?code=ABC`) statt URL-Segment (`/einladung/ABC`) übergeben.

### Erstellte/geänderte Dateien

- `docs/ghost-rsvp-widget/app.js` — Node.js-Proxy (keine Dependencies, nur stdlib)
- `docs/ghost-rsvp-widget/custom-einladung.hbs` — Widget mit `?code=` Query-Parameter
- `docs/ghost-rsvp-widget/SETUP.md` — Plesk-Deployment-Anleitung
- `supabase/functions/send-event-invitation/index.ts` — E-Mail-Links mit `?code=`
- `src/pages/LegacyEventRSVPRedirect.tsx` — Redirect mit `?code=`
