

# Brief-Editor: Interaktive Bereiche und Toolbar-Optimierung

## Uebersicht

Der Brief-Editor wird interaktiver gestaltet: Bereiche wie Ruecksendezeile, Adressfeld, Info-Block und Anrede werden direkt auf dem Brief editierbar. Die Lexical-Toolbar wandert ueber den Brief (wie in Word), und ein Floating-Popup erscheint beim Markieren von Text. Formen (Shapes) werden korrekt im Header gerendert.

---

## 1. Formen (Shapes) im Header und in Bloecken korrekt rendern

**Problem:** `renderCanvasBlockElements()` in `DIN5008LetterLayout.tsx` behandelt nur `text` und `image` Elemente -- `shape` Elemente werden ignoriert (return null).

**Loesung:** Shape-Rendering analog zu `StructuredHeaderEditor.renderShapeCanvas()` hinzufuegen, aber in mm-Koordinaten statt px:

| Datei | Aenderung |
|---|---|
| `src/components/letters/DIN5008LetterLayout.tsx` | `renderCanvasBlockElements()` erweitern: neuen `if (element.type === 'shape')` Block mit SVG-Rendering fuer line, circle, rectangle, sunflower, lion, wappen |

Auch im Header-Rendering (Zeile 434ff) fehlt Shape-Support -- dort ebenfalls ergaenzen.

---

## 2. Editierbare Bereiche auf dem Brief-Canvas

### Konzept: Hover-Overlay mit Schnellbearbeitung

Fuer Ruecksendezeile, Adressfeld, Info-Block und Anrede wird jeweils ein **Hover-Overlay** ueber den entsprechenden Bereich im `LetterEditorCanvas` gelegt:

- **Hover**: Dezenter blauer Rahmen + kleines Edit-Icon oben rechts
- **Klick auf den Bereich**: Oeffnet ein **Popover** (Radix Popover) direkt am Bereich, in dem die relevanten Eingabefelder angezeigt werden
- **Popover-Inhalt je nach Bereich:**
  - **Ruecksendezeile**: Auswahl des Absenders (Dropdown), Text-Override
  - **Adressfeld**: Name + Adresse Textarea, Kontakt-Auswahl
  - **Info-Block**: Auswahl der Informationsbloecke (Checkboxen)
  - **Anrede**: Textfeld fuer Anrede-Override
  - **Betreff**: Textfeld fuer Betreff

### Technische Umsetzung

| Datei | Aenderung |
|---|---|
| `src/components/letters/LetterEditorCanvas.tsx` | Neue Props fuer onChange-Callbacks: `onSubjectChange`, `onSalutationChange`, `onRecipientChange`, `onSenderChange`, `onInfoBlockChange`. Hover-Overlays mit Popover ueber den DIN5008-Bereichen platzieren (absolute Positionierung ueber den bekannten mm-Koordinaten). |
| `src/components/LetterEditor.tsx` | Die neuen Callbacks an LetterEditorCanvas durchreichen, die die gleiche Logik wie die bisherigen Sidebar-Inputs nutzen |

### Interaktionsablauf

```text
Benutzer hovert ueber Adressfeld
  -> Blauer gestrichelter Rahmen erscheint + Stift-Icon
  -> Klick oeffnet Popover mit:
     [Kontakt auswaehlen v]
     Name: [____________]
     Adresse:
     [________________]
     [________________]
     [Uebernehmen]
```

---

## 3. Lexical-Toolbar ueber dem Brief (wie Word)

**Aktuell:** Die Toolbar ist im EnhancedLexicalEditor eingebettet und erscheint innerhalb des Briefblatts.

**Neu:** Die Toolbar wird aus dem Brief herausgeloest und in die Zoom-Toolbar-Leiste integriert, die bereits ueber dem Canvas sitzt. So hat der Benutzer die volle Briefflaeche fuer den Text.

| Datei | Aenderung |
|---|---|
| `src/components/letters/LetterEditorCanvas.tsx` | `showToolbar={false}` an EnhancedLexicalEditor uebergeben. Stattdessen die `EnhancedLexicalToolbar` in den Toolbar-Bereich ueber dem Canvas rendern. Dafuer muss der LexicalComposer-Context nach oben gehoben werden oder die Toolbar per Ref/Callback angebunden werden. |
| `src/components/EnhancedLexicalEditor.tsx` | Option ergaenzen, um die Toolbar extern zu rendern (z.B. `renderToolbar` Prop oder `editorRef` fuer externen Zugriff) |

### Floating-Format-Toolbar bei Textmarkierung

Der bestehende `FloatingTextFormatToolbar` wird bereits im EnhancedLexicalEditor eingebunden. Dieser bleibt aktiv und erscheint automatisch, wenn Text markiert wird -- genau das gewuenschte Verhalten fuer schnelle Formatierungen (Fett, Kursiv, Unterstrichen etc.).

---

## 4. Anrede direkt auf dem Brief aenderbar

Die Anrede wird wie die anderen Bereiche (Punkt 2) als Hover-editierbarer Bereich behandelt:

- Hover zeigt blauen Rahmen
- Klick oeffnet Popover mit Textfeld fuer Anrede-Override
- Aenderungen werden sofort im Brief sichtbar

Dies wird als Teil der Hover-Overlay-Implementierung in `LetterEditorCanvas.tsx` umgesetzt.

---

## 5. Besserer Workflow: Briefvorlage zu Brief

Um den Uebergang von der Vorlage zum fertigen Brief zu verbessern:

- **Vorlage-Indikatoren**: Oben im Canvas wird ein dezenter Hinweis gezeigt, welches Template aktiv ist, mit Link zum schnellen Wechsel
- **Template-Schnellwechsel**: Ein kleines Badge/Button im Toolbar-Bereich zeigt den Template-Namen und oeffnet bei Klick die Template-Auswahl

---

## Zusammenfassung der Datei-Aenderungen

| Datei | Art | Beschreibung |
|---|---|---|
| `src/components/letters/DIN5008LetterLayout.tsx` | Bearbeiten | Shape-Rendering in `renderCanvasBlockElements()` und Header ergaenzen |
| `src/components/letters/LetterEditorCanvas.tsx` | Bearbeiten | Hover-Overlays mit Popovers fuer alle editierbaren Bereiche; Toolbar nach oben verschieben; neue Props fuer onChange-Callbacks |
| `src/components/LetterEditor.tsx` | Bearbeiten | Neue Callbacks an LetterEditorCanvas durchreichen |
| `src/components/EnhancedLexicalEditor.tsx` | Bearbeiten | Option fuer externe Toolbar-Positionierung |

