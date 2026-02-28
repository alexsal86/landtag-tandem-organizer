
# Fix: Drei Probleme im Briefeditor

## Problem 1: Letzte Zeile von Seite 1 wird auf Seite 2 wiederholt

**Ursache**: Die `page1BodyMm` und `pageNBodyMm` werden mit `snapToLine()` abgerundet. Dadurch ist `page1BodyMm` kleiner als der tatsaechliche Body-Bereich. Der Offset fuer Seite 2 ist `page1BodyMm`, aber die Fensterhoehe auf Seite 1 ist `contentBottomMm - contentStartMm` (ungerundet, Zeile 323). Die Fensterhoehe ist also groesser als `page1BodyMm` -- Seite 1 zeigt mehr Text als der Offset fuer Seite 2 ueberspringt.

**Fix in `LetterEditorCanvas.tsx`**: Die `bodyHeightMm` in `renderPage` muss ebenfalls die gesnapte Hoehe verwenden, nicht die rohe:
- Zeile 323-324: `bodyHeightMm` fuer Seite 1 auf `page1BodyMm` setzen (bereits gesnapt), fuer Seite 2+ auf `pageNBodyMm`

## Problem 2: Editortext verschwindet nach Navigation

**Ursache**: `draftInitializedRef` (Zeile 173) wird beim Verlassen der Seite nie zurueckgesetzt. Wenn der Benutzer zurueckkehrt, wird `editedLetter` korrekt aus der DB geladen (Zeile 287-291), aber `draftInitializedRef.current` ist noch `true`, daher werden `draftContent`/`draftContentNodes`/`draftContentHtml` nicht aktualisiert. Der Lexical-Editor bekommt leere/veraltete Werte.

**Fix in `LetterEditor.tsx`**:
- Beim Laden eines neuen Briefes (im `useEffect` bei Zeile 278): `draftInitializedRef.current = false` zuruecksetzen
- Alternativ/zusaetzlich: Wenn `letter` sich aendert, die Draft-States direkt aus dem neuen `letter`-Objekt initialisieren

## Problem 3: Kuenstlicher Platz nach Schlussformel erzeugt leere Seiten

**Ursache**: `renderClosing()` hat einen festen `<div style={{ height: '9mm' }} />` Abstand VOR der Grussformel (Zeile 256). Nach dem Namen/Titel gibt es keinen weiteren Spacer, ABER im Mess-Container wird dieser 9mm-Abstand mitgemessen. Wenn der Content fast die Seite fuellt, reichen diese 9mm aus, um `flowHeightMm > page1BodyMm` zu erzeugen, was eine zweite (fast leere) Seite generiert. Zudem: Wenn keine Anlagen vorhanden sind, braucht nach dem Namen nichts mehr zu kommen -- aber die 9mm VOR der Grussformel bleiben.

**Fix in `LetterEditorCanvas.tsx`**:
- Den Abstand vor der Grussformel von `9mm` auf einen kleineren Wert reduzieren (z.B. `4.5mm`) -- dies muss aber zur PDF-Ausgabe passen
- Alternativ (robuster): Die `totalPages`-Berechnung um einen Schwellwert ergaenzen: Wenn der Ueberhang kleiner als eine Zeilenhoehe ist, keine weitere Seite erzeugen

## Betroffene Dateien

### `src/components/letters/LetterEditorCanvas.tsx`
1. **Zeile 322-324** (`renderPage`): `bodyHeightMm` auf gesnapte Werte umstellen:
   ```
   const bodyHeightMm = isFirst ? page1BodyMm : pageNBodyMm;
   ```
2. **Zeile 236-240** (`totalPages`): Schwellwert einfuegen, um Mikro-Ueberlaeufe zu ignorieren:
   ```
   if (flowHeightMm <= page1BodyMm + lineHeightMm * 0.5) return 1;
   ```

### `src/components/LetterEditor.tsx`
3. **Zeile 278-291** (letter-Lade-Effekt): `draftInitializedRef.current = false` setzen, wenn ein neuer Brief geladen wird, damit die Draft-States korrekt reinitialisiert werden:
   ```
   draftInitializedRef.current = false;
   ```

## Zusammenfassung
- Bug 1 (Zeilenwiederholung): Fensterhoehe und Offset muessen identische (gesnapte) Werte nutzen
- Bug 2 (Text weg): Draft-Initialisierungs-Flag muss beim Briefwechsel zurueckgesetzt werden
- Bug 3 (Leere Seiten): Schwellwert bei totalPages verhindert, dass minimale Ueberlaeufe eine neue Seite erzeugen
