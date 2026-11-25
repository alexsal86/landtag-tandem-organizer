// Isolated PostgreSQL (PGlite) regression test for the case_item_interactions policies.
// Never connects to the live database.
// npm ci --prefix tests/database && node scripts/test-case-item-interaction-rls.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(
  new URL('../tests/database/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href
);
const db = new PGlite();

const office = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const staff = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const intern = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tenant = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const foreignTenant = '11111111-1111-4111-8111-111111111111';
const item = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const foreignItem = '22222222-2222-4222-8222-222222222222';
const SELFTEST_MARKER = '[SELFTEST]';

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const as = async (who) => {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.actor', $1, false)", [who]);
  await db.exec('SET ROLE authenticated');
};

// Schema and policies as deployed before the fix (20260305121500 / 20260305133000 / 20260306100000).
await db.exec(`
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;

  CREATE TYPE public.case_item_source_channel AS ENUM ('phone','email','social','in_person','other');
  CREATE TYPE public.case_item_interaction_visibility AS ENUM ('internal','team','public_to_case_participants');

  CREATE TABLE public.tenants (id uuid PRIMARY KEY);
  CREATE TABLE public.user_tenant_memberships (
    user_id uuid, tenant_id uuid, role text, is_active boolean NOT NULL DEFAULT true, PRIMARY KEY (user_id, tenant_id)
  );
  CREATE TABLE public.case_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, user_id uuid, visibility text);
  CREATE TABLE public.case_file_participants (case_file_id uuid, user_id uuid);
  CREATE TABLE public.case_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, user_id uuid NOT NULL,
    owner_user_id uuid, case_file_id uuid REFERENCES public.case_files(id),
    visible_to_all boolean NOT NULL DEFAULT false, subject text
  );
  CREATE TABLE public.case_item_participants (
    case_item_id uuid REFERENCES public.case_items(id), user_id uuid, role text, PRIMARY KEY (case_item_id, user_id)
  );
  CREATE TABLE public.case_item_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_item_id uuid REFERENCES public.case_items(id) ON DELETE CASCADE,
    tenant_id uuid,
    interaction_type public.case_item_source_channel NOT NULL,
    interaction_at timestamptz NOT NULL DEFAULT now(),
    direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound','internal')),
    summary text, payload jsonb, created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    visibility public.case_item_interaction_visibility NOT NULL DEFAULT 'team',
    subject text, details text, is_resolution boolean DEFAULT false,
    source_type text, source_id uuid, case_file_id uuid REFERENCES public.case_files(id) ON DELETE SET NULL,
    updated_at timestamptz DEFAULT now()
  );

  CREATE FUNCTION public.get_user_tenant_ids(_user_id uuid) RETURNS uuid[]
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT array_agg(tenant_id) FROM public.user_tenant_memberships WHERE user_id = _user_id AND is_active = true;
  $$;

  CREATE FUNCTION public.has_active_tenant_role(_user_id uuid, _tenant_id uuid, _roles text[]) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_tenant_memberships utm
      WHERE utm.user_id = _user_id AND utm.tenant_id = _tenant_id AND utm.is_active = true AND utm.role = ANY(_roles));
  $$;

  CREATE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT public.has_active_tenant_role(_user_id, _tenant_id, ARRAY['abgeordneter','bueroleitung']);
  $$;

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

  CREATE FUNCTION public.user_can_access_case_item_interaction(_user_id uuid, _interaction_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.case_item_interactions cii
      JOIN public.case_items ci ON ci.id = cii.case_item_id
      WHERE cii.id = _interaction_id
        AND public.user_can_access_case_item(_user_id, ci.id)
        AND (
          cii.visibility = 'team'
          OR (cii.visibility = 'internal' AND (
              cii.created_by = _user_id OR ci.user_id = _user_id OR ci.owner_user_id = _user_id
              OR public.is_tenant_admin(_user_id, ci.tenant_id)
              OR EXISTS (SELECT 1 FROM public.case_item_participants cip WHERE cip.case_item_id = ci.id AND cip.user_id = _user_id AND cip.role IN ('owner','editor'))))
          OR (cii.visibility = 'public_to_case_participants' AND (
              EXISTS (SELECT 1 FROM public.case_item_participants cip WHERE cip.case_item_id = ci.id AND cip.user_id = _user_id)
              OR EXISTS (SELECT 1 FROM public.case_file_participants cfp WHERE cfp.case_file_id = ci.case_file_id AND cfp.user_id = _user_id)
              OR ci.user_id = _user_id OR ci.owner_user_id = _user_id))
        )
        AND (
          cii.interaction_type NOT IN ('phone','social')
          OR public.has_active_tenant_role(_user_id, ci.tenant_id, ARRAY['abgeordneter','bueroleitung','mitarbeiter'])
        )
    );
  $$;

  ALTER TABLE public.case_items ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view accessible case items" ON public.case_items FOR SELECT
    USING (public.user_can_access_case_item(auth.uid(), id));

  ALTER TABLE public.case_item_interactions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can manage case item interactions" ON public.case_item_interactions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.case_files cf
      WHERE cf.id = case_item_interactions.case_file_id AND cf.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))))
    WITH CHECK (EXISTS (SELECT 1 FROM public.case_files cf
      WHERE cf.id = case_item_interactions.case_file_id AND cf.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))));
  CREATE POLICY "Users can view allowed case item interactions" ON public.case_item_interactions FOR SELECT
    USING (public.user_can_access_case_item_interaction(auth.uid(), id));
  CREATE POLICY "Users can insert allowed case item interactions" ON public.case_item_interactions FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.case_items ci
      WHERE ci.id = case_item_interactions.case_item_id
        AND ci.tenant_id = case_item_interactions.tenant_id
        AND public.user_can_access_case_item(auth.uid(), ci.id)
        AND (case_item_interactions.interaction_type NOT IN ('phone','social')
          OR public.has_active_tenant_role(auth.uid(), ci.tenant_id, ARRAY['abgeordneter','bueroleitung','mitarbeiter']))));
  CREATE POLICY "Users can update allowed case item interactions" ON public.case_item_interactions FOR UPDATE
    USING (public.user_can_access_case_item_interaction(auth.uid(), id))
    WITH CHECK (public.user_can_access_case_item_interaction(auth.uid(), id));
  CREATE POLICY "Users can delete own case item interactions" ON public.case_item_interactions FOR DELETE
    USING (public.user_can_access_case_item_interaction(auth.uid(), id) AND created_by = auth.uid());

  INSERT INTO public.tenants VALUES ('${tenant}'), ('${foreignTenant}');
  INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role) VALUES
    ('${office}', '${tenant}', 'abgeordneter'),
    ('${staff}', '${tenant}', 'mitarbeiter'),
    ('${intern}', '${tenant}', 'praktikant'),
    ('${outsider}', '${foreignTenant}', 'bueroleitung');
  INSERT INTO public.case_items (id, tenant_id, user_id, subject) VALUES
    ('${item}', '${tenant}', '${office}', 'Vorgang'),
    ('${foreignItem}', '${foreignTenant}', '${outsider}', 'Fremder Vorgang');
  INSERT INTO public.case_item_participants (case_item_id, user_id, role) VALUES ('${item}', '${intern}', 'viewer');

  CREATE ROLE authenticated;
  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
`);

