// Isolated PostgreSQL check for withdrawing a vote on a task-linked decision.
//
// A vote moves the task to the office ("Freigabe umsetzen") and appends a
// timeline entry. Withdrawing used to delete only the answer row, so the task
// kept working on a release nobody had approved. The migration under test
// snapshots the previous task state in task_decision_vote_effects and restores
// it through withdraw_decision_response – but only while the task still equals
// the vote result. Once the office has acted, the task must stay untouched and
// only receive a withdrawal note.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const MIGRATION = new URL('../supabase/migrations/20261128090000_decision_vote_withdrawal_snapshot.sql', import.meta.url);
const db = new PGlite();

const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const creator = '33333333-3333-4333-8333-333333333333';
const deputy = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';

const q = async (text, values = []) => (await db.query(text, values)).rows;
const asUser = async (userId) => {
  await db.query('SELECT set_config($1, $2, false)', ['request.jwt.claim.sub', userId ?? '']);
};

let taskSeq = 0;
async function seedTask() {
  taskSeq += 1;
  const rows = await q(
    `INSERT INTO tasks(title,user_id,tenant_id,ball_owner,ball_assignee_id,next_action,next_action_due,timeline)
     VALUES($1,$2,$3,'deputy',$4,'Antrag prüfen','2026-12-01T00:00:00Z',$5) RETURNING id`,
    [`Antrag ${taskSeq} prüfen`, deputy, tenant, deputy,
      JSON.stringify([{ id: `seed-${taskSeq}`, type: 'system', text: 'Aufgabe angelegt' }])],
  );
  return rows[0].id;
}

async function seedDecision(taskId, tenantId = tenant) {
  const rows = await q(
    `INSERT INTO task_decisions(task_id,created_by,title,tenant_id,status)
     VALUES($1,$2,'Antrag prüfen',$3,'active') RETURNING id`,
    [taskId, creator, tenantId],
  );
  const decisionId = rows[0].id;
  const participantId = (await q(
    'INSERT INTO task_decision_participants(decision_id,user_id) VALUES($1,$2) RETURNING id',
    [decisionId, deputy],
  ))[0].id;
  return { decisionId, participantId };
}

