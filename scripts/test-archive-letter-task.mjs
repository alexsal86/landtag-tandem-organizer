// Isolated PostgreSQL check for the follow-up task created for an archived letter.
//
// Die Folgeaufgabe hat genau einen Erzeuger: den Trigger trigger_letter_followup_task.
// Die Edge Function archive-letter legt keine eigene Aufgabe mehr an, sondern
// ermittelt die bestehende über das RPC create_letter_archive_follow_up_task.
// Trigger und RPC verknüpfen die Aufgabe über source_type/source_id mit dem Brief;
// der zusammengebaute Titel ist nur noch Rückfall für den Altbestand. Das RPC
// schreibt tasks.category, und tasks_category_check akzeptiert nur eine
// geschlossene, kleingeschriebene Liste. Eine großgeschriebene Kategorie ließ die
// Einfügung mit 23514 scheitern, weshalb der Brief-Selbsttest seine Folgeaufgabe
// nie sah. Dieser Check liest die Kategorie aus der RPC-Migration und die
// erlaubte Liste aus der Constraint-Migration; zusätzlich stellt er sicher, dass
// die Edge Function weder Aufgaben einfügt noch Kategorien schreibt.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const read = relative => readFile(new URL(relative, import.meta.url), 'utf8');

try {
  const migration = await read('../supabase/migrations/20250901100113_14e2369f-8c22-444e-a145-1b22b474b0fb.sql');
  const rule = /CHECK \(category = ANY\(ARRAY\[[^\]]*\]\)\)/i.exec(migration)?.[0];
  assert.ok(rule, 'tasks_category_check steht als CHECK (category = ANY(ARRAY[...])) in der Migration');
  const allowed = [...rule.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(allowed.length > 0);

  await db.exec(`CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, category text, ${rule})`);

  // Die Aufgabe entsteht nur noch in der Datenbankfunktion, verknüpft über den Brief.
  const linkMigration = await read('../supabase/migrations/20261127210000_letter_follow_up_source_link.sql');
  const insertStart = linkMigration.indexOf('INSERT INTO public.tasks');
  assert.ok(insertStart > -1, 'create_letter_archive_follow_up_task fügt die Aufgabe selbst ein');
  const insert = linkMigration.slice(insertStart);
  const literals = [...insert.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const taskCategory = literals.find(value => /brief/i.test(value));
  assert.ok(taskCategory, 'Die Folgeaufgabe trägt eine Briefkategorie');
  assert.ok(
    insert.includes("'letter_followup'") && insert.includes('v_letter.id'),
    'Das RPC verknüpft die Aufgabe über source_type/source_id mit dem Brief',
  );
  assert.ok(
    linkMigration.includes("AND t.source_type = 'letter_followup'"),
    'Das RPC sucht die Aufgabe über source_type',
  );
  assert.ok(
    linkMigration.indexOf("AND t.source_type = 'letter_followup'") < linkMigration.indexOf('AND t.title = v_title'),
    'Die Verknüpfung entscheidet vor dem Titel-Rückfall',
  );
  assert.ok(
    /INSERT INTO tasks \([^)]*source_type[^)]*source_id[^)]*\)/.test(linkMigration),
    'Der Trigger stempelt source_type und source_id',
  );

  const source = await read('../supabase/functions/archive-letter/index.ts');
  assert.ok(
    source.includes('create_letter_archive_follow_up_task'),
    'archive-letter ermittelt die Folgeaufgabe über create_letter_archive_follow_up_task',
  );
  assert.equal(
    /from\('tasks'\)/.test(source), false,
    'archive-letter legt keine eigene Aufgabe mehr an (genau ein Erzeuger)',
  );
  for (const value of [taskCategory]) {
    await db.query('INSERT INTO tasks(title, category) VALUES($1, $2)', ['Abgeordnetenbrief vom 26.11.2026', value]);
    assert.ok(allowed.includes(value), `tasks_category_check erlaubt "${value}"`);
  }

  // Die Großschreibung ist die Ursache des Fehlers und bleibt verboten.
  const capitalised = taskCategory[0].toUpperCase() + taskCategory.slice(1);
  await assert.rejects(
    db.query('INSERT INTO tasks(title, category) VALUES($1, $2)', ['Abgeordnetenbrief', capitalised]),
    error => error.code === '23514',
    'Die großgeschriebene Kategorie verletzt tasks_category_check weiterhin',
  );

  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
    CREATE TABLE letters(id integer PRIMARY KEY, status text, sent_by uuid, sent_at timestamptz, workflow_locked boolean);
  `);
  await db.exec(await read('../supabase/migrations/20261127220000_letter_sent_by_actor_preservation.sql'));
  await db.exec(`
    CREATE TRIGGER trigger_letter_status_change BEFORE UPDATE ON letters
      FOR EACH ROW EXECUTE FUNCTION public.handle_letter_status_change();
    INSERT INTO letters(id, status) VALUES (1, 'approved'), (2, 'approved');
  `);
  const sender = '11111111-1111-4111-8111-111111111111';
  const actor = '22222222-2222-4222-8222-222222222222';
  const send = async id => (await db.query(
    "UPDATE letters SET status = 'sent', sent_by = $1 WHERE id = $2 RETURNING sent_by, sent_at, workflow_locked",
    [sender, id],
  )).rows[0];
  const serviceArchive = await send(1);
  assert.equal(serviceArchive.sent_by, sender);
  assert.ok(serviceArchive.sent_at);
  assert.equal(serviceArchive.workflow_locked, true);
  await db.query("SELECT set_config('test.actor', $1, false)", [actor]);
  assert.equal((await send(2)).sent_by, actor);

  console.log(`archive-letter task and sender passed: genau ein Erzeuger mit Verknüpfung source_type/source_id, Kategorie "${taskCategory}" ist in tasks_category_check erlaubt (${allowed.join(', ')}); Großschreibung wird mit 23514 abgewiesen.`);
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
