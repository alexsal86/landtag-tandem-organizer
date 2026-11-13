import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const tenant = '11111111-1111-4111-8111-111111111111';
const otherTenant = '22222222-2222-4222-8222-222222222222';
const lead = '33333333-3333-4333-8333-333333333333';
const staff = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const actor = async id => {
  await db.exec('RESET ROLE');
  await db.query("select set_config('test.actor',$1,false)", [id]);
  await db.exec('SET ROLE authenticated');
};
const rpc = async (name, target = tenant) => (await query(`select ${name}($1) result`, [target]))[0].result;
try {
  await db.exec(`
    create schema auth; create role authenticated; create role anon;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    create table tenants(id uuid primary key);
    create table profiles(tenant_id uuid,user_id uuid,display_name text);
    create table employee_settings(user_id uuid,admin_id uuid,employment_start_date date);
    create table user_tenant_memberships(tenant_id uuid,user_id uuid,role text,is_active boolean);
    create function is_tenant_admin(u uuid,t uuid) returns boolean language sql security definer set search_path=public as $$
      select exists(select 1 from user_tenant_memberships where user_id=u and tenant_id=t and is_active and role='bueroleitung') $$;
    grant select on profiles to authenticated;
    insert into tenants values('${tenant}'),('${otherTenant}');
    insert into auth.users values('${lead}'),('${staff}'),('${outsider}');
    insert into profiles values('${tenant}','${staff}','Teammitglied');
    insert into user_tenant_memberships values('${tenant}','${lead}','bueroleitung',true),('${tenant}','${staff}','mitarbeiter',true),('${otherTenant}','${outsider}','mitarbeiter',true);
  `);
  for (const name of ['20261113130000_team_rituals_phase1.sql', '20261113160500_team_ritual_employee_access.sql',
    '20261113161000_team_two_truths.sql', '20261113170000_team_question_last_used.sql', '20261113200000_team_ritual_usage_archive.sql']) {
    await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
  }
  await db.exec(`
    insert into team_ritual_settings values('${tenant}',true),('${otherTenant}',true);
    insert into team_ritual_profiles(tenant_id,user_id,opted_in) values('${tenant}','${lead}',false),('${tenant}','${staff}',true),('${otherTenant}','${outsider}',true);
    insert into team_fun_facts values('${tenant}','${staff}',array['A','B','C'],2,true);
    insert into team_two_truths_months(tenant_id,month_start,subject_user_id,facts,lie_index)
      values('${tenant}',(date_trunc('month',current_timestamp at time zone 'Europe/Berlin')-interval '1 month')::date,'${staff}',array['A','B','C'],2);
    insert into team_questions(tenant_id,question) values('${tenant}','Wiederholbare Frage');
    insert into team_question_weeks(tenant_id,week_start,question_id,question)
      select tenant_id,(date_trunc('week',current_timestamp at time zone 'Europe/Berlin')-interval '7 days')::date,id,question from team_questions;
    insert into team_question_weeks(tenant_id,week_start,question_id,question)
      select tenant_id,(date_trunc('week',current_timestamp at time zone 'Europe/Berlin')-interval '14 days')::date,id,question from team_questions;
  `);
  await actor(lead);
  let snapshot = await rpc('team_ritual_snapshot');
  assert.equal(snapshot.questions[0].usage_count, 2, 'Leadership sees usage without opting in');
  assert.ok(snapshot.questions[0].last_used_week);
  await assert.rejects(rpc('team_two_truths_archive'), /Teilnahme nicht aktiviert/);
  await actor(staff);
  assert.equal(await rpc('team_two_truths_snapshot'), null, 'Used statements are exhausted instead of repeated');
  let archive = await rpc('team_two_truths_archive');
  assert.equal(archive.length, 1);
  assert.deepEqual(Object.keys(archive[0]).sort(), ['facts', 'id', 'month', 'subject_name']);
  await query("select save_team_fun_facts($1,array[' c ','a','B'],0,true)", [tenant]);
  assert.equal(await rpc('team_two_truths_snapshot'), null, 'Reordered/case/space edits stay used');
  await query("select save_team_fun_facts($1,array['New A','New B','New C'],2,true)", [tenant]);
  const current = await rpc('team_two_truths_snapshot');
  assert.deepEqual(current.facts, ['New A', 'New B', 'New C']);
  assert.equal(current.answered, false);
  assert.equal('lie_index' in current, false, 'No solution before answering');
  assert.equal((await rpc('team_two_truths_archive')).length, 1, 'Current quiz excluded from archive');
  await query('select answer_two_truths_quiz($1,$2,0)', [tenant, current.id]);
  await query('select answer_two_truths_quiz($1,$2,2)', [tenant, current.id]);
  assert.equal((await rpc('team_two_truths_snapshot')).correct, false, 'First answer stays final');
  await query("select save_team_fun_facts($1,array['Next A','Next B','Next C'],1,true)", [tenant]);
  assert.deepEqual((await rpc('team_two_truths_snapshot')).facts, current.facts, 'Edits preserve current snapshot');
  await actor(outsider);
  await assert.rejects(rpc('team_two_truths_archive'), /Teilnahme nicht aktiviert/);
  await assert.rejects(rpc('team_ritual_snapshot'), /Keine Berechtigung/);
  assert.deepEqual(await rpc('team_two_truths_archive', otherTenant), []);
  await assert.rejects(query('select * from team_two_truths_months'), e => e.code === '42501');
  await actor(staff);
  await query("select save_team_fun_facts($1,array['Next A','Next B','Next C'],1,false)", [tenant]);
  assert.deepEqual(await rpc('team_two_truths_archive'), [], 'Withdrawal removes archived statements');
  assert.equal(await rpc('team_two_truths_snapshot'), null);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(rpc('team_two_truths_archive'), e => e.code === '42501');
  console.log('Team ritual history SQL checks passed: usage, repeat exclusion, snapshot stability, archive, consent, tenant and role isolation.');
} finally { await db.close(); }
