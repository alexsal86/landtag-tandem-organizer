// Isolated PostgreSQL: actual RPC and consistency triggers, no live data.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const tenant = '33333333-3333-4333-8333-333333333333';
const foreign = '44444444-4444-4444-8444-444444444444';
const actor = id => db.query("SELECT set_config('test.actor', $1, false)", [id]);
const replace = role => db.query('SELECT replace_user_role($1,$2,$3)', [tenant, target, role]);
const readRoles = async () => {
  await db.exec('RESET ROLE');
  const { rows } = await db.query('SELECT role::text FROM user_roles WHERE user_id=$1', [target]);
  await db.exec('SET ROLE authenticated');
  return rows.map(row => row.role);
};
try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${admin}'),('${target}');
    CREATE TYPE app_role AS ENUM ('abgeordneter','bueroleitung','mitarbeiter','praktikant');
    CREATE TABLE user_roles(user_id uuid, role app_role, assigned_by uuid, UNIQUE(user_id,role));
    CREATE TABLE user_tenant_memberships(user_id uuid,tenant_id uuid,role text,is_active boolean);
    INSERT INTO user_tenant_memberships VALUES ('${target}','${tenant}','mitarbeiter',true);
    INSERT INTO user_roles VALUES ('${target}','mitarbeiter','${admin}');
    CREATE FUNCTION is_superadmin(who uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT who='${admin}'::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
  `);
  const guards = await readFile(new URL('../supabase/migrations/20260305103000_tenant_role_scoping_and_role_consistency_guard.sql', import.meta.url), 'utf8');
  await db.exec(guards.slice(guards.indexOf('CREATE OR REPLACE FUNCTION public.enforce_role_consistency_between_global_and_tenant()')));
  await db.exec(await readFile(new URL('../supabase/migrations/20261109120000_atomic_admin_role_replacement.sql', import.meta.url), 'utf8'));
  await db.exec('SET ROLE authenticated');
  await actor(target);
  await assert.rejects(replace('mitarbeiter'), error => error.code === '42501');
  await actor(admin);
  await assert.rejects(db.query('SELECT replace_user_role($1,$2,$3)', [foreign,target,'mitarbeiter']), error => error.code === '42501');
  await assert.rejects(replace('platform_admin'), error => error.code === '22023');
  await assert.rejects(replace('bueroleitung'), /Inkonsistente Rollen/);
  assert.deepEqual(await readRoles(), ['mitarbeiter'], 'Rejected insert must restore the deleted role');
  await replace('mitarbeiter');
  await replace('mitarbeiter');
  assert.deepEqual(await readRoles(), ['mitarbeiter'], 'Repeated replacement must not create duplicates');
  await replace(null);
  assert.deepEqual(await readRoles(), [], 'Explicit removal is supported');
  await replace('mitarbeiter');
  assert.deepEqual(await readRoles(), ['mitarbeiter']);
  await db.exec('SET ROLE anon');
  await assert.rejects(replace('mitarbeiter'), error => error.code === '42501');
  console.log('Admin role replacement passed: platform authorization, tenant membership, invalid role, rollback on conflicting membership, retry, removal and anonymous denial.');
} finally {
  await db.close();
}
