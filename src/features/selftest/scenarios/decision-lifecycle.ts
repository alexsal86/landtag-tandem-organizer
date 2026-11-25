import { canNudgeDecision, DECISION_NUDGE_WINDOW_MS, decisionNudgePriority, decisionNudgeSecondsRemaining } from "@/features/decisions/dashboardNudges";
import { needsOwnDecision } from "@/components/my-work/decisions/types";
import { supabase } from "@/integrations/supabase/client";
import type { TestScenario } from "../types";
import { SELFTEST_MARKER, SELFTEST_PREFIX } from "../runner";
import { describeError, expectFields } from "../verify";

const tag = (run: string, label: string) => `${SELFTEST_PREFIX} ${label} (${run})`;

export const decisionLifecycleScenario: TestScenario = {
  id: "decision-lifecycle",
  title: "Entscheidungs-Lifecycle (active → open → archived)",
  description:
    "Erstellt eine Entscheidung, fügt sich selbst als Teilnehmer hinzu, prüft die Default-Antwortoptionen, archiviert die Entscheidung und liest jedes geschriebene Feld zurück.",
  touches: ["task_decisions", "task_decision_participants", "task_decision_responses"],
  features: ["decisions"],
  writes: [
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "visible_to_all", "priority", "response_deadline", "archived_at", "archived_by"] },
    { table: "task_decision_participants", columns: ["decision_id", "user_id"] },
    { table: "task_decision_responses", columns: ["decision_id", "participant_id", "response_type", "comment"] },
  ],
  steps: [
    {
      id: "dashboard-nudges", label: "Anstupsen: zehn Sekunden und 24-Stunden-Sperre", kind: "logic",
      run: async () => {
        const now = new Date("2026-11-22T12:00:00+01:00");
        const deadline = now.getTime() + DECISION_NUDGE_WINDOW_MS;
        const checks = [
          canNudgeDecision(null, now),
          !canNudgeDecision(now.toISOString(), now),
          !canNudgeDecision(new Date(now.getTime() - 24 * 3600_000 + 1).toISOString(), now),
          canNudgeDecision(new Date(now.getTime() - 24 * 3600_000).toISOString(), now),
          !canNudgeDecision("invalid", now),
          decisionNudgePriority(now.toISOString(), now) > 0,
          decisionNudgePriority(new Date(now.getTime() - 24 * 3600_000).toISOString(), now) === 0,
          decisionNudgePriority(undefined, now) === 0,
          decisionNudgeSecondsRemaining(deadline, now.getTime()) === 10,
          decisionNudgeSecondsRemaining(deadline, deadline - 1) === 1,
          decisionNudgeSecondsRemaining(deadline, deadline) === 0,
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Anstupsregeln bestanden.` };
      },
    },
    {
      id: "dashboard-voting", label: "Dashboard: nur eigene ausstehende Abstimmungen, keine eigenen Anfragen", kind: "logic",
      run: async () => {
        const participant = { status: "open", isCreator: false, isParticipant: true, hasResponded: false };
        const checks = [
          needsOwnDecision(participant),
          !needsOwnDecision({ ...participant, isCreator: true }),
          !needsOwnDecision({ ...participant, isCreator: true }, true),
          !needsOwnDecision({ ...participant, isParticipant: false }),
          !needsOwnDecision({ ...participant, hasResponded: true }),
          needsOwnDecision({ ...participant, hasResponded: true }, true),
          !needsOwnDecision({ ...participant, status: "archived" }, true),
        ];
        return { ok: checks.every(Boolean), message: `${checks.filter(Boolean).length}/${checks.length} Dashboardfilter bestanden.` };
      },
    },
    {
      id: "create",
      label: "Entscheidung anlegen (active)",
      run: async (ctx) => {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 3);
        const payload = {
          title: tag(ctx.runId, "Entscheidung"),
          description: `${SELFTEST_MARKER} Beschreibung`,
          status: "active",
          created_by: ctx.userId,
          tenant_id: ctx.tenantId,
          visible_to_all: false,
          priority: 1,
          response_deadline: deadline.toISOString(),
        };
        const { data, error } = await supabase
          .from("task_decisions")
          .insert(payload)
          .select("id, response_options")
          .single();
        if (error || !data) return { ok: false, message: describeError(error) };
        ctx.trackRecord({ table: "task_decisions", id: data.id });
        ctx.data.decisionId = data.id;
        ctx.data.responseOptions = data.response_options;
        return expectFields("task_decisions", data.id, payload, "Entscheidung");
      },
    },
    {
      id: "add-participant",
      label: "Teilnehmer (sich selbst) hinzufügen",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("task_decision_participants")
          .insert({
            decision_id: ctx.data.decisionId as string,
            user_id: ctx.userId,
          })
          .select("id, token")
          .single();
        if (error || !data) return { ok: false, message: error?.message ?? "Insert leer" };
        ctx.trackRecord({ table: "task_decision_participants", id: data.id });
        ctx.data.participantId = data.id;
        return { ok: true, message: `Teilnehmer angelegt (Token vergeben: ${data.token ? "ja" : "nein"}).` };
      },
    },
    {
      id: "withdraw-responses",
      label: "Ja, Nein und Rückfrage speichern und nachweisbar zurücknehmen",
      kind: "workflow",
      run: async (ctx) => {
        for (const responseType of ["yes", "no", "question"]) {
          const { data: response, error: insertError } = await supabase.from("task_decision_responses")
            .insert({ decision_id: ctx.data.decisionId as string, participant_id: ctx.data.participantId as string,
              response_type: responseType, comment: responseType === "question" ? "Selbsttest-Rückfrage" : null })
            .select("id").single();
          if (insertError || !response) return { ok: false, message: describeError(insertError) };
          ctx.trackRecord({ table: "task_decision_responses", id: response.id });
          const { data: deleted, error: deleteError } = await supabase.from("task_decision_responses")
            .delete().eq("id", response.id).select("id");
          if (deleteError || deleted?.length !== 1) return { ok: false, message: deleteError?.message ?? "Eigene Antwort wurde nicht gelöscht." };
          const { data: remaining, error: readError } = await supabase.from("task_decision_responses")
            .select("id").eq("participant_id", ctx.data.participantId as string).is("parent_response_id", null);
          if (readError || remaining?.length) return { ok: false, message: readError?.message ?? "Antwort bleibt nach Rücknahme bestehen." };
        }
        return { ok: true, message: "Ja, Nein und Rückfrage jeweils erfolgreich zurückgenommen." };
      },
    },
    {
      id: "check-options",
      label: "Default-Antwortoptionen prüfen",
      critical: false,
      run: async (ctx) => {
        const opts = ctx.data.responseOptions as Array<{ key: string }> | null;
        const keys = Array.isArray(opts) ? opts.map((o) => o.key) : [];
        const ok = ["yes", "no", "question"].every((k) => keys.includes(k));
        return {
          ok,
          message: ok ? "Default-Optionen yes/no/question vorhanden." : `Optionen: ${keys.join(", ")}`,
          details: keys,
        };
      },
    },
    {
      id: "set-open",
      label: "Status auf 'open'",
      run: async (ctx) => {
        const { error } = await supabase
          .from("task_decisions")
          .update({ status: "open" })
          .eq("id", ctx.data.decisionId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Status: open" };
      },
    },
    {
      id: "archive",
      label: "Archivieren",
      run: async (ctx) => {
        const { error } = await supabase
          .from("task_decisions")
          .update({
            status: "archived",
            archived_at: new Date().toISOString(),
            archived_by: ctx.userId,
          })
          .eq("id", ctx.data.decisionId as string);
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "Archiviert." };
      },
    },
    {
      id: "verify",
      label: "Verifikation",
      run: async (ctx) => {
        const { data, error } = await supabase
          .from("task_decisions")
          .select("status, archived_at")
          .eq("id", ctx.data.decisionId as string)
          .single();
        if (error) return { ok: false, message: error.message };
        const ok = data?.status === "archived" && !!data?.archived_at;
        return { ok, message: ok ? "Entscheidung archiviert." : `Status: ${data?.status}` };
      },
    },
    {
      id: "nudge-boundary", label: "Fremde oder unbekannte Entscheidung lässt sich nicht anstupsen", kind: "workflow",
      run: async () => {
        const { data, error } = await supabase.rpc("nudge_dashboard_decision", {
          _decision_id: crypto.randomUUID(), _note: "Selbsttest",
        });
        const blocked = !data && error?.code === "42501";
        if (!blocked) return { ok: false, message: "Anstupsen ohne Zugriff auf die Entscheidung war möglich.", details: { data, error } };
        return { ok: true, message: "Anstupsen einer nicht zugänglichen Entscheidung wird mit 42501 verweigert." };
      },
    },
  ],
};
