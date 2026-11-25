// Isolated PostgreSQL (PGlite) regression test for the INSERT ... RETURNING trap in SELECT policies.
// Never connects to the live database.
// npm ci --prefix tests/database && node scripts/test-insert-returning-rls.mjs
//
// Muster: eine SELECT-Policy prüft den Zugriff über eine STABLE-Funktion, die die eigene Tabelle
// anhand der Zeilen-id nachliest. Im Statement-Snapshot eines INSERT ist die neue Zeile noch nicht
// sichtbar, die Funktion liefert false und `insert(...).select()` scheitert mit 42501, obwohl der
// Insert erlaubt ist. Der Test deckt die beiden betroffenen Tabellen (case_items,
// knowledge_documents) sowie die zeilenlokalen Kontrolltabellen (case_files, task_decisions,
// letters) ab.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(
  new URL('../tests/database/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href
);
const db = new PGlite();

const office = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const staff = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tenant = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const foreignTenant = '11111111-1111-4111-8111-111111111111';

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const as = async (who) => {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.actor', $1, false)", [who]);
  await db.exec('SET ROLE authenticated');
};

// Schema und Policies wie ausgeliefert (20250828190723 / 20250829231458 / 20260130230341 /
// 20260208193300 / 20260305133000 / 20260309130000 / 20261109143000 / 20261110180300).
await db.exec(`
  CREATE ROLE authenticated;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('role', true), 'authenticated') $$;

  CREATE TABLE public.tenants (id uuid PRIMARY KEY);
  CREATE TABLE public.user_tenant_memberships (
    user_id uuid, tenant_id uuid, role text, is_active boolean NOT NULL DEFAULT true, PRIMARY KEY (user_id, tenant_id)
  );
  CREATE TABLE public.field_permissions (
    tenant_id uuid, table_name text, role text, column_name text,
    can_read boolean NOT NULL DEFAULT true, read_mode text
  );

  CREATE FUNCTION public.get_user_tenant_ids(_user_id uuid) RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT array_agg(tenant_id) FROM public.user_tenant_memberships WHERE user_id = _user_id AND is_active = true;
  $$;

  CREATE FUNCTION public.is_superadmin(_user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$ SELECT false $$;

  CREATE FUNCTION public.field_row_visible(_tenant uuid, _table text) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
  DECLARE member_role text;
  BEGIN
    IF public.is_superadmin(auth.uid()) OR coalesce(auth.role(), '') = 'service_role' THEN RETURN true; END IF;
    SELECT role INTO member_role FROM public.user_tenant_memberships
      WHERE user_id = auth.uid() AND tenant_id = _tenant AND is_active;
    IF NOT FOUND THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM public.field_permissions
        WHERE tenant_id = _tenant AND table_name = _table AND role = member_role
          AND NOT can_read AND read_mode = 'record') THEN RETURN false; END IF;
    RETURN true;
  END $$;

  -- case_files / case_items -------------------------------------------------
  CREATE TABLE public.case_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL, visibility text
  );
  CREATE TABLE public.case_file_participants (case_file_id uuid, user_id uuid);
  CREATE TABLE public.case_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
    owner_user_id uuid, case_file_id uuid REFERENCES public.case_files(id),
    visible_to_all boolean NOT NULL DEFAULT false, subject text
  );
  CREATE TABLE public.case_item_participants (
    case_item_id uuid REFERENCES public.case_items(id), user_id uuid, role text, PRIMARY KEY (case_item_id, user_id)
  );

  CREATE FUNCTION public.user_can_access_case_item(_user_id uuid, _case_item_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.case_items ci
      WHERE ci.id = _case_item_id
        AND ci.tenant_id = ANY(public.get_user_tenant_ids(_user_id))
        AND (
          ci.visible_to_all = true OR ci.user_id = _user_id OR ci.owner_user_id = _user_id
          OR EXISTS (SELECT 1 FROM public.case_item_participants cip WHERE cip.case_item_id = ci.id AND cip.user_id = _user_id)
          OR EXISTS (SELECT 1 FROM public.case_files cf WHERE cf.id = ci.case_file_id AND (
              cf.user_id = _user_id OR cf.visibility = 'public'
              OR EXISTS (SELECT 1 FROM public.case_file_participants cfp WHERE cfp.case_file_id = cf.id AND cfp.user_id = _user_id)))
        )
    );
  $$;

  -- knowledge_documents -----------------------------------------------------
  CREATE TABLE public.knowledge_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, created_by uuid NOT NULL,
    title text, content text, category text, is_published boolean NOT NULL DEFAULT false,
    is_locked boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.knowledge_document_permissions (document_id uuid, user_id uuid, permission_type text);

  CREATE FUNCTION public.knowledge_qa_can_access(_tenant uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_tenant_memberships m
      WHERE m.tenant_id = _tenant AND m.user_id = auth.uid() AND m.is_active);
  $$;

  CREATE FUNCTION public.can_access_knowledge_document(_document_id uuid, _user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public, pg_temp AS $$
    SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = _document_id AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m
        WHERE m.tenant_id = d.tenant_id AND m.user_id = _user_id AND m.is_active)
      AND (d.created_by = _user_id OR d.is_published OR EXISTS (SELECT 1 FROM public.knowledge_document_permissions p
        WHERE p.document_id = d.id AND p.user_id = _user_id))
    );
  $$;

  -- task_decisions / letters (Kontrolltabellen) -----------------------------
  CREATE TABLE public.tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, user_id uuid);
  CREATE TABLE public.task_decisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, created_by uuid,
    task_id uuid, title text, visible_to_all boolean NOT NULL DEFAULT false
  );
  CREATE TABLE public.task_decision_participants (decision_id uuid, user_id uuid);
  CREATE TABLE public.letters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, created_by uuid, title text, content text
  );
  CREATE TABLE public.letter_collaborators (letter_id uuid, user_id uuid);

  -- Policies ---------------------------------------------------------------
  ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view accessible case files" ON public.case_files FOR SELECT
    USING (
      tenant_id IN (SELECT utm.tenant_id FROM public.user_tenant_memberships utm
        WHERE utm.user_id = auth.uid() AND utm.is_active = true)
      AND (
        visibility = 'public' OR user_id = auth.uid()
        OR id IN (SELECT cfp.case_file_id FROM public.case_file_participants cfp WHERE cfp.user_id = auth.uid())
      )
    );
  CREATE POLICY "Users can create case files in their tenant" ON public.case_files FOR INSERT
    WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())) AND user_id = auth.uid());

  ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view accessible case items" ON public.case_items FOR SELECT
    USING (public.user_can_access_case_item(auth.uid(), id));
  CREATE POLICY "Users can create case items in tenant" ON public.case_items FOR INSERT
    WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())) AND user_id = auth.uid());

  ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view knowledge documents in their tenant" ON public.knowledge_documents FOR SELECT
    USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));
  CREATE POLICY knowledge_legacy_tenant_boundary ON public.knowledge_documents AS RESTRICTIVE FOR ALL TO authenticated
    USING (public.knowledge_qa_can_access(tenant_id)) WITH CHECK (public.knowledge_qa_can_access(tenant_id));
  CREATE POLICY knowledge_legacy_read_boundary ON public.knowledge_documents AS RESTRICTIVE FOR SELECT TO authenticated
    USING (public.can_access_knowledge_document(id, auth.uid()));
  CREATE POLICY "Users can create knowledge documents in their tenant" ON public.knowledge_documents FOR INSERT
    WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())) AND created_by = auth.uid());

  ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view decisions in their tenant" ON public.task_decisions FOR SELECT
    USING (
      tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        created_by = auth.uid() OR visible_to_all = true
        OR EXISTS (SELECT 1 FROM public.task_decision_participants
          WHERE decision_id = task_decisions.id AND user_id = auth.uid())
      )
    );
  CREATE POLICY "Users can create decisions in their tenant" ON public.task_decisions FOR INSERT
    WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

  ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view letters in their tenant" ON public.letters FOR SELECT
    USING (
      tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.letter_collaborators lc
          WHERE lc.letter_id = letters.id AND lc.user_id = auth.uid())
      )
    );
  CREATE POLICY configured_letter_reads ON public.letters AS RESTRICTIVE FOR SELECT TO authenticated
    USING (public.field_row_visible(tenant_id, 'letters'));
  CREATE POLICY "Users can create letters in their tenant" ON public.letters FOR INSERT
    WITH CHECK (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));

  INSERT INTO public.tenants VALUES ('${tenant}'), ('${foreignTenant}');
  INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role) VALUES
    ('${office}', '${tenant}', 'abgeordneter'),
    ('${staff}', '${tenant}', 'mitarbeiter'),
    ('${outsider}', '${foreignTenant}', 'bueroleitung');

  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.role() TO authenticated;
`);

