import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MyWorkDecision, getResponseSummary } from "@/components/my-work/decisions/types";

const isEmailFile = (name: string) => /\.(eml|msg)$/i.test(name);
const DECISIONS_CACHE_TTL_MS = 30_000;

interface DecisionsCacheEntry {
  timestamp: number;
  decisions: MyWorkDecision[];
}

const decisionsCache = new Map<string, DecisionsCacheEntry>();

const computeAttachmentInfo = (attachments: any[]) => {
  const all = attachments || [];
  const emails = all.filter((a: any) => isEmailFile(a.file_name));
  const files = all.filter((a: any) => !isEmailFile(a.file_name));
  return {
    attachmentCount: all.length,
    emailAttachmentCount: emails.length,
    emailAttachments: emails.map((a: any) => ({ id: a.id, file_name: a.file_name, file_path: a.file_path })),
    fileAttachments: files.map((a: any) => ({ id: a.id, file_name: a.file_name, file_path: a.file_path })),
  };
};

export function useMyWorkDecisionsData(userId?: string) {
  const [decisions, setDecisions] = useState<MyWorkDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const latestLoadRequestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      latestLoadRequestRef.current += 1;
    };
  }, []);

  const loadDecisions = useCallback(async () => {
    if (!userId) return;

    const requestId = latestLoadRequestRef.current + 1;
    latestLoadRequestRef.current = requestId;

    const isCurrentRequest = () => mountedRef.current && latestLoadRequestRef.current === requestId;

    setLoading(true);

    try {
      const [participantResult, creatorResult, publicResult] = await Promise.all([
        supabase
          .from("task_decision_participants")
          .select(`
            id,
            decision_id,
            task_decisions!inner (
              id, title, description, response_deadline, status, created_at, created_by, visible_to_all, response_options, priority,
              task_decision_attachments (id, file_name, file_path)
            ),
            task_decision_responses (id, response_type)
          `)
          .eq("user_id", userId)
          .in("task_decisions.status", ["active", "open"]),
        supabase
          .from("task_decisions")
          .select(`
            id, title, description, response_deadline, status, created_at, created_by, visible_to_all, response_options, priority,
            task_decision_participants (id, user_id, task_decision_responses (id, response_type)),
            task_decision_attachments (id, file_name, file_path)
          `)
          .eq("created_by", userId)
          .in("status", ["active", "open"]),
        supabase
          .from("task_decisions")
          .select(`
            id, title, description, response_deadline, status, created_at, created_by, visible_to_all, response_options, priority,
            task_decision_participants (id, user_id, task_decision_responses (id, response_type)),
            task_decision_attachments (id, file_name, file_path)
          `)
          .eq("visible_to_all", true)
          .in("status", ["active", "open"])
          .neq("created_by", userId),
      ]);

      if (!isCurrentRequest()) return;

      if (participantResult.error) throw participantResult.error;
      if (creatorResult.error) throw creatorResult.error;
      if (publicResult.error) throw publicResult.error;

      const participantData = participantResult.data || [];
      const creatorData = creatorResult.data || [];
      const publicData = publicResult.data || [];

      const participantDecisions: MyWorkDecision[] = participantData.map((item: any) => {
        const attInfo = computeAttachmentInfo(item.task_decisions.task_decision_attachments);
        return {
          id: item.task_decisions.id,
          title: item.task_decisions.title,
          description: item.task_decisions.description,
          response_deadline: item.task_decisions.response_deadline,
          status: item.task_decisions.status,
          created_at: item.task_decisions.created_at,
          created_by: item.task_decisions.created_by,
          participant_id: item.id,
          hasResponded: item.task_decision_responses.length > 0,
          isCreator: item.task_decisions.created_by === userId,
          isParticipant: true,
          pendingCount: 0,
          responseType: item.task_decision_responses[0]?.response_type || null,
          visible_to_all: item.task_decisions.visible_to_all,
          priority: item.task_decisions.priority ?? 0,
          ...attInfo,
          response_options: Array.isArray(item.task_decisions.response_options) ? item.task_decisions.response_options : undefined,
        };
      });

      const creatorDecisions: MyWorkDecision[] = creatorData.map((item: any) => {
        const participants = item.task_decision_participants || [];
        const pendingCount = participants.filter((p: any) => !p.task_decision_responses || p.task_decision_responses.length === 0).length;
        const attInfo = computeAttachmentInfo(item.task_decision_attachments);

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          response_deadline: item.response_deadline,
          status: item.status,
          created_at: item.created_at,
          created_by: item.created_by,
          participant_id: null,
          hasResponded: true,
          isCreator: true,
          isParticipant: false,
          pendingCount,
          visible_to_all: item.visible_to_all,
          priority: item.priority ?? 0,
          ...attInfo,
          response_options: Array.isArray(item.response_options) ? item.response_options : undefined,
        };
      });

      const participantDecisionIds = new Set(participantDecisions.map((d) => d.id));
      const publicDecisions: MyWorkDecision[] = publicData
        .filter((item: any) => !participantDecisionIds.has(item.id))
        .map((item: any) => {
          const participants = item.task_decision_participants || [];
          const userParticipant = participants.find((p: any) => p.user_id === userId);
          const pendingCount = participants.filter((p: any) => !p.task_decision_responses || p.task_decision_responses.length === 0).length;
          const attInfo = computeAttachmentInfo(item.task_decision_attachments);

          return {
            id: item.id,
            title: item.title,
            description: item.description,
            response_deadline: item.response_deadline,
            status: item.status,
            created_at: item.created_at,
            created_by: item.created_by,
            participant_id: userParticipant?.id || null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : true,
            isCreator: false,
            isParticipant: !!userParticipant,
            pendingCount,
            isPublic: true,
            visible_to_all: true,
            priority: item.priority ?? 0,
            ...attInfo,
            response_options: Array.isArray(item.response_options) ? item.response_options : undefined,
          };
        });

      const allDecisionsMap = new Map<string, MyWorkDecision>();
      participantDecisions.forEach((d) => allDecisionsMap.set(d.id, d));
      creatorDecisions.forEach((d) => {
        if (!allDecisionsMap.has(d.id)) {
          allDecisionsMap.set(d.id, d);
        } else {
          const existing = allDecisionsMap.get(d.id)!;
          existing.pendingCount = d.pendingCount;
          existing.isCreator = true;
        }
      });
      publicDecisions.forEach((d) => {
        if (!allDecisionsMap.has(d.id)) allDecisionsMap.set(d.id, d);
      });

      const allDecisionsList = Array.from(allDecisionsMap.values());
      const allDecisionIds = allDecisionsList.map((d) => d.id);

      if (allDecisionIds.length > 0) {
        const [participantsResult, topicsResult] = await Promise.all([
          supabase
            .from("task_decision_participants")
            .select(`
              id, user_id, decision_id,
              task_decision_responses (id, response_type, comment, creator_response, parent_response_id, created_at, updated_at)
            `)
            .in("decision_id", allDecisionIds),
          supabase.from("task_decision_topics").select("decision_id, topic_id").in("decision_id", allDecisionIds),
        ]);

        if (!isCurrentRequest()) return;

        if (participantsResult.error) throw participantsResult.error;
        if (topicsResult.error) throw topicsResult.error;

        const participantsWithProfiles = participantsResult.data || [];
        const topicsData = topicsResult.data || [];

        const allUserIds = [...new Set([...participantsWithProfiles.map((p) => p.user_id), ...allDecisionsList.map((d) => d.created_by)])];

        type ProfileRow = { user_id: string; display_name: string | null; badge_color: string | null; avatar_url: string | null };
        const { data: profiles, error: profilesError } =
          allUserIds.length > 0
            ? await supabase.from("profiles").select("user_id, display_name, badge_color, avatar_url").in("user_id", allUserIds)
            : { data: [] as ProfileRow[], error: null as any };

        if (!isCurrentRequest()) return;

        if (profilesError) throw profilesError;

        const profileMap = new Map<string, ProfileRow>((profiles ?? []).map((p) => [p.user_id, p] as [string, ProfileRow]));

        const topicsByDecision = new Map<string, string[]>();
        topicsData.forEach((t) => {
          if (!topicsByDecision.has(t.decision_id)) topicsByDecision.set(t.decision_id, []);
          topicsByDecision.get(t.decision_id)!.push(t.topic_id);
        });

        const participantsByDecision = new Map<string, any[]>();
        participantsWithProfiles.forEach((p) => {
          if (!participantsByDecision.has(p.decision_id)) participantsByDecision.set(p.decision_id, []);
          participantsByDecision.get(p.decision_id)!.push({
            id: p.id,
            user_id: p.user_id,
            profile: {
              display_name: profileMap.get(p.user_id)?.display_name || null,
              badge_color: profileMap.get(p.user_id)?.badge_color || null,
              avatar_url: profileMap.get(p.user_id)?.avatar_url || null,
            },
            responses: (p.task_decision_responses || [])
              .sort((a: any, b: any) => {
                const aIsChild = !!a.parent_response_id;
                const bIsChild = !!b.parent_response_id;
                if (aIsChild !== bIsChild) return aIsChild ? 1 : -1;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
              .map((r: any) => ({ ...r, response_type: r.response_type as string })),
          });
        });

        allDecisionsList.forEach((d) => {
          d.participants = participantsByDecision.get(d.id) || [];
          d.topicIds = topicsByDecision.get(d.id) || [];
          const cp = profileMap.get(d.created_by);
          d.creator = {
            user_id: d.created_by,
            display_name: cp?.display_name || null,
            badge_color: cp?.badge_color || null,
            avatar_url: cp?.avatar_url || null,
          };
        });
      }

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
        console.error("Error loading decisions:", error);
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
        void loadDecisions();
      }, 250);
    };

    const channel = supabase
      .channel(`my-work-decisions-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decision_participants" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decision_responses" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, loadDecisions]);

  return {
    decisions,
    setDecisions,
    loading,
    loadDecisions,
  };
}
