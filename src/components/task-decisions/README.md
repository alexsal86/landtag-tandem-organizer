# task-decisions module

## Zielzustand (Stand: 2026-03)

- `TaskDecisionList.tsx` wurde entfernt, weil die Komponente im aktuellen Routing/Flow nicht mehr referenziert wurde.
- Die aktive Entscheidungs-UI läuft über:
  - `src/components/my-work/MyWorkDecisionsTab.tsx` (MyWork-Tab)
  - `src/components/task-decisions/DecisionOverview.tsx` (Legacy/Standalone-Seite)
  - `src/components/task-decisions/TaskDecisionCreator.tsx` / `StandaloneDecisionCreator.tsx` (Erstellung)
- Antworttypen und Topics werden ausschließlich über die template-basierte Datenstruktur (`response_options`, Topic-Verknüpfungen) in den oben genannten Flows gepflegt.

## Entscheidungsdokumentation

`TaskDecisionList` enthielt eine ältere Ja/Nein/Rückfrage-Logik ohne vollständige Template-Antworttypen- und Topic-Ausrichtung wie in den aktuellen Creator-/Overview-Flows.
Da es keine Importe/Nutzung im App-Flow gab, wurde die Komponente entfernt statt weiter angepasst.

Damit gibt es einen klaren Zielzustand: **eine konsolidierte Entscheidungsdarstellung über die MyWork-/Overview-Komponenten, ohne parallelen Legacy-Listenpfad**.
