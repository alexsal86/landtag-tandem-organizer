// Isolated PostgreSQL check of the case-file contracts the selftest scenario relies on:
// case_scale limits on both tables, create_case_file_task (status, source_type,
// assignment, idempotency) and a letter draft insert. Real migration SQL, no live data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const office = '11111111-1111-4111-8111-111111111111';
const user = '22222222-2222-4222-8222-222222222222';
const file = '33333333-3333-4333-8333-333333333333';
const item = '44444444-4444-4444-8444-444444444444';
const task = '55555555-5555-4555-8555-555555555555';

const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const q = async (text, values = []) => (await db.query(text, values)).rows;
const slice = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Slice not found: ${start}`);
  return source.slice(from, to);
};

try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${user}');
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    INSERT INTO tenants VALUES ('${office}');
    CREATE TABLE user_tenant_memberships(user_id uuid, tenant_id uuid, role text, is_active boolean);
    INSERT INTO user_tenant_memberships VALUES ('${user}','${office}','bueroleitung',true);
    CREATE FUNCTION public.is_tenant_member(p_tenant uuid, p_user uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active)$$;

    -- Columns used by the sliced migrations; only the contract fields matter here.
    CREATE TABLE case_files(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, tenant_id uuid, title text);
    CREATE TABLE case_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text, case_scale text);
    CREATE TABLE case_file_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_file_id uuid NOT NULL, task_id uuid NOT NULL, notes text, created_at timestamptz DEFAULT now(), UNIQUE(case_file_id, task_id));
    CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, tenant_id uuid, title text, description text, assigned_to text,
      status text, priority text, category text, due_date timestamptz, ball_owner text, ball_assignee_id uuid, next_action text, next_action_due date,
      source_type text, source_id uuid, timeline jsonb);
    GRANT SELECT, INSERT, UPDATE ON case_files, case_items, case_file_tasks, tasks TO authenticated;

    INSERT INTO case_files(id,user_id,tenant_id,title) VALUES ('${file}','${user}','${office}','[SELFTEST] Kontrakt');
    INSERT INTO case_items(id,subject) VALUES ('${item}','[SELFTEST] Vorgang');
  `);

  // 1. Real case_scale constraints on both tables.
  await db.exec(await migration('20260305153000_add_case_scale_to_case_items_and_files.sql'));
  await assert.rejects(db.query("UPDATE case_files SET case_scale='huge' WHERE id=$1", [file]),
    error => error.code === '23514', 'case_files rejects an unknown case_scale');
  await assert.rejects(db.query("UPDATE case_items SET case_scale='huge' WHERE id=$1", [item]),
    error => error.code === '23514', 'case_items rejects an unknown case_scale');
  await db.query("UPDATE case_files SET case_scale='small' WHERE id=$1", [file]);
  await db.query("UPDATE case_items SET case_scale='large' WHERE id=$1", [item]);
  assert.equal((await q('SELECT case_scale FROM case_files WHERE id=$1', [file]))[0].case_scale, 'small');
  assert.equal((await q('SELECT case_scale FROM case_items WHERE id=$1', [item]))[0].case_scale, 'large');

  // 2. Real create_case_file_task: task contract and idempotency.
  const consistency = await migration('20261107150000_workflow_consistency.sql');
  await db.exec(slice(consistency,
    'CREATE FUNCTION public.create_case_file_task',
    'REVOKE ALL ON FUNCTION public.create_case_file_task'));
  await db.query("SELECT set_config('test.actor',$1,false)", [user]);
  await db.exec('SET ROLE authenticated');
  const created = (await q('SELECT create_case_file_task($1,$2,$3) AS id', [task, file, '  Unterlagen sammeln  ']))[0].id;
  assert.equal(created, task, 'The RPC returns the requested task id');
  const stored = (await q('SELECT user_id,tenant_id,title,assigned_to,status,priority,category,source_type,source_id FROM tasks WHERE id=$1', [task]))[0];
  assert.deepEqual(stored, {
    user_id: user, tenant_id: office, title: 'Unterlagen sammeln', assigned_to: user,
    status: 'todo', priority: 'medium', category: 'personal', source_type: 'case_file', source_id: file,
  }, 'Task fields follow the migration contract');
  assert.equal((await q('SELECT * FROM case_file_tasks')).length, 1);
  const retry = (await q('SELECT create_case_file_task($1,$2,$3) AS id', [task, file, 'Unterlagen sammeln']))[0].id;
  assert.equal(retry, task, 'A retry returns the existing task');
  assert.equal((await q('SELECT * FROM case_file_tasks')).length, 1, 'A retry creates no second link');
  assert.equal((await q('SELECT count(*)::int AS total FROM tasks')).length, 1);

  // 3. The blanks the scenario relies on: a draft letter is insertable as-is.
  await db.exec('RESET ROLE');
  const letters = await migration('20250829231458_174e86d4-df6b-43d6-8438-585d11673e6b.sql');
  await db.exec(slice(letters, 'CREATE TABLE public.letters', ');') + ');');
  // subject und letter_date kommen aus einer eigenen Migration.
  await db.exec(await migration('20250830220208_ca1b6e46-2d91-4963-beb8-b69987c25805.sql'));
  // RLS und Grants der Tabelle stehen in weiteren Migrationen; hier zählt nur der Spaltenvertrag.
  await db.exec('GRANT SELECT, INSERT ON public.letters TO authenticated');
  assert.equal((await q('SELECT status FROM letters')).length, 0);
  await db.exec('SET ROLE authenticated');
  await db.query("SELECT set_config('test.actor',$1,false)", [user]);
  await db.query(`INSERT INTO letters(id,tenant_id,created_by,title,subject,content,content_html,status,recipient_name,recipient_address,letter_date)
    VALUES($1,$2,$3,'[SELFTEST] Aktenbrief','Betreff','__SELFTEST__','<p>__SELFTEST__</p>','draft','Selbsttest','Teststraße 1',current_date)`,
    ['66666666-6666-4666-8666-666666666666', office, user]);
  const letter = (await q('SELECT status,content_html,content FROM letters'))[0];
  assert.equal(letter.status, 'draft', 'A draft is a valid insert status');
  assert.equal(letter.content_html, '<p>__SELFTEST__</p>');
  assert.equal(letter.content, '__SELFTEST__');

  console.log('Case-file contracts passed: case_scale limited on case_files and case_items, create_case_file_task keeps status/source/idempotency, and a draft letter inserts without extra columns.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
