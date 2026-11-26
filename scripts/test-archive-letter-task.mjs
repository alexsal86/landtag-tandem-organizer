// Isolated PostgreSQL check for the follow-up task created for an archived letter.
//
// Die Folgeaufgabe hat genau einen Erzeuger: den Trigger trigger_letter_followup_task.
// Die Edge Function archive-letter legt keine eigene Aufgabe mehr an, sondern
// ermittelt die bestehende über das RPC create_letter_archive_follow_up_task.
// Dieses RPC schreibt tasks.category; tasks_category_check akzeptiert nur eine
// geschlossene, kleingeschriebene Liste. Eine großgeschriebene Kategorie ließ die
// Einfügung mit 23514 scheitern, weshalb der Brief-Selbsttest seine Folgeaufgabe
// nie sah. Dieser Check liest die Kategorie aus der RPC-Migration und die
// erlaubte Liste aus der Constraint-Migration; zusätzlich stellt er sicher, dass
// die Edge Function weder eine Aufgabe einfügt noch eine Kategorie schreibt.
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

  // Die Aufgabe entsteht nur noch in der Datenbankfunktion.
  const rpcMigration = await read('../supabase/migrations/20261127200000_letter_archive_follow_up_task.sql');
  const insert = /INSERT INTO public\.tasks[\s\S]*?VALUES \(([\s\S]*?)\)\s*RETURNING/i.exec(rpcMigration)?.[1];
  assert.ok(insert, 'create_letter_archive_follow_up_task fügt die Aufgabe selbst ein');
  const literals = [...insert.matchAll(/'([^']+)'/g)].map(match => match[1]);
  const taskCategory = literals.find(value => /brief/i.test(value));
  assert.ok(taskCategory, 'Die Folgeaufgabe trägt eine Briefkategorie');

  const source = await read('../supabase/functions/archive-letter/index.ts');
  assert.ok(
    source.includes('create_letter_archive_follow_up_task'),
    'archive-letter ermittelt die Folgeaufgabe über create_letter_archive_follow_up_task',
  );
  assert.equal(
    /from\('tasks'\)/.test(source), false,
    'archive-letter legt keine eigene Aufgabe mehr an (genau ein Erzeuger)',
  );
  assert.equal(
    /category:\s*'/.test(source), false,
    'archive-letter schreibt keine Aufgabenkategorie mehr',
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

  console.log(`archive-letter task passed: genau ein Erzeuger, Kategorie "${taskCategory}" ist in tasks_category_check erlaubt (${allowed.join(', ')}); Großschreibung wird mit 23514 abgewiesen.`);
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
