

# Plan: Briefvorlagen-Editor -- 11 Verbesserungen

---

## 1. Sidebar im Header-Designer schmaler machen

Das aktuelle Layout ist `lg:grid-cols-[1fr_580px]` -- die Sidebar nimmt den gesamten verbleibenden Platz ein. Das Grid wird auf `lg:grid-cols-[280px_1fr]` geaendert, sodass die Sidebar fest 280px breit ist und der Canvas den restlichen Platz bekommt.

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx` (Zeile 301)

---

## 2. Block im Header-Designer per Drag-and-Drop hinzufuegen

Ein neues draggable Tool "Block" wird in der Werkzeug-Sidebar hinzugefuegt (neben dem Text-Block-Draggable). Beim Drop auf den Canvas wird ein neuer Block an der Drop-Position erstellt. Der bestehende "Block hinzufuegen"-Button bleibt als Alternative.

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`
- Neues draggable Element in der Werkzeuge-Card
- `onPreviewDrop` erweitern um `tool === 'block'`

---

## 3. Block-System aus Footer-Designer uebernehmen

Das aktuelle Block-System im Header-Designer ist nur eine simple Gruppierung mit x/y/width/height. Es wird durch das Footer-Block-Konzept ersetzt:
- Bloecke haben: `title`, `content` (mehrzeiliger Text), `widthPercent`, `fontSize`, `fontFamily`, `fontWeight`, `color`, `lineHeight`, `titleHighlight`-Optionen
- Bloecke werden nebeneinander (horizontal) im Canvas dargestellt
- Properties-Panel fuer ausgewaehlten Block mit allen Styling-Optionen
- Die `HeaderBlock`-Schnittstelle wird an `FooterBlock` angelehnt

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

---

## 4. Bilder im Header-Designer laden und Drag-and-Drop anzeigen

Zwei Probleme werden behoben:
- **Bilder laden nicht**: Der Storage-Bucket `letter-assets` ist moeglicherweise nicht public. Die `getPublicUrl`-Methode liefert immer eine URL, aber wenn der Bucket nicht public ist, gibt sie 404 zurueck. Stattdessen wird `createSignedUrl` verwendet oder sichergestellt, dass der Bucket public ist.
- **Bilder beim Drag-and-Drop nicht sichtbar**: Im `onPreviewDrop` wird die `imageUrl` korrekt aus `dataTransfer` gelesen, aber das Element muss auch die URL als `imageUrl` speichern. Dies funktioniert bereits im Code -- das Problem liegt wahrscheinlich am fehlenden Bucket. Eine SQL-Migration wird hinzugefuegt, um den Bucket als public zu konfigurieren.

**Dateien:**
- SQL-Migration: Bucket `letter-assets` als public erstellen (falls nicht vorhanden)
- `src/components/letters/StructuredHeaderEditor.tsx`: Fallback auf `createSignedUrl` wenn `getPublicUrl` fehlschlaegt

---

## 5. Element-Auswahl (Fokus) im Canvas reparieren

