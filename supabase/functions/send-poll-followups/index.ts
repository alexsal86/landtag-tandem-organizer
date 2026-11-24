// Automatisches Nachfassen bei Teilnehmenden ohne Antwort.
//
// Wird ausschließlich vom Scheduler (pg_cron, Service-Role) aufgerufen. Die
// Entscheidung, ob und wie oft erinnert wird, kommt aus _shared/pollFollowup.ts
// und gilt damit identisch für Selbsttest und Produktion. Der Versand läuft
// über eine Warteschlange (poll_notifications):
//
//  1. get_due_poll_followups liefert ausschließlich tatsächlich fällige
//     Abstimmungen in Fälligkeitsreihenfolge – nicht einfach die ältesten.
//  2. claim_poll_followup übernimmt den Versuch unter Zeilensperre und legt je
//     Teilnehmer genau einen Versandauftrag mit eindeutigem Schlüssel an.
//  3. Offene Aufträge ALLER Versuche dieser Abstimmung werden abgearbeitet.
//     Fehlgeschlagene Aufträge bleiben mit Wiederholungsabstand liegen.
//  4. finalize_poll_followup verbucht den Versuch nur, wenn kein Auftrag mehr
//     offen ist. Eine fehlgeschlagene E-Mail verbraucht damit keinen Versuch.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { escapeHtml } from "../_shared/html.ts";
import {
  POLL_FOLLOWUP_CLAIM_TIMEOUT_MINUTES,
  POLL_FOLLOWUP_DEADLINE_MIN_GAP_HOURS,
  POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS,
  POLL_FOLLOWUP_FIRST_DELAY_HOURS,
  POLL_FOLLOWUP_MAX_ATTEMPTS,
  POLL_FOLLOWUP_MAX_SEND_ATTEMPTS,
  POLL_FOLLOWUP_REPEAT_HOURS,
  decidePollFollowup,
  nextPollFollowupSendAttemptAt,
  selectFollowupRecipients,
} from "../_shared/pollFollowup.ts";
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
const MAX_QUEUE_ROWS_PER_POLL = 500;

interface DuePollRow {
  poll_id: string;
  attempt: number;
  due_at: string;
  open_participants: number;
  open_external: number;
}

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

interface QueueRow {
  id: string;
  participant_id: string;
  attempt: number;
  send_attempts: number | null;
}

