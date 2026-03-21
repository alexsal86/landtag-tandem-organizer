

## Phasen, Hover-Highlight, Timeline-Redesign

### Überblick

6 Änderungen an Checkliste und Zeitstrahl in der Veranstaltungsplanung:

1. Hover-Highlight: Checklistenpunkt hovern → Verbindungslinie wird durchgehend + Zeitstrahl-Eintrag markiert
2. Frist ganz rechts in der Checklisten-Card
3. Timeline-Redesign: Monatsüberschriften + nur Tageszahl + Beschreibung inline
4. Zeitlich nahe Einträge gruppieren
5. Phasen in Administration (Template-Editor)
6. Phasen in Checkliste + Zeitstrahl

---

### 1. Hover-Highlight (Checkliste ↔ Zeitstrahl)

**Dateien:** `EventPlanningDetailView.tsx`, `ChecklistSection.tsx`, `PlanningTimelineSection.tsx`

- Neuer State `hoveredChecklistItemId: string | null` in `EventPlanningDetailView`
- `ChecklistSection` bekommt `onHoverItem` / `onUnhoverItem` Callbacks → `onMouseEnter` / `onMouseLeave` auf der Checklist-Card
- `PlanningTimelineSection` bekommt `highlightedChecklistItemId` Prop
  - Connector-SVG: wenn `line.assignmentId === highlightedId` → `strokeDasharray` entfernen (durchgehend) + dickere Linie
  - Timeline-Eintrag: wenn `entry.checklistItemId === highlightedId` → Ring/Highlight-Klasse auf die Card + Dot hervorheben

### 2. Frist ganz rechts

**Datei:** `ChecklistSection.tsx`

Die Frist-Anzeige (Zeilen 118-141) ist bereits im `ml-auto` Bereich. Das Problem ist, dass die Action-Buttons danach kommen. Lösung: Die Frist nach den Action-Buttons positionieren oder die Action-Buttons vor die Frist setzen. Konkret: Reihenfolge in der Flex-Row ändern — Action-Buttons vor der Frist, Frist als letztes Element mit `ml-auto`.

### 3. Timeline-Redesign: Monatsheader + kompaktes Format

**Datei:** `PlanningTimelineSection.tsx`

Statt der bisherigen Cards mit vollem Datum wird das Layout wie im Mockup:

```text
März 2026
|
● 17  Planungsbeginn
|
● 18  Einladung schreiben
|
● 27  RSVP
|
April 2026
|
● 15  Einladungen verschicken
|
● 28  RM Büro Leidig
```

- Monatsüberschriften einfügen wenn sich der Monat zwischen Einträgen ändert (oder beim ersten Eintrag)
- Datum-Anzeige: nur Tageszahl (`dd`), dann mit Gap der Titel — alles in einer Zeile
- Keine umrandete Card mehr pro Eintrag, stattdessen schlanke Zeile mit Dot

### 4. Gruppierung zeitlich naher Einträge

**Datei:** `PlanningTimelineSection.tsx`

- `MIN_ENTRY_GAP_PX` auf 8px setzen (für Same-Day oder sehr nahe Einträge)
- Einträge am gleichen Tag bekommen nur 8px Abstand
- Einträge an verschiedenen Tagen bekommen proportionalen Abstand (mindestens 24px)
- `TARGET_TIMELINE_HEIGHT_PX` dynamisch: `Math.max(400, entries.length * 40)`

### 5. Phasen in Administration (Template-Editor)

**Dateien:** `PlanningTemplateManager.tsx`, `types.ts`

Neue `TemplateItemType`: `"phase_start"` hinzufügen (neben `item`, `separator`, `system_social_media`, `system_rsvp`).

Phasen-Konzept: Ein `phase_start`-Eintrag markiert den Beginn einer Phase. Der Titel ist der Phasenname (z.B. "Planung", "Einladungen", "Event", "Nachbereitung"). Alle folgenden Items gehören zu dieser Phase, bis der nächste `phase_start` kommt.

- Button "Phase hinzufügen" neben "Trenner hinzufügen"
- Visuell: Phase als farbige Klammer links mit gedrehtem Label (wie gewünscht)
- Standard-Phasen bei neuen Templates vorschlagen

DB-Änderung: `planning_templates.template_items` ist JSON, daher kein Schema-Update nötig. Ebenso `event_planning_items.type` — hier muss der DB-Constraint erweitert werden um `phase_start`.

**Migration:** `ALTER` auf `event_planning_items` um `phase_start` als erlaubten `type`-Wert hinzuzufügen.

### 6. Phasen in Checkliste + Zeitstrahl

**Datei:** `ChecklistSection.tsx`

- Items nach Phasen gruppieren (basierend auf `phase_start` Items in der Sortierung)
- Jede Phase wird visuell mit einer vertikalen Klammer links dargestellt:
  - Vertikale Linie links neben den zugehörigen Checklistenpunkten
  - Phasenname um 90° gedreht (`writing-mode: vertical-rl; transform: rotate(180deg)`) links der Klammer
  - Dezente Farbe/Border

**Datei:** `PlanningTimelineSection.tsx`

- Im Zeitstrahl: Phasen als farbige Hintergrundbereiche oder als dezente vertikale Klammern neben den zugehörigen Einträgen
- Phasenname als kleine Label links oder als Überschrift zwischen den Monatsheadern

---

### Technische Details

| Änderung | Dateien |
|---|---|
| Hover State | `EventPlanningDetailView.tsx`, `ChecklistSection.tsx`, `PlanningTimelineSection.tsx` |
| Frist rechts | `ChecklistSection.tsx` |
| Timeline-Redesign | `PlanningTimelineSection.tsx` |
| Gruppierung | `PlanningTimelineSection.tsx` |
| Admin Phasen | `PlanningTemplateManager.tsx`, neue Migration |
| Checkliste/Timeline Phasen | `ChecklistSection.tsx`, `PlanningTimelineSection.tsx` |

