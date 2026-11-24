/**
 * Re-Export der Abstimmungsregeln für UI und Selbsttest. Die Regeln selbst
 * liegen in supabase/functions/_shared/, damit Edge Functions, Browser und
 * Selbsttest mit identischen Vorschlägen und Erinnerungsabständen arbeiten.
 */
export {
  DEFAULT_POLL_GRID_MINUTES,
  DEFAULT_POLL_MAX_PER_DAY,
  DEFAULT_POLL_SUGGESTION_LIMIT,
  DEFAULT_POLL_TIME_ZONE,
  DEFAULT_POLL_WORKDAY_END_HOUR,
  DEFAULT_POLL_WORKDAY_START_HOUR,
  buildBlockedRanges,
  mergeTimeRanges,
  normalizeParticipantEmails,
  suggestPollSlots,
} from "../../../supabase/functions/_shared/pollSlotSuggestion";
export type {
  PollBusyInterval,
  PollExistingSlot,
  PollSlotSuggestion,
  PollSlotSuggestionInput,
} from "../../../supabase/functions/_shared/pollSlotSuggestion";

export {
  POLL_FOLLOWUP_CLAIM_TIMEOUT_MINUTES,
  POLL_FOLLOWUP_DEADLINE_MIN_GAP_HOURS,
  POLL_FOLLOWUP_DEADLINE_WINDOW_HOURS,
  POLL_FOLLOWUP_FIRST_DELAY_HOURS,
  POLL_FOLLOWUP_MAX_ATTEMPTS,
  POLL_FOLLOWUP_MAX_SEND_ATTEMPTS,
  POLL_FOLLOWUP_REPEAT_HOURS,
  POLL_FOLLOWUP_RETRY_BASE_MINUTES,
  POLL_FOLLOWUP_RETRY_MAX_MINUTES,
  decidePollFollowup,
  isPollFollowupSendExhausted,
  nextPollFollowupSendAttemptAt,
  pollFollowupSendKey,
  selectFollowupRecipients,
} from "../../../supabase/functions/_shared/pollFollowup";
export type {
  PollFollowupDecision,
  PollFollowupParticipant,
  PollFollowupState,
} from "../../../supabase/functions/_shared/pollFollowup";
