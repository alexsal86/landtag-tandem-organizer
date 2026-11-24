// Prüft, dass Rechteauskunft (explain_*) und Durchsetzung (boolesche Hüllen)
// dieselben Entscheidungen treffen und Nicht-Administratoren sowie Nicht-Mitglieder
// verweigert werden. Läuft gegen die echten Migrationsfunktionen in PGlite.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const admin = '33333333-3333-4333-8333-333333333333';
const staff = '44444444-4444-4444-8444-444444444444';
const outsider = '55555555-5555-4555-8555-555555555555';
const platform = '66666666-6666-4666-8666-666666666666';

const migration = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const actor = async (id, role = 'authenticated') => {
  await db.query("SELECT set_config('test.actor',$1,false),set_config('test.role',$2,false)", [id, role]);
  await db.exec(`SET ROLE ${role}`);
};
const owner = () => db.exec('RESET ROLE');
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

// Durchsetzung für Dritte ist absichtlich nur service_role erlaubt.
const actionEnforced = async (userId, tenant, action) => {
  await actor(admin, 'service_role');
  return (await q('SELECT public.is_tenant_action_allowed($1,$2,$3) AS v', [userId, tenant, action]))[0].v;
};
const actionExplained = async (userId, tenant, action, simulate = null) => {
  await actor(admin);
  return (await q('SELECT public.explain_action_permission($1,$2,$3,$4) AS e',
    [userId, tenant, action, simulate]))[0].e;
};
const fieldEnforced = async (userId, table, column) => {
  await actor(userId);
  return (await q('SELECT public.can_read_field($1,$2,$3) AS r, public.can_write_field($1,$2,$3) AS w',
    [userId, table, column]))[0];
};
const fieldExplained = async (userId, table, column) => {
  await actor(admin);
  return (await q('SELECT public.explain_field_permission($1,$2,$3,$4) AS e',
    [userId, a, table, column]))[0].e;
};
const featureEnforced = async (tenant, key) => {
  await actor(staff);
  return (await q('SELECT public.is_feature_enabled($1,$2) AS v', [tenant, key]))[0].v;
};
const featureExplained = async (userId, tenant, key) => {
  await actor(admin);
  return (await q('SELECT public.explain_feature_flag($1,$2,$3) AS e', [userId, tenant, key]))[0].e;
};

