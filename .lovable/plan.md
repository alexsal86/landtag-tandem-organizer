
# Brief-Template Designer: Umfassende Verbesserungen

Dieses Vorhaben umfasst 9 Punkte und ist sehr umfangreich. Ich empfehle eine Aufteilung in zwei Phasen, um die Qualitaet sicherzustellen. Hier der vollstaendige Plan:

---

## Phase 1: Bugfixes und Grundlagen (Punkte 1-5)

### 1. Bilder-Galerie: Dauerhaftes Loeschen

**Problem:** Nach dem Loeschen kehren Bilder zurueck. Die Galerie im `StructuredHeaderEditor` laedt Bilder aus `letter-assets/{tenantId}/header-images/`. Das Loeschen (`deleteGalleryImage`) entfernt die Datei aus Storage und den lokalen State, aber beim naechsten `loadGalleryImages()` (z.B. nach einem Upload oder Tab-Wechsel) werden die Bilder erneut geladen.

**Ursache:** Das Storage-Loeschen schlaegt moeglicherweise fehl (RLS-Policy oder Timing-Problem), und `loadGalleryImages` wird bei Tenant-Wechsel im `useEffect` erneut aufgerufen und ueberschreibt den lokalen State.

**Loesung:**
- Nach `supabase.storage.remove()` den Erfolg pruefen und bei Fehler eine detaillierte Fehlermeldung anzeigen
- Nach erfolgreichem Loeschen `loadGalleryImages()` erneut aufrufen (statt nur lokalen State zu filtern), um sicherzustellen, dass der Storage-Zustand korrekt reflektiert wird
- Storage-RLS-Policies fuer `letter-assets` pruefen und ggf. DELETE-Policy hinzufuegen

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

### 2. Bilder werden im Canvas nicht angezeigt (nur Rahmen)

**Problem:** Bilder aus der Galerie und per Upload werden als `imageUrl` mit der Public URL gespeichert. Im Canvas wird `<img src={element.imageUrl}>` gerendert. CORS-Restriktionen in der Preview-Umgebung blockieren das Laden der Public URL.

**Ursache:** Die Memory-Notiz besagt, dass ein Blob-URL-Ansatz verwendet wird -- aber nur fuer die Galerie-Thumbnails, nicht fuer die Canvas-Elemente.

**Loesung:**
- Beim Einfuegen eines Bildes aus der Galerie die bereits vorhandene `blobUrl` verwenden
- Fuer neu hochgeladene Bilder ebenfalls die Blob-URL erstellen und im Element speichern
- Ein Mapping `storagePath -> blobUrl` pflegen, damit beim Laden gespeicherter Templates die Bilder erneut als Blob-URLs aufgeloest werden
- Die `imageUrl` (Public URL) bleibt als persistierter Wert im Template gespeichert (fuer den PDF-Export), aber die Canvas-Vorschau nutzt die Blob-URL

**Dateien:** `src/components/letters/StructuredHeaderEditor.tsx`

### 3. Bilder groesser ziehen (Resize mit Seitenverhaeltnis)

**Problem:** Bilder auf dem Canvas koennen derzeit nur ueber die Seitenleiste (numerische Eingabe) in der Groesse geaendert werden. Es gibt keine Resize-Handles.

**Loesung:**
- Wenn ein Bild-Element ausgewaehlt ist, einen Resize-Handle (kleines Quadrat unten rechts) anzeigen
- Bei MouseDown auf dem Handle: `isResizing` State setzen, bei MouseMove die neue Breite/Hoehe berechnen
- **Ctrl-Taste (Steuerung)**: Ja, Ctrl ist der richtige Befehl. Wenn `event.ctrlKey` beim Resize aktiv ist, wird das Seitenverhaeltnis beibehalten (Hoehe wird proportional zur Breite angepasst)
- Ohne Ctrl: Breite und Hoehe koennen unabhaengig geaendert werden

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

### 4. Drag-and-Drop aus Bilder-Galerie mit Vorschau

**Problem:** Bilder aus der Galerie werden per Klick eingefuegt. Gewuenscht ist Drag-and-Drop mit visueller Vorschau waehrend des Ziehens.

**Loesung:**
- Galerie-Bilder erhalten `draggable`-Attribut
- `onDragStart`: `setDragImage()` mit dem Bild-Element aufrufen, sodass das Bild waehrend des Ziehens sichtbar bleibt. Den Storage-Pfad als DataTransfer-Daten setzen
- `onDrop` im Canvas: Position berechnen und neues Image-Element einfuegen
- Das Bild bleibt waehrend des gesamten Drag-Vorgangs sichtbar (native Browser-Funktionalitaet mit `setDragImage`)

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

### 5. Footer-Canvas ist laenger als erlaubt

**Problem:** Der Footer-Canvas in `StructuredFooterEditor` hat eine feste Hoehe von `120px` (Zeile 641), aber die Bloecke haben `top: 10px` und `height: 100px` -- das ergibt visuell 110px Inhalt in 120px Container. Das Lineal zeigt aber nur bis 40mm, waehrend der Canvas optisch laenger wirkt.

**Ursache:** Die Darstellungs-Skalierung ist inkonsistent. Das Lineal berechnet `(i * 120) / (footerHeight / 10)` was korrekt ist, aber die Bloecke ignorieren die Skalierung fuer ihre Hoehe.

**Loesung:**
- Die Canvas-Hoehe an die Footer-Hoehe (40mm) koppeln: `height = footerHeight * scaleY`
- Bloecke muessen innerhalb dieser Hoehe gerendert werden, nicht mit festen Pixel-Werten
- Skalierung konsistent anwenden wie beim Header (mm-basiert)

