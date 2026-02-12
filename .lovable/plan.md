
# Plan: Suchsystem-Konsolidierung und Briefvorlagen-Ueberarbeitung

Dieses Projekt umfasst zwei grosse Bereiche: (1) Zusammenfuehrung der beiden Suchsysteme und (2) umfassende Ueberarbeitung der Briefvorlagen-Verwaltung in der Administration.

---

## Teil 1: Suchsystem konsolidieren

### Aktuelle Situation

Es gibt zwei parallele Suchsysteme:
- **HeaderSearch** (`src/components/layout/HeaderSearch.tsx`): Suchfeld im Header, durchsucht Kontakte, Dokumente, Aufgaben, Termine. Einfach, funktioniert gut, reagiert auf Cmd+K.
- **GlobalSearchCommand** (`src/components/GlobalSearchCommand.tsx`): Command-Dialog (cmdk), reagiert ebenfalls auf Cmd+K. Durchsucht zusaetzlich Briefe, Protokolle, FallAkten. Hat Filter (Datum, Kategorie, Status), letzte Suchen, beliebte Suchen, Suchanalytics, Schnellnavigation zu Seiten.

Beide hoeren auf Cmd+K, was zu Konflikten fuehrt.

### Loesung: Ein einheitliches Suchsystem

Das **HeaderSearch**-Feld im Header bleibt als visueller Einstiegspunkt (Suchfeld + Cmd+K-Hinweis). Ein Klick oder Cmd+K oeffnet den **GlobalSearchCommand**-Dialog. Die eigenstaendige Suchlogik in HeaderSearch wird entfernt.

### Verbesserungen

- **Archive einbinden**: Die GlobalSearchCommand wird um Suche in `archived_tasks` erweitert. Archivierte Ergebnisse werden mit einem "Archiv"-Badge gekennzeichnet.
- **Dokumente erweitern**: Auch archivierte Dokumente (Feld `archived_attachments`) werden beruecksichtigt.
- **HeaderSearch vereinfachen**: Wird zu einem reinen UI-Trigger (Klick oeffnet GlobalSearchCommand, eigene Suche entfaellt).

### Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `src/components/layout/HeaderSearch.tsx` | Suchlogik entfernen, nur UI-Trigger: Klick/Fokus dispatcht `openGlobalSearch`-Event |
| `src/components/GlobalSearchCommand.tsx` | Archiv-Suche fuer Aufgaben hinzufuegen, archivierte Ergebnisse mit Badge kennzeichnen |

---

## Teil 2: Briefvorlagen-Verwaltung ueberarbeiten

### 2.1 Templates ausblenden bei Neuerstellung

Wenn `showCreateDialog` aktiv ist, wird die Template-Liste (das Grid mit bestehenden Templates) ausgeblendet.

### 2.2 Templates sofort sichtbar

Der Button "Brief-Template-Manager oeffnen" entfaellt. `showLetterTemplateManager` wird auf `true` initialisiert bzw. der `LetterTemplateManager` wird direkt ohne Toggle gerendert.

### 2.3 Button "Erstellung schliessen" entfernen

Der Toggle-Text im Button wird zu einem festen "+ Neues Template" geaendert. Der Button setzt nur `showCreateDialog(true)`. Zum Schliessen gibt es weiterhin den "Abbrechen"-Button im Formular.

### 2.4 Flachere Struktur ohne inneren Container

Der innere Card-Container mit der Ueberschrift "Templates" wird entfernt. Die Templates erscheinen direkt unter dem Abschnitt "Briefvorlagen". Der "+ Neues Template"-Button kommt nach rechts oben.

### 2.5 Groesserer Canvas, schmalere Sidebar

Im `StructuredHeaderEditor` wird das Grid-Layout von `lg:grid-cols-[280px_1fr]` auf `lg:grid-cols-[200px_1fr]` geaendert. Die Sidebar wird schmaler, der Canvas bekommt mehr Platz.

### 2.6 Bild-Upload mit Systemordner

- Ein Supabase-Storage-Bucket `letter-assets` wird verwendet (bereits im Code referenziert).
- Bilder werden im Pfad `{tenant_id}/_system/briefvorlagen-bilder/` gespeichert.
- In der Dokumenten-Tabelle werden diese Dateien als Systemordner-Eintraege markiert (mit `is_system: true` Flag oder einem speziellen Kategorie-Marker), sodass sie in der normalen Dokumentenansicht nicht erscheinen.
- Im Header-Designer wird ein Bereich "Bilder" hinzugefuegt, der hochgeladene Bilder anzeigt und per Drag-and-Drop auf den Canvas ziehen laesst.

