// Isolierte PostgreSQL-Prüfung (PGlite) für den Dubletten-Scan.
// Kein Zugriff auf die echte Datenbank.
// npm ci --prefix tests/database && node scripts/test-contact-duplicates.mjs
//
// Geprüft wird die Migration 20261127180000: die Funktion lädt, sie findet
// „M. Müller“ und „Max Müller“ über freie Trigramm-Ähnlichkeit (also nicht mehr
// über gleiche Namensanfänge), und die Namenskandidaten werden über
// idx_contacts_name_trgm gelesen statt über einen Vollvergleich aller Paare.
// Zusätzlich: fremde Büros werden abgewiesen, die Feldmaskierung verhindert
// E-Mail-Kandidaten, und die Begründungen bleiben erhalten.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(
  new URL('../tests/database/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href
);
const { pg_trgm } = await import(
  new URL('../tests/database/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.js', import.meta.url).href
);

const db = new PGlite({ extensions: { pg_trgm } });
const office = '11111111-1111-4111-8111-111111111111';
const foreignOffice = '22222222-2222-4222-8222-222222222222';
const me = '33333333-3333-4333-8333-333333333333';

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const asMe = async () => {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('test.actor', $1, false)", [me]);
  await db.exec('SET ROLE authenticated');
};

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
      AS $$ SELECT coalesce(current_setting('role', true), 'authenticated') $$;

    -- Schema der beteiligten Tabellen wie ausgeliefert (20260507184309).
    CREATE TABLE public.contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      name text,
      email text,
      phone text
    );
    CREATE TABLE public.user_tenant_memberships (
      user_id uuid, tenant_id uuid, role text, is_active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.field_permissions (
      tenant_id uuid, table_name text, role text, column_name text,
      can_read boolean NOT NULL DEFAULT true, read_mode text NOT NULL DEFAULT 'mask'
    );

    CREATE FUNCTION public.is_superadmin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT false $$;

    CREATE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_tenant_memberships
        WHERE tenant_id = _tenant_id AND user_id = _user_id AND is_active = true
      );
    $$;

    -- Feldmaskierung wie 20261109143000_secured_field_reads.sql.
    CREATE FUNCTION public.field_read_rule(_tenant uuid, _table text, _column text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
    DECLARE member_role text; setting record;
    BEGIN
      IF public.is_superadmin(auth.uid()) OR coalesce(auth.role(), '') = 'service_role' THEN RETURN 'allow'; END IF;
      SELECT role INTO member_role FROM public.user_tenant_memberships
        WHERE user_id = auth.uid() AND tenant_id = _tenant AND is_active;
      IF NOT FOUND THEN RETURN 'record'; END IF;
      SELECT can_read, read_mode INTO setting FROM public.field_permissions
        WHERE tenant_id = _tenant AND table_name = _table AND column_name = _column AND role::text = member_role;
      IF NOT FOUND OR setting.can_read THEN RETURN 'allow'; END IF;
      RETURN setting.read_mode;
    END $$;

    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    -- Bewusst nur der Trigramm-Index: ein zusätzlicher tenant_id-Index wäre bei
    -- kleinen Tabellen nur ein Kostenwettbewerb und würde die Plan-Zusage an
    -- Schätzungen binden, obwohl hier der Namenspfad geprüft wird.
    CREATE INDEX idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
    GRANT SELECT ON public.contacts TO authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO authenticated;

    INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role, is_active)
    VALUES ('${me}', '${office}', 'bueroleitung', true);
  `);

  // Genau die Migration, die ausgeliefert wird.
  await db.exec(await readFile(
    new URL('../supabase/migrations/20261127180000_duplicate_scan_trigram_candidates.sql', import.meta.url), 'utf8',
  ));

  const loaded = await q(
    "SELECT pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname = 'find_contact_duplicates_trgm'",
  );
  assert.equal(loaded.length, 1, 'find_contact_duplicates_trgm ist genau einmal vorhanden');
  assert.equal(loaded[0].args, '_tenant_id uuid, _threshold numeric, _limit integer');

  const insert = async (name, email = null, phone = null, tenant = office) => (await q(
    'INSERT INTO contacts (tenant_id, name, email, phone) VALUES ($1,$2,$3,$4) RETURNING id',
    [tenant, name, email, phone],
  ))[0].id;

  // Nur wenige, unterschiedliche Kontakte: der Scan darf nichts Wichtiges
  // weglimitieren, deshalb bleibt dieses Raster bewusst dünn.
  const dot = await insert('M. Müller', 'm.mueller@example.org', '+49 721 111');
  const full = await insert('Max Müller', 'max.mueller@example.org', '+49 721 222');
  await insert('Petra Schmidt', 'petra.schmidt@example.org', '+49 30 999');
  await insert('Jonas Weber', 'jonas.weber@example.org', '+49 721 333');

  await asMe();
  const found = await q('SELECT * FROM public.find_contact_duplicates_trgm($1, 0.3, 200)', [office]);
  const pair = found.find((row) =>
    (row.contact1_id === dot && row.contact2_id === full) || (row.contact1_id === full && row.contact2_id === dot));
  assert.ok(pair, `„M. Müller“ und „Max Müller“ werden als Dublette gefunden: ${JSON.stringify(found)}`);
  assert.ok(pair.match_reasons.some((reason) => reason.includes('Name')), `Begründung: ${pair.match_reasons}`);
  assert.ok(Number(pair.match_score) >= 0.3, `Score: ${pair.match_score}`);

  // Fremdes Büro bleibt gesperrt.
  await assert.rejects(
    q('SELECT * FROM public.find_contact_duplicates_trgm($1, 0.3, 10)', [foreignOffice]),
    /Kein Zugriff auf Mandant/,
  );

  // Feldmaskierung: ohne Leserecht auf E-Mail entstehen keine E-Mail-Kandidaten,
  // und die Ausgabe bleibt maskiert.
  await db.exec('RESET ROLE');
  const maskedEmail = await insert('Alina Kunz', 'nur.gleich@example.org');
  const maskedEmail2 = await insert('Bernd Lang', 'NUR.GLEICH@example.org');
  await db.exec(`
    INSERT INTO public.field_permissions (tenant_id, table_name, role, column_name, can_read)
    VALUES ('${office}', 'contacts', 'bueroleitung', 'email', false);
  `);
  await asMe();
  const masked = await q('SELECT * FROM public.find_contact_duplicates_trgm($1, 0.3, 200)', [office]);
  const emailOnly = masked.find((row) =>
    (row.contact1_id === maskedEmail && row.contact2_id === maskedEmail2)
    || (row.contact1_id === maskedEmail2 && row.contact2_id === maskedEmail));
  assert.equal(emailOnly, undefined, 'Ohne Leserecht entstehen keine reinen E-Mail-Dubletten');
  assert.ok(masked.every((row) => row.contact1_email === null && row.contact2_email === null),
    'Maskierte E-Mails verlassen die Funktion nicht');

  // Mit Leserecht wird dieselbe Paarung über die E-Mail gefunden.
  await db.exec('RESET ROLE');
  await db.exec(`DELETE FROM public.field_permissions WHERE tenant_id = '${office}'`);
  await asMe();
  const readable = await q('SELECT * FROM public.find_contact_duplicates_trgm($1, 0.3, 200)', [office]);
  const emailPair = readable.find((row) =>
    (row.contact1_id === maskedEmail && row.contact2_id === maskedEmail2)
    || (row.contact1_id === maskedEmail2 && row.contact2_id === maskedEmail));
  assert.ok(emailPair, 'Mit Leserecht findet die E-Mail-Gleichheit das Paar');
  assert.ok(emailPair.match_reasons.some((reason) => reason.includes('E-Mail')), `${emailPair.match_reasons}`);

  // Realistische Bürogröße für den Plan: Vorname × Nachname, keine künstlichen
  // Ziffernsuffixe, damit die Kandidatenmenge nicht künstlich aufgebläht wird.
  const firstNames = ['Anna', 'Bernd', 'Clara', 'Dieter', 'Eva', 'Frank', 'Gisela', 'Heinz', 'Ines', 'Jörg',
    'Katrin', 'Lars', 'Monika', 'Nils', 'Olga', 'Peter', 'Rita', 'Sven', 'Tina', 'Uwe',
    'Vera', 'Werner', 'Xenia', 'Yvonne', 'Zoe', 'Anton', 'Berta', 'Cem', 'Dana', 'Emil'];
  const lastNames = ['Weber', 'Schulz', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Wolf', 'Neumann', 'Braun', 'Krüger',
    'Lang', 'Kunz', 'Vogel', 'Berger', 'Winkler', 'Seidel', 'Lorenz', 'Ott', 'Haas', 'Albrecht',
    'Brandt', 'Conrad', 'Dietrich', 'Engel', 'Fischer', 'Graf', 'Hartmann', 'Jäger', 'Keller', 'Lehmann'];
  await db.exec('RESET ROLE');
  await db.exec(`
    INSERT INTO public.contacts (tenant_id, name, email)
    SELECT '${office}', f || ' ' || l, lower(f) || '.' || lower(l) || '@example.org'
    FROM unnest(ARRAY[${firstNames.map((name) => `'${name}'`).join(',')}]) f
    CROSS JOIN unnest(ARRAY[${lastNames.map((name) => `'${name}'`).join(',')}]) l;
    ANALYZE public.contacts;
  `);

  // Der Plan der Namenskandidaten liest den Trigramm-Index parameterisiert.
  // Der Abfragetext entspricht dem Rumpf der Migration.
  const candidateQuery = `
    SELECT c1.id AS left_id, c2.id AS right_id
    FROM public.contacts c1
    JOIN LATERAL (
      SELECT other.id FROM public.contacts other
      WHERE other.tenant_id = c1.tenant_id
        AND other.id::text > c1.id::text
        AND other.name % c1.name
    ) c2 ON true
    WHERE c1.tenant_id = '${office}' AND c1.name IS NOT NULL`;
  // Struktur: der gelieferte Index ist eine Trigramm-GIN-Spalte.
  const indexDef = await q(`
    SELECT pg_get_indexdef(i.indexrelid) AS def
    FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_contacts_name_trgm'
  `);
  assert.equal(indexDef.length, 1, 'idx_contacts_name_trgm fehlt');
  assert.match(indexDef[0].def, /gin_trgm_ops/, `Falscher Opclass: ${indexDef[0].def}`);

  // Die Indexnutzung wird erzwungen statt aus Kostenschätzungen abgelesen:
  // Sequenzielles Lesen, einfache Index-Scans und die mengenbasierten Joins
  // (Hash/Merge) sind abgeschaltet. Übrig bleibt der Nested Loop, dessen innere
  // Seite den Trigramm-Index als Bitmap liest. Damit hängt die Prüfung weder an
  // Tabellengröße noch an Statistiken oder der Planer-Version; wäre der Operator
  // dort nicht indizierbar, bliebe nur ein (strafbewehrter) Seq Scan übrig und
  // die Zusicherung schlüge fehl.
  await db.exec('SET enable_seqscan = off; SET enable_indexscan = off; SET enable_hashjoin = off; SET enable_mergejoin = off;');

  const alonePlan = (await q(`
    EXPLAIN (COSTS OFF)
    SELECT other.id FROM public.contacts other
    WHERE other.name % 'Max Müller'
  `)).map((row) => row['QUERY PLAN']).join('\n');
  assert.match(alonePlan, /Bitmap Index Scan on idx_contacts_name_trgm/,
    `Der Trigramm-Operator ist nicht indizierbar:\n${alonePlan}`);

  const plan = (await q(`EXPLAIN (COSTS OFF) ${candidateQuery}`))
    .map((row) => row['QUERY PLAN']).join('\n');
  assert.match(plan, /idx_contacts_name_trgm/, `Plan ohne Trigramm-Index:\n${plan}`);
  assert.doesNotMatch(plan, /contacts_pkey/,
    `Der Plan liest den Primärschlüssel statt des Trigramms:\n${plan}`);
  await db.exec('RESET enable_seqscan; RESET enable_indexscan; RESET enable_hashjoin; RESET enable_mergejoin;');

  // Jede Paarung entsteht genau einmal: keine gespiegelten Doppel, keine
  // Selbstpaare, und die Orientierung folgt der Textordnung der id.
  await asMe();
  const candidates = await q(candidateQuery);
  const keys = new Set(candidates.map((row) => `${row.left_id}|${row.right_id}`));
  const mirrored = candidates.filter((row) => keys.has(`${row.right_id}|${row.left_id}`));
  assert.equal(mirrored.length, 0, `${mirrored.length} gespiegelte Paare in ${candidates.length} Kandidaten`);
  assert.ok(candidates.every((row) => row.left_id < row.right_id),
    'Die Kandidaten sind nicht durchgehend in Textordnung ausgerichtet');
  assert.ok(candidates.every((row) => row.left_id !== row.right_id), 'Selbstpaar im Kandidatensatz');

  // Der Scan läuft auch bei Bürogröße vollständig durch (das Zeitlimit der
  // Funktion liegt bei 30 s; hier wird deutlich früher abgebrochen).
  const started = Date.now();
  const bulk = await q('SELECT * FROM public.find_contact_duplicates_trgm($1, 0.5, 20)', [office]);
  const elapsed = Date.now() - started;
  assert.ok(bulk.length > 0, 'Der Scan liefert bei Bürogröße Treffer');
  assert.ok(elapsed < 20000, `Scan dauerte ${elapsed} ms`);
  const unordered = bulk.map((row) => [row.contact1_id, row.contact2_id].sort().join('|'));
  assert.equal(new Set(unordered).size, unordered.length, 'Die Funktion liefert eine Paarung mehrfach');

  console.log('Duplicate scan passed: function loads with the shipped signature, "M. Müller" ↔ "Max Müller" is found by name similarity, candidate names are read through idx_contacts_name_trgm (not the primary key), foreign offices are rejected, masking suppresses email-only pairs and email values.');
} catch (error) {
  console.error('FAILED:', error.code ?? '', error.message); console.error(error.stack);
  process.exitCode = 1;
} finally {
  await db.close();
}
