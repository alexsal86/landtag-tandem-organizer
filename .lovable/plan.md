

## Plan: Archiv für Vorgänge (Case Items)

### Überblick
Ein neuer Status `archiviert` wird zum `case_item_status`-Enum hinzugefügt. Archivierte Vorgänge werden aus der normalen Liste ausgeblendet und über ein Archiv-Sheet (analog zu NotesArchiveDialog) erreichbar. Archivierung erfolgt per Kontextmenü in der Liste und per Button in der Detailansicht.

### Änderungen

**1. Datenbank-Migration**
- `ALTER TYPE public.case_item_status ADD VALUE 'archiviert';`
- Keine Tabellenänderungen nötig, nur Enum-Erweiterung.

**2. `src/features/cases/items/components/MyWorkCaseItemsTab.tsx`**
- Archivierte Vorgänge aus `visibleItems` filtern (`.filter(row => row.status !== 'archiviert')`)
- Rechtsklick-Kontextmenü auf jede Item-Card: `ContextMenu` + `ContextMenuTrigger` wrappen die bestehende Card-`div`. Einträge: "Archivieren" (setzt Status auf `archiviert`), "Öffnen"
- Archiv-Button oben rechts (Archive-Icon) öffnet ein Sheet mit archivierten Vorgängen
- STATUS_STYLES/STATUS_LABELS um `archiviert` erweitern (grau)

**3. Neues Component: `src/features/cases/items/components/CaseItemsArchiveSheet.tsx`**
- Sheet (analog NotesArchiveDialog) zeigt archivierte Vorgänge
- Lädt `case_items` mit `status = 'archiviert'` für den aktuellen Tenant
- Jeder Eintrag hat einen "Wiederherstellen"-Button (setzt Status zurück auf `neu`)
- Einfache Liste mit Titel, Kanal, Priorität und Datum

**4. `src/features/cases/items/pages/CaseItemDetail.tsx`**
- Button "Archivieren" in der Header-Zeile (neben Zurück-Button)
- Klick setzt `status = 'archiviert'` und navigiert zurück zur Liste
- Bei archiviertem Vorgang: stattdessen "Wiederherstellen"-Button anzeigen

**5. `src/features/cases/items/hooks/useCaseItems.tsx`**
- Status-Typ um `'archiviert'` erweitern
- `archiveCaseItem(id)` Hilfsfunktion: `updateCaseItem(id, { status: 'archiviert' })`

### Dateien
- **Migration**: `case_item_status` Enum erweitern
- `src/features/cases/items/components/MyWorkCaseItemsTab.tsx` — Kontextmenü + Archiv-Button
- `src/features/cases/items/components/CaseItemsArchiveSheet.tsx` — Neues Sheet
- `src/features/cases/items/pages/CaseItemDetail.tsx` — Archiv-Button
- `src/features/cases/items/hooks/useCaseItems.tsx` — Typ-Erweiterung

