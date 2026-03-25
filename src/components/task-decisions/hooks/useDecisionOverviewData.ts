import { useCallback, useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { supabase } from '@/integrations/supabase/client';
import { DecisionRequest, getResponseSummary } from '../utils/decisionOverview';
import type { ParticipantProfile } from '@/types/taskDecisions';

type DecisionCreatorProfile = ParticipantProfile;

const sortDecisions = (decisions: DecisionRequest[]) => {
  decisions.sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) return priorityB - priorityA;

    const summaryA = getResponseSummary(a.participants);
    const summaryB = getResponseSummary(b.participants);

    const aIsUnansweredParticipant = a.isParticipant && !a.hasResponded;
    const bIsUnansweredParticipant = b.isParticipant && !b.hasResponded;

    if (aIsUnansweredParticipant && !bIsUnansweredParticipant) return -1;
    if (!aIsUnansweredParticipant && bIsUnansweredParticipant) return 1;

    const aHasQuestions = summaryA.questionCount > 0;
    const bHasQuestions = summaryB.questionCount > 0;

    if (aHasQuestions && !bHasQuestions) return -1;
    if (!aHasQuestions && bHasQuestions) return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export const useDecisionOverviewData = () => {
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);

  const loadDecisionRequests = useCallback(async (currentUserId: string) => {
    try {
      const { data: participantDecisions, error: participantError } = await supabase
        .from('task_decision_participants')
        .select(`
          id,
          decision_id,
          task_decisions!inner (
            id,
            task_id,
            title,
            description,
            response_deadline,
            created_at,
            created_by,
            status,
            archived_at,
            archived_by,
            visible_to_all,
            priority,
            response_options,
            tasks (
              title
            ),
            task_decision_attachments (count)
          ),
          task_decision_responses (
            id
          )
        `)
        .eq('user_id', currentUserId)
        .in('task_decisions.status', ['active', 'open']);

      if (participantError) throw participantError;

      const { data: allDecisions, error: allError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          response_deadline,
          created_at,
          created_by,
          status,
          archived_at,
          archived_by,
          visible_to_all,
          priority,
          response_options,
          tasks (
            title,
            assigned_to
          ),
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              id
            )
          ),
          task_decision_attachments (count)
        `)
        .in('status', ['active', 'open']);

      if (allError) throw allError;

      const { data: archivedDecisions, error: archivedError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          response_deadline,
          created_at,
          created_by,
          status,
          archived_at,
          archived_by,
          visible_to_all,
          priority,
          response_options,
          tasks (
            title,
            assigned_to
          ),
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              id
            )
          ),
          task_decision_attachments (count)
        `)
        .eq('status', 'archived');

      if (archivedError) throw archivedError;

      const combinedDecisions = [...(allDecisions || []), ...(archivedDecisions || [])];
      const formattedParticipantData = participantDecisions?.map((item) => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        response_deadline: item.task_decisions.response_deadline,
        created_by: item.task_decisions.created_by,
        status: item.task_decisions.status,
        archived_at: item.task_decisions.archived_at,
        archived_by: item.task_decisions.archived_by,
        visible_to_all: item.task_decisions.visible_to_all,
        priority: item.task_decisions.priority ?? 0,
        response_options: item.task_decisions.response_options,
        participant_id: item.id,
        task: item.task_decisions.tasks ? { title: item.task_decisions.tasks.title } : null,
        hasResponded: item.task_decision_responses.length > 0,
        isParticipant: true,
        isStandalone: !item.task_decisions.task_id,
        isCreator: item.task_decisions.created_by === currentUserId,
        attachmentCount: item.task_decisions.task_decision_attachments?.[0]?.count || 0,
      })) || [];

      const formattedAllData = combinedDecisions
        ?.filter((item) => {
          const isCreator = item.created_by === currentUserId;
          const isParticipant = item.task_decision_participants.some((p) => p.user_id === currentUserId);
          const assignedTo = item.tasks?.assigned_to;
          const isAssigned = assignedTo ? assignedTo.includes(currentUserId) : false;
          const isVisibleToAll = item.visible_to_all === true;
          return isCreator || isParticipant || isAssigned || isVisibleToAll;
        })
        ?.map((item) => {
          const userParticipant = item.task_decision_participants.find((p) => p.user_id === currentUserId);
          return {
            id: item.id,
            task_id: item.task_id,
            title: item.title,
            description: item.description,
            created_at: item.created_at,
            response_deadline: item.response_deadline,
            created_by: item.created_by,
            status: item.status,
            archived_at: item.archived_at,
            archived_by: item.archived_by,
            visible_to_all: item.visible_to_all,
            priority: item.priority ?? 0,
            response_options: item.response_options,
            participant_id: userParticipant?.id || null,
            task: item.tasks ? { title: item.tasks.title } : null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
            isParticipant: !!userParticipant,
            isStandalone: !item.task_id,
            isCreator: item.created_by === currentUserId,
            attachmentCount: item.task_decision_attachments?.[0]?.count || 0,
          };
        }) || [];

      const decisionsMap = new Map<string, DecisionRequest>();
      formattedAllData.forEach((decision) => decisionsMap.set(decision.id, decision));
      formattedParticipantData.forEach((participantDecision) => {
        const existing = decisionsMap.get(participantDecision.id);
        if (existing) {
          decisionsMap.set(participantDecision.id, {
            ...existing,
            participant_id: participantDecision.participant_id,
            hasResponded: participantDecision.hasResponded,
            isParticipant: true,
          });
        } else {
          decisionsMap.set(participantDecision.id, participantDecision);
        }
      });

      const allDecisionsList = Array.from(decisionsMap.values()) as DecisionRequest[];

      if (allDecisionsList.length > 0) {
        const decisionIds = allDecisionsList.map((d) => d.id);
        const { data: participantsData, error: participantsError } = await supabase
          .from('task_decision_participants')
          .select(`
            id,
            user_id,
            decision_id,
            task_decision_responses (
              id,
              response_type,
              comment,
              creator_response,
              parent_response_id,
              created_at,
              updated_at
            )
          `)
          .in('decision_id', decisionIds);

        if (participantsError) throw participantsError;

        const { data: topicsData, error: topicsError } = await supabase
          .from('task_decision_topics')
          .select('decision_id, topic_id')
          .in('decision_id', decisionIds);

        if (topicsError) throw topicsError;

        const topicsByDecision = new Map<string, string[]>();
        topicsData?.forEach((topic) => {
          if (!topicsByDecision.has(topic.decision_id)) topicsByDecision.set(topic.decision_id, []);
          topicsByDecision.get(topic.decision_id)!.push(topic.topic_id);
        });

        const allUserIds = [...new Set([...(participantsData?.map((p) => p.user_id) || []), ...allDecisionsList.map((d) => d.created_by)])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, badge_color, avatar_url')
          .in('user_id', allUserIds);

        const profileMap = new Map<string, DecisionCreatorProfile>((profiles ?? []).map((profile) => [profile.user_id, profile]));
        const participantsByDecision = new Map<string, DecisionRequest['participants']>();

        participantsData?.forEach((participant) => {
          if (!participantsByDecision.has(participant.decision_id)) participantsByDecision.set(participant.decision_id, []);
          participantsByDecision.get(participant.decision_id)?.push({
            id: participant.id,
            user_id: participant.user_id,
            profile: {
              display_name: profileMap.get(participant.user_id)?.display_name || null,
              badge_color: profileMap.get(participant.user_id)?.badge_color || null,
              avatar_url: profileMap.get(participant.user_id)?.avatar_url || null,
            },
            responses: (participant.task_decision_responses || []).sort((a, b) => {
              const aIsChild = !!a.parent_response_id;
              const bIsChild = !!b.parent_response_id;
              if (aIsChild !== bIsChild) return aIsChild ? 1 : -1;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }),
          });
        });

        allDecisionsList.forEach((decision) => {
          decision.participants = participantsByDecision.get(decision.id) || [];
          decision.topicIds = topicsByDecision.get(decision.id) || [];
          const creatorProfile = profileMap.get(decision.created_by);
          decision.creator = {
            user_id: decision.created_by,
            display_name: creatorProfile?.display_name || null,
            badge_color: creatorProfile?.badge_color || null,
            avatar_url: creatorProfile?.avatar_url || null,
          };
        });
      }

      sortDecisions(allDecisionsList);
      setDecisions(allDecisionsList);
    } catch (error) {
      debugConsole.error('Error loading decision requests:', error);
    }
  }, []);

  return { decisions, setDecisions, loadDecisionRequests };
};
