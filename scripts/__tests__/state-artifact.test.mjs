import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  ARTIFACT_FILE,
  analyzeMachine,
  blockedStates,
  buildStateArtifact,
  collectChecks,
  collectClientWrites,
  collectEnumDefinitions,
  collectGuards,
  collectInitialStates,
  collectParametricWrites,
  collectTsTransitions,
  collectWrites,
  guardChecks,
  parseGeneratedTypes,
  renderArtifact,
  splitTopLevel,
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

test('nur Kanten ohne Schreibbeleg bleiben ein Hinweis, fehlende Zustandswerte eine Warnung', () => {
  const base = {
    id: 'letters.status',
    states: [{ value: 'draft', sources: [] }, { value: 'sent', sources: [] }],
    initialStates: ['draft'],
    transitions: [{ from: ['draft'], to: 'sent', kind: 'write', param: null, sources: ['a.sql'], guards: [] }],
    guards: [],
  };
  const withEdges = analyzeMachine({
    ...base,
    reconciliation: {
      source: 'src/components/letters/types.ts',
      label: 'Briefregeln',
      valuesNotInDatabase: [],
      onlyInCode: [{ from: 'draft', to: 'review' }],
      onlyInArtifact: [],
      clientValues: [],
    },
  });
  assert.equal(withEdges.find((finding) => finding.kind === 'nur-im-code'), undefined);
  assert.equal(withEdges.find((finding) => finding.kind === 'kanten-nicht-belegt').severity, 'info');

  const withValues = analyzeMachine({
    ...base,
    reconciliation: {
      source: 'src/components/letters/types.ts',
      label: 'Briefregeln',
      valuesNotInDatabase: ['review'],
      onlyInCode: [{ from: 'draft', to: 'review' }],
      onlyInArtifact: [],
      clientValues: [],
    },
  });
  const warn = withValues.find((finding) => finding.kind === 'nur-im-code');
  assert.equal(warn.severity, 'warn');
  assert.deepEqual(warn.states, ['review']);
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
  const checks = collectChecks(
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
  const check = checks.find((entry) => entry.table === 'tasks');
  assert.deepEqual(check, {
    table: 'tasks',
    column: 'status',
    values: ['todo', 'done'],
    source: 'supabase/migrations/a.sql',
  });
});

test('gedroppte CHECK-Constraints liefern keine Zustände mehr', () => {
  const checks = collectChecks(
    migrations([
      [
        'a.sql',
        `create table public.tasks (id uuid, status text check (status in ('todo','in-progress','completed')));`,
      ],
      [
        'b.sql',
        `alter table public.tasks drop constraint if exists tasks_status_check;
         alter table public.tasks add constraint tasks_status_check check (status in ('todo','in_progress','completed'));`,
      ],
    ]),
  );
  assert.deepEqual(checks, [
    {
      table: 'tasks',
      column: 'status',
      values: ['todo', 'in_progress', 'completed'],
      source: 'supabase/migrations/b.sql',
    },
  ]);
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

test('Tabellen-Alias zwischen Tabelle und SET wird gelesen', () => {
  const writes = collectWrites(
    migrations([
      ['a.sql', `update public.meeting_participants participant set status='declined' where participant.status='pending';`],
    ]),
  );
  assert.deepEqual(writes, [
    {
      table: 'meeting_participants',
      column: 'status',
      to: 'declined',
      from: ['pending'],
      source: 'supabase/migrations/a.sql',
    },
  ]);
});

test('Startzustände kommen aus Spalten-Defaults und literalen INSERTs', () => {
  const initial = collectInitialStates(
    migrations([
      [
        'a.sql',
        `create table public.tasks (id uuid, status text not null default 'todo', title text);
         insert into public.tasks (id, status, title) values (gen_random_uuid(), 'blocked', 'x'), (gen_random_uuid(), 'todo', 'y');
         insert into public.other (id, status) select id, 'ignored' from public.tasks;`,
      ],
    ]),
  );
  assert.deepEqual(
    initial.map((entry) => `${entry.table}.${entry.column}=${entry.value}:${entry.via}`),
    ['tasks.status=todo:default', 'tasks.status=blocked:insert', 'tasks.status=todo:insert'],
  );
});

test('parametrische Schreibvorgänge übernehmen nur belegte Parameterwerte', () => {
  const writes = collectParametricWrites(
    migrations([
      [
        'a.sql',
        `create or replace function public.decide_leave(_id uuid, _decision text) returns void language plpgsql as $$
         begin
           if _decision not in ('approved','rejected') then
             raise exception 'invalid decision';
           end if;
           update public.leave_requests set status = _decision where id = _id;
         end $$;`,
      ],
    ]),
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, 'leave_requests');
  assert.equal(writes[0].param, '_decision');
  assert.deepEqual(writes[0].checks, [{ operator: 'not in', values: ['approved', 'rejected'] }]);
});

test('Guard-Vergleiche behalten Seite und Polarität', () => {
  const checks = guardChecks(
    `if old.status in ('completed','cancelled') and new.status <> 'completed' then raise exception 'nein'; end if;`,
    'status',
  );
  assert.deepEqual(checks, [
    { side: 'OLD', operator: 'in', negated: false, values: ['cancelled', 'completed'] },
    { side: 'NEW', operator: '<>', negated: true, values: ['completed'] },
  ]);

  const blocked = blockedStates({ raises: true, checks }, ['completed', 'cancelled', 'todo']);
  assert.deepEqual(blocked.blockedTo, ['cancelled', 'todo']);
  assert.deepEqual(blocked.blockedFrom, ['cancelled', 'completed']);
  assert.deepEqual(blockedStates({ raises: false, checks }, ['todo']), { blockedTo: [], blockedFrom: [] });
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
  assert.equal(guard.message, 'gesperrt');
  assert.deepEqual(guard.updateOf, ['status']);
  assert.equal(observer.raises, false);
});

test('baut Maschinen mit Startzuständen, Übergängen und Guard-Blockaden', () => {
  const artifact = buildStateArtifact({
    typesSource,
    migrations: migrations([
      [
        'a.sql',
        `create table public.tasks (id uuid, status text default 'todo');
         create or replace function public.guard_tasks() returns trigger language plpgsql as $$
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
  assert.deepEqual(tasks.initialStates, ['todo']);
  assert.deepEqual(tasks.transitions, [
    { from: null, to: 'todo', kind: 'initial', param: null, sources: ['supabase/migrations/a.sql'], guards: [] },
    { from: ['todo'], to: 'in_progress', kind: 'write', param: null, sources: ['supabase/migrations/a.sql'], guards: [] },
  ]);
  assert.equal(tasks.guards[0].kind, 'guard');
  assert.deepEqual(tasks.guards[0].blockedTo, ['completed']);
  assert.deepEqual(tasks.guards[0].allowedTo, ['in_progress', 'todo']);
  assert.deepEqual(tasks.findings.map((finding) => finding.kind).sort(), [
    'isoliert',
    'nur-im-guard',
    'sackgasse',
    'unerreichbar',
  ]);
  assert.deepEqual(artifact.unresolved, []);
});

test('Befunde benennen unerreichbare Zustände und Sackgassen statt sie zu glätten', () => {
  const machine = {
    id: 'tasks.status',
    states: [
      { value: 'todo', sources: ['default:a.sql'] },
      { value: 'done', sources: ['write:a.sql'] },
      { value: 'verwaist', sources: ['guard:a.sql'] },
    ],
    initialStates: ['todo'],
    transitions: [{ from: ['todo'], to: 'done', kind: 'write', param: null, sources: ['a.sql'], guards: [] }],
    guards: [],
    reconciliation: null,
  };
  const findings = analyzeMachine(machine);
  const unreachable = findings.find((finding) => finding.kind === 'unerreichbar');
  assert.deepEqual(unreachable.states, ['verwaist']);
  assert.equal(unreachable.severity, 'warn');
  assert.deepEqual(findings.find((finding) => finding.kind === 'sackgasse').states, ['done']);
  assert.deepEqual(findings.find((finding) => finding.kind === 'nur-im-guard').states, ['verwaist']);
});

test('Abgleich trennt fehlende Zustandswerte von Kanten ohne Schreibbeleg', () => {
  const build = (transitions) => buildStateArtifact({
    typesSource,
    migrations: migrations([['a.sql', `update public.tasks set status='done' where status='todo';`]]),
    tsSources: [
      {
        machine: 'tasks.status',
        file: 'src/components/tasks/types.ts',
        label: 'Testregeln',
        transitions,
      },
    ],
    clientWrites: [{ table: 'tasks', column: 'status', value: 'ghost', source: 'src/example.ts' }],
  });
  const tasksOf = (artifact) => artifact.machines.find((machine) => machine.id === 'tasks.status');

  // Beide TS-Werte sind in der Datenbank belegt: nur die Kante selbst ist offen.
  const known = tasksOf(build([{ from: 'todo', to: 'done' }, { from: 'done', to: 'todo' }]));
  assert.deepEqual(known.reconciliation.valuesNotInDatabase, []);
  assert.deepEqual(known.reconciliation.onlyInCode, [{ from: 'done', to: 'todo' }]);
  assert.deepEqual(known.reconciliation.onlyInArtifact, []);
  assert.deepEqual(known.reconciliation.clientValues, [{ value: 'ghost', source: 'src/example.ts' }]);
  assert.equal(known.findings.find((finding) => finding.kind === 'nur-im-code'), undefined);
  assert.equal(known.findings.find((finding) => finding.kind === 'kanten-nicht-belegt').severity, 'info');
  assert.deepEqual(known.findings.find((finding) => finding.kind === 'client-wert-unbelegt').states, ['ghost']);

  // Ein TS-Zustand ohne DB-Beleg bleibt dagegen eine Warnung.
  const drift = tasksOf(build([{ from: 'todo', to: 'done' }, { from: 'done', to: 'ghost2' }]));
  assert.deepEqual(drift.reconciliation.valuesNotInDatabase, ['ghost2']);
  const warn = drift.findings.find((finding) => finding.kind === 'nur-im-code');
  assert.equal(warn.severity, 'warn');
  assert.deepEqual(warn.states, ['ghost2']);
  assert.equal(drift.findings.find((finding) => finding.kind === 'kanten-nicht-belegt'), undefined);
});

test('Client-Schreibvorgänge werden nur als Literale gelesen', () => {
  const writes = collectClientWrites(root, 'src/features/feature-catalog');
  assert.ok(Array.isArray(writes));
  const literal = collectClientWrites(root, 'src/components/letters');
  assert.ok(literal.every((entry) => typeof entry.value === 'string' && entry.value.length > 0));
  assert.deepEqual(splitTopLevel(`a, coalesce(b, 'x,y'), 'z'`), ['a', `coalesce(b, 'x,y')`, `'z'`]);
});

test('TS-Regelmodule werden aus dem Objektliteral gelesen', () => {
  const sources = collectTsTransitions(root);
  const tasks = sources.find((source) => source.machine === 'letters.status');
  assert.ok(tasks, 'letters.status muss registriert sein');
  assert.deepEqual(tasks.transitions.find((entry) => entry.from === 'draft' && entry.to === 'review'), {
    from: 'draft',
    to: 'review',
  });
  assert.equal(tasks.transitions.length, 9);
});

test('die Strukturprüfung meldet fehlende Quellen und falsch markierte Guards', () => {
  const errors = validateArtifact(
    {
      machines: [
        {
          id: 'tasks.status',
          states: [{ value: 'todo', sources: [] }],
          initialStates: [],
          transitions: [
            { from: null, to: 'todo', kind: 'write', param: null, sources: ['supabase/migrations/gibt-es-nicht.sql'], guards: [] },
          ],
          guards: [
            {
              trigger: 'guard_x',
              kind: 'guard',
              raises: false,
              source: 'supabase/migrations/gibt-es-nicht.sql',
              blockedTo: [],
              allowedTo: [],
            },
          ],
          findings: [],
          reconciliation: null,
        },
      ],
    },
    root,
  );
  assert.ok(errors.some((error) => error.includes('Quelle fehlt')));
  assert.ok(errors.some((error) => error.includes('bricht aber nicht ab')));
});

test('Startkanten dürfen keinen Ausgangszustand tragen', () => {
  const errors = validateArtifact(
    {
      machines: [
        {
          id: 'tasks.status',
          states: [{ value: 'todo', sources: [] }],
          initialStates: ['todo'],
          transitions: [{ from: ['todo'], to: 'todo', kind: 'initial', param: null, sources: [], guards: [] }],
          guards: [],
          findings: [],
          reconciliation: null,
        },
      ],
    },
    root,
  );
  assert.ok(errors.some((error) => error.includes('darf keinen Ausgangszustand haben')));
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
