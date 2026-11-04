// Run against an ephemeral PostgreSQL engine, never the production database.
// node scripts/verify-quick-notes-db.mjs /tmp/notes-db/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2];
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [a,b,c,unknown,t1,t2,n1,n2,n3,n4,task1,task2] = [1,2,3,4,11,12,21,22,23,24,31,32].map(id);
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table tenants(id uuid primary key);
create table user_tenant_memberships(user_id uuid, tenant_id uuid, is_active boolean default true);
create table profiles(user_id uuid, tenant_id uuid, display_name text, avatar_url text);
create table tasks(id uuid primary key, tenant_id uuid);
create table topic_backlog(id uuid primary key, tenant_id uuid);
create table task_decisions(id uuid primary key, tenant_id uuid);
create table case_items(id uuid primary key, tenant_id uuid, status text);
create table meetings(id uuid primary key, tenant_id uuid, title text, meeting_date timestamptz, status text, is_public boolean default false, user_id uuid);
create table meeting_participants(meeting_id uuid, user_id uuid);
create table quick_notes(id uuid primary key default gen_random_uuid(),user_id uuid not null,title text,content text not null,
 color text default '#3b82f6',color_full_card boolean default false,is_pinned boolean default false,priority_level integer default 0,
 created_at timestamptz default now(), updated_at timestamptz default now(),
 task_id uuid references tasks on delete set null, decision_id uuid references task_decisions on delete set null,
 case_item_id uuid references case_items on delete set null, meeting_id uuid references meetings on delete set null,
 topic_backlog_id uuid, task_archived_info jsonb, decision_archived_info jsonb, meeting_archived_info jsonb,
 is_archived boolean default false, archived_at timestamptz, deleted_at timestamptz, permanent_delete_at timestamptz,
 follow_up_date timestamptz,pending_for_jour_fixe boolean default false,added_to_meeting_at timestamptz,meeting_result text);
