import { execSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_DIRS = ['src', 'supabase/functions'];
const TS_GLOBS = ['*.ts', '*.tsx', '*.mts', '*.cts'];

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
  const args = {
    dirs: [...DEFAULT_DIRS],
    ref: null,
    json: false,
    totalOnly: false,
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
    return run(`cat ${escapePath(file)}`);
  }

  return run(`git show ${escapePath(`${ref}:${file}`)}`);
}

function countMatches(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function summarize(files, ref) {
  const byDirectory = new Map();

  for (const file of files) {
    let content = '';
    try {
      content = readContent(file, ref);
    } catch {
      continue;
    }

    const anyCasts = countMatches(content, /\bas\s+any\b/g);
    const explicitAny = countMatches(content, /\bany\b/g);
    const directory = path.dirname(file);

    const current = byDirectory.get(directory) || { directory, explicitAny: 0, asAny: 0, total: 0 };
    current.explicitAny += explicitAny;
    current.asAny += anyCasts;
    current.total += explicitAny + anyCasts;
    byDirectory.set(directory, current);
  }

  const rows = [...byDirectory.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.directory.localeCompare(b.directory);
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.explicitAny += row.explicitAny;
      acc.asAny += row.asAny;
      acc.total += row.total;
      return acc;
    },
    { explicitAny: 0, asAny: 0, total: 0 },
  );

  return { rows, totals };
}

function printTable(summary, ref) {
  const scopeLabel = ref ? `Git-Ref: ${ref}` : 'Working Tree';
  console.log(`# Any Usage Report (${scopeLabel})`);
  console.log('');
  console.log('| Verzeichnis | `any` | `as any` | Summe |');
  console.log('|---|---:|---:|---:|');

  for (const row of summary.rows) {
    console.log(`| ${row.directory} | ${row.explicitAny} | ${row.asAny} | ${row.total} |`);
  }

  console.log(`| **Gesamt** | **${summary.totals.explicitAny}** | **${summary.totals.asAny}** | **${summary.totals.total}** |`);
}

const args = parseArgs(process.argv.slice(2));
const files = args.ref ? listFilesFromGitRef(args.ref, args.dirs) : listFilesFromWorkingTree(args.dirs);
const summary = summarize(files, args.ref);

if (args.totalOnly) {
  console.log(summary.totals.total);
} else if (args.json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printTable(summary, args.ref);
}