### 2.7 Entfernen-Taste fuer Elemente

Im `StructuredHeaderEditor` wird ein `keydown`-Event-Listener hinzugefuegt: Wenn ein Element ausgewaehlt ist und die "Delete"- oder "Entfernen"-Taste gedrueckt wird, wird das Element geloescht.

### 2.8 Elemente aus der Auswahl entfernen

Die Elemente "Landtag", "Wahlkreis", "Kommunikation" und "Allgemein" werden aus der Elementeauswahl im Header-Designer entfernt.

### 2.9 Bloecke fuer Header-Designer

Das Block-Konzept aus dem `StructuredFooterEditor` wird in den Header-Designer uebernommen. Nutzer koennen mehrere Elemente zu einem Block gruppieren und als Einheit positionieren.

### 2.10 Doppeltes Textfeld beheben

Der Bug, bei dem ein hinzugefuegtes Textfeld doppelt im Canvas erscheint, wird behoben. Ursache ist vermutlich ein doppelter State-Update durch den useEffect, der `onElementsChange` aufruft und dadurch ein erneutes Setzen der Elemente ausloest.

### 2.11 Card "Absenderinformationen" in Tab "Ruecksendeangaben"

Die bestehende Card "Absenderinformationen" (aktuell als eigene Card in der Administration unter `SenderInformationManager`) wird in den Tab "Ruecksendeangaben" (`block-return-address`) des Template-Editors verschoben.

### 2.12 Card "Informationsbloecke" in Tab "Info-Block"

Die bestehende Card "Informationsbloecke" (`InformationBlockManager`) wird in den Tab "Info-Block" (`block-info`) des Template-Editors integriert.

### 2.13 Betreff-Tab mit Variablen und Bild-Tool

Im Tab "Betreff" (`block-subject`) werden folgende Funktionen hinzugefuegt:
- Ein **Platzhalter-Element** "Betreff" als draggbares Element, das den spaeter im Brief eingegebenen Betreff repraesentiert.
- Das **Bild-Tool** aus dem Header-Designer (Upload + Drag-and-Drop auf Canvas).
- Weitere **Variablen-Platzhalter** (z.B. Datum, Absendername), die als draggable Elemente zur Verfuegung stehen.

### Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Administration.tsx` | 2.2: LetterTemplateManager direkt rendern ohne Toggle-Button; 2.4: Flache Struktur |
| `src/components/LetterTemplateManager.tsx` | 2.1: Template-Grid bei Neuerstellung ausblenden; 2.3: Toggle-Button durch festen Button ersetzen; 2.4: Inneren Container entfernen; 2.8: Elemente entfernen; 2.11: SenderInformationManager in Ruecksendeangaben-Tab; 2.12: InformationBlockManager in Info-Block-Tab; 2.13: Betreff-Tab mit Variablen und Bild-Tool |
| `src/components/letters/StructuredHeaderEditor.tsx` | 2.5: Schmalere Sidebar; 2.6: Bild-Upload mit Systemordner und Bilder-Galerie; 2.7: Delete-Taste; 2.9: Block-System; 2.10: Doppeltes Textfeld beheben |

---

## Technische Details

### Archiv-Suche (Teil 1)

```text
GlobalSearchCommand bekommt neue useQuery:
  - archived_tasks: Suche in archived_tasks Tabelle
  - Ergebnisse mit Badge "Archiv" markiert
  - Route: /tasks?archived=true&id={id}
```

### Systemordner fuer Bilder (2.6)

```text
Storage-Pfad: letter-assets/{tenant_id}/_system/briefvorlagen-bilder/{filename}
Bilder werden beim Upload gespeichert und in einer Galerie im Header-Designer angezeigt.
Bestehende Bilder werden beim Laden des Editors aus dem Storage abgerufen.
```

### Delete-Taste (2.7)

```text
useEffect mit keydown-Listener:
  - Prueft ob selectedElementId gesetzt ist
  - Bei "Delete" oder "Backspace" (ausserhalb Input-Feldern): Element entfernen
```

### Betreff-Variablen (2.13)

```text
Verfuegbare Platzhalter:
  - {{betreff}} - Betreffzeile aus dem Brief
  - {{datum}} - Briefdatum
  - {{empfaenger_name}} - Name des Empfaengers
  - {{absender_name}} - Name des Absenders
Diese werden als draggable Chips dargestellt.
```
