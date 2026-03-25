#!/usr/bin/env node
import { execSync } from 'node:child_process';

const TICKET_PATTERN = /\b[A-Z][A-Z0-9]+-\d+\b/;
const ANY_EXCEPTION_PATTERN = /(?:any-exception|any-allow|eslint-disable-next-line\s+@typescript-eslint\/no-explicit-any)/i;
const TS_COMMENT_PATTERN = /@ts-(ignore|expect-error)/;
const EXPLICIT_ANY_PATTERN = /\bany\b/;
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

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
      if (recentAddedLines.length > 3) {
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

        if (likelyTypeAny && (!ANY_EXCEPTION_PATTERN.test(contextText) || !TICKET_PATTERN.test(contextText))) {
          issues.push({
            file: currentFile,
            line: lineNumber,
            type: 'explicit-any',
            message:
              'Neues explicit any ist nur mit maschinenlesbarer Ausnahme erlaubt (Kommentar mit any-exception + Ticket-ID).',
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
