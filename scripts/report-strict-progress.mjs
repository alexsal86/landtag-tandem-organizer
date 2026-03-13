import { execSync } from 'node:child_process';
import fs from 'node:fs';

const modules = {
  hooks: {
    dirs: ['src/hooks'],
    batch1: 'tsconfig.hooks-batch1-strict.json',
    batch2: 'tsconfig.hooks-batch2-strict.json',
    batch3: 'tsconfig.hooks-batch3-strict.json',
  },
  pages: {
    dirs: ['src/pages'],
    batch1: 'tsconfig.pages-strict.json',
    batch2: 'tsconfig.pages-batch2-strict.json',
    batch3: 'tsconfig.pages-batch3-strict.json',
  },
  'services-features': {
    dirs: ['src/services', 'src/features'],
    batch1: 'tsconfig.services-features-strict.json',
    batch2: 'tsconfig.services-features-batch2-strict.json',
    batch3: 'tsconfig.services-features-batch3-strict.json',
  },
};

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function listFiles(dirs) {
  const result = new Set();
  for (const dir of dirs) {
    const out = run(`rg --files ${dir} -g '*.ts' -g '*.tsx'`);
    if (!out) continue;
    out
      .split('\n')
      .map((file) => file.replace(/^\.\//, ''))
      .forEach((file) => result.add(file));
  }
  return result;
}

function expandIncludes(includes) {
  const result = new Set();
  for (const pattern of includes || []) {
    if (pattern.includes('**') || pattern.includes('*')) {
      const out = run(`rg --files . -g '${pattern}'`);
      if (!out) continue;
      out.split('\n').forEach((file) => result.add(file.replace(/^\.\//, '')));
    } else if (fs.existsSync(pattern)) {
      result.add(pattern);
    }
  }
  return result;
}

function readConfig(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function pct(value, total) {
  return total === 0 ? '0.0%' : `${((value / total) * 100).toFixed(1)}%`;
}

const lines = [];
lines.push('# Strict-Migrationsfortschritt');
lines.push('');
lines.push('| Verzeichnis | TS/TSX-Dateien gesamt | Batch 1 (`strictNullChecks`) | Batch 2 (`noImplicitAny`) | Batch 3 (`noUnusedLocals`/`noUnusedParameters`) |');
lines.push('|---|---:|---:|---:|---:|');

for (const [name, cfg] of Object.entries(modules)) {
  const allFiles = listFiles(cfg.dirs);
  const batch1Files = expandIncludes(readConfig(cfg.batch1).include);
  const batch2Files = expandIncludes(readConfig(cfg.batch2).include);
  const batch3Files = expandIncludes(readConfig(cfg.batch3).include);

  const total = allFiles.size;
  const b1 = [...batch1Files].filter((f) => allFiles.has(f)).length;
  const b2 = [...batch2Files].filter((f) => allFiles.has(f)).length;
  const b3 = [...batch3Files].filter((f) => allFiles.has(f)).length;

  lines.push(`| ${name} (${cfg.dirs.join(', ')}) | ${total} | ${b1} (${pct(b1, total)}) | ${b2} (${pct(b2, total)}) | ${b3} (${pct(b3, total)}) |`);
}

console.log(lines.join('\n'));
