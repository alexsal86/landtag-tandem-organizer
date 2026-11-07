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
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE TABLE user_tenant_memberships AS SELECT *,true AS is_active FROM memberships;
    CREATE TABLE case_files(id uuid PRIMARY KEY,tenant_id uuid);
    ALTER TABLE case_items ADD COLUMN case_file_id uuid, ADD COLUMN summary text, ADD COLUMN source_channel text, ADD COLUMN intake_payload jsonb;
    CREATE TABLE case_file_tasks(case_file_id uuid,task_id uuid);
    CREATE TABLE quick_notes(id uuid PRIMARY KEY,user_id uuid,tenant_id uuid,title text,content text,priority_level int,deleted_at timestamptz,task_id uuid,case_item_id uuid,decision_id uuid);
    CREATE TABLE task_decisions(id uuid PRIMARY KEY,title text,description text,created_by uuid,tenant_id uuid,task_id uuid,case_item_id uuid,response_deadline timestamptz,response_options jsonb,priority int,visible_to_all bool);
    CREATE TABLE task_decision_participants(decision_id uuid,user_id uuid);
    CREATE TABLE task_decision_responses(decision_id uuid,participant_id uuid,response_type text,created_at timestamptz);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261107150000_workflow_consistency.sql',import.meta.url),'utf8'));
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
  assert.equal((await read('SELECT next_action_label FROM case_items WHERE id=$1',[caseId]))[0].next_action_label,null,'Task completion clears the case step');

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

  const noteId='11111111-1111-4111-8111-111111111111';
  await db.query(`INSERT INTO quick_notes(id,user_id,tenant_id,title,content) VALUES($1,$2,$3,'Notiz','Inhalt')`,[noteId,c,tenant]);
  const created=(await read(`SELECT create_note_work($1,'task') AS id`,[noteId]))[0].id;
  assert.equal((await read(`SELECT create_note_work($1,'task') AS id`,[noteId]))[0].id,created,'retry is idempotent');
  await db.query('UPDATE quick_notes SET task_id=null WHERE id=$1',[noteId]);
  assert.equal((await read('SELECT count(*)::int AS count FROM tasks WHERE id=$1',[created]))[0].count,1,'unlink preserves task');
  await db.exec(`CREATE FUNCTION reject_note_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'link failure'; END $$;
    CREATE TRIGGER reject_note_link BEFORE UPDATE ON quick_notes FOR EACH ROW EXECUTE FUNCTION reject_note_link();`);
  const before=(await read('SELECT count(*)::int AS count FROM tasks'))[0].count;
  await assert.rejects(read(`SELECT create_note_work($1,'task')`,[noteId]),/link failure/);
  assert.equal((await read('SELECT count(*)::int AS count FROM tasks'))[0].count,before,'link failure rolls back creation');
  await db.exec('DROP TRIGGER reject_note_link ON quick_notes');
  const decisionId='22222222-2222-4222-8222-222222222222';
  const payload=JSON.stringify({title:'Freigabe',tenant_id:tenant});
  await read('SELECT create_work_decision($1,$2::jsonb,$3::uuid[],$4)',[decisionId,payload,[a],noteId]);
  await read('SELECT create_work_decision($1,$2::jsonb,$3::uuid[],$4)',[decisionId,payload,[a],noteId]);
  assert.equal((await read('SELECT count(*)::int AS count FROM task_decision_participants'))[0].count,1);
  const derived=(await read('SELECT create_decision_task($1) AS id',[decisionId]))[0].id;
  assert.equal((await read('SELECT create_decision_task($1) AS id',[decisionId]))[0].id,derived);
  assert.equal((await read('SELECT source_id FROM tasks WHERE id=$1',[derived]))[0].source_id,decisionId);

  const fileId='33333333-3333-4333-8333-333333333333';
  const fileTask='44444444-4444-4444-8444-444444444444';
  await db.query('INSERT INTO case_files(id,tenant_id) VALUES($1,$2)',[fileId,tenant]);
  await read('SELECT create_case_file_task($1,$2,$3)',[fileTask,fileId,'Aktenaufgabe']);
  await read('SELECT create_case_file_task($1,$2,$3)',[fileTask,fileId,'Aktenaufgabe']);
  assert.equal((await read('SELECT count(*)::int AS count FROM case_file_tasks WHERE task_id=$1',[fileTask]))[0].count,1);
  const badDecision='55555555-5555-4555-8555-555555555555';
  await assert.rejects(read('SELECT create_work_decision($1,$2::jsonb,$3::uuid[],NULL)',[badDecision,payload,[outsider]]));
  assert.equal((await read('SELECT count(*)::int AS count FROM task_decisions WHERE id=$1',[badDecision]))[0].count,0);

  await db.exec(`CREATE FUNCTION reject_participant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'participant failure'; END $$;
    CREATE TRIGGER reject_participant BEFORE INSERT ON task_decision_participants FOR EACH ROW EXECUTE FUNCTION reject_participant();`);
  await assert.rejects(read('SELECT create_work_decision($1,$2::jsonb,$3::uuid[],NULL)',[badDecision,payload,[a]]),/participant failure/);
  assert.equal((await read('SELECT count(*)::int AS count FROM task_decisions WHERE id=$1',[badDecision]))[0].count,0,'participant failure rolls back decision');

  await db.query(`UPDATE case_items SET next_action_label='Synchronisieren',ball_owner='office' WHERE id=$1`,[caseId]);
  const syncTask=(await tasks())[0].id;
  await db.query(`UPDATE tasks SET title='Geänderter Schritt',due_date='2026-12-01T12:00:00Z' WHERE id=$1`,[syncTask]);
  const synced=(await read('SELECT next_action_label,next_action_due_at FROM case_items WHERE id=$1',[caseId]))[0];
  assert.equal(synced.next_action_label,'Geänderter Schritt');
  assert.equal(new Date(synced.next_action_due_at).toISOString(),'2026-12-01T12:00:00.000Z');
  await db.query('UPDATE task_assignees SET user_id=$2 WHERE task_id=$1',[syncTask,a]);
  assert.equal((await read('SELECT next_action_assignee_id FROM case_items WHERE id=$1',[caseId]))[0].next_action_assignee_id,a);
  console.log('Workflow consistency: reverse sync, lifecycle, atomic note/case-file/decision creation, rollback, provenance, unlinking and idempotency passed.');
} finally { await db.close(); }
