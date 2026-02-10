
# Plan: Fix .msg-Datei-Parsing im Browser

## Problem

`@kenjiuno/msgreader` haengt von `safer-buffer` und `iconv-lite` ab, die beide das Node.js-`Buffer`-Objekt benoetigen. In Vite/Browser gibt es kein `Buffer`, daher schlaegt der Import fehl mit:

```
Cannot read properties of undefined (reading 'prototype')
```

## Loesung

Einen Buffer-Polyfill fuer den Browser installieren und Vite so konfigurieren, dass `buffer` als globales Objekt verfuegbar ist.

### 1. Dependency hinzufuegen

`buffer` (npm-Paket) -- stellt `Buffer` im Browser bereit.

### 2. Vite-Konfiguration anpassen

In `vite.config.ts`:
- `define: { 'global': 'globalThis' }` hinzufuegen (einige Polyfills erwarten `global`)
- `resolve.alias` fuer `buffer` auf das npm-Paket setzen
- `optimizeDeps.include` um `buffer` erweitern, damit Vite es korrekt vorverarbeitet

```text
// vite.config.ts Aenderungen:
import { defineConfig } from "vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => ({
  // ... bestehende Config ...
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer'],
      globals: { Buffer: true },
    }),
    // ...
  ],
}));
```

Alternativ (leichter): `vite-plugin-node-polyfills` installieren, das Buffer, process und andere Node-Globals automatisch polyfilled. Das ist die sauberste Loesung fuer Vite.

### 3. Keine Aenderung an emlParser.ts noetig

Der Parser-Code selbst ist korrekt. Sobald `Buffer` im Browser verfuegbar ist, funktioniert `@kenjiuno/msgreader` wie erwartet.

## Dateien

| Datei | Aenderung |
|-------|-----------|
| `package.json` | `vite-plugin-node-polyfills` als devDependency hinzufuegen |
| `vite.config.ts` | Plugin einbinden mit `include: ['buffer']` und `globals: { Buffer: true }` |

## Risiko

Gering. Das Plugin polyfilled nur `buffer` -- keine anderen Node-Module. Die bestehende Funktionalitaet (Matrix SDK, etc.) wird nicht beeintraechtigt.
