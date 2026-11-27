#!/usr/bin/env node
// Prüft manage-tenant-user auf Handler-Ebene, ohne Supabase-Stack:
// die echte index.ts wird transpiliert und mit einem Fake-Client aufgerufen.
// Jeder insert/update wird gegen den Row-Block der generierten Typen geprüft,
// damit eine erfundene Spalte (früher z. B. sender_information.department)
// sofort auffällt. Abgedeckt: provisionTenant (Standard/Vorlage/leer),
// fehlgeschlagener Admin-Benutzer, cloneTenantData und der Superadmin-Zwang.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {
  parseTableColumns,
  parseTableInsertRequirements,
  TYPES_FILE,
} from './check-edge-function-columns.mjs';

const ROOT = new URL('../', import.meta.url);
const NEW_TENANT = '11111111-1111-4111-8111-111111111111';
const SOURCE_TENANT = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';

const typesSource = readFileSync(new URL(TYPES_FILE, ROOT), 'utf8');
const tableColumns = parseTableColumns(typesSource);
const requiredColumns = parseTableInsertRequirements(typesSource);

function transpile(file) {
  const source = readFileSync(new URL(file, ROOT), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: file,
  }).outputText;
}

/** Laufzeit-Globals, die die Edge-Runtime sonst stellt. */
const runtimeGlobals = {
  Deno: { env: { get: (key) => (key.startsWith('SUPABASE_') ? 'http://local.test' : '') } },
  Response,
  Request,
  Headers,
  console,
};

/** Lädt ein ESM-Modul aus einer .ts-Datei als CommonJS-Sandbox. */
function loadModule(file, requireFor = () => ({})) {
  // CommonJS-Emit schreibt auf `exports`; beide Namen müssen dasselbe Objekt sein.
  const exported = {};
  const context = {
    ...runtimeGlobals,
    exports: exported,
    module: { exports: exported },
    require: requireFor,
  };
  vm.runInNewContext(transpile(file), context, { filename: file });
  return exported;
}

const seed = loadModule('supabase/functions/_shared/tenant-seed.ts');

/** Fake-Client, der Schreibzugriffe aufzeichnet und Spalten validiert. */
function createFakeClient(options = {}) {
  const inserts = [];
  const updates = [];
  const selects = [];
  const columnProblems = [];

  /** Prüft gegen die generierten Typen: keine erfundenen, keine fehlenden Pflichtfelder. */
  const validate = (table, rows, { insert = false } = {}) => {
    const allowed = tableColumns.get(table);
    if (!allowed) return;
    const required = insert ? requiredColumns.get(table) : undefined;
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!allowed.has(key)) columnProblems.push(`${table}: unbekanntes Feld ${key}`);
      }
      for (const key of required ?? []) {
        if (!(key in row)) columnProblems.push(`${table}: Pflichtfeld ${key} fehlt`);
      }
    }
  };

  const builder = (table) => {
    const chain = {
      select() {
        selects.push(table);
        return chain;
      },
      insert(rows) {
        const list = Array.isArray(rows) ? rows : [rows];
        validate(table, list, { insert: true });
        inserts.push({ table, rows: list });
        return chain;
      },
      update(values) {
        validate(table, [values]);
        updates.push({ table, values });
        return chain;
      },
      upsert(rows) {
        const list = Array.isArray(rows) ? rows : [rows];
        validate(table, list, { insert: true });
        inserts.push({ table, rows: list, upsert: true });
        return chain;
      },
      eq() { return chain; },
      in() { return chain; },
      order() { return chain; },
      range() { return chain; },
      limit() { return chain; },
      maybeSingle: async () => ({ data: options.platformRole ?? null, error: null }),
      single: async () => ({ data: { id: options.newTenantId ?? NEW_TENANT }, error: null }),
      then(resolve) {
        const sourceRows = options.sourceRows?.[table];
        return Promise.resolve({ data: sourceRows ?? null, error: null }).then(resolve);
      },
    };
    return chain;
  };

  const client = {
    from: builder,
    auth: {
      getUser: async () => ({
        data: { user: { id: ADMIN_ID, email: 'admin@example.org' } },
        error: null,
      }),
      admin: {
        createUser: async () =>
          options.createUserError
            ? { data: { user: null }, error: { message: options.createUserError } }
            : { data: { user: { id: 'new-user' } }, error: null },
      },
    },
  };

  return { client, inserts, updates, selects, columnProblems };
}

