#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const AUTH_GUARD_PATTERNS = [
  /requireAuth\s*\(/,
  /auth\.getUser\s*\(/,
  /Authorization/i,
  /unauthorizedResponse\s*\(/,
  /status\s*:\s*401/,
];
const ROLE_GUARD_PATTERNS = [/requireRole\s*\(/, /has_role/, /\.eq\(['"]role['"]/, /forbiddenResponse\s*\(/];
const TENANT_GUARD_PATTERNS = [/requireTenantAccess\s*\(/, /tenant_id/, /get_user_primary_tenant_id/, /\.eq\(['"]tenant_id['"]/];
const WEBHOOK_GUARD_PATTERNS = [/x-webhook-secret/i, /webhook[_-]?secret/i, /signature/i, /timingSafeEqual/i];
const SERVICE_ROLE_PATTERNS = [/requireServiceRole\s*\(/, /SUPABASE_SERVICE_ROLE_KEY/];
const CONTROLLED_CORS_PATTERNS = [/ALLOWED_ORIGINS/, /allowedOrigins/, /req\.headers\.get\(['"]Origin['"]\)/, /origin\s*===/];
const UNSAFE_ERROR_PATTERNS = [
  /JSON\.stringify\(\s*\{[^}]*\b(error|details?)\s*:\s*(error|err)\.(message|stack)/s,
  /return\s+new\s+Response\([^)]*(error|err)\.(message|stack)/s,
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseConfigFunctions(configContent) {
  const functions = new Map();
  let current = null;

  for (const line of configContent.split(/\r?\n/)) {
    const section = line.match(/^\[functions\.([^\]]+)\]$/);
    if (section) {
      current = section[1];
      if (!functions.has(current)) functions.set(current, { verifyJwt: null });
      continue;
    }
    if (!current) continue;

    const verify = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (verify) {
      functions.get(current).verifyJwt = verify[1] === 'true';
      continue;
    }

    if (line.startsWith('[') && !line.startsWith('[functions.')) current = null;
  }

  return functions;
}

function parseMatrix(matrixContent) {
  const rows = matrixContent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('|') && !line.replace(/\s/g, '').startsWith('|---|'));

  const functions = new Map();
  for (const row of rows) {
    const cols = row.split('|').map((c) => c.trim());
    if (cols.length < 5) continue;
    const [name, verifyRaw, category, extra] = cols.slice(1, 5);
    if (name === 'Function') continue;
    if (verifyRaw !== 'true' && verifyRaw !== 'false') {
      throw new Error(`Invalid verify_jwt value in matrix for ${name}: ${verifyRaw}`);
    }
    functions.set(name, {
      verifyJwt: verifyRaw === 'true',
      category,
      extra: extra ?? '',
    });
  }

  return functions;
}

function loadWhitelist(whitelistPath) {
  if (!fs.existsSync(whitelistPath)) return new Map();

  const raw = JSON.parse(readText(whitelistPath));
  if (!Array.isArray(raw.entries)) {
    throw new Error('Whitelist must have an "entries" array.');
  }

  const map = new Map();
  for (const entry of raw.entries) {
    const { functionName, rule, reviewer, reason } = entry;
    if (!functionName || !rule || !reason || !reviewer) {
      throw new Error(`Invalid whitelist entry: ${JSON.stringify(entry)}`);
    }

    if (/^(tbd|todo|n\/a)$/i.test(String(reviewer).trim())) {
      throw new Error(`Whitelist reviewer must be explicit for ${functionName}/${rule}.`);
    }

    map.set(`${functionName}::${rule}`, entry);
  }

  return map;
}

function hasPattern(content, patterns) {
  return patterns.some((p) => p.test(content));
}

function pushFinding(findings, whitelist, functionName, rule, message) {
  const key = `${functionName}::${rule}`;
  if (whitelist.has(key)) return;
  findings.push({ functionName, rule, message });
}

export function auditSecurity({ repoRoot = process.cwd(), functionsRoot, configPath, matrixPath, whitelistPath } = {}) {
  const effectiveFunctionsRoot = functionsRoot ?? path.join(repoRoot, 'supabase/functions');
  const effectiveConfigPath = configPath ?? path.join(repoRoot, 'supabase/config.toml');
  const effectiveMatrixPath = matrixPath ?? path.join(repoRoot, 'docs/security-function-matrix.md');
  const effectiveWhitelistPath = whitelistPath ?? path.join(repoRoot, 'scripts/security-function-whitelist.json');

  const functionDirs = fs
    .readdirSync(effectiveFunctionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(effectiveFunctionsRoot, name, 'index.ts')))
    .sort();

  const whitelist = loadWhitelist(effectiveWhitelistPath);
  const configFunctions = parseConfigFunctions(readText(effectiveConfigPath));
  const matrixFunctions = parseMatrix(readText(effectiveMatrixPath));

  const findings = [];

  for (const fnName of functionDirs) {
    if (!configFunctions.has(fnName)) {
      pushFinding(findings, whitelist, fnName, 'drift-missing-config', `${fnName} exists in supabase/functions but is missing in supabase/config.toml`);
    }
    if (!matrixFunctions.has(fnName)) {
      pushFinding(findings, whitelist, fnName, 'drift-missing-matrix', `${fnName} exists in supabase/functions but is missing in docs/security-function-matrix.md`);
    }
  }

  for (const fnName of configFunctions.keys()) {
    if (!functionDirs.includes(fnName)) {
      pushFinding(findings, whitelist, fnName, 'drift-missing-function', `${fnName} is configured in supabase/config.toml but no supabase/functions/${fnName}/index.ts exists`);
    }

    if (!matrixFunctions.has(fnName)) {
      pushFinding(findings, whitelist, fnName, 'drift-missing-matrix', `${fnName} is configured but missing in docs/security-function-matrix.md`);
      continue;
    }

    const configVerify = configFunctions.get(fnName).verifyJwt;
    const matrix = matrixFunctions.get(fnName);
    if (configVerify !== matrix.verifyJwt) {
      pushFinding(findings, whitelist, fnName, 'drift-verify-jwt-mismatch', `${fnName} verify_jwt mismatch: config=${configVerify} matrix=${matrix.verifyJwt}`);
    }

    const expectedForCategory = matrix.category === 'authenticated';
    if (matrix.category !== 'authenticated' && matrix.category !== 'internal-scheduled' && matrix.category !== 'public-webhook' && matrix.category !== 'public-readonly') {
      pushFinding(findings, whitelist, fnName, 'drift-invalid-category', `${fnName} has invalid matrix category: ${matrix.category}`);
    } else if (matrix.verifyJwt !== expectedForCategory && matrix.category !== 'public-webhook' && matrix.category !== 'internal-scheduled' && matrix.category !== 'public-readonly') {
      pushFinding(findings, whitelist, fnName, 'drift-category-verify-mismatch', `${fnName} category ${matrix.category} contradicts verify_jwt=${matrix.verifyJwt}`);
    }
  }

  for (const fnName of functionDirs) {
    const filePath = path.join(effectiveFunctionsRoot, fnName, 'index.ts');
    const content = readText(filePath);
    const matrix = matrixFunctions.get(fnName);

    if ((content.includes(`'Access-Control-Allow-Origin': '*'`) || content.includes(`"Access-Control-Allow-Origin": "*"`))
      && !hasPattern(content, CONTROLLED_CORS_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'wildcard-cors', `${fnName} uses Access-Control-Allow-Origin: * without visible origin control`);
    }

    if (hasPattern(content, UNSAFE_ERROR_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'unsafe-error-response', `${fnName} appears to leak raw error details in response payload`);
    }

    if (!matrix) continue;

    if (matrix.category === 'authenticated' && !hasPattern(content, AUTH_GUARD_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'missing-auth-guard', `${fnName} is authenticated but no explicit auth guard pattern detected`);
    }

    if (matrix.category === 'internal-scheduled' && !hasPattern(content, SERVICE_ROLE_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'missing-service-role-guard', `${fnName} is internal-scheduled but no service-role guard was detected`);
    }

    if (matrix.category === 'public-webhook' && !hasPattern(content, WEBHOOK_GUARD_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'missing-webhook-secret', `${fnName} is public-webhook but no secret/signature guard was detected`);
    }

    if (/rollen/i.test(matrix.extra) && !hasPattern(content, ROLE_GUARD_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'missing-role-check', `${fnName} matrix requires role checks but no role guard pattern detected`);
    }

    if (/tenant/i.test(matrix.extra) && !hasPattern(content, TENANT_GUARD_PATTERNS)) {
      pushFinding(findings, whitelist, fnName, 'missing-tenant-check', `${fnName} matrix requires tenant checks but no tenant guard pattern detected`);
    }
  }

  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = auditSecurity();
  if (findings.length > 0) {
    console.error('❌ Edge function security check failed:');
    for (const finding of findings) {
      console.error(` - [${finding.rule}] ${finding.message}`);
    }
    process.exit(1);
  }

  console.log('✅ Edge function security checks passed.');
}
