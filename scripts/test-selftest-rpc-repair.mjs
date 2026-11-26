import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';
import { pg_trgm } from '../tests/database/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL('../supabase/migrations/20261127120000_selftest_client_rpc_and_trgm_repair.sql', import.meta.url),
  'utf8',
);

const db = new PGlite({ extensions: { pg_trgm } });
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`);
};

await db.exec(`
create role anon;
create role authenticated;
create role service_role;
create schema extensions;
create extension pg_trgm with schema extensions;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth, extensions to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.user_tenant_memberships (user_id uuid, tenant_id uuid, is_active boolean default true);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid, user_id uuid, name text, email text, phone text,
  contact_type text default 'person', organization_id uuid,
  updated_at timestamptz default now()
);
create table public.task_decisions (id uuid primary key default gen_random_uuid(), tenant_id uuid, title text, description text, case_file_id uuid, case_item_id uuid);
create table public.tasks (id uuid primary key default gen_random_uuid(), user_id uuid, tenant_id uuid, title text, description text,
  assigned_to text, priority text, category text, status text, source_type text, source_id uuid);
create table public.task_decision_responses (decision_id uuid, participant_id uuid, response_type text, created_at timestamptz default now());
create table public.case_items (id uuid primary key default gen_random_uuid(), case_file_id uuid);
create table public.case_file_tasks (case_file_id uuid, task_id uuid);

grant select, insert, update on public.contacts to authenticated;
grant select on public.user_tenant_memberships to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, update on public.task_decisions, public.task_decision_responses, public.case_items, public.case_file_tasks to authenticated;
grant insert on public.task_decisions, public.task_decision_responses to authenticated;
grant insert on public.case_file_tasks to authenticated;

create function public.is_tenant_member(_tenant_id uuid, _user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_tenant_memberships where tenant_id = _tenant_id and user_id = _user_id and is_active);
$$;
grant execute on function public.is_tenant_member(uuid, uuid) to authenticated;

-- Ausgangslage: Funktionen wie nach 20261119 bzw. mit altem search_path.
create function public.find_contact_duplicates_trgm(_tenant_id uuid, _threshold numeric default 0.55, _limit int default 200)
returns table (contact1_id uuid, contact2_id uuid, match_score numeric)
language sql stable security invoker set search_path = extensions, public as $$
  select a.id, b.id, greatest(similarity(a.name, b.name), similarity(coalesce(a.email,''), coalesce(b.email,'')))::numeric
  from public.contacts a join public.contacts b on a.id < b.id
  where a.tenant_id = _tenant_id and b.tenant_id = _tenant_id and a.name % b.name
  limit _limit;
$$;
-- So liegt die Funktion auf der Instanz: 20261109143000 hat sie nur auf INVOKER
-- umgestellt, der alte search_path=public aus 20260507184309 blieb stehen.
alter function public.find_contact_duplicates_trgm(uuid, numeric, int) set search_path = public;
grant execute on function public.find_contact_duplicates_trgm(uuid, numeric, int) to authenticated;

create function public.assign_contact_to_organization(contact_id uuid, org_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin update public.contacts set organization_id = org_id where id = contact_id; end $$;
revoke all on function public.assign_contact_to_organization(uuid, uuid) from public, anon, authenticated;

create function public.handover_tasks_to_deputy(p_tenant uuid, p_user uuid, p_deputy uuid) returns integer
language plpgsql security definer set search_path = public as $$ begin return 0; end $$;
revoke all on function public.handover_tasks_to_deputy(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.handover_tasks_to_deputy(uuid, uuid, uuid) to service_role;
`);

const tenant = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const user = '33333333-3333-4333-8333-333333333333';
await db.exec(`
insert into public.user_tenant_memberships (user_id, tenant_id, is_active) values ('${user}', '${tenant}', true);
insert into public.contacts (id, tenant_id, user_id, name, email, contact_type) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '${tenant}', '${user}', 'Erika Mustermann', 'erika@example.org', 'organization'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '${tenant}', '${user}', 'Erika Mustermann', 'erika@example.org', 'person'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '${foreign}', '${user}', 'Erika Mustermann', 'erika@example.org', 'person'),
  ('aaaaaaaa-0000-4000-8000-000000000004', '${foreign}', '${user}', 'Fremde Organisation', null, 'organization');
`);

// DSGVO-Anfrage als Ausgangslage (Tabelle existiert vor der Migration).
await db.exec(`
create table public.gdpr_requests (
  id uuid primary key default gen_random_uuid(), subject_email text, subject_name text,
  request_type text, requested_by uuid, status text default 'pending',
  approved_by uuid, approved_at timestamptz, updated_at timestamptz default now()
);
grant select, update, delete on public.gdpr_requests to authenticated;
insert into public.gdpr_requests (id, subject_email, subject_name, request_type, requested_by, status)
values ('cccccccc-0000-4000-8000-000000000001', 'erika.muster@example.org', 'Erika Muster', 'delete', '${user}', 'pending');
`);

const asUser = async (fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false)`);
  try { return { value: await fn() }; }
  catch (error) { return { error }; }
  finally { await db.exec('reset role'); }
};

