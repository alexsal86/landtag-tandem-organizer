import { ResponseOption, getColorClasses } from "@/lib/decisionTemplates";

export interface MyWorkDecision {
  id: string;
  title: string;
  description: string | null;
  response_deadline: string | null;
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
  emailAttachmentCount?: number;
  emailAttachments?: Array<{ id: string; file_name: string; file_path: string }>;
  topicIds?: string[];
  response_options?: ResponseOption[];
  priority?: number;
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
  createdAt: string;
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
  createdAt: string;
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

// Standard yes/no/question summary
export const getResponseSummary = (participants: MyWorkDecision['participants'] = []) => {
  const yesCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
  const noCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
  const questionCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
  const otherCount = participants.filter(p => {
    if (p.responses.length === 0) return false;
    const rt = p.responses[0].response_type;
    return rt !== 'yes' && rt !== 'no' && rt !== 'question';
  }).length;
  const pending = participants.length - (yesCount + noCount + questionCount + otherCount);
  return { yesCount, noCount, questionCount, otherCount, pending, total: participants.length };
};

// Dynamic summary based on response_options
export interface CustomResponseCount {
  key: string;
  label: string;
  color: string;
  count: number;
}

export const getCustomResponseSummary = (
  participants: MyWorkDecision['participants'] = [],
  responseOptions: ResponseOption[]
): { counts: CustomResponseCount[]; pending: number; total: number } => {
  const counts: CustomResponseCount[] = responseOptions.map(opt => ({
    key: opt.key,
    label: opt.label,
    color: opt.color,
    count: participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === opt.key).length,
  }));
  const responded = counts.reduce((s, c) => s + c.count, 0);
  const pending = participants.length - responded;
  return { counts, pending, total: participants.length };
};

const isStandardTemplate = (options?: ResponseOption[]) => {
  if (!options || options.length === 0) return true;
  const keys = options.map(o => o.key).sort();
  // Standard yes/no or yes/no/question
  if (keys.length === 2 && keys[0] === 'no' && keys[1] === 'yes') return true;
  if (keys.length === 3 && keys[0] === 'no' && keys[1] === 'question' && keys[2] === 'yes') return true;
  return false;
};

export const getBorderColor = (
  summary: ReturnType<typeof getResponseSummary>,
  responseOptions?: ResponseOption[],
  participants?: MyWorkDecision['participants']
) => {
  // For standard templates, use legacy logic
  if (isStandardTemplate(responseOptions)) {
    const hasResponses = summary.yesCount + summary.noCount + summary.questionCount > 0;
    const allResponsesReceived = summary.pending === 0;
    
    if (summary.questionCount > 0) return 'border-l-orange-500';
    if (!allResponsesReceived || !hasResponses) return 'border-l-gray-400';
    if (summary.yesCount > summary.noCount) return 'border-l-green-500';
    return 'border-l-red-600';
  }

  // For custom templates
  if (responseOptions && participants) {
    const custom = getCustomResponseSummary(participants, responseOptions);
    if (custom.pending > 0 || custom.total === 0) return 'border-l-gray-400';
    // Find the winning option
    const sorted = [...custom.counts].sort((a, b) => b.count - a.count);
    if (sorted.length > 0 && sorted[0].count > 0) {
      const BORDER_LEFT_MAP: Record<string, string> = {
        green: "border-l-green-600",
        red: "border-l-red-600",
        orange: "border-l-orange-500",
        yellow: "border-l-yellow-500",
        blue: "border-l-blue-600",
        purple: "border-l-purple-600",
        lime: "border-l-lime-600",
        gray: "border-l-gray-400",
      };
      return BORDER_LEFT_MAP[sorted[0].color] || 'border-l-gray-400';
    }
    return 'border-l-green-500';
  }

  return 'border-l-gray-400';
};
