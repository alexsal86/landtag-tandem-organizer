

# Plan zur Behebung der 4 Probleme

## 1. Pressemitteilungs-Inhalt wird nicht in E-Mail uebernommen

**Ursache:** Der `EnhancedLexicalEditor` gibt beim Aendern nur Klartext (`plainText`) und Lexical-JSON (`contentNodes`) zurueck, aber kein HTML. In `PressReleaseEditor.tsx` wird `contentHtml` daher nie aktualisiert und bleibt leer. Beim Speichern wird `content_html` als leerer String in die Datenbank geschrieben. In der E-Mail-Funktion (`loadPressReleaseForEmail`) greift zwar ein Fallback auf `content` (Klartext), aber dieser enthaelt keine Formatierung.

**Loesung:**
- In `EnhancedLexicalEditor.tsx` (`handleChange`, Zeile 188-200): Zusaetzlich HTML aus dem Editor generieren mittels `$generateHtmlFromNodes` und als dritten Parameter an `onChange` uebergeben
- Die `onChange`-Signatur erweitern auf `(content: string, contentNodes?: string, contentHtml?: string)`
- In `PressReleaseEditor.tsx` (`handleContentChange`, Zeile 190-192): Den dritten Parameter `contentHtml` entgegennehmen und `setContentHtml` aufrufen
- Die anderen Nutzer des Editors (LetterEditor, KnowledgeBaseView) werden durch den optionalen dritten Parameter nicht beeinflusst

**Dateien:**
- `src/components/EnhancedLexicalEditor.tsx` - HTML-Generierung in `handleChange` hinzufuegen, `onChange`-Typ erweitern
- `src/components/press/PressReleaseEditor.tsx` - `handleContentChange` um `contentHtml` erweitern

---

## 2. Header-Layout in Briefvorlagen ist kaputt

**Ursache:** Im 3-Spalten-Grid (`xl:grid-cols-[280px_1fr_300px]`) in `StructuredHeaderEditor.tsx` fehlen explizite Zeilenpositionen. Die Canvas-Card hat `xl:col-start-2 xl:row-span-4`, aber kein `xl:row-start-1`. Dadurch kann die CSS-Grid-Auto-Platzierung die Elemente falsch anordnen, je nach Renderreihenfolge.

**Loesung:**
- Canvas-Card (Zeile 1452): `xl:row-start-1` hinzufuegen, damit sie garantiert in Zeile 1 beginnt
- Action-Buttons-Card (Zeile 1251): `xl:row-start-1` hinzufuegen
- Tools-Card (Zeile 1262): `xl:row-start-2` hinzufuegen
- Gallery-Card (Zeile 1294): `xl:row-start-3` hinzufuegen
- Elements-Card (Zeile 1320): `xl:row-start-2 xl:row-span-2` hinzufuegen, damit sie sich unter den Action Buttons erstreckt

**Datei:**
- `src/components/letters/StructuredHeaderEditor.tsx` - Explizite Zeilen-Zuweisung fuer alle Grid-Kinder

---

## 3. Tageszettel oeffnet sich nach Refresh obwohl er geschlossen war

**Ursache:** In `GlobalDaySlipPanel.tsx` (Zeile 309) wird der Offen-Status mit `useState(true)` initialisiert, d.h. nach jedem Seitenaufruf ist der Tageszettel offen.

**Loesung:**
- Den `open`-Status im `localStorage` persistieren (z.B. unter dem Key `day-slip-panel-open`)
- Beim Initialisieren den gespeicherten Wert lesen (Standard: `false` statt `true`)
- Bei jeder Aenderung von `open` den neuen Wert in `localStorage` schreiben

**Datei:**
- `src/components/GlobalDaySlipPanel.tsx` - Open-State mit localStorage-Persistenz

---

## 4. Benachrichtigungs-Deep-Links leuchten nicht mehr auf

**Ursache:** Der `useNotificationHighlight`-Hook wird nur in `DecisionOverview.tsx` verwendet. Alle anderen Views (Aufgaben, Dokumente, Meetings etc.) nutzen den Hook nicht, obwohl `notificationDeepLinks.ts` fuer sie `?highlight=xxx` URLs generiert. Dadurch navigiert ein Klick auf eine Benachrichtigung zwar zur richtigen Seite, aber nichts leuchtet auf.

**Loesung:**
Den `useNotificationHighlight`-Hook in die wichtigsten Views integrieren und die `notification-highlight`-CSS-Klasse auf die entsprechenden Elemente anwenden:
- `TasksView.tsx` - Aufgaben-Karten mit Highlight versehen
- `DocumentsView.tsx` - Briefe/Dokumente mit Highlight versehen
- Weitere Views nach gleichem Muster (Meetings, Calendar etc.)

**Dateien:**
- `src/components/TasksView.tsx` - `useNotificationHighlight` importieren und auf Task-Karten anwenden
- `src/components/DocumentsView.tsx` - `useNotificationHighlight` importieren und auf Briefe/Dokumente anwenden

---

## Technische Uebersicht

| Datei | Aenderung |
|-------|-----------|
| `src/components/EnhancedLexicalEditor.tsx` | HTML-Generierung via `$generateHtmlFromNodes` in `handleChange`, `onChange`-Signatur erweitern |
| `src/components/press/PressReleaseEditor.tsx` | `handleContentChange` um HTML-Parameter erweitern, `setContentHtml` aufrufen |
| `src/components/letters/StructuredHeaderEditor.tsx` | Explizite `xl:row-start-*` Klassen fuer alle Grid-Kinder |
| `src/components/GlobalDaySlipPanel.tsx` | `open`-State mit localStorage persistieren |
| `src/components/TasksView.tsx` | `useNotificationHighlight` integrieren |
| `src/components/DocumentsView.tsx` | `useNotificationHighlight` integrieren |

