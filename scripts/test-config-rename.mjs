// Umbenennen von Konfiguration muss die referenzierten name/label-Werte mitziehen
// und unsichere Fälle (fremdes Büro, Kollision, mehrdeutiger Altname) ablehnen.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const staff = '44444444-4444-4444-8444-444444444444';
const platform = '55555555-5555-4555-8555-555555555555';
const dc1 = 'a0000000-0000-4000-8000-000000000001';
const dc2 = 'a0000000-0000-4000-8000-000000000002';
const dc3 = 'a0000000-0000-4000-8000-000000000003';
const ft1 = 'b0000000-0000-4000-8000-000000000001';
const ps1 = 'c0000000-0000-4000-8000-000000000001';
const tc1 = 'd0000000-0000-4000-8000-000000000001';
const ts1 = 'e0000000-0000-4000-8000-000000000001';
const ac1 = 'f0000000-0000-4000-8000-000000000001';
const al1 = 'f0000000-0000-4000-8000-000000000002';
const tdc1 = '07000000-0000-4000-8000-000000000001';
const ts2 = 'e0000000-0000-4000-8000-000000000002';
const tc2 = 'd0000000-0000-4000-8000-000000000002';
const r1 = '90000000-0000-4000-8000-000000000001';
const r2 = '90000000-0000-4000-8000-000000000002';
const r3 = '90000000-0000-4000-8000-000000000003';
const w1 = '91000000-0000-4000-8000-000000000001';

