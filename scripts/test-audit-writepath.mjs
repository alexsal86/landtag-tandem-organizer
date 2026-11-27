// Prüft den Audit-Schreibpfad in einem isolierten PostgreSQL (PGlite):
//   20261128110000_audit_writepath_security_events.sql  (action-Spalte, Tenants, Freigabe)
//   20261128120000_audit_gdpr_request_events.sql         (Anlegen/Zurückziehen von Anträgen)
// Keine Verbindung zur echten Datenbank.
//
// Ausführen:
//   npm ci --prefix tests/database
//   node scripts/test-audit-writepath.mjs
//   # oder gesammelt:
//   npm --prefix tests/database test
//
// Abhängigkeit: @electric-sql/pglite ist NICHT im Wurzel-package.json deklariert,
// sondern als devDependency in tests/database/package.json gepinnt (0.5.15) und
// wird – wie in allen PGlite-Skripten dieses Repos – über den Pfad importiert.
// Fehlt der Ordner tests/database/node_modules, bricht dieses Skript mit einem
// Hinweis ab (Exitcode 2) statt mit einem Module-Resolution-Fehler.
// Alternative ohne Installation im Repo: PGLITE_MODULE_PATH auf
// .../@electric-sql/pglite/dist/index.js setzen.
//
// Was dieser Harness bewusst NICHT prüft, steht am Ende der Ausgabe und in
// docs/audit-writepath.md (Vier-Augen-Trigger, RLS, Grants, echtes JWT).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const pgliteModule = process.env.PGLITE_MODULE_PATH
  ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href
  : new URL("../tests/database/node_modules/@electric-sql/pglite/dist/index.js", import.meta.url).href;

let PGlite;
try {
  ({ PGlite } = await import(pgliteModule));
} catch {
  console.error(
    [
      "PGlite ist nicht verfügbar.",
      "",
      "  npm ci --prefix tests/database",
      "",
      "oder:",
      "",
      "  PGLITE_MODULE_PATH=/pfad/zu/@electric-sql/pglite/dist/index.js node scripts/test-audit-writepath.mjs",
      "",
      "Die Abhängigkeit ist in tests/database/package.json deklariert, nicht im Wurzel-package.json.",
    ].join("\n"),
  );
  process.exit(2);
}

const MIGRATIONS = [
  "supabase/migrations/20261128110000_audit_writepath_security_events.sql",
  "supabase/migrations/20261128120000_audit_gdpr_request_events.sql",
];
const migrations = await Promise.all(
  MIGRATIONS.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")),
);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";
const REQUESTER = "44444444-4444-4444-8444-444444444444";
const APPROVER = "55555555-5555-4555-8555-555555555555";
const MEMBER = "66666666-6666-4666-8666-666666666666";
const MISSING = "77777777-7777-4777-8777-777777777777";

const db = new PGlite();
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const exec = (sql) => db.exec(sql);
const setActor = (userId) => exec(`select set_config('test.uid','${userId}',false), set_config('test.role','authenticated',false)`);

