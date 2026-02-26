
# Plan: Canvas-Integration, Paginierung, Ruecksendeunterstreichung, Anrede im Editor und Abschlussformel

## Uebersicht

Fuenf zusammenhaengende Aenderungen am Brief-System:
1. Betreff+Anrede im Canvas-Tab anzeigen (mit optionaler Form vor dem Betreff)
2. Paginierung im Canvas-Tab und Layout anzeigen
3. Ruecksendezeile mit Unterstreichung
4. Anrede im Briefeditor anzeigen und aenderbar machen
5. Abschlussformel und Unterschrift (Vorlage mit Ueberschreibung + Bild)

---

## 1. Betreff und Anrede im Canvas-Tab

### Problem
Im Canvas-Designer sind "Betreffbereich" und "Inhaltsbereich" getrennte Bloecke. Die Logik soll sein: Betreff (optional mit vorangestellter Form/Symbol) wird im Inhaltsbereich integriert angezeigt.

### Loesung
- Den separaten "Betreffbereich"-Block im Canvas entfernen und stattdessen Betreff + Anrede als feste Vorschau oben im "Inhaltsbereich"-Block rendern
- Im Block-Editor (Tab "Betreff und Anrede") eine Option fuer eine kleine Form (z.B. Linie, Kreis, Quadrat, oder kein Symbol) hinzufuegen, die vor dem Betreff-Text erscheint
- Darstellung im Canvas:
  - [optionale Form] **Betreff** (fett)
  - 2 Leerzeilen (9mm)
  - Anrede
  - 1 Leerzeile (4.5mm)
  - Inhalt...

### Aenderungen
**`src/components/letters/LetterLayoutCanvasDesigner.tsx`:**
- `DEFAULT_BLOCKS`: "subject" Block entfernen (oder als Teil von "content" integrieren)
- Im Rendering des "content"-Blocks: Betreff-Variable, Anrede-Variable und Abstaende als Vorschau-Zeilen oben anzeigen
- Neues Layout-Setting `subject.prefixShape` (none | line | circle | rectangle) im `getRect`/Rendering beruecksichtigen

**`src/types/letterLayout.ts`:**
- `subject` Block erweitern: `prefixShape?: 'none' | 'line' | 'circle' | 'rectangle'`

**`src/components/LetterTemplateManager.tsx`:**
- Im Tab "Betreff und Anrede": Dropdown fuer Form-Auswahl hinzufuegen (Keine Form, Linie, Kreis, Rechteck)

**`src/components/letters/DIN5008LetterLayout.tsx`:**
- Im integrierten Modus: Vor dem Betreff-Text die gewaehlte Form rendern (kleines SVG/CSS-Element)

---

## 2. Paginierung im Canvas-Tab

### Problem
Die Seitenzahlen-Position ist nicht im Canvas sichtbar.

### Loesung
- Neuen Block "Paginierung" zum Canvas hinzufuegen, der die Position der Seitenzahl auf der Seite zeigt
- Position ist konfigurierbar (Standard: rechts unten, oberhalb Footer)

### Aenderungen
**`src/types/letterLayout.ts`:**
- Neues Feld: `pagination?: { enabled: boolean; top: number; align: 'left' | 'center' | 'right'; fontSize?: number }`
- Default: `{ enabled: true, top: 267.77, align: 'right', fontSize: 8 }`

**`src/components/letters/LetterLayoutCanvasDesigner.tsx`:**
- Neuer Block in `DEFAULT_BLOCKS`: `{ key: 'pagination', label: 'Paginierung', color: 'bg-rose-500/20 ...', jumpTo: 'layout-settings' }`
- Rendering: Schmaler Block mit Vorschau-Text "Seite 1 von 1"
- `getRect` und `updateByRect` fuer Paginierung implementieren

**`src/components/letters/DIN5008LetterLayout.tsx`:**
- Paginierungsposition aus `layout.pagination` lesen statt hartcodiert

---

## 3. Ruecksendezeile mit Unterstreichung

### Problem
Die Ruecksendeadresse soll am Ende eine Unterstreichung haben, deren Laenge sich am tatsaechlichen Text orientiert.

### Loesung
- Die Ruecksendezeile(n) mit einer unteren Borderlinie rendern, die nur so breit wie der Text ist (inline/fit-content)

### Aenderungen
**`src/components/letters/DIN5008LetterLayout.tsx`:**
- Im Vermerkzone-Bereich: Container mit `display: inline-block` und `border-bottom: 0.5pt solid #000` um die Ruecksendezeilen wickeln
- So passt sich die Unterstreichung der Textlaenge an

**`src/components/letters/LetterLayoutCanvasDesigner.tsx`:**
- In der Canvas-Vorschau der Ruecksendezeile ebenfalls eine duenne Unterstreichung anzeigen

---

## 4. Anrede im Briefeditor anzeigen und aenderbar machen

### Problem
Im Briefeditor soll die automatisch generierte Anrede sichtbar sein und manuell geaendert werden koennen.

### Loesung
- Neues Feld `salutation_override` im Letter-Datensatz
- Im Briefeditor in der Sidebar: Anrede-Feld anzeigen (vorausgefuellt mit `computedSalutation`)
- Wenn der Nutzer den Wert aendert, wird er als Override gespeichert und an DIN5008LetterLayout weitergegeben
- Wenn leer -> Fallback auf automatische Anrede

