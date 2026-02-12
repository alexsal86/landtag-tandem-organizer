

# Plan: Infinite-Loop-Fehler beim Oeffnen von "Neues Template" beheben

## Ursache

Der Crash wird durch eine **Endlosschleife** in zwei Kind-Komponenten verursacht:

**StructuredHeaderEditor.tsx** (Zeile 47-49):
```
useEffect(() => {
    onElementsChange(elements);
}, [elements, onElementsChange]);
```

**StructuredFooterEditor.tsx** (Zeile 83-85):
```
useEffect(() => {
    onBlocksChange(blocks);
}, [blocks, onBlocksChange]);
```

Der Ablauf der Endlosschleife:

1. Dialog oeffnet sich, Komponenten mounten
2. useEffect ruft `onElementsChange(elements)` auf
3. Der Callback ist eine **Inline-Funktion** im Parent: `(elements) => setFormData(prev => ({ ...prev, header_elements: elements }))`
4. setFormData loest Re-Render im Parent aus
5. Re-Render erzeugt eine **neue Funktionsreferenz** fuer den Callback
6. useEffect sieht neue Referenz in Dependencies -> fuehrt erneut aus -> zurueck zu Schritt 3

## Loesung

In beiden Editor-Komponenten wird `onElementsChange` / `onBlocksChange` aus den useEffect-Dependencies entfernt. Die Callbacks werden stattdessen nur aufgerufen, wenn sich die Daten tatsaechlich aendern (nicht bei jedem Render).

Zusaetzlich wird `DialogDescription` zu den Dialogen in `LetterTemplateManager` hinzugefuegt, um die ARIA-Warnung zu beheben.

## Aenderungen

### 1. `src/components/letters/StructuredHeaderEditor.tsx`

Zeile 47-49 aendern:

```
// Vorher (fehlerhaft):
useEffect(() => {
    onElementsChange(elements);
}, [elements, onElementsChange]);

// Nachher (korrekt):
useEffect(() => {
    onElementsChange(elements);
}, [elements]);
```

### 2. `src/components/letters/StructuredFooterEditor.tsx`

Zeile 83-85 aendern:

```
// Vorher (fehlerhaft):
useEffect(() => {
    onBlocksChange(blocks);
}, [blocks, onBlocksChange]);

// Nachher (korrekt):
useEffect(() => {
    onBlocksChange(blocks);
}, [blocks]);
```

### 3. `src/components/LetterTemplateManager.tsx`

`DialogDescription` importieren und in allen `DialogContent`-Bloecken hinzufuegen, um die ARIA-Warnung "Missing Description or aria-describedby" zu beseitigen:

```
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
```

In den DialogHeader-Bereichen jeweils ergaenzen:

```
<DialogHeader>
  <DialogTitle>Neues Brief-Template erstellen</DialogTitle>
  <DialogDescription>Erstellen Sie ein neues Brief-Template mit Header, Footer und Layout-Einstellungen.</DialogDescription>
</DialogHeader>
```

Gleiches fuer den Bearbeitungs-Dialog und den Vorschau-Dialog.

## Zusammenfassung

| Datei | Aenderung |
|-------|-----------|
| `src/components/letters/StructuredHeaderEditor.tsx` | `onElementsChange` aus useEffect-Dependencies entfernen |
| `src/components/letters/StructuredFooterEditor.tsx` | `onBlocksChange` aus useEffect-Dependencies entfernen |
| `src/components/LetterTemplateManager.tsx` | `DialogDescription` hinzufuegen fuer ARIA-Konformitaet |

