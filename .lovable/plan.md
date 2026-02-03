

# Plan: Verbesserte Aufgabenansicht unter "Meine Arbeit"

## 1. Layout-Aenderung: Nebeneinander statt Untereinander

Die beiden Bereiche "Mir zugewiesen" und "Von mir erstellt" werden in einem 50/50 Split-Layout dargestellt.

```text
+---------------------------+---------------------------+
|    MIR ZUGEWIESEN         |    VON MIR ERSTELLT       |
|    (50% Breite)           |    (50% Breite)           |
+---------------------------+---------------------------+
|                           |                           |
|   [Aufgabe 1]             |   [Aufgabe A]             |
|   [Aufgabe 2]             |   [Aufgabe B]             |
|   [Aufgabe 3]             |   [Aufgabe C]             |
|                           |                           |
+---------------------------+---------------------------+
```

Umsetzung:
- `grid grid-cols-1 lg:grid-cols-2 gap-4` fuer das Layout
- Jede Spalte hat eigene ScrollArea
- Responsive: Auf mobilen Geraeten untereinander

---

## 2. Ansichts-Toggle: Card vs. Liste

Ein Toggle oben rechts ermoeglicht den Wechsel zwischen den Ansichten.

```text
Header-Bereich:
[Aufgaben (12)]                    [Card | Liste]
```

| Ansicht | Beschreibung |
|---------|--------------|
| Card    | Karten mit mehr Details, wie bei Notizen |
| Liste   | Kompakte Tabellenansicht mit Spalten |

Speicherung der Praeferenz via `useViewPreference` Hook (bereits vorhanden).

---

## 3. Badge-System (wie bei Notizen)

Farbige Quadrate im Normalzustand, erweiterte Badges beim Hover.

### Standard-Ansicht (kleine farbige Quadrate):

```text
[■] Prioritaet (rot/orange/gruen)
[■] Status (grau/blau/gruen)
[■] Kategorie (violett/blau/etc.)
[■] Zugewiesen an (vorhanden = tuerkis)
```

### Hover-Ansicht (volle Badges):

```text
[Hoch] [In Bearbeitung] [Persoenlich] [Max M.]
```

### Farbschema:

