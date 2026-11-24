/**
 * Regeln für das automatische Nachfassen bei Teilnehmenden ohne Antwort.
 *
 * Eine Terminabstimmung erinnert nur solange sie aktiv ist, noch Antworten
 * fehlen und die Frist nicht abgelaufen ist. Die erste Erinnerung geht frühestens
 * 24 Stunden nach Erstellung raus, jede weitere 48 Stunden nach der letzten,
 * höchstens zweimal. Die Regel wird von der Edge Function
 * send-poll-followups und vom Selbsttest genutzt.
 */

export const POLL_FOLLOWUP_FIRST_DELAY_HOURS = 24;
export const POLL_FOLLOWUP_REPEAT_HOURS = 48;
export const POLL_FOLLOWUP_MAX_ATTEMPTS = 2;

const HOUR_MS = 3_600_000;

export interface PollFollowupState {
  status: string;
  createdAt: string;
  deadline?: string | null;
  followupCount: number;
  lastFollowupAt?: string | null;
  participantCount: number;
  respondingCount: number;
}

export interface PollFollowupDecision {
  due: boolean;
  /** Nummer der Erinnerung, die jetzt versendet würde (1-basiert). */
  attempt: number;
  reason: string;
}

export interface PollFollowupParticipant {
  id: string;
  email: string;
  hasResponded: boolean;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Entscheidet, ob für diese Abstimmung jetzt nachgefasst werden soll. */
export function decidePollFollowup(state: PollFollowupState, now: Date = new Date()): PollFollowupDecision {
  const attempts = Math.max(0, Math.trunc(state.followupCount ?? 0));
  const participantCount = Math.max(0, Math.trunc(state.participantCount ?? 0));
  const respondingCount = Math.max(0, Math.trunc(state.respondingCount ?? 0));

  if (state.status !== "active") {
    return { due: false, attempt: attempts, reason: "Abstimmung ist nicht mehr aktiv" };
  }
  if (participantCount === 0) {
    return { due: false, attempt: attempts, reason: "Keine Teilnehmer eingeladen" };
  }
  if (respondingCount >= participantCount) {
    return { due: false, attempt: attempts, reason: "Alle Teilnehmer haben geantwortet" };
  }
  if (attempts >= POLL_FOLLOWUP_MAX_ATTEMPTS) {
    return { due: false, attempt: attempts, reason: "Nachfass-Limit erreicht" };
  }

  const nowMs = now.getTime();
  const deadlineMs = parseTimestamp(state.deadline);
  if (deadlineMs !== null && deadlineMs <= nowMs) {
    return { due: false, attempt: attempts, reason: "Antwortfrist ist abgelaufen" };
  }

  const createdAtMs = parseTimestamp(state.createdAt);
  if (createdAtMs === null) {
    return { due: false, attempt: attempts, reason: "Erstellungszeitpunkt unbekannt" };
  }

  const referenceMs = attempts === 0 ? createdAtMs : parseTimestamp(state.lastFollowupAt) ?? createdAtMs;
  const delayHours = attempts === 0 ? POLL_FOLLOWUP_FIRST_DELAY_HOURS : POLL_FOLLOWUP_REPEAT_HOURS;
  const dueAtMs = referenceMs + delayHours * HOUR_MS;

  if (nowMs < dueAtMs) {
    return {
      due: false,
      attempt: attempts,
      reason: `Nächste Erinnerung erst ${new Date(dueAtMs).toISOString()}`,
    };
  }

  return {
    due: true,
    attempt: attempts + 1,
    reason: attempts === 0
      ? `Erste Erinnerung nach ${POLL_FOLLOWUP_FIRST_DELAY_HOURS} Stunden`
      : `Erneute Erinnerung nach ${POLL_FOLLOWUP_REPEAT_HOURS} Stunden`,
  };
}

/** Teilnehmende, die noch keine Antwort abgegeben haben (mit gültiger Adresse). */
export function selectFollowupRecipients(
  participants: readonly PollFollowupParticipant[],
): PollFollowupParticipant[] {
  return participants.filter(
    (participant) => !participant.hasResponded && (participant.email ?? "").trim() !== "",
  );
}
