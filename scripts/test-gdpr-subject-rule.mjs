// Prüft die Regel „Der Gegenstand einer DSGVO-Anfrage ist unveränderlich“ so,
// wie sie in der Datenbank steht: echte Tabellen-, Policy- und Trigger-Definition
// aus den Migrationen, echte Spaltenrechte, Ausführung als authenticated.
// Der Lauf zeigt zuerst die Ursache (Spaltenberechtigung antwortet statt der
// Regel) und danach die Wirkung der Gegenstands-Regel.
//
// Geprüft wird die eine, verbindliche Definition aus
// 20261127170000_selftest_contact_case_task_repair.sql, Abschnitt 3
// (GRANT UPDATE auf subject_email/subject_name, Trigger
// guard_gdpr_request_subject). Eine zweite Migration mit denselben Rechten
// gibt es bewusst nicht.
import { readFileSync } from "node:fs";
import { PGlite } from "../tests/database/node_modules/@electric-sql/pglite/dist/index.js";

const BASE = "supabase/migrations/20260507190106_964aec00-97b8-4df7-817d-fba76bba4038.sql";
const FOUR_EYES = "supabase/migrations/20261103234405_6bbdc076-40ca-4b87-bdb0-601eb9590bc9.sql";
const SUBJECT_RULE = "supabase/migrations/20261127170000_selftest_contact_case_task_repair.sql";

const read = (path) => readFileSync(path, "utf8");
const cut = (text, startMarker, endMarker) => {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Startmarke nicht gefunden: ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Endmarke nicht gefunden: ${endMarker}`);
  return text.slice(start, end + endMarker.length);
};

const base = read(BASE);
const fourEyes = read(FOUR_EYES);
const subjectRule = read(SUBJECT_RULE);

// Tabelle, Policies und Trigger „gdpr_requests“ inklusive gdpr_check_four_eyes.
const tableBlock = cut(base, "CREATE TABLE IF NOT EXISTS public.gdpr_requests",
  "EXECUTE FUNCTION public.gdpr_check_four_eyes();");
// Die verschärfte Vier-Augen-Regel samt Spaltenrechten und Policy-Zusätzen.
const guardBlock = cut(fourEyes, "CREATE OR REPLACE FUNCTION public.gdpr_check_four_eyes()", "$$;");
const rightsBlock = cut(fourEyes, "REVOKE UPDATE ON public.gdpr_requests FROM authenticated;",
  "GRANT ALL ON public.gdpr_requests TO service_role;");
const policyBlock = cut(fourEyes, 'ALTER POLICY "Tenant admins create gdpr requests"',
  "WITH CHECK (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter', 'bueroleitung']));");
// Abschnitt 3: Spaltenrecht auf den Gegenstand plus der Trigger, der ihn sperrt.
const repairBlock = cut(subjectRule, "-- 3) DSGVO-Gegenstand",
  "EXECUTE FUNCTION public.guard_gdpr_request_subject();");

const office = "11111111-1111-4111-8111-111111111111";
const requester = "22222222-2222-4222-8222-222222222222";
const second = "44444444-4444-4444-8444-444444444444";
const request = "33333333-3333-4333-8333-333333333333";
const subjectEmail = "erika.muster@example.org";

const db = new PGlite();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

await db.exec(`
  CREATE SCHEMA auth;
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  CREATE TYPE public.app_role AS ENUM ('abgeordneter', 'bueroleitung', 'mitarbeiter');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
    AS $$ SELECT coalesce(nullif(current_setting('test.role', true), ''), 'anon') $$;
  CREATE FUNCTION public.is_tenant_member(uuid, uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
  CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
  CREATE FUNCTION public.has_active_tenant_role(uuid, uuid, text[]) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
`);
await db.exec(tableBlock);
await db.exec(guardBlock);
await db.exec(rightsBlock);
await db.exec(policyBlock);

await rows("SELECT set_config('test.role', 'service_role', false)");
await rows(
  `INSERT INTO public.gdpr_requests (id, tenant_id, request_type, status, subject_email, subject_name, reason, requested_by)
   VALUES ($1, $2, 'delete', 'pending', $3, 'Erika Muster', 'Selbsttest', $4)`,
  [request, office, subjectEmail, requester],
);

const asUser = async (actor, sql, params = []) => {
  await db.exec("RESET ROLE");
  await rows("SELECT set_config('test.actor', $1, false), set_config('test.role', 'authenticated', false)", [actor]);
  await db.exec("SET ROLE authenticated");
  try {
    await db.query(sql, params);
    return { error: null };
  } catch (error) {
    return { error };
  } finally {
    await db.exec("RESET ROLE");
  }
};

const checks = [];
const record = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name} – ${detail}`);
};

const subject = `UPDATE public.gdpr_requests SET subject_email = 'geaendert@example.org' WHERE id = '${request}'`;

const before = await asUser(requester, subject);
record("Ohne Spaltenrecht antwortet die Berechtigung statt der Regel",
  Boolean(before.error) && before.error.code === "42501" && /permission denied/i.test(before.error.message),
  `${before.error?.code} ${before.error?.message}`);

await db.exec(repairBlock);

const after = await asUser(requester, subject);
// Geprüft wird wie im Selbsttest: Fehler vorhanden und die Meldung nennt die
// Unveränderlichkeit. Den Fehlercode bestimmt der zuerst laufende Trigger
// (gdpr_check_four_eyes, P0001); der Guard selbst meldet 42501.
record("Mit dem Spaltenrecht aus 20261127170000 antwortet die Regel",
  Boolean(after.error) && /unveränderlich/.test(after.error.message),
  `${after.error?.code} ${after.error?.message}`);

const nameChange = await asUser(requester, `UPDATE public.gdpr_requests SET subject_name = 'Andere Person' WHERE id = '${request}'`);
record("Auch der Name des Betroffenen bleibt gesperrt",
  Boolean(nameChange.error) && /unveränderlich/.test(nameChange.error.message),
  `${nameChange.error?.code} ${nameChange.error?.message}`);

const selfApproval = await asUser(requester, `UPDATE public.gdpr_requests SET status = 'approved' WHERE id = '${request}'`);
record("Eigenfreigabe bleibt abgewiesen",
  Boolean(selfApproval.error) && /zweite aktive berechtigte Person/.test(selfApproval.error.message),
  `${selfApproval.error?.code} ${selfApproval.error?.message}`);

const open = (await rows("SELECT status, subject_email, approved_by FROM public.gdpr_requests WHERE id = $1", [request]))[0];
record("Anfrage bleibt unverändert und ausstehend",
  open.status === "pending" && open.subject_email === subjectEmail && open.approved_by === null,
  JSON.stringify(open));

const approval = await asUser(second, `UPDATE public.gdpr_requests SET status = 'approved' WHERE id = '${request}'`);
const approved = (await rows("SELECT status, approved_by, approved_at FROM public.gdpr_requests WHERE id = $1", [request]))[0];
record("Zweite berechtigte Person darf weiterhin freigeben",
  approval.error === null && approved.status === "approved" && approved.approved_by === second && approved.approved_at !== null,
  `${approval.error?.message ?? "kein Fehler"} / ${JSON.stringify(approved)}`);

await db.close();

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} von ${checks.length} Prüfungen fehlgeschlagen: ${failed.map((c) => c.name).join(", ")}`);
  process.exit(1);
}
console.log(`\ngdpr subject rule passed: ${checks.length} Prüfungen grün.`);
