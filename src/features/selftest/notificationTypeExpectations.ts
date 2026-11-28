/**
 * Meldungstypen, die der Client erzeugt und die deshalb in jedem Büro vorhanden sein
 * müssen. Der Selbsttest-Schritt `notification-types` in `notification-inbox` prüft ihre
 * Existenz je Mandant; `scripts/check-notification-types.mjs` gleicht die Liste mit
 * STANDARD_NOTIFICATION_TYPES und den tatsächlichen Client-Aufrufen ab.
 */
export const REQUIRED_NOTIFICATION_TYPES = [
  "appointment_feedback",
  "case_item_assigned",
  "case_item_status_changed",
  "case_item_comment",
  "employee_meeting_scheduled",
  "employee_meeting_request_declined",
  "news_shared_internal",
  "poll_restored",
  "task_decision_request",
  "task_decision_completed",
  "task_decision_creator_response",
  "task_decision_comment_received",
  "task_decision_comment_reaction_received",
  "time_tracking",
] as const;