Das Problem: `onClick={() => setSelectedElementId(null)}` auf dem Canvas-Container setzt die Auswahl zurueck bei jedem Klick -- auch wenn ein Element angeklickt wird (Bubbling). Die Loesung: Im `onClick` des Canvas wird geprueft, ob das Event direkt vom Canvas kommt (`e.target === e.currentTarget`), und nur dann die Auswahl zurueckgesetzt.

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx` (Zeile 511)
- Aendern von `onClick={() => setSelectedElementId(null)}` zu `onClick={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}`

---

## 6. Kein internes Scrollen -- Seite waechst mit Inhalt

Alle `max-h-[...]` und `overflow-y-auto` Einschraenkungen werden entfernt:
- Header-Designer Sidebar: `max-h-[70vh] overflow-y-auto` (Zeile 303) entfernen
- Block-Canvas Sidebar: `max-h-52 overflow-auto` (Zeile 375) entfernen
- Tab-Bereiche in LetterTemplateManager: Keine kuenstlichen Hoehenbeschraenkungen

**Dateien:**
- `src/components/letters/StructuredHeaderEditor.tsx`
- `src/components/LetterTemplateManager.tsx`

---

## 7. Doppelte Elemente im Canvas beheben

Die Ursache: Der `useEffect` auf Zeile 98-100 ruft `onElementsChange(elements)` bei jeder Aenderung auf. Wenn der Parent (`LetterTemplateManager`) daraufhin `setFormData` aufruft und die `initialElements` sich aendern, wird der State erneut gesetzt. Da `useState(initialElements)` nur den Initialwert nutzt, ist das normalerweise kein Problem -- aber es gibt keinen Guard gegen doppeltes Hinzufuegen.

Loesung: In `addTextElement` und `addImageElementFromUrl` wird sichergestellt, dass die ID eindeutig ist und nicht bereits im State existiert. Zusaetzlich wird der `useEffect` mit einem Ref geschuetzt, um doppelte Aufrufe zu vermeiden.

**Datei:** `src/components/letters/StructuredHeaderEditor.tsx`

---

## 8. Canvas-Tab als ersten Tab anordnen

In beiden TabsList (Create und Edit) wird `canvas-designer` an die erste Stelle verschoben. Die Reihenfolge wird:
Canvas | Header-Designer | Footer-Designer | Layout-Einstellungen | Allgemein | Adressfeld | Ruecksendeangaben | Info-Block | Betreff | Anlagen

**Datei:** `src/components/LetterTemplateManager.tsx` (Zeilen 516-528 und 780-792)

---

## 9. Tab "Erweitert" in "Layout-Einstellungen" integrieren

Der Inhalt des "Erweitert"-Tabs (HTML/CSS-Textareas) wird in den `LayoutSettingsEditor` verschoben. Der separate Tab "Erweitert" wird aus der TabsList entfernt.

**Dateien:**
- `src/components/letters/LayoutSettingsEditor.tsx`: Neue Props fuer `letterheadHtml`, `letterheadCss` und deren Change-Handler. Am Ende des Formulars wird ein aufklappbarer Bereich "Erweitert (HTML/CSS)" hinzugefuegt.
- `src/components/LetterTemplateManager.tsx`: Tab "advanced" entfernen, Props an LayoutSettingsEditor uebergeben

---

## 10. Betreff-Tab: Canvas fuer Platzhalter + Bild-Tool

Der Betreff-Tab bekommt einen vollstaendigen Canvas (aehnlich dem Block-Canvas), auf den die Variablen-Platzhalter und Bilder per Drag-and-Drop gezogen werden koennen:
- Der `renderBlockCanvas` wird erweitert, um `onDragOver` und `onDrop` fuer die Platzhalter-Chips zu unterstuetzen
- Beim Drop eines Platzhalters (z.B. `{{betreff}}`) wird ein Text-Element mit dem Platzhalter-Inhalt erstellt
- Das Bild-Upload-Tool aus dem Header-Designer wird auch im Betreff-Tab angeboten (gleiche `systemImages` Galerie)

**Datei:** `src/components/LetterTemplateManager.tsx`

---

## 11. Tab "Inhalt" entfernen

Der Tab "block-content" wird aus beiden TabsLists und seinen TabsContent-Bloecken entfernt. Die Inhaltsbereich-Einstellungen (Top, Max. Hoehe) sind bereits im LayoutSettingsEditor vorhanden.

**Datei:** `src/components/LetterTemplateManager.tsx`

---

## Technische Details

### Aenderungen pro Datei

| Datei | Punkte |
|-------|--------|
| `src/components/letters/StructuredHeaderEditor.tsx` | 1, 2, 3, 4, 5, 6, 7 |
| `src/components/LetterTemplateManager.tsx` | 6, 8, 9, 10, 11 |
| `src/components/letters/LayoutSettingsEditor.tsx` | 9 |
| SQL-Migration | 4 (Bucket public machen) |

### Tab-Reihenfolge (neu, 10 Tabs statt 12)

```text
Canvas | Header-Designer | Footer-Designer | Layout-Einstellungen | Allgemein | Adressfeld | Ruecksendeangaben | Info-Block | Betreff | Anlagen
```

### Header-Designer Grid (neu)

```text
lg:grid-cols-[280px_1fr]
Sidebar: 280px fest
Canvas: flexibel (restlicher Platz)
```

### Canvas Element-Auswahl Fix

```text
Vorher:  onClick={() => setSelectedElementId(null)}
Nachher: onClick={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}
```

### Storage-Bucket Migration

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('letter-assets', 'letter-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;
```

