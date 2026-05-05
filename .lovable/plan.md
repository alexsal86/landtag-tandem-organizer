## Ziel

Plattformweiter Wechsel auf **Inter Tight** als UI-Schriftart, mit konsistenter Type-Scale, tabellarischen Ziffern für Listen und einem klaren Hierarchie-System (Section-Label / Title / Body / Caption). Das Ergebnis entspricht dem Look des Screenshots — nicht nur in Kontakten, sondern überall.

## Was sich ändert

### 1. Schriftart einbinden (`index.html`)
- `Arvo` und `Source Sans Pro` aus den Google-Fonts-Links entfernen.
- Stattdessen **Inter Tight** (variable, Gewichte 300–700) + **JetBrains Mono** (für IDs/Code-Akzente, optional aber sinnvoll) preloaden.
- `font-display: swap` beibehalten.

### 2. Tailwind-Tokens (`tailwind.config.ts`)
```ts
fontFamily: {
  sans:     ['"Inter Tight"', 'system-ui', 'sans-serif'],
  body:     ['"Inter Tight"', 'system-ui', 'sans-serif'],
  headline: ['"Inter Tight"', 'system-ui', 'sans-serif'], // Display = gleiche Schrift, anderes Gewicht/Tracking
  mono:     ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
fontSize: {
  // Type-Scale mit festem line-height und tracking
  'label':   ['0.6875rem', { lineHeight: '1rem',    letterSpacing: '0.08em',  fontWeight: '600' }], // 11px UPPERCASE
  'caption': ['0.75rem',   { lineHeight: '1.1rem',  letterSpacing: '0' }],                          // 12px
  'body':    ['0.875rem',  { lineHeight: '1.35rem', letterSpacing: '-0.005em' }],                   // 14px
  'body-lg': ['0.9375rem', { lineHeight: '1.45rem', letterSpacing: '-0.005em' }],                   // 15px
  'title':   ['1.125rem',  { lineHeight: '1.55rem', letterSpacing: '-0.015em', fontWeight: '500' }], // 18px
  'h2':      ['1.5rem',    { lineHeight: '1.85rem', letterSpacing: '-0.02em',  fontWeight: '500' }], // 24px
  'h1':      ['1.875rem',  { lineHeight: '2.25rem', letterSpacing: '-0.025em', fontWeight: '500' }], // 30px
  'display': ['2.25rem',   { lineHeight: '2.6rem',  letterSpacing: '-0.03em',  fontWeight: '500' }], // 36px
},
```

### 3. Globale Defaults (`src/index.css`)
- `body { font-family: "Inter Tight", system-ui, sans-serif; font-feature-settings: "cv11", "ss01"; }`
- `font-variant-numeric: tabular-nums` als Utility-Klasse `.tabular` und automatisch auf `<table>`, `td`, `th`, sowie auf Klassen wie `.list-meta` (Counts, Daten, Stunden).
- `:root { --font-sans: "Inter Tight"; }` für Komponenten, die CSS-Variablen lesen.
- Optional: `text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;`

### 4. Listen-Header-Stil (Screenshot-Look)
Neue Utility-Klasse `.section-label`:
```css
.section-label {
  font-size: 0.6875rem;       /* 11px */
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
```
- In Kontakte-, Vorgänge-, Aufgaben-, Termine-Listen-Headern (`NAME / ROLLE`, `ORGANISATION`, `LETZTE AKTIVITÄT` etc.) anwenden.
- Breadcrumb-Style oben links („WISSEN · KONTAKTE") nutzt dieselbe Klasse.

### 5. Page-Title-Komponente angleichen
- Page-Titel, die heute `font-headline` (Arvo serif) verwenden, auf `text-h1` / `text-h2` mit Inter-Tight-Medium umstellen — keine separate Display-Schrift mehr nötig.
- Subtitel/Counts neben dem Titel (z. B. „· 14 Personen & Institutionen") in `text-h2 text-muted-foreground font-normal`.

### 6. Lexical Editor unangetastet
- Lexical-Editor-Standard (pt-Einheiten, eigene Schriftarten in Briefen/Dossiers) bleibt **unverändert**, weil dort eigene Typografie-Regeln für Briefe/Dokumente gelten. Nur die UI-Chrome um den Editor wechselt.

## Technische Details

**Geänderte Dateien:**
- `index.html` — Font-Tags ersetzen
- `tailwind.config.ts` — `fontFamily` + `fontSize`-Scale erweitern
- `src/index.css` — Body-Default, `.section-label`, `.tabular`-Utility, tabular-nums Defaults
- `mem://style/tailwind-v4-integration` ergänzen oder neue Memory `mem://style/typography-system` mit Type-Scale + Inter-Tight-Regel

**Backward-Compat:**
- `font-headline`, `font-body`, `font-sans` zeigen alle auf Inter Tight → keine bestehende Klasse bricht.
- Alte Größen-Klassen (`text-xl`, `text-2xl` …) funktionieren weiter; die neuen semantischen Klassen (`text-h1`, `text-title`, `text-label`) sind additiv.

**QA nach Umsetzung:**
- Kontakte-Liste, Vorgänge-Master-Detail, My Work, Sidebar-Footer und Auth-Seite visuell prüfen.
- Tabellen mit Zahlen (Stunden, Counts) auf saubere vertikale Ausrichtung der Ziffern checken.
- Brief-Editor (Lexical) gegenprüfen, dass die DIN-5008-Briefschrift weiterhin korrekt gerendert wird.

## Nicht enthalten (kann später folgen)

- Migration einzelner Komponenten von `text-2xl font-headline` auf `text-h1` — passiert organisch beim nächsten Touch der jeweiligen Datei oder als separater Refactor-Pass.
- Dark-Mode-spezifische Font-Smoothing-Tweaks.
