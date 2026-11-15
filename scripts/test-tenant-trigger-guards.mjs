import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const parent='33333333-3333-4333-8333-333333333333', foreign='44444444-4444-4444-8444-444444444444';
const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url),'utf8');
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE parents(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE children(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,parent_id uuid REFERENCES parents(id));
 CREATE TABLE profiles(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE identity_links(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,profile_id uuid REFERENCES profiles(id));
 INSERT INTO parents VALUES('${parent}','${a}'),('${foreign}','${b}');
 INSERT INTO profiles VALUES('${parent}','${b}');`);
 const sql=await migration('20261115075438_abfdb62e-9b3d-4255-8604-edbcc40eb04f.sql');
 await db.exec(sql.slice(0,sql.indexOf('CREATE OR REPLACE FUNCTION public.return_task_ball_after_vote')));
 await db.exec(await migration('20261115075450_b7bb29de-25ed-4b2c-8bc4-faf596e650c6.sql'));
 await db.exec(await migration('20261115075759_2fd634d6-3737-497e-8aad-0b9362d862dd.sql'));
 await db.exec('GRANT ALL ON parents,children,identity_links TO service_role; SET ROLE service_role;');
 await db.query('INSERT INTO children VALUES($1,$2,$3)',[parent,a,parent]);
 await assert.rejects(db.query('INSERT INTO children VALUES($1,$2,$3)',[foreign,a,foreign]), e=>e.code==='42501');
 await assert.rejects(db.query('UPDATE children SET tenant_id=$1 WHERE id=$2',[b,parent]), e=>e.code==='42501');
 await assert.rejects(db.query('UPDATE children SET parent_id=$1 WHERE id=$2',[foreign,parent]), e=>e.code==='42501');
 await db.query('INSERT INTO identity_links VALUES($1,$2,$3)',[parent,a,parent]);
 assert.equal((await db.query('SELECT tenant_id FROM children WHERE id=$1',[parent])).rows[0].tenant_id,a);
 console.log('PASS: same-office writes, foreign insert/update rejection, immutable tenant, profile identity exemption under service role');
} finally { await db.close(); }