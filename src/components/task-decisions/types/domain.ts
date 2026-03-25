export interface DecisionParticipantProfile {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
  avatar_url: string | null;
}

export interface DecisionReaction {
  comment_id: string;
  emoji: string;
  user_id: string;
  created_at: string;
}

export interface DecisionComment {
  id: string;
  decision_id: string;
  participant_id: string;
  comment: string;
  parent_comment_id: string | null;
  created_at: string;
}

export interface TaskDecision {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  status: string;
  created_at: string;
  updated_at: string;
}
