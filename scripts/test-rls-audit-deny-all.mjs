import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

// Prüft die Bewertungsregel aus 20261128003000_rls_deny_all_client_grant.sql:
// Ohne Client-Grant (anon/authenticated) ist eine fehlende Policy beabsichtigtes
// Deny-all; erreichbare Tabellen ohne Policy bleiben kritisch.
const db = new PGlite();
const query = async (sql, args = []) => (await db.query(sql, args)).rows;

const denyAllTables = [
  'team_fun_facts',
  'team_two_truths_months',
  'team_two_truths_answers',
  'quick_note_topic_mention_deliveries',
];

try {
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    grant usage on schema public to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select '99999999-9999-4999-8999-999999999999'::uuid
    $$;
    create type public.app_role as enum ('abgeordneter','bueroleitung','mitarbeiter');
    create function public.is_superadmin(u uuid) returns boolean language sql immutable as $$ select true $$;
    create function public.has_role(u uuid, r public.app_role) returns boolean language sql immutable as $$ select true $$;

    create table public.security_audit_snapshots (
      id uuid primary key default gen_random_uuid(),
      captured_at timestamptz not null default now(),
      total_tables integer not null default 0,
      rls_enabled_count integer not null default 0,
      critical_count integer not null default 0,
      warning_count integer not null default 0,
      findings jsonb not null default '[]'::jsonb
    );
    alter table public.security_audit_snapshots enable row level security;
    create policy "Superadmin reads security snapshots" on public.security_audit_snapshots
      for select to authenticated using (true);
    create policy "System inserts security snapshots" on public.security_audit_snapshots
      for insert to authenticated with check (true);
  `);

  // Die vier fachlichen Deny-all-Tabellen: RLS an, keine Policy, keine Client-Rechte.
  for (const table of denyAllTables) {
    await db.exec(`
      create table public.${table} (tenant_id uuid not null, user_id uuid);
      alter table public.${table} enable row level security;
      revoke all on public.${table} from public, anon, authenticated;
    `);
  }

  // Gegenprobe: erreichbar (Grant) ohne Policy muss kritisch bleiben.
  await db.exec(`
    create table public.contacts (tenant_id uuid not null);
    alter table public.contacts enable row level security;
    grant select, insert, update, delete on public.contacts to authenticated;
  `);

  // Gegenprobe: RLS deaktiviert bleibt in jedem Fall kritisch.
  await db.exec(`create table public.system_health (id uuid primary key default gen_random_uuid());`);

  // Ausgangsstand wie in Produktion: die bisherige Coverage-View ohne Grant-Spalte,
  // damit der Test den Ersetzungspfad der Migration abdeckt und nicht nur einen Neubau.
  await db.exec(`
    create view public.v_rls_coverage as
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced,
      coalesce(p.policy_count, 0) as policy_count,
      exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'tenant_id'
      ) as has_tenant_id,
      exists (
        select 1 from information_schema.columns col
        where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'user_id'
      ) as has_user_id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join (
      select schemaname, tablename, count(*) as policy_count
      from pg_policies where schemaname = 'public' group by schemaname, tablename
    ) p on p.schemaname = 'public' and p.tablename = c.relname
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);

  await db.exec(await readFile(new URL('../supabase/migrations/20261128003000_rls_deny_all_client_grant.sql', import.meta.url), 'utf8'));

  const gaps = await query('select table_name, severity, reason, has_tenant_id, policy_count from public.audit_rls_gaps()');
  const byTable = new Map(gaps.map((row) => [row.table_name, row]));

  for (const table of denyAllTables) {
    const gap = byTable.get(table);
    assert.ok(gap, `${table} fehlt im Audit`);
    assert.equal(gap.severity, 'ok', `${table} darf nicht mehr kritisch sein`);
    assert.equal(gap.reason, 'Deny-all ohne Client-Grant (beabsichtigt)');
    assert.equal(gap.policy_count, 0);
    assert.equal(gap.has_tenant_id, true);
  }

  assert.equal(byTable.get('contacts').severity, 'critical', 'Grant ohne Policy bleibt kritisch');
  assert.equal(byTable.get('contacts').reason, 'tenant_id vorhanden, aber keine Policy');
  assert.equal(byTable.get('system_health').severity, 'critical', 'RLS deaktiviert bleibt kritisch');

  const critical = gaps.filter((gap) => gap.severity === 'critical');
  assert.deepEqual(
    critical.map((gap) => gap.table_name).sort(),
    ['contacts', 'system_health'],
    'Nur echte Lücken bleiben kritisch',
  );

  await query('select public.snapshot_rls_coverage_internal()');
  const [snapshot] = await query(`
    select total_tables, critical_count, warning_count, findings
    from public.security_audit_snapshots
    order by captured_at desc
    limit 1
  `);

  assert.equal(snapshot.critical_count, critical.length, 'Snapshot zählt dieselben kritischen Befunde wie das Audit');
  assert.equal(snapshot.total_tables, gaps.length);
  for (const table of denyAllTables) {
    const finding = snapshot.findings.find((entry) => entry.table === table);
    assert.ok(finding, `${table} fehlt im Snapshot`);
    assert.equal(finding.client_grant, false, `${table}: Grant-Stand gehört in den Snapshot`);
  }

  console.log('RLS-Audit-Check passed: deny-all ohne Client-Grant ist ok, echte Lücken bleiben kritisch, Snapshot zählt gleich.');
} finally {
  await db.close();
}
