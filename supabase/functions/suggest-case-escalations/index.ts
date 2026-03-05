import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

type SuggestionStatus = "pending" | "accepted" | "rejected";
type EscalationReasonCode = "age_21" | "age_30" | "interaction_count" | "participant_count" | "priority_urgent" | "legal_marked" | "political_marked";

const THRESHOLDS = { interactions: 5, participants: 3 };

const reasonLabels: Record<EscalationReasonCode, string> = {
  age_21: "Alter über 21 Tage",
  age_30: "Alter über 30 Tage",
  interaction_count: `Interaktionen über ${THRESHOLDS.interactions}`,
  participant_count: `Beteiligte über ${THRESHOLDS.participants}`,
  priority_urgent: "Priorität kritisch",
  legal_marked: "Juristisch markiert",
  political_marked: "Politisch markiert",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getDaysOld = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";

    const service = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body?.action ?? "list";

    if (action === "run-check") {
      const internalSecret = req.headers.get("x-automation-secret") ?? "";
      if (!automationSecret || internalSecret !== automationSecret) return json({ error: "Forbidden" }, 403);

      const { data: items, error: itemErr } = await service
        .from("case_items")
        .select("id, tenant_id, created_at, priority, is_legal_relevant, is_political_relevant, contact_id")
        .in("status", ["active", "pending"])
        .is("case_file_id", null);
      if (itemErr) throw itemErr;

      let generated = 0;
      for (const item of items ?? []) {
        const [{ count: interactionCount }, { count: participantCount }] = await Promise.all([
          service.from("case_item_interactions").select("id", { count: "exact", head: true }).eq("case_item_id", item.id),
          service.from("case_item_participants").select("id", { count: "exact", head: true }).eq("case_item_id", item.id),
        ]);

        const daysOld = getDaysOld(item.created_at);
        const reasons: EscalationReasonCode[] = [];
        if (daysOld >= 30) reasons.push("age_30");
        else if (daysOld >= 21) reasons.push("age_21");
        if ((interactionCount ?? 0) > THRESHOLDS.interactions) reasons.push("interaction_count");
        if ((participantCount ?? 0) > THRESHOLDS.participants) reasons.push("participant_count");
        if (item.priority === "urgent") reasons.push("priority_urgent");
        if (item.is_legal_relevant) reasons.push("legal_marked");
        if (item.is_political_relevant) reasons.push("political_marked");
        if (reasons.length === 0) continue;

        let suggestedCaseFileId: string | null = null;
        if (item.contact_id) {
          const { data: candidate } = await service
            .from("case_file_contacts")
            .select("case_file_id, case_files!inner(id, status, tenant_id)")
            .eq("contact_id", item.contact_id)
            .eq("case_files.tenant_id", item.tenant_id)
            .in("case_files.status", ["active", "pending"])
            .limit(1)
            .maybeSingle();
          suggestedCaseFileId = (candidate as { case_file_id: string } | null)?.case_file_id ?? null;
        }

        const payload = {
          daysOld,
          interactionCount: interactionCount ?? 0,
          participantCount: participantCount ?? 0,
          reasonLabels: reasons.map((reason) => reasonLabels[reason]),
        };

        const { data: existing } = await service
          .from("case_item_escalation_suggestions")
          .select("id")
          .eq("case_item_id", item.id)
          .eq("status", "pending")
          .maybeSingle();

        if (existing?.id) {
          await service.from("case_item_escalation_suggestions").update({
            reason_codes: reasons,
            suggestion_payload: payload,
            suggested_case_file_id: suggestedCaseFileId,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await service.from("case_item_escalation_suggestions").insert({
            case_item_id: item.id,
            tenant_id: item.tenant_id,
            status: "pending",
            reason_codes: reasons,
            suggestion_payload: payload,
            suggested_case_file_id: suggestedCaseFileId,
          });
          generated += 1;
        }
      }

      return json({ checked: (items ?? []).length, generated });
    }

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    if (action === "list") {
      const { data, error } = await userClient
        .from("case_item_escalation_suggestions")
        .select(`id,status,reason_codes,suggestion_payload,suggested_case_file_id,created_at,case_items!inner(id,source_channel,priority,created_at,owner_user_id,case_file_id,tenant_id)`)
        .eq("status", "pending")
        .is("case_items.case_file_id", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return json({ suggestions: data ?? [] });
    }

    if (action === "review") {
      const suggestionId = body?.suggestionId as string | undefined;
      const decision = body?.decision as SuggestionStatus | undefined;
      const rejectionReason = body?.rejectionReason as string | undefined;
      const createCaseFile = Boolean(body?.createCaseFile);
      const targetCaseFileId = body?.targetCaseFileId as string | undefined;

      if (!suggestionId || !decision || !["accepted", "rejected"].includes(decision)) return json({ error: "Invalid payload" }, 400);

      const { data: suggestion, error: suggestionErr } = await userClient
        .from("case_item_escalation_suggestions")
        .select("id,case_item_id,tenant_id,reason_codes")
        .eq("id", suggestionId)
        .eq("status", "pending")
        .maybeSingle();
      if (suggestionErr) throw suggestionErr;
      if (!suggestion) return json({ error: "Suggestion not found" }, 404);

      if (decision === "rejected" && !rejectionReason?.trim()) return json({ error: "Rejection reason required" }, 400);

      if (decision === "rejected") {
        await userClient.from("case_item_escalation_suggestions").update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason?.trim(),
        }).eq("id", suggestion.id);

        await userClient.from("case_item_timeline").insert({
          case_item_id: suggestion.case_item_id,
          tenant_id: suggestion.tenant_id,
          event_type: "escalation_rejected",
          title: "Eskalation abgelehnt",
          description: rejectionReason?.trim(),
          metadata: { suggestion_id: suggestion.id, reason_codes: suggestion.reason_codes },
          created_by: user.id,
        });

        return json({ success: true });
      }

      let finalCaseFileId = targetCaseFileId ?? null;
      if (createCaseFile) {
        const { data: caseFile, error: caseFileErr } = await userClient.from("case_files").insert({
          tenant_id: suggestion.tenant_id,
          user_id: user.id,
          title: `Akte aus Vorgang ${suggestion.case_item_id.slice(0, 8)}`,
          case_type: "citizen_concern",
          status: "active",
          priority: "high",
          description: "Automatisch aus Eskalationsvorschlag erstellt.",
        }).select("id").single();
        if (caseFileErr) throw caseFileErr;
        finalCaseFileId = caseFile.id;
      }

      if (!finalCaseFileId) return json({ error: "targetCaseFileId required" }, 400);

      const nowIso = new Date().toISOString();
      await userClient.from("case_items").update({ case_file_id: finalCaseFileId }).eq("id", suggestion.case_item_id);

      await userClient.from("case_item_timeline").insert({
        case_item_id: suggestion.case_item_id,
        tenant_id: suggestion.tenant_id,
        event_type: "escalation_confirmed",
        title: "Eskalation bestätigt",
        description: `Vorgang wurde einer Akte zugeordnet (${finalCaseFileId}).`,
        metadata: { suggestion_id: suggestion.id, case_file_id: finalCaseFileId, reason_codes: suggestion.reason_codes },
        created_by: user.id,
      });

      await userClient.from("case_file_timeline").insert({
        case_file_id: finalCaseFileId,
        event_date: nowIso.slice(0, 10),
        event_type: "case_item_linked",
        title: "Vorgang eskaliert und zugeordnet",
        description: `Vorgang ${suggestion.case_item_id} wurde über Eskalationsvorschlag zugeordnet.`,
        source_type: "case_item",
        source_id: suggestion.case_item_id,
        created_by: user.id,
      });

      await userClient.from("case_item_escalation_suggestions").update({
        status: "accepted",
        reviewed_by: user.id,
        reviewed_at: nowIso,
        accepted_case_file_id: finalCaseFileId,
      }).eq("id", suggestion.id);

      return json({ success: true, caseFileId: finalCaseFileId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
