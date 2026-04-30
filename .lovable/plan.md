## Ziel
Einen weiteren `any`-Abbau-Schub durchführen, fokussiert auf die Dateien mit den meisten Treffern. Memory-Regel beachten: **Niemals `as any`** — stattdessen präzise Typen, `unknown` + Type-Guards oder `@ts-expect-error` mit Begründung.

## Scope (Welle "Top-Hits")
Die 8 Dateien mit den meisten verbliebenen `any`-Treffern (~67 Treffer gesamt):

1. `src/features/appointments/components/CreateAppointmentDialog.tsx` (14)
2. `src/features/letters/components/LetterEditor.tsx` (8)
3. `src/components/drucksachen/ProtocolViewer.tsx` (7)
4. `src/features/election-districts/components/SimpleLeafletMap.tsx` (6)
5. `src/features/documents/components/DocumentsView.tsx` (6)
6. `src/components/dashboard/WidgetConfigDialog.tsx` (6)
7. `src/components/calendar/ProperReactBigCalendar.tsx` (6)
8. `src/features/timetracking/components/AnnualTasksView.tsx` (4)
9. `src/components/contacts/DuplicateContactsSheet.tsx` (4)
10. `src/components/administration/MeetingTemplateManager.tsx` (4)

## Vorgehen pro Datei

```text
1. Treffer per rg lokalisieren
2. Pro Stelle die richtige Strategie wählen:
   - Bekannter Domain-Typ vorhanden → importieren (z. B. Database['public']['Tables'][...])
   - Externe Lib (Leaflet, react-big-calendar, Lexical) → vorhandenen Plugin-Typ oder
     präzises Interface aus src/types/*.d.ts nutzen
   - Generisches JSON aus DB → unknown + Type-Guards aus src/utils/typeSafety.ts
     (isRecord, hasOwnProperty, normalizeSupabaseResult)
   - Event-Handler → React.ChangeEvent<HTMLInputElement> etc.
3. tsc-Check pro Datei: bunx tsc -p tsconfig.app.json --noEmit
```

## Technische Leitplanken
- Kein `as any`; falls JSX-Namespace-Probleme: `import type { JSX } from 'react'`.
- Bei externen Libs ohne Typen: schmales lokales Interface in derselben Datei oder in `src/types/`.
- Supabase-Rows: `Database['public']['Tables']['<name>']['Row']` (siehe `src/integrations/supabase/types`).
- JSONB-Felder: `Json` aus Supabase-Types + Parser/Guard.
- Bestehende Helfer wiederverwenden (`typeSafety.ts`, `featureDomainTypes.ts`).

## Validierung
- `bunx tsc -p tsconfig.app.json --noEmit` muss 0 Fehler zeigen.
- `rg`-Diff: Treffer in den 10 Dateien sollten auf 0 fallen.
- Kurzer Bericht am Ende: Anzahl entfernter `any`, ggf. notwendige `@ts-expect-error` mit Grund.

## Out of Scope
- Long-tail-Dateien mit 1–3 Treffern (separate Welle).
- Test-Dateien (`__tests__`, `.test.ts`).
- Type-Definition-Dateien (`*.d.ts`).

## Erwartetes Ergebnis
~60+ `any`-Stellen entfernt, Build bleibt grün. Falls einzelne externe Lib-Stellen unvermeidbar sind, dokumentiert via `@ts-expect-error` mit kurzer Begründung statt `as any`.