

# Plan: Vorgänge-Workspace auf 50/50 Split-Layout umbauen

## Aktueller Zustand

Das Layout ist `grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]` — eine schmale linke Spalte mit allen Vorgängen + FallAkten gemischt, und ein breites Detailpanel rechts. Die Trennung zwischen Vorgängen und Akten ist nur durch Überschriften innerhalb einer einzigen ScrollArea.

## Neues Layout

Zwei gleichbreite Spalten (50/50):
- **Links: Vorgänge** — Alle Einzelvorgänge und verknüpften Vorgänge als Liste mit Suchfeld und "Vorgang erstellen"-Button
- **Rechts: FallAkten** — Alle FallAkten als Liste mit "FallAkte erstellen"-Button

Beim Klick auf einen Vorgang oder eine Akte öffnet sich das Detail entweder als Sheet/Sidebar (konsistent mit dem bestehenden Split-Layout-Pattern) oder inline expandierend.

## Umsetzung

### 1. Grid-Layout ändern
`grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]` → `grid-cols-2` (50/50)

### 2. Linke Spalte: Nur Vorgänge
- Header: "Vorgänge" mit Suchfeld + "Vorgang erstellen"-Button
- Statistik-Leiste: Nur Vorgänge-relevante Stats (Alle, Offen, Einzelvorgänge)
- ScrollArea: Alle `filteredCaseItems` (unlinked + linked), gruppiert nach Status oder chronologisch
- Bei verknüpften Vorgängen: kleiner Badge/Link zur zugehörigen Akte

### 3. Rechte Spalte: Nur FallAkten
- Header: "FallAkten" mit "FallAkte erstellen"-Button
- Alle FallAkten laden (nicht nur verknüpfte) — separate Query für alle Akten des Tenants
- Jede Akte zeigt: Titel, Aktenzeichen, Status, Anzahl verknüpfter Vorgänge
- Klick öffnet Detail-Sheet oder navigiert zur Vollansicht

### 4. Detail-Anzeige
- Vorgang-Klick: Sheet von links mit Vorgang-Details + Link zur Akte falls verknüpft
- Akte-Klick: Sheet von rechts mit CaseFileDetail-Komponente

### 5. Alle FallAkten laden
Aktuell werden nur FallAkten geladen, die mit geladenen Vorgängen verknüpft sind. Neue separate Query für alle aktiven FallAkten des Tenants.

### 6. Mobile
Bestehendes Sheet-Pattern beibehalten für mobile Detailansicht.

## Weitere Vorschläge

Zusätzlich zum Layout-Umbau würde ich folgendes vorschlagen:

1. **Drag & Drop**: Vorgänge per Drag auf eine Akte ziehen, um sie zu verknüpfen
2. **Status-Filter**: Tabs oder Dropdown zum Filtern nach Status (offen/wartend/abgeschlossen)
3. **Kanban-Ansicht**: Toggle zwischen Listen- und Kanban-Board für Vorgänge
4. **Schnellaktionen**: Inline-Buttons für Status ändern, Priorität setzen, zuweisen
5. **Verknüpfungsanzeige**: Visuelle Linien oder Badges, die zeigen welche Vorgänge zu welcher Akte gehören

