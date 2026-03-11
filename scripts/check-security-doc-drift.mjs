#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'supabase/config.toml');
const matrixPath = path.join(repoRoot, 'docs/security-function-matrix.md');

const config = fs.readFileSync(configPath, 'utf8');
const matrix = fs.readFileSync(matrixPath, 'utf8');

const configFunctions = new Map();
let current = null;
for (const line of config.split(/\r?\n/)) {
  const section = line.match(/^\[functions\.([^\]]+)\]$/);
  if (section) {
    current = section[1];
    continue;
  }

  if (!current) continue;
  const verify = line.match(/^verify_jwt\s*=\s*(true|false)$/);
  if (verify) {
    configFunctions.set(current, verify[1] === 'true');
    current = null;
  }
}

const matrixRows = matrix
  .split(/\r?\n/)
  .filter((line) => line.startsWith('| ') && !line.includes('|---'));

const matrixFunctions = new Map();
for (const row of matrixRows) {
  const cols = row.split('|').map((c) => c.trim()).filter(Boolean);
  if (cols.length < 4) continue;
  const [fnName, verifyJwt] = cols;
  if (fnName === 'Function') continue;

  if (verifyJwt !== 'true' && verifyJwt !== 'false') {
    throw new Error(`Invalid verify_jwt value in matrix for ${fnName}: ${verifyJwt}`);
  }
  matrixFunctions.set(fnName, verifyJwt === 'true');
}

const errors = [];

for (const [fnName, verify] of configFunctions.entries()) {
  if (!matrixFunctions.has(fnName)) {
    errors.push(`Missing in docs/security-function-matrix.md: ${fnName}`);
    continue;
  }
  const matrixVerify = matrixFunctions.get(fnName);
  if (matrixVerify !== verify) {
    errors.push(`verify_jwt mismatch for ${fnName}: config=${verify}, matrix=${matrixVerify}`);
  }
}

for (const fnName of matrixFunctions.keys()) {
  if (!configFunctions.has(fnName)) {
    errors.push(`Documented function not found in supabase/config.toml: ${fnName}`);
  }
}

if (errors.length > 0) {
  console.error('❌ Security function matrix drift detected:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`✅ Security matrix is in sync (${configFunctions.size} functions checked).`);
