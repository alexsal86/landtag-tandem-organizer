

# Zeilenbasierter Editor fuer Info-Block und Adressfeld

## Problem

Der Info-Block und das Adressfeld werden aktuell ueber den gleichen Freihand-Canvas-Editor wie der Header bearbeitet. Das fuehrt zu Problemen:
- Variablen muessen manuell pixelgenau positioniert und uebereinander gestapelt werden
- Die DIN-5008-Reihenfolge (z.B. Ansprechpartner, Abteilung, Telefon, Datum) kann nicht garantiert werden
- Es gibt keine vertikale Anordnungslogik -- jede Zeile muss einzeln platziert werden

## Loesung: Zeilenbasierter Block-Editor

Fuer Info-Block und Adressfeld wird ein **zeilenbasierter Editor** eingefuehrt -- eine geordnete Liste von Zeilen, die automatisch untereinander dargestellt werden. Der Canvas-Editor bleibt fuer Header, Footer und andere Bloecke erhalten.

### Konzept

Statt frei positionierbarer Elemente arbeitet der zeilenbasierte Editor mit einer sortierten Liste:

```text
Zeile 1:  Label: "Ihr Gespraechspartner:"  |  Wert: {{bearbeiter}}
Zeile 2:  Label: "Abteilung:"              |  Wert: "Bearbeitung"     (Freitext)
Zeile 3:  (Leerzeile / Abstand)
Zeile 4:  Label: "Telefon:"                |  Wert: {{telefon}}
Zeile 5:  Label: "Telefax:"                |  Wert: "040 1234-7890"   (Freitext)
Zeile 6:  Label: "E-Mail:"                 |  Wert: {{email}}
Zeile 7:  (Leerzeile / Abstand)
Zeile 8:  Label: "Datum:"                  |  Wert: {{datum}}
```

### Datenstruktur

Neue Zeilen-Typen fuer die Block-Elemente:

```text
BlockLine = {
  id: string
  type: 'label-value' | 'spacer' | 'text-only'
  label?: string           // z.B. "Telefon:"
  value?: string           // Freitext oder Variable wie "{{telefon}}"
  isVariable?: boolean     // true wenn value ein {{...}}-Platzhalter ist
  labelBold?: boolean      // Label fett (Standard: true)
  valueBold?: boolean      // Wert fett (Standard: false)
  fontSize?: number        // in pt (Standard: 9)
  spacerHeight?: number    // nur fuer type='spacer', in mm
}
```

Diese Zeilen werden als Array gespeichert -- die Reihenfolge im Array bestimmt die Reihenfolge auf dem Brief.

### UI: Zeilen-Editor

Der Zeilen-Editor ersetzt den Canvas fuer `infoBlock` und `addressField`:

**Oberer Bereich -- Vorschau:**
- Zeigt die Zeilen in der richtigen Reihenfolge als DIN-5008-Block an
- Live-Vorschau mit den Variablen-Vorschautexten (z.B. "Max Mustermann" statt {{empfaenger_name}})

**Unterer Bereich -- Zeilenliste:**
- Jede Zeile hat Drag-Handles (GripVertical) zum Umsortieren
- Label-Feld (Input) + Wert-Feld (Input oder Variable-Dropdown)
- Buttons: Zeile hinzufuegen, Leerzeile, Zeile loeschen
- Variable einfuegen: Dropdown mit den verfuegbaren Variablen des Block-Typs
- Formatierungsoptionen pro Zeile (Fett, Schriftgroesse)

**DIN-5008-Vorlagen:**
- Button "DIN 5008 Vorlage laden" fuellt den Info-Block mit der Standardreihenfolge:
  1. Ihr Gespraechspartner: {{bearbeiter}}
  2. Abteilung: (Freitext)
  3. (Abstand)
  4. Telefon: {{telefon}}
  5. E-Mail: {{email}}
  6. (Abstand)
  7. Datum: {{datum}}
  8. Unser Zeichen: {{unser_zeichen}}

- Fuer Adressfeld:
  1. {{empfaenger_name}}
  2. {{empfaenger_strasse}}
  3. {{empfaenger_plz}} {{empfaenger_ort}}
  4. {{empfaenger_land}}

### Speicherung

Die Zeilen werden im gleichen Feld gespeichert wie bisher (z.B. `info_block_elements`, `address_field_elements`), aber mit einem Marker `_lineMode: true` im Array, damit beim Laden erkannt wird, ob es sich um Canvas-Elemente oder Zeilen handelt. Alternativ wird ein Wrapper-Objekt verwendet:

```text
{ mode: 'lines', lines: BlockLine[] }
```

vs. bisherig:

```text
HeaderElement[]   (Canvas-Modus)
```

### Rendering in DIN5008LetterLayout

Die `renderCanvasBlockElements`-Funktion wird erweitert: Wenn die Daten im Zeilen-Modus vorliegen, werden sie sequentiell untereinander gerendert (einfache div-Zeilen mit Label + Wert), nicht absolut positioniert.

### Kompatibilitaet

- Header, Footer, Betreff, Anlagen behalten den Canvas-Editor
- Info-Block und Adressfeld verwenden den neuen Zeilen-Editor
- Bestehende Canvas-Daten in diesen Bloecken werden weiterhin unterstuetzt (Fallback)
- Der Benutzer kann zwischen Modi wechseln, wenn noetig

## Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/components/letters/BlockLineEditor.tsx` | Neu: Zeilenbasierter Editor mit Drag-and-Drop-Sortierung, Vorschau, DIN-5008-Vorlagen |
| `src/components/LetterTemplateManager.tsx` | Info-Block und Adressfeld nutzen BlockLineEditor statt renderSharedElementsEditor |
| `src/components/letters/DIN5008LetterLayout.tsx` | Zeilen-Modus-Rendering fuer Info-Block und Adressfeld |
| `src/lib/letterVariables.ts` | substituteVariables fuer Zeilen-Daten erweitern |
| `src/components/LetterEditor.tsx` | Zeilen-Modus bei Substitution beruecksichtigen |

## Technische Reihenfolge

1. Datenstruktur `BlockLine` definieren und Erkennungslogik (Zeilen vs. Canvas)
2. `BlockLineEditor.tsx` erstellen mit Vorschau, Sortierung, Variable-Dropdown
3. DIN-5008-Vorlagen fuer Info-Block und Adressfeld
4. In LetterTemplateManager einbinden (Info-Block + Adressfeld Tabs)
5. Rendering in DIN5008LetterLayout fuer Zeilen-Modus
6. Substitution in letterVariables.ts/LetterEditor anpassen