// Same insert the selftest scenario performs: case item, tenant, channel, direction, visibility.
const insertInteraction = (type, actor, { itemId = item, tenantId = tenant } = {}) =>
  q(
    `INSERT INTO public.case_item_interactions
       (case_item_id, tenant_id, interaction_type, direction, interaction_at, summary, visibility, created_by)
     VALUES ($1,$2,$3,'inbound',now(),$4,'internal',$5) RETURNING id`,
    [itemId, tenantId, type, `${SELFTEST_MARKER} ${type}`, actor],
  );

const denied = (promise, label) =>
  assert.rejects(promise, (error) => error.code === '42501' && /row-level security/.test(error.message), label);

// 1) Ausgangslage: der Insert ist erlaubt, das RETURNING der App scheitert an der SELECT-Policy.
await as(office);
assert.equal((await q('SELECT public.user_can_access_case_item(auth.uid(), $1) AS v', [item]))[0].v, true);
assert.equal((await q("SELECT public.has_active_tenant_role(auth.uid(), $1, ARRAY['abgeordneter','bueroleitung','mitarbeiter']) AS v", [tenant]))[0].v, true);
for (const type of ['phone', 'email', 'in_person']) {
  await denied(insertInteraction(type, office), `${type}: RETURNING muss vor dem Fix an der SELECT-Policy scheitern`);
}

// 2) Migration einspielen.
await db.exec('RESET ROLE');
await db.exec(await readFile(new URL('../supabase/migrations/20261125210000_case_item_interaction_returning_visibility.sql', import.meta.url), 'utf8'));

// 3) Der Selbsttest-Schritt wird grün: alle drei Kanäle inklusive RETURNING.
await as(office);
for (const type of ['phone', 'email', 'in_person']) {
  const rows = await insertInteraction(type, office);
  assert.equal(rows.length, 1, `${type}: RETURNING muss eine Zeile liefern`);
  assert.ok(rows[0].id, `${type}: id fehlt`);
}
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_item_interactions'))[0].n, 3);

// 4) Kanal-Rollenregel und Bürogrenze bleiben unangetastet.
//    intern ist am Vorgang beteiligt (viewer), hat aber keine Büro-Rolle.
await as(intern);
await denied(insertInteraction('phone', intern), 'Ohne Büro-Rolle bleibt phone verboten');
assert.equal((await insertInteraction('email', intern)).length, 1, 'E-Mail bleibt für Beteiligte ohne Büro-Rolle erlaubt');
await as(outsider);
await denied(insertInteraction('email', outsider), 'Fremdes Büro darf keine Interaktion anlegen');

// 5) Die zusätzliche Policy öffnet keine Fremdsicht: interne Anrufe bleiben beim Autor.
await as(staff);
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_item_interactions'))[0].n, 0, 'Mitarbeiter ohne Büro-Rolle sieht keine internen Anrufe');
await as(intern);
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_item_interactions'))[0].n, 1, 'Praktikant sieht nur die eigene E-Mail');
await as(office);
// Der Vorgangsinhaber sieht zusätzlich die interne E-Mail der beteiligten Person (bestehende Regel).
assert.equal((await q('SELECT count(*)::int AS n FROM public.case_item_interactions'))[0].n, 4, 'Inhaber sieht seine drei Interaktionen plus die interne Beteiligten-E-Mail');

console.log('case_item_interactions RLS passed: Insert + RETURNING für Anruf/Mail/Treffen, Kanal-Rollenregel und Bürogrenze halten.');
