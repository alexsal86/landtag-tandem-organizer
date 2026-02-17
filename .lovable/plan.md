
## Problem

Ein TypeScript-Build-Fehler in `src/contexts/MatrixClientContext.tsx` (Zeile 714) verhindert das Kompilieren der gesamten Anwendung. Der Typ `sdk.Verifier` existiert nicht im Hauptexport von `matrix-js-sdk` v34.

**Fehlermeldung:**
```
error TS2694: Namespace '"matrix-js-sdk/lib/index"' has no exported member 'Verifier'.
```

Dies ist die Ursache fuer alle plattformweiten "Etwas ist schiefgelaufen"-Fehler.

## Loesung

Eine einzige Datei muss angepasst werden: `src/contexts/MatrixClientContext.tsx`

### Schritt 1: Typ-Import hinzufuegen (Zeile 2)

```typescript
import * as sdk from 'matrix-js-sdk';
import type { Verifier } from 'matrix-js-sdk/lib/crypto-api/verification';
```

### Schritt 2: Typ-Referenz korrigieren (Zeile 714)

```typescript
// Vorher:
let verifier: sdk.Verifier;

// Nachher:
let verifier: Verifier;
```

### Warum das funktioniert

- `matrix-js-sdk` v34 exportiert den Typ `Verifier` ausschliesslich aus dem Submodul `crypto-api/verification`, nicht aus dem Hauptindex
- Die Aenderung betrifft nur den TypeScript-Typ -- das Laufzeitverhalten bleibt identisch
- Nach dieser Korrektur baut die App wieder fehlerfrei und alle Seiten werden wieder geladen