create table quick_note_shares(id uuid primary key default gen_random_uuid(), note_id uuid references quick_notes, shared_by_user_id uuid, shared_with_user_id uuid, permission_type text default 'view');
create table quick_note_global_shares(id uuid primary key default gen_random_uuid(), user_id uuid, shared_with_user_id uuid, permission_type text default 'view', constraint unique_global_share unique(user_id,shared_with_user_id));
create table quick_note_versions(id uuid primary key default gen_random_uuid(),note_id uuid references quick_notes, user_id uuid, title text,content text,created_at timestamptz default now());
create function update_note_timestamp() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger update_quick_notes_updated_at before update on quick_notes for each row execute function update_note_timestamp();
alter table quick_notes enable row level security;
alter table quick_note_shares enable row level security;
alter table quick_note_global_shares enable row level security;
alter table quick_note_versions enable row level security;
create policy "Users can manage their own quick notes" on quick_notes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy public_meeting_notes on quick_notes for select using (exists(select 1 from meetings where id=quick_notes.meeting_id and is_public));
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage on schema auth to anon;
grant select on quick_notes,meetings to anon;
insert into tenants values('${t1}'),('${t2}');
insert into user_tenant_memberships values('${a}','${t1}',true),('${a}','${t2}',true),('${b}','${t1}',true),('${b}','${t2}',true),('${c}','${t2}',true),('${unknown}','${t1}',true),('${unknown}','${t2}',true);
insert into profiles values('${a}','${t1}','Alice',null),('${b}','${t1}','Bob',null),('${c}','${t2}','Carol',null);
insert into tasks values('${task1}','${t1}'),('${task2}','${t2}');
insert into meetings(id,tenant_id,title,is_public) values('${id(51)}','${t1}','Public',true);
insert into quick_notes(id,user_id,title,content,task_id) values('${n1}','${a}','T1','Original','${task1}'),('${n2}','${a}','T2','Private T2','${task2}');
insert into quick_notes(id,user_id,title,content) values('${n3}','${a}','Profile','Original'),('${n4}','${unknown}','Unresolved','Preserve');
insert into quick_note_global_shares(user_id,shared_with_user_id) values('${a}','${b}');
insert into quick_note_shares(note_id,shared_by_user_id,shared_with_user_id) values('${n1}','${a}','${c}');
insert into quick_note_versions(note_id,user_id,content) values('${n1}','${a}','Earlier');
alter table quick_notes disable trigger update_quick_notes_updated_at;
update quick_notes set updated_at = '2026-09-01T00:00:00Z' where id='${n3}';
alter table quick_notes enable trigger update_quick_notes_updated_at;
update quick_notes set meeting_id='${id(51)}' where id='${n1}';
`);
for (const migration of ['20261104120000_delete_quick_note_with_links_atomically.sql', '20261104220000_quick_notes_tenants_and_sync.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
}
let passed = 0;
const test = async (name, work) => { await work(); passed++; console.log(`PASS ${name}`); };
const actor = async user => db.exec(`reset role; set role authenticated; set test.uid='${user ?? ''}';`);
const value = async sql => (await db.query(sql)).rows[0].value;
const list = async tenant => JSON.parse(JSON.stringify(await value(`select list_quick_notes('${tenant}') as value`)));
const save = async ({ user = a, note = n1, tenant = t1, op = id(101), title = 'T1', content = 'Edited', revision = 0, create = false } = {}) =>
 value(`select save_quick_note('${tenant}','${note}','${op}','${user}',${title === null ? 'null' : "'"+title.replaceAll("'","''")+"'"},'${content.replaceAll("'","''")}',${revision},${create}) as value`);
await test('backfill follows linked tenant and preserves ambiguous notes in quarantine', async () => {
 assert.equal(await value(`select tenant_id::text as value from quick_notes where id='${n2}'`),t2);
 assert.equal(await value(`select tenant_id::text as value from quick_notes where id='${n3}'`),t1);
 assert.equal(await value(`select tenant_id::text as value from quick_notes where id='${n4}'`),null);
 assert.equal(await value(`select tenant_id::text as value from quick_note_versions where note_id='${n1}'`),t1);
 assert.equal(await value(`select updated_at < '2026-10-01'::timestamptz as value from quick_notes where id='${n3}'`),true);
});
await actor(a);
await test('read RPC returns only the selected workspace', async () => {
 assert.deepEqual((await list(t1)).map(n=>n.id).sort(),[n1,n3]);
 assert.deepEqual((await list(t2)).map(n=>n.id),[n2]);
});
await actor(b);
await test('global grant in T1 cannot expose T2 even to a member of both tenants', async () => {
 assert.equal((await list(t1)).length,2); assert.equal((await list(t2)).length,0);
});
await test('view-only shared notes cannot be edited and no history is exposed', async () => {
 await assert.rejects(save({user:b}), /Keine Bearbeitungsberechtigung/);
 assert.equal(await value('select count(*)::int as value from quick_note_versions'),0);
});
await actor(c);
await test('legacy cross-tenant share cannot grant membership or read access', async () => {
 await assert.rejects(list(t1), /Kein Zugriff/); assert.equal((await list(t2)).length,0);
 assert.equal(await value('select count(*)::int as value from quick_notes'),0);
});
await actor(a);
await test('cross-tenant shares and links are rejected at the database', async () => {
 await assert.rejects(db.exec(`insert into quick_note_shares(note_id,shared_by_user_id,shared_with_user_id) values('${n3}','${a}','${c}')`), /row-level security/);
 await assert.rejects(db.exec(`update quick_notes set task_id='${task2}' where id='${n1}'`), /anderem Mandanten/);
 await assert.rejects(db.exec(`update quick_notes set tenant_id='${t2}' where id='${n1}'`), /unveränderlich/);
 await assert.rejects(db.exec(`update quick_notes set user_id='${b}' where id='${n1}'`), /unveränderlich/);
});
await test('save snapshots history atomically and rejects stale revisions', async () => {
 const saved=await save(); assert.equal(saved.revision,1); assert.equal(saved.content,'Edited');
 await assert.rejects(save({op:id(102),content:'stale'}), /NOTE_CONFLICT/);
 assert.equal(await value(`select content as value from quick_notes where id='${n1}'`),'Edited');
 assert.equal(await value(`select count(*)::int as value from quick_note_versions where note_id='${n1}'`),2);
});
await test('transport retry returns receipt without duplicate version or note', async () => {
 const saved=await save(); assert.equal(saved.revision,1);
 assert.equal(await value(`select count(*)::int as value from quick_note_versions where note_id='${n1}'`),2);
 const created=await save({note:id(41),op:id(103),create:true,title:'Offline'});
 const retried=await save({note:id(41),op:id(103),create:true,title:'Offline'});
 assert.equal(created.id,retried.id); assert.equal(await value(`select count(*)::int as value from quick_notes where id='${id(41)}'`),1);
});
await test('queue cannot be submitted under a different signed-in user', async () => {
 await assert.rejects(save({user:b,note:id(42),op:id(104),create:true}), /Benutzer hat sich geändert/);
});
await db.exec(`update quick_note_global_shares set permission_type='edit' where user_id='${a}' and shared_with_user_id='${b}'`);
await actor(b);
await test('same-tenant editor can save, but cannot reassign or archive shared notes', async () => {
 await save({user:b,op:id(105),revision:1,content:'Shared edit'});
 await assert.rejects(db.exec(`update quick_notes set is_archived=true where id='${n1}'`), /nur Inhalts/);
 await assert.rejects(db.exec(`update quick_notes set meeting_result='Forged result' where id='${n1}'`), /Nur Besprechungsteilnehmer/);
 await assert.rejects(db.exec(`update quick_notes set user_id='${b}' where id='${n1}'`), /unveränderlich/);
});
await db.exec(`reset role; insert into meeting_participants values('${id(51)}','${b}');`);
await actor(b);
await test('a shared editor who is also a meeting participant can still record the meeting result', async () => {
 await db.exec(`update quick_notes set meeting_result='Legitimate meeting result' where id='${n1}'`);
 assert.equal(await value(`select meeting_result as value from quick_notes where id='${n1}'`),'Legitimate meeting result');
});
await db.exec('reset role');
await db.exec(`update user_tenant_memberships set is_active=false where user_id='${b}' and tenant_id='${t1}'`);
await actor(b);
await test('revoked membership blocks notes, versions and receipts', async () => {
 await assert.rejects(list(t1), /Kein Zugriff/);
 assert.equal(await value('select count(*)::int as value from quick_note_versions'),0);
 assert.equal(await value('select count(*)::int as value from quick_note_write_receipts'),0);
});
await actor(null);
await test('anonymous requests cannot use read or write RPCs', async () => { await assert.rejects(list(t1), /Kein Zugriff/); });
await db.exec('reset role; set role anon;');
await test('public meeting policy cannot bypass the anonymous tenant boundary', async () => {
 try { assert.equal(await value('select count(*)::int as value from quick_notes'),0); }
 catch(error) { assert.match(error.message,/permission denied/); }
});
// Force the final delete step to fail after the linked task has been deleted.
await db.exec(`reset role; create function test_reject_delete() returns trigger language plpgsql as $$ begin if new.deleted_at is not null then raise exception 'simulated final failure'; end if; return new; end $$;
create trigger reject_delete before update on quick_notes for each row execute function test_reject_delete();`);
await actor(a);
await test('linked deletion still rolls back every earlier operation on final error', async () => {
 await assert.rejects(db.exec(`select delete_quick_note_with_links('${n1}',true,false,false,false)`), /simulated final failure/);
 assert.equal(await value(`select count(*)::int as value from tasks where id='${task1}'`),1);
 assert.equal(await value(`select deleted_at is null as value from quick_notes where id='${n1}'`),true);
});
console.log(`${passed} database checks passed`);
await db.close();
