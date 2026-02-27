
# Brief-System: 5-Punkte-Verbesserungsplan

## Uebersicht

Dieses Vorhaben umfasst fuenf zusammenhaengende Aenderungen am Brief-System plus drei Build-Fehler-Fixes.

---

## 0. Build-Fehler beheben (Voraussetzung)

Drei bestehende TypeScript-Fehler muessen zuerst behoben werden:

| Datei | Problem | Loesung |
|---|---|---|
| `LetterLayoutCanvasDesigner.tsx` (Z.745, Z.877) | `fontFamily` existiert nicht auf dem BlockLine-Typ im Scope | Cast zu `(line as any).fontFamily` oder den lokalen Typ erweitern |
| `letterPDFGenerator.ts` (Z.681) | `pagination` fehlt im inline DEFAULT_LAYOUT | `pagination`-Objekt zum DEFAULT_LAYOUT in der Datei hinzufuegen |

---

## 1. Abschlussbereich rutscht nicht mit dem Inhalt mit

**Problem:** Der Closing-Block (Grussformel, Unterschrift) wird im DIN5008LetterLayout als Teil des statischen Layouts gerendert. Im LetterEditorCanvas ist der Lexical-Editor aber als Overlay positioniert -- sein Inhalt waechst, aber der Closing-Block bleibt an fester Position.

**Loesung:**
- In `LetterEditorCanvas.tsx`: Den Closing-Block aus dem statischen `DIN5008LetterLayout` entfernen und stattdessen **unterhalb** des Lexical-Editors als separates, dynamisch positioniertes Element rendern.
- Dazu wird der Editor-Container von `maxHeight` mit Overflow auf ein flexibles Layout umgestellt, bei dem der Closing-Block direkt nach dem Editor-Inhalt kommt.
- In `DIN5008LetterLayout.tsx`: Neuer Prop `hideClosing` (default false), damit der Canvas den Closing-Block separat steuern kann.

**Dateien:**
- `src/components/letters/LetterEditorCanvas.tsx`
- `src/components/letters/DIN5008LetterLayout.tsx`

---

## 2. Mehrseitiger Briefeditor (automatischer Seitenumbruch)

**Problem:** Der Lexical-Editor ist auf `maxHeight` begrenzt und laeuft ueber den Footer/Paginierung. Es gibt keine zweite Seite.

**Loesung:**
- Den Editor-Container **nicht** auf `maxHeight` begrenzen, sondern den gesamten A4-Canvas dynamisch verlaengern, wenn der Inhalt ueber die erste Seite hinausgeht.
- Die `minHeight: 297mm` des Canvas wird auf `auto` gesetzt, mit einem Minimum von 297mm.
- CSS-basierter Seitenumbruch-Indikator: Eine visuelle Trennlinie bei 297mm, 594mm etc. zeigt dem Benutzer, wo der Seitenumbruch im Druck erfolgt.
- Footer und Paginierung werden nur auf der visuellen "ersten Seite" angezeigt (position absolute bei 272mm).
- Der Lexical-Editor bekommt keine `maxHeight` mehr -- er waechst unbegrenzt.

**Dateien:**
- `src/components/letters/LetterEditorCanvas.tsx` (maxHeight entfernen, Canvas-Hoehe dynamisch)
- Neues CSS fuer Seitenumbruch-Markierung (inline style oder Klasse)

---

## 3. Workflow: Freigabe-Schleife (wie bei Pressemitteilungen)

**Problem:** Der aktuelle Workflow ist: Entwurf -> Pruefung -> Genehmigt -> Versendet. Es fehlt ein "Zurueckgewiesen"-Status, der den Brief zurueck zum Mitarbeiter schickt.

**Neuer Workflow:**

```text
Entwurf --[Zur Freigabe senden]--> Zur Freigabe
Zur Freigabe --[Freigeben]--> Freigegeben
Zur Freigabe --[Zurueckweisen]--> Ueberarbeitung
Ueberarbeitung --[Erneut einreichen]--> Zur Freigabe
Freigegeben --[Versenden]--> Versendet
```

