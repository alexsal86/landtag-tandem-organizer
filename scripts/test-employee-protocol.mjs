// Isolated PostgreSQL check for the positive employee-protocol workflow.
// The real RPCs run in selftest_employee_protocol and are rolled back there, because a
// released or audited meeting is deliberately undeletable. No live database is used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tests/database/node_modules/@electric-sql/pglite/dist/index.js';

const db = new PGlite();
const office = '11111111-1111-4111-8111-111111111111';
const otherOffice = '22222222-2222-4222-8222-222222222222';
const lead = '33333333-3333-4333-8333-333333333333';
const staff = '44444444-4444-4444-8444-444444444444';
const stranger = '55555555-5555-4555-8555-555555555555';
const draft = '66666666-6666-4666-8666-666666666666';
const audited = '77777777-7777-4777-8777-777777777777';
const finished = '88888888-8888-4888-8888-888888888888';
const closed = '99999999-9999-4999-8999-999999999999';

const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const apply = async name => {
  try {
    await db.exec(await sql(name));
  } catch (error) {
    throw new Error(`${name}: ${error.message}`);
  }
};
const q = async (text, values = []) => (await db.query(text, values)).rows;
const actor = async id => {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('test.actor',$1,false)", [id]);
  await db.exec('SET ROLE authenticated');
};

