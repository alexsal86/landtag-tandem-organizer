

# Plan: 9 Verbesserungen fuer Entscheidungen, Briefvorlagen und Benachrichtigungen

## 1. Entscheidungs-Creator Layout umbauen

Betrifft: `TaskDecisionCreator.tsx` und `StandaloneDecisionCreator.tsx`

Aenderungen am Dialog-Layout:
- **Oeffentlich + Prioritaet in einer Zeile (je 50%)**: Die Checkbox "Oeffentlich" und "Als prioritaer markieren" werden nebeneinander in einem `grid grid-cols-2` platziert. Aktuell sind sie getrennt (Oeffentlich oben, Prioritaet ganz unten).
- **Antworttyp + Vorschau nebeneinander (je 50%)**: Das Select fuer den Antworttyp nimmt 50% ein, die Vorschau daneben die restlichen 50%. Beim Hovern ueber einen Eintrag im Select-Dropdown wird die Vorschau bereits aktualisiert.
- **Rating5 und OptionABC**: Wenn einer dieser beiden Templates gewaehlt wird, oeffnet sich automatisch der ResponseOptionsEditor darunter (wie bei "Benutzerdefiniert"), damit die Beschreibungen/Tooltips direkt editierbar sind. Ein Hinweistext erklaert, dass man alternativ auch "Benutzerdefiniert" waehlen kann, um komplett eigene Optionen zu erstellen.

Dateien:
- `src/components/task-decisions/TaskDecisionCreator.tsx` (Zeilen 565-693): Layout umbauen
- `src/components/task-decisions/StandaloneDecisionCreator.tsx` (Zeilen 539-661): Gleiches Layout uebernehmen
- `src/components/task-decisions/ResponseOptionsPreview.tsx`: Hover-Vorschau unterstuetzen (Prop fuer "hovered template")

## 2. Badges in Decision-Cards und Details anzeigen

Betrifft: `DecisionOverview.tsx`

Probleme:
- Badges (Themen/Topics) werden in der Card angezeigt, aber nicht in den Details
- Wenn Badges zu `+3` zusammengefasst sind, kann man sie nicht aufklappen

Aenderungen:
- `DecisionOverview.tsx` Zeile 1004: `TopicDisplay` hat bereits `maxDisplay={2}` -- beim Klick auf "+X" sollen alle angezeigt werden. Dafuer wird ein `expandable`-Prop fuer `TopicDisplay` eingefuehrt oder ein Popover ergaenzt.
- `TaskDecisionDetails.tsx`: Sicherstellen, dass `topicIds` an die Detail-Ansicht uebergeben und dort ebenfalls via `TopicDisplay` angezeigt werden.

Dateien:
- `src/components/task-decisions/DecisionOverview.tsx`: Klickbare Badge-Erweiterung
- `src/components/task-decisions/TaskDecisionDetails.tsx`: Topics/Badges anzeigen
- `src/components/topics/TopicSelector.tsx`: `TopicDisplay` mit Expand-Funktionalitaet

## 3. Hover-Verhalten bei Cards: Beschreibung bleibt sichtbar

Betrifft: `DecisionOverview.tsx`

Problem: Beim Hover wird `line-clamp-1` zu `line-clamp-2` erweitert, aber die Description verschwindet, weil der uebergeordnete Container `max-h-[4.5rem] overflow-hidden` hat (Zeile 946).

Loesung: Den Container `max-h-[4.5rem] overflow-hidden` entfernen und stattdessen den Titel immer mit `line-clamp-2` darstellen (oder die `max-h` vergroessern). Die Beschreibung soll immer sichtbar bleiben.

Dateien:
- `src/components/task-decisions/DecisionOverview.tsx` (Zeilen 946-955)

## 4. Sidebar Aktionen: Schrift groesser, nicht abgeschnitten, Antwort-Button

Betrifft: `DecisionSidebar.tsx`

