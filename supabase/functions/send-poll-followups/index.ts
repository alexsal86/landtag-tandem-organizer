// Automatisches Nachfassen bei Teilnehmenden ohne Antwort.
//
// Wird ausschließlich vom Scheduler (pg_cron, Service-Role) aufgerufen. Die
// Entscheidung, ob und wie oft erinnert wird, kommt aus _shared/pollFollowup.ts
// und gilt damit identisch für Selbsttest und Produktion. Der Zustand
// (followup_count/last_followup_at) wird atomar über record_poll_followup
// verbucht, damit parallele Läufe keine doppelten Erinnerungen versenden.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { escapeHtml } from "../_shared/html.ts";
import { decidePollFollowup, selectFollowupRecipients } from "../_shared/pollFollowup.ts";
import {
  forbiddenResponse,
  jsonResponse,
  requireServiceRole,
  withSafeHandler,
} from "../_shared/security.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { resolveAppBaseUrl } from "../_shared/url.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const NOTIFICATION_TYPE = "answer_followup";
const MAX_POLLS_PER_RUN = 100;

interface PollRow {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  deadline: string | null;
  tenant_id: string | null;
  followup_count: number | null;
  last_followup_at: string | null;
}

interface ParticipantRow {
  id: string;
  poll_id: string;
  email: string;
  user_id: string | null;
  is_external: boolean;
  token: string | null;
}

interface NotificationRow {
  id: string;
  participant_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse("Nur der Scheduler darf Nachfass-Erinnerungen versenden.");
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  // Cron-Aufrufe haben keinen Origin. Fällt die Basis-URL auf das Supabase-Host
  // zurück, wären die Antwortlinks ungültig: dann keine externen Mails und keine
  // verbuchten Erinnerungsversuche, bis PUBLIC_APP_URL gesetzt ist.
  const hostOf = (value: string) => {
    try {
      return new URL(value).host;
    } catch {
      return "";
    }
  };
  const baseUrl = resolveAppBaseUrl(req);
  const supabaseHost = hostOf(Deno.env.get("SUPABASE_URL") ?? "");
  const linkBaseUrl = baseUrl && hostOf(baseUrl) !== supabaseHost ? baseUrl : "";

  const { data: polls, error: pollsError } = await supabase
    .from("appointment_polls")
    .select("id, title, status, created_at, deadline, tenant_id, followup_count, last_followup_at")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(MAX_POLLS_PER_RUN);

  if (pollsError) throw pollsError;
  if (!polls || polls.length === 0) {
    return jsonResponse({ checked: 0, dispatched: 0, results: [] });
  }

  const pollIds = polls.map((poll: PollRow) => poll.id);

  const { data: participantData, error: participantsError } = await supabase
    .from("poll_participants")
    .select("id, poll_id, email, user_id, is_external, token")
    .in("poll_id", pollIds);
  if (participantsError) throw participantsError;

  const { data: responseData, error: responsesError } = await supabase
    .from("poll_responses")
    .select("poll_id, participant_id")
    .in("poll_id", pollIds);
  if (responsesError) throw responsesError;

  const participants = (participantData ?? []) as ParticipantRow[];
  const results: Array<Record<string, unknown>> = [];
  let dispatched = 0;
  let blocked = 0;