// Die App nutzt überall `insert(...).select()`, also INSERT ... RETURNING.
const insertCaseItem = (actor, tenantId = tenant) =>
  q(`INSERT INTO public.case_items (tenant_id, user_id, subject) VALUES ($1,$2,'[TEST] Vorgang') RETURNING id`, [
    tenantId,
    actor,
  ]);
const insertKnowledgeDoc = (actor, { tenantId = tenant, published = false } = {}) =>
  q(
    `INSERT INTO public.knowledge_documents (tenant_id, created_by, title, content, is_published)
     VALUES ($1,$2,'[TEST] Wissensdokument','Inhalt',$3) RETURNING id`,
    [tenantId, actor, published],
  );
const insertCaseFile = (actor) =>
  q(`INSERT INTO public.case_files (tenant_id, user_id, visibility) VALUES ($1,$2,'private') RETURNING id`, [tenant, actor]);
const insertTaskDecision = (actor) =>
  q(`INSERT INTO public.task_decisions (tenant_id, created_by, title) VALUES ($1,$2,'[TEST] Entscheidung') RETURNING id`, [
    tenant,
    actor,
  ]);
const insertLetter = (actor) =>
  q(`INSERT INTO public.letters (tenant_id, created_by, title) VALUES ($1,$2,'[TEST] Brief') RETURNING id`, [tenant, actor]);

