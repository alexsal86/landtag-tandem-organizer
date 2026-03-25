export interface ParticipantProfile {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
  avatar_url: string | null;
}

export interface ReactionProfile {
  user_id: string;
  display_name: string | null;
}

export interface DecisionResponseNotificationLookup {
  task_decision_participants: {
    user_id: string;
  } | null;
  task_decisions: {
    title: string;
  } | null;
}
