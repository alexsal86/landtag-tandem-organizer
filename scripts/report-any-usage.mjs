#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DIRS = ['src', 'supabase/functions'];
const TS_GLOBS = ['*.ts', '*.tsx', '*.mts', '*.cts'];

const PATTERNS = {
  colonAny: /:\s*any\b/g,
  asAny: /\bas\s+any\b/g,
  anyArray: /\bany\s*\[\s*\]/g,
  mapStringAny: /\bMap\s*<\s*string\s*,\s*any\s*>/g,
};

const CLUSTERS = {
  components: ['src/components/'],
  hooks: ['src/hooks/'],
  utils: ['src/utils/'],
  'services/features': ['src/services/', 'src/features/'],
};

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
  const args = {
    dirs: [...DEFAULT_DIRS],
    ref: null,
    json: false,
    totalOnly: false,
    clusterSummary: false,
    fileSummary: false,
    topFiles: 15,
  };

  for (const arg of argv) {
    if (arg.startsWith('--dirs=')) {
      args.dirs = arg
        .slice('--dirs='.length)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--ref=')) {
      args.ref = arg.slice('--ref='.length).trim() || null;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--total-only') {
      args.totalOnly = true;
    } else if (arg === '--cluster-summary') {
      args.clusterSummary = true;
    } else if (arg === '--file-summary') {
      args.fileSummary = true;
    } else if (arg.startsWith('--top-files=')) {
      const parsed = Number.parseInt(arg.slice('--top-files='.length), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        args.topFiles = parsed;
      }
    }
  }

  return args;
}

function escapePath(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function listFilesFromWorkingTree(dirs) {
  const globArgs = TS_GLOBS.map((glob) => `-g '${glob}'`).join(' ');
  const dirArgs = dirs.map(escapePath).join(' ');
  if (!dirArgs) return [];

  const output = run(`rg --files ${dirArgs} ${globArgs}`);
  return output ? output.split('\n').filter(Boolean) : [];
}

function listFilesFromGitRef(ref, dirs) {
  const dirArgs = dirs.map(escapePath).join(' ');
  if (!dirArgs) return [];

  const output = run(`git ls-tree -r --name-only ${escapePath(ref)} -- ${dirArgs}`);
  return output
    .split('\n')
    .filter(Boolean)
    .filter((file) => TS_GLOBS.some((glob) => file.endsWith(glob.slice(1))));
}

function readContent(file, ref) {
  if (!ref) {
    return fs.readFileSync(file, 'utf8');
  }

  return run(`git show ${escapePath(`${ref}:${file}`)}`);
}

function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function getCluster(file) {
  for (const [cluster, prefixes] of Object.entries(CLUSTERS)) {
    if (prefixes.some((prefix) => file.startsWith(prefix))) {
      return cluster;
    }
  }

  return 'other';
}

function emptyCounter() {
  return {
    colonAny: 0,
    asAny: 0,
    anyArray: 0,
    mapStringAny: 0,
    total: 0,
  };
}

function addCounts(counter, counts) {
  counter.colonAny += counts.colonAny;
  counter.asAny += counts.asAny;
  counter.anyArray += counts.anyArray;
  counter.mapStringAny += counts.mapStringAny;
  counter.total += counts.total;
}

function summarize(files, ref) {
  const byDirectory = new Map();
  const byCluster = new Map();
  const byFile = new Map();

  for (const file of files) {
    let content = '';
    try {
      content = readContent(file, ref);
    } catch {
      continue;
    }

    const counts = {
      colonAny: countMatches(content, PATTERNS.colonAny),
      asAny: countMatches(content, PATTERNS.asAny),
      anyArray: countMatches(content, PATTERNS.anyArray),
      mapStringAny: countMatches(content, PATTERNS.mapStringAny),
      total: 0,
    };
    counts.total = counts.colonAny + counts.asAny + counts.anyArray + counts.mapStringAny;

    if (counts.total === 0) {
      continue;
    }

    const directory = path.dirname(file);
    const directoryCounter = byDirectory.get(directory) || { directory, ...emptyCounter() };
    addCounts(directoryCounter, counts);
    byDirectory.set(directory, directoryCounter);

    const cluster = getCluster(file);
    const clusterCounter = byCluster.get(cluster) || { cluster, ...emptyCounter() };
    addCounts(clusterCounter, counts);
    byCluster.set(cluster, clusterCounter);

    byFile.set(file, { file, ...counts });
  }

  const rows = [...byDirectory.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.directory.localeCompare(b.directory);
  });

  const clusterRows = [...byCluster.values()].sort((a, b) => {
    if (a.cluster === 'other') return 1;
    if (b.cluster === 'other') return -1;
    if (b.total !== a.total) return b.total - a.total;
    return a.cluster.localeCompare(b.cluster);
  });

  const fileRows = [...byFile.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.file.localeCompare(b.file);
  });

  const totals = rows.reduce((acc, row) => {
    addCounts(acc, row);
    return acc;
  }, emptyCounter());

  return { rows, clusterRows, fileRows, totals };
}

