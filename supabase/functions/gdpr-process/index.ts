// Edge Function: gdpr-process
// Verarbeitet eine gdpr_requests-Zeile (export ODER delete).
// Auth: JWT Pflicht; nur Tenant-Admins (abgeordneter/bueroleitung); für 'delete' zusätzlich approved_by ≠ requested_by.
import JSZip from "https://esm.sh/jszip@3.10.1";
import { requireAuth, withSafeHandler } from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { hasPersonalDeletionApproval } from "./approval.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  request_id: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(withSafeHandler("gdpr-process", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const actor = await requireAuth(req);
    if (!actor) return json({ error: "unauthorized" }, 401);
    const actorId = actor.userId;
    const admin = createServiceRoleClient();

    const body = (await req.json()) as Body;
    if (!body?.request_id) return json({ error: "request_id required" }, 400);

    // Load request
    const { data: request, error: reqErr } = await admin
      .from("gdpr_requests")
      .select("*")
      .eq("id", body.request_id)
      .maybeSingle();
    if (reqErr || !request) return json({ error: "request not found" }, 404);

    const { data: isAdmin, error: roleError } = await admin.rpc("has_active_tenant_role", {
      _tenant_id: request.tenant_id,
      _user_id: actorId,
      _roles: ["abgeordneter", "bueroleitung"],
    });
    if (roleError || !isAdmin) return json({ error: "forbidden" }, 403);

    if (request.request_type === "delete") {
      if (!hasPersonalDeletionApproval(request)) {
        return json({ error: "Persönliche Freigabe einer zweiten Person erforderlich." }, 400);
      }
      const { data: approverActive, error: approverError } = await admin.rpc("has_active_tenant_role", {
        _tenant_id: request.tenant_id,
        _user_id: request.approved_by,
        _roles: ["abgeordneter", "bueroleitung"],
      });
      if (approverError || !approverActive) return json({ error: "Freigebende Person ist nicht mehr berechtigt." }, 403);
      if (!request.subject_contact_id) return json({ error: "Kontakt-ID für Löschung erforderlich." }, 400);
    } else if (request.request_type !== "export" || request.status !== "pending") {
      return json({ error: "Anfrage ist nicht zur Verarbeitung freigegeben." }, 400);
    }

    // Claim once; concurrent requests cannot repeat destructive work.
    const { error: claimError, count: claimed } = await admin
      .from("gdpr_requests")
      .update({ status: "processing" }, { count: "exact" })
      .eq("id", request.id)
      .eq("tenant_id", request.tenant_id)
      .eq("status", request.request_type === "delete" ? "approved" : "pending");
    if (claimError) throw claimError;
    if (claimed !== 1) return json({ error: "Anfrage wird bereits verarbeitet oder wurde geändert." }, 409);

    if (request.request_type === "export") {
      const result = await runExport(admin, request);
      await admin
        .from("gdpr_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          result_storage_path: result.path,
          result_summary: result.summary,
        })
        .eq("id", request.id);
      return json({ ok: true, path: result.path, summary: result.summary });
    }

    if (request.request_type === "delete") {
      const summary = await runAnonymize(admin, request);
      const { error: completionError } = await admin
        .from("gdpr_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          result_summary: summary,
        })
        .eq("id", request.id);
      if (completionError) throw completionError;
      return json({ ok: true, summary });
    }

    return json({ error: "unknown request_type" }, 400);
  } catch (e) {
    console.error("gdpr-process error", e);
    return json({ error: "Verarbeitung fehlgeschlagen." }, 500);
  }
}));

