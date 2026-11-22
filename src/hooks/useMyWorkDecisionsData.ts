import { useCallback, useEffect, useRef, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { handleAppError } from "@/utils/errorHandler";
import { debugConsole } from "@/utils/debugConsole";
import { notify } from "@/lib/notify";
import { MyWorkDecision, getResponseSummary } from "@/components/my-work/decisions/types";
import type { ResponseOption } from "@/lib/decisionTemplates";
import { queryClient } from "@/providers/queryClient";
import { STALE_TIME } from "@/lib/query-cache";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";

const isEmailFile = (name: string) => /\.(eml|msg)$/i.test(name);

interface DecisionAttachment {
  id: string;
  file_name: string;
  file_path: string;
}

const computeAttachmentInfo = (attachments: DecisionAttachment[]) => {
  const all = attachments || [];
  const emails = all.filter((attachment) => isEmailFile(attachment.file_name));
  const files = all.filter((attachment) => !isEmailFile(attachment.file_name));
  return {
    attachmentCount: all.length,
    emailAttachmentCount: emails.length,
    emailAttachments: emails.map((attachment) => ({ id: attachment.id, file_name: attachment.file_name, file_path: attachment.file_path })),
    fileAttachments: files.map((attachment) => ({ id: attachment.id, file_name: attachment.file_name, file_path: attachment.file_path })),
  };
};

interface LoadDecisionsOptions {
  silent?: boolean;
}

type RpcDecision = {
  id: string; title: string; description: string | null; response_deadline: string | null;
  status: string; created_at: string; created_by: string; visible_to_all: boolean;
  response_options: unknown; priority: number | null;
  participant_id: string | null; is_participant: boolean; is_creator: boolean; is_public: boolean;
  task_decision_attachments: DecisionAttachment[];
  task_decision_participants: Array<{
    id: string; user_id: string;
    task_decision_responses: Array<{
      id: string; response_type: string; comment: string | null; creator_response: string | null;
      parent_response_id: string | null; created_at: string; updated_at: string;
    }>;
  }>;
  topic_ids: string[];
};
type RpcProfile = { user_id: string; display_name: string | null; badge_color: string | null; avatar_url: string | null };
type RpcResult = { decisions: RpcDecision[]; profiles: RpcProfile[] };

async function fetchMyWorkDecisions(userId: string): Promise<MyWorkDecision[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_my_work_decisions", { p_user_id: userId });
  if (rpcError) throw rpcError;

  debugConsole.log("[useMyWorkDecisionsData] RPC ok", {
    userId,
    rawCount: Array.isArray((rpcData as RpcResult | null)?.decisions)
      ? (rpcData as RpcResult).decisions.length
      : 0,
  });

  const { decisions: rawDecisions, profiles: rawProfiles } = (rpcData as RpcResult | null) ?? { decisions: [], profiles: [] };
  const profileMap = new Map<string, RpcProfile>((rawProfiles ?? []).map((profile) => [profile.user_id, profile]));
  const allDecisionsMap = new Map<string, MyWorkDecision>();

  for (const item of rawDecisions ?? []) {
    const attachmentInfo = computeAttachmentInfo(item.task_decision_attachments ?? []);
    const participants = item.task_decision_participants ?? [];
    const pendingCount = participants.filter((participant) => !participant.task_decision_responses || participant.task_decision_responses.length === 0).length;
    const userParticipant = participants.find((participant) => participant.user_id === userId);

    const decision: MyWorkDecision = {
      id: item.id,
      title: item.title,
      description: item.description,
      response_deadline: item.response_deadline,
      status: item.status,
      created_at: item.created_at,
      created_by: item.created_by,
      participant_id: item.participant_id ?? userParticipant?.id ?? null,
      hasResponded: item.is_participant
        ? (userParticipant ? userParticipant.task_decision_responses.length > 0 : false)
        : true,
      isCreator: item.is_creator,
      isParticipant: item.is_participant,
      isPublic: item.is_public,
      pendingCount,
      responseType: userParticipant?.task_decision_responses[0]?.response_type ?? null,
      visible_to_all: item.visible_to_all,
      priority: item.priority ?? 0,
      ...attachmentInfo,
      response_options: Array.isArray(item.response_options) ? item.response_options as ResponseOption[] : undefined,
      topicIds: item.topic_ids ?? [],
      participants: participants.map((participant) => ({
        id: participant.id,
        user_id: participant.user_id,
        profile: {
          display_name: profileMap.get(participant.user_id)?.display_name ?? null,
          badge_color: profileMap.get(participant.user_id)?.badge_color ?? null,
          avatar_url: profileMap.get(participant.user_id)?.avatar_url ?? null,
        },
        responses: (participant.task_decision_responses ?? [])
          .sort((a, b) => {
            const aIsChild = !!a.parent_response_id;
            const bIsChild = !!b.parent_response_id;
            if (aIsChild !== bIsChild) return aIsChild ? 1 : -1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .map((response) => ({ ...response, response_type: response.response_type as string })),
      })),
    };

    const creatorProfile = profileMap.get(item.created_by);
    decision.creator = {
      user_id: item.created_by,
      display_name: creatorProfile?.display_name ?? null,
      badge_color: creatorProfile?.badge_color ?? null,
      avatar_url: creatorProfile?.avatar_url ?? null,
    };

    const existing = allDecisionsMap.get(item.id);
    if (existing) {
      if (item.is_creator) existing.isCreator = true;
      if (item.is_participant) {
        existing.isParticipant = true;
        existing.participant_id = decision.participant_id;
        existing.hasResponded = decision.hasResponded;
        existing.responseType = decision.responseType;
      }
      if (item.is_public) existing.isPublic = true;
      if (pendingCount > 0) existing.pendingCount = pendingCount;
    } else {
      allDecisionsMap.set(item.id, decision);
    }
  }

  return Array.from(allDecisionsMap.values()).sort((a, b) => {
    const priorityDifference = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDifference !== 0) return priorityDifference;

    const aUnanswered = a.isParticipant && !a.hasResponded;
    const bUnanswered = b.isParticipant && !b.hasResponded;
    if (aUnanswered && !bUnanswered) return -1;
    if (!aUnanswered && bUnanswered) return 1;

    const summaryA = getResponseSummary(a.participants);
    const summaryB = getResponseSummary(b.participants);
    if (summaryA.questionCount > 0 && summaryB.questionCount === 0) return -1;
    if (summaryA.questionCount === 0 && summaryB.questionCount > 0) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function useMyWorkDecisionsData(userId?: string) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryKey = ["my-work-decisions", userId] as const;
  const reportedErrorRef = useRef<unknown>(null);
  const query = useQuery({
    queryKey,
    queryFn: () => fetchMyWorkDecisions(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  useDashboardRealtime(user?.id, currentTenant?.id);

  useEffect(() => {
    if (!query.error || reportedErrorRef.current === query.error) return;
    reportedErrorRef.current = query.error;
    const message = query.error instanceof Error ? query.error.message : String(query.error);
    notify.error("Entscheidungen konnten nicht geladen werden", { description: message });
    handleAppError(query.error, { context: "useMyWorkDecisionsData.loadDecisions" });
  }, [query.error]);

  const setDecisions = useCallback((update: SetStateAction<MyWorkDecision[]>) => {
    queryClient.setQueryData<MyWorkDecision[]>(["my-work-decisions", userId], (current = []) =>
      typeof update === "function" ? update(current) : update,
    );
  }, [userId]);

  const loadDecisions = useCallback(async (_options?: LoadDecisionsOptions) => {
    if (!userId) return;
    await queryClient.refetchQueries({ queryKey: ["my-work-decisions", userId], exact: true });
  }, [userId]);

  const decisions = query.data ?? [];
  const error = query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null;

  return {
    data: decisions,
    decisions,
    setDecisions,
    isLoading: query.isLoading,
    loading: query.isLoading,
    error,
    refetch: loadDecisions,
    loadDecisions,
  };
}
