// Isolated PostgreSQL integration test; never connects to the live database.
// npm install --prefix /tmp/case-step-test-tools @electric-sql/pglite
// PGLITE_MODULE_PATH=/tmp/case-step-test-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-case-step-tasks.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite');
const db = new PGlite();
const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const outsider = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const tenant = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const caseId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const read = async (sql, params = []) => (await db.query(sql, params)).rows;
const tasks = () => read(`SELECT * FROM tasks WHERE source_id = '${caseId}' AND status NOT IN ('completed','cancelled')`);
const events = () => read(`SELECT subject, payload, source_id, interaction_at FROM case_item_interactions ORDER BY interaction_at`);
try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
    CREATE TABLE memberships (user_id uuid, tenant_id uuid);
    CREATE TABLE profiles (user_id uuid PRIMARY KEY, display_name text);
    CREATE TABLE case_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL, subject text,
      owner_user_id uuid, ball_owner text, next_action_label text, next_action_due_at timestamptz, next_action_assignee_id uuid,
      status text DEFAULT 'neu', priority text DEFAULT 'medium');
    CREATE TABLE case_item_participants (case_item_id uuid REFERENCES case_items(id), user_id uuid, role text, PRIMARY KEY(case_item_id,user_id));
    CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL, title text NOT NULL,
      description text, assigned_to text, due_date timestamptz, priority text DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      category text DEFAULT 'personal', status text DEFAULT 'todo', progress int DEFAULT 0,
      source_type text, source_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE archived_tasks (task_id uuid PRIMARY KEY);
    CREATE TABLE task_assignees (task_id uuid REFERENCES tasks(id) ON DELETE CASCADE, user_id uuid,
      assigned_by uuid, created_at timestamptz DEFAULT now(), PRIMARY KEY(task_id,user_id));
    CREATE TABLE case_item_interactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_item_id uuid REFERENCES case_items(id),
      tenant_id uuid, interaction_type text, direction text, subject text, summary text, details text, source_type text, source_id uuid,
      created_by uuid, interaction_at timestamptz DEFAULT now(), payload jsonb);
    CREATE FUNCTION get_user_tenant_ids(who uuid) RETURNS uuid[] LANGUAGE sql AS $$ SELECT array_agg(tenant_id) FROM memberships WHERE user_id = who $$;
    CREATE FUNCTION user_can_access_case_item(who uuid, item uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS(SELECT 1 FROM case_items ci WHERE ci.id = item AND
        (ci.user_id = who OR ci.owner_user_id = who OR EXISTS(SELECT 1 FROM case_item_participants p WHERE p.case_item_id = ci.id AND p.user_id = who))) $$;
    INSERT INTO memberships VALUES ('${a}','${tenant}'), ('${b}','${tenant}'), ('${c}','${tenant}');
    INSERT INTO profiles VALUES ('${a}','Alexander'),('${b}','Rudolf'),('${c}','Clara');
    SELECT set_config('test.actor','${a}',false);
  `);
  const assignees = await readFile(new URL('../supabase/migrations/20260323120000_add_task_assignees.sql', import.meta.url), 'utf8');
  await db.exec(assignees.slice(assignees.indexOf('CREATE OR REPLACE FUNCTION public.parse_task_assignee_ids'), assignees.indexOf('ALTER PUBLICATION')));
  await db.exec(await readFile(new URL('../supabase/migrations/20261106180000_link_case_steps_to_tasks.sql', import.meta.url), 'utf8'));
  await db.query(`INSERT INTO case_items(id,tenant_id,user_id,owner_user_id,ball_owner,next_action_label,next_action_due_at,next_action_assignee_id,subject)
    VALUES($1,$2,$3,$3,'office','Antwort senden','2026-11-20T12:00:00Z',$4,'Bürgeranfrage')`, [caseId, tenant, a, b]);
  let active = await tasks();
  assert.equal(active.length, 1);
  const originalTask = active[0].id;
  assert.equal(active[0].title, 'Antwort senden');
  assert.equal(active[0].assigned_to, b);
  assert.equal(new Date(active[0].due_date).toISOString(), '2026-11-20T12:00:00.000Z');
  assert.match(active[0].description, /caseItemId=ffffffff/);
  assert.equal((await read('SELECT * FROM task_assignees WHERE task_id=$1', [originalTask]))[0].user_id, b);
  assert.equal((await events())[0].subject, 'Aufgabe erstellt');
  assert.equal((await events())[0].payload.responsible_name, 'Rudolf');
  await db.query(`UPDATE case_items SET next_action_label=next_action_label WHERE id=$1`, [caseId]);
  assert.equal((await tasks()).length, 1);
  assert.equal((await events()).length, 1);
  await assert.rejects(db.query(`INSERT INTO tasks(tenant_id,user_id,title,source_type,source_id)
    SELECT tenant_id,user_id,title,source_type,source_id FROM tasks WHERE id=$1`,[originalTask]));
  await assert.rejects(db.query(`UPDATE tasks SET source_type='manual',source_id=null WHERE id=$1`,[originalTask]));
  await db.query(`UPDATE case_items SET next_action_label='Ministerium erinnern',next_action_due_at='2026-11-21T12:00:00Z',next_action_assignee_id=$2 WHERE id=$1`, [caseId,c]);
  active = await tasks();
  assert.equal(active[0].id, originalTask);
  assert.equal(active[0].assigned_to,c);
  assert.equal(active[0].title,'Ministerium erinnern');
  assert.equal((await events()).at(-1).subject,'Aufgabe aktualisiert');
  assert.equal((await read('SELECT user_id FROM task_assignees WHERE task_id=$1',[originalTask]))[0].user_id,c);
  await assert.rejects(db.query(`UPDATE case_items SET next_action_assignee_id=$2 WHERE id=$1`,[caseId,outsider]));
  assert.equal((await tasks())[0].assigned_to,c);
  assert.equal((await read('SELECT next_action_assignee_id FROM case_items WHERE id=$1',[caseId]))[0].next_action_assignee_id,c);
  await db.query(`UPDATE case_items SET ball_owner='authority' WHERE id=$1`,[caseId]);
  assert.equal((await tasks()).length,0);
  assert.equal((await events()).at(-1).subject,'Aufgabe zurückgezogen');
  await db.query(`UPDATE case_items SET ball_owner='office' WHERE id=$1`,[caseId]);
  active = await tasks();
  assert.equal(active.length,1);
  assert.notEqual(active[0].id,originalTask);
  await db.query(`SELECT set_config('test.actor',$1,false)`,[c]);
  await db.query(`UPDATE tasks SET status='completed' WHERE id=$1`,[active[0].id]);
  assert.equal((await events()).at(-1).subject,'Aufgabe erledigt');
  await db.query(`INSERT INTO archived_tasks(task_id) VALUES($1)`,[active[0].id]);
  await db.query(`DELETE FROM tasks WHERE id=$1`,[active[0].id]);
  assert.equal((await events()).filter(e=>e.subject==='Aufgabe gelöscht').length,0);
  await db.query(`UPDATE case_items SET next_action_label='Neuer Schritt' WHERE id=$1`,[caseId]);
  active=await tasks();
  const deletedId=active[0].id;
  await db.query(`DELETE FROM tasks WHERE id=$1`,[deletedId]);
  assert.equal((await events()).at(-1).subject,'Aufgabe gelöscht');
  assert.equal((await events()).at(-1).source_id,deletedId);
  await db.query(`UPDATE case_items SET next_action_label=next_action_label WHERE id=$1`,[caseId]);
  assert.equal((await tasks()).length,0,'Deleted tasks are not recreated by unrelated saves');
  await db.query(`UPDATE case_items SET next_action_label='Schritt abschließen' WHERE id=$1`,[caseId]);
  await db.query(`UPDATE case_items SET next_action_label=null,next_action_due_at=null,next_action_assignee_id=null WHERE id=$1`,[caseId]);
  assert.equal((await tasks()).length,0);
  assert.equal((await events()).at(-1).subject,'Aufgabe erledigt');
  await db.query(`UPDATE case_items SET next_action_label='Vorgang abschließen',owner_user_id=$2 WHERE id=$1`,[caseId,b]);
  assert.equal((await tasks())[0].assigned_to,b,'Without a step assignee, use the case owner');
  await db.query(`UPDATE case_items SET status='archiviert' WHERE id=$1`,[caseId]);
  assert.equal((await tasks()).length,0);
  assert.equal((await events()).at(-1).subject,'Aufgabe erledigt');
  await db.query(`UPDATE case_items SET status='neu',next_action_label='Direkt archivieren' WHERE id=$1`,[caseId]);
  const archivedDirectly=(await tasks())[0].id;
  await db.query(`WITH archived AS (INSERT INTO archived_tasks(task_id) VALUES($1) RETURNING task_id)
    DELETE FROM tasks WHERE id IN(SELECT task_id FROM archived)`,[archivedDirectly]);
  assert.equal((await events()).at(-1).subject,'Aufgabe erledigt','Atomic archive is not mistaken for deletion');
  assert.ok((await events()).every(event=>event.interaction_at));
  console.log('Case office-step tasks: creation, assignment, updates, deduplication, cancellation, completion, deletion and archive integration passed.');
} finally { await db.close(); }