let failures = 0;
async function check(label, run) {
  try {
    await run();
    console.log(`✓ ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`✗ ${label}`);
    console.log(`    ${error.message.split("\n")[0]}`);
  }
}

const rejectsWith = (promise, code) =>
  assert.rejects(promise, (error) => error?.code === code, `erwartet PostgreSQL-Code ${code}`);

try {
  // Minimalumfeld: nur die Schnittstellen, die die Migration berührt.
  await exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated')
    $$;
    create table public.tenants(id uuid primary key);
    create table public.profiles(user_id uuid primary key, display_name text, tenant_id uuid);
    create table public.user_tenant_memberships(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, tenant_id uuid not null,
      is_active boolean not null default true, role text);
    create table public.user_roles(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, role text not null,
      assigned_at timestamptz default now(), assigned_by uuid);
    create table public.audit_log_entries(
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      ip_address text, payload jsonb, user_id uuid, tenant_id uuid);
    create table public.gdpr_requests(
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null, request_type text not null, status text not null default 'pending',
      subject_contact_id uuid, subject_email text, subject_name text, reason text,
      requested_by uuid not null, approved_by uuid, approved_at timestamptz, processed_at timestamptz,
      result_storage_path text, result_summary jsonb, error_message text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create function public.is_superadmin(_user_id uuid) returns boolean language sql stable as $$
      select false
    $$;
    insert into public.tenants(id) values ('${A}'), ('${B}'), ('${FOREIGN}');
    insert into public.user_tenant_memberships(user_id, tenant_id, is_active) values
      ('${APPROVER}', '${A}', true),
      ('${MEMBER}', '${A}', true),
      ('${MEMBER}', '${B}', true);
    -- Altzeile des bisherigen Schreibpfads: Aktion nur im Payload, keine action-Spalte.
    insert into public.audit_log_entries(user_id, payload) values
      ('${MEMBER}', '{"action":"letter.sent","letter_id":"x"}');
  `);

  for (const sql of migrations) await exec(sql);
  // Zweiter Lauf: Migrationen müssen wiederholbar bleiben.
  for (const sql of migrations) await exec(sql);

  // In der echten Datenbank hängt der Trigger seit der Rollen-Migration an der
  // Tabelle; die neue Fassung ersetzt nur den Funktionskörper.
  await exec(`
    create trigger audit_user_roles_trigger
      after insert or update or delete on public.user_roles
      for each row execute function public.audit_user_role_changes();
  `);

  await check("Migration läuft zweimal ohne Fehler", async () => {
    const [row] = await rows(`select count(*)::int as n from public.audit_log_entries`);
    assert.ok(row.n >= 1, "Bestandszeile bleibt erhalten");
  });

  await check("action-Spalte: Backfill aus dem Payload, Default und Index", async () => {
    const [legacy] = await rows(
      `select action from public.audit_log_entries where payload->>'action' = 'letter.sent'`,
    );
    assert.equal(legacy.action, "letter.sent");
    const [fallback] = await rows(
      `insert into public.audit_log_entries(user_id, payload)
       values ('${MEMBER}', '{"without":"action"}') returning action`,
    );
    assert.equal(fallback.action, "unknown");
    const [index] = await rows(
      `select indexdef from pg_indexes
       where tablename = 'audit_log_entries' and indexname = 'idx_audit_log_tenant_action_created'`,
    );
    assert.match(index.indexdef, /\(tenant_id, action, created_at DESC\)/);
  });

  await check("action-Format wird für neue Zeilen geprüft", async () => {
    await rejectsWith(
      exec(`insert into public.audit_log_entries(action) values ('Aktion mit Leerzeichen')`),
      "23514",
    );
  });

  await check("record_audit_entry schreibt action, Büro und Urheber", async () => {
    await setActor(MEMBER);
    await rows(
      `select public.record_audit_entry('security.access_denied','${A}',
         '{"resource":"contacts","method":"POST","code":"42501"}')`,
    );
    const [entry] = await rows(
      `select action, tenant_id, user_id, payload from public.audit_log_entries
       where action = 'security.access_denied' order by created_at desc limit 1`,
    );
    assert.equal(entry.tenant_id, A);
    assert.equal(entry.user_id, MEMBER);
    assert.equal(entry.payload.resource, "contacts");
    assert.equal(entry.payload.action, "security.access_denied");
  });

  await check("record_audit_entry überschreibt eine gefälschte Aktion im Payload", async () => {
    await setActor(MEMBER);
    await rows(
      `select public.record_audit_entry('security.access_denied','${A}',
         '{"action":"user.role_assigned","role":"superadmin"}')`,
    );
    const [entry] = await rows(
      `select action, payload->>'action' as payload_action, payload->>'role' as role
       from public.audit_log_entries where action = 'security.access_denied'
       order by created_at desc limit 1`,
    );
    assert.equal(entry.payload_action, "security.access_denied");
    assert.equal(entry.role, "superadmin", "Details bleiben erhalten, nur die Aktion ist verbindlich");
  });

  await check("record_audit_entry begrenzt Büro, Aktionsart und Detailgröße", async () => {
    await setActor(MEMBER);
    await rejectsWith(
      rows(`select public.record_audit_entry('security.access_denied','${FOREIGN}','{}')`),
      "42501",
    );
    await rejectsWith(
      rows(`select public.record_audit_entry('user.role_changed','${A}','{}')`),
      "22023",
    );
    await rejectsWith(
      rows(`select public.record_audit_entry('security.access_denied','${A}', $1::jsonb)`, [
        JSON.stringify({ blob: "x".repeat(5000) }),
      ]),
      "22023",
    );
  });

  await check("Rollen-Trigger schreibt je aktivem Büro der betroffenen Person", async () => {
    await setActor(APPROVER);
    await rows(`insert into public.user_roles(user_id, role) values ('${MEMBER}','bueroleitung')`);
    const entries = await rows(
      `select tenant_id, payload->>'role' as role from public.audit_log_entries
       where action = 'user.role_assigned' order by tenant_id`,
    );
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.tenant_id).sort(), [A, B].sort());
    assert.equal(entries[0].role, "bueroleitung");
  });

  await check("DSGVO-Freigabe erzeugt ein Ereignis mit Büro und Antragsteller", async () => {
    const [request] = await rows(
      `insert into public.gdpr_requests(tenant_id, request_type, requested_by, subject_contact_id)
       values ('${A}','delete','${REQUESTER}', gen_random_uuid()) returning id`,
    );
    await setActor(APPROVER);
    await rows(`select public.approve_gdpr_delete('${request.id}')`);
    const [approved] = await rows(
      `select status from public.gdpr_requests where id = '${request.id}'`,
    );
    assert.equal(approved.status, "approved");
    const [entry] = await rows(
      `select tenant_id, user_id, payload from public.audit_log_entries
       where action = 'security.gdpr.delete_approved'`,
    );
    assert.equal(entry.tenant_id, A);
    assert.equal(entry.user_id, APPROVER);
    assert.equal(entry.payload.request_id, request.id);
    assert.equal(entry.payload.requested_by, REQUESTER);
  });

  await check("Anlegen eines DSGVO-Antrags wird ohne Personendaten protokolliert", async () => {
    await setActor(REQUESTER);
    const [request] = await rows(
      `insert into public.gdpr_requests(tenant_id, request_type, requested_by,
         subject_contact_id, subject_email, subject_name)
       values ('${A}','delete','${REQUESTER}', gen_random_uuid(), 'betroffen@example.org', 'Betroffene Person')
       returning id`,
    );
    const [entry] = await rows(
      `select tenant_id, user_id, payload from public.audit_log_entries
       where action = 'security.gdpr.request_created' and payload->>'request_id' = '${request.id}'`,
    );
    assert.equal(entry.tenant_id, A);
    assert.equal(entry.user_id, REQUESTER);
    assert.equal(entry.payload.request_type, "delete");
    assert.equal(entry.payload.status, "pending");
    assert.ok(
      !("subject_email" in entry.payload) && !("subject_name" in entry.payload),
      "Ereignis enthält keine Personendaten des Antrags",
    );
  });

  await check("Zurückziehen eines DSGVO-Antrags wird protokolliert", async () => {
    await setActor(REQUESTER);
    const [request] = await rows(
      `insert into public.gdpr_requests(tenant_id, request_type, requested_by)
       values ('${A}','delete','${REQUESTER}') returning id`,
    );
    await rows(`delete from public.gdpr_requests where id = '${request.id}'`);
    const [entry] = await rows(
      `select tenant_id, user_id from public.audit_log_entries
       where action = 'security.gdpr.request_withdrawn' and payload->>'request_id' = '${request.id}'`,
    );
    assert.equal(entry.tenant_id, A);
    assert.equal(entry.user_id, REQUESTER);
  });

  await check("Antrag eines nicht mehr vorhandenen Büros bleibt mandantenfrei", async () => {
    // gdpr_requests hat keinen Fremdschlüssel auf tenants; der Trigger löst über eine
    // Unterabfrage auf und darf nicht am Fremdschlüssel von audit_log_entries scheitern.
    await setActor(REQUESTER);
    const [request] = await rows(
      `insert into public.gdpr_requests(tenant_id, request_type, requested_by)
       values ('${MISSING}','export','${REQUESTER}') returning id`,
    );
    const [entry] = await rows(
      `select tenant_id from public.audit_log_entries
       where action = 'security.gdpr.request_created' and payload->>'request_id' = '${request.id}'`,
    );
    assert.equal(entry.tenant_id, null);
  });

  await check("DSGVO-Freigabe einer unbekannten Anfrage bleibt abgewiesen", async () => {
    await setActor(APPROVER);
    await rejectsWith(
      rows(`select public.approve_gdpr_delete('${"99999999-9999-4999-8999-999999999999"}')`),
      "P0001",
    );
  });

  await check("log_audit_event setzt Aktion und Büro aus der Zeile", async () => {
    await exec(`
      create table public.contacts_demo(id uuid primary key default gen_random_uuid(), tenant_id uuid);
      create trigger contacts_demo_audit after insert or update or delete on public.contacts_demo
        for each row execute function public.log_audit_event();
    `);
    await rows(`insert into public.contacts_demo(tenant_id) values ('${B}')`);
    const [entry] = await rows(
      `select action, tenant_id from public.audit_log_entries where action = 'contacts_demo.insert'`,
    );
    assert.equal(entry.tenant_id, B);
  });

  await check("audit_request_ip bleibt ohne Kopfzeilen leer", async () => {
    const [entry] = await rows(`select public.audit_request_ip() as ip`);
    assert.equal(entry.ip, null);
  });
} finally {
  await db.close();
}

console.log("");
console.log("Nicht abgedeckt durch diesen Harness (siehe docs/audit-writepath.md):");
console.log("  · Vier-Augen-Trigger gdpr_check_four_eyes und guard_gdpr_request_subject");
console.log("  · RLS-Policies auf audit_log_entries (Superuser-Umgebung, keine Rollentrennung)");
console.log("  · Wirkung der GRANT/REVOKE-Anweisungen (nur ihre Ausführbarkeit)");
console.log("  · echtes JWT/PostgREST (auth.uid/auth.role sind GUC-Stubs, keine Kopfzeilen)");
console.log("  · Edge Functions und die clientseitige 42501-Meldung");
console.log("");

if (failures > 0) {
  console.error(`${failures} Prüfung(en) fehlgeschlagen.`);
  process.exit(1);
}
console.log("Alle Prüfungen bestanden.");
