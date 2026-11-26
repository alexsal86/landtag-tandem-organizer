// Isolated PostgreSQL check for the rule the selftest step "Votum holt den Ball
// zurück" relies on: return_task_ball_after_vote hands the ball back to the
// decision's creator, derives the next step from the vote and never touches a
// task of another tenant. The migration that defines the vote repair runs here
// against minimal tables, so a broken CASE (42883 text = boolean) fails visibly.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const creator = '33333333-3333-4333-8333-333333333333';
const worker = '44444444-4444-4444-8444-444444444444';
const q = async (text, values = []) => (await db.query(text, values)).rows;

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE TABLE tasks(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, user_id uuid, tenant_id uuid,
      timeline jsonb DEFAULT '[]'::jsonb, ball_owner text, ball_assignee_id uuid,
      next_action text, next_action_due timestamptz);
    CREATE TABLE task_decisions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, created_by uuid, title text, tenant_id uuid);
    CREATE TABLE task_decision_responses(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid, response_type text, comment text,
      parent_response_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE user_tenant_memberships(user_id uuid, tenant_id uuid, is_active boolean);
    CREATE TABLE notification_log(user_id uuid, title text);
    CREATE FUNCTION public.create_notification(uuid, text, text, text, jsonb, text)
      RETURNS void LANGUAGE sql AS $$
        INSERT INTO notification_log(user_id, title) VALUES ($1, $3);
      $$;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261127233000_decision_vote_ball_case_repair.sql', import.meta.url), 'utf8'));

  await q('INSERT INTO user_tenant_memberships(user_id,tenant_id,is_active) VALUES($1,$2,true)', [creator, tenant]);
  const task = (await q(
    `INSERT INTO tasks(title,user_id,tenant_id,next_action) VALUES('Antrag prüfen',$1,$2,'Freigabe umsetzen') RETURNING id`,
    [worker, tenant],
  ))[0].id;
  const decision = async (taskId, tenantId) => (await q(
    `INSERT INTO task_decisions(task_id,created_by,title,tenant_id) VALUES($1,$3,'Antrag prüfen',$2) RETURNING id`,
    [taskId, tenantId, creator],
  ))[0].id;
  const vote = (decisionId, type, extra = {}) => q(
    `INSERT INTO task_decision_responses(decision_id,response_type,comment,parent_response_id)
     VALUES($1,$2,$3,$4)`,
    [decisionId, type, extra.comment ?? null, extra.parent ?? null],
  );
  const read = async id => (await q(
    'SELECT ball_owner,ball_assignee_id,next_action,next_action_due,timeline FROM tasks WHERE id=$1', [id],
  ))[0];

  const main = await decision(task, tenant);
  await vote(main, 'yes', { comment: 'Einverstanden' });
  const yes = await read(task);
  assert.equal(yes.ball_owner, 'office', 'Der Ball liegt wieder beim Büro');
  assert.equal(yes.ball_assignee_id, creator, 'Der Ball liegt bei der erstellenden Person');
  assert.equal(yes.next_action, 'Freigabe umsetzen');
  assert.equal(yes.next_action_due, null, 'Die Frist wird geleert');
  const yesText = yes.timeline.at(-1).text;
  assert.match(yesText, /^Votum zu „Antrag prüfen“: Freigegeben – Einverstanden · Am Zug: Büro$/);

  await vote(main, 'question', { comment: 'Welche Frist?' });
  assert.equal((await read(task)).next_action, 'Rückfrage beantworten', 'Die Rückfrage ist der nächste Schritt');
  assert.match((await read(task)).timeline.at(-1).text, /Rückfrage/);

  await vote(main, 'no');
  assert.equal((await read(task)).next_action, 'Votum umsetzen', 'Ablehnung führt zum Votumsschritt');
  assert.match((await read(task)).timeline.at(-1).text, /Abgelehnt/);

  const beforeFollowUp = await read(task);
  await vote(main, 'yes', { parent: (await q('SELECT id FROM task_decision_responses LIMIT 1'))[0].id });
  assert.deepEqual(await read(task), beforeFollowUp, 'Antworten auf Antworten lösen keinen weiteren Ballwechsel aus');

  assert.equal((await q('SELECT count(*)::int AS n FROM notification_log'))[0].n, 3,
    'Je Votum geht eine Benachrichtigung an die erstellende Person');

  // Mandantenprüfung: eine Entscheidung darf keine Aufgabe eines anderen Büros bewegen.
  const foreign = await decision(task, otherTenant);
  await assert.rejects(vote(foreign, 'yes'), /Decision task belongs to another tenant|42501/);
  assert.equal((await read(task)).next_action, 'Votum umsetzen', 'Die fremde Entscheidung bleibt wirkungslos');

  console.log('Decision-vote rule passed: ball returns to the creator, next step follows the vote (yes/question/no), timeline and cleared deadline are written, parent responses and foreign tenants stay untouched, one notification per vote.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