Probleme (laut Screenshot):
- Schrift ist `text-[10px]` und kaum lesbar
- Texte werden mit `truncate` und `line-clamp-2` abgeschnitten
- Kein direkter "Antworten"-Button fuer neue Begruendungen

Aenderungen:
- Schriftgroessen von `text-[10px]` auf `text-xs` (12px) und `text-sm` (14px) erhoehen
- `truncate` bei Titeln entfernen oder `line-clamp-3` verwenden
- Fuer "Neue Begruendungen" ebenfalls einen "Antworten"-Button hinzufuegen (analog zu den offenen Rueckfragen)

Dateien:
- `src/components/task-decisions/DecisionSidebar.tsx`: Schriftgroessen erhoehen, Truncation lockern, Antwort-Button ergaenzen

## 5. Benachrichtigungen fuer Kommentare in Entscheidungen

Aktueller Stand: `DecisionComments.tsx` benachrichtigt bereits den Ersteller (`task_decision_comment_received`), aber nur den Ersteller. Andere Teilnehmer oder erwaehnte Personen werden nicht benachrichtigt.

Aenderungen:
- Alle Teilnehmer einer Entscheidung benachrichtigen (ausser den Kommentierenden selbst)
- Benachrichtigungstyp `task_decision_comment_received` wird bereits verwendet -- nur die Empfaenger-Logik erweitern
- Im Benachrichtigungscenter (`NotificationCenter.tsx` / `NotificationsPage.tsx`) pruefen, ob der Typ bereits in den Kategorien/Filtern aufgefuehrt ist. Laut Suche ist er bereits vorhanden -- es fehlt lediglich die Filterauswahl in den Einstellungen.
- In den Benachrichtigungseinstellungen den Typ als konfigurierbare Option hinzufuegen (z.B. "Kommentare in Entscheidungen")

Dateien:
- `src/components/task-decisions/DecisionComments.tsx`: Alle Teilnehmer benachrichtigen
- `src/pages/NotificationsPage.tsx` oder Benachrichtigungseinstellungen: Kategorie ergaenzen

## 6. Brief-Anlaesse: Endlosschleife beheben

Problem: `loadOccasions()` ruft `seedDefaults()` auf, wenn keine Daten vorhanden sind. `seedDefaults()` ruft am Ende wieder `loadOccasions()` auf. Wenn die Inserts fehlschlagen (z.B. wegen fehlender RLS-Policy), entsteht eine Endlosschleife.

Loesung: Ein Guard einfuehren (`seedingRef` oder `hasSeed` State), der verhindert, dass `seedDefaults` mehrfach aufgerufen wird. Ausserdem die Seed-Logik nur einmal ausfuehren und Fehler abfangen.

Dateien:
- `src/components/administration/LetterOccasionManager.tsx` (Zeilen 89-109): Guard einbauen

## 7. Briefvorlagen: Tabs umstrukturieren

Aenderungen in `LetterTemplateManager.tsx`:
- **Tab Ruecksende**: `SenderInformationManager` bereits integriert (Zeile 512) -- bestaetigt
- **Tab Info-Block**: `InformationBlockManager` bereits integriert (Zeile 520) -- bestaetigt
- **Tab Erweitert**: HTML/CSS-Editor in den Tab Layout verschieben (aus `advanced` in `layout-settings` integrieren)
- **Tab-Reihenfolge**: Layout und Allgemein ans Ende der Tab-Liste verschieben
- **Tabs entfernen**: `advanced` als separater Tab wird entfernt; Inhalt, Block-Content bleibt

Neue Tab-Reihenfolge: Canvas, Header, Footer, Adressfeld, Ruecksende, Info-Block, Betreff, Anlagen, Layout, Allgemein

Dateien:
- `src/components/LetterTemplateManager.tsx` (Zeilen 408-424 und 452-461, 592-605)

## 8. Header-Tab: Elemente entfernen, Bild-Workflow und Bloecke wiederherstellen

Aenderungen in `StructuredHeaderEditor.tsx`:

