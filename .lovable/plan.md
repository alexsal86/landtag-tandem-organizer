

## Problem

`postcss.config.js` verwendet `@tailwindcss/postcss` (Tailwind v4 native PostCSS-Plugin), aber `src/index.css` nutzt durchgängig Tailwind v3-Syntax:
- `@tailwind base; @tailwind components; @tailwind utilities;`
- `@layer base { ... }` mit CSS-Variablen
- `@layer utilities { ... }` mit `@apply`-Direktiven

Das v4-native Plugin erwartet `@import "tailwindcss"` statt der v3-Direktiven. Die gesamte CSS-Datei (485 Zeilen) müsste umgeschrieben werden, um v4-native zu funktionieren.

## Lösung

**`postcss.config.js` auf `tailwindcss` als Plugin zurückstellen.** Das `tailwindcss`-Paket (v4) enthält selbst ein PostCSS-Plugin, das im v3-Kompatibilitätsmodus arbeitet und die alten Direktiven versteht.

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Das ist eine einzeilige Änderung und stellt das Styling sofort wieder her, ohne die 485 Zeilen CSS umschreiben zu müssen.

