#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'warn';
const isBlocking = mode === 'block';

const summaryPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');

const thresholds = {
  global: {
    lines: { warn: 45, block: 55 },
    statements: { warn: 45, block: 55 },
    functions: { warn: 45, block: 55 },
    branches: { warn: 30, block: 40 },
  },
  criticalModules: [
    {
      name: 'Error handling utils',
      pattern: '/src/utils/errorHandler.ts',
      min: { warn: 70, block: 80 },
    },
    {
      name: 'HTML sanitizer utils',
      pattern: '/src/utils/htmlSanitizer.ts',
      min: { warn: 70, block: 80 },
    },
    {
      name: 'Core time utils',
      pattern: '/src/lib/timeUtils.ts',
      min: { warn: 70, block: 80 },
    },
  ],
  criticalFlows: [
    {
      name: 'Auth/Tenant switch flow',
      pattern: '/src/hooks/useAuth.tsx',
      min: {
        functions: { warn: 70, block: 80 },
        branches: { warn: 55, block: 65 },
      },
    },
    {
      name: 'Tenant membership flow',
      pattern: '/src/hooks/useTenant.tsx',
      min: {
        functions: { warn: 70, block: 80 },
        branches: { warn: 55, block: 65 },
      },
    },
    {
      name: 'Calendar sync trigger flow',
      pattern: '/src/components/ExternalCalendarSettings.tsx',
      min: {
        functions: { warn: 60, block: 70 },
        branches: { warn: 45, block: 55 },
      },
    },
    {
      name: 'Letter status workflow',
      pattern: '/src/hooks/useLetterArchiving.tsx',
      min: {
        functions: { warn: 70, block: 80 },
        branches: { warn: 55, block: 65 },
      },
    },
    {
      name: 'Notifications flow',
      pattern: '/src/hooks/useNotifications.tsx',
      min: {
        functions: { warn: 55, block: 65 },
        branches: { warn: 40, block: 50 },
      },
    },
  ],
};

if (!fs.existsSync(summaryPath)) {
  const msg = `Coverage summary not found at ${summaryPath}. Run test:coverage:ci first.`;
  if (isBlocking) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }

  console.warn(`⚠️ ${msg}`);
  process.exit(0);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const issues = [];

const current = (key) => (isBlocking ? key.block : key.warn);
const level = isBlocking ? 'BLOCK' : 'WARN';

for (const metric of ['lines', 'statements', 'functions', 'branches']) {
  const actual = summary.total?.[metric]?.pct ?? 0;
  const min = current(thresholds.global[metric]);

  if (actual < min) {
    issues.push(`${level}: global ${metric} coverage ${actual}% < ${min}%`);
  }
}

for (const criticalModule of thresholds.criticalModules) {
  const moduleEntry = Object.entries(summary).find(([file]) => file.endsWith(criticalModule.pattern));

  if (!moduleEntry) {
    issues.push(`${level}: critical module missing in coverage report: ${criticalModule.name} (${criticalModule.pattern})`);
    continue;
  }

  const [, metrics] = moduleEntry;
  const actual = metrics.lines?.pct ?? 0;
  const min = current(criticalModule.min);

  if (actual < min) {
    issues.push(
      `${level}: ${criticalModule.name} line coverage ${actual}% < ${min}% (${criticalModule.pattern})`,
    );
  }
}

for (const criticalFlow of thresholds.criticalFlows) {
  const flowEntry = Object.entries(summary).find(([file]) => file.endsWith(criticalFlow.pattern));

  if (!flowEntry) {
    issues.push(`${level}: critical flow missing in coverage report: ${criticalFlow.name} (${criticalFlow.pattern})`);
    continue;
  }

  const [, metrics] = flowEntry;

  for (const metric of ['functions', 'branches']) {
    const actual = metrics[metric]?.pct ?? 0;
    const min = current(criticalFlow.min[metric]);

    if (actual < min) {
      issues.push(
        `${level}: ${criticalFlow.name} ${metric} coverage ${actual}% < ${min}% (${criticalFlow.pattern})`,
      );
    }
  }
}

if (issues.length === 0) {
  console.log(`✅ Coverage thresholds passed in ${mode} mode.`);
  process.exit(0);
}

for (const issue of issues) {
  console[isBlocking ? 'error' : 'warn'](isBlocking ? `❌ ${issue}` : `⚠️ ${issue}`);
}

if (isBlocking) {
  process.exit(1);
}

console.warn('⚠️ Coverage thresholds reported warnings (non-blocking).');