function loadHandler(client) {
  let handler;
  const tenantAccess = {
    requireTenantAccess: async () => ({ membership: { role: 'mitarbeiter' } }),
  };
  const security = { withSafeHandler: (_name, fn) => fn };
  const platform = { serve: (fn) => { handler = fn; } };

  loadModule('supabase/functions/manage-tenant-user/index.ts', (specifier) => {
    if (specifier.includes('tenant-seed')) return seed;
    if (specifier.includes('tenant-access')) return tenantAccess;
    if (specifier.includes('security')) return security;
    if (specifier.includes('http/server')) return platform;
    if (specifier.includes('supabase-js')) return { createClient: () => client };
    throw new Error(`Unerwarteter Import: ${specifier}`);
  });

  assert.ok(handler, 'manage-tenant-user hat keinen Handler registriert');
  return handler;
}

const call = (handler, body, method = 'POST') =>
  handler(
    new Request('https://test.local/manage-tenant-user', {
      method,
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: method === 'OPTIONS' ? undefined : JSON.stringify(body),
    }),
  );

const json = async (response) => ({ status: response.status, body: await response.json() });
const rowsOf = (inserts, table) => inserts.filter((entry) => entry.table === table);

async function run() {
  // ── Standard-Setup ─────────────────────────────────────────────────────────
  {
    const fake = createFakeClient({ platformRole: { role: 'platform_admin' } });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'provisionTenant',
        name: 'Büro Test',
        settings: { constituency: 'Karlsruhe-West', party: 'GRÜNE', city: 'Karlsruhe' },
        appName: 'Büro-App',
        appSubtitle: 'Koordination',
        seedMode: 'standard',
        adminUser: { email: 'abgeordneter@example.org', displayName: 'Max Muster' },
      }),
    );

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.tenantId, NEW_TENANT);
    assert.equal(body.report.case_file_types, 8, 'acht Standard-Falltypen');
    assert.equal(body.report.notification_types, 26, '26 Notification-Typen');
    assert.equal(body.report.letter_occasions, 7, 'sieben Briefanlässe');
    assert.deepEqual(fake.columnProblems, [], fake.columnProblems.join(' | '));

    const caseTypes = rowsOf(fake.inserts, 'case_file_types')[0].rows;
    assert.equal(caseTypes.length, 8);
    assert.ok(caseTypes.every((row) => row.label && row.name), 'Falltypen tragen name und label');

    const occasions = rowsOf(fake.inserts, 'letter_occasions')[0].rows;
    assert.equal(occasions.length, 7);
    assert.ok(occasions.every((row) => row.key && row.label), 'Briefanlässe tragen key und label');
    // Array.from überführt die vm-Arrays in die Host-Realm, sonst scheitert deepEqual
    // am unterschiedlichen Array.prototype.
    assert.deepEqual(
      Array.from(occasions, (row) => row.key),
      ['buergeranliegen', 'ministerium', 'einladung', 'gruss', 'parlamentarische_anfrage', 'stellungnahme', 'sonstiges'],
      'Briefanlässe entsprechen der App-Liste',
    );

    const meetingTemplates = rowsOf(fake.inserts, 'meeting_templates')[0].rows;
    assert.equal(meetingTemplates.length, 2);
    assert.ok(
      meetingTemplates.every((row) => row.user_id === ADMIN_ID),
      'Meeting-Vorlagen haben einen Eigentümer',
    );
    assert.ok(
      Array.isArray(meetingTemplates[0].template_items) && meetingTemplates[0].template_items.every((item) => item.title),
      'Agenda liegt in template_items',
    );

    const planningTemplates = rowsOf(fake.inserts, 'planning_templates')[0].rows;
    assert.equal(planningTemplates.length, 1);
    assert.equal(planningTemplates[0].user_id, ADMIN_ID);

    const senders = rowsOf(fake.inserts, 'sender_information');
    assert.equal(senders.length, 1, 'genau ein Standard-Absender');
    const sender = senders[0].rows[0];
    assert.equal(sender.tenant_id, NEW_TENANT);
    assert.equal(sender.created_by, ADMIN_ID, 'created_by ist Pflichtspalte');
    assert.equal(sender.is_default, true);
    assert.equal(sender.name, 'Karlsruhe-West');
    assert.equal(sender.organization, 'GRÜNE');
    assert.equal(sender.wahlkreis_city, 'Karlsruhe');
    assert.equal(body.report.sender_information, 1, 'Absender im Seed-Bericht');
    assert.equal(body.adminEmail, 'abgeordneter@example.org');
    assert.match(body.adminPassword, /\S/, 'Passwort wird zurückgegeben');
    assert.deepEqual(body.report.errors, []);

    const appNames = Array.from(rowsOf(fake.inserts, 'app_settings')[0].rows)
      .filter((row) => row.setting_key === 'app_name' || row.setting_key === 'app_subtitle')
      .map((row) => row.setting_value);
    assert.deepEqual(appNames, ['Büro-App', 'Koordination']);
    assert.equal(rowsOf(fake.inserts, 'audit_log_entries').length, 1, 'Anlage wird auditiert');
    assert.equal(rowsOf(fake.inserts, 'user_tenant_memberships')[0].rows[0].tenant_id, NEW_TENANT);
  }

  // ── Admin-Benutzer scheitert ───────────────────────────────────────────────
  {
    const fake = createFakeClient({
      platformRole: { role: 'platform_admin' },
      createUserError: 'User already registered',
    });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'provisionTenant',
        name: 'Büro Doppelt',
        settings: { constituency: 'Mannheim I' },
        seedMode: 'standard',
        adminUser: { email: 'doppelt@example.org', displayName: 'Doppelt' },
      }),
    );

    assert.equal(status, 200);
    assert.equal(body.success, true, 'das Büro bleibt bestehen');
    assert.equal(body.adminPassword, undefined, 'ohne Benutzer kein Passwort');
    assert.equal(body.adminEmail, 'doppelt@example.org');
    assert.ok(
      body.report.errors.some((entry) => entry.includes('admin user')),
      'Hinweis nennt den fehlenden Admin',
    );
    assert.equal(rowsOf(fake.inserts, 'profiles').length, 0);
    assert.equal(rowsOf(fake.inserts, 'user_tenant_memberships').length, 0);
  }

  // ── Klonen aus einer Vorlage ───────────────────────────────────────────────
  {
    const sourceSender = {
      id: 'sender-src',
      tenant_id: SOURCE_TENANT,
      created_by: 'other-user',
      name: 'Büro Quellkreis',
      organization: 'SPD',
      wahlkreis_email: 'quelle@example.org',
      is_default: true,
      is_active: true,
    };
    const fake = createFakeClient({
      platformRole: { role: 'platform_admin' },
      sourceRows: {
        sender_information: [sourceSender],
        app_settings: [
          { id: 'a1', tenant_id: SOURCE_TENANT, setting_key: 'app_name', setting_value: 'Quell-App' },
          { id: 'a2', tenant_id: SOURCE_TENANT, setting_key: 'app_logo_url', setting_value: 'https://x/logo.png' },
        ],
        case_file_types: [
          { id: 'c1', tenant_id: SOURCE_TENANT, name: 'Bürgeranfrage', label: 'Bürgeranfrage', created_by: 'other-user', created_at: '2026-01-01' },
        ],
      },
    });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'provisionTenant',
        name: 'Büro Neu',
        settings: { constituency: 'Bruchsal', party: 'CDU', city: 'Bruchsal' },
        appName: 'Neue App',
        appSubtitle: 'Neu-Untertitel',
        seedMode: 'clone',
        cloneFromTenantId: SOURCE_TENANT,
      }),
    );

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(fake.columnProblems, [], fake.columnProblems.join(' | '));

    const senderInserts = rowsOf(fake.inserts, 'sender_information');
    assert.equal(senderInserts.length, 1, 'Klonen legt genau den neutralen Absender an');
    assert.equal(senderInserts[0].rows[0].name, 'Bruchsal');
    assert.notEqual(senderInserts[0].rows[0].name, sourceSender.name, 'Quellbüro wandert nicht mit');
    assert.notEqual(senderInserts[0].rows[0].wahlkreis_email, sourceSender.wahlkreis_email);
    assert.equal(senderInserts[0].rows[0].created_by, ADMIN_ID);

    for (const entry of fake.inserts) {
      if (entry.table === 'platform_roles' || entry.table === 'audit_log_entries') continue;
      // Der neutrale Absender wird bewusst neu erzeugt und trägt den handelnden
      // Super-Admin als created_by – nur kopierte Zeilen dürfen das nicht.
      if (entry.table === 'sender_information') continue;
      for (const row of entry.rows) {
        if (row.tenant_id !== undefined) {
          assert.equal(row.tenant_id, NEW_TENANT, `${entry.table} schreibt ins Zielbüro`);
        }
        assert.ok(!('created_by' in row), `${entry.table} übernimmt kein created_by`);
        assert.ok(!('id' in row), `${entry.table} übernimmt keine Fremd-IDs`);
      }
    }

    const clonedCaseTypes = rowsOf(fake.inserts, 'case_file_types');
    assert.equal(clonedCaseTypes.length, 1, 'Falltypen der Vorlage werden kopiert');

    const restored = fake.updates
      .filter((entry) => entry.table === 'app_settings')
      .map((entry) => entry.values.setting_value);
    assert.ok(restored.includes('Neue App'), 'App-Name aus Schritt 1 bleibt erhalten');
    assert.ok(restored.includes('Neu-Untertitel'), 'Untertitel aus Schritt 1 bleibt erhalten');
    assert.equal(body.report.sender_information, 1);
  }

  // ── Nachträgliches Klonen (cloneTenantData) ─────────────────────────────────
  {
    const fake = createFakeClient({
      platformRole: { role: 'platform_admin' },
      sourceRows: {
        sender_information: [
          { id: 's', tenant_id: SOURCE_TENANT, created_by: 'x', name: 'Quelle', organization: 'Y' },
        ],
        meeting_templates: [{ id: 'm', tenant_id: SOURCE_TENANT, name: 'Jour Fixe' }],
      },
    });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'cloneTenantData',
        sourceTenantId: SOURCE_TENANT,
        targetTenantId: NEW_TENANT,
      }),
    );

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(rowsOf(fake.inserts, 'sender_information').length, 0, 'kein Absender-Klon');
    assert.equal(rowsOf(fake.inserts, 'meeting_templates')[0].rows[0].tenant_id, NEW_TENANT);
    assert.equal(
      rowsOf(fake.inserts, 'meeting_templates')[0].rows[0].user_id,
      ADMIN_ID,
      'geklonte Vorlage gehört dem handelnden Super-Admin',
    );
    assert.deepEqual(fake.columnProblems, []);
  }

  // ── Leeres Setup ───────────────────────────────────────────────────────────
  {
    const fake = createFakeClient({ platformRole: { role: 'platform_admin' } });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'provisionTenant',
        name: 'Büro Leer',
        seedMode: 'empty',
      }),
    );

    assert.equal(status, 200);
    assert.equal(rowsOf(fake.inserts, 'sender_information').length, 0, 'leer bleibt leer');
    assert.equal(rowsOf(fake.inserts, 'case_file_types').length, 0);
    assert.equal(body.report.app_settings, 5);
  }

  // ── Kein Superadmin ────────────────────────────────────────────────────────
  {
    const fake = createFakeClient({ platformRole: null });
    const handler = loadHandler(fake.client);
    const { status, body } = await json(
      await call(handler, {
        action: 'provisionTenant',
        name: 'Büro Fremd',
        seedMode: 'standard',
      }),
    );

    assert.equal(status, 403);
    assert.equal(body.success, false);
    assert.deepEqual(fake.inserts, [], 'keine Schreibzugriffe ohne Plattformrolle');
  }

  // ── Der Spaltenprüfer selbst greift ────────────────────────────────────────
  {
    const fake = createFakeClient({ platformRole: { role: 'platform_admin' } });
    fake.client.from('sender_information').insert([{ tenant_id: NEW_TENANT, department: 'Alt' }]);
    assert.ok(
      fake.columnProblems.includes('sender_information: unbekanntes Feld department'),
      'erfundene Spalten werden erkannt',
    );
    const missing = createFakeClient({ platformRole: { role: 'platform_admin' } });
    missing.client.from('meeting_templates').insert([{ name: 'Ohne Eigentümer' }]);
    assert.ok(
      missing.columnProblems.some((entry) => entry.includes('Pflichtfeld user_id fehlt')),
      'fehlende Pflichtspalten werden erkannt',
    );
  }

  console.log(
    'Tenant-Provisionierung geprüft: Standard-Setup, Admin-Fehler, Klonen (samt Absender-Schutz), leeres Setup, Rechteprüfung und Spaltenabgleich.',
  );
}

await run();
