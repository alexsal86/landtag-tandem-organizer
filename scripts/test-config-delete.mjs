// Löschen von Konfiguration darf die Folgenabschätzung nicht umgehen:
// delete_config_item zählt erneut und verlangt die bestätigte Zahl,
// ein direkter DELETE wird vom Guard-Trigger abgewiesen.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const staff = '44444444-4444-4444-8444-444444444444';
const platform = '55555555-5555-4555-8555-555555555555';
const foreignAdmin = '66666666-6666-4666-8666-666666666666';
const dc1 = 'a0000000-0000-4000-8000-000000000001';
const dc2 = 'a0000000-0000-4000-8000-000000000002';
const ts1 = 'e0000000-0000-4000-8000-000000000001';
const tdc1 = '07000000-0000-4000-8000-000000000001';

const migration = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const actor = async (id) => {
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role','authenticated',false)", [id]);
  await db.exec('SET ROLE authenticated');
};
const owner = () => db.exec('RESET ROLE');
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const remove = async (table, id, expected) => (
  await q('SELECT public.delete_config_item($1,$2,$3) AS r', [table, id, expected])
)[0].r;
const impact = async (table, id) => (await q('SELECT public.config_delete_impact($1,$2) AS r', [table, id]))[0].r;

try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TABLE platform_roles(user_id uuid, role text);
    CREATE FUNCTION is_superadmin(who uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM platform_roles WHERE user_id=who AND role='platform_admin') $$;
    CREATE TABLE user_tenant_memberships(user_id uuid, tenant_id uuid, role text, is_active boolean);
    CREATE FUNCTION is_tenant_admin(who uuid, office uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE user_id=who AND tenant_id=office AND is_active
                    AND role IN ('abgeordneter','bueroleitung')) $$;

    CREATE TABLE document_categories(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE case_file_types(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE case_file_processing_statuses(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE task_categories(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE appointment_categories(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE appointment_statuses(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE appointment_locations(id uuid PRIMARY KEY, tenant_id uuid, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE task_statuses(id uuid PRIMARY KEY, name text, label text, is_active boolean DEFAULT true, order_index int DEFAULT 0);
    CREATE TABLE todo_categories(id uuid PRIMARY KEY, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);

    CREATE TABLE documents(id uuid PRIMARY KEY, tenant_id uuid, category text);
    CREATE TABLE case_files(id uuid PRIMARY KEY, tenant_id uuid, case_type text, processing_status text, processing_statuses text[]);
    CREATE TABLE tasks(id uuid PRIMARY KEY, tenant_id uuid, category text, status text);
    CREATE TABLE appointments(id uuid PRIMARY KEY, tenant_id uuid, category text, status text, location text);
    CREATE TABLE todos(id uuid PRIMARY KEY, tenant_id uuid, category_id uuid REFERENCES todo_categories(id) ON DELETE CASCADE);
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  `);

  await db.exec(await migration('20261124230000_config_delete_impact.sql'));
  await db.exec(await migration('20261124240000_config_rename_cascade.sql'));
  await db.exec(await migration('20261124290000_config_delete_guard.sql'));

  await db.exec(`
    INSERT INTO user_tenant_memberships(user_id,tenant_id,role,is_active) VALUES
      ('${admin}','${a}','bueroleitung',true),
      ('${staff}','${a}','mitarbeiter',true),
      ('${foreignAdmin}','${b}','bueroleitung',true);
    INSERT INTO platform_roles VALUES('${platform}','platform_admin');

    INSERT INTO document_categories(id,tenant_id,name,label) VALUES
      ('${dc1}','${a}','rechnung','Rechnung'),
      ('${dc2}','${a}','vertrag','Vertrag');
    INSERT INTO task_statuses(id,name,label) VALUES('${ts1}','offen','Offen');
    INSERT INTO todo_categories(id,name,label) VALUES('${tdc1}','idee','Idee');

    INSERT INTO documents(id,tenant_id,category) VALUES
      ('10000000-0000-4000-8000-000000000001','${a}','rechnung'),
      ('10000000-0000-4000-8000-000000000002','${a}','rechnung'),
      ('10000000-0000-4000-8000-000000000003','${b}','rechnung');
    INSERT INTO tasks(id,tenant_id,category,status) VALUES
      ('30000000-0000-4000-8000-000000000001','${a}',NULL,'offen'),
      ('30000000-0000-4000-8000-000000000002','${b}',NULL,'offen');
    INSERT INTO todos(id,tenant_id,category_id) VALUES('50000000-0000-4000-8000-000000000001','${a}','${tdc1}');
  `);

  await actor(admin);

  // 1. Auskunft ist unverändert die gemeinsame Zählung (eigenes Büro, nicht fremdes).
  assert.equal((await impact('document_categories', dc1)).total, 2);

  // 2. Ein direkter DELETE umgeht die Zählung nicht mehr.
  await assert.rejects(
    q('DELETE FROM public.document_categories WHERE id=$1', [dc2]),
    (error) => error.code === '55000',
    'Direkter DELETE wird vom Guard-Trigger abgewiesen',
  );
  assert.equal((await q('SELECT count(*)::int AS n FROM document_categories WHERE id=$1', [dc2]))[0].n, 1);

  // 3. Falsche (überholte) Bestätigung löscht nichts: dc1 wird zweimal verwendet.
  await assert.rejects(
    remove('document_categories', dc1, 0),
    (error) => error.code === '55000' && /erneut prüfen/.test(error.message),
  );
  assert.equal((await impact('document_categories', dc1)).total, 2, 'Eintrag existiert weiterhin');
  assert.equal((await q('SELECT count(*)::int AS n FROM document_categories'))[0].n, 2);

  // 4. Bestätigte Zahl löscht; Textverweise in Dokumenten bleiben erhalten.
  const deleted = await remove('document_categories', dc1, 2);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.confirmed, 2);
  assert.equal((await q('SELECT count(*)::int AS n FROM document_categories'))[0].n, 1);
  assert.equal((await q('SELECT count(*)::int AS n FROM documents'))[0].n, 3, 'Dokumente bleiben, nur die Kategorie fehlt');

  // 5. Die Freigabe gilt nur für die eine Transaktion und nur für diesen Eintrag.
  await assert.rejects(
    q('DELETE FROM public.document_categories WHERE id=$1', [dc2]),
    (error) => error.code === '55000',
    'Nach dem RPC ist kein zweiter Direktzugriff freigeschaltet',
  );

  // 6. Nicht-Admin und fremdes Büro werden abgewiesen.
  await actor(staff);
  await assert.rejects(remove('document_categories', dc2, 0), (error) => error.code === '42501');
  await actor(foreignAdmin);
  await assert.rejects(remove('document_categories', dc2, 0), (error) => error.code === '42501');

  // 7. Plattformweite Konfiguration nur für Plattformrechte; Zählung ist büroübergreifend.
  await actor(admin);
  await assert.rejects(remove('task_statuses', ts1, 2), (error) => error.code === '42501');
  await actor(platform);
  assert.equal((await remove('task_statuses', ts1, 2)).total, 2);

  // 8. ToDo-Kategorie ist plattformweit: bestätigte Zahl löscht die kaskadierenden ToDos mit.
  await actor(platform);
  assert.equal((await remove('todo_categories', tdc1, 1)).total, 1);
  assert.equal((await q('SELECT count(*)::int AS n FROM todos'))[0].n, 0);

  // 9. Deaktivieren bleibt erlaubt – der Guard hängt nur am Löschen.
  await actor(admin);
  await q('UPDATE public.document_categories SET is_active=false WHERE id=$1', [dc2]);
  assert.equal((await q('SELECT is_active FROM document_categories WHERE id=$1', [dc2]))[0].is_active, false);

  // 10. Unbekannte Tabellen und fehlende Bestätigung werden abgelehnt.
  await assert.rejects(remove('tenants', dc2, 0), (error) => error.code === '22023');
  await assert.rejects(remove('document_categories', dc2, -1), (error) => error.code === '22023');

  await owner();
  console.log('Config delete passed: direct deletes blocked by trigger, stale confirmations refused, permissions and platform scope enforced, cascade documented.');
} finally {
  await db.close();
}
