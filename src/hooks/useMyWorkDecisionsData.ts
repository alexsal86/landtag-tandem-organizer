import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { handleAppError } from "@/utils/errorHandler";
import { debugConsole } from '@/utils/debugConsole';
import { MyWorkDecision, getResponseSummary } from "@/components/my-work/decisions/types";
import type { ResponseOption } from "@/lib/decisionTemplates";

const isEmailFile = (name: string) => /\.(eml|msg)$/i.test(name);
const DECISIONS_CACHE_TTL_MS = 60_000;

interface DecisionsCacheEntry {
  timestamp: number;
  decisions: MyWorkDecision[];
}

const decisionsCache = new Map<string, DecisionsCacheEntry>();

interface DecisionAttachment {
  id: string;
  file_name: string;
  file_path: string;
}

const computeAttachmentInfo = (attachments: DecisionAttachment[]) => {
  const all = attachments || [];
  const emails = all.filter((a) => isEmailFile(a.file_name));
  const files = all.filter((a) => !isEmailFile(a.file_name));
  return {
    attachmentCount: all.length,
    emailAttachmentCount: emails.length,
    emailAttachments: emails.map((a) => ({ id: a.id, file_name: a.file_name, file_path: a.file_path })),
    fileAttachments: files.map((a) => ({ id: a.id, file_name: a.file_name, file_path: a.file_path })),
  };
};

interface LoadDecisionsOptions {
  silent?: boolean;
}

export function useMyWorkDecisionsData(userId?: string) {
  const [decisions, setDecisions] = useState<MyWorkDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestLoadRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      latestLoadRequestRef.current += 1;
    };
  }, []);

  const loadDecisions = useCallback(async (options?: LoadDecisionsOptions) => {
    if (!userId) return;

    const silent = options?.silent ?? false;

    const requestId = latestLoadRequestRef.current + 1;
    latestLoadRequestRef.current = requestId;

    const isCurrentRequest = () => mountedRef.current && latestLoadRequestRef.current === requestId;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      // Einzel-RPC ersetzt 5-6 separate DB-Roundtrips (3x Basis + 2x Enrichment + Profiles)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_my_work_decisions', { p_user_id: userId });

      if (!isCurrentRequest()) return;
      if (rpcError) throw rpcError;

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

      const { decisions: rawDecisions, profiles: rawProfiles } = (rpcData as RpcResult) ?? { decisions: [], profiles: [] };
      const profileMap = new Map<string, RpcProfile>((rawProfiles ?? []).map((p) => [p.user_id, p]));

      // Deduplizierung: Bei UNION können Beschlüsse mehrfach erscheinen (z.B. Ersteller + Teilnehmer)
      const allDecisionsMap = new Map<string, MyWorkDecision>();

      for (const item of rawDecisions ?? []) {
        const attInfo = computeAttachmentInfo(item.task_decision_attachments ?? []);
        const participants = item.task_decision_participants ?? [];
        const pendingCount = participants.filter((p) => !p.task_decision_responses || p.task_decision_responses.length === 0).length;
        const userParticipant = participants.find((p) => p.user_id === userId);

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
          ...attInfo,
          response_options: Array.isArray(item.response_options) ? item.response_options as unknown as ResponseOption[] : undefined,
          topicIds: item.topic_ids ?? [],
          participants: participants.map((p) => ({
            id: p.id,
            user_id: p.user_id,
            profile: {
              display_name: profileMap.get(p.user_id)?.display_name ?? null,
              badge_color: profileMap.get(p.user_id)?.badge_color ?? null,
              avatar_url: profileMap.get(p.user_id)?.avatar_url ?? null,
            },
            responses: (p.task_decision_responses ?? [])
              .sort((a, b) => {
                const aIsChild = !!a.parent_response_id;
                const bIsChild = !!b.parent_response_id;
                if (aIsChild !== bIsChild) return aIsChild ? 1 : -1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
              .map((r) => ({ ...r, response_type: r.response_type as string })),
          })),
        };

        const cp = profileMap.get(item.created_by);
        decision.creator = {
          user_id: item.created_by,
          display_name: cp?.display_name ?? null,
          badge_color: cp?.badge_color ?? null,
          avatar_url: cp?.avatar_url ?? null,
        };

        // Bei Duplikaten: is_creator und pendingCount zusammenführen
        if (allDecisionsMap.has(item.id)) {
          const existing = allDecisionsMap.get(item.id)!;
          if (item.is_creator) existing.isCreator = true;
          if (pendingCount > 0) existing.pendingCount = pendingCount;
        } else {
          allDecisionsMap.set(item.id, decision);
        }
      }

      const allDecisionsList = Array.from(allDecisionsMap.values());

      allDecisionsList.sort((a, b) => {
        const priorityA = a.priority ?? 0;
        const priorityB = b.priority ?? 0;
        if (priorityA !== priorityB) return priorityB - priorityA;

        const aUnanswered = a.isParticipant && !a.hasResponded;
        const bUnanswered = b.isParticipant && !b.hasResponded;
        if (aUnanswered && !bUnanswered) return -1;
        if (!aUnanswered && bUnanswered) return 1;

        const summA = getResponseSummary(a.participants);
        const summB = getResponseSummary(b.participants);
        if (summA.questionCount > 0 && summB.questionCount === 0) return -1;
        if (summA.questionCount === 0 && summB.questionCount > 0) return 1;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      if (isCurrentRequest()) {
        setDecisions(allDecisionsList);
        decisionsCache.set(userId, { timestamp: Date.now(), decisions: allDecisionsList });
      }
    } catch (error) {
      if (isCurrentRequest()) {
        const msg = error instanceof Error ? error.message : String(error);
        setError(msg);
        handleAppError(error, { context: 'useMyWorkDecisionsData.loadDecisions' });
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const cached = decisionsCache.get(userId);
    const isFresh = !!cached && Date.now() - cached.timestamp < DECISIONS_CACHE_TTL_MS;

    if (cached) {
      setDecisions(cached.decisions);
      setLoading(!isFresh);
      if (isFresh) return;
    } else {
      setLoading(true);
    }

    void loadDecisions();
  }, [userId, loadDecisions]);

  useEffect(() => {
    if (!userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void loadDecisions({ silent: true });
      }, 250);
    };

    const channel = supabase
      .channel(`my-work-decisions-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions", filter: `created_by=eq.${userId}` }, scheduleRefresh)
      // Listen without filter – filtered subscriptions on task_decision_participants
      // can silently drop events when RLS prevents the anon/authenticated role from
      // seeing the newly-inserted row at the moment the event fires.
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decision_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decision_responses" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, loadDecisions]);

  return {
    data: decisions,
    decisions,
    setDecisions,
    isLoading: loading,
    loading,
    error,
    refetch: loadDecisions,
    loadDecisions,
  };
}
