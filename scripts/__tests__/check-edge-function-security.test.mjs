import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSecurity } from '../check-edge-function-security.mjs';

function setupFixture({ functionName, indexContent, verifyJwt = true, category = 'authenticated', extra = '' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-security-'));

  fs.mkdirSync(path.join(root, 'supabase/functions', functionName), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });

  fs.writeFileSync(path.join(root, 'supabase/functions', functionName, 'index.ts'), indexContent);
  fs.writeFileSync(path.join(root, 'supabase/config.toml'), `[functions.${functionName}]\nverify_jwt = ${verifyJwt}\n`);
  fs.writeFileSync(
    path.join(root, 'docs/security-function-matrix.md'),
    `| Function | verify_jwt | Kategorie | Zusätzlicher Schutz / Hinweis |\n|---|---:|---|---|\n| ${functionName} | ${verifyJwt} | ${category} | ${extra} |\n`,
  );
  fs.writeFileSync(path.join(root, 'scripts/security-function-whitelist.json'), '{"entries": []}\n');

  return root;
}

test('flags missing auth guard (unauthenticated path)', () => {
  const root = setupFixture({
    functionName: 'auth-required-fn',
    verifyJwt: true,
    category: 'authenticated',
    indexContent: "Deno.serve(async () => new Response('ok'));",
  });

  const findings = auditSecurity({ repoRoot: root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(findings.some((f) => f.rule === 'missing-auth-guard'), true);
});

test('flags missing role check for role-protected function', () => {
  const root = setupFixture({
    functionName: 'role-fn',
    verifyJwt: true,
    category: 'authenticated',
    extra: 'JWT + Rollenprüfung im Code',
    indexContent: "const authHeader = req.headers.get('Authorization');",
  });

  const findings = auditSecurity({ repoRoot: root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(findings.some((f) => f.rule === 'missing-role-check'), true);
});

test('flags missing tenant check for tenant-protected function', () => {
  const root = setupFixture({
    functionName: 'tenant-fn',
    verifyJwt: true,
    category: 'authenticated',
    extra: 'JWT + Rollen-/Tenant-Checks im Code',
    indexContent: "const authHeader = req.headers.get('Authorization');",
  });

  const findings = auditSecurity({ repoRoot: root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(findings.some((f) => f.rule === 'missing-tenant-check'), true);
});

test('flags missing webhook secret validation', () => {
  const root = setupFixture({
    functionName: 'webhook-fn',
    verifyJwt: false,
    category: 'public-webhook',
    extra: 'Signatur erforderlich',
    indexContent: "Deno.serve(async () => new Response('ok'));",
  });

  const findings = auditSecurity({ repoRoot: root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(findings.some((f) => f.rule === 'missing-webhook-secret'), true);
});
