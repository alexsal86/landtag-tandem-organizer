// Kernstatus der Aufgaben: fehlende Registry-Werte werden wiederhergestellt,
// technische Namen sind gegen Umbenennen/Löschen geschützt, der Anzeigename
// bleibt änderbar. Ausgangslage ist der gemeldete Selbsttest-Fehler:
// eine Aufgabe mit status 'todo' wird abgewiesen, weil task_statuses den Wert
// durch eine Label-Umbenennung verloren hat.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const staff = '44444444-4444-4444-8444-444444444444';
const platform = '55555555-5555-4555-8555-555555555555';
const tsRenamed = 'e0000000-0000-4000-8000-000000000001';

const migration = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const actor = async (id) => {
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role','authenticated',false)", [id]);
  await db.exec('SET ROLE authenticated');
};
const owner = () => db.exec('RESET ROLE');
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const renameStatus = async (id, label) => (
  await q('SELECT public.rename_config_item($1,$2,$3) AS r', ['task_statuses', id, label])
)[0].r;
const insertTask = (status) => (
  status === undefined
    ? db.query('INSERT INTO tasks(tenant_id) VALUES($1)', [a])
    : db.query('INSERT INTO tasks(tenant_id,status) VALUES($1,$2)', [a, status])
);

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
    CREATE TABLE task_statuses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0, updated_at timestamptz DEFAULT now());
    CREATE TABLE todo_categories(id uuid PRIMARY KEY, name text, label text, color text, icon text, is_active boolean DEFAULT true, order_index int DEFAULT 0);

    CREATE TABLE documents(id uuid PRIMARY KEY, tenant_id uuid, category text);
    CREATE TABLE case_files(id uuid PRIMARY KEY, tenant_id uuid, case_type text, processing_status text, processing_statuses text[]);
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, category text, status text DEFAULT 'todo', updated_at timestamptz DEFAULT now());
    CREATE TABLE letters(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text);
    CREATE TABLE appointments(id uuid PRIMARY KEY, tenant_id uuid, category text, status text, location text);
    CREATE TABLE todos(id uuid PRIMARY KEY, tenant_id uuid, category_id uuid);
    CREATE TABLE automation_rules(id uuid PRIMARY KEY, tenant_id uuid, module text, name text, trigger_config jsonb, conditions jsonb, actions jsonb);
    CREATE TABLE workflow_definitions(id uuid PRIMARY KEY, tenant_id uuid, name text, trigger_config jsonb, conditions jsonb, actions jsonb);

    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  `);

  await db.exec(await migration('20261124230000_config_delete_impact.sql'));
  await db.exec(await migration('20261124240000_config_rename_cascade.sql'));
  await db.exec(await migration('20261124300000_config_rename_automation_refs.sql'));
  await db.exec(await migration('20261124290000_config_delete_guard.sql'));
  await db.exec(await migration('20261125130000_align_task_and_letter_status_values.sql'));

  // Ausgangslage: die Registry führt 'todo' nicht mehr, weil die Bezeichnung
  // "To-Do" zuletzt auf den technischen Namen 'to_do' durchgeschlagen ist.
  await db.exec(`
    INSERT INTO user_tenant_memberships(user_id,tenant_id,role,is_active) VALUES
      ('${staff}','${a}','mitarbeiter',true);
    INSERT INTO platform_roles VALUES('${platform}','platform_admin');
    INSERT INTO task_statuses(id,name,label,order_index)
      VALUES('${tsRenamed}','to_do','To-Do',0);
    INSERT INTO task_statuses(name,label,order_index) VALUES
      ('in_progress','In Bearbeitung',1), ('completed','Erledigt',2),
      ('cancelled','Abgebrochen',3), ('review','Zur Überprüfung',4);
  `);

  // Der gemeldete Fehler: Status 'todo' ist nicht registriert.
  await assert.rejects(insertTask('todo'), (error) => error.code === '22023');
  await assert.rejects(insertTask(), (error) => error.code === '22023', 'auch der Spalten-Default trifft');

  // Reparatur und Schutz.
  await db.exec(await migration('20261126130000_protect_core_task_statuses.sql'));

  assert.equal((await q("SELECT count(*)::int AS n FROM task_statuses WHERE name='todo'"))[0].n, 1, 'todo wird wiederhergestellt');
  await insertTask('todo');
  await insertTask();
  assert.deepEqual(
    (await q('SELECT status FROM tasks ORDER BY status')).map((row) => row.status),
    ['todo', 'todo'],
    'Aufgaben mit todo und dem Default werden wieder angenommen',
  );

  const todoId = (await q("SELECT id FROM task_statuses WHERE name='todo'"))[0].id;
  await actor(platform);
  const relabel = await renameStatus(todoId, 'Offen');
  assert.equal(relabel.new_name, 'todo', 'Anzeigename ändert den technischen Schlüssel nicht');
  assert.equal(relabel.label, 'Offen');
  assert.equal(relabel.total, 0, 'keine Verweise nachzuziehen');
  assert.deepEqual(relabel.updated, []);
  assert.equal((await q("SELECT label FROM task_statuses WHERE name='todo'"))[0].label, 'Offen');
  assert.deepEqual(
    (await q('SELECT status FROM tasks ORDER BY status')).map((row) => row.status),
    ['todo', 'todo'],
    'vorhandene Aufgaben behalten den Statuswert',
  );

  // Bezeichnungskollision wird wie bei allen Konfigurationen abgelehnt.
  await owner();
  await db.query("INSERT INTO task_statuses(name,label,order_index) VALUES('custom','Offen',9)");
  await actor(platform);
  await assert.rejects(renameStatus(todoId, 'Offen'), (error) => error.code === '23505');

  // Nicht-Plattformadmin darf den Kernstatus nicht umbenennen.
  await actor(staff);
  await assert.rejects(renameStatus(todoId, 'Noch offen'), (error) => error.code === '42501');

  // Direktes Umbenennen und Löschen bleibt gesperrt, auch für delete_config_item.
  await owner();
  await assert.rejects(
    db.query("UPDATE task_statuses SET name='offen' WHERE name='todo'"),
    (error) => error.code === '22023',
  );
  await actor(platform);
  const impact = (await q('SELECT public.config_delete_impact($1,$2) AS r', ['task_statuses', todoId]))[0].r;
  await assert.rejects(
    q('SELECT public.delete_config_item($1,$2,$3)', ['task_statuses', todoId, impact.total]),
    (error) => error.code === '22023',
  );

  // Andere (nicht vom Code geschriebene) Status lassen sich weiterhin
  // umbenennen, der bestehende Verweis-Nachzug greift.
  await owner();
  await db.query("INSERT INTO task_statuses(name,label,order_index) VALUES('in_arbeit','In Arbeit',10)");
  await db.query("INSERT INTO tasks(tenant_id,status) VALUES($1,'in_arbeit')", [a]);
  await actor(platform);
  const customId = (await q("SELECT id FROM task_statuses WHERE name='in_arbeit'"))[0].id;
  const custom = await renameStatus(customId, 'In Arbeit neu');
  assert.equal(custom.new_name, 'in_arbeit_neu');
  assert.equal(custom.total, 1);
  assert.deepEqual((await q("SELECT status FROM tasks WHERE status LIKE 'in_arbeit%'")).map((row) => row.status), ['in_arbeit_neu']);

  // Die Registry-Prüfung selbst bleibt streng.
  await owner();
  await assert.rejects(insertTask('quatsch'), (error) => error.code === '22023');

  await owner();
  console.log('Core task statuses passed: missing entries restored, keys protected, labels editable, other statuses still renameable.');
} finally {
  await db.close();
}
