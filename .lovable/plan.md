

# Deep-Linking mit Highlight aus Dashboard-Fristen

## Problem
Beim Klick auf Items in der Fristen-Karte wird man zum richtigen Tab navigiert, aber das konkrete Element wird nicht hervorgehoben. Die bestehende Highlight-Infrastruktur (`useNotificationHighlight` + `notification-highlight` CSS-Klasse) wird bereits bei **Entscheidungen** genutzt, fehlt aber bei **Aufgaben** und **Vorgängen**.

## Änderungen

### 1. `DashboardTasksSection.tsx` — Highlight-Parameter in Navigation einfügen
Statt `navigate('/mywork?tab=tasks')` wird `navigate('/mywork?tab=tasks&highlight={item.id}')` verwendet. Gilt für alle 4 Typen (task, note, case, decision).

### 2. `MyWorkTasksTab.tsx` — Highlight-Support hinzufügen
- `useNotificationHighlight()` einbinden
- `isHighlighted(task.id)` und `highlightRef(task.id)` an die Task-Cards/Zeilen weiterreichen
- CSS-Klasse `notification-highlight` bei Match anwenden

### 3. `MyWorkCaseItemsTab.tsx` — URL-basiertes Highlight statt nur internes State
- `useNotificationHighlight()` einbinden (oder `searchParams.get('highlight')` lesen)
- Bestehendes `highlightedItemId`-State mit URL-Parameter zusammenführen
- `notification-highlight` CSS-Klasse + Auto-Scroll anwenden

### 4. Quick Notes (`capture`-Tab) — Highlight-Support prüfen/hinzufügen
- Gleiche Logik: `useNotificationHighlight()` einbinden, auf die Notiz-Karten anwenden

## Kein Handlungsbedarf
- **Entscheidungen**: Bereits vollständig implementiert mit `useNotificationHighlight`
- **`useNotificationHighlight` Hook**: Bereits vorhanden, räumt `?highlight=` nach 5s automatisch auf

