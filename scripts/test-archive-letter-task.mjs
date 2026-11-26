// Isolated PostgreSQL check for the follow-up task archive-letter creates.
// The edge function writes tasks.category, and tasks_category_check accepts only a
// closed, case-sensitive list. A capitalised literal made the task insert fail with
// 23514, so the letter selftest never saw its follow-up task. This check reads the
// literals from the function and the allowed list from the migration, so drift on
// either side fails here instead of in the Selbsttest-Center.
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

  const source = await read('../supabase/functions/archive-letter/index.ts');
  const literals = [...source.matchAll(/category:\s*'([^']+)'/g)].map(match => match[1]);
  assert.ok(literals.length > 0, 'archive-letter schreibt mindestens eine Kategorie');

  const taskCategory = literals.find(value => /brief/i.test(value));
  assert.ok(taskCategory, 'Die Folgeaufgabe aus archive-letter trägt eine Briefkategorie');

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

  console.log(`archive-letter task passed: category "${taskCategory}" ist in tasks_category_check erlaubt (${allowed.join(', ')}); Großschreibung wird mit 23514 abgewiesen.`);
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
