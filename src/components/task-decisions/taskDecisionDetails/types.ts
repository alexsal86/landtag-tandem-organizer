import type { ResponseOption } from "@/lib/decisionTemplates";
import type { ParticipantProfile } from "@/types/taskDecisions";

export type DecisionProfile = ParticipantProfile;

export interface DecisionDetailsState {
  id: string;
  title: string;
  description: string | null;
  response_options: ResponseOption[] | null;
  response_deadline: string | null;
  created_by: string;
  created_at: string;
  status: string;
  meeting_id?: string | null;
  pending_for_jour_fixe?: boolean | null;
  tasks: { id: string; title: string } | null;
  topicIds: string[];
}

export interface ResponseThread {
  id: string;
  response_type: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  creator_response: string | null;
  parent_response_id: string | null;
  participant_id: string;
  participant_profile?: {
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  replies?: ResponseThread[];
}

export const DELETED_COMMENT_TEXT = "Dieser Kommentar wurde gelöscht.";

export interface Participant {
  id: string;
  user_id: string;
  profile: {
    display_name: string | null;
    badge_color: string | null;
  };
  responses: Array<{
    id: string;
    response_type: string;
    comment: string | null;
    created_at: string;
    creator_response?: string | null;
    parent_response_id?: string | null;
  }>;
}

export interface TaskDecisionDetailsProps {
  decisionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onArchived?: () => void;
  highlightCommentId?: string | null;
  highlightResponseId?: string | null;
}