// VOR der Migration
const before = await asUser(() => db.query(`select * from public.find_contact_duplicates_trgm($1, 0.5, 10)`, [tenant]).then((r) => r.rows));
check('VOR: Dubletten-Scan scheitert an similarity()', /similarity/.test(before.error?.message ?? ''), before.error?.message?.split('\n')[0]);

const beforeGrant = await asUser(() => db.query(`select public.assign_contact_to_organization($1,$2)`, ['aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001']));
check('VOR: assign_contact_to_organization verweigert (42501)', beforeGrant.error?.message?.includes('permission denied') ?? false, beforeGrant.error?.message);

// Migration anwenden (zweimal, um Idempotenz zu prüfen)
await db.exec(sql);
await db.exec(sql);
await db.exec('discard plans');

const scan = await asUser(() => db.query(`select * from public.find_contact_duplicates_trgm($1, 0.5, 10)`, [tenant]).then((r) => r.rows));
if (scan.error) console.log('DEBUG scan:', scan.error.message);
const direct = await db.query(`select * from public.find_contact_duplicates_trgm($1, 0.5, 10)`, [tenant]).catch((e) => ({ error: e }));
if (direct?.error) console.log('DEBUG scan als postgres:', direct.error.message);
check('NACH: Dubletten-Scan findet das Paar', scan.error === undefined && scan.value?.length >= 1, scan.error?.message);

const assigned = await asUser(() => db.query(`select public.assign_contact_to_organization($1,$2)`, ['aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001']));
check('NACH: eigene Zuordnung erlaubt', assigned.error === undefined, assigned.error?.message);
const stored = await db.query(`select organization_id from public.contacts where id='aaaaaaaa-0000-4000-8000-000000000002'`);
check('NACH: organization_id geschrieben', stored.rows[0].organization_id === 'aaaaaaaa-0000-4000-8000-000000000001', String(stored.rows[0].organization_id));

const foreignContact = await asUser(() => db.query(`select public.assign_contact_to_organization($1,$2)`, ['aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001']));
check('NACH: fremder Kontakt abgewiesen (42501)', foreignContact.error?.message?.includes('Kein Zugriff') ?? false, foreignContact.error?.message);

const foreignOrg = await asUser(() => db.query(`select public.assign_contact_to_organization($1,$2)`, ['aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000004']));
check('NACH: fremde Organisation abgewiesen (22023)', foreignOrg.error?.message?.includes('gehört nicht zum Büro') ?? false, foreignOrg.error?.message);

const grants = await db.query(`
  select has_function_privilege('authenticated','public.handover_tasks_to_deputy(uuid,uuid,uuid)','EXECUTE') handover,
         has_function_privilege('authenticated','public.assign_contact_to_organization(uuid,uuid)','EXECUTE') assign,
         has_function_privilege('authenticated','public.create_decision_task(uuid)','EXECUTE') decision,
         has_function_privilege('anon','public.create_decision_task(uuid)','EXECUTE') decision_anon
`);
check('NACH: authenticated darf handover/assign/decision', grants.rows[0].handover && grants.rows[0].assign && grants.rows[0].decision, JSON.stringify(grants.rows[0]));
check('NACH: anon bleibt ausgeschlossen', grants.rows[0].decision_anon === false);

const searchPath = await db.query(`
  select p.proconfig from pg_proc p where p.oid = 'public.find_contact_duplicates_trgm(uuid,numeric,int)'::regprocedure
`);
check('NACH: search_path enthält extensions', (searchPath.rows[0].proconfig ?? []).some((c) => c.includes('extensions')), JSON.stringify(searchPath.rows[0].proconfig));

const decisionId = 'bbbbbbbb-0000-4000-8000-000000000001';
await db.exec(`
insert into public.task_decisions (id, tenant_id, title, description) values ('${decisionId}', '${tenant}', 'Testentscheidung', 'Beschreibung');
insert into public.task_decision_responses (decision_id, participant_id, response_type) values ('${decisionId}', '${user}', 'yes');
`);
const decision = (await asUser(() => db.query(`select public.create_decision_task($1) id`, [decisionId]).then((r) => r.rows[0].id))).value;
const decisionAgain = (await asUser(() => db.query(`select public.create_decision_task($1) id`, [decisionId]).then((r) => r.rows[0].id))).value;
check('NACH: create_decision_task(p_decision_id) liefert Aufgabe', typeof decision === 'string' && decision.length === 36, String(decision));
check('NACH: zweiter Aufruf liefert dieselbe Aufgabe', decision === decisionAgain);

const gdprSubject = await asUser(() => db.query(
  `update public.gdpr_requests set subject_email = 'geaendert@example.org' where id = 'cccccccc-0000-4000-8000-000000000001' returning id`));
check('NACH: DSGVO-Gegenstand unveränderlich', /unveränderlich/.test(gdprSubject.error?.message ?? ''), gdprSubject.error?.message);

const gdprStatus = await asUser(() => db.query(
  `update public.gdpr_requests set status = 'approved' where id = 'cccccccc-0000-4000-8000-000000000001' returning status`));
check('NACH: Statuswechsel bleibt möglich', gdprStatus.error === undefined, gdprStatus.error?.message);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Prüfungen grün`);
if (failed.length) process.exitCode = 1;