const vote = (decisionId, participantId, type, comment = null) => q(
  `INSERT INTO task_decision_responses(decision_id,participant_id,response_type,comment)
   VALUES($1,$2,$3,$4) RETURNING id`,
  [decisionId, participantId, type, comment],
);
const readTask = async (id) => (await q(
  'SELECT ball_owner,ball_assignee_id,next_action,next_action_due,timeline FROM tasks WHERE id=$1', [id],
))[0];
const withdraw = async (decisionId, participantId) => {
  const result = await q('SELECT public.withdraw_decision_response($1,$2) AS result', [decisionId, participantId ?? null]);
  return result[0].result;
};

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE user_tenant_memberships(user_id uuid, tenant_id uuid, is_active boolean);
    CREATE TABLE tasks(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, user_id uuid, tenant_id uuid,
      timeline jsonb DEFAULT '[]'::jsonb, ball_owner text, ball_assignee_id uuid,
      next_action text, next_action_due timestamptz);
    CREATE TABLE task_decisions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, created_by uuid, title text,
      tenant_id uuid, status text DEFAULT 'active');
    CREATE TABLE task_decision_participants(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid, user_id uuid);
    CREATE TABLE task_decision_responses(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid, participant_id uuid,
      response_type text, comment text, parent_response_id uuid REFERENCES task_decision_responses(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now());
    CREATE TABLE notification_log(user_id uuid, title text);
    CREATE FUNCTION public.create_notification(uuid, text, text, text, jsonb, text)
      RETURNS void LANGUAGE sql AS $$
        INSERT INTO notification_log(user_id, title) VALUES ($1, $3);
      $$;
    CREATE FUNCTION public.guard_tenant_references() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RETURN NEW; END $$;
  `);
  await db.exec(await readFile(MIGRATION, 'utf8'));

  await q('INSERT INTO tenants(id) VALUES($1),($2)', [tenant, otherTenant]);
  await q('INSERT INTO user_tenant_memberships(user_id,tenant_id,is_active) VALUES($1,$3,true),($2,$3,true),($4,$3,true)',
    [creator, deputy, tenant, outsider]);
  await asUser(deputy);

  // 1. Votum -> Aufgabe beim Büro; Rücknahme stellt den Vorher-Zustand wieder her.
  const taskA = await seedTask();
  const a = await seedDecision(taskA);
  await vote(a.decisionId, a.participantId, 'yes', 'Einverstanden');
  const afterVote = await readTask(taskA);
  assert.equal(afterVote.ball_owner, 'office');
  assert.equal(afterVote.next_action, 'Freigabe umsetzen');
  const effect = (await q('SELECT previous_ball_owner, previous_next_action, applied_next_action, timeline_entry_ids FROM task_decision_vote_effects'))[0];
  assert.equal(effect.previous_ball_owner, 'deputy', 'Der Vorher-Zustand der Aufgabe wird gesichert');
  assert.equal(effect.previous_next_action, 'Antrag prüfen');
  assert.equal(effect.applied_next_action, 'Freigabe umsetzen');
  assert.equal(effect.timeline_entry_ids.length, 1);

  const restored = await withdraw(a.decisionId, a.participantId);
  assert.equal(restored.status, 'restored');
  assert.equal(restored.removed_timeline_entries, 1);
  const taskAAfter = await readTask(taskA);
  assert.equal(taskAAfter.ball_owner, 'deputy', 'Der Ball liegt wieder bei der Abgeordneten');
  assert.equal(taskAAfter.ball_assignee_id, deputy);
  assert.equal(taskAAfter.next_action, 'Antrag prüfen', 'Der nächste Schritt ist der Vorher-Zustand');
  assert.equal(new Date(taskAAfter.next_action_due).toISOString(), '2026-12-01T00:00:00.000Z', 'Die Frist kehrt zurück');
  assert.deepEqual(taskAAfter.timeline.map((entry) => entry.id), [`seed-${taskSeq}`], 'Der Votum-Eintrag ist aus dem Verlauf entfernt');
  assert.equal((await q('SELECT count(*)::int AS n FROM task_decision_responses'))[0].n, 0, 'Die Antwort ist gelöscht');
  assert.equal((await q('SELECT count(*)::int AS n FROM task_decision_vote_effects'))[0].n, 0, 'Der Effekt ist gelöscht');

  // 2. Geänderte Antwort (yes -> question) behält den ursprünglichen Ausgangszustand.
  const taskB = await seedTask();
  const b = await seedDecision(taskB);
  const firstResponse = await vote(b.decisionId, b.participantId, 'yes');
  await q("UPDATE task_decision_responses SET response_type='question' WHERE id=$1", [firstResponse[0].id]);
  assert.equal((await readTask(taskB)).next_action, 'Rückfrage beantworten');
  assert.equal((await q('SELECT applied_next_action FROM task_decision_vote_effects'))[0].applied_next_action, 'Rückfrage beantworten');
  assert.equal((await q('SELECT previous_next_action FROM task_decision_vote_effects'))[0].previous_next_action, 'Antrag prüfen');
  assert.equal((await q('SELECT jsonb_array_length(timeline_entry_ids)::int AS n FROM task_decision_vote_effects'))[0].n, 2);
  await withdraw(b.decisionId, b.participantId);
  const taskBAfter = await readTask(taskB);
  assert.equal(taskBAfter.next_action, 'Antrag prüfen');
  assert.equal(taskBAfter.ball_owner, 'deputy');
  assert.equal(taskBAfter.timeline.length, 1, 'Beide Votum-Einträge sind entfernt');

  // 3. Weitergelaufene Aufgabe bleibt unverändert und bekommt nur einen Vermerk.
  const taskC = await seedTask();
  const c = await seedDecision(taskC);
  await vote(c.decisionId, c.participantId, 'yes');
  await q("UPDATE tasks SET next_action='Freigabe erteilt' WHERE id=$1", [taskC]);
  const annotated = await withdraw(c.decisionId, c.participantId);
  assert.equal(annotated.status, 'annotated');
  const taskCAfter = await readTask(taskC);
  assert.equal(taskCAfter.next_action, 'Freigabe erteilt', 'Eine bereits umgesetzte Freigabe wird nicht zurückgedreht');
  assert.equal(taskCAfter.ball_owner, 'office');
  assert.match(taskCAfter.timeline.at(-1).text, /zurückgenommen · Aufgabe ist bereits weitergelaufen/);
  assert.equal((await q('SELECT count(*)::int AS n FROM task_decision_responses'))[0].n, 0);

  // 4. Eigenständige Entscheidung ohne Aufgabe: Rücknahme wirkt nur auf die Antwort.
  const standalone = await seedDecision(null);
  await vote(standalone.decisionId, standalone.participantId, 'no');
  const plain = await withdraw(standalone.decisionId, standalone.participantId);
  assert.equal(plain.status, 'without_effect');
  assert.equal((await q('SELECT count(*)::int AS n FROM task_decision_responses'))[0].n, 0);

  // 5. Fremde Antwort lässt sich nicht zurücknehmen.
  const taskD = await seedTask();
  const d = await seedDecision(taskD);
  await vote(d.decisionId, d.participantId, 'question');
  await asUser(outsider);
  await assert.rejects(withdraw(d.decisionId, d.participantId), /keine eigene Teilnahme|42501/);
  assert.equal((await readTask(taskD)).next_action, 'Rückfrage beantworten', 'Die fremde Rücknahme bleibt wirkungslos');

  // 6. Der direkte DELETE ist entzogen; nur der RPC nimmt Antworten zurück.
  assert.equal((await q("SELECT has_table_privilege('authenticated','public.task_decision_responses','DELETE') AS allowed"))[0].allowed, false,
    'Clients dürfen Antworten nicht mehr direkt löschen');
  assert.equal((await q("SELECT count(*)::int AS n FROM pg_policies WHERE tablename='task_decision_responses' AND cmd='DELETE'"))[0].n, 0,
    'Es gibt keine DELETE-Policy mehr auf Antworten');
  assert.equal((await q("SELECT has_function_privilege('authenticated','public.withdraw_decision_response(uuid,uuid)','EXECUTE') AS allowed"))[0].allowed, true);

  console.log('Decision vote withdrawal passed: the vote snapshot is stored, withdrawal restores ball/next step/deadline and removes the vote timeline entry, a task that moved on is only annotated, foreign or direct deletion is refused.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
