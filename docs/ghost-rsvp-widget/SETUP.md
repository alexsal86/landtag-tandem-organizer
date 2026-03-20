# RSVP-Widget auf alexander-salomon.de einrichten

## Übersicht

Das RSVP-Widget ist eine eigenständige HTML-Seite, die in Ghost als Custom Template eingebettet wird. Es ruft die Supabase Edge Functions direkt auf – kein React-Build nötig.

## Schritt 1: `routes.yaml` anpassen

In Ghost Admin → **Settings** → **Labs** → **Routes** (YAML-Datei herunterladen/hochladen):

```yaml
routes:
  /einladung/{code}/:
    template: custom-einladung
```

**Wichtig:** Ghost unterstützt dynamische Routing-Parameter seit Ghost 2.x. Der `{code}`-Parameter wird zwar nicht als Variable an das Template weitergegeben, aber die URL bleibt erhalten und das JavaScript liest den Code direkt aus `window.location.pathname`.

## Schritt 2: Template-Datei ins Theme kopieren

Die Datei `custom-einladung.hbs` in das aktive Ghost-Theme kopieren:

```
content/themes/DEIN-THEME/custom-einladung.hbs
```

**Hinweis:** Das Template ist komplett eigenständig und nutzt nicht das Ghost-Theme-Layout (`{{!< default}}`). Es rendert eine minimale, eigenständige Seite.

## Schritt 3: Ghost neu starten / Theme aktualisieren

Nach dem Hinzufügen des Templates:

1. Theme als ZIP hochladen (Ghost Admin → Settings → Design → Upload theme)
2. Oder Ghost neu starten, wenn Sie direkten Serverzugriff haben

## Schritt 4: Testen

Öffnen Sie eine Test-URL mit einem echten RSVP-Code:

```
https://www.alexander-salomon.de/einladung/DEIN_TEST_CODE
```

## Funktionsweise

1. Das Widget extrahiert den Einladungscode aus der URL
2. Es ruft `GET /functions/v1/get-public-event-invitation` auf (Supabase Edge Function)
3. Zeigt Veranstaltungsdetails und Antwort-Buttons (Zusage/Absage/Vorbehalt)
4. Sendet die Antwort an `POST /functions/v1/respond-public-event-invitation`
5. Zeigt eine Bestätigung nach erfolgreichem Senden

## Anpassungen

### Farben
Die CSS Custom Properties in `:root` können angepasst werden:
- `--rsvp-green`: Hauptfarbe (aktuell Grünen-CI `#005437`)
- `--rsvp-bg`: Hintergrundfarbe der Seite
- `--rsvp-card-bg`: Kartenfarbe

### Branding
Um das Sonnenblumen-Logo einzubinden, fügen Sie vor der `.rsvp-card` ein Bild ein:

```html
<div class="rsvp-branding">
  <img src="{{asset "images/logo.png"}}" alt="Alexander Salomon">
</div>
```