| Badge | Farbe | Bedeutung |
|-------|-------|-----------|
| Prioritaet hoch | Rot (#ef4444) | Dringend |
| Prioritaet mittel | Orange (#f97316) | Wichtig |
| Prioritaet niedrig | Gruen (#22c55e) | Normal |
| Status: todo | Grau (#6b7280) | Offen |
| Status: in-progress | Blau (#3b82f6) | In Arbeit |
| Status: completed | Gruen (#22c55e) | Erledigt |
| Kategorie | Violett (#8b5cf6) | Thema/Bereich |
| Zugewiesen | Tuerkis (#06b6d4) | Person zugewiesen |

---

## 4. Aktions-Icons (bei Hover einfliegen)

Icons erscheinen beim Hover in einer Leiste am unteren Rand der Card/Zeile.

| Icon | Aktion | Beschreibung |
|------|--------|--------------|
| AlarmClock | Wiedervorlage | Aufgabe auf spaeter verschieben |
| UserPlus | Zuweisung | Person zuweisen/aendern |
| MessageSquare | Kommentare | Kommentare anzeigen/hinzufuegen |
| Vote | Entscheidung anfordern | Abstimmung starten |
| Paperclip | Dokumente | Anhaenge anzeigen/hinzufuegen |

### Anordnung (identisch zu Notizen):

```text
+------------------------------------------+
|  [Titel]                                 |
|  [Beschreibung...]                       |
|                                          |
|  [■][■][■][■]                [→ Details] |  <- Standard
|  [Hoch][Status][...]   [🔔][👤][💬][📎] |  <- Hover
+------------------------------------------+
```

---

## 5. Inline-Bearbeitung von Titel und Beschreibung

Titel und Beschreibung koennen direkt in der Card bearbeitet werden.

**Implementierung:**
- Klick auf Titel/Beschreibung aktiviert Bearbeitungsmodus
- Einfaches Input-Feld fuer Titel
- Textarea oder SimpleRichTextEditor fuer Beschreibung
- Speichern bei Blur oder Enter
- Abbrechen bei Escape

```text
+------------------------------------------+
|  [Aufgabe einkaufen_______] <- Editierbar|
|  [Milch und Brot besorgen_] <- Editierbar|
|                                          |
+------------------------------------------+
```

---

## 6. Listen-Ansicht

Kompakte Tabellen-Darstellung mit den wichtigsten Spalten.

| Checkbox | Titel | Prioritaet | Status | Faellig | Aktionen |
|----------|-------|------------|--------|---------|----------|
| [ ] | Einkaufen | 🔴 | In Arbeit | 05.02. | [🔔][👤][💬] |
| [ ] | Meeting | 🟡 | Offen | 07.02. | [🔔][👤][💬] |

- Aktions-Icons erscheinen nur bei Hover der Zeile
- Titel ist inline bearbeitbar (Doppelklick)
- Checkbox fuer schnelles Erledigen

---

## 7. Zusaetzliche Ideen

### 7.1 Schnellfilter

Filter-Chips ueber den Listen fuer schnelles Filtern:

```text
[Alle] [Ueberfaellig] [Heute] [Diese Woche] [Hohe Prioritaet]
```

### 7.2 Sortieroptionen

Dropdown fuer Sortierung:

```text
Sortieren nach: [Faelligkeit ▼]
- Faelligkeit
- Prioritaet
- Erstelldatum
- Titel
```

### 7.3 Drag & Drop zwischen Spalten

Aufgabe von "Mir zugewiesen" nach "Von mir erstellt" ziehen (falls Berechtigung).

### 7.4 Bulk-Aktionen

Mehrere Aufgaben auswaehlen und gemeinsam bearbeiten:
- Alle als erledigt markieren
- Prioritaet aendern
- Status aendern

### 7.5 Unteraufgaben-Zaehler

Badge mit Anzahl offener Unteraufgaben: `[3/5]`

### 7.6 Kommentar-Zaehler

Badge mit Anzahl Kommentare: `[💬 2]`

---

## 8. Technische Umsetzung

### Neue/Geaenderte Dateien:

| Datei | Aenderung |
|-------|-----------|
| `src/components/my-work/MyWorkTasksTab.tsx` | Komplette Ueberarbeitung mit neuem Layout |
| `src/components/tasks/TaskCard.tsx` | NEUE Komponente fuer einzelne Aufgaben-Cards |
| `src/components/tasks/TaskListRow.tsx` | NEUE Komponente fuer Listen-Zeilen |
| `src/components/tasks/TaskBadges.tsx` | NEUE Komponente fuer Badge-Anzeige mit Hover |
| `src/components/tasks/TaskActionIcons.tsx` | NEUE Komponente fuer Aktions-Icons |

### Wiederverwendbare Patterns aus QuickNotesList:

- Hover-Zustand mit `group` und `group-hover:` Klassen
- Kleine Quadrate: `<div className="w-1.5 h-1.5 bg-[farbe]" />`
- Transition: `opacity-0 group-hover:opacity-100 transition-opacity duration-200`
- TooltipProvider fuer Icon-Beschreibungen

---

## 9. Zusammenfassung

| Feature | Beschreibung |
|---------|--------------|
| 50/50 Layout | Beide Bereiche nebeneinander |
| Ansichts-Toggle | Card oder Liste waehlbar |
| Badge-System | Farbige Quadrate, erweitert bei Hover |
| Aktions-Icons | Wiedervorlage, Zuweisung, Kommentare, Entscheidung, Dokumente |
| Inline-Edit | Titel und Beschreibung direkt aenderbar |
| Schnellfilter | Optional: Ueberfaellig, Heute, etc. |
| Sortierung | Optional: Nach Faelligkeit, Prioritaet, etc. |

