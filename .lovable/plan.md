

## Plan: Redesign Vorgänge als Master-Detail Layout

### Ziel
Die Vorgänge-Ansicht wird von einem 80/20 Grid (Vorgänge links, Fallakten rechts) zu einem **Master-Detail Layout** umgebaut — wie im Screenshot: Links eine kompakte Vorgangsliste, rechts eine vollständige Detailansicht des ausgewählten Vorgangs. Fallakten werden als Slide-In Panel (Sheet) statt als permanente Spalte dargestellt.

### Aktueller Zustand
- `MyWorkCasesWorkspace` rendert ein `CasesWorkspaceShell` mit 80/20 Grid
- Links: `CaseItemList` (Vorgänge mit inline Expand-Detail via `CaseItemDetailPanel`)
- Rechts: `CaseFileList` (Fallakten-Spalte, Drag&Drop-Targets)
- Detailansicht klappt innerhalb der Liste auf (Accordion-Stil)

### Neue Struktur

```text
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb · Suche · Filter · + Neuer Vorgang           │
├──────────────┬──────────────────────────────────────────┤
│ Vorgangsliste│  Detail: Titel, Status, Kontakt          │
│ (Karten)     │  ┌────────────────────────────────────┐  │
│              │  │ Tabs: Übersicht · Timeline ·       │  │
│ • Vorgang 1  │  │       Dokumente · Fallakten        │  │
│ • Vorgang 2  │  │                                    │  │
│ • Vorgang 3  │  │ [Inhalt des aktiven Tabs]          │  │
│              │  └────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────┘

Fallakten-Tab → öffnet Sheet/Slide-In bei Klick
```

---

### Änderungen

**1. Neues Layout-Shell: `CasesWorkspaceShell.tsx`**
- Grid ändern zu: `grid-cols-[360px_1fr]` (schmale Liste links, Detail rechts)
- DragDropContext beibehalten für Fallakten-Zuordnung
- Header-Zeile mit Breadcrumb ("Redesign · Master-Detail Layout / **Vorgänge**"), Suchfeld, Filter-Button, "+ Neuer Vorgang"-Button

**2. Neue Vorgangsliste: `CaseItemList.tsx` komplett umbauen**
- Schmale Karten-Ansicht statt breiter Grid-Zeilen
- Jede Karte zeigt: farbiger Punkt (Status), Titel (fett), Beschreibung (1 Zeile), Fälligkeit, Status-Badge, Aktenzeichen
- Aktiver Vorgang wird hervorgehoben (gelber linker Rand wie im Screenshot)
- Archiv-Button oben rechts in der Liste
- Kein inline-Detail mehr — Klick setzt `detailItemId` und zeigt rechts

**3. Neues Detail-Panel: `CaseItemDetailView.tsx` (neue Datei)**
- Wird rechts angezeigt wenn ein Vorgang ausgewählt ist
- **Header**: Breadcrumb ("Vorgang · Petition Karl Kinski"), großer Titel, daneben Stammdaten-Badges (Fälligkeit, Status, Kontakt)
- **Beschreibung**: Unter dem Titel
- **Tabs** (Übersicht, Timeline, Dokumente, Fallakten):
  - **Übersicht**: Stammdaten-Karte (Name, E-Mail, Telefon, Beschreibung) mit "Bearbeiten"-Button — adaptiert aus `CaseItemDetailPanel`
  - **Timeline**: Chronologischer Verlauf mit Filter-Chips (Alle, Anruf, Mail, Treffen) — adaptiert aus bestehender Timeline-Logik
  - **Dokumente**: Dokumente des Vorgangs
  - **Fallakten**: Verknüpfte Fallakten anzeigen + Button "Fallakte öffnen" → Sheet

**4. Fallakten als Slide-In Sheet**
- `CaseFileList` wird nicht mehr als permanente Spalte gerendert
- Stattdessen: Im "Fallakten"-Tab oder über einen Button öffnet sich ein `Sheet` (von rechts) mit der Fallakten-Liste und -Detail
- `CaseFileDetail` wird im Sheet gerendert (bereits vorhanden)

**5. `MyWorkCasesWorkspace.tsx` anpassen**
- Layout-Logik umstellen: Kein `left`/`right` mehr, sondern Liste + konditionaler Detail-Bereich
- `detailPanelForItem` entfernen (kein inline-expand mehr)
- Detail wird immer rechts gerendert basierend auf `detailItemId`
- `detailFileId` öffnet jetzt ein Sheet statt die ganze Ansicht zu ersetzen

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/my-work/cases/workspace/CasesWorkspaceShell.tsx` | Layout zu Master-Detail Grid |
| `src/components/my-work/cases/workspace/CaseItemList.tsx` | Kompakte Karten-Liste |
| `src/components/my-work/cases/workspace/CaseItemDetailView.tsx` | **Neu** — Detail-Panel mit Tabs |
| `src/components/my-work/MyWorkCasesWorkspace.tsx` | Layout-Orchestrierung anpassen, Sheet für Fallakten |
| `src/components/my-work/cases/workspace/CaseFileList.tsx` | In Sheet wrappen |

### Nicht betroffen
- `CaseItemDetailPanel.tsx` — Logik wird in `CaseItemDetailView` wiederverwendet
- Datenlogik (`useCaseWorkspaceData`, `useCaseItemEdit`) — bleibt unverändert
- Dialoge (`CaseWorkspaceDialogs`) — bleiben unverändert

