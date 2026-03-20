

## RSVP-System auf alexander-salomon.de fertigstellen

### Ist-Zustand

**Backend (fertig):**
- Edge Functions `get-public-event-invitation` und `respond-public-event-invitation` existieren und sind deployed
- E-Mails verweisen bereits auf `https://www.alexander-salomon.de/einladung/{code}`
- Datenmodell (`event_rsvp_public_links`, `event_rsvps`) ist vollständig

**Frontend (Lovable-App, fertig als Legacy):**
- `EventRSVP.tsx` auf `/einladung/:code` — voll funktionsfähige RSVP-Seite mit Zusage/Absage/Vorbehalt
- `publicInvitationApi.ts` — API-Client, ruft aktuell **relative URLs** `/api/public-event-invitations/:code` auf

**Build-Fehler (zu beheben):**
- `get-public-event-invitation/index.ts:161`: `rateLimit()` wird mit 4 Argumenten aufgerufen, die lokale Funktion hat aber nur 3 Parameter (es fehlt `now`)
- `respond-public-event-invitation`: TypeScript-Kompatibilitätsfehler bei `ServiceClient`-Typ und fehlende `.ts`-Extension im Test

### Was fehlt

1. **Die RSVP-Seite muss auf alexander-salomon.de laufen**, nicht auf der Lovable-App
2. **Die API-Aufrufe müssen direkt an die Supabase Edge Functions gehen**, nicht an relative Pfade
3. **Ghost muss `/einladung/:code` als Route bedienen**

### Umsetzungsplan

#### Schritt 1: Build-Fehler beheben

- `get-public-event-invitation/index.ts`: Parameter `now` in die lokale `rateLimit`-Funktion aufnehmen (wie in der `respond`-Variante)
- `respond-public-event-invitation.ts`: `ServiceClient`-Typ erweitern, damit die `from().select().eq().maybeSingle()`-Kette kompatibel mit dem tatsächlichen Supabase-Client ist
- Test-Import: `.ts`-Extension ergänzen

#### Schritt 2: Standalone-RSVP-Widget für Ghost erstellen

Eine eigenständige HTML-Seite, die:
- **Kein React-Build** benötigt — reines Vanilla-JS oder ein minimales Script-Bundle
- Die Supabase Edge Functions **direkt** aufruft (volle URL: `https://wawofclbehbkebjivdte.supabase.co/functions/v1/get-public-event-invitation`)
- Den `code` aus der URL `/einladung/{code}` liest
- Zusage/Absage/Vorbehalt + Kommentar unterstützt
- Optisch zum alexander-salomon.de-Design passt (Ghost-Theme-Farben: dunkler Hintergrund, Grün-Akzente, weiße Karten)

#### Schritt 3: Ghost-Konfiguration (von Ihnen durchzuführen)

In Ghost müssen Sie eine **Custom Page** anlegen:
1. **Ghost Admin → Pages → New Page** mit Slug `einladung`
2. In den **Code Injection** der Seite (oder global im Theme) das Widget-Script einbetten
3. **Ghost Routing** (`routes.yaml`) anpassen, damit `/einladung/:code` auf diese Seite geroutet wird:

```text
routes:
  /einladung/:code/:
    template: custom-einladung
    data: page.einladung
```

Alternativ (einfacher): Ghost unterstützt kein dynamisches Routing mit Parametern nativ. Die pragmatischste Lösung ist:
- Eine Ghost-Page `/einladung/` erstellen
- Das Widget liest den Code aus `window.location.pathname` (alles nach `/einladung/`)
- Ghost leitet alle `/einladung/*`-Pfade auf diese Seite (via `routes.yaml` Wildcard oder 404-Fallback)

#### Schritt 4: Legacy-Routen in Lovable-App bereinigen

- `EventRSVP.tsx` zeigt bereits den Legacy-Hinweis — bleibt als Fallback für Altlinks
- `publicInvitationApi.ts` wird nicht mehr für Neulinks benötigt (die Ghost-Seite ruft die Edge Functions direkt auf)

### Was Sie in Ghost tun müssen

1. **`routes.yaml`** (im Ghost-Theme-Verzeichnis) erweitern:
```text
routes:
  /einladung/:
    template: custom-einladung
```

2. **Template `custom-einladung.hbs`** im Theme erstellen — enthält das RSVP-Widget als eingebettetes Script

3. **Sicherstellen**, dass alle Pfade unter `/einladung/*` auf dieses Template fallen (Ghost macht das bei einer Route mit Trailing-Slash automatisch für den Basispfad; für Unterpfade braucht es ggf. eine 404-Umleitung oder eine JavaScript-basierte Lösung)

### Technische Details

- Das Widget wird als selbstständiges `<script>` + `<style>` Block geliefert, das in jeden beliebigen HTML-Container eingefügt werden kann
- API-Endpunkte: direkte Supabase-Function-URLs mit CORS (bereits konfiguriert mit `Access-Control-Allow-Origin: *`)
- Kein Supabase-Client-SDK nötig — reine `fetch()`-Aufrufe
- Farben/Schriften werden ans Ghost-Theme angepasst (dunkles Schema, Grüne-Sonnenblume CI)

