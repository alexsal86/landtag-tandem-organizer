# Follow-up-Liste: Nächste Strictness-Stufe

Stand: 2026-03-25

## Bereits umgesetzt in diesem Schritt

1. **Typduplikate nach Merge-Konflikten konsolidiert**
   - Protokoll-Domänentypen in `src/types/protocol.ts` zusammengeführt.
2. **Gemeinsame Typen in zentrale Module verschoben**
   - JSON- und PDF-Parser nutzen dieselben Domain-Typen.
3. **Adapter-/Guard-Helfer vereinheitlicht**
   - Wiederverwendbare Guards in `src/utils/protocolGuards.ts` gebündelt.
4. **Lint-/Typecheck-Laufzeiten vorbereitet**
   - Parallelisierbarer Typecheck-Runner (`scripts/run-typecheck-batches.mjs`).
   - Cache-freundlicher Lint-Entry (`npm run lint:cached`).

## Nächste Schritte für strengere Regeln

- [ ] `strictNullChecks` im Protokoll-Import-End-to-End-Scope aktivieren und grün halten.
- [ ] `noImplicitAny` für alle Parser-Nebenpfade (inkl. Error-/Fallback-Pfade) abschließen.
- [ ] `@typescript-eslint/no-unsafe-*` schrittweise für Parser-Cluster auf warn/block umstellen.
- [ ] `ProtocolAgendaItem.speakers` von `unknown[]` auf dedizierte Speaker-Struktur umstellen.
- [ ] JSON-Parser-Metadaten (`statistics`) von `unknown` auf präzises DTO migrieren.
- [ ] Parallel-Typecheck in CI mit konservativer Concurrency (`TYPECHECK_CONCURRENCY=3`) pilotieren.
- [ ] Nach stabiler CI: `lint` auf `--cache` standardisieren und ungecachte Variante als `lint:clean` behalten.
