import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ARTIFACT_FILE,
  buildStateArtifact,
  collectChecks,
  collectEnumDefinitions,
  collectGuards,
  collectWrites,
  parseGeneratedTypes,
  renderArtifact,
  validateArtifact,
} from '../build-state-artifact.mjs';

const root = process.cwd();

const typesSource = `
export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          status: string
          status_from: string | null
        }
      }
      leave_requests: {
        Row: {
          id: string
          status: Database["public"]["Enums"]["leave_status"]
        }
      }
    }
    Enums: {
      leave_status: "pending" | "approved" | "rejected"
    }
  }
}
`;

const migrations = (entries) => entries.map(([file, sql]) => ({ file: `supabase/migrations/${file}`, sql }));

test('Statusspalten stammen aus den generierten Typen; status_from ist keine Maschine', () => {
  const { columns } = parseGeneratedTypes(typesSource);
  assert.deepEqual(
    columns.map((column) => `${column.table}.${column.column}`),
    ['leave_requests.status', 'tasks.status'],
  );
  assert.equal(columns[0].enumName, 'leave_status');
  assert.equal(columns[1].enumName, null);
});

test('Enum-Werte werden zu Zuständen, auch wenn die Migration sie nicht wiederholt', () => {
  const artifact = buildStateArtifact({ typesSource, migrations: [] });
  const leave = artifact.machines.find((machine) => machine.id === 'leave_requests.status');
  assert.deepEqual(
    leave.states.map((state) => state.value),
    ['approved', 'pending', 'rejected'],
  );
  assert.deepEqual(leave.states[0].sources, ['enum:leave_status']);
});

test('CHECK-Constraints liefern Zustände für die Tabelle davor', () => {
  const [check] = collectChecks(
    migrations([
      [
        'a.sql',
        `create table public.tasks (id uuid, status text);
         alter table public.tasks add constraint tasks_status_check check (status in ('todo','done'));
         create table public.other (gqa_status text check (gqa_status = any (array['ok'::text])));
        `,
      ],
    ]),
  );
  assert.deepEqual(check, {
    table: 'tasks',
    column: 'status',
    values: ['todo', 'done'],
    source: 'supabase/migrations/a.sql',
  });
});

test('Enum-Definitionen werden gelesen; die spätere Datei gewinnt', () => {
  const enums = collectEnumDefinitions(
    migrations([
      ['a.sql', `create type public.leave_status as enum ('pending','approved');`],
      ['b.sql', `create type public.leave_status as enum ('pending','approved','rejected');`],
    ]),
  );
  assert.deepEqual(enums.get('leave_status'), {
    values: ['pending', 'approved', 'rejected'],
    source: 'supabase/migrations/b.sql',
  });
});

test('Schreibvorgänge belegen Ausgangs- und Zielzustand nur bei explizitem WHERE', () => {
  const writes = collectWrites(
    migrations([
      [
        'a.sql',
        `update public.tasks set status='completed' where id=x and status in ('todo','in_progress');
         update public.tasks set status='todo' where id=y;
         update public.tasks set status='archived' where status<>'completed';`,
      ],
    ]),
  );
  assert.deepEqual(writes, [
    { table: 'tasks', column: 'status', to: 'completed', from: ['in_progress', 'todo'], source: 'supabase/migrations/a.sql' },
    { table: 'tasks', column: 'status', to: 'todo', from: [], source: 'supabase/migrations/a.sql' },
    { table: 'tasks', column: 'status', to: 'archived', from: [], source: 'supabase/migrations/a.sql' },
  ]);
});

test('nur abbrechende Funktionen sind Guards, andere Trigger werden als beobachtend markiert', () => {
  const guards = collectGuards(
    migrations([
      [
        'a.sql',
        `create or replace function public.guard_tasks() returns trigger language plpgsql as $$
         begin
           if new.status = 'completed' and old.status is distinct from new.status then
             raise exception 'gesperrt';
           end if;
           return new;
         end $$;
         create trigger guard_tasks before update of status on public.tasks for each row execute function public.guard_tasks();
         create or replace function public.notify_tasks() returns trigger language plpgsql as $$
         begin
           if new.status = 'completed' then perform 1; end if;
           return new;
         end $$;
         create trigger notify_tasks after update on public.tasks for each row execute function public.notify_tasks();`,
      ],
    ]),
  );

  const guard = guards.find((entry) => entry.function === 'guard_tasks');
  const observer = guards.find((entry) => entry.function === 'notify_tasks');
  assert.equal(guard.raises, true);
  assert.deepEqual(guard.updateOf, ['status']);
  assert.equal(observer.raises, false);
});

test('baut Maschinen mit Zuständen, Übergängen und Triggern und meldet offene Spalten', () => {
  const artifact = buildStateArtifact({
    typesSource,
    migrations: migrations([
      [
        'a.sql',
        `create or replace function public.guard_tasks() returns trigger language plpgsql as $$
         begin
           if new.status = 'completed' then raise exception 'nein'; end if;
           return new;
         end $$;
         create trigger guard_tasks before update of status on public.tasks for each row execute function public.guard_tasks();
         update public.tasks set status='in_progress' where status='todo';
         create table public.leave_requests (id uuid, status text);`,
      ],
    ]),
  });

  const tasks = artifact.machines.find((machine) => machine.id === 'tasks.status');
  assert.deepEqual(tasks.states.map((state) => state.value), ['completed', 'in_progress', 'todo']);
  assert.deepEqual(tasks.transitions, [
    { from: ['todo'], to: 'in_progress', sources: ['supabase/migrations/a.sql'] },
  ]);
  assert.equal(tasks.guards[0].kind, 'guard');
  assert.deepEqual(tasks.guards[0].states, ['completed']);
  assert.deepEqual(artifact.unresolved, []);
});

test('die Strukturprüfung meldet fehlende Quellen und falsch markierte Guards', () => {
  const errors = validateArtifact(
    {
      machines: [
        {
          id: 'tasks.status',
          states: [{ value: 'todo', sources: [] }],
          transitions: [{ from: null, to: 'todo', sources: ['supabase/migrations/gibt-es-nicht.sql'] }],
          guards: [
            {
              trigger: 'guard_x',
              kind: 'guard',
              raises: false,
              source: 'supabase/migrations/gibt-es-nicht.sql',
            },
          ],
        },
      ],
    },
    root,
  );
  assert.ok(errors.some((error) => error.includes('Quelle fehlt')));
  assert.ok(errors.some((error) => error.includes('bricht aber nicht ab')));
});

test('meldet Schreibweisen-Kollisionen statt sie zu normalisieren', () => {
  const artifact = buildStateArtifact({
    typesSource,
    migrations: migrations([
      ['a.sql', `update public.tasks set status='in_progress' where id=1; update public.tasks set status='in-progress' where id=2;`],
    ]),
  });
  assert.deepEqual(artifact.anomalies, [
    {
      machine: 'tasks.status',
      values: ['in-progress', 'in_progress'],
      reason:
        'Zustandswerte unterscheiden sich nur in Trennzeichen oder Groß-/Kleinschreibung; im Quellcode sind sie verschieden.',
    },
  ]);
});

test('das eingecheckte Artefakt entspricht dem Quellcode (Drift-Prüfung)', () => {
  assert.equal(readFileSync(join(root, ARTIFACT_FILE), 'utf8'), renderArtifact(root));
});
