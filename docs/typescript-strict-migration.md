# TypeScript Strict Migration Plan (Hooks / Pages / Services)

## Ziel & Priorisierung

Diese Migration fokussiert die Verzeichnisse mit hoher Änderungsrate:

1. `src/hooks/`
2. `src/pages/`
3. `src/services/`

Die Migrationslogik folgt pro Bereich drei Batches mit jeweils **einem** zusätzlichen Schalter:

- **Batch 1:** `strictNullChecks`
- **Batch 2:** `noImplicitAny`
- **Batch 3:** `noUnusedLocals` + `noUnusedParameters`

## Batch-Configs & Commands

### Hooks

- Batch 1: `tsconfig.hooks-batch1-strict.json` → `npm run typecheck:hooks-batch1`
- Batch 2: `tsconfig.hooks-batch2-strict.json` → `npm run typecheck:hooks-batch2`
- Batch 3: `tsconfig.hooks-batch3-strict.json` → `npm run typecheck:hooks-batch3`

### Pages

- Batch 1: `tsconfig.pages-strict.json` → `npm run typecheck:pages-batch1`
- Batch 2: `tsconfig.pages-batch2-strict.json` → `npm run typecheck:pages-batch2`
- Batch 3: `tsconfig.pages-batch3-strict.json` → `npm run typecheck:pages-batch3`

### Services

- Batch 1: `tsconfig.services-features-strict.json` → `npm run typecheck:services-batch1`
- Batch 2: `tsconfig.services-features-batch2-strict.json` → `npm run typecheck:services-batch2`
- Batch 3: `tsconfig.services-features-batch3-strict.json` → `npm run typecheck:services-batch3`

## CI-Integration (schrittweise)

Aktuelle Integration im Job `node-quality-gates`:

- Stage 1 ist aktiv:
  - `npm run typecheck:hooks-batch1`
  - `npm run typecheck:pages-batch1`
  - `npm run typecheck:services-batch1`

Empfohlene nächste Schritte:

1. Batch-2-Checks als nicht-blockierenden Schritt ergänzen (nur Sichtbarkeit).
2. Batch-2 nach Stabilisierung blockierend machen.
3. Dasselbe Muster für Batch-3 wiederholen.

## Migrationsregel (verbindlich)

- **Neue oder geänderte Dateien in einem aktiven Batch müssen strict-clean sein.**
- Legacy-Dateien außerhalb des aktiven Batch-Scope dürfen vorübergehend abweichen, aber nur mit dokumentierter Ausnahme.

### Ausnahme-Dokumentation (temporär)

Ausnahmen werden in PR-Beschreibungen oder einem technischen Schulden-Log dokumentiert mit:

- Datei
- Grund
- geplanter Ziel-Batch
- Zieltermin

## Fortschrittsmetrik

Die Metrik ist der Anteil strict-geprüfter Dateien pro Verzeichnis und Batch-Stufe.

- Command: `npm run report:strict-progress`
- Quelle: Batch-`tsconfig`-Includes gegenüber allen `*.ts`/`*.tsx` im Zielverzeichnis.
- Aktueller Snapshot: `docs/strict-progress.md`.