const migration = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const actor = async (id) => {
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role','authenticated',false)", [id]);
  await db.exec('SET ROLE authenticated');
};
const owner = () => db.exec('RESET ROLE');
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const rename = async (table, id, label, extra = {}) => (
  await q(
    'SELECT public.rename_config_item($1,$2,$3,$4,$5,$6,$7) AS r',
    [table, id, label, extra.color ?? null, extra.icon ?? null, extra.setColor ?? false, extra.setIcon ?? false],
  )
)[0].r;

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
    CREATE TABLE todos(id uuid PRIMARY KEY, tenant_id uuid, category_id uuid);
    CREATE TABLE automation_rules(id uuid PRIMARY KEY, tenant_id uuid, module text, name text, trigger_config jsonb, conditions jsonb, actions jsonb);
    CREATE TABLE workflow_definitions(id uuid PRIMARY KEY, tenant_id uuid, name text, trigger_config jsonb, conditions jsonb, actions jsonb);
    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  `);

  await db.exec(await migration('20261124230000_config_delete_impact.sql'));
  await db.exec(await migration('20261124240000_config_rename_cascade.sql'));
  await db.exec(await migration('20261124300000_config_rename_automation_refs.sql'));

  await db.exec(`
    INSERT INTO user_tenant_memberships(user_id,tenant_id,role,is_active) VALUES
      ('${admin}','${a}','bueroleitung',true), ('${staff}','${a}','mitarbeiter',true);
    INSERT INTO platform_roles VALUES('${platform}','platform_admin');

    INSERT INTO document_categories(id,tenant_id,name,label) VALUES
      ('${dc1}','${a}','rechnung','Rechnung'),
      ('${dc2}','${a}','vertrag','Vertrag'),
      ('${dc3}','${a}','vertrag_kopie','Vertrag');
    INSERT INTO case_file_types(id,tenant_id,name,label) VALUES('${ft1}','${a}','buergeranliegen','Bürgeranliegen');
    INSERT INTO case_file_processing_statuses(id,tenant_id,name,label) VALUES('${ps1}','${a}','in_pruefung','In Prüfung');
    INSERT INTO task_categories(id,tenant_id,name,label) VALUES('${tc1}','${a}','personal','Personal');
    INSERT INTO task_statuses(id,name,label) VALUES('${ts1}','offen','Offen');
    INSERT INTO appointment_categories(id,tenant_id,name,label) VALUES('${ac1}','${a}','termin','Termin');
    INSERT INTO appointment_locations(id,tenant_id,name,label) VALUES('${al1}','${a}','buero','Büro');
    INSERT INTO todo_categories(id,name,label) VALUES('${tdc1}','idee','Idee');

    INSERT INTO documents(id,tenant_id,category) VALUES
      ('10000000-0000-4000-8000-000000000001','${a}','rechnung'),
      ('10000000-0000-4000-8000-000000000002','${a}','Rechnung'),
      ('10000000-0000-4000-8000-000000000003','${b}','rechnung');
    INSERT INTO case_files(id,tenant_id,case_type,processing_status,processing_statuses) VALUES
      ('20000000-0000-4000-8000-000000000001','${a}','buergeranliegen','in_pruefung',ARRAY['in_pruefung','abgeschlossen']),
      ('20000000-0000-4000-8000-000000000002','${a}','buergeranliegen',NULL,ARRAY['abgeschlossen','in_pruefung','in_pruefung']);
    INSERT INTO tasks(id,tenant_id,category,status) VALUES
      ('30000000-0000-4000-8000-000000000001','${a}','personal','offen'),
      ('30000000-0000-4000-8000-000000000002','${b}','personal','offen');
    INSERT INTO appointments(id,tenant_id,category,status,location) VALUES
      ('40000000-0000-4000-8000-000000000001','${a}','termin','offen','buero'),
      ('40000000-0000-4000-8000-000000000002','${b}','termin','offen','buero');
    INSERT INTO todos(id,tenant_id,category_id) VALUES('50000000-0000-4000-8000-000000000001','${a}','${tdc1}');
  `);

  await actor(admin);

  // 1. Umbenennen zieht name- und label-Verweise im eigenen Büro mit.
  const docs = await rename('document_categories', dc1, 'Rechnungen 2026');
  assert.equal(docs.new_name, 'rechnungen_2026');
  assert.equal(docs.total, 2);
  assert.deepEqual(docs.updated, [{ key: 'documents', label: 'Dokument', count: 2 }]);
  assert.deepEqual(
    (await q('SELECT category FROM documents ORDER BY id')).map((row) => row.category),
    ['rechnungen_2026', 'rechnungen_2026', 'rechnung'],
    'Fremdes Büro bleibt unverändert',
  );

  // 2. Die Folgenabschätzung findet die Verwendung nach dem Umbenennen weiterhin.
  const impact = (await q('SELECT public.config_delete_impact($1,$2) AS r', ['document_categories', dc1]))[0].r;
  assert.equal(impact.total, 2);
  assert.equal(impact.references[0].key, 'documents');

  // 3. Fallakten-Typ und Bearbeitungsstatus inklusive Array (dedupliziert, Reihenfolge erhalten).
  const typeRename = await rename('case_file_types', ft1, 'Bürgeranliegen neu');
  assert.equal(typeRename.new_name, 'bürgeranliegen_neu');
  assert.equal(typeRename.total, 2);
  assert.equal((await q('SELECT case_type FROM case_files WHERE id=$1', ['20000000-0000-4000-8000-000000000001']))[0].case_type, 'bürgeranliegen_neu');

  const statusRename = await rename('case_file_processing_statuses', ps1, 'Prüfung läuft');
  assert.equal(statusRename.new_name, 'prüfung_läuft');
  const files = await q('SELECT processing_status, processing_statuses FROM case_files ORDER BY id');
  assert.equal(files[0].processing_status, 'prüfung_läuft');
  assert.deepEqual(files[0].processing_statuses, ['prüfung_läuft', 'abgeschlossen']);
  assert.deepEqual(files[1].processing_statuses, ['abgeschlossen', 'prüfung_läuft'], 'Duplikate werden entfernt, Reihenfolge bleibt');

  // 4. Bürobezogene Konfiguration ändert keine fremden Büros.
  await rename('task_categories', tc1, 'Personal & Team');
  assert.deepEqual(
    (await q('SELECT category FROM tasks ORDER BY id')).map((row) => row.category),
    ['personal_&_team', 'personal'],
  );
  await rename('appointment_locations', al1, 'Büro Nord');
  assert.deepEqual(
    (await q('SELECT location FROM appointments ORDER BY id')).map((row) => row.location),
    ['büro_nord', 'buero'],
  );

  // 5. Plattformweite Konfiguration zieht alle Büros mit (nur Plattformrechte).
  await actor(platform);
  const status = await rename('task_statuses', ts1, 'Offen neu');
  assert.equal(status.new_name, 'offen_neu');
  assert.equal(status.total, 2);
  assert.deepEqual((await q('SELECT status FROM tasks ORDER BY id')).map((row) => row.status), ['offen_neu', 'offen_neu']);

  // 6. Nicht-Admin darf nicht umbenennen.
  await actor(staff);
  await assert.rejects(rename('document_categories', dc1, 'Fremd'), (error) => error.code === '42501');

  await actor(admin);

  // 7. Kollision mit vorhandener Bezeichnung wird abgelehnt und ändert nichts.
  await assert.rejects(rename('document_categories', dc2, 'Rechnungen 2026'), (error) => error.code === '23505');
  assert.equal((await q('SELECT name FROM document_categories WHERE id=$1', [dc2]))[0].name, 'vertrag');

  // 8. Mehrdeutiger Altname (dc3 trägt dasselbe Label) wird abgelehnt.
  await assert.rejects(rename('document_categories', dc2, 'Verträge'), (error) => error.code === '23505');
  assert.equal((await q('SELECT name FROM document_categories WHERE id=$1', [dc2]))[0].name, 'vertrag');

  // 9. Stilwerte werden atomar mitgeschrieben; Tabellen ohne Spalte ignorieren sie.
  const styled = await rename('document_categories', dc1, 'Rechnungen 2027', { color: '#ff0000', setColor: true });
  assert.equal(styled.new_name, 'rechnungen_2027');
  assert.equal((await q('SELECT color FROM document_categories WHERE id=$1', [dc1]))[0].color, '#ff0000');
  assert.deepEqual(
    (await q('SELECT category FROM documents WHERE tenant_id=$1 ORDER BY id', [a])).map((row) => row.category),
    ['rechnungen_2027', 'rechnungen_2027'],
  );
  await actor(platform);
  await rename('task_statuses', ts1, 'Offen neu', { color: '#00ff00', setColor: true });
  assert.equal((await q('SELECT label FROM task_statuses WHERE id=$1', [ts1]))[0].label, 'Offen neu');

  // 10. ToDo-Kategorien bleiben über die ID verknüpft (plattformweit).
  await actor(platform);
  const todos = await rename('todo_categories', tdc1, 'Ideen');
  assert.equal(todos.new_name, 'ideen');
  assert.equal((await q('SELECT category_id FROM todos WHERE id=$1', ['50000000-0000-4000-8000-000000000001']))[0].category_id, tdc1);

  // 11. Automatisierung: Statuswerte in Regeln aller Büros werden mitgezogen;
  //     fremde Module und Status auf anderen Tabellen bleiben unangetastet.
  await owner();
  await db.exec(`
    INSERT INTO task_statuses(id,name,label) VALUES('${ts2}','in_arbeit','In Arbeit');
    INSERT INTO task_categories(id,tenant_id,name,label) VALUES('${tc2}','${a}','presse','Presse');
    INSERT INTO automation_rules(id,tenant_id,module,name,trigger_config,conditions,actions) VALUES
      ('${r1}','${a}','tasks','Statusregel',
       '{"field":"status","value":"in_arbeit"}',
       '{"all":[{"field":"status","operator":"equals","value":"in_arbeit"},{"field":"priority","operator":"equals","value":"in_arbeit"}]}',
       '[{"type":"create_task","payload":{"table":"tasks","category":"presse","status":"in_arbeit"}},{"type":"update_record_status","payload":{"table":"decisions","status":"in_arbeit"}}]'),
      ('${r2}','${b}','tasks','Statusregel anderes Büro','{"field":"status","value":"in_arbeit"}','{"all":[{"field":"status","operator":"equals","value":"in_arbeit"}]}','[]'),
      ('${r3}','${a}','contacts','Kontaktregel','{}','{"all":[{"field":"status","operator":"equals","value":"in_arbeit"}]}','[]');
    INSERT INTO workflow_definitions(id,tenant_id,name,trigger_config,conditions,actions) VALUES
      ('${w1}','${a}','Workflow','{"field":"category","value":"presse"}','[{"field":"category","op":"equals","value":"presse"}]','[{"type":"create_task","config":{"category":"presse"}}]');
  `);

  await actor(platform);
  const statusRename2 = await rename('task_statuses', ts2, 'In Arbeit neu');
  assert.equal(statusRename2.new_name, 'in_arbeit_neu');
  assert.deepEqual(
    statusRename2.updated.find((entry) => entry.key === 'automation_rules'),
    { key: 'automation_rules', label: 'Automatisierungsregel', count: 2 },
    'Regeln beider Büros werden ausgewiesen',
  );
  const ruleA = (await q('SELECT conditions, trigger_config, actions FROM automation_rules WHERE id=$1', [r1]))[0];
  assert.equal(ruleA.conditions.all[0].value, 'in_arbeit_neu');
  assert.equal(ruleA.conditions.all[1].value, 'in_arbeit', 'Anderes Feld bleibt unverändert');
  assert.equal(ruleA.trigger_config.value, 'in_arbeit_neu');
  assert.equal(ruleA.actions[0].payload.status, 'in_arbeit_neu');
  assert.equal(ruleA.actions[1].payload.status, 'in_arbeit', 'Status auf decisions wandert nicht mit');
  assert.equal(
    (await q('SELECT conditions FROM automation_rules WHERE id=$1', [r2]))[0].conditions.all[0].value,
    'in_arbeit_neu',
    'Plattformweiter Status gilt in allen Büros',
  );
  assert.equal(
    (await q('SELECT conditions FROM automation_rules WHERE id=$1', [r3]))[0].conditions.all[0].value,
    'in_arbeit',
    'Kontaktregel bleibt unangetastet',
  );

  // 12. Kategoriewerte in Regeln und Workflows werden fortgeschrieben und ausgewiesen.
  await actor(admin);
  const categoryRename = await rename('task_categories', tc2, 'Presse & Medien');
  assert.equal(categoryRename.new_name, 'presse_&_medien');
  assert.deepEqual(
    categoryRename.updated.find((entry) => entry.key === 'automation_rules'),
    { key: 'automation_rules', label: 'Automatisierungsregel', count: 1 },
  );
  assert.deepEqual(
    categoryRename.updated.find((entry) => entry.key === 'workflow_definitions'),
    { key: 'workflow_definitions', label: 'Workflow', count: 1 },
  );
  const ruleAfterCategory = (await q('SELECT actions FROM automation_rules WHERE id=$1', [r1]))[0];
  assert.equal(ruleAfterCategory.actions[0].payload.category, 'presse_&_medien');
  assert.equal(ruleAfterCategory.actions[0].payload.status, 'in_arbeit_neu');
  const workflow = (await q('SELECT conditions, trigger_config, actions FROM workflow_definitions WHERE id=$1', [w1]))[0];
  assert.equal(workflow.conditions[0].value, 'presse_&_medien');
  assert.equal(workflow.trigger_config.value, 'presse_&_medien');
  assert.equal(workflow.actions[0].config.category, 'presse_&_medien');

  await owner();
  console.log('Config rename passed: references migrated per office, arrays deduplicated, collisions and ambiguous names refused, platform scope respected.');
} finally {
  await db.close();
}