**Datei:** `src/components/letters/StructuredFooterEditor.tsx`

---

## Phase 2: Feature-Erweiterungen (Punkte 6-9)

### 6. Canvas-Vorschau und Achsen fuer alle Block-Tabs

**Problem:** Die Tabs Adressfeld, Ruecksende, Info-Block, Betreff und Anlagen haben nur einen einfachen Block-Canvas (`renderBlockCanvas`), ohne die Achsen-Guides und ohne die Bilder-Galerie / Text-Block-Drag-and-Drop, die der Header hat.

**Loesung:**
- `renderBlockCanvas()` in `LetterTemplateManager.tsx` erweitern:
  - Achsen-Toggle (horizontale und vertikale Mittellinien) hinzufuegen, analog zum Header ("Achsen"-Button)
  - Canvas dot-pattern Hintergrund wie beim Header
  - Text-Block als draggable Element (wie im Header) anbieten, statt nur "Text hinzufuegen"-Button
  - Bilder-Galerie einbinden (gleiche Galerie wie im Header, gespeist aus dem Systemordner)
  - Drag-and-Drop vom Sidebar-Bereich in den Canvas ermoeglichen

**Dateien:** `src/components/LetterTemplateManager.tsx`

### 7. Bloecke als draggable Elemente im Header

**Problem:** Bloecke im Header werden derzeit in einer separaten "Bloecke"-Card verwaltet und unten im Canvas fest positioniert. Gewuenscht: Bloecke sollen wie andere Elemente in der "Elemente hinzufuegen"-Card als draggable Element angeboten werden.

**Loesung:**
- In "Elemente hinzufuegen" einen neuen draggable Eintrag "Block hinzufuegen" ergaenzen
- Beim Drop auf den Canvas wird ein neuer Block erstellt und als positionierbares Element auf dem Canvas platziert
- Die separate "Bloecke"-Card entfernen; Block-Details werden unter dem ausgewaehlten Element angezeigt (wie bei Text/Bild)
- Bloecke erhalten `x`, `y`, `width`, `height` Koordinaten (in mm) wie andere Elemente

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

### 8. Bloecke im Canvas verschiebbar

**Problem:** Bloecke sind im Canvas nicht verschiebbar (fest am unteren Rand positioniert).

**Loesung:** (Wird durch Punkt 7 mit abgedeckt)
- Wenn Bloecke als positionierbare Elemente im Canvas existieren, koennen sie per Drag verschoben werden
- Die gleiche MouseDown/MouseMove/MouseUp-Logik wie fuer Text- und Bild-Elemente anwenden
- Snap-to-Grid und Snap-to-Elements funktionieren automatisch

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

### 9. Formen auf dem Canvas

**Neues Feature:** Geometrische Formen als Canvas-Elemente einfuegen und bearbeiten.

**Implementierung:**
- Neuer Element-Typ `shape` im `HeaderElement`-Interface mit Feld `shapeType`
- Unterstuetzte Formen:
  - **Linie** (`line`): Start-/Endpunkt, Strichstaerke, Farbe
  - **Kreis** (`circle`): Mittelpunkt, Radius, Fuell- und Randfarbe
  - **Quadrat/Rechteck** (`rectangle`): Position, Breite, Hoehe, Fuell- und Randfarbe, Border-Radius
  - **Sonnenblume der Gruenen** (`sunflower`): Verwendet die vorhandene SVG-Datei `src/assets/sunflower.svg`
- In "Elemente hinzufuegen": Dropdown oder Buttons fuer jede Form
- Canvas-Rendering: SVG-basiert fuer Formen (innerhalb des Canvas-Containers)
- Bearbeitbare Eigenschaften in der Seitenleiste: Farbe, Strichstaerke, Groesse, Rotation
- Formen sind verschiebbar und skalierbar wie Bilder

**Dateien:**
- `src/components/letters/StructuredHeaderEditor.tsx` -- Neuer Element-Typ + Rendering + Sidebar-Einstellungen
- `src/assets/sunflower.svg` -- Bereits vorhanden, wird als inline SVG in den Canvas gerendert

---

## Technische Details

### Geaenderte Dateien (Phase 1)
| Datei | Aenderung |
|-------|-----------|
| `src/components/letters/StructuredHeaderEditor.tsx` | Galerie-Loeschung robust machen, Blob-URL fuer Canvas-Bilder, Resize-Handles, Drag-and-Drop Galerie |
| `src/components/letters/StructuredFooterEditor.tsx` | Canvas-Hoehe korrekt skalieren |

### Geaenderte Dateien (Phase 2)
| Datei | Aenderung |
|-------|-----------|
| `src/components/LetterTemplateManager.tsx` | `renderBlockCanvas` mit Achsen, Galerie, DnD erweitern |
| `src/components/letters/StructuredHeaderEditor.tsx` | Bloecke als positionierbare Canvas-Elemente, Formen-System |

### Moegliche SQL-Migration
- Storage-RLS-Policy fuer `letter-assets` Bucket pruefen (DELETE fuer authenticated users)

---

## Empfehlung

Aufgrund des Umfangs empfehle ich, **Phase 1 (Punkte 1-5)** zuerst umzusetzen und zu testen, bevor Phase 2 angegangen wird. Phase 2 veraendert die Canvas-Architektur grundlegend (Bloecke werden zu positionierbaren Elementen), was gruendlich getestet werden muss.
