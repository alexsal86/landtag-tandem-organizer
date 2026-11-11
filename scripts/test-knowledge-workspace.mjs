// Real PostgreSQL policies/functions in an isolated PGlite database. No live data.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const { pg_trgm } = await import('../tests/database/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js');
const { unaccent } = await import('../tests/database/node_modules/@electric-sql/pglite/dist/contrib/unaccent.js');
const db = new PGlite({ extensions: { pg_trgm, unaccent } });
const officeA = '11111111-1111-4111-8111-111111111111';
const officeB = '22222222-2222-4222-8222-222222222222';
const alice = '33333333-3333-4333-8333-333333333333';
const bob = '44444444-4444-4444-8444-444444444444';
const clara = '55555555-5555-4555-8555-555555555555';
const inactive = '66666666-6666-4666-8666-666666666666';
const legacyA = '77777777-7777-4777-8777-777777777777';
const legacyB = '88888888-8888-4888-8888-888888888888';
const read = async (sql, args = []) => (await db.query(sql, args)).rows;
const owner = () => db.exec('RESET ROLE');
const actor = async (user, role = 'authenticated') => {
  await owner(); await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role',$2,false)", [user ?? '', role]);
  await db.exec(`SET ROLE ${role}`);
};
const content = text => ({ root: { type: 'root', version: 1, children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' }], direction: null, format: '', indent: 0 }], direction: null, format: '', indent: 0 } });
const create = async (office, title, assignee = null) => (await read('SELECT * FROM knowledge_qa_create_question($1,$2,$3,$4)', [office, title, '', assignee]))[0];
const save = async (q, text) => (await read('SELECT * FROM knowledge_qa_save_answer($1,$2,$3::jsonb)', [q.id, q.revision, JSON.stringify(content(text))]))[0];
const review = async (q, verified = true, due = null) => (await read('SELECT * FROM knowledge_qa_review($1,$2,$3,$4)', [q.id, q.revision, verified, due]))[0];
const search = (office, term = '', view = 'answers') => read('SELECT * FROM search_knowledge_questions($1,$2,$3)', [office, term, view]);
const denied = operation => assert.rejects(operation, error => error.code === '42501');
const stale = operation => assert.rejects(operation, error => error.code === '40001');
try {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TYPE app_role AS ENUM ('abgeordneter','bueroleitung','mitarbeiter','praktikant');
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    CREATE TABLE profiles(user_id uuid PRIMARY KEY,tenant_id uuid,display_name text,avatar_url text);
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON profiles TO authenticated;
    CREATE TABLE notification_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,name text,label text,description text,category text,is_active boolean,UNIQUE(tenant_id,name));
    CREATE TABLE user_notification_settings(user_id uuid,notification_type_id uuid,is_enabled boolean,push_enabled boolean,UNIQUE(user_id,notification_type_id));
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,user_id uuid,notification_type_id uuid,title text,message text,data jsonb,priority text);
    CREATE TABLE user_tenant_memberships(tenant_id uuid,user_id uuid,role app_role,is_active boolean);
    CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM user_tenant_memberships m WHERE m.tenant_id=profiles.tenant_id AND m.user_id=auth.uid() AND m.is_active));
    CREATE TABLE action_permissions(tenant_id uuid,action_key text,allowed_roles app_role[],UNIQUE(tenant_id,action_key));
    CREATE FUNCTION is_superadmin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    -- Simulate historical broad storage policies: new restrictive policies must hold.
    CREATE POLICY old_storage_access ON storage.objects FOR ALL TO authenticated,anon USING(true) WITH CHECK(true);
    GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;
    GRANT SELECT ON user_tenant_memberships TO authenticated;
    GRANT ALL ON storage.objects TO authenticated,anon;
    INSERT INTO tenants VALUES('${officeA}'),('${officeB}');
    INSERT INTO user_tenant_memberships VALUES('${officeA}','${alice}','mitarbeiter',true),('${officeB}','${bob}','mitarbeiter',true),
      ('${officeA}','${clara}','mitarbeiter',true),('${officeA}','${inactive}','mitarbeiter',false);
    CREATE TABLE knowledge_documents(id uuid PRIMARY KEY,tenant_id uuid,created_by uuid,is_published boolean,is_locked boolean);
    CREATE TABLE knowledge_document_permissions(document_id uuid,user_id uuid,permission_type text);
    CREATE TABLE knowledge_document_versions(document_id uuid,tenant_id uuid);
    CREATE TABLE knowledge_document_snapshots(document_id uuid);
    CREATE TABLE knowledge_document_topics(document_id uuid);
    CREATE TABLE knowledge_document_collaborators(document_id uuid);
    INSERT INTO knowledge_documents VALUES('${legacyA}','${officeA}','${alice}',false,false),('${legacyB}','${officeB}','${bob}',true,false);
    INSERT INTO knowledge_document_versions VALUES('${legacyA}','${officeA}'),('${legacyB}','${officeB}');
    INSERT INTO knowledge_document_snapshots VALUES('${legacyA}'),('${legacyB}');
    ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE knowledge_document_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;
    CREATE POLICY old_documents ON knowledge_documents USING(true) WITH CHECK(true);
    CREATE POLICY old_versions ON knowledge_document_versions USING(true) WITH CHECK(true);
    CREATE POLICY old_snapshots ON knowledge_document_snapshots USING(true) WITH CHECK(true);
    GRANT SELECT,INSERT,UPDATE ON knowledge_documents,knowledge_document_permissions,knowledge_document_versions,knowledge_document_snapshots TO authenticated,anon;
  `);
  const actions = await readFile(new URL('../supabase/migrations/20261109142000_enforce_admin_actions.sql', import.meta.url), 'utf8');
  await db.exec(actions.slice(actions.indexOf('CREATE OR REPLACE FUNCTION public.is_tenant_action_allowed'), actions.indexOf('CREATE OR REPLACE FUNCTION public.enforce_configured_action')));
  for (const file of ['20261110180000_knowledge_qa_core.sql', '20261110180100_knowledge_qa_search.sql', '20261110180200_knowledge_qa_storage.sql', '20261110180300_knowledge_legacy_access.sql', '20261111100000_knowledge_list_payload.sql', '20261111100100_knowledge_keyset.sql', '20261111100200_knowledge_search.sql', '20261111100300_knowledge_views_filters.sql', '20261111100400_knowledge_notifications.sql', '20261111100500_knowledge_manage.sql', '20261111100600_knowledge_manage_trigram_recovery.sql', '20261111100700_knowledge_person_avatars.sql']) {
    if (file === '20261111100500_knowledge_manage.sql' && process.env.KNOWLEDGE_SKIP_FAILED_MANAGE === '1') continue;
    const migration=await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
    await db.exec(migration);

  }

  for (const file of ['20261111100800_knowledge_tags.sql']) {
    const migration=await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
    await db.exec(migration); await db.exec(migration);
  }
  await actor(alice);
  let q=await create(officeA,'Tag-Abnahme');
  await assert.rejects(read('SELECT knowledge_qa_set_tags($1,$2,$3)',[q.id,q.revision,['Urlaub']]),e=>e.code==='22023');
  q=await save(q,'Eine Antwort.');
  await read('SELECT knowledge_qa_set_tags($1,$2,$3)',[q.id,q.revision,['Urlaub','Büro']]);
  q=(await read('SELECT * FROM knowledge_questions WHERE id=$1',[q.id]))[0];
  const page=(await read("SELECT * FROM knowledge_qa_list($1,'','answers',20,NULL,'','','updated','','')",[officeA]))[0];
  assert.equal(page.items[0].tags.length,2); assert.ok(page.counts); assert.equal(page.topics.length,2);
  const tag=page.items[0].tags.find(t=>t.name==='Urlaub');
  assert.equal((await read("SELECT * FROM knowledge_qa_list($1,'','answers',20,NULL,'','','updated',$2,'')",[officeA,tag.id]))[0].total_count,1);
  assert.equal((await read("SELECT * FROM knowledge_qa_list($1,'','answers',20,NULL,'','','updated','','open')",[officeA]))[0].total_count,0);
  assert.equal((await read("SELECT * FROM knowledge_qa_list($1,'Urlaub')",[officeA]))[0].total_count,1);
  await assert.rejects(read("SELECT * FROM knowledge_qa_list($1,'','answers',20,NULL,'','','updated','bad','')",[officeA]),e=>e.code==='22023');
  await assert.rejects(read("SELECT * FROM knowledge_qa_list($1,'','answers',20,NULL,'','','updated','','bad')",[officeA]),e=>e.code==='22023');
  await assert.rejects(read('SELECT knowledge_qa_set_tags($1,$2,$3)',[q.id,q.revision,['Urlaub','urlaub']]),e=>e.code==='22023');
  await assert.rejects(read('SELECT knowledge_qa_set_tags($1,$2,$3)',[q.id,q.revision,['aa','bb','cc','dd','ee','ff']]),e=>e.code==='22023');
  await owner(); await db.query("INSERT INTO action_permissions VALUES($1,'knowledge.write','{}')",[officeA]); await actor(alice);
  await denied(read('SELECT knowledge_qa_set_tags($1,$2,$3)',[q.id,q.revision,['Nein']]));
  await owner(); await db.query("DELETE FROM action_permissions WHERE action_key='knowledge.write'"); await actor(bob);
  assert.equal((await read("SELECT * FROM knowledge_qa_list($1)",[officeA]))[0].total_count,0);
  console.log('Knowledge 11–14 acceptance: quick/tag filters, tag rights, bounded metadata and idempotent migrations passed.');
} catch(error) { console.error(error.message,error.code??'',error.stack); process.exitCode=1; }
finally { await db.close(); }
