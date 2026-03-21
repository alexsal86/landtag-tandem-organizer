

## Checkliste & Zeitstrahl — UI-Verbesserungen

### 1. Connector-Linien nur beim Hovern anzeigen

**Datei:** `PlanningTimelineSection.tsx`

- Connector-SVG-Pfade: Standardmäßig `opacity-0` setzen
- Nur wenn `highlightedChecklistItemId` gesetzt ist UND `line.assignmentId === highlightedChecklistItemId`, wird die Linie sichtbar (durchgehend, nicht gestrichelt)
- Alle anderen Linien bleiben unsichtbar

**Timeline-Dot beim Hover:** Statt den Dot nach links zu versetzen, wird er größer (z.B. `h-7 w-7` statt `h-5 w-5`) und bekommt seine Farbe intensiver. Das Icon wird ebenfalls größer (`h-4 w-4` statt `h-3 w-3`). Position bleibt zentriert auf der Achse. `DOT_LEFT_CLASS` wird dynamisch angepasst.

### 2. Drag-Handle nur beim Hovern

**Datei:** `ChecklistSection.tsx`

- `GripVertical` bekommt `opacity-0 group-hover:opacity-100 transition-opacity` (analog zu den Action-Buttons)
- Gilt für normale Items, Separator und Phase-Start

### 3. Phasendarstellung wie im Screenshot

**Datei:** `ChecklistSection.tsx`

Statt der vertikalen Klammer mit gedrehtem Text wird die Phase als **horizontale Header-Zeile** dargestellt:

```text
┌─────────────────────────────────────────────────┐
│ Planung  (3)                        + Aufgabe   │
│ ═══════════════════════════════════════════════  │ (farbige Linie)
│ ☐ Einladung schreiben                    Frist   │
│ ☐ Verteiler erstellen                    Frist   │
│ ☐ Einladungen verschicken                Frist   │
└─────────────────────────────────────────────────┘
```

- Phasenname links, Anzahl Items als Badge, „+ Aufgabe"-Button rechts
- Darunter eine farbige Trennlinie (primary color)
- Items der Phase darunter aufgelistet
- Der „+ Aufgabe"-Button fügt einen neuen Checklistenpunkt direkt in diese Phase ein (nach dem letzten Item der Phase, vor dem nächsten `phase_start`)

**Items zu Phasen zuordnen/entfernen:**
- Drag & Drop funktioniert bereits über `order_index` — ein Item in eine andere Phase ziehen ändert automatisch die Zuordnung
- Zusätzlich: Im Kontext jeder Phase ein „+ Aufgabe"-Button, der ein neues Item mit dem richtigen `order_index` einfügt

### 4. Template-Editor anpassen

**Datei:** `PlanningTemplateManager.tsx`

- Phase-Start-Einträge werden wie im Screenshot als Header dargestellt (Phasenname + Anzahl + farbige Linie)
- Items innerhalb einer Phase werden visuell gruppiert (eingerückt oder mit Border)
- Der bestehende „Phase hinzufügen"-Button bleibt

### 5. Text-Umbruch in der Checkliste

**Datei:** `ChecklistSection.tsx`

- Zeile 171: `truncate` entfernen vom Input bzw. den Text-Container
- Stattdessen `whitespace-normal break-words` oder einfach das `overflow-hidden` von der umgebenden `div` (Zeile 162) entfernen und `truncate` durch `break-words` ersetzen

### 6. Phasen in der Checkliste hinzufügen

**Datei:** `ChecklistSection.tsx`

- Neben dem bestehenden „Neuen Punkt hinzufügen"-Bereich (Zeile 470-497) einen Button „Phase hinzufügen" ergänzen
- Dieser erstellt einen neuen Checklistenpunkt vom Typ `phase_start` am Ende der Liste
- Nutzt die bestehende `addChecklistItem`-Funktion, aber mit angepasstem Typ — oder eine neue Prop `addPhaseItem` die direkt einen `phase_start` Eintrag anlegt

**Datei:** `EventPlanningDetailView.tsx` (oder zugehöriger Hook)
- Neue Funktion `addPhaseItem(title: string)` die ein Item mit `type: 'phase_start'` erstellt

---

### Zusammenfassung der Dateiänderungen

| Datei | Änderung |
|---|---|
| `ChecklistSection.tsx` | Phase-Header-UI, Drag-Handle hover, Text-Umbruch, Phase-hinzufügen-Button |
| `PlanningTimelineSection.tsx` | Connector nur bei Hover, Dot-Vergrößerung statt Versatz |
| `PlanningTemplateManager.tsx` | Phase-Header-Darstellung wie Checkliste |
| `EventPlanningDetailView.tsx` | `addPhaseItem`-Funktion durchreichen |