### Aenderungen
**Datenbank-Migration:**
```sql
ALTER TABLE letters ADD COLUMN salutation_override TEXT;
```

**`src/components/LetterEditor.tsx`:**
- Neues State-Feld `salutation_override` in `editedLetter`
- Input-Feld in der Sidebar (neben Betreff): "Anrede" mit dem berechneten Wert als Placeholder und Override als Value
- Beim Speichern: `salutation_override` mit persisten
- An `DIN5008LetterLayout` uebergeben: `salutation={editedLetter.salutation_override || computedSalutation}`

---

## 5. Abschlussformel und Unterschrift

### Problem
Briefe benoetigen eine Abschlussformel (z.B. "Mit freundlichen Gruessen") und einen Unterschriftsblock (Name, ggf. Bild). Die Vorlage definiert einen Standard, der im Editor ueberschrieben werden kann.

### Loesung

**In der Briefvorlage:**
- Neuer Tab "Abschluss" oder Integration in "Betreff und Anrede" (umbenannt zu "Betreff, Anrede und Abschluss")
- Felder: Abschlussformel (Text), Unterschrift-Name, Unterschrift-Titel, Unterschriftsbild (Upload aus Galerie)
- Gespeichert in `layout_settings.closing`

**Im Briefeditor:**
- Die Abschlussformel wird nach dem Inhalt angezeigt (2 Leerzeilen nach Text, dann Formel, dann ggf. Bild, dann Name/Titel)
- Felder in der Sidebar: Abschlussformel und Unterschriftsname (vorausgefuellt aus Vorlage, ueberschreibbar)
- Override wird im Letter-Datensatz gespeichert

**In der Briefvorschau (DIN5008LetterLayout):**
- Nach dem Content: 2 Leerzeilen -> Abschlussformel -> ggf. Unterschriftsbild -> Name -> Titel

### Aenderungen

**`src/types/letterLayout.ts`:**
```
closing?: {
  formula: string;          // z.B. "Mit freundlichen Gruessen"
  signatureName: string;    // z.B. "Max Mustermann"
  signatureTitle?: string;  // z.B. "Referent"
  signatureImagePath?: string; // Storage-Pfad zum Unterschriftsbild
  fontSize?: number;
}
```

**Datenbank-Migration:**
```sql
ALTER TABLE letters ADD COLUMN closing_formula TEXT;
ALTER TABLE letters ADD COLUMN closing_name TEXT;
```

**`src/components/LetterTemplateManager.tsx`:**
- Tab "Betreff und Anrede" umbenennen zu "Betreff, Anrede und Abschluss"
- Neue Sektion: Abschlussformel (Textfeld), Unterschrift-Name, Unterschrift-Titel
- Unterschriftsbild: Button zum Hochladen in den letter-assets Bucket, Pfad in `layout_settings.closing.signatureImagePath` speichern

**`src/components/letters/DIN5008LetterLayout.tsx`:**
- Nach dem Content-Block (im integrierten Modus): Abschlussformel rendern
- Layout: 2 Leerzeilen -> Formel -> 3 Leerzeilen (Platz fuer Unterschrift) -> ggf. Unterschriftsbild -> Name -> Titel

**`src/components/LetterEditor.tsx`:**
- Neue Felder in Sidebar: "Abschlussformel" und "Unterschrift" (vorausgefuellt aus Template)
- Overrides speichern in `closing_formula` und `closing_name`
- An DIN5008LetterLayout uebergeben

---

## Technischer Ablauf

### Datenbank-Migration
```sql
-- Anrede-Override und Abschlussformel fuer Briefe
ALTER TABLE letters ADD COLUMN IF NOT EXISTS salutation_override TEXT;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS closing_formula TEXT;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS closing_name TEXT;
```

### Dateien die geaendert werden
- `src/types/letterLayout.ts` - prefixShape, pagination, closing Typen
- `src/components/letters/LetterLayoutCanvasDesigner.tsx` - Subject in Content integrieren, Paginierung-Block, Ruecksendeunterstreichung
- `src/components/letters/DIN5008LetterLayout.tsx` - Betreff-Form, Ruecksendeunterstreichung, Abschlussformel+Unterschrift, Paginierung aus Settings
- `src/components/LetterTemplateManager.tsx` - Tab-Umbenennung, Form-Dropdown, Abschluss-Felder, Unterschriftsbild-Upload
- `src/components/LetterEditor.tsx` - Anrede-Feld, Abschlussformel-Felder, Overrides speichern

### Reihenfolge der Implementierung
1. DB-Migration (salutation_override, closing_formula, closing_name)
2. Layout-Typen erweitern (prefixShape, pagination, closing)
3. Canvas-Designer: Subject in Content integrieren, Paginierung-Block hinzufuegen
4. Ruecksendezeile: Unterstreichung in Canvas und DIN5008Layout
5. DIN5008LetterLayout: Betreff-Form, Paginierung aus Settings, Abschlussformel+Unterschrift
6. LetterTemplateManager: Tab erweitern, Form-Dropdown, Abschluss-Sektion
7. LetterEditor: Anrede+Abschluss-Felder, Overrides, Weitergabe an Layout
