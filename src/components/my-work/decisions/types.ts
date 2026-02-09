export interface MyWorkDecision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  hasResponded: boolean;
  isCreator: boolean;
  isParticipant: boolean;
  pendingCount: number;
  responseType?: string | null;
  isPublic?: boolean;
  visible_to_all?: boolean;
  attachmentCount?: number;
  topicIds?: string[];
  creator?: {
    user_id: string;
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  participants?: Array<{
    id: string;
    user_id: string;
    profile?: {
      display_name: string | null;
      badge_color: string | null;
      avatar_url: string | null;
    };
    responses: Array<{
      id: string;
      response_type: string;
      comment: string | null;
      creator_response: string | null;
      created_at: string;
    }>;
  }>;
}

export interface SidebarOpenQuestion {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantAvatarUrl: string | null;
  comment: string | null;
}

export interface SidebarNewComment {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantAvatarUrl: string | null;
  responseType: string;
  comment: string | null;
}

export interface SidebarDiscussionComment {
  id: string;
  decisionId: string;
  decisionTitle: string;
  authorName: string | null;
  authorBadgeColor: string | null;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  isMention: boolean;
}

export const getResponseSummary = (participants: MyWorkDecision['participants'] = []) => {
  const yesCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
  const noCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
  const questionCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
  // Count other response types (A/B/C, 1-5, custom) as "voted" (not pending)
  const otherCount = participants.filter(p => {
    if (p.responses.length === 0) return false;
    const rt = p.responses[0].response_type;
    return rt !== 'yes' && rt !== 'no' && rt !== 'question';
  }).length;
  const pending = participants.length - (yesCount + noCount + questionCount + otherCount);
  return { yesCount, noCount, questionCount, otherCount, pending, total: participants.length };
};

export const getBorderColor = (summary: ReturnType<typeof getResponseSummary>) => {
  const hasResponses = summary.yesCount + summary.noCount + summary.questionCount > 0;
  const allResponsesReceived = summary.pending === 0;
  
  if (summary.questionCount > 0) return 'border-l-orange-500';
  if (!allResponsesReceived || !hasResponses) return 'border-l-gray-400';
  if (summary.yesCount > summary.noCount) return 'border-l-green-500';
  return 'border-l-red-600';
};
