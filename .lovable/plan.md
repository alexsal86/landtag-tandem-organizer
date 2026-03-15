

# Jour Fixe / Agenda: UI-Verbesserungen

## Analyse und Vorschläge

### 1. Drag-Handler nur bei Hover sichtbar
Aktuell ist der `GripVertical`-Handler immer sichtbar. Fix: `opacity-0 group-hover:opacity-100` hinzufügen (die Zeile hat bereits `group` auf dem Parent).

### 2. Weniger Abstand zwischen Gliederungsnummer und Drag-Handler
Aktuell hat die Nummer `min-w-[2.25rem]` mit `text-right`. Der `gap-2` zwischen Handler und Nummer ist zu groß. Fix: `gap-2` auf `gap-1` reduzieren und `min-w-[2.25rem]` auf `min-w-[1.75rem]` verkleinern.

### 3. System-Punkte wie reguläre Punkte aussehen lassen + einzelne Elemente antippbar
Aktuell nutzt `SystemAgendaItem` eine `<Card>` mit farbiger linker Kante. Reguläre Punkte nutzen `border-b` mit Hover. Änderungen:
- `SystemAgendaItem` auf das gleiche `border-b` Layout umstellen (Card entfernen)
- Die einzelnen Elemente (Notizen, Aufgaben, Entscheidungen, Vorgänge) als klickbare/antippbare Zeilen rendern, z.B. mit `cursor-pointer hover:bg-muted/50` und einem `onClick`-Callback
- Neues Prop `onItemClick?: (type: string, id: string) => void` in `SystemAgendaItem` einführen

### 4. Einrückungen vereinheitlichen
Aktuell: Reguläre Unterpunkte haben `pl-8 border-l-4`, System-Items als Unterpunkte haben `ml-8 border-l-4`. Inkonsistenz: `pl-8` vs `ml-8`. Fix: Beide auf `pl-8 border-l-4 border-l-primary/30` vereinheitlichen.

### 5. Notizen und Dokument-Upload nebeneinander (je 50%)
Aktuell stehen "Notizen" (Textarea) und "Dokument hinzufügen" untereinander. Fix: In ein `grid grid-cols-2 gap-4` packen, sodass beide Felder je 50% Breite haben.

### 6. Weitere UI-Verbesserungsvorschläge
- **Kompaktere Header-Zeile**: Die Aktions-Buttons (Plus, Task, Delete, Checkbox) könnten in einem Overflow-Menü (`...`) gebündelt werden statt als einzelne Icons
- **Inline-Editing statt separater Textareas**: Beschreibung und Notizen könnten als Inline-Text erscheinen, der beim Klick editierbar wird (saves vertical space)
- **Farbige Kennzeichnung des Bearbeitungsstatus**: Punkte mit Notizen/Dokumenten könnten einen dezenten Indikator (Punkt/Dot) bekommen
- **Drag-Preview**: Beim Ziehen einen kompakten Preview statt des ganzen Elements zeigen
- **Tastaturkürzel**: Enter am Ende eines Titels erstellt automatisch den nächsten Punkt; Tab rückt ein (macht es zum Unterpunkt)
- **Zusammenklappbare Hauptpunkte**: Hauptpunkte mit vielen Unterpunkten könnten ein Chevron zum Ein-/Ausklappen bekommen

### 7. Fehlende Funktionen
- **Zeitschätzung pro Punkt**: Feld für geschätzte Dauer, Summe in der Kopfzeile anzeigen
- **Verantwortlichkeiten auf Hauptpunkt-Ebene**: Aktuell nur bei Unterpunkten vorhanden (MultiUserAssignSelect), fehlt bei Hauptpunkten
- **Agenda-Export**: Als PDF oder per E-Mail an Teilnehmer versenden
- **Kommentare/Diskussion pro Punkt**: Inline-Kommentare für asynchrone Vorbereitung
- **Vorlagen-Abgleich**: Anzeige welche Template-Punkte fehlen oder hinzugefügt wurden
- **Agenda-Verlauf**: Änderungshistorie / Audit-Log pro Punkt
- **Meeting-Protokoll**: Automatische Zusammenfassung der Ergebnisse aller Punkte nach Archivierung
- **Voting/Abstimmung**: Teilnehmer können über Punkte abstimmen (Priorität, Zustimmung)

---

## Technischer Plan (Punkte 1-5)

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `AgendaEditorPanel.tsx` | Drag-Handler Hover-Only, Gap reduzieren, Einrückung fix, Notizen+Docs Grid |
| `SystemAgendaItem.tsx` | Card → border-b Layout, einzelne Items klickbar machen |

### Detailänderungen

**AgendaEditorPanel.tsx:**
- Zeile 288-290: `opacity-0 group-hover:opacity-100 transition-opacity` zum Drag-Handler div
- Zeile 286: `gap-2` → `gap-1`
- Zeile 292: `min-w-[2.25rem]` → `min-w-[1.75rem]`
- Zeile 253: System-Item `ml-8` → `pl-8` für Konsistenz
- Zeile 440-484: Notizen-Textarea und Dokument-Upload in `grid grid-cols-2 gap-4` wrappen

**SystemAgendaItem.tsx:**
- `renderHeader()`: Card/CardHeader → einfaches `div` mit `border-b py-2 px-3`
- Alle System-Type-Blöcke: `<Card>` → `<div>` mit `border-b border-border/60 hover:bg-muted/30 border-l-4`
- `renderCompactItem`: `cursor-pointer hover:bg-muted/60` hinzufügen + `onClick` Prop durchreichen
- Neues Prop: `onItemClick?: (type: string, id: string) => void`

