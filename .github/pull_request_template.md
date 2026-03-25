## Zusammenfassung

- 

## Any-Delta vorher/nachher (Pflicht)

- **Scope:** `<betroffene Verzeichnisse/Dateien>`
- **Any-Total vorher (Base):** `<zahl>`
- **Any-Total nachher (Head):** `<zahl>`
- **Delta (Head - Base):** `<zahl>`
- **Einordnung:** `<z. B. Reduktion / neutral / begründete Interop-Ausnahme>`

## Tests / Checks

- [ ] `npm run lint`
- [ ] `npm run typecheck:strict-all`
- [ ] Relevante Unit-/Integrations-/E2E-Tests ausgeführt
- [ ] `npm run --silent report:any-usage:total` (vorher/nachher dokumentiert)

## Type-Sicherheit (Pflicht)

- [ ] Wurden neue `any` eingeführt?
  - Wenn **ja**: betroffene Datei(en), Begründung, Owner und Zieltermin angeben.
  - Wenn **ja**: jede neue Ausnahme als `INTEROP-ANY: Grund + Ticket + Sunset-Termin` inline markieren.
  - Wenn **nein**: kurz bestätigen, dass keine neuen unkommentierten `any` enthalten sind.

## Dokumentations-Update

- [ ] `docs/strict-progress.md` oder passendes Batch-Dokument aktualisiert (falls Scope betroffen)
- [ ] Baseline nach Merge neu gemessen und dokumentiert (`report:any-usage:total`, `report:any-usage:clusters`, `report:any-usage:files`)
