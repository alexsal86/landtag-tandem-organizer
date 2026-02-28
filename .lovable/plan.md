

# Track Changes und Kommentare im Pruefschritt

## Ziel

Wenn der Abgeordnete einen Brief im Status "Zur Freigabe" bearbeitet, sollen seine Aenderungen farblich markiert werden (Track Changes) und er soll Kommentare hinterlassen koennen. Der Mitarbeiter sieht nach einer Zurueckweisung genau, was geaendert und kommentiert wurde.

---

## Konzept

### Track Changes (Aenderungsverfolgung)

- Wenn der Editor im **Pruefmodus** ist (Status `pending_approval` und der aktuelle Benutzer ist der Reviewer), wird ein neues `TrackChangesPlugin` aktiviert.
- Dieses Plugin ueberwacht alle Text-Aenderungen im Editor:
  - **Eingefuegter Text**: Wird gruen hinterlegt markiert
  - **Geloeschter Text**: Wird rot und durchgestrichen dargestellt (Text bleibt sichtbar, wird aber als geloescht markiert)
- Die Aenderungen werden als spezielle Lexical-Nodes (`TrackInsertNode`, `TrackDeleteNode`) gespeichert, die beim Serialisieren erhalten bleiben.
- Ein Banner oberhalb des Editors zeigt an: "Pruefmodus aktiv - Aenderungen werden nachverfolgt"

### Kommentare (bereits vorhanden)

- Das bestehende `CommentPlugin` ist bereits im `EnhancedLexicalEditor` integriert. Dieses wird im Pruefmodus weiterhin verfuegbar sein, sodass der Abgeordnete Textpassagen markieren und kommentieren kann.

### Aenderungen akzeptieren/ablehnen

- Der Mitarbeiter sieht bei "Ueberarbeitung" alle markierten Aenderungen.
- Buttons "Alle Aenderungen annehmen" und "Alle Aenderungen ablehnen" ermoeglichen die Uebernahme oder Verwerfung.
- Optional: Einzelne Aenderungen koennen per Rechtsklick/Hover akzeptiert oder abgelehnt werden.

---

## Technische Umsetzung

### 1. Neuer TrackChangesNode (ElementNode)

**Datei:** `src/components/nodes/TrackChangeNode.ts`

- Zwei Node-Typen: `TrackInsertNode` und `TrackDeleteNode`
- Beide erweitern `ElementNode` von Lexical
- `TrackInsertNode`: Rendert mit gruenem Hintergrund (`background: #dcfce7; text-decoration: none`)
- `TrackDeleteNode`: Rendert mit rotem Hintergrund und Durchstreichung (`background: #fecaca; text-decoration: line-through`)
- Beide speichern Metadaten: `authorId`, `authorName`, `timestamp`
- Serialisierung/Deserialisierung ueber `importJSON`/`exportJSON`

### 2. TrackChangesPlugin

**Datei:** `src/components/plugins/TrackChangesPlugin.tsx`

- Wird nur aktiviert, wenn `isReviewMode={true}` uebergeben wird
- Registriert Listener fuer:
  - **Text-Eingabe**: Neue Text-Nodes werden automatisch in einen `TrackInsertNode` gewrappt
  - **Text-Loeschung**: Statt den Text zu loeschen, wird er in einen `TrackDeleteNode` gewrappt (Override von DELETE/BACKSPACE Commands)
- Props: `authorId`, `authorName`, `isReviewMode`

### 3. TrackChangesToolbar

**Datei:** `src/components/plugins/TrackChangesToolbar.tsx`

- Zeigt im Pruefmodus ein Banner: "Pruefmodus - Aenderungen werden nachverfolgt"
- Zeigt im Ueberarbeitungsmodus Buttons:
  - "Alle annehmen" - Entfernt alle Track-Nodes und behaelt den eingefuegten Text / entfernt geloeschten Text
  - "Alle ablehnen" - Entfernt alle Track-Nodes und verwirft eingefuegten Text / stellt geloeschten Text wieder her
  - Zaehler: "X Aenderungen"

### 4. Integration in EnhancedLexicalEditor

**Datei:** `src/components/EnhancedLexicalEditor.tsx`

- Neue Props: `isReviewMode?: boolean`, `reviewerName?: string`, `reviewerId?: string`
- `TrackInsertNode` und `TrackDeleteNode` zur Node-Liste hinzufuegen
- `TrackChangesPlugin` als Plugin einbinden (nur aktiv wenn `isReviewMode`)
- `TrackChangesToolbar` unterhalb der Haupt-Toolbar rendern

### 5. Integration in LetterEditorCanvas

**Datei:** `src/components/letters/LetterEditorCanvas.tsx`

- Neuer Prop `isReviewMode` durchreichen an den `EnhancedLexicalEditor`

### 6. Integration in LetterEditor

**Datei:** `src/components/LetterEditor.tsx`

- Pruefmodus erkennen: `isReviewMode = isReviewer && (currentStatus === 'pending_approval' || currentStatus === 'review')`
- `isReviewMode`, `reviewerName` und `reviewerId` an `LetterEditorCanvas` weitergeben
- Im Status `revision_requested` (Ueberarbeitung): Die TrackChangesToolbar mit "Annehmen/Ablehnen"-Buttons anzeigen

---

## Dateien-Uebersicht

| Datei | Aktion |
|---|---|
| `src/components/nodes/TrackChangeNode.ts` | Neu erstellen |
| `src/components/plugins/TrackChangesPlugin.tsx` | Neu erstellen |
| `src/components/plugins/TrackChangesToolbar.tsx` | Neu erstellen |
| `src/components/EnhancedLexicalEditor.tsx` | Erweitern (Props, Nodes, Plugin) |
| `src/components/letters/LetterEditorCanvas.tsx` | Erweitern (Prop durchreichen) |
| `src/components/LetterEditor.tsx` | Erweitern (Pruefmodus-Logik) |