**Aenderungen:**
- Neuer Status `revision_requested` (Ueberarbeitung) in `LetterStatusWorkflow.tsx` und `LetterEditor.tsx`
- Status `review` umbenennen zu `pending_approval` (Zur Freigabe) fuer Konsistenz mit dem Presse-System
- Bei Zurueckweisung: Dialog fuer Begruendung (wie `RevisionCommentDialog` bei Presse)
- Neues DB-Feld `revision_comment` (text) und `revision_requested_by` (uuid) auf der `letters`-Tabelle
- Bearbeitungsrechte: Mitarbeiter kann in `draft` und `revision_requested` bearbeiten; Abgeordneter sieht den Brief in `pending_approval` und kann freigeben/zurueckweisen

**Dateien:**
- `src/components/letters/LetterStatusWorkflow.tsx` (komplett ueberarbeiten)
- `src/components/LetterEditor.tsx` (Status-Logik, canEdit, UI)
- DB-Migration: `revision_comment`, `revision_requested_by`, `revision_requested_at` Spalten

---

## 4. Automatische Entscheidung + Aufgaben bei Freigabe

**Problem:** Wenn ein Brief zur Freigabe gesendet wird, soll automatisch eine Entscheidung erstellt und dem Abgeordneten zugestellt werden. Bei Freigabe/Zurueckweisung sollen automatisch Aufgaben erstellt werden.

**Logik:**

**Bei Uebergang zu "Zur Freigabe":**
- Automatisch eine Entscheidung (`task_decisions`) erstellen mit Titel "Brief freigeben: [Betreff]"
- Teilnehmer: der ausgewaehlte Pruefer (Abgeordneter)
- Optionen: "Freigeben" / "Zurueckweisen"
- Link zum Brief als Beschreibung

**Bei "Freigegeben":**
- Aufgabe erstellen, zugewiesen an den Ersteller des Briefes
- Titel: "Brief versenden: [Betreff]"
- Status: to-do

**Bei "Zurueckgewiesen":**
- Aufgabe erstellen, zugewiesen an Ersteller UND Abgeordneten
- Titel: "Brief ueberarbeiten: [Betreff]"
- Begruendung als Beschreibung

**Dateien:**
- `src/components/letters/LetterStatusWorkflow.tsx` oder neues Utility `src/utils/letterWorkflowActions.ts`
- Zugriff auf `task_decisions`, `task_decision_participants`, `tasks` Tabellen

---

## 5. Versand per E-Mail und Druck

**Problem:** Am Ende des Workflows soll der Brief automatisch per E-Mail versendet und/oder gedruckt werden koennen.

**Loesung:**
- Bei Status "Versendet" mit Versandart "E-Mail" oder "Post & E-Mail": Die bestehende Edge Function `send-document-email` nutzen, um den Brief als PDF-Anhang per E-Mail an die Empfaenger-E-Mail-Adresse zu senden.
- Bei Status "Versendet" mit Versandart "Post" oder "Post & E-Mail": PDF generieren und Download/Druck-Dialog oeffnen (`window.print()` oder Blob-Download).
- Die E-Mail-Adresse des Empfaengers wird aus dem verknuepften Kontakt (`contact_id`) gelesen.
- Der Versand-Dialog bei "Versendet" wird erweitert um eine Vorschau der E-Mail-Adresse und eine Bestaetigung.

**Dateien:**
- `src/components/letters/LetterStatusWorkflow.tsx` (Versand-Logik erweitern)
- `src/components/LetterEditor.tsx` (PDF-Download/Druck-Trigger)
- Ggf. `src/utils/letterPDFGenerator.ts` (PDF an E-Mail-Funktion uebergeben)

---

## Reihenfolge der Umsetzung

1. Build-Fehler beheben (Punkt 0)
2. Closing-Block dynamisch positionieren (Punkt 1)
3. Mehrseitiger Editor (Punkt 2)
4. DB-Migration fuer neue Workflow-Felder (Punkt 3)
5. Workflow-Logik implementieren (Punkt 3)
6. Entscheidungs- und Aufgaben-Automatik (Punkt 4)
7. E-Mail-Versand und Druck (Punkt 5)