Entfernen:
- Die 4 Shortcut-Buttons "Landtag", "Wahlkreis", "Kommunikation", "Allgemein" (Zeilen 298-303)

Wiederherstellen (gemaess Screenshot und Blob-URL-Implementierung):
- **Bild-Galerie in der Sidebar**: Bilder aus dem Storage laden (mit Blob-URL-Ansatz), als Thumbnails in einem Grid in der Sidebar anzeigen. Bilder per Drag-and-Drop auf den Canvas ziehen. Loeschen-Button pro Bild.
- **Bloecke-Bereich**: Ein Abschnitt "Bloecke (N)" mit einem "+ Neu"-Button in der Sidebar. Bloecke sind gruppierte Elemente mit eigenem Styling (Titel, Inhalt, Breite, Schrift). Bereits als `HeaderBlock` Interface definiert (Zeilen 33-49), aber nicht in der UI verwendet.
- **Delete per Tastatur**: Bereits implementiert fuer die Block-Canvas-Bereiche, aber im Header-Canvas fehlt es. `onPreviewKeyDown` behandelt nur Pfeiltasten (Zeile 260). Ergaenzen: `Delete`/`Backspace` loescht das ausgewaehlte Element.

Dateien:
- `src/components/letters/StructuredHeaderEditor.tsx`: Shortcut-Buttons entfernen, Bild-Galerie mit Blob-URLs hinzufuegen, Bloecke-UI ergaenzen, Delete-Taste implementieren

## 9. Canvas-Vorschau fuer alle Block-Tabs (Footer, Adressfeld, Ruecksende, Info-Block, Betreff, Anlagen)

Aktueller Stand: `renderBlockCanvas` in `LetterTemplateManager.tsx` rendert bereits eine Canvas-Vorschau fuer Adressfeld, Ruecksende, Info-Block, Betreff und Anlagen. Allerdings fehlen:
- Ein Lineal-Toggle (wie im Header) -- teilweise implementiert (Zeile 306), aber nur innerhalb der Block-Canvas
- Canvas-Vorschau fuer Footer (aktuell `StructuredFooterEditor` ohne Canvas)

Aenderungen:
- **Footer**: Den `StructuredFooterEditor` um eine Canvas-aehnliche Vorschau ergaenzen (Lineal zuschaltbar)
- **Bestehende Bloecke**: Die Lineal-Funktion ist bereits in `renderBlockCanvas` vorhanden. Sicherstellen, dass alle Tabs den Lineal-Button korrekt anzeigen.
- Ein Hauptlineal (aussen) wie im Header-Designer als zusaetzliche Option ergaenzen

Dateien:
- `src/components/letters/StructuredFooterEditor.tsx`: Canvas-Vorschau mit Lineal ergaenzen
- `src/components/LetterTemplateManager.tsx`: Pruefen, ob `renderBlockCanvas` fuer alle Tabs korrekt aufgerufen wird

---

## Zusammenfassung

| Nr. | Thema | Aufwand | Hauptdateien |
|-----|-------|---------|--------------|
| 1 | Creator-Layout umbauen | Mittel | TaskDecisionCreator, StandaloneDecisionCreator |
| 2 | Badges in Cards/Details | Gering | DecisionOverview, TaskDecisionDetails |
| 3 | Hover: Beschreibung sichtbar | Gering | DecisionOverview |
| 4 | Sidebar: Schrift + Antwort-Button | Gering | DecisionSidebar |
| 5 | Kommentar-Benachrichtigungen | Mittel | DecisionComments, NotificationsPage |
| 6 | Brief-Anlaesse Endlosschleife | Gering | LetterOccasionManager |
| 7 | Tabs umstrukturieren | Gering | LetterTemplateManager |
| 8 | Header: Bilder + Bloecke wiederherstellen | Hoch | StructuredHeaderEditor |
| 9 | Canvas-Vorschau fuer alle Tabs | Mittel | StructuredFooterEditor, LetterTemplateManager |

