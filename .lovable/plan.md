
# Wappen-Form hinzufuegen + Flower2 Build-Fehler beheben

## Uebersicht

Fuenf Aenderungen sind noetig, um das Landeswappen Baden-Wuerttemberg als neue Form im Canvas-Designer verfuegbar zu machen und den bestehenden Build-Fehler zu beheben.

## Aenderungen

### 1. SVG-Datei kopieren
- Kopiere `user-uploads://Grosses_Landeswappen_Baden-Württemberg_sw.svg` nach `public/assets/wappen-bw.svg`

### 2. ShapeType erweitern (`src/components/canvas-engine/types.ts`)
- `'wappen'` zur ShapeType-Union hinzufuegen

### 3. Element-Registry erweitern (`src/components/letters/elements/registry.tsx`)
- Wappen-Fall im `shape`-Abschnitt der `getIcon`-Funktion hinzufuegen (img-Tag mit dem SVG)

### 4. StructuredHeaderEditor.tsx -- Vier Stellen

**a) Import-Fix (Zeile 9):** `Flower2` zum lucide-react Import hinzufuegen (behebt den Build-Fehler)

**b) WappenSVG-Komponente (nach LionSVG, ca. Zeile 95):** Neue Komponente mit `<img>` Tag, die auf `/assets/wappen-bw.svg` verweist

**c) addShapeElement defaults (Zeile 446-452):** Wappen-Eintrag hinzufuegen:
```text
wappen: { width: 18, height: 10, fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0 }
```

**d) renderShapeCanvas (nach lion-Branch, Zeile 1190):** Neuen Branch fuer `shapeType === 'wappen'` mit WappenSVG

**e) Toolbar-Button (nach lion-Button, Zeile 1333):** Neuer Button mit kleinem Wappen-Vorschaubild

## Technische Details

- Die SVG-Datei ist zu komplex fuer Inline-Rendering, daher wird ein `<img>`-Tag verwendet (wie vom User vorgegeben)
- Das Wappen wird im `public/`-Ordner abgelegt, da es ueber einen direkten URL-Pfad referenziert wird
- Default-Groesse 18x10mm spiegelt das Seitenverhaeltnis des Originals wider (1000:558)