async function runExport(admin: any, request: any) {
  const tenantId = request.tenant_id as string;
  const contactId = request.subject_contact_id as string | null;
  const email = request.subject_email as string | null;

  const summary: Record<string, number> = {};
  const zip = new JSZip();

  // Resolve target contact(s)
  let contacts: any[] = [];
  if (contactId) {
    const { data } = await admin.from("contacts").select("*").eq("id", contactId).eq("tenant_id", tenantId);
    contacts = data ?? [];
  } else if (email) {
    const { data } = await admin
      .from("contacts")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`email.eq.${email},email_2.eq.${email},email_3.eq.${email}`);
    contacts = data ?? [];
  }
  zip.file("contacts.json", JSON.stringify(contacts, null, 2));
  summary.contacts = contacts.length;

  const ids = contacts.map((c) => c.id);

  // Best-effort: collect related data from common tables. Skip if table missing/RLS denies.
  const related: Array<{ table: string; filter: any }> = [
    { table: "case_items", filter: ids.length ? { in: ["contact_id", ids] } : null },
    { table: "case_item_interactions", filter: ids.length ? { in: ["contact_id", ids] } : null },
    { table: "letters", filter: ids.length ? { in: ["contact_id", ids] } : null },
    { table: "appointments", filter: null }, // skip large
    { table: "call_logs", filter: email ? { eq: ["caller_phone", email] } : null },
    { table: "contact_briefing_memory", filter: ids.length ? { in: ["contact_id", ids] } : null },
  ];

  for (const r of related) {
    if (!r.filter) continue;
    let q = admin.from(r.table).select("*").eq("tenant_id", tenantId);
    if (r.filter.in) q = q.in(r.filter.in[0], r.filter.in[1]);
    if (r.filter.eq) q = q.eq(r.filter.eq[0], r.filter.eq[1]);
    const { data, error } = await q;
    if (error) {
      console.warn(`skip ${r.table}: ${error.message}`);
      continue;
    }
    zip.file(`${r.table}.json`, JSON.stringify(data ?? [], null, 2));
    summary[r.table] = (data ?? []).length;
  }

  const meta = {
    generated_at: new Date().toISOString(),
    request_id: request.id,
    tenant_id: tenantId,
    subject: { contact_id: contactId, email, name: request.subject_name },
    summary,
  };
  zip.file("_meta.json", JSON.stringify(meta, null, 2));

  const blob = await zip.generateAsync({ type: "uint8array" });
  // Storage convention: paths MUST start with user_id/
  const path = `${request.requested_by}/gdpr-exports/${tenantId}/${request.id}.zip`;

  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(path, blob, {
      contentType: "application/zip",
      upsert: true,
    });
  if (upErr) throw upErr;

  return { path, summary };
}

async function runAnonymize(admin: any, request: any) {
  const tenantId = request.tenant_id as string;
  const contactId = request.subject_contact_id as string;
  if (!contactId) throw new Error("subject_contact_id required for delete");

  const summary: Record<string, number> = {};

  const updates = {
    name: "Gelöscht (DSGVO)",
    first_name: null,
    last_name: null,
    email: null,
    email_2: null,
    email_3: null,
    phone: null,
    business_phone: null,
    mobile_phone: null,
    address: null,
    business_street: null,
    business_house_number: null,
    business_postal_code: null,
    business_city: null,
    notes: "[entfernt nach DSGVO]",
    avatar_url: null,
    linkedin: null,
    twitter: null,
    facebook: null,
    instagram: null,
    xing: null,
    website: null,
    birthday: null,
    coordinates: null,
  };

  const { error } = await admin
    .from("contacts")
    .update(updates)
    .eq("id", contactId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  summary.contacts_anonymized = 1;

  // Free-text fields in related tables
  const blanks: Array<{ table: string; field: string }> = [
    { table: "case_item_interactions", field: "content" },
    { table: "contact_briefing_memory", field: "content" },
  ];
  for (const b of blanks) {
    const { error: e2, count } = await admin
      .from(b.table)
      .update({ [b.field]: "[entfernt nach DSGVO]" }, { count: "exact" })
      .eq("contact_id", contactId)
      .eq("tenant_id", tenantId);
    if (!e2) summary[b.table] = count ?? 0;
  }

  return summary;
}
