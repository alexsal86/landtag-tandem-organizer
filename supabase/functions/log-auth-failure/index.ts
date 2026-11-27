// Edge Function: log-auth-failure
// Nimmt fehlgeschlagene Anmeldeversuche an, für die es noch keine Sitzung gibt.
//
// Hintergrund: src/pages/Auth.tsx meldet einen Login-Fehler, bevor eine Sitzung
// besteht. Derselbe Aufruf über log-audit-event scheitert an requireAuth (401) und
// wurde deshalb nie gespeichert. Dieser Endpunkt ist bewusst ohne JWT erreichbar
// (verify_jwt = false) und dafür strikt begrenzt:
//   - nur POST und nur die beiden festen Aktionen
//   - nur ein kleiner, syntaktisch geprüfter Payload (kein Freitext)
//   - IP- und E-Mail-Rate-Limit; über dem Limit wird still verworfen
//   - ausschließlich append-only Audit-Schreiben, kein Lesezugriff
// Die Zeilen haben keine tenant_id: ohne Sitzung ist die Bürozuordnung nicht
// verlässlich ableitbar, und ein Rückschluss aus der E-Mail wäre eine Auskunft
// über fremde Konten. Sichtbar sind sie damit für die Plattformadministration.
import { corsHeaders, withSafeHandler } from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const ACTIONS = new Set(["auth.login_failed", "auth.mfa_failed"]);
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const REASON_PATTERN = /^[A-Za-z0-9 _.,:;()\-\/]{0,80}$/;

const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;
const MAX_PER_EMAIL = 5;

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();
const emailBuckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function take(store: Map<string, Bucket>, key: string, max: number, now = Date.now()): boolean {
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (store.size > 5000) {
      for (const [entryKey, entry] of store) {
        if (entry.resetAt <= now) store.delete(entryKey);
      }
    }
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(withSafeHandler("log-auth-failure", async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ipAddress = clientIp(req);
  if (!take(ipBuckets, ipAddress, MAX_PER_IP)) {
    // Kein Unterschied in der Antwort: ein Limit darf nicht verraten, ob die
    // Adresse zu einem Konto gehört.
    return json({ success: true });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return json({ error: "Invalid action" }, 400);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_PATTERN.test(email)) return json({ error: "Invalid email" }, 400);

  if (!take(emailBuckets, `${email}|${ipAddress}`, MAX_PER_EMAIL)) {
    return json({ success: true });
  }

  const rawReason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reason = rawReason && REASON_PATTERN.test(rawReason) ? rawReason : null;

  const admin = createServiceRoleClient();
  const payload = {
    action,
    details: { email, reason },
    source: "log-auth-failure",
    user_agent: (req.headers.get("user-agent") ?? "unknown").slice(0, 200),
    timestamp: new Date().toISOString(),
  };

  const { error } = await admin.from("audit_log_entries").insert({
    action,
    tenant_id: null,
    user_id: null,
    ip_address: ipAddress,
    payload,
  });

  if (error) {
    console.error("log-auth-failure: insert failed", error.message);
    return json({ error: "Failed to log event" }, 500);
  }

  // Immer dieselbe Antwort, unabhängig davon, ob die Adresse existiert.
  return json({ success: true });
}));
