/**
 * Re-Export der Einladungsregeln für UI und Selbsttest. Die Regeln selbst
 * liegen in supabase/functions/_shared/appointmentInvite.ts, damit Edge
 * Functions und Browser mit identischen UIDs, SEQUENCE-Werten und
 * Empfängerregeln arbeiten.
 */
export {
  INVITATION_UID_DOMAIN,
  appointmentInviteUid,
  buildAppointmentIcs,
  escapeICSValue,
  formatDateToICS,
  hasBeenInvited,
  invitationGuestKey,
  invitationUpdateRequired,
  nextCalendarSequence,
  nextGuestStatusAfterSend,
  normalizeSequence,
  selectInvitationRecipients,
  selectNewGuestEmails,
  validateInviteDates,
} from "../../../../supabase/functions/_shared/appointmentInvite";
export type {
  CalendarInviteRequest,
  InvitationAttendee,
  InvitationGuestLike,
  InvitationIcsInput,
  InvitationMethod,
  InvitationOrganizer,
  InvitationReason,
} from "../../../../supabase/functions/_shared/appointmentInvite";