const denied = (promise, label) =>
  assert.rejects(promise, (error) => error.code === '42501' && /row-level security/.test(error.message), label);

// 1) Ausgangslage: Insert erlaubt, RETURNING scheitert bei den selbstlesenden SELECT-Policies.
await as(office);
await denied(insertCaseItem(office), 'case_items: RETURNING muss vor dem Fix an der SELECT-Policy scheitern');
await denied(insertKnowledgeDoc(office), 'knowledge_documents: RETURNING muss vor dem Fix an der RESTRICTIVE-Policy scheitern');

// Kontrolltabellen mit zeilenlokaler SELECT-Policy funktionieren schon vorher.
assert.equal((await insertCaseFile(office)).length, 1, 'case_files: RETURNING ist bereits zeilenlokal erlaubt');
assert.equal((await insertTaskDecision(office)).length, 1, 'task_decisions: RETURNING ist bereits zeilenlokal erlaubt');
assert.equal((await insertLetter(office)).length, 1, 'letters: RETURNING ist bereits zeilenlokal erlaubt');

// 2) Migration einspielen.
await db.exec('RESET ROLE');
await db.exec(
  await readFile(
    new URL('../supabase/migrations/20261125220000_case_items_knowledge_documents_returning_visibility.sql', import.meta.url),
    'utf8',
  ),
);

// 3) Der jeweilige Speicherpfad der App wird grün.
await as(office);
const item = (await insertCaseItem(office))[0];
assert.ok(item?.id, 'case_items: RETURNING muss die neue Zeile liefern');
const doc = (await insertKnowledgeDoc(office))[0];
assert.ok(doc?.id, 'knowledge_documents: RETURNING muss die neue Zeile liefern');
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_items'))[0].n, 1, 'Autor sieht genau seinen Vorgang');
assert.equal((await q('SELECT count(*)::int AS n FROM public.knowledge_documents'))[0].n, 1, 'Autor sieht genau sein Dokument');

// 4) Die zusätzliche Sichtbarkeit bleibt auf die eigene Zeile begrenzt.
await as(staff);
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_items'))[0].n, 0, 'Kollege sieht fremden Vorgang nicht');
assert.equal(
  (await q('SELECT count(*)::int AS n FROM public.knowledge_documents'))[0].n,
  0,
  'Kollege sieht unveröffentlichtes fremdes Dokument nicht',
);

// 5) Veröffentlichte Dokumente und Freigaben bleiben unverändert lesbar.
await as(office);
const published = (await insertKnowledgeDoc(office, { published: true }))[0];
const shared = (await insertKnowledgeDoc(office))[0];
await db.exec('RESET ROLE');
await q("INSERT INTO public.knowledge_document_permissions (document_id, user_id, permission_type) VALUES ($1,$2,'view')", [
  shared.id,
  staff,
]);
await as(staff);
assert.equal(
  (await q('SELECT count(*)::int AS n FROM public.knowledge_documents'))[0].n,
  2,
  'Mitarbeiter sieht veröffentlichtes und freigegebenes Dokument, aber nicht das private',
);

// 6) Die Bürogrenze hält: fremdes Büro sieht und schreibt nichts.
await as(outsider);
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_items'))[0].n, 0, 'Fremdes Büro sieht keine Vorgänge');
assert.equal(
  (await q('SELECT count(*)::int AS n FROM public.knowledge_documents'))[0].n,
  0,
  'Fremdes Büro sieht keine Wissensdokumente',
);
await denied(insertCaseItem(outsider, tenant), 'Fremdes Büro darf keinen Vorgang im Zielbüro anlegen');
await denied(
  insertKnowledgeDoc(outsider, { tenantId: tenant }),
  'Fremdes Büro darf kein Wissensdokument im Zielbüro anlegen',
);
assert.equal((await insertCaseItem(outsider, foreignTenant)).length, 1, 'Eigenes Büro bleibt schreibfähig');

console.log(
  'INSERT ... RETURNING RLS passed: case_items und knowledge_documents liefern ihre neue Zeile, case_files/task_decisions/letters bleiben grün, Autoren-, Freigabe- und Bürogrenze halten.',
);
await db.close();
