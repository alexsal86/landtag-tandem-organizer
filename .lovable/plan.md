

## Problem: Weißer Bildschirm in der Preview

### Ursache

Die Datei `coi-serviceworker.js` (Zeile 34 in `index.html`) registriert einen Service Worker, der **alle** HTTP-Responses mit folgenden Headern versieht:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Diese Header isolieren die Seite in einen eigenen Browsing-Context. In der **Lovable Preview** wird die App in einem `<iframe>` eingebettet. Die COOP-Header brechen die Kommunikation zwischen dem Preview-iframe und dem Lovable-Editor. Ergebnis: Die Seite wird geladen, aber der iframe kann nichts anzeigen → weißer Bildschirm.

Der Service Worker wird für **SharedArrayBuffer** (Matrix E2EE Chat) benötigt, ist aber auf allen anderen Seiten unnötig und schädlich für die Preview-Einbettung.

### Lösung

**Datei: `index.html`** (vor dem `coi-serviceworker.js`-Script)

Ein Konfigurations-Script einfügen, das den Service Worker **nur dann registriert**, wenn:
1. Die Seite **nicht** in einem iframe eingebettet ist (`window === window.top`), ODER
2. Die URL den Pfad `/chat` enthält (wo SharedArrayBuffer wirklich benötigt wird)

Falls die Seite in einem iframe läuft und nicht auf `/chat` ist, wird der Service Worker **deregistriert** (falls vorher aktiv).

```html
<script>
  window.coi = {
    shouldRegister: function() {
      // Only register when NOT in an iframe, or when on /chat
      var inIframe = window !== window.top;
      var onChat = window.location.pathname.startsWith('/chat');
      return !inIframe || onChat;
    },
    shouldDeregister: function() {
      // Deregister if in iframe and NOT on /chat
      var inIframe = window !== window.top;
      var onChat = window.location.pathname.startsWith('/chat');
      return inIframe && !onChat;
    },
    quiet: true
  };
</script>
<script src="/coi-serviceworker.js"></script>
```

Das ist eine einzelne Änderung in `index.html` — kein anderer Code muss angepasst werden. Der Chat funktioniert weiterhin mit SharedArrayBuffer, wenn er direkt (nicht im iframe) aufgerufen wird.

