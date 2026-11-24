/**
 * Regeln für das automatische Nachfassen bei Teilnehmenden ohne Antwort.
 *
 * Eine Terminabstimmung erinnert nur solange sie aktiv ist, noch Antworten
 * fehlen, die Frist nicht abgelaufen ist und noch kein Zeitslot vorbei ist. Die
 * erste Erinnerung geht frühestens 24 Stunden nach Erstellung raus, jede weitere
 * 48 Stunden nach der letzten, höchstens zweimal. Läuft die Frist in weniger als
 * 24 Stunden ab, wird zusätzlich einmalig erinnert (mindestens 12 Stunden
 * Abstand zur letzten Erinnerung). Die Regel wird von der Edge Function
 * send-poll-followups und vom Selbsttest genutzt.
 *
 * Der Versand selbst läuft über eine Warteschlange: Jeder Erinnerungsversuch
 * erzeugt je Teilnehmer genau einen Auftrag mit eindeutigem Versandschlüssel.
 * Erst wenn kein Auftrag dieses Versuchs mehr offen ist, gilt der Versuch als
 * verbucht. Fehlgeschlagene Aufträge werden mit wachsendem Abstand erneut
 * versucht, damit ein einzelner Fehler keine Erinnerung verbraucht.
 */

export const POLL_FOLLOWUP_FIRST_DELAY_HOURS = 24;
export const POLL_FOLLOWUP_REPEAT_HOURS = 48;
export const POLL_FOLLOWUP_MAX_ATTEMPTS = 2;
export const POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS = 24;
export const POLL_FOLLOWUP_DEADLINE_MIN_GAP_HOURS = 12;

/** Maximale Zustellversuche je Versandauftrag (inklusive Erstversuch). */
export const POLL_FOLLOWUP_MAX_SEND_ATTEMPTS = 3;
/** Wartezeit nach dem ersten fehlgeschlagenen Versand. */
export const POLL_FOLLOWUP_RETRY_BASE_MINUTES = 15;
/** Obergrenze für den Wiederholungsabstand. */
export const POLL_FOLLOWUP_RETRY_MAX_MINUTES = 120;
/** Nach dieser Zeit gilt ein laufender Versand als abgebrochen und darf neu starten. */
export const POLL_FOLLOWUP_CLAIM_TIMEOUT_MINUTES = 15;

const HOUR_MS = 3_600_000;

export interface PollFollowupState {
  status: string;
  createdAt: string;
  deadline?: string | null;
  followupCount: number;
  lastFollowupAt?: string | null;
  participantCount: number;
  respondingCount: number;
  /** Ende des letzten Zeitslots; danach ist keine Antwort mehr sinnvoll. */
  lastSlotEnd?: string | null;
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

  const lastSlotEndMs = parseTimestamp(state.lastSlotEnd);
  if (lastSlotEndMs !== null && lastSlotEndMs <= nowMs) {
    return { due: false, attempt: attempts, reason: "Alle Zeitslots liegen in der Vergangenheit" };
  }

  const createdAtMs = parseTimestamp(state.createdAt);
  if (createdAtMs === null) {
    return { due: false, attempt: attempts, reason: "Erstellungszeitpunkt unbekannt" };
  }

  const referenceMs = attempts === 0 ? createdAtMs : parseTimestamp(state.lastFollowupAt) ?? createdAtMs;
  const delayHours = attempts === 0 ? POLL_FOLLOWUP_FIRST_DELAY_HOURS : POLL_FOLLOWUP_REPEAT_HOURS;
  const dueAtMs = referenceMs + delayHours * HOUR_MS;

  if (nowMs < dueAtMs) {
    const lastFollowupMs = parseTimestamp(state.lastFollowupAt);
    const deadlineIsClose =
      deadlineMs !== null && deadlineMs - nowMs <= POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS * HOUR_MS;
    const gapIsLongEnough =
      lastFollowupMs === null || nowMs - lastFollowupMs >= POLL_FOLLOWUP_DEADLINE_MIN_GAP_HOURS * HOUR_MS;

    if (deadlineIsClose && gapIsLongEnough) {
      return {
        due: true,
        attempt: attempts + 1,
        reason: `Antwortfrist läuft in weniger als ${POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS} Stunden ab`,
      };
    }

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

/**
 * Eindeutiger Versandschlüssel je Abstimmung, Teilnehmer und Versuch.
 * Muss mit public.poll_followup_send_key in der Datenbank übereinstimmen.
 */
export function pollFollowupSendKey(
  pollId: string,
  participantId: string,
  attempt: number,
  notificationType = "answer_followup",
): string {
  return `${pollId}:${participantId}:${notificationType}:${Math.max(0, Math.trunc(attempt))}`;
}

/**
 * Nächster Zustellversuch nach einem Fehler: 15, 30, 60, 120 Minuten.
 * `failedSendAttempts` ist die Anzahl der bereits fehlgeschlagenen Versuche
 * (also nach dem Fehler inklusive dieses Fehlers).
 */
export function nextPollFollowupSendAttemptAt(
  failedSendAttempts: number,
  now: Date = new Date(),
): Date {
  const attempt = Math.max(1, Math.trunc(failedSendAttempts ?? 0));
  const minutes = Math.min(
    POLL_FOLLOWUP_RETRY_BASE_MINUTES * 2 ** (attempt - 1),
    POLL_FOLLOWUP_RETRY_MAX_MINUTES,
  );
  return new Date(now.getTime() + minutes * 60_000);
}

/** Ist der Versandauftrag nach allen Wiederholungen endgültig gescheitert? */
export function isPollFollowupSendExhausted(sendAttempts: number): boolean {
  return Math.max(0, Math.trunc(sendAttempts ?? 0)) >= POLL_FOLLOWUP_MAX_SEND_ATTEMPTS;
}

/** Teilnehmende, die noch keine Antwort abgegeben haben (mit gültiger Adresse). */
export function selectFollowupRecipients(
  participants: readonly PollFollowupParticipant[],
): PollFollowupParticipant[] {
  return participants.filter(
    (participant) => !participant.hasResponded && (participant.email ?? "").trim() !== "",
  );
}
