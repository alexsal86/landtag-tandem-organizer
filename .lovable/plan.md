

# Navigation-Redesign: Notion-Style Sidebar

## Ubersicht
Die aktuelle Navigation ist eine schmale 72px Icon-Leiste mit Text darunter. Der Umbau orientiert sich am Notion-Layout: breitere, helle Sidebar mit Icons links neben Text, resizable per Drag, Schnellzugriff-Buttons oben und ein personlicher Favoriten-Bereich.

## Betroffene Dateien
- `src/components/AppNavigation.tsx` — komplett umbauen
- `src/pages/Index.tsx` — Layout-Wrapper anpassen (resizable nav)
- `src/index.css` — Nav-Farbvariablen auf hell umstellen
- `src/components/layout/SubNavigation.tsx` — moglicherweise entfernen/integrieren (Sub-Items werden inline in der Sidebar angezeigt)
- Neuer Hook: `src/hooks/useNavWidth.ts` — Breite persistent speichern
- Neuer Hook/Komponente: `src/hooks/useQuickAccessPages.ts` — Schnellzugriff-Seiten verwalten

## 1. Resizable Sidebar mit Drag-Handle

**`src/hooks/useNavWidth.ts`** (neu):
- Breite in `localStorage` persistieren (wie `useUserPreference`)
- Default: 240px, Min: 200px, Max: 400px
- Expose: `width`, `setWidth`, `isResizing`

**`src/pages/Index.tsx`**:
- Statt fester `w-[72px]` Nav-Wrapper: dynamische Breite aus Hook
- Resizer-Div (4px breit, cursor-col-resize) zwischen Nav und Content
- `onMouseDown` → `mousemove` Listener fur Drag, clamped auf Min/Max

## 2. Quick-Action-Buttons uber "Meine Arbeit"

Oberhalb des "Meine Arbeit"-Eintrags kommen 4-5 kleine runde Buttons in einer Zeile:
- **Home** (Dashboard)
- **Benachrichtigungen** (Bell — aus Header verschoben)
- **Akten/Fall** (Briefcase — Schnellzugriff auf Fallakten)
- **Suche** (Search — offnet globale Suche)

Verhalten wie Notion:
- Im Normalzustand nur das Icon sichtbar (rund, 28px)
- Bei Hover/Klick expandiert ein Tooltip oder kleiner Label
- Diese Buttons sind in einer horizontalen Leiste oberhalb der Nav-Items

## 3. Icon + Text nebeneinander (horizontal)

Aktuell: `flex-col items-center` mit Icon oben, 10px Text darunter.
Neu: `flex-row items-center gap-2` mit Icon links (16px) und Text rechts (13px), beides gleich hoch.

```text
Vorher:          Nachher:
  [Icon]         [Icon] Meine Arbeit
  Text           [Icon] Chat
                 [Icon] Kalender
```

- Sub-Items werden inline darunter eingeruckt angezeigt (wie Notion-Seitenbaum)
- Aktive Gruppe ist aufgeklappt, andere zugeklappt
- Collapsible-Gruppen mit ChevronRight/Down

## 4. Schnellzugriff-Bereich (Personliche Favoriten)

**`src/hooks/useQuickAccessPages.ts`** (neu):
- Array von `{ id, label, icon, route }` in `localStorage` speichern
- CRUD-Operationen: add, remove, reorder
- Default: leer

In der Sidebar unter den System-Nav-Items:
- Abschnitt "Schnellzugriff" mit kleiner Uberschrift
- Darunter die gepinnten Seiten als klickbare Links
- "+ Seite hinzufugen" Button offnet ein Popover mit verfugbaren Sections
- Drag & Drop fur Reihenfolge (optional, spater)

## 5. Heller Hintergrund + sichtbare Grenzlinie

**`src/index.css`** — Nav-Variablen andern:

Light Mode:
```css
--nav: 0 0% 97%;              /* Sehr helles Grau wie Notion */
--nav-foreground: 0 0% 15%;   /* Dunkler Text */
--nav-accent: 0 0% 90%;
--nav-hover: 0 0% 93%;
--nav-active-bg: 0 0% 90%;
--nav-muted: 0 0% 55%;
```

Dark Mode:
```css
--nav: 220 10% 12%;
--nav-foreground: 210 20% 85%;
--nav-hover: 220 10% 16%;
--nav-active-bg: 220 10% 20%;
```

Border rechts: `border-r border-border` (sichtbarer als aktuell `border-[hsl(var(--nav-foreground)/0.1)]`)

**AppHeader**: Muss ebenfalls auf hellen Hintergrund umgestellt werden, da Header und Nav aktuell dieselbe dunkle Farbe teilen. Header wird `bg-background border-b border-border`.

## 6. Build-Errors fixen

Die Edge-Function-Fehler (`matrix-bot-handler`, `matrix-decision-handler`, `send-matrix-morning-greeting`, `sync-external-calendar`) haben alle dasselbe Problem: ein Semikolon nach der schliessenden Klammer von `serve(...)`. Das muss zu einem Komma oder entfernt werden. Diese sind pre-existing, werden aber gleich mitgefixt.

## Technische Details

**Resize-Mechanik**:
```text
[Nav: 240px resizable] | [4px drag handle] | [Content: flex-1]
```
- `mousedown` auf Handle startet Resize
- `mousemove` updated width (clamped 200-400)
- `mouseup` beendet Resize, speichert in localStorage
- Wahrend Resize: `select-none` auf Body, `cursor-col-resize` global

**Nav-Item-Struktur** (neu):
```text
┌─────────────────────────────┐
│ [Logo]  Workspace-Name      │
├─────────────────────────────┤
│ [🏠] [🔔] [📁] [🔍]       │  ← Quick Actions
├─────────────────────────────┤
│ 🏠 Meine Arbeit             │  ← Nav Items horizontal
│ 💬 Chat                     │
│ 📅 Kalender                 │
│   ├ Terminkalender           │  ← Sub-Items eingeklappt
│   └ Planungen                │
│ ✅ Aufgaben                  │
│   ├ Aufgaben                 │
│   ├ Entscheidungen           │
│   └ Jour fixe                │
│ 📁 Akten                    │
│ 👥 Kontakte                 │
│ ⋯ Mehr                      │
├─────────────────────────────┤
│ Schnellzugriff               │  ← Personliche Favoriten
│ + Seite hinzufugen           │
├─────────────────────────────┤
│ 🛡️ Admin                    │  ← Footer
│ ❓ Hilfe                     │
│ 👤 Team                     │
└─────────────────────────────┘
```

