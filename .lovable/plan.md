# Konsistenz-Sweep finalisieren

Ausgangslage nach Welle 1–7: `ui-patterns`, Foundation-Tokens, Typografie-System und `notify`-Wrapper stehen — werden aber noch nicht durchgängig genutzt. Scan zeigt:

- **268 Dateien** rufen `sonner`/`use-toast` direkt auf (89× sonner direkt, 179× `useToast`), **0× `notify`**.
- **67 Dateien** mit `Laden...` oder rohem `animate-pulse`-Skeleton.
- **176 Dateien** mit ad-hoc Empty-State-Text (`Noch keine …`, `Keine … gefunden`).
- **109 Dateien** mit nativem `title="…"` statt shadcn-`Tooltip`.

Ziel: konsistente Toasts, einheitliche Empty/Loading/Error-States und einheitliche Tooltips über die ganze App.

## Welle 8 — Toast-Migration auf `notify`-Wrapper

- `useToast`/`toast({ title, description, variant })` durchgängig durch `notify.success/error/warning/info` ersetzen.
- Direkte `import { toast } from "sonner"`-Aufrufe ebenfalls auf `notify` umstellen.
- `variant: "destructive"` → `notify.error`, sonst `notify.success`/`info`.
- In Batches nach Bereich abarbeiten: `features/tasks` → `features/letters` → `features/contacts` → `features/employees` → `features/redaktion` → `features/calendar` → `features/knowledge` → `features/timetracking` → `pages/*` → `hooks/*` → `components/*`.
- Memory-Eintrag erweitern: „Immer `@/lib/notify` statt direktem sonner/useToast".

## Welle 9 — Empty/Loading/Error-Sweep Restbestand

- Verbleibende `Laden...`-Texte und `animate-pulse`-Skeletons durch `<LoadingState variant="list|card|table|detail|inline" />` ersetzen.
- Ad-hoc Empty-States (`Noch keine …`, „Keine … gefunden") durch `<EmptyState icon={…} title description />` ersetzen — passende Lucide-Icons je Domäne.
- Fehler-Pfade (Toast-only oder roter Text) durch `<ErrorState onRetry={…} />` ersetzen, wo eine Retry-Action sinnvoll ist.
- Bereiche: `features/calendar`, `features/employees`, `features/redaktion`, `features/knowledge`, `features/timetracking`, `features/letters` (Listen, Sidebars, Editor-Panels), `features/meetings`, restliche Widgets.

## Welle 10 — Tooltip-Konsistenz

- Native `title="…"`-Attribute auf Buttons/Icons durch shadcn `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>` ersetzen.
- Sicherstellen, dass `TooltipProvider` einmal global im App-Root sitzt; dann lokale Provider entfernen.
- `title=` nur dort lassen, wo es Accessibility-Backup für native Form-Controls ist (Inputs, Selects ohne Visual Trigger).

## Reihenfolge & Verifikation

1. Welle 8a: `features/tasks` + `features/letters` + `pages/*` (Toast).
2. Welle 8b: `features/contacts` + `features/employees` + `features/redaktion` + restliche.
3. Welle 9a: `features/calendar` + `features/employees` + `features/meetings`.
4. Welle 9b: `features/redaktion` + `features/knowledge` + `features/timetracking` + Widgets.
5. Welle 10: Tooltips (in einem Rutsch, eher mechanisch).

Nach jeder Welle: `bunx tsc --noEmit` + Spot-Check Preview. Memory-Index aktualisieren, sobald `notify` Pflicht ist.

## Out of Scope

- Performance/Bundle, Mobile-Sweep, Resilienz/RLS — eigene Hebel, nicht Teil dieses Plans.
- Funktionale Logik bleibt unverändert; rein Presentation-Layer.
