import { canNudgeDecision, DECISION_NUDGE_WINDOW_MS, decisionNudgePriority, decisionNudgeSecondsRemaining, decisionNudgeSummary } from "@/features/decisions/dashboardNudges";
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
  touches: [
    "task_decisions",
    "task_decision_participants",
    "task_decision_responses",
    "task_decision_response_history",
    "task_decision_vote_effects",
    "tasks",
    "task_decision_attachments",
    "task_decision_comments",
    "task_decision_comment_reactions",
    "dashboard_decision_nudges",
    "notifications",
  ],
  features: ["decisions"],
  checks: [
    "Ja, Nein und Rückfrage werden gespeichert und nachweisbar zurückgenommen",
    "Die Rücknahme eines Votums an einer verknüpften Aufgabe gibt Ball und nächsten Schritt zurück und entfernt den Votum-Eintrag",
    "Eine geänderte Antwort schreibt den bisherigen und den neuen Stand in task_decision_response_history",
    "Anhang-Metadaten hängen an der Entscheidung, sind für Teilnehmende lesbar und wieder entfernbar (ohne Datei-Upload)",
    "Kommentar und Antwort werden gespeichert; Emoji-Reaktionen folgen der Allowlist, sind je Person eindeutig und wieder entfernbar",
    "Das Anmahnen speichert den Eintrag mit Absender und Notiz und weist die zweite Mahnung innerhalb von 24 Stunden ab",
    "Anstupsen ist auf die eigene offene Entscheidung beschränkt; ohne wartenden Abgeordneten wird abgewiesen",
    "Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und Abschlussmeldung entstehen im Mandanten der Entscheidung",
    "Teilnehmer-Insert stellt genau eine Einladungs-Versandzeile ein, die der Worker übernimmt und verbucht",
  ],
  limitations: [
    "Der Erfolgspfad des Anmahmens läuft über decision_nudge_selftest und wird vollständig zurückgerollt. Er ist nur prüfbar, wenn das Büro ein zweites aktives Abgeordnetenkonto hat und das angemeldete Konto anmahnen darf; sonst belegt der Schritt ausdrücklich nur die Abweisung.",
    "Die Zustellung der Anstups-Benachrichtigung an den Abgeordneten wird nicht geprüft: Sie entsteht im zurückgerollten Prüfpfad und rollt mit zurück.",
  ],
  writes: [
    { table: "task_decisions", columns: ["title", "description", "status", "created_by", "tenant_id", "visible_to_all", "priority", "response_deadline", "archived_at", "archived_by"] },
    { table: "task_decision_participants", columns: ["decision_id", "user_id"] },
    { table: "task_decision_responses", columns: ["decision_id", "participant_id", "response_type", "comment"] },
    { table: "task_decision_response_history", columns: ["response_id", "decision_id", "participant_id", "response_type", "comment", "changed_by"] },
    { table: "tasks", columns: ["title", "description", "status", "priority", "user_id", "tenant_id", "ball_owner", "ball_assignee_id", "next_action", "timeline"] },
    { table: "task_decision_attachments", columns: ["decision_id", "file_name", "file_path", "file_size", "file_type", "uploaded_by"] },
    { table: "task_decision_comments", columns: ["decision_id", "user_id", "parent_id", "content"] },
    { table: "task_decision_comment_reactions", columns: ["comment_id", "user_id", "emoji"] },
    { table: "dashboard_decision_nudges", columns: ["decision_id", "tenant_id", "nudged_by", "note"] },
    { table: "notifications", columns: ["tenant_id", "user_id", "notification_type_id", "title", "message", "data", "priority", "is_read"] },
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
          decisionNudgeSummary("Anna", 1, now.toISOString()).startsWith("Angestupst von Anna · heute"),
          decisionNudgeSummary("Anna", 3, now.toISOString()).includes("von Anna · 3×"),
          decisionNudgeSummary(null, 0, now.toISOString()).startsWith("Angestupst · heute"),
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
          const withdrawn = await supabase.rpc("withdraw_decision_response", {
            _decision_id: ctx.data.decisionId as string, _participant_id: ctx.data.participantId as string,
          });
          if (withdrawn.error) return { ok: false, message: describeError(withdrawn.error) };
          const { data: remaining, error: readError } = await supabase.from("task_decision_responses")
            .select("id").eq("participant_id", ctx.data.participantId as string).is("parent_response_id", null);
          if (readError || remaining?.length) return { ok: false, message: readError?.message ?? "Antwort bleibt nach Rücknahme bestehen." };
        }
        return { ok: true, message: "Ja, Nein und Rückfrage jeweils erfolgreich zurückgenommen." };
      },
    },
    {
      id: "withdraw-task-vote",
      label: "Rücknahme eines Votums an einer verknüpften Aufgabe",
      kind: "workflow",
      run: async (ctx) => {
        const task = await supabase.from("tasks").insert({
          title: `${SELFTEST_PREFIX} Rücknahme (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "todo",
          priority: "medium",
          user_id: ctx.userId,
          tenant_id: ctx.tenantId,
          ball_owner: "deputy",
          ball_assignee_id: ctx.userId,
          next_action: "Rückmeldung prüfen",
        }).select("id").single();
        if (task.error || !task.data) return { ok: false, message: describeError(task.error) };
        ctx.trackRecord({ table: "tasks", id: task.data.id });

        const linked = await supabase.from("task_decisions").insert({
          title: `${SELFTEST_PREFIX} Verknüpfte Rücknahme (${ctx.runId})`,
          description: SELFTEST_MARKER,
          status: "active",
          created_by: ctx.userId,
          tenant_id: ctx.tenantId,
          task_id: task.data.id,
          visible_to_all: false,
        }).select("id").single();
        if (linked.error || !linked.data) return { ok: false, message: describeError(linked.error) };
        ctx.trackRecord({ table: "task_decisions", id: linked.data.id });
        const participant = await supabase.from("task_decision_participants")
          .insert({ decision_id: linked.data.id, user_id: ctx.userId }).select("id").single();
        if (participant.error || !participant.data) return { ok: false, message: describeError(participant.error) };
        ctx.trackRecord({ table: "task_decision_participants", id: participant.data.id });

        const response = await supabase.from("task_decision_responses")
          .insert({ decision_id: linked.data.id, participant_id: participant.data.id, response_type: "yes", comment: SELFTEST_MARKER })
          .select("id").single();
        if (response.error || !response.data) return { ok: false, message: describeError(response.error) };
        const voted = await supabase.from("tasks")
          .select("ball_owner,next_action,timeline").eq("id", task.data.id).single();

        const withdrawal = await supabase.rpc("withdraw_decision_response", {
          _decision_id: linked.data.id, _participant_id: participant.data.id,
        });
        if (withdrawal.error) return { ok: false, message: describeError(withdrawal.error) };
        const report = withdrawal.data as { status?: string } | null;
        const restored = await supabase.from("tasks")
          .select("ball_owner,ball_assignee_id,next_action,timeline").eq("id", task.data.id).single();
        const remaining = await supabase.from("task_decision_responses")
          .select("id").eq("participant_id", participant.data.id);
        const timelineTexts = (raw: unknown) => Array.isArray(raw)
          ? raw.map((entry) => String((entry as { text?: unknown }).text ?? ""))
          : [];

        const checks = {
          voteReturnedBall: !voted.error && voted.data?.ball_owner === "office" && voted.data?.next_action === "Freigabe umsetzen",
          rpcRestored: report?.status === "restored",
          taskRestored: !restored.error && restored.data?.ball_owner === "deputy"
            && restored.data?.ball_assignee_id === ctx.userId && restored.data?.next_action === "Rückmeldung prüfen",
          voteNoteGone: !restored.error && !timelineTexts(restored.data?.timeline).some((text) => text.includes("Verknüpfte Rücknahme")),
          responseGone: !remaining.error && (remaining.data ?? []).length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Rücknahme des Votums gibt Ball und nächsten Schritt an die Abgeordnete zurück, entfernt den Votum-Eintrag und lässt keine Antwort stehen."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, report, voted: voted.data, restored: restored.data },
        };
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
      id: "change-vote-history", label: "Antwort ändern und den bisherigen Stand im Verlauf behalten", kind: "workflow",
      run: async (ctx) => {
        const decisionId = ctx.data.decisionId as string;
        const participantId = ctx.data.participantId as string;
        const first = await supabase.from("task_decision_responses")
          .insert({ decision_id: decisionId, participant_id: participantId, response_type: "yes", comment: "Erste Antwort" })
          .select("id")
          .single();
        if (first.error || !first.data) return { ok: false, message: describeError(first.error) };
        ctx.trackRecord({ table: "task_decision_responses", id: first.data.id });

        const changed = await supabase.from("task_decision_responses")
          .update({ response_type: "no", comment: "Nach Rückfrage geändert" })
          .eq("id", first.data.id)
          .select("response_type,comment")
          .single();
        if (changed.error || !changed.data) return { ok: false, message: describeError(changed.error) };

        const history = await supabase.from("task_decision_response_history")
          .select("response_type,changed_by")
          .eq("response_id", first.data.id)
          .order("created_at");
        if (history.error) return { ok: false, message: describeError(history.error) };
        const rows = history.data ?? [];
        const checks = {
          answerChanged: changed.data.response_type === "no" && changed.data.comment === "Nach Rückfrage geändert",
          firstAnswerLogged: rows.some((row) => row.response_type === "yes"),
          changeLogged: rows.some((row) => row.response_type === "no"),
          appendOnly: rows.length === 2 && rows.every((row) => row.changed_by === ctx.userId),
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Antwort ist geändert; der Verlauf hält beide Stände unveränderlich fest."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, rows: rows.length },
        };
      },
    },
    {
      id: "decision-attachments", label: "Anhang-Metadaten an die Entscheidung hängen, lesen und entfernen", kind: "workflow",
      run: async (ctx) => {
        const decisionId = ctx.data.decisionId as string;
        const attachment = await supabase.from("task_decision_attachments")
          .insert({
            decision_id: decisionId, file_name: "selbsttest-anlage.txt",
            file_path: `selftest/${ctx.runId}/anlage.txt`, file_size: 42, file_type: "text/plain",
            uploaded_by: ctx.userId,
          })
          .select("id,file_name,file_size")
          .single();
        if (attachment.error || !attachment.data) return { ok: false, message: describeError(attachment.error) };
        ctx.trackRecord({ table: "task_decision_attachments", id: attachment.data.id });

        const read = await supabase.from("task_decision_attachments")
          .select("file_path,uploaded_by").eq("id", attachment.data.id).single();
        const removed = await supabase.from("task_decision_attachments")
          .delete().eq("id", attachment.data.id).select("id");
        const after = await supabase.from("task_decision_attachments")
          .select("id").eq("decision_id", decisionId);
        const checks = {
          stored: attachment.data.file_name === "selbsttest-anlage.txt" && attachment.data.file_size === 42,
          readable: !read.error && read.data?.uploaded_by === ctx.userId
            && read.data?.file_path === `selftest/${ctx.runId}/anlage.txt`,
          removed: !removed.error && removed.data?.length === 1 && !after.error && (after.data ?? []).length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Die Anhang-Metadaten sind der Entscheidung zugeordnet, für Teilnehmende lesbar und wieder entfernt; eine Datei wurde nicht übertragen."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: checks,
        };
      },
    },
    {
      id: "comments-and-reactions", label: "Kommentar, Antwort und Emoji-Reaktion speichern und entfernen", kind: "workflow",
      run: async (ctx) => {
        const decisionId = ctx.data.decisionId as string;
        const comment = await supabase.from("task_decision_comments")
          .insert({ decision_id: decisionId, user_id: ctx.userId, content: `${SELFTEST_MARKER} Bitte Frist prüfen.` })
          .select("id,parent_id")
          .single();
        if (comment.error || !comment.data) return { ok: false, message: describeError(comment.error) };
        ctx.trackRecord({ table: "task_decision_comments", id: comment.data.id });

        const reply = await supabase.from("task_decision_comments")
          .insert({ decision_id: decisionId, user_id: ctx.userId, parent_id: comment.data.id, content: `${SELFTEST_MARKER} Frist ist gesetzt.` })
          .select("id,parent_id")
          .single();
        if (reply.error || !reply.data) return { ok: false, message: describeError(reply.error) };
        ctx.trackRecord({ table: "task_decision_comments", id: reply.data.id });

        const reaction = await supabase.from("task_decision_comment_reactions")
          .insert({ comment_id: comment.data.id, user_id: ctx.userId, emoji: "👍" })
          .select("id")
          .single();
        if (reaction.error || !reaction.data) return { ok: false, message: describeError(reaction.error) };
        ctx.trackRecord({ table: "task_decision_comment_reactions", id: reaction.data.id });

        const duplicate = await supabase.from("task_decision_comment_reactions")
          .insert({ comment_id: comment.data.id, user_id: ctx.userId, emoji: "👍" });
        const notAllowed = await supabase.from("task_decision_comment_reactions")
          .insert({ comment_id: comment.data.id, user_id: ctx.userId, emoji: "😀" });
        const visible = await supabase.from("task_decision_comment_reactions")
          .select("emoji").eq("comment_id", comment.data.id);

        const reactionRemoved = await supabase.from("task_decision_comment_reactions")
          .delete().eq("id", reaction.data.id).select("id");
        const reactionsAfter = await supabase.from("task_decision_comment_reactions")
          .select("id").eq("comment_id", comment.data.id);
        const replyRemoved = await supabase.from("task_decision_comments")
          .delete().eq("id", reply.data.id).select("id");
        const commentRemoved = await supabase.from("task_decision_comments")
          .delete().eq("id", comment.data.id).select("id");
        const commentsAfter = await supabase.from("task_decision_comments")
          .select("id").eq("decision_id", decisionId);

        const checks = {
          commentStored: !comment.error && comment.data.parent_id === null,
          replyStored: reply.data.parent_id === comment.data.id,
          reactionStored: !visible.error && visible.data?.length === 1 && visible.data[0].emoji === "👍",
          duplicateReactionBlocked: duplicate.error?.code === "23505",
          emojiAllowlistEnforced: notAllowed.error?.code === "23514",
          reactionRemoved: !reactionRemoved.error && reactionRemoved.data?.length === 1
            && !reactionsAfter.error && (reactionsAfter.data ?? []).length === 0,
          commentsRemoved: !replyRemoved.error && replyRemoved.data?.length === 1
            && !commentRemoved.error && commentRemoved.data?.length === 1
            && !commentsAfter.error && (commentsAfter.data ?? []).length === 0,
        };
        const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        return {
          ok: failed.length === 0,
          message: failed.length === 0
            ? "Kommentar und Antwort sind gespeichert; Reaktionen folgen der Emoji-Allowlist, sind je Person eindeutig und wieder entfernbar."
            : `Fehlgeschlagen: ${failed.join(", ")}`,
          details: { ...checks, codes: { duplicate: duplicate.error?.code, emoji: notAllowed.error?.code } },
        };
      },
    },
    {
      id: "notifications", label: "Meldungen entstehen im Mandanten der Entscheidung", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_notification_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const result = data as { ok: boolean; skipped?: string; delivered?: Record<string, number>; message?: string };
        if (!result?.ok) return { ok: false, message: result?.message ?? "Selbsttest fehlgeschlagen" };

        // Meldungen aus den Triggern dieses Laufs gehören dem angemeldeten Konto und
        // werden wie die übrigen Testdaten aufgeräumt.
        const { data: created } = await supabase
          .from("notifications")
          .select("id")
          .eq("tenant_id", ctx.tenantId)
          .filter("data->>decision_id", "eq", ctx.data.decisionId as string);
        for (const row of created ?? []) {
          ctx.trackRecord({ table: "notifications", id: row.id });
        }

        return {
          ok: true,
          message: result.skipped ?? `Anfrage, Kommentar, Reaktion, Ersteller-Antwort und Abschluss wurden im Mandanten der Entscheidung zugestellt (${JSON.stringify(result.delivered)}).`,
          details: result.delivered,
        };
      },
    },
    {
      id: "invitation-dispatch", label: "Einladungsversand wird serverseitig eingestellt und übernommen", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_invitation_dispatch_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Der Teilnehmer-Insert stellt eine Versandzeile ein, der Worker übernimmt sie und verbucht den Versand."
            : (report?.message ?? "Einladungs-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "lifecycle-notifications", label: "Frist, Rückzug, Ergebnis und direkte Antwort melden", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_lifecycle_notification_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Friständerung, früher Rückzug, Ergebnis an Teilnehmende, gezielte Antwort und visible_to_all-Anfrage wurden zugestellt."
            : (report?.skipped ?? report?.message ?? "Lebenszyklus-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "delivery-preferences", label: "Persönliche Zustellfrequenz und Ruhezeiten respektieren", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_delivery_preference_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Gebündelt erzeugt einen Digest, aus unterdrückt unkritische Meldungen, Ruhezeiten blockieren den Push und Friständerungen gehen weiterhin sofort durch."
            : (report?.skipped ?? report?.message ?? "Zustellfrequenz-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "digest-items", label: "Digest zeigt Einzelmeldungen mit Person und Sprungziel", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_digest_items_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Der Digest enthält Kommentar, Reaktion und Ergebnis mit Person, Kommentar-ID und Entscheidungsziel."
            : (report?.skipped ?? report?.message ?? "Digest-Inhalts-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "comment-mentions", label: "Direkte Erwähnungen sofort und außerhalb des Digests zustellen", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_mention_notification_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Erwähnungen erreichen die Person auch bei aus, erzeugen keine doppelte Kommentarmeldung und landen nicht im Digest."
            : (report?.skipped ?? report?.message ?? "Erwähnungs-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "deadline-reminders", label: "Frist-Erinnerungen 24 h/2 h einmalig und mit Ruhezeiten", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_deadline_reminder_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "24-h- und 2-h-Erinnerung kommen je einmal, Ruhezeiten verschieben den Versand und verhindern keine Erinnerung dauerhaft."
            : (report?.skipped ?? report?.message ?? "Frist-Erinnerungs-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "inbox-hygiene", label: "Anfrage-Meldungen beim Öffnen lesen und beim Archivieren verfallen lassen", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_inbox_hygiene_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Öffnen markiert die Anfrage als gelesen; Archivieren lässt offene Meldungen verfallen, die Rückzugsmeldung bleibt ungelesen."
            : (report?.skipped ?? report?.message ?? "Inbox-Hygiene-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "notification-metrics", label: "Zustellungen, Abschaltquote, Antwortzeit, Anstupser und Trigger-Fehler messen", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_notification_metrics_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Die Kennzahlen liefern Kanalzustellungen, Abschaltquoten, Antwortzeit, Anstupser-Wirkung; ein protokollierter Trigger-Fehler erhöht die Fehlerquote und setzt den Alarm."
            : (report?.message ?? "Kennzahlen-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "notification-actions", label: "Aus der Meldung abstimmen und Antwort aktualisieren", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_notification_actions_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Antwort aus der Meldung wurde gespeichert, eine zweite Antwort aktualisiert dieselbe Zeile; ungültige Typen und fremde Entscheidungen werden abgewiesen."
            : (report?.message ?? "Aktions-Selbsttest fehlgeschlagen."),
          details: report?.checks,
        };
      },
    },
    {
      id: "digest", label: "Meldungen werden gebündelt und nur der Digest wird gepusht", kind: "workflow",
      run: async (ctx) => {
        const { data, error } = await supabase.rpc("decision_digest_selftest", { p_tenant: ctx.tenantId });
        if (error) return { ok: false, message: describeError(error) };
        const report = data as { ok?: boolean; message?: string; skipped?: string; checks?: Record<string, unknown> } | null;
        return {
          ok: report?.ok === true,
          message: report?.ok === true
            ? "Offene Kommentar- und Reaktionsmeldungen wurden zu einem Digest gebündelt, die Einzelmeldungen als ersetzt markiert und das Reaktionsfenster aus der Mandanteneinstellung gelesen."
            : (report?.skipped ?? report?.message ?? "Digest-Selbsttest fehlgeschlagen."),
          details: report?.checks,
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
    {
      id: "nudge-open-decision", label: "Offene Entscheidung anmahnen: Eintrag, Meldung und 24-Stunden-Sperre", kind: "workflow",
      run: async (ctx) => {
        const response = await supabase.rpc("decision_nudge_selftest", { p_tenant: ctx.tenantId });
        if (response.error) return { ok: false, message: describeError(response.error) };
        const report = response.data && typeof response.data === "object" && !Array.isArray(response.data)
          ? response.data as { ok?: boolean; mode?: string; message?: string; checks?: Record<string, unknown> }
          : null;
        if (!report) return { ok: false, message: "Der Server-Selbsttest liefert kein Ergebnis." };
        const details = report.checks ?? {};
        if (report.mode === "role_denied") {
          return {
            ok: report.ok === true,
            message: "Diese Rolle darf nicht anmahnen; die Abweisung ist geprüft. Der Erfolgspfad bleibt offen.",
            details,
          };
        }
        if (report.mode === "no_deputy") {
          return {
            ok: report.ok === true,
            message: "Ohne zweites Abgeordnetenkonto im Büro ist nur die Abweisung prüfbar; der Erfolgspfad bleibt offen.",
            details,
          };
        }
        return {
          ok: report.ok === true,
          message: report.ok === true
            ? (details.notification_suppressed_by_settings === true
              ? "Der echte Anstups-RPC hat gespeichert und die zweite Mahnung innerhalb von 24 Stunden abgewiesen; die Meldung ist für diese Person abgeschaltet. Alle Schreibzugriffe wurden zurückgerollt."
              : "Der echte Anstups-RPC hat gespeichert, die Meldung im Mandanten der Entscheidung zugestellt und die zweite Mahnung innerhalb von 24 Stunden abgewiesen; alle Schreibzugriffe wurden zurückgerollt.")
            : `Anmahnen fehlgeschlagen: ${report.message ?? "unbekannter Grund"}`,
          details,
        };
      },
    },
  ],
};
