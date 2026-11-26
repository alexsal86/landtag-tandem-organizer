#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAST_RUNS_FILE } from './build-feature-catalog.mjs';

/**
 * Spiegelt exportierte Selbsttest-Läufe in den Funktionskatalog.
 *
 * Quelle ist der JSON-Export des Selbsttest-Centers (`selbsttests-….json`, Feld `runs`).
 * Je Szenario zählt der zuletzt beendete Lauf; daraus entsteht `src/features/selftest/last-runs.json`.
 * `build-feature-catalog.mjs` liest diese Datei und zeigt das importierte Ergebnis statt eines
 * gepflegten Katalogwerts; ohne Datei bleibt der Katalog bei seinen deklarierten Ergebnissen.
 *
 * Aufruf:
 *   npm run sync:selftest-results -- <export.json>
 */

const RESULT_BY_STATUS = {
  ok: 'bestanden',
  failed: 'fehlgeschlagen',
  blocked: 'voraussetzung-fehl',
  cancelled: 'uebersprungen',
};

const time = (value) => {
  const parsed = typeof value === 'number' ? value : Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : -Infinity;
};

export function toLastRuns(exported, sourceFile) {
  if (!exported || !Array.isArray(exported.runs)) throw new Error('Export enthält keine runs-Liste.');
  const latest = new Map();
  const skipped = [];
  for (const run of exported.runs) {
    if (typeof run?.scenarioId !== 'string' || !RESULT_BY_STATUS[run.status]) {
      skipped.push(run?.scenarioId ?? '(ohne Szenario)');
      continue;
    }
    const current = latest.get(run.scenarioId);
    if (!current || time(run.finishedAt ?? run.startedAt) > time(current.finishedAt ?? current.startedAt)) latest.set(run.scenarioId, run);
  }
  const unfinished = skipped.filter((id) => !latest.has(id));
  const runs = [...latest.values()]
    .map((run) => ({
      scenarioId: run.scenarioId,
      scenarioTitle: run.scenarioTitle ?? run.scenarioId,
      status: run.status,
      result: RESULT_BY_STATUS[run.status],
      finishedAt: Number.isFinite(time(run.finishedAt)) ? new Date(time(run.finishedAt)).toISOString() : null,
      buildVersion: run.buildVersion ?? null,
      mode: run.mode ?? null,
      failedSteps: run.failedSteps ?? (run.steps ?? []).filter((step) => step.status === 'failed').length,
      totalSteps: run.totalSteps ?? (run.steps ?? []).length,
      steps: (run.steps ?? []).map((step) => ({
        id: step.step?.id ?? step.id,
        label: step.step?.label ?? step.label ?? '',
        kind: step.step?.kind ?? step.kind ?? 'db',
        status: step.status,
      })),
    }))
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: { file: basename(sourceFile), exportedAt: exported.exportedAt ?? null, runCount: exported.runs.length },
    skipped: unfinished,
    runs,
  };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const source = resolve(process.argv[2] ?? 'selbsttests.json');
  if (!existsSync(source)) {
    console.error(`[sync-selftest-results] Exportdatei fehlt: ${source}`);
    console.error('Aufruf: npm run sync:selftest-results -- <export.json>');
    process.exitCode = 1;
  } else {
    let report;
    try {
      report = toLastRuns(JSON.parse(readFileSync(source, 'utf8')), source);
    } catch (error) {
      console.error(`[sync-selftest-results] ${error.message}`);
      process.exitCode = 1;
    }
    if (report) {
      writeFileSync(resolve(process.cwd(), LAST_RUNS_FILE), JSON.stringify(report, null, 2) + '\n');
      console.log(`[sync-selftest-results] ${report.runs.length} Szenarien aus ${report.source.file} nach ${LAST_RUNS_FILE} geschrieben.`);
      for (const run of report.runs) console.log(`  ${run.result.padEnd(18)} ${run.scenarioId} (${run.finishedAt ?? 'ohne Zeitstempel'})`);
      if (report.skipped.length) console.log(`  übersprungen (nicht beendet): ${report.skipped.join(', ')}`);
      console.log('Danach `npm run update:feature-catalog` ausführen, damit die Doku das Ergebnis übernimmt.');
    }
  }
}
