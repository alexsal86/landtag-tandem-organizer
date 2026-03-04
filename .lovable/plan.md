

## Analyse: Die App läuft — der Browser-Cache blockiert

Ich habe die App gerade im Browser-Tool getestet. Ergebnis: **Die Login-Seite wird korrekt angezeigt** ("Landtag System - Sie müssen sich anmelden"). React rendert, Vite verbindet sich, keine Fehler.

Dein weißer Bildschirm wird durch einen **veralteten Service Worker in deinem Browser-Cache** verursacht. Der alte SW (vor den iframe-Fixes) fängt die HTML-Antwort ab und setzt COOP/COEP-Header, bevor dein Code überhaupt laden kann. Das ist ein Henne-Ei-Problem: der Cleanup-Code in `main.tsx` kann nicht laufen, weil der alte SW das Laden bereits blockiert.

## Plan

### Schritt 1: Aggressiveren SW-Cleanup direkt in `index.html` einbauen

Statt eines separaten Scripts oder der Logik in `main.tsx` ein minimales **Inline-Modul-Script** verwenden. Module-Scripts sind von CSP `'self'` erlaubt wenn sie als `type="module"` markiert sind und inline im HTML stehen — aber da Lovable's CSP inline blockiert, nutzen wir stattdessen einen winzigen externen Script-Aufruf der VOR dem Vite-Bundle lädt.

Tatsächlich besser: Die Cleanup-Logik in `main.tsx` ist bereits korrekt und funktioniert (wie der Test beweist). Das Problem ist NUR dein lokaler Browser-Cache.

### Schritt 2: SW-Version erhöhen + Navigator-Controller-Check härten

In `src/main.tsx` den Check so anpassen, dass er auch dann aufräumt wenn `state === 'started'` hängengeblieben ist (z.B. nach einem abgebrochenen Cleanup):

```typescript
// Stuck-state recovery: if state is 'started', reset and retry
if (state === 'started') {
  sessionStorage.removeItem('coi-cleanup-state');
  // Fall through to cleanup
}
```

### Schritt 3: Sofortige Lösung für dich (manuell)

**Du musst einmalig die Lovable Preview-URL direkt in einem neuen Tab öffnen und dort den Service Worker manuell deregistrieren:**

1. Öffne `https://7d09a65d-5cbe-421b-a580-38a4fe244277.lovableproject.com` in einem neuen Tab
2. DevTools öffnen → Application → Service Workers
3. Alle Service Worker dort "Unregister" klicken
4. Application → Storage → "Clear site data" klicken
5. Tab schließen
6. Zurück zu Lovable → Preview neu laden

### Dateien die geändert werden

- `src/main.tsx` — Stuck-state-Recovery für `coi-cleanup-state === 'started'` hinzufügen, SW-Version auf v5 erhöhen

