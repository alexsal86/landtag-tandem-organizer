

# Fix: Zweiphasiger PageBreak-Algorithmus

## Das Problem

Der aktuelle `PageBreakPlugin` hat einen kritischen Timing-Bug:

1. Er entfernt alle Spacer-Nodes im `editor.update()` Callback
2. Direkt danach versucht er, die Positionen der verbleibenden Nodes per `getBoundingClientRect()` zu messen
3. **Aber**: Innerhalb von `editor.update()` wurde das DOM noch nicht neu gerendert -- die gemessenen Positionen sind falsch (sie spiegeln noch das alte Layout mit Spacern wider)
4. Dadurch werden Spacer an falschen Stellen eingefuegt oder gar nicht

## Die Loesung: Zwei-Phasen-Ansatz

Der Algorithmus wird in zwei getrennte Schritte aufgeteilt:

**Phase 1 -- Spacer entfernen:**
- Alle bestehenden `PageBreakSpacerNode`s werden entfernt
- Der `onUpdate` Callback signalisiert, dass das DOM aktualisiert wurde

**Phase 2 -- Messen und einfuegen:**
- Erst nach `requestAnimationFrame` (DOM ist tatsaechlich aktualisiert)
- Positionen aller Nodes per `getBoundingClientRect()` messen
- Kumulative Hoehe berechnen und Spacer an den richtigen Stellen einfuegen
- Keine weitere DOM-Messung noetig, da die Hoehen der Content-Nodes sich durch das Spacer-Einfuegen nicht aendern

## Zusaetzliche Verbesserung: Hoehe des Spacers dynamisch berechnen

Aktuell ist die Spacer-Hoehe fix `deadZoneMm`. Aber der Spacer muss den **Rest der aktuellen Seite** plus die tote Zone ueberbruecken, nicht nur die tote Zone selbst. Das heisst:

```text
spacerHeight = (pageBottom - nodeTop) + deadZone
```

Wobei `pageBottom` die aktuelle Seitengrenze ist und `nodeTop` die Position des Nodes der die Grenze ueberschreitet. So wird der naechste Node genau an den Anfang der Folgeseite geschoben.

Nein -- eigentlich ist der Spacer korrekt wenn er genau die "tote Zone" ueberbrueckt (Footer-Bereich + oberer Rand der naechsten Seite). Der nachfolgende Inhalt wird dadurch automatisch verschoben. Das Problem war nur das falsche Messen. Korrektur: die Spacer-Hoehe sollte dynamisch sein = `(currentPageBottom - cumHeight) + deadZonePx` in Pixel, umgerechnet in mm. So fuellt der Spacer exakt den Rest der Seite bis zum naechsten Inhaltsbereich.

## Technische Umsetzung

### Datei: `src/components/plugins/PageBreakPlugin.tsx` (ueberarbeiten)

Komplett ueberarbeiteter Algorithmus:

1. `registerUpdateListener` reagiert auf Aenderungen (wie bisher, debounced 200ms)
2. Phase 1: `editor.update()` entfernt alle bestehenden Spacer
3. In `onUpdate` Callback: `requestAnimationFrame` aufrufen
4. Phase 2 (im rAF): `editor.update()` liest die echten DOM-Positionen und fuegt Spacer ein
5. Spacer-Hoehe = `remainingPageMm + deadZoneMm` wobei `remainingPageMm` der Abstand vom Node bis zur Seitenunterkante ist (in mm umgerechnet)
6. `isUpdatingRef` schuetzt beide Phasen, wird erst nach Phase 2 zurueckgesetzt

Kernalgorithmus fuer Phase 2:

```text
cumHeightPx = 0
pageBottomPx = page1HeightPx

fuer jedes Kind (ohne Spacer):
  dom = editor.getElementByKey(key)
  heightPx = dom.getBoundingClientRect().height
  nodeBottomPx = cumHeightPx + heightPx
  
  wenn nodeBottomPx > pageBottomPx:
    restOfPageMm = (pageBottomPx - cumHeightPx) / PX_PER_MM
    spacerHeightMm = restOfPageMm + deadZoneMm
    spacer einfuegen vor diesem Kind (Hoehe = spacerHeightMm)
    cumHeightPx = pageBottomPx + deadZonePx
    pageBottomPx = cumHeightPx + followupHeightPx
    cumHeightPx += heightPx
  sonst:
    cumHeightPx = nodeBottomPx
```

### Datei: `src/components/nodes/PageBreakSpacerNode.tsx` (keine Aenderung)

Bleibt wie bisher -- das DecoratorNode mit dynamischer Hoehe funktioniert korrekt.

### Datei: `src/components/EnhancedLexicalEditor.tsx` (keine Aenderung)

Integration ist bereits vorhanden.

### Datei: `src/components/letters/LetterEditorCanvas.tsx` (keine Aenderung)

Config wird bereits korrekt durchgereicht.

## Zusammenfassung

| Datei | Aenderung |
|---|---|
| `src/components/plugins/PageBreakPlugin.tsx` | Zweiphasiger Algorithmus mit rAF-basierter DOM-Messung |

Eine einzige Datei muss geaendert werden. Der Fix behebt den Timing-Bug durch saubere Trennung von DOM-Mutation (Spacer entfernen) und DOM-Messung (Positionen lesen).

