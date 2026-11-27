// Isolated PostgreSQL check for the recurring-task rule the selftest relies on:
// spawn_recurring_task spawns exactly one follow-up with the next date, keeps the
// rule, the open status and the timeline note, and never spawns twice. The real
// migration runs here; the due date is compared as a Berlin calendar day, because
// tasks.due_date is a timestamptz and PostgREST returns it as a timestamp.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const office = '11111111-1111-4111-8111-111111111111';
const q = async (text, values = []) => (await db.query(text, values)).rows;
const berlinDay = async id => (await q(
  "SELECT to_char(due_date AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS day FROM tasks WHERE id=$1",
  [id],
))[0].day;

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE TABLE tasks(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, description text, priority text, category text,
      status text NOT NULL DEFAULT 'todo', user_id uuid, tenant_id uuid, assigned_to text, due_date timestamptz,
      recurrence_rule text, ball_owner text, ball_assignee_id uuid, checklist jsonb, parent_task_id uuid,
      timeline jsonb DEFAULT '[]'::jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE task_assignees(task_id uuid, user_id uuid, UNIQUE(task_id, user_id));
    GRANT SELECT, INSERT, UPDATE ON tasks, task_assignees TO authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261107105845_b0b95751-67d1-49b9-973c-26cec3a14c1e.sql', import.meta.url), 'utf8'));

  const insert = async (title, due, rule, checklist = '[]') => (await q(
    `INSERT INTO tasks(title,description,status,due_date,recurrence_rule,tenant_id,ball_owner,checklist,timeline)
     VALUES($1,$2,'todo',$3,$4,$5,'office',$6::jsonb,'[]'::jsonb) RETURNING id`,
    [title, '__SELFTEST__', due, rule, office, checklist],
  ))[0].id;
  const complete = id => q("UPDATE tasks SET status='completed' WHERE id=$1", [id]);
  const children = parent => q(
    'SELECT c.* FROM tasks c JOIN tasks p ON p.title=c.title WHERE p.id=$1 AND c.id<>p.id ORDER BY c.created_at',
    [parent],
  );

  // Wöchentlich: genau eine Folgeaufgabe, Frist sieben Berliner Tage später.
  const weekly = await insert('Wiederholung wöchentlich', '2026-12-01', 'weekly', '[{"text":"Unterlagen","done":true}]');
  await complete(weekly);
  const spawned = await children(weekly);
  assert.equal(spawned.length, 1, 'Der Abschluss legt genau eine Folgeaufgabe an');
  assert.equal(await berlinDay(spawned[0].id), '2026-12-08', 'Die Frist liegt sieben Tage später');
  assert.equal(spawned[0].status, 'todo');
  assert.equal(spawned[0].recurrence_rule, 'weekly', 'Die Wiederholung wird übernommen');
  assert.equal(spawned[0].ball_owner, 'office');
  assert.deepEqual(spawned[0].checklist, [{ text: 'Unterlagen', done: false }], 'Checkliste startet neu');
  assert.deepEqual(spawned[0].timeline.map(entry => entry.text), ['Wiederkehrende Aufgabe automatisch neu angelegt']);

  await complete(weekly);
  assert.equal((await children(weekly)).length, 1, 'Erneutes Abschließen erzeugt keine zweite Folgeaufgabe');

  // Monatlich: die Folgeaufgabe liegt einen Kalendermonat später. Der Ausgangstag
  // wird aus dem heutigen Datum berechnet, damit die Prüfung nicht veraltet.
  const start = new Date();
  const monthlyDue = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 1));
  const monthlyNext = new Date(Date.UTC(monthlyDue.getUTCFullYear(), monthlyDue.getUTCMonth() + 1, 1));
  const monthly = await insert('Wiederholung monatlich', monthlyDue.toISOString().slice(0, 10), 'monthly');
  await complete(monthly);
  assert.equal(await berlinDay((await children(monthly))[0].id), monthlyNext.toISOString().slice(0, 10),
    'Monatlich rückt um einen Kalendermonat vor');

  // Ohne Regel oder ohne Statuswechsel wird nichts angelegt.
  const plain = await insert('Ohne Regel', '2026-12-01', null);
  await complete(plain);
  assert.equal((await children(plain)).length, 0, 'Ohne Wiederholungsregel entsteht keine Folgeaufgabe');
  const open = await insert('Nur Umbenennen', '2026-12-01', 'weekly');
  await q("UPDATE tasks SET title='nur umbenannt' WHERE id=$1", [open]);
  assert.equal((await children(open)).length, 0, 'Ein Update ohne Statuswechsel legt nichts an');

  await assert.rejects(insert('Ungültig', '2026-12-01', 'taeglich'), /Ungültige Wiederholung/, 'Unbekannte Regeln werden abgewiesen');

  console.log('Recurring-task rule passed: one follow-up per completion with the next Berlin day, rule/status/checklist/timeline carried over, no second spawn, monthly advances one calendar month, unknown rules rejected.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
