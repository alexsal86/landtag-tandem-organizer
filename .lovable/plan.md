

## Diagnose

Die Konsolenfehler (`unsafe-eval`, `osano`, `vr`, `battery`) stammen alle von der **Lovable-Plattform selbst**, nicht von deiner App. Die App hat null Logs, null Network Requests, null Session-Replay-Daten. Das bedeutet: **dein JavaScript startet gar nicht erst.**

**Do I know what the issue is?** Ja.

## Root Cause

In `src/main.tsx` blockiert `bootstrap()` die gesamte App-Initialisierung mit einem `await`:

```typescript
async function bootstrap() {
  try {
    await setupCrossOriginIsolation();  // ← KANN EWIG HÄNGEN
  } catch { }
  createRoot(document.getElementById('root')!).render(<App />);
}
```

Innerhalb von `setupCrossOriginIsolation()` wird auf Preview-Hosts `await unregisterAllServiceWorkers()` aufgerufen, was intern `navigator.serviceWorker.getRegistrations()` nutzt. In einem **cross-origin iframe** (Lovable Preview) kann diese API **hängen** (Promise resolves nie) statt zu rejecten. Der `try/catch` fängt nur Exceptions, nicht hängende Promises. Ergebnis: `createRoot` wird nie aufgerufen → weißer Screen.

## Fix-Plan

### Datei: `src/main.tsx`

1. **Preview-Host: SW-API gar nicht erst anfassen.** Statt `unregisterAllServiceWorkers()` aufzurufen (das hängen kann), sofort `return`. Es gibt keinen Grund, SWs zu deregistrieren, wenn wir sie nie registrieren.

2. **Timeout-Failsafe für alle Pfade.** Die gesamte COI-Setup-Logik in ein `Promise.race` mit 3-Sekunden-Timeout wrappen, damit die App IMMER rendert, egal was passiert.

3. **`createRoot` außerhalb des `try/catch` aufrufen** — damit es garantiert immer ausgeführt wird.

Konkret wird `bootstrap()` so aussehen:

```typescript
async function bootstrap() {
  // Fire-and-forget with timeout — never block rendering
  try {
    await Promise.race([
      setupCrossOriginIsolation(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('COI timeout')), 3000))
    ]);
  } catch {
    // Timeout or error — continue to render
  }
  createRoot(document.getElementById('root')!).render(<App />);
}
```

Und `setupCrossOriginIsolation()` wird auf Preview-Hosts sofort returnen ohne die SW-API zu berühren:

```typescript
if (isPreviewHost) {
  sessionStorage.removeItem('coi-cleanup-state');
  return;  // Kein SW-API-Aufruf mehr
}
```

### Datei: `index.html`

Einen sichtbaren Lade-Indikator im `<div id="root">` einfügen, der zeigt, dass die HTML-Datei geladen wurde (wird durch React ersetzt sobald `createRoot` aufgerufen wird):

```html
<div id="root">
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;">
    <p style="color:#888;">Laden…</p>
  </div>
</div>
```

### Zusammenfassung

| Was | Warum |
|-----|-------|
| SW-API-Aufruf auf Preview-Hosts entfernen | Kann im iframe hängen |
| Promise.race-Timeout um COI-Setup | Failsafe falls andere Pfade auch hängen |
| Loading-Fallback in index.html | Visuelle Rückmeldung vor JS-Bootstrap |

Keine manuellen Browser-Aktionen nötig. 2 Dateien betroffen.

