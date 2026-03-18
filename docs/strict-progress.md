# Strict-Migrationsfortschritt

## Migrationsboard

| Welle | Scope | Referenzen für Zuschnitt | Owner | Ziel-Datum | Done-Definition |
|---|---|---|---|---|---|
| Welle 1 | `src/hooks/**` mit Schwerpunkt auf `useAuth.tsx`, `useTenant.tsx`, `useNotifications.tsx`, `useLetterArchiving.tsx` sowie weiteren Hooks mit Supabase-, Routing- oder Tenant-Logik. | `tsconfig.hooks-batch1-strict.json`, `tsconfig.hooks-batch2-strict.json`, `tsconfig.hooks-batch3-strict.json`; Skripte `npm run typecheck:auth`, `npm run typecheck:notifications`, `npm run typecheck:hooks-batch1`, `npm run typecheck:hooks-batch2`. | Frontend Platform | 2026-04-08 | Alle priorisierten Hooks laufen mindestens mit `strictNullChecks` und `noImplicitAny`; Auth-/Tenant-/Notification-Flows sind ohne neue `@ts-ignore`-Kommentare typisiert; die referenzierten Hook-Typechecks laufen grün; offene Restarbeiten sind als konkrete Follow-ups pro Datei dokumentiert. |
| Welle 2 | `src/services/**` und `src/features/**`, insbesondere Module mit API-Verträgen, Domain-Transformationen und Statuslogik. | `tsconfig.services-features-strict.json`, `tsconfig.services-features-batch2-strict.json`, `tsconfig.services-features-batch3-strict.json`; Skripte `npm run typecheck:services-features`, `npm run typecheck:strict-all`. | Domain Architecture | 2026-04-22 | Services/Features mit Vertrags- oder Transformationslogik laufen mindestens unter `strictNullChecks`; identifizierte Batch-2/3-Dateien erfüllen zusätzlich `noImplicitAny` bzw. `noUnusedLocals`/`noUnusedParameters`; Status- und Mapping-Pfade haben explizite Typgrenzen für Eingaben/Ausgaben; der Services/Features-Typecheck läuft grün. |
| Welle 3 | Große Top-Level-Komponenten in `src/components/**`, vor allem Komponenten mit vielen Hook-Kombinationen oder komplexen Props/Callbacks. | `tsconfig.components-toplevel-strict.json` plus die vorhandenen Batch-Dateien `tsconfig.components-batch1-strict.json` bis `tsconfig.components-batch4-strict.json`; Skripte `npm run typecheck:components-toplevel`, `npm run typecheck:strict-all`. | App Shell | 2026-05-06 | Alle ausgewählten Top-Level-Komponenten kompilieren im jeweiligen Strict-Scope ohne zusätzliche Typ-Ausnahmen; Props, Callback-Signaturen und abgeleitete View-Modelle sind explizit typisiert; gemeinsam genutzte Hook-Kombinationen sind stabilisiert oder extrahiert; der Top-Level-Components-Typecheck läuft grün und verbleibende Problemfälle sind mit Folgewelle und Besitzer markiert. |

## Fortschritt nach Verzeichnis

| Verzeichnis | TS/TSX-Dateien gesamt | Batch 1 (`strictNullChecks`) | Batch 2 (`noImplicitAny`) | Batch 3 (`noUnusedLocals`/`noUnusedParameters`) |
|---|---:|---:|---:|---:|
| hooks (src/hooks) | 93 | 22 (23.7%) | 47 (50.5%) | 3 (3.2%) |
| pages (src/pages) | 22 | 22 (100.0%) | 3 (13.6%) | 2 (9.1%) |
| services-features (src/services, src/features) | 42 | 42 (100.0%) | 3 (7.1%) | 2 (4.8%) |
