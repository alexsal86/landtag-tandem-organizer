## Zusammenfassung

- 

## PR-Zuschnitt (Pflicht)

- [ ] Kleine PR (Richtwert: **max. 10–20 Dateien**)
- [ ] Genau **ein Themencluster** in diesem PR (z. B. nur Letter oder nur Matrix/Context)

## Tests / Checks

- [ ] `npm run lint`
- [ ] `npm run typecheck:strict-all`
- [ ] Relevante Unit-/Integrations-/E2E-Tests ausgeführt

## Type-Sicherheit (Pflicht)

- [ ] Wurden neue `any` eingeführt?
  - Wenn **ja**: betroffene Datei(en), Begründung, Owner und Zieltermin angeben.
  - Wenn **nein**: kurz bestätigen, dass keine neuen unkommentierten `any` enthalten sind.
- [ ] Reviewer-Startfrage wurde zuerst beantwortet: **„Wurden neue `any` eingeführt?“**

## Dokumentations-Update

- [ ] `docs/strict-progress.md` oder passendes Batch-Dokument aktualisiert (falls Scope betroffen)
- [ ] Falls dies der **3. Merge** seit letztem Stabilisierungsschritt ist: kurzer Stabilisierungs-PR für Typduplikate eingeplant/verlinkt
