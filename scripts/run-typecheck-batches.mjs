import { spawn } from 'node:child_process';

const ALL_BATCHES = [
  'typecheck:flow-auth-tenant',
  'typecheck:flow-calendar-sync',
  'typecheck:flow-letter-workflow',
  'typecheck:flow-notifications',
  'typecheck:flow-edge-auth-role-tenant',
  'typecheck:knowledge',
  'typecheck:auth',
  'typecheck:quicknotes',
  'typecheck:notifications',
  'typecheck:dashboard',
  'typecheck:utils',
  'typecheck:hooks-batch2',
  'typecheck:hooks-batch3',
  'typecheck:services-features-batch2',
  'typecheck:services-features-batch3',
  'typecheck:pages-batch2',
  'typecheck:pages-batch3',
];

const requested = process.argv.slice(2);
const scripts = requested.length > 0 ? requested : ALL_BATCHES;
const concurrency = Number(process.env.TYPECHECK_CONCURRENCY || 4);

const runScript = (scriptName) =>
  new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', '-s', scriptName], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} failed with exit code ${code ?? 1}`));
    });
  });

const queue = [...scripts];
const active = new Set();
let hasFailure = false;

const runNext = async () => {
  if (hasFailure || queue.length === 0) return;
  const next = queue.shift();
  if (!next) return;

  const task = runScript(next)
    .catch((error) => {
      hasFailure = true;
      throw error;
    })
    .finally(() => {
      active.delete(task);
    });

  active.add(task);

  if (active.size >= concurrency) {
    await Promise.race(active);
  }

  await runNext();
};

try {
  await runNext();
  await Promise.all(active);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
