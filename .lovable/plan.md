# Phase E — UX-Polish & Konsistenz (großes Refactor)

Nachdem Phase D (Color-Tokens) abgeschlossen ist, folgt jetzt das systematische UX-Hardening über alle Module. Ziel: konsistente Wahrnehmung, vorhersehbares Verhalten, deutlich höhere wahrgenommene Qualität — ohne Business-Logik anzufassen.

## Welle 1 — Foundation Tokens (Voraussetzung für alles weitere)

**`src/index.css` & `tailwind.config.ts`** um fehlende semantische Tokens erweitern:
- **Spacing-Skala**: `--space-2xs … --space-3xl` (4/8/12/16/24/32/48/64) — alle Komponenten verwenden danach Tokens statt Magic-Numbers.
- **Radius-Tokens**: `--radius-sm/md/lg/xl/2xl` + `--radius-pill`.
- **Elevation-Tokens**: `--shadow-xs/sm/md/lg` + `--shadow-focus-ring`, `--shadow-popover`.
- **Motion-Tokens**: `--ease-standard`, `--ease-emphasized`, `--duration-fast/base/slow` + Reduced-Motion-Fallback.
- **Z-Index-Skala**: `--z-base/dropdown/sticky/overlay/modal/toast` (eliminiert ad-hoc `z-[999]`).

## Welle 2 — Standard-Komponenten für wiederkehrende Patterns

Neue zentrale Bausteine in `src/components/ui-patterns/`:
- **`EmptyState`** — Icon + Headline + Subtext + optionaler CTA. Heute ~40 unterschiedliche Empty-States in der App.
- **`LoadingState`** — Skeleton-Varianten (List/Card/Detail/Table) statt der aktuellen "Laden…"-Texte.
- **`ErrorState`** — Inline-Fehler mit Retry-Button (heute oft nur `console.error`).
- **`SectionHeader`** — Einheitlicher Listen-/Section-Header (Title + Action-Slot + Count-Badge).
- **`InlineActions`** — Hover-Action-Bar für Listenzeilen (heute uneinheitlich: mal Dreipunkt, mal Buttons, mal nur bei Selected).
- **`StatusPill`** — Konsolidiert die ~6 Status-Badge-Varianten (Tasks, Cases, Decisions, Letters, Press, Polls).

## Welle 3 — Interaktions-Konsistenz

- **Hover-States** überall: `hover:bg-muted/50` statt heute teils gar keiner, teils `hover:bg-accent`, teils Custom.
- **Focus-Visible-Ring** durchgängig auf interaktiven Elementen (a11y-Audit).
- **Mikroanimationen**: `animate-fade-in` für neu geladene Listen, `animate-scale-in` für Popover/Sheets, sanfte Slide-Übergänge für Detail-Panels (280ms `--ease-emphasized`).
- **Optimistic-UI-Indikatoren**: dezenter Pulse während Mutations laufen (statt Disable-Lock).
- **Toast-Konsistenz**: Erfolg = grün-Pill links, Fehler = rot-Pill links, neutrale Aktionen = primary. Aktuell wild gemischt.

## Welle 4 — Layout-Polish (Top-traffic Module)

Priorisiert nach täglicher Nutzung:
1. **MyWork-Dashboard** — verdichtete Padding, einheitliche Card-Höhen, bessere visuelle Hierarchie zwischen Tasks/Decisions/Appointments.
2. **Sidebar** — gleichmäßige Item-Höhen (32px), konsistente Icon-Größen (16px), aktiver Zustand mit linker Akzent-Bar statt Background-Fill.
3. **Kalender** — einheitliche Event-Pill-Höhen, bessere Kontraste in Month-View, Hover zeigt Mini-Preview-Card.
4. **Vorgänge Master-Detail** — Spacing der 340px-Liste, Detail-Header sticky, Section-Trenner statt Cards-in-Cards.
5. **Briefe Split-Editor** — Toolbar-Hierarchie, Zoom-Control persistent sichtbar.
6. **Kontakte-Liste** — Spaltenausrichtung tabular-nums durchgängig, Avatars konsistent 28px.

## Welle 5 — Detail-Pässe

- **Empty-States** in allen Modulen austauschen (~40 Stellen).
- **Loading-Skeletons** statt "Laden…"-Text (~25 Stellen).
- **Datums-/Zeit-Formatierung** über zentralen Helper (heute teils `de-DE`, teils ISO, teils custom).
- **Tooltips** auf allen Icon-Only-Buttons (a11y + Onboarding).
- **Keyboard-Shortcuts** sichtbar machen: Hint-Chips in Cmd+K, Tooltips mit `⌘K`-Style.

## Welle 6 — A11y & SEO Sweep

- `aria-label` auf allen Icon-Buttons.
- Landmark-Roles (`<nav>`, `<main>`, `<aside>`).
- Tab-Order-Audit in komplexen Panels (Briefe, Vorgänge).
- Reduced-Motion-Respektierung in allen neuen Animationen.

## Out-of-Scope (bewusst nicht in Phase E)

- Keine neuen Features.
- Keine Business-Logik-Änderungen.
- Keine DB-Migrationen.
- Keine Mobile-spezifischen Layouts (separate Phase).

## Vorgehen

Ich liefere eine Welle pro „weiter"-Runde, beginnend mit **Welle 1 (Foundation Tokens)** + **Welle 2 (Pattern-Komponenten)** zusammen, da Welle 3–6 darauf aufbauen. Nach jeder Welle Typecheck + visuelle Stichprobe.

```text
Phase E
├── Welle 1: Tokens (CSS-Variablen, Tailwind-Theme)
├── Welle 2: ui-patterns/ (EmptyState, LoadingState, ErrorState, SectionHeader, InlineActions, StatusPill)
├── Welle 3: Interaktion (Hover, Focus, Motion, Toasts)
├── Welle 4: Top-Module (MyWork, Sidebar, Kalender, Vorgänge, Briefe, Kontakte)
├── Welle 5: Empty/Loading/Tooltip-Sweep
└── Welle 6: A11y & SEO Sweep
```
