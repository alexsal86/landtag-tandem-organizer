export interface ResponseOption {
  key: string;
  label: string;
  description?: string | null;
  color?: string;
  requires_comment?: boolean;
}

export interface DecisionRequest {
  id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  response_deadline: string | null;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  visible_to_all?: boolean;
  status: string;
  archived_at: string | null;
  archived_by: string | null;
  task: {
    title: string;
  } | null;
  hasResponded: boolean;
  isParticipant?: boolean;
  isStandalone: boolean;
  isCreator: boolean;
  attachmentCount?: number;
  attachmentFiles?: Array<{ id: string; file_name: string; file_path: string }>;
  topicIds?: string[];
  priority?: number;
  response_options?: ResponseOption[];
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
      parent_response_id?: string | null;
      created_at: string;
      updated_at?: string;
    }>;
  }>;
}

export const getResponseSummary = (participants: DecisionRequest['participants'] = []) => {
  const yesCount = participants.filter((p) => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
  const noCount = participants.filter((p) => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
  const questionCount = participants.filter((p) => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
  const otherCount = participants.filter((p) => {
    if (p.responses.length === 0) return false;
    const rt = p.responses[0].response_type;
    return rt !== 'yes' && rt !== 'no' && rt !== 'question';
  }).length;

  return {
    yesCount,
    noCount,
    questionCount,
    otherCount,
    pending: participants.length - (yesCount + noCount + questionCount + otherCount),
    total: participants.length,
  };
};

export const getAvatarParticipants = (decision: DecisionRequest) =>
  (decision.participants || []).map((participant) => ({
    user_id: participant.user_id,
    display_name: participant.profile?.display_name || null,
    badge_color: participant.profile?.badge_color || null,
    avatar_url: participant.profile?.avatar_url || null,
    response_type: participant.responses[0]?.response_type || null,
  }));

const isStandardTemplate = (options?: ResponseOption[]) => {
  if (!options || options.length === 0) return true;
  const keys = options.map((o) => o.key).sort();
  if (keys.length === 2 && keys[0] === 'no' && keys[1] === 'yes') return true;
  if (keys.length === 3 && keys[0] === 'no' && keys[1] === 'question' && keys[2] === 'yes') return true;
  return false;
};

export const getBorderColor = (
  decision: DecisionRequest,
  summary: ReturnType<typeof getResponseSummary>,
) => {
  const responseOptions = decision.response_options;

  if (!isStandardTemplate(responseOptions) && responseOptions && decision.participants) {
    const optionCounts: Record<string, number> = {};
    decision.participants.forEach((participant) => {
      const responseType = participant.responses[0]?.response_type;
      if (responseType) optionCounts[responseType] = (optionCounts[responseType] || 0) + 1;
    });

    const sortedOptions = [...responseOptions].sort((a, b) => {
      const countDiff = (optionCounts[b.key] || 0) - (optionCounts[a.key] || 0);
      if (countDiff !== 0) return countDiff;
      return responseOptions.findIndex((opt) => opt.key === a.key) - responseOptions.findIndex((opt) => opt.key === b.key);
    });

    const winningOption = sortedOptions[0];
    const winningCount = winningOption ? (optionCounts[winningOption.key] || 0) : 0;
    if (summary.pending > 0 || summary.total === 0 || !winningOption || winningCount === 0) return 'border-l-gray-400';

    const borderColorMap: Record<string, string> = {
      green: 'border-l-green-600',
      red: 'border-l-red-600',
      orange: 'border-l-orange-500',
      yellow: 'border-l-yellow-500',
      blue: 'border-l-blue-600',
      purple: 'border-l-purple-600',
      lime: 'border-l-lime-600',
      gray: 'border-l-gray-400',
    };

    return borderColorMap[winningOption.color || 'gray'] || 'border-l-gray-400';
  }

  const hasResponses = summary.yesCount + summary.noCount + summary.questionCount > 0;
  const allResponsesReceived = summary.pending === 0;

  if (summary.questionCount > 0) return 'border-l-orange-500';
  if (!allResponsesReceived || !hasResponses) return 'border-l-gray-400';
  if (summary.yesCount > summary.noCount) return 'border-l-green-500';
  return 'border-l-red-600';
};
