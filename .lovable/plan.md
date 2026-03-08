

## Problem

Das Dashboard verwendet das NewsWidget im `compact`-Modus. Die Compact-Ansicht (Zeilen 119-143) rendert nur Titel und Quelle — keine Hover-Buttons für Teilen/Aufgabe erstellen. Diese existieren nur in der Full-Ansicht.

## Lösung

Die Compact-Ansicht um die gleichen Hover-Buttons erweitern wie in der Full-Ansicht:

### Änderungen in `src/components/widgets/NewsWidget.tsx`

Die Compact-Artikel-Items (Zeile 130-137) erhalten:
- `group`-Klasse auf dem Container
- Eine Zeile mit `Share2` und `CheckSquare` Buttons, die per `opacity-0 group-hover:opacity-100` beim Hover eingeblendet werden
- Die gleichen Click-Handler wie in der Full-Ansicht (`setSelectedArticle` + Dialog öffnen)
- Layout: Titel + Buttons in einer Flex-Row, damit die Buttons rechts erscheinen ohne den Titel zu verdrängen

