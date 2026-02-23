
# Fix: Labeled HR und Text-Verlust beim Schliessen

## Problem 1: Labeled HR zeigt nur grauen Text, keine Linien

**Ursache:** Der `LabeledHorizontalRuleNode` erzeugt in `createDOM()` einen aeusseren `<div>` und in `decorate()` einen inneren `<div>` mit den `<hr>`-Elementen. Lexical rendert den React-Output von `decorate()` als Kind-Element in den DOM-Container. Dadurch entsteht eine verschachtelte Struktur, in der die `flex-1`-Klassen der `<hr>`-Elemente nicht greifen, weil der aeussere Container kein korrektes Flex-Layout an den inneren weitergibt.

**Loesung:**
- `createDOM()` gibt einen minimalen Container zurueck (nur notwendige Lexical-Attribute, kein Layout-Styling)
- `decorate()` uebernimmt das gesamte visuelle Rendering mit korrektem Flex-Layout
- Sicherstellen, dass der aeussere Container `display: flex` und volle Breite hat, damit die inneren `<hr>`-Elemente sich korrekt ausdehnen

**Datei:** `src/components/LabeledHorizontalRuleNode.tsx`

---

## Problem 2: Text verschwindet beim Schliessen und Wiederoeffen

**Ursache:** `initialHtmlRef` und `initialNodesRef` werden einmalig beim Mount der `GlobalDaySlipPanel`-Komponente gesetzt (`useRef(todayData.html)`). Diese Refs werden nie aktualisiert. Wenn der Nutzer Text eingibt und das Panel schliesst:

1. Der `onEditorChange`-Handler aktualisiert den `store` korrekt
2. Der Store wird per Debounce (400ms) in localStorage geschrieben
3. Beim Wiederoeffen wird `DaySlipEditor` neu gemountet, bekommt aber die alten Ref-Werte
4. `InitialContentPlugin` laedt dadurch den veralteten Inhalt

**Loesung:**
- Die Refs (`initialHtmlRef`, `initialNodesRef`) werden durch direkte Nutzung von `todayData.html` und `todayData.nodes` ersetzt, damit beim Remount des Editors immer der aktuelle Store-Wert geladen wird
- Alternativ: Die Refs werden bei jeder Aenderung des Store aktualisiert, aber nur beim Editor-Mount gelesen
- Zusaetzlich: Beim Schliessen des Panels wird der Store sofort (ohne Debounce) in localStorage geschrieben, um Datenverlust zu vermeiden

**Datei:** `src/components/GlobalDaySlipPanel.tsx`

---

## Technische Details

### LabeledHorizontalRuleNode.tsx

```text
createDOM():
  - Aenderung: style="display:flex; width:100%" statt Tailwind-Klassen
  - contentEditable="false" bleibt

decorate():
  - Bleibt wie bisher, aber mit w-full auf dem aeusseren div
  - Die <hr>-Elemente behalten flex-1
```

### GlobalDaySlipPanel.tsx

```text
Zeile ~507-508 (initialHtmlRef/initialNodesRef):
  - Entfernen der useRef-Caching-Logik
  - Stattdessen todayData.html / todayData.nodes direkt an DaySlipEditor uebergeben

Zeile ~1270-1271:
  - initialHtml={todayData.html} statt initialHtmlRef.current
  - initialNodes={todayData.nodes} statt initialNodesRef.current

InitialContentPlugin (Zeile ~182-224):
  - loadedForDayRef Logik beibehalten (verhindert Doppel-Load)
  - Aber: Wenn open=false->true wechselt, muss ein neuer Load erlaubt sein
  - Loesung: editorKey auf DaySlipEditor setzen, der sich bei jedem Oeffnen aendert,
    damit der Editor komplett neu gemountet wird und InitialContentPlugin erneut laueft

Zeile ~716-724 (animateClosePanel):
  - Vor dem Schliessen sofortiges localStorage.setItem ausfuehren (flush)
```