  for (const poll of polls as PollRow[]) {
    const pollParticipants = participants.filter((participant) => participant.poll_id === poll.id);
    const responded = new Set(
      (responseData ?? [])
        .filter((row: { poll_id: string }) => row.poll_id === poll.id)
        .map((row: { participant_id: string }) => row.participant_id),
    );

    const decision = decidePollFollowup(
      {
        status: poll.status,
        createdAt: poll.created_at,
        deadline: poll.deadline,
        followupCount: poll.followup_count ?? 0,
        lastFollowupAt: poll.last_followup_at,
        participantCount: pollParticipants.length,
        respondingCount: pollParticipants.filter((participant) => responded.has(participant.id)).length,
      },
      now,
    );

    if (!decision.due) {
      results.push({ pollId: poll.id, due: false, reason: decision.reason });
      continue;
    }

    const recipients = selectFollowupRecipients(
      pollParticipants.map((participant) => ({
        id: participant.id,
        email: participant.email,
        hasResponded: responded.has(participant.id),
      })),
    );
    if (recipients.length === 0) {
      results.push({ pollId: poll.id, due: false, reason: "Keine offenen Antworten" });
      continue;
    }

    const openExternal = pollParticipants.filter(
      (participant) =>
        recipients.some((recipient) => recipient.id === participant.id) &&
        (participant.is_external || !participant.user_id),
    );
    if (openExternal.length > 0 && !linkBaseUrl) {
      blocked += 1;
      results.push({ pollId: poll.id, due: true, blocked: "app_base_url_missing", openExternal: openExternal.length });
      continue;
    }

    const { data: attempt, error: claimError } = await supabase.rpc("record_poll_followup", {
      _poll_id: poll.id,
      _expected_attempt: poll.followup_count ?? 0,
    });

    if (claimError) {
      results.push({ pollId: poll.id, due: true, error: claimError.message });
      continue;
    }
    if (typeof attempt !== "number") {
      results.push({ pollId: poll.id, due: false, reason: "Bereits von einem anderen Lauf verbucht" });
      continue;
    }

    const { data: pending, error: pendingError } = await supabase
      .from("poll_notifications")
      .select("id, participant_id")
      .eq("poll_id", poll.id)
      .eq("notification_type", NOTIFICATION_TYPE)
      .eq("attempt", attempt)
      .eq("is_sent", false);

    if (pendingError) throw pendingError;

    const sentIds: string[] = [];
    for (const notification of (pending ?? []) as NotificationRow[]) {
      const participant = pollParticipants.find((row) => row.id === notification.participant_id);
      if (!participant?.token || !linkBaseUrl) continue;

      const pollUrl = `${linkBaseUrl}/poll-guest/${poll.id}?token=${participant.token}`;
      const deadlineHint = poll.deadline
        ? `<p style="color:#666;font-size:16px;">Bitte antworten Sie bis ${escapeHtml(
            new Date(poll.deadline).toLocaleDateString("de-DE"),
          )}.</p>`
        : "";

      const { error: emailError } = await resend.emails.send({
        from: "Terminabstimmung <noreply@alexander-salomon.de>",
        to: [participant.email],
        subject: `Erinnerung: Terminabstimmung: ${poll.title ?? "Terminabstimmung"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333; font-size: 24px;">Erinnerung: Terminabstimmung</h1>
            <p style="color: #666; font-size: 16px;">Hallo,</p>
            <p style="color: #666; font-size: 16px;">
              Ihre Verfügbarkeit für die Terminabstimmung
              &quot;<strong>${escapeHtml(poll.title ?? "Terminabstimmung")}</strong>&quot; fehlt noch.
            </p>
            ${deadlineHint}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${pollUrl}"
                 style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Jetzt Verfügbarkeit mitteilen
              </a>
            </div>
            <p style="color: #999; font-size: 14px;">
              Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
              <a href="${pollUrl}" style="color: #3b82f6;">${pollUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.
            </p>
          </div>
        `,
      });

      if (!emailError) {
        sentIds.push(notification.id);
      } else {
        console.error("Poll follow-up email failed", emailError);
      }
    }

    if (sentIds.length > 0) {
      const { error: markError } = await supabase
        .from("poll_notifications")
        .update({ is_sent: true, sent_at: new Date().toISOString() })
        .in("id", sentIds);
      if (markError) console.error("Could not mark follow-up notifications as sent", markError);
    }

    dispatched += 1;
    results.push({
      pollId: poll.id,
      due: true,
      attempt,
      openRecipients: recipients.length,
      emailed: sentIds.length,
    });
  }

  return jsonResponse(
    {
      checked: polls.length,
      dispatched,
      blocked,
      ...(blocked > 0
        ? {
            error:
              "PUBLIC_APP_URL (oder APP_URL) fehlt oder zeigt auf das Supabase-Host; externe Erinnerungen wurden nicht versendet.",
          }
        : {}),
      results,
    },
    blocked > 0 ? 500 : 200,
  );
};

serve(withSafeHandler("send-poll-followups", handler));
