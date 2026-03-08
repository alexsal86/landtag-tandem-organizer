

# Plan: ESLint `no-unused-vars` auf `warn` setzen + tote Imports/Variablen entfernen

## Überblick
Die ESLint-Regel `@typescript-eslint/no-unused-vars` wird von `off` auf `warn` gesetzt. Anschließend werden alle toten Imports und ungenutzten Variablen im gesamten Projekt systematisch entfernt.

## Vorgehen

### Schritt 1: ESLint-Regel aktivieren
In `eslint.config.js` Zeile 28 ändern:
```js
'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
```
Das `_`-Prefix-Pattern erlaubt bewusst ignorierte Parameter (z.B. `_config`, `_event`).

### Schritt 2: Systematische Bereinigung
Da das Projekt ~200+ Dateien umfasst, werden die Dateien paketweise durchgegangen:

1. **Pages** (~22 Dateien) - Imports und lokale Variablen prüfen
2. **Hooks** (~80 Dateien) - Ungenutzte Imports, Destructuring-Reste
3. **Components** (~150+ Dateien) - Größtes Paket, aufgeteilt nach Unterordnern
4. **Utils/Services/Contexts** (~20 Dateien) - Hilfsfunktionen

Typische Patterns die entfernt werden:
- Importierte aber nie verwendete Komponenten/Typen
- Destructurte aber nie gelesene Variablen
- Lokale Variablen die zugewiesen aber nie gelesen werden
- Ungenutzte Funktionsparameter (werden mit `_` prefixed statt entfernt)

### Schritt 3: Build-Verifikation
Nach jeder Batch-Bereinigung wird sichergestellt, dass der Build stabil bleibt.

## Umfang
Geschätzt ~50-100 Dateien mit toten Imports/Variablen. Wird in mehreren großen Paketen abgearbeitet.