function printDirectoryTable(summary, ref) {
  const scopeLabel = ref ? `Git-Ref: ${ref}` : 'Working Tree';
  console.log(`# Any Usage Report (${scopeLabel})`);
  console.log('');
  console.log('| Ordner | `: any` | `as any` | `any[]` | `Map<string, any>` | Summe |');
  console.log('|---|---:|---:|---:|---:|---:|');

  if (summary.rows.length === 0) {
    console.log('| _Keine Treffer_ | 0 | 0 | 0 | 0 | 0 |');
  }

  for (const row of summary.rows) {
    console.log(`| ${row.directory} | ${row.colonAny} | ${row.asAny} | ${row.anyArray} | ${row.mapStringAny} | ${row.total} |`);
  }

  console.log(
    `| **Gesamt** | **${summary.totals.colonAny}** | **${summary.totals.asAny}** | **${summary.totals.anyArray}** | **${summary.totals.mapStringAny}** | **${summary.totals.total}** |`,
  );
}

function printFileTable(summary, ref, topFiles) {
  const scopeLabel = ref ? `Git-Ref: ${ref}` : 'Working Tree';
  console.log(`# Any Usage File Report (${scopeLabel})`);
  console.log('');
  console.log(`Top ${topFiles} Dateien nach Trefferanzahl.`);
  console.log('');
  console.log('| Datei | `: any` | `as any` | `any[]` | `Map<string, any>` | Summe |');
  console.log('|---|---:|---:|---:|---:|---:|');

  const selectedRows = summary.fileRows.slice(0, topFiles);

  if (selectedRows.length === 0) {
    console.log('| _Keine Treffer_ | 0 | 0 | 0 | 0 | 0 |');
    return;
  }

  for (const row of selectedRows) {
    console.log(`| ${row.file} | ${row.colonAny} | ${row.asAny} | ${row.anyArray} | ${row.mapStringAny} | ${row.total} |`);
  }
}

function printClusterTable(summary, ref) {
  const scopeLabel = ref ? `Git-Ref: ${ref}` : 'Working Tree';
  console.log(`# Any Usage Cluster Report (${scopeLabel})`);
  console.log('');
  console.log('| Cluster | `: any` | `as any` | `any[]` | `Map<string, any>` | Summe |');
  console.log('|---|---:|---:|---:|---:|---:|');

  if (summary.clusterRows.length === 0) {
    console.log('| _Keine Treffer_ | 0 | 0 | 0 | 0 | 0 |');
  }

  for (const row of summary.clusterRows) {
    console.log(`| ${row.cluster} | ${row.colonAny} | ${row.asAny} | ${row.anyArray} | ${row.mapStringAny} | ${row.total} |`);
  }

  console.log(
    `| **Gesamt** | **${summary.totals.colonAny}** | **${summary.totals.asAny}** | **${summary.totals.anyArray}** | **${summary.totals.mapStringAny}** | **${summary.totals.total}** |`,
  );
}

const args = parseArgs(process.argv.slice(2));
const files = args.ref ? listFilesFromGitRef(args.ref, args.dirs) : listFilesFromWorkingTree(args.dirs);
const summary = summarize(files, args.ref);

if (args.totalOnly) {
  console.log(summary.totals.total);
} else if (args.json) {
  console.log(JSON.stringify(summary, null, 2));
} else if (args.clusterSummary) {
  printClusterTable(summary, args.ref);
} else if (args.fileSummary) {
  printFileTable(summary, args.ref, args.topFiles);
} else {
  printDirectoryTable(summary, args.ref);
}
