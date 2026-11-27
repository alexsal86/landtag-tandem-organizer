// Isolated PostgreSQL check for the employee protocol: the release guard (42501 for direct
// status writes, 22023 before completion, 40001 for a stale autosave, also after repairing a
// drifted instance) and the positive workflow. The real RPCs run in selftest_employee_protocol
// and are rolled back there, because a released or audited meeting is deliberately undeletable.
// No live database is used.
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
    -- Lesen genügt: geschrieben wird ausschließlich über die Workflow-RPCs.
    GRANT SELECT ON employee_meetings, employee_meeting_action_items, tasks, task_assignees, notifications, employee_settings TO authenticated;
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

  // --- Zweipersonen-Fall: Die Gesprächsleitung schließt ab und gibt frei, die betroffene
  // Person bestätigt bzw. legt Einspruch ein. Jede Rolle handelt in eigener Session
  // (eigener Actor, eigener Rollenwechsel) wie in zwei getrennten Verbindungen; alles
  // läuft in einer Untertransaktion, die am Ende zurückgerollt wird, weil auditierte
  // Gespräche absichtlich unlöschbar sind.
  await db.exec('RESET ROLE');
  const two = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const row2 = async () => (await q(
    'SELECT status, version, protocol_hash, acknowledged_at, acknowledged_by, acknowledgement_comment, acknowledgement_requested_at, completed_at FROM employee_meetings WHERE id=$1',
    [two]))[0];
  await db.query(
    `INSERT INTO employee_meetings(id,employee_id,conducted_by,tenant_id,meeting_date,status,protocol_data)
     VALUES($1,$2,$3,$4,now(),'scheduled','{"goals":"Zweipersonen-Selbsttest"}')`,
    [two, staff, lead, office],
  );
  await db.query(`INSERT INTO employee_meeting_action_items(meeting_id,tenant_id,description,owner)
    VALUES($1,$2,'Protokoll ablegen','employee')`, [two, office]);

  const auditCount = async (action, who, reason = null) => (await q(
    'SELECT count(*)::int AS n FROM employee_meeting_audit WHERE meeting_id=$1 AND action=$2 AND actor=$3 AND ($4::text IS NULL OR reason=$4)',
    [two, action, who, reason]))[0].n;
  // Erwartete Abweisungen laufen in eigener Untertransaktion: ein SQL-Fehler bricht sonst
  // die umgebende Transaktion ab und alle folgenden Schritte würden nur noch 25P02 melden.
  const expectRejection = async (label, run, predicate) => {
    await db.exec('SAVEPOINT expected_failure');
    let failure = null;
    try {
      await run();
    } catch (error) {
      failure = error;
    }
    await db.exec('ROLLBACK TO SAVEPOINT expected_failure');
    await db.exec('RELEASE SAVEPOINT expected_failure');
    assert.ok(failure, `${label}: erwartete Abweisung blieb aus`);
    assert.ok(predicate(failure), `${label}: unerwarteter Fehler ${failure.code} ${failure.message}`);
  };

  await db.exec('BEGIN');
  try {
    // Session Gesprächsleitung: abschließen und freigeben.
    await actor(lead);
    assert.equal((await q('SELECT auth.uid() AS id'))[0].id, lead, 'Session der Gesprächsleitung');
    let r = await row2();
    await q('SELECT save_employee_meeting($1,$2,$3::jsonb)', [two, r.version, '{"status":"in_progress"}']);
    r = await row2();
    assert.equal(r.status, 'in_progress', 'Die Leitung startet das Gespräch');
    await q('SELECT save_employee_meeting($1,$2,$3::jsonb)', [two, r.version, '{"status":"completed"}']);
    r = await row2();
    assert.equal(r.status, 'completed');
    assert.ok(r.completed_at, 'Die Leitung schließt das Gespräch ab');
    await expectRejection('Die Leitung kann nicht selbst bestätigen',
      () => q('SELECT acknowledge_meeting_protocol($1)', [two]), error => error.code === '42501');
    await q('SELECT request_protocol_acknowledgement($1)', [two]);
    r = await row2();
    assert.equal(r.status, 'pending_acknowledgement', 'Die Freigabe wartet auf die betroffene Person');
    const firstHash = r.protocol_hash;
    assert.match(firstHash, /^[0-9a-f]{64}$/, 'Die Freigabe signiert das Protokoll');
    assert.equal(await auditCount('requested', lead), 1, 'Die Freigabe wird der Leitung zugeordnet');

    // Session betroffene Person: bestätigen.
    await actor(staff);
    assert.equal((await q('SELECT auth.uid() AS id'))[0].id, staff, 'Session der betroffenen Person');
    await expectRejection('Die betroffene Person kann nicht freigeben',
      () => q('SELECT request_protocol_acknowledgement($1)', [two]), error => error.code === '42501');
    await expectRejection('Die betroffene Person kann nicht wieder öffnen',
      () => q('SELECT reopen_meeting_protocol($1,$2)', [two, 'Selbsttest']), error => error.code === '42501');
    const seenHash = (await q('SELECT protocol_hash FROM employee_meetings WHERE id=$1', [two]))[0].protocol_hash;
    assert.equal(seenHash, firstHash, 'Beide Rollen sehen denselben signierten Hash');
    await q('SELECT acknowledge_meeting_protocol($1,NULL,$2)', [two, seenHash]);
    r = await row2();
    assert.equal(r.status, 'acknowledged', 'Die betroffene Person bestätigt');
    assert.equal(r.acknowledged_by, staff);
    assert.equal(r.acknowledgement_comment, null);
    assert.equal(await auditCount('acknowledged', staff), 1, 'Die Bestätigung wird der betroffenen Person zugeordnet');
    const actionTask = (await q('SELECT task_id FROM employee_meeting_action_items WHERE meeting_id=$1', [two]))[0].task_id;
    assert.ok(actionTask, 'Mit der Bestätigung entsteht die Aufgabe');
    assert.equal((await q('SELECT count(*)::int AS n FROM task_assignees WHERE task_id=$1 AND user_id=$2', [actionTask, staff]))[0].n, 1,
      'Die Aufgabe liegt bei der betroffenen Person, nicht bei der Leitung');
    assert.equal((await q("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Protokoll bestätigt'", [lead]))[0].n, 1,
      'Die Leitung wird über die Bestätigung benachrichtigt');

    // Session Gesprächsleitung: wieder öffnen, ergänzen, erneut abschließen und freigeben.
    await actor(lead);
    await q('SELECT reopen_meeting_protocol($1,$2)', [two, 'Selbsttest: Punkt 2 ergänzen']);
    r = await row2();
    assert.equal(r.status, 'in_progress', 'Die Leitung öffnet wieder');
    assert.equal(r.protocol_hash, null, 'Die Wiedereröffnung hebt die Signatur auf');
    assert.equal(await auditCount('reopened', lead, 'Selbsttest: Punkt 2 ergänzen'), 1);
    await q('SELECT save_employee_meeting($1,$2,$3::jsonb)', [two, r.version,
      '{"protocol_data":{"goals":"Zweipersonen-Selbsttest","agreements":"Punkt 2 ergänzt"}}']);
    r = await row2();
    await q('SELECT save_employee_meeting($1,$2,$3::jsonb)', [two, r.version, '{"status":"completed"}']);
    await q('SELECT request_protocol_acknowledgement($1)', [two]);
    r = await row2();
    assert.equal(r.status, 'pending_acknowledgement');
    const secondHash = r.protocol_hash;
    assert.notEqual(secondHash, firstHash, 'Der ergänzte Inhalt wird neu signiert');

    // Session betroffene Person: Einspruch.
    await actor(staff);
    await q('SELECT acknowledge_meeting_protocol($1,$2,$3)', [two, 'Punkt 2 fehlt noch', secondHash]);
    r = await row2();
    assert.equal(r.status, 'pending_acknowledgement', 'Der Einspruch lässt die Freigabe offen');
    assert.equal(r.acknowledgement_comment, 'Punkt 2 fehlt noch');
    assert.equal(r.acknowledged_at, null, 'Ein Einspruch bestätigt nichts');
    assert.equal(await auditCount('objection', staff, 'Punkt 2 fehlt noch'), 1, 'Der Einspruch wird protokolliert');
    await expectRejection('Der offene Einspruch blockiert die Bestätigung',
      () => q('SELECT acknowledge_meeting_protocol($1,NULL,$2)', [two, secondHash]), error => /Einspruch/.test(error.message));
    assert.equal((await q("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Einspruch zum Protokoll'", [lead]))[0].n, 1,
      'Die Leitung wird über den Einspruch benachrichtigt');
  } finally {
    await db.exec('ROLLBACK');
    await db.exec('RESET ROLE');
  }

  assert.deepEqual(await row2(), {
    status: 'scheduled', version: 0, protocol_hash: null, acknowledged_at: null, acknowledged_by: null,
    acknowledgement_comment: null, acknowledgement_requested_at: null, completed_at: null,
  }, 'Der Zweipersonen-Fall hinterlässt keinen Zustand am Gespräch');
  assert.equal((await q('SELECT * FROM employee_meeting_audit WHERE meeting_id=$1', [two])).length, 0,
    'Keine Auditzeilen aus Abschluss, Freigabe, Bestätigung und Einspruch');
  assert.deepEqual((await q('SELECT status, task_id FROM employee_meeting_action_items WHERE meeting_id=$1', [two]))[0],
    { status: 'open', task_id: null }, 'Die Maßnahme bleibt ohne Aufgabe zurück');
  assert.equal((await q('SELECT * FROM tasks')).length, 0, 'Die Aufgabe aus der Bestätigung ist zurückgerollt');
  assert.equal((await q('SELECT * FROM task_assignees')).length, 0);
  assert.equal((await q('SELECT * FROM notifications')).length, 0, 'Alle Benachrichtigungen sind zurückgerollt');
  assert.equal((await q('SELECT last_meeting_date FROM employee_settings WHERE user_id=$1', [staff]))[0].last_meeting_date, null,
    'Auch der Abschluss im Zweipersonen-Fall lässt die Mitarbeitereinstellungen unberührt');

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

  // --- release-guard: 42501 für direkte Statuswechsel, 22023 für Freigabe,
  // Bestätigung und Wiedereröffnung vor Abschluss, 40001 für einen veralteten
  // Autosave. Der Abschnitt bildet zuerst eine Instanz nach, auf der die Regel
  // fehlt (alter reopen-Code, Trigger verloren, UPDATE wieder erteilt), und
  // prüft nach der Reparaturmigration alle fünf Codes.
  const guard = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.exec('RESET ROLE');
  await db.query(
    `INSERT INTO employee_meetings(id,employee_id,conducted_by,tenant_id,meeting_date,status,protocol_data)
     VALUES($1,$2,$2,$3,now()+interval '3 days','scheduled','{"goals":"Sperrprüfung"}')`,
    [guard, staff, office],
  );
  await db.exec('GRANT UPDATE ON public.employee_meetings TO authenticated');
  await db.exec('DROP TRIGGER guard_employee_protocol ON public.employee_meetings');
  await actor(staff);

  const codeOf = async run => {
    await db.exec('SAVEPOINT guard_case');
    let failure = null;
    try {
      await run();
    } catch (error) {
      failure = error;
    }
    await db.exec('ROLLBACK TO SAVEPOINT guard_case');
    await db.exec('RELEASE SAVEPOINT guard_case');
    return failure?.code ?? null;
  };
  const directWrite = () => q("UPDATE employee_meetings SET status='pending_acknowledgement' WHERE id=$1", [guard]);

  await db.exec('BEGIN');
  try {
    assert.equal(await codeOf(directWrite), null,
      'Ohne Trigger und mit UPDATE-Recht geht der direkte Statuswechsel durch – die Ausgangslage der Instanz');
    assert.equal(await codeOf(() => q('SELECT reopen_meeting_protocol($1,$2)', [guard, 'Selbsttest'])), 'P0001',
      'Die alte Wiedereröffnung meldet den Standardcode statt 22023');

    await db.exec('RESET ROLE');
    await apply('20261127160000_release_guard_rule_repair.sql');
    // Ein zweiter Lauf darf nichts ändern (DROP/CREATE, REVOKE und Triggerprüfung).
    await apply('20261127160000_release_guard_rule_repair.sql');
    await actor(staff);

    // --- Versionssperre: eine ältere Fassung von save_employee_meeting auf der
    // Instanz prüft p_version nicht. Genau dieser Drift lässt den veralteten
    // Autosave durch und lässt den Selbsttest staleVersionRejected melden.
    await db.exec('RESET ROLE');
    await db.exec(`CREATE OR REPLACE FUNCTION public.save_employee_meeting(p_meeting_id uuid,p_version integer,p_patch jsonb,p_private_notes text DEFAULT NULL)
      RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
      DECLARE m public.employee_meetings;
      BEGIN
        m:=public.require_employee_meeting_access(p_meeting_id);
        IF m.status NOT IN ('scheduled','in_progress') THEN RAISE EXCEPTION 'Protokoll ist gesperrt.' USING ERRCODE='55000'; END IF;
        UPDATE public.employee_meetings SET protocol_data=CASE WHEN p_patch ? 'protocol_data' THEN p_patch->'protocol_data' ELSE protocol_data END WHERE id=m.id;
        RETURN m.version+1;
      END $$;`);
    await actor(staff);
    assert.equal(await codeOf(() => q('SELECT save_employee_meeting($1,$2,$3::jsonb)',
      [guard, 5, '{"protocol_data":{"goals":"veraltet"}}'])), null,
      'Die alte Fassung nimmt jeden Stand an – der Drift der Instanz');

    await db.exec('RESET ROLE');
    await apply('20261128040000_employee_meeting_version_guard_repair.sql');
    // Auch der Nachtrag muss wiederholbar sein.
    await apply('20261128040000_employee_meeting_version_guard_repair.sql');
    await actor(staff);
    assert.equal(await codeOf(() => q('SELECT save_employee_meeting($1,$2,$3::jsonb)',
      [guard, 5, '{"protocol_data":{"goals":"veraltet"}}'])), '40001',
      'Die Reparatur weist den veralteten Stand ab');
    assert.equal(await codeOf(() => q('SELECT save_employee_meeting($1,$2,$3::jsonb)',
      [guard, null, '{"protocol_data":{"goals":"ohne Stand"}}'])), '40001',
      'Ein fehlender Versionsstand ist kein aktueller Stand');
    await db.exec('SAVEPOINT current_save');
    const returned = (await q('SELECT save_employee_meeting($1,$2,$3::jsonb) AS version',
      [guard, 0, '{"protocol_data":{"goals":"aktuell"}}']))[0].version;
    assert.equal(returned, (await q('SELECT version FROM employee_meetings WHERE id=$1', [guard]))[0].version,
      'Die RPC gibt den tatsächlich gespeicherten Stand zurück');
    await db.exec('ROLLBACK TO SAVEPOINT current_save');
    await db.exec('RELEASE SAVEPOINT current_save');

    // --- Erzwingende Fassung: der Selbsttest blieb trotz mehrerer Einspielversuche
    // von 20261128040000 unverändert. Die Nachfolgemigration muss deshalb alle
    // Varianten entfernen, NULL-Stände nachziehen und sich selbst nachweisen.
    await db.exec('RESET ROLE');
    await db.exec('ALTER TABLE public.employee_meetings ALTER COLUMN version DROP NOT NULL');
    // Ohne Trigger bleibt ein gesetzter NULL-Stand stehen; mit Trigger würde er
    // sofort auf OLD.version+1 überschrieben. Der fehlende Trigger ist genau der
    // Drift, aus dem ein Gespräch ohne Versionsstand stammt.
    await db.exec('DROP TRIGGER guard_employee_protocol ON public.employee_meetings');
    await db.query('UPDATE public.employee_meetings SET version=NULL WHERE id=$1', [guard]);
    assert.equal((await q('SELECT version FROM employee_meetings WHERE id=$1', [guard]))[0].version, null,
      'Ausgangslage: ein Gespräch ohne Versionsstand (NULL)');

    await apply('20261128050000_employee_meeting_version_guard_force.sql');
    // Auch die erzwingende Fassung muss wiederholbar sein.
    await apply('20261128050000_employee_meeting_version_guard_force.sql');

    const varianten = await q(`SELECT count(*)::int AS n FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname='save_employee_meeting'`);
    assert.equal(varianten[0].n, 1, 'Die erzwingende Fassung hinterlässt genau eine Variante');
    const marke = await q(`SELECT obj_description(oid,'pg_proc') AS marke FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname='save_employee_meeting'`);
    assert.equal(marke[0].marke, 'version-guard 20261128050000',
      'Die installierte Fassung trägt die Marke der erzwingenden Migration');
    const nachlauf = await q(`SELECT version, (SELECT is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='employee_meetings' AND column_name='version') AS nullable
      FROM employee_meetings WHERE id=$1`, [guard]);
    assert.equal(nachlauf[0].version, 0, 'Ein fehlender Versionsstand wird auf 0 nachgezogen');
    assert.equal(nachlauf[0].nullable, 'NO', 'Der Versionszähler ist danach verpflichtend');
    assert.equal((await q(`SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgrelid='public.employee_meetings'::regclass AND tgname='guard_employee_protocol' AND tgenabled<>'D'`))[0].n, 1,
      'Der Trigger ist genau einmal aktiv');

    // Der Nachweis, den das Ergebnisfenster des SQL-Editors zeigt, muss selbst stimmen.
    const datei = await sql('20261128050000_employee_meeting_version_guard_force.sql');
    const nachweis = datei.slice(datei.indexOf('-- 8. Nachweis'));
    const zeile = (await q(nachweis.slice(nachweis.indexOf('SELECT'))))[0];
    assert.deepEqual(
      { varianten: zeile.varianten, prueft_stand: zeile.prueft_stand, trigger_aktiv: zeile.trigger_aktiv,
        ohne_stand: zeile.ohne_stand, marke: zeile.marke },
      { varianten: 1, prueft_stand: true, trigger_aktiv: 1, ohne_stand: 0, marke: 'version-guard 20261128050000' },
      'Der Nachweis der Migration zeigt genau eine aktive, prüfende Fassung',
    );

    await actor(staff);
    assert.equal(await codeOf(() => q('SELECT save_employee_meeting($1,$2,$3::jsonb)',
      [guard, 5, '{"protocol_data":{"goals":"veraltet"}}'])), '40001',
      'Auch nach dem Nachzug weist die RPC den veralteten Stand ab');

    const codes = {
      directWriteDenied: await codeOf(directWrite),
      releaseBeforeCompletion: await codeOf(() => q('SELECT request_protocol_acknowledgement($1)', [guard])),
      acknowledgeBeforeRelease: await codeOf(() => q('SELECT acknowledge_meeting_protocol($1)', [guard])),
      reopenBeforeCompletion: await codeOf(() => q('SELECT reopen_meeting_protocol($1,$2)', [guard, 'Selbsttest'])),
      staleVersionRejected: await codeOf(() => q('SELECT save_employee_meeting($1,$2,$3::jsonb)',
        [guard, 5, '{"protocol_data":{"goals":"veraltet"}}'])),
    };
    assert.deepEqual(codes, {
      directWriteDenied: '42501', releaseBeforeCompletion: '22023', acknowledgeBeforeRelease: '22023',
      reopenBeforeCompletion: '22023', staleVersionRejected: '40001',
    }, 'Die Reparatur stellt alle Freigabesperren her');
    assert.equal((await q('SELECT status FROM employee_meetings WHERE id=$1', [guard]))[0].status, 'scheduled',
      'Keine Sperrprüfung verändert den Status');
    assert.equal((await q('SELECT count(*)::int AS n FROM employee_meeting_audit WHERE meeting_id=$1', [guard]))[0].n, 0,
      'Keine Sperrprüfung schreibt eine Auditzeile');

    // Der reparierte Autosave trägt auch den positiven Freigabepfad: der
    // Versionsstand wandert durch alle echten RPCs und alles wird zurückgerollt.
    const positive = (await q('SELECT selftest_employee_protocol($1) AS result', [draft]))[0].result;
    assert.ok(Object.values(positive).every(value => value === true),
      `Der Freigabepfad läuft mit dem reparierten Autosave: ${JSON.stringify(positive)}`);
  } finally {
    await db.exec('ROLLBACK');
    await db.exec('RESET ROLE');
  }

  await db.query('DELETE FROM employee_meetings WHERE id=$1', [guard]);

  await db.exec('RESET ROLE');
  await db.query('DELETE FROM employee_meeting_audit WHERE meeting_id=$1', [audited]);
  await db.query('DELETE FROM employee_meetings WHERE id = ANY($1::uuid[])', [[draft, audited, finished, closed, two]]);
  assert.equal((await q('SELECT * FROM employee_meetings')).length, 0);
  console.log('Employee protocol selftest passed: completion, release, acknowledgement, task hand-off, reopening and objection run through the real RPCs with a separate session per role (leader and affected person); the release guard answers 42501/22023/40001 even after the repair of a drifted instance (including an autosave without a version check and a missing version), the repaired autosave carries the positive path, and every write is rolled back.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
