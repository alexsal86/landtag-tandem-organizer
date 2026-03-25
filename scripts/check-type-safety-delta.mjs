#!/usr/bin/env node
import { execSync } from 'node:child_process';

const TICKET_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const ANY_EXCEPTION_PATTERN = /(?:any-exception|any-allow|eslint-disable-next-line\s+@typescript-eslint\/no-explicit-any)/i;
const TS_COMMENT_PATTERN = /@ts-(ignore|expect-error)/;
const EXPLICIT_ANY_PATTERN = /\bany\b/;
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const DUE_DATE_PATTERN = /\b(?:due|zieltermin)\s*[:=]\s*(\d{4}-\d{2}-\d{2})\b/i;
const WRAPPER_PATTERN = /\bwrapper\s*[:=]\s*([A-Za-z_$][\w$]*)\b/i;

const UI_HOOKS_DENY_PATHS = [
  /^src\/components\//,
  /^src\/pages\//,
  /^src\/hooks\//,
];

const ADAPTER_ALLOW_PATHS = [
  /\/adapters\//,
  /\/interop\//i,
  /InteropAdapter\.[cm]?[jt]sx?$/,
  /Adapters?\.[cm]?[jt]sx?$/,
  /^src\/services\/.*adapter/i,
];

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
  const args = {
    base: process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
    head: 'HEAD',
  };

  for (const arg of argv) {
    if (arg.startsWith('--base=')) {
      args.base = arg.slice('--base='.length).trim() || null;
    } else if (arg.startsWith('--head=')) {
      args.head = arg.slice('--head='.length).trim() || 'HEAD';
    }
  }

  return args;
}

function getDiff(base, head) {
  if (!base) {
    throw new Error('Base-Ref fehlt. Nutze --base=<git-ref> oder setze GITHUB_BASE_REF.');
  }

  return run(`git diff --unified=0 --no-color ${base}...${head}`);
}

function isUiOrHooksPath(filePath) {
  return UI_HOOKS_DENY_PATHS.some((pattern) => pattern.test(filePath));
}

function isAdapterPath(filePath) {
  return ADAPTER_ALLOW_PATHS.some((pattern) => pattern.test(filePath));
}

function parseDiff(diffText) {
  const issues = [];
  let currentFile = null;
  let currentAddedLine = 0;
  const recentAddedLines = [];

  const lines = diffText.split('\n');

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      recentAddedLines.length = 0;
      continue;
    }

    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      currentAddedLine = Number.parseInt(hunkMatch[1], 10);
      recentAddedLines.length = 0;
      continue;
    }

    if (!currentFile || !CODE_FILE_PATTERN.test(currentFile)) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      const lineNumber = currentAddedLine;
      currentAddedLine += 1;

      recentAddedLines.push({ lineNumber, content });
      if (recentAddedLines.length > 4) {
        recentAddedLines.shift();
      }

      const lowerContent = content.toLowerCase();
      const contextText = recentAddedLines.map((entry) => entry.content).join(' ');

      if (
        TS_COMMENT_PATTERN.test(content) &&
        (!TICKET_PATTERN.test(content) || content.trim().split(':').length < 2)
      ) {
        issues.push({
          file: currentFile,
          line: lineNumber,
          type: 'ts-comment',
          message: 'Neue @ts-ignore/@ts-expect-error benötigt Ticket und Begründung im Kommentar.',
        });
      }

      const hasExplicitAny = EXPLICIT_ANY_PATTERN.test(content) && !/\bany-exception\b/i.test(content) && !/\bmany\b/i.test(lowerContent);

      if (hasExplicitAny) {
        const likelyTypeAny =
          /:\s*any\b/.test(content) ||
          /\bas\s+any\b/.test(content) ||
          /<\s*any\s*>/.test(content) ||
          /\bany\s*\[\s*\]/.test(content) ||
          /\bMap\s*<\s*string\s*,\s*any\s*>/.test(content);

        if (likelyTypeAny && isUiOrHooksPath(currentFile)) {
          issues.push({
            file: currentFile,
            line: lineNumber,
            type: 'explicit-any-ui-hooks',
            message:
              'Explizites any ist in UI/Hooks verboten. Nutze stattdessen präzise Typen oder verschiebe den Interop-Fall in eine Adapterdatei.',
          });
          continue;
        }

        if (likelyTypeAny && !isAdapterPath(currentFile)) {
          issues.push({
            file: currentFile,
            line: lineNumber,
            type: 'explicit-any-non-adapter',
            message:
              'Explizites any ist nur in Adapter-/Interop-Dateien erlaubt. Verschiebe die Stelle in einen typed Adapter/Wrapper.',
          });
          continue;
        }

        const hasException = ANY_EXCEPTION_PATTERN.test(contextText);
        const hasTicket = TICKET_PATTERN.test(contextText);
        const hasDueDate = DUE_DATE_PATTERN.test(contextText);
        const hasWrapper = WRAPPER_PATTERN.test(contextText);

        if (likelyTypeAny && (!hasException || !hasTicket || !hasDueDate || !hasWrapper)) {
          issues.push({
            file: currentFile,
            line: lineNumber,
            type: 'explicit-any',
            message:
              'Neues explicit any benötigt Ausnahme-Kontext mit any-exception + Ticket-ID + due:YYYY-MM-DD + wrapper:<typedFn> + kurzer Begründung.',
          });
        }
      }

      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      continue;
    }

    if (line.startsWith(' ')) {
      currentAddedLine += 1;
      recentAddedLines.length = 0;
    }
  }

  return issues;
}

const args = parseArgs(process.argv.slice(2));

let diffText = '';
try {
  diffText = getDiff(args.base, args.head);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const issues = parseDiff(diffText);

if (issues.length > 0) {
  console.error('Type-Safety-Delta-Gate fehlgeschlagen:');
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} [${issue.type}] ${issue.message}`);
  }
  process.exit(1);
}

console.log('Type-Safety-Delta-Gate bestanden: Keine unzulässigen neuen any/ts-comments erkannt.');