try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TYPE app_role AS ENUM ('abgeordneter','bueroleitung','mitarbeiter','praktikant');
    CREATE TABLE platform_roles(user_id uuid, role text);
    CREATE FUNCTION is_superadmin(who uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM platform_roles WHERE user_id=who AND role='platform_admin') $$;
    CREATE TABLE user_tenant_memberships(
      id uuid DEFAULT gen_random_uuid(), user_id uuid, tenant_id uuid, role app_role, is_active boolean);
    CREATE FUNCTION is_tenant_admin(who uuid, office uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM user_tenant_memberships
                    WHERE user_id=who AND tenant_id=office AND is_active
                      AND role::text IN ('abgeordneter','bueroleitung')) $$;
    CREATE TABLE action_permissions(tenant_id uuid, action_key text, allowed_roles app_role[]);
    CREATE TABLE field_permissions(
      tenant_id uuid, table_name text, column_name text, role app_role,
      can_read boolean NOT NULL DEFAULT true, can_write boolean NOT NULL DEFAULT true, read_mode text);
    CREATE TABLE tenant_feature_flags(tenant_id uuid, feature_key text, enabled boolean NOT NULL DEFAULT true);

    INSERT INTO user_tenant_memberships(user_id,tenant_id,role,is_active) VALUES
      ('${admin}','${a}','bueroleitung',true),
      ('${staff}','${a}','mitarbeiter',true),
      ('${staff}','${b}','mitarbeiter',false);
    INSERT INTO platform_roles VALUES('${platform}','platform_admin');

    INSERT INTO action_permissions(tenant_id,action_key,allowed_roles) VALUES
      ('${a}','contact.delete',ARRAY['abgeordneter','bueroleitung']::app_role[]),
      ('${a}','letter.send',NULL);

    INSERT INTO field_permissions(tenant_id,table_name,column_name,role,can_read,can_write,read_mode) VALUES
      ('${a}','employees','salary','mitarbeiter',false,false,'mask'),
      ('${a}','letters','draft_content','mitarbeiter',true,false,'mask');

    INSERT INTO tenant_feature_flags(tenant_id,feature_key,enabled) VALUES
      ('${a}','module.knowledge',false);
  `);

  await db.exec(await migration('20261124210000_permission_explanation.sql'));
  await db.exec(await migration('20261124220000_unify_permission_decisions.sql'));

  // 1. Aktionen: Auskunft und Durchsetzung stimmen in jedem Fall überein.
  for (const [label, userId, action, expected] of [
    ['Rollenregel verweigert', staff, 'contact.delete', false],
    ['Standard erlaubt', staff, 'letter.send', true],
    ['Rollenregel erlaubt', admin, 'contact.delete', true],
    ['Nicht-Mitglied', outsider, 'letter.send', false],
    ['Plattform-Administrator', platform, 'contact.delete', true],
  ]) {
    const enforced = await actionEnforced(userId, a, action);
    const explained = await actionExplained(userId, a, action);
    assert.equal(enforced, expected, `${label}: Durchsetzung`);
    assert.equal(explained.allowed, expected, `${label}: Auskunft`);
    assert.equal(explained.allowed, enforced, `${label}: Auskunft und Durchsetzung weichen ab`);
  }

  const deniedRule = await actionExplained(staff, a, 'contact.delete');
  assert.equal(deniedRule.source, 'rule');
  assert.match(deniedRule.reason, /nicht freigegeben/);
  assert.deepEqual(deniedRule.allowed_roles, ['abgeordneter', 'bueroleitung']);

  const noMembership = await actionExplained(outsider, a, 'letter.send');
  assert.equal(noMembership.source, 'membership');
  assert.match(noMembership.reason, /Keine aktive Mitgliedschaft/);

  // Simulation nutzt denselben Kern, ohne die Durchsetzung zu verändern.
  const simulated = await actionExplained(staff, a, 'contact.delete', 'abgeordneter');
  assert.equal(simulated.allowed, true);
  assert.equal(simulated.role, 'abgeordneter');
  assert.equal(await actionEnforced(staff, a, 'contact.delete'), false, 'Simulation darf nichts freischalten');

  // 2. Felder: Lesen/Schreiben aus Auskunft und Durchsetzung gleich.
  const salaryEnforced = await fieldEnforced(staff, 'employees', 'salary');
  const salaryExplained = await fieldExplained(staff, 'employees', 'salary');
  assert.equal(salaryEnforced.r, false);
  assert.equal(salaryEnforced.w, false);
  assert.equal(salaryExplained.can_read, salaryEnforced.r);
  assert.equal(salaryExplained.can_write, salaryEnforced.w);
  assert.equal(salaryExplained.source, 'field_rule');

  const draftEnforced = await fieldEnforced(staff, 'letters', 'draft_content');
  const draftExplained = await fieldExplained(staff, 'letters', 'draft_content');
  assert.equal(draftEnforced.r, true);
  assert.equal(draftEnforced.w, false);
  assert.equal(draftExplained.can_read, draftEnforced.r);
  assert.equal(draftExplained.can_write, draftEnforced.w);

  const adminSalary = await fieldExplained(admin, 'employees', 'salary');
  assert.equal(adminSalary.source, 'default');
  assert.equal(adminSalary.can_read, true);

  // 3. Feature-Flags: gleicher Wert, büroweit.
  assert.equal(await featureEnforced(a, 'module.knowledge'), false);
  assert.equal((await featureExplained(staff, a, 'module.knowledge')).enabled, false);
  assert.equal(await featureEnforced(a, 'module.unknown'), true);
  assert.equal((await featureExplained(staff, a, 'module.unknown')).enabled, true);
  assert.equal(await featureEnforced(b, 'module.knowledge'), true, 'Flag gilt nur im eigenen Büro');

  // 4. Verweigerung für Nicht-Admin: kein Zugriff auf fremde Rechteauskunft.
  await actor(staff);
  for (const [label, sql, args] of [
    ['Action', 'SELECT public.explain_action_permission($1,$2,$3)', [staff, a, 'contact.delete']],
    ['Feld', 'SELECT public.explain_field_permission($1,$2,$3,$4)', [staff, a, 'employees', 'salary']],
    ['Feature', 'SELECT public.explain_feature_flag($1,$2,$3)', [staff, a, 'module.knowledge']],
    ['Sammelabfrage', 'SELECT public.explain_permissions($1,$2,$3)', [staff, a, ['contact.delete']]],
  ]) {
    await assert.rejects(db.query(sql, args), (e) => e.code === '42501', `Nicht-Admin darf ${label} nicht erklären`);
  }
  // Auch die reinen Kerne sind für Client-Rollen gesperrt.
  await assert.rejects(db.query('SELECT public.permission_action_decision($1,$2,$3)', [staff, a, 'contact.delete']),
    (e) => e.code === '42501', 'Entscheidungskern darf nicht direkt aufrufbar sein');
  // Und die boolesche Hülle gibt fremde Personen nicht frei.
  assert.equal((await q("SELECT public.is_tenant_action_allowed($1,$2,'letter.send') AS v", [admin, a]))[0].v, false,
    'Authentifizierter darf Rechte Dritter nicht abfragen');
  // Nicht-Admin im fremden Büro ist ebenfalls kein Administrator.
  await actor(admin);
  await assert.rejects(db.query('SELECT public.explain_action_permission($1,$2,$3)', [staff, b, 'letter.send']),
    (e) => e.code === '42501', 'Büro-Administrator gilt nicht im fremden Büro');

  // 5. Nicht-Mitglied: Auskunft und Durchsetzung verweigern, Sammelabfrage bleibt leer.
  const batch = (await q('SELECT public.explain_permissions($1,$2,$3,$4,$5) AS e',
    [outsider, a, ['contact.delete'], ['module.knowledge'], '[]']))[0].e;
  assert.equal(batch.member, false);
  assert.deepEqual(batch.actions, []);
  assert.deepEqual(batch.features, []);
  assert.deepEqual(batch.fields, []);
  assert.equal((await fieldEnforced(outsider, 'letters', 'draft_content')).r, false);

  await owner();
  console.log('Permission explanation passed: shared decision cores, non-admin and non-member refusal, rule/default/field/feature parity.');
} finally {
  await db.close();
}