interface FinalizeRow {
  counted: boolean;
  pending: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (!requireServiceRole(req)) {
    return forbiddenResponse("Nur der Scheduler darf Nachfass-Erinnerungen versenden.");
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  /**
   * Verbucht den Versuch nur dann, wenn kein wiederholbarer Auftrag offen ist.
   * Der Aufruf läuft auch dann, wenn nichts versendet wurde: er gibt die
   * Versandmarkierung frei, damit der nächste Lauf es erneut versuchen kann.
   */
  const finalizeAttempt = async (pollId: string, attempt: number): Promise<FinalizeRow | null> => {
    const { data, error } = await supabase.rpc("finalize_poll_followup", {
      _poll_id: pollId,
      _attempt: attempt,
      _max_send_attempts: POLL_FOLLOWUP_MAX_SEND_ATTEMPTS,
    });

    if (error) {
      console.error("Could not finalize poll follow-up", error);
      return null;
    }

    const rows = (data ?? []) as FinalizeRow[];
    return rows[0] ?? null;
  };

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

  const { data: dueData, error: dueError } = await supabase.rpc("get_due_poll_followups", {
    _limit: MAX_POLLS_PER_RUN,
    _first_delay_hours: POLL_FOLLOWUP_FIRST_DELAY_HOURS,
    _repeat_hours: POLL_FOLLOWUP_REPEAT_HOURS,
    _max_attempts: POLL_FOLLOWUP_MAX_ATTEMPTS,
    _deadline_window_hours: POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS,
    _min_gap_hours: POLL_FOLLOWUP_DEADLINE_MIN_GAP_HOURS,
    _claim_timeout_minutes: POLL_FOLLOWUP_CLAIM_TIMEOUT_MINUTES,
  });

  if (dueError) throw dueError;
  const duePolls = (dueData ?? []) as DuePollRow[];
  if (duePolls.length === 0) {
    return jsonResponse({
      checked: 0,
      attemptsBooked: 0,
      emailsSent: 0,
      emailsFailed: 0,
      pending: 0,
      blocked: 0,
      results: [],
    });
  }

  const pollIds = duePolls.map((poll) => poll.poll_id);

  const { data: pollData, error: pollsError } = await supabase
    .from("appointment_polls")
    .select("id, title, status, created_at, deadline, tenant_id, followup_count, last_followup_at")
    .in("id", pollIds);
  if (pollsError) throw pollsError;

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

  const { data: slotData, error: slotsError } = await supabase
    .from("poll_time_slots")
    .select("poll_id, end_time")
    .in("poll_id", pollIds);
  if (slotsError) throw slotsError;

  const polls = (pollData ?? []) as PollRow[];
  const participants = (participantData ?? []) as ParticipantRow[];
  const results: Array<Record<string, unknown>> = [];
  let attemptsBooked = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let pendingTotal = 0;
  let blocked = 0;

  for (const poll of polls) {
    const pollParticipants = participants.filter((participant) => participant.poll_id === poll.id);
    const responded = new Set(
      (responseData ?? [])
        .filter((row: { poll_id: string }) => row.poll_id === poll.id)
        .map((row: { participant_id: string }) => row.participant_id),
    );

    // Sind alle Zeitslots vorbei, ist keine Antwort mehr sinnvoll.
    const lastSlotEnd = (slotData ?? [])
      .filter((slot: { poll_id: string }) => slot.poll_id === poll.id)
      .reduce<string | null>((latest, slot: { end_time: string }) => {
        if (!latest) return slot.end_time;
        return Date.parse(slot.end_time) > Date.parse(latest) ? slot.end_time : latest;
      }, null);

    const decision = decidePollFollowup(
      {
        status: poll.status,
        createdAt: poll.created_at,
        deadline: poll.deadline,
        followupCount: poll.followup_count ?? 0,
        lastFollowupAt: poll.last_followup_at,
        participantCount: pollParticipants.length,
        respondingCount: pollParticipants.filter((participant) => responded.has(participant.id)).length,
        lastSlotEnd,
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

    const { data: claim, error: claimError } = await supabase.rpc("claim_poll_followup", {
      _poll_id: poll.id,
      _expected_attempt: poll.followup_count ?? 0,
      _claim_timeout_minutes: POLL_FOLLOWUP_CLAIM_TIMEOUT_MINUTES,
    });

    if (claimError) {
      results.push({ pollId: poll.id, due: true, error: claimError.message });
      continue;
    }
    if (typeof claim !== "number") {
      results.push({ pollId: poll.id, due: false, reason: "Bereits von einem anderen Lauf übernommen" });
      continue;
    }

    // Offene Aufträge aller Versuche – ein früherer Fehlschlag wird erneut
    // versucht, statt für immer liegen zu bleiben.
    const { data: queueData, error: queueError } = await supabase
      .from("poll_notifications")
      .select("id, participant_id, attempt, send_attempts")
      .eq("poll_id", poll.id)
      .eq("notification_type", NOTIFICATION_TYPE)
      .eq("is_sent", false)
      .lt("send_attempts", POLL_FOLLOWUP_MAX_SEND_ATTEMPTS)
      .lte("next_attempt_at", now.toISOString())
      .order("next_attempt_at", { ascending: true })
      .limit(MAX_QUEUE_ROWS_PER_POLL);

    if (queueError) throw queueError;

    const queue = (queueData ?? []) as QueueRow[];
    const queueParticipants = queue
      .map((row) => pollParticipants.find((participant) => participant.id === row.participant_id))
      .filter((participant): participant is ParticipantRow => Boolean(participant));

    const openExternal = queueParticipants.filter(
      (participant) => participant.is_external || !participant.user_id,
    );
    if (openExternal.length > 0 && !linkBaseUrl) {
      // Kein Versand, kein verbuchter Versuch: der Auftrag bleibt offen.
      await finalizeAttempt(poll.id, claim);
      blocked += 1;
      pendingTotal += queue.length;
      results.push({
        pollId: poll.id,
        due: true,
        attempt: claim,
        blocked: "app_base_url_missing",
        openExternal: openExternal.length,
      });
      continue;
    }

    let sent = 0;
    let failed = 0;

    for (const notification of queue) {
      const participant = pollParticipants.find((row) => row.id === notification.participant_id);
      if (!participant) continue;

      const sendAttempts = (notification.send_attempts ?? 0) + 1;

      if (!participant.token) {
        // Ohne Antworttoken ist keine gültige Einladung möglich.
        const { error: tokenError } = await supabase
          .from("poll_notifications")
          .update({
            send_attempts: sendAttempts,
            last_error: "Teilnehmer ohne Antwort-Token",
            next_attempt_at: nextPollFollowupSendAttemptAt(sendAttempts, now).toISOString(),
          })
          .eq("id", notification.id);
        if (tokenError) console.error("Could not record follow-up token error", tokenError);
        failed += 1;
        continue;
      }

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
        const { error: markError } = await supabase
          .from("poll_notifications")
          .update({
            is_sent: true,
            sent_at: new Date().toISOString(),
            send_attempts: sendAttempts,
            last_error: null,
          })
          .eq("id", notification.id);
        if (markError) console.error("Could not mark follow-up notification as sent", markError);
        sent += 1;
      } else {
        console.error("Poll follow-up email failed", emailError);
        const { error: retryError } = await supabase
          .from("poll_notifications")
          .update({
            send_attempts: sendAttempts,
            last_error: String(emailError.message ?? emailError).slice(0, 500),
            next_attempt_at: nextPollFollowupSendAttemptAt(sendAttempts, now).toISOString(),
          })
          .eq("id", notification.id);
        if (retryError) console.error("Could not record follow-up send failure", retryError);
        failed += 1;
      }
    }

    const finalized = await finalizeAttempt(poll.id, claim);
    if (finalized?.counted) attemptsBooked += 1;
    pendingTotal += finalized?.pending ?? 0;
    emailsSent += sent;
    emailsFailed += failed;

    results.push({
      pollId: poll.id,
      due: true,
      attempt: claim,
      openRecipients: recipients.length,
      queued: queue.length,
      emailed: sent,
      failed,
      pending: finalized?.pending ?? 0,
      counted: finalized?.counted ?? false,
    });
  }

  return jsonResponse(
    {
      checked: duePolls.length,
      attemptsBooked,
      emailsSent,
      emailsFailed,
      pending: pendingTotal,
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