try {
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.actor',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${lead}'),('${staff}'),('${stranger}');

    CREATE TABLE tenants(id uuid PRIMARY KEY);
    INSERT INTO tenants VALUES ('${office}'),('${otherOffice}');
    CREATE TABLE user_tenant_memberships(user_id uuid, tenant_id uuid, role text, is_active boolean);
    INSERT INTO user_tenant_memberships VALUES
      ('${lead}','${office}','bueroleitung',true),
      ('${staff}','${office}','mitarbeiter',true),
      ('${stranger}','${otherOffice}','mitarbeiter',true);
    CREATE FUNCTION public.is_tenant_member(p_tenant uuid, p_user uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active)$$;
    CREATE FUNCTION public.is_tenant_admin(p_user uuid, p_tenant uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
      SELECT EXISTS(SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active AND role IN ('bueroleitung','abgeordneter'))$$;

    CREATE TABLE employee_settings(user_id uuid PRIMARY KEY, last_meeting_date timestamptz);
    INSERT INTO employee_settings(user_id) VALUES ('${lead}'),('${staff}'),('${stranger}');

    CREATE TABLE notification_types(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, name text, label text, description text, is_active boolean, UNIQUE(tenant_id,name));
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, notification_type_id uuid, title text, message text, data jsonb, priority text);
    CREATE FUNCTION public.create_notification(p_user uuid, p_type text, p_title text, p_message text, p_data jsonb, p_priority text)
    RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
    DECLARE v_id uuid; v_type uuid;
    BEGIN
      SELECT id INTO v_type FROM notification_types WHERE tenant_id=(SELECT tenant_id FROM user_tenant_memberships WHERE user_id=p_user ORDER BY tenant_id LIMIT 1) AND name=p_type;
      INSERT INTO notifications(user_id,notification_type_id,title,message,data,priority) VALUES(p_user,v_type,p_title,p_message,p_data,p_priority) RETURNING id INTO v_id;
      RETURN v_id;
    END $$;

    CREATE TABLE employee_meetings(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id uuid NOT NULL,
      conducted_by uuid NOT NULL,
      tenant_id uuid NOT NULL,
      meeting_date timestamptz NOT NULL,
      meeting_type text NOT NULL DEFAULT 'regular',
      status text NOT NULL DEFAULT 'scheduled',
      protocol_data jsonb DEFAULT '{}'::jsonb,
      employee_preparation jsonb DEFAULT '{}'::jsonb,
      supervisor_preparation jsonb DEFAULT '{}'::jsonb,
      shared_during_meeting boolean DEFAULT false,
      completed_at timestamptz,
      cancellation_reason text,
      reschedule_request_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE employee_meeting_action_items(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      meeting_id uuid NOT NULL REFERENCES employee_meetings(id) ON DELETE CASCADE,
      tenant_id uuid NOT NULL,
      description text NOT NULL,
      owner text NOT NULL,
      assigned_to uuid,
      due_date timestamptz,
      status text NOT NULL DEFAULT 'open',
      completed_at timestamptz,
      task_id uuid,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE tasks(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, tenant_id uuid, title text, description text,
      assigned_to text, status text, priority text, category text, due_date timestamptz, ball_owner text,
      ball_assignee_id uuid, next_action text, next_action_due date, source_type text, source_id text,
      timeline jsonb, updated_at timestamptz DEFAULT now());
    CREATE TABLE task_assignees(task_id uuid, user_id uuid, assigned_by uuid);
    GRANT SELECT ON employee_meetings, employee_meeting_action_items TO authenticated;
  `);

  await apply('20261113120000_employee_protocol_acknowledgement.sql');
  // The realtime publication of the hosted database is not part of this isolated instance.
  const stafette = await sql('20261113121000_employee_action_stafette.sql');
  await db.exec(stafette.slice(0, stafette.indexOf('DO $$ BEGIN')));
  await apply('20261126080000_selftest_employee_protocol.sql');

  const meeting = async (id, status, employee = staff, conducted = staff) => {
    await db.query(
      `INSERT INTO employee_meetings(id,employee_id,conducted_by,tenant_id,meeting_date,status,completed_at,protocol_data)
       VALUES($1,$2,$3,$4,now(),$5,$6,'{"goals":"Selbsttest"}')`,
      [id, employee, conducted, office, status, status === 'completed' ? new Date().toISOString() : null],
    );
  };
  await meeting(draft, 'scheduled');
  await meeting(audited, 'completed');
  await meeting(finished, 'completed');
  await meeting(closed, 'cancelled');
  await db.query(`INSERT INTO employee_meeting_action_items(meeting_id,tenant_id,description,owner) VALUES($1,$2,'Unterlagen sammeln','employee')`, [draft, office]);
  await db.query(`INSERT INTO employee_meeting_audit(meeting_id,actor,action) VALUES($1,$2,'acknowledged')`, [audited, staff]);

  await actor(staff);
  const checks = (await q('SELECT selftest_employee_protocol($1) AS result', [draft]))[0].result;
  const expected = ['completed_by_workflow','released','signed_hash','release_audit','frozen_after_release','stale_hash_rejected',
    'acknowledged','acknowledge_audit','action_task_created','reopened','reopen_audit','objection_kept_open','objection_audit',
    'objection_blocks_acknowledgement'];
  assert.deepEqual(Object.keys(checks).sort(), [...expected].sort(), 'All positive-path checks are reported');
  for (const [name, value] of Object.entries(checks)) assert.equal(value, true, `Check failed: ${name}`);

  const residue = (await q('SELECT status, version, protocol_hash, acknowledged_at, completed_at, acknowledgement_comment FROM employee_meetings WHERE id=$1', [draft]))[0];
  assert.deepEqual(residue, { status: 'scheduled', version: 0, protocol_hash: null, acknowledged_at: null, completed_at: null, acknowledgement_comment: null },
    'The positive path leaves no trace on the meeting');
  assert.equal((await q('SELECT * FROM employee_meeting_audit WHERE meeting_id=$1', [draft])).length, 0, 'No audit rows survive the isolated run');
  const item = (await q('SELECT status, task_id FROM employee_meeting_action_items WHERE meeting_id=$1', [draft]))[0];
  assert.deepEqual(item, { status: 'open', task_id: null });
  await db.exec('RESET ROLE');
  assert.equal((await q('SELECT * FROM tasks')).length, 0, 'Tasks created by the acknowledgement are rolled back');
  assert.equal((await q('SELECT * FROM task_assignees')).length, 0);
  assert.equal((await q('SELECT * FROM notifications')).length, 0, 'Notifications of release, acknowledgement and reopening are rolled back');
  assert.equal((await q('SELECT * FROM employee_meeting_private_notes')).length, 0);
  assert.equal((await q('SELECT last_meeting_date FROM employee_settings WHERE user_id=$1', [staff]))[0].last_meeting_date, null,
    'Completing inside the check does not touch employee settings');
  await actor(staff);

  await assert.rejects(q('SELECT selftest_employee_protocol($1)', [audited]), error => error.code === '55000',
    'A meeting with audit rows is refused');
  await assert.rejects(q('SELECT selftest_employee_protocol($1)', [closed]), error => error.code === '22023',
    'A meeting without draft status is refused');
  await actor(lead);
  await assert.rejects(q('SELECT selftest_employee_protocol($1)', [draft]), error => error.code === '42501',
    'Only the affected person can run the acknowledgement path');
  await actor(stranger);
  await assert.rejects(q('SELECT selftest_employee_protocol($1)', [draft]), error => error.code === '42501',
    'Another office cannot reach the meeting');
  await actor(staff);
  await assert.rejects(q('DELETE FROM employee_meeting_audit'), error => error.code === '42501',
    'The audit table stays read-only for clients');

  await db.exec('RESET ROLE');
  await db.query('DELETE FROM employee_meeting_audit WHERE meeting_id=$1', [audited]);
  await db.query('DELETE FROM employee_meetings WHERE id = ANY($1::uuid[])', [[draft, audited, finished, closed]]);
  assert.equal((await q('SELECT * FROM employee_meetings')).length, 0);
  console.log('Employee protocol selftest passed: completion, release, acknowledgement, task hand-off, reopening and objection run through the real RPCs; every write is rolled back and all guards stay active.');
} finally {
  await db.close();
}
