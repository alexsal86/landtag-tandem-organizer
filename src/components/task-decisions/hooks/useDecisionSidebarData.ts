import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ParticipantProfile } from "@/types/taskDecisions";

type SidebarProfile = ParticipantProfile;

interface DecisionParticipant {
  user_id: string;
  profile?: {
    display_name?: string | null;
    badge_color?: string | null;
    avatar_url?: string | null;
  } | null;
  responses: Array<{
    id: string;
    response_type: string;
    comment: string | null;
    creator_response: string | null;
    parent_response_id?: string | null;
    created_at: string;
    updated_at?: string | null;
  }>;
}

interface DecisionForSidebar {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  created_at: string;
  isCreator: boolean;
  creator?: {
    user_id: string;
    display_name?: string | null;
    badge_color?: string | null;
    avatar_url?: string | null;
  } | null;
  participants?: DecisionParticipant[];
}

export function useDecisionSidebarData(decisions: DecisionForSidebar[], currentUserId: string | undefined) {
  const [recentDiscussionActivities, setRecentDiscussionActivities] = useState<
    Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      type: "comment";
      targetId: string;
      actorName: string | null;
      actorBadgeColor: string | null;
      actorAvatarUrl: string | null;
      content: string | null;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    if (decisions.length === 0) {
      setRecentDiscussionActivities([]);
      return;
    }

    const loadRecentComments = async () => {
      const decisionIds = decisions.map((d) => d.id);
      const { data: comments } = await supabase
        .from("task_decision_comments")
        .select("id, decision_id, user_id, content, created_at")
        .in("decision_id", decisionIds)
        .order("created_at", { ascending: false })
        .limit(40);

      if (!comments || comments.length === 0) {
        setRecentDiscussionActivities([]);
        return;
      }

      const decisionTitleMap = new Map(decisions.map((d) => [d.id, d.title]));
      const userIds = [...new Set(comments.map((c: Record<string, any>) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, badge_color, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map<string, SidebarProfile>((profiles ?? []).map((profile: Record<string, any>) => [profile.user_id, profile]));

      setRecentDiscussionActivities(
        comments.map((comment: Record<string, any>) => ({
          id: `comment-${comment.id}`,
          decisionId: comment.decision_id,
          decisionTitle: decisionTitleMap.get(comment.decision_id) || "Entscheidung",
          type: "comment" as const,
          targetId: comment.id,
          actorName: profileMap.get(comment.user_id)?.display_name || null,
          actorBadgeColor: profileMap.get(comment.user_id)?.badge_color || null,
          actorAvatarUrl: profileMap.get(comment.user_id)?.avatar_url || null,
          content: comment.content,
          createdAt: comment.created_at,
        })),
      );
    };

    loadRecentComments();
  }, [decisions]);

  const sidebarData = useMemo(() => {
    const openQuestions: Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      participantName: string | null;
      participantBadgeColor: string | null;
      participantUserId: string;
      participantAvatarUrl: string | null;
      comment: string | null;
      createdAt: string;
      hasCreatorResponse: boolean;
    }> = [];

    const newComments: Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      participantName: string | null;
      participantBadgeColor: string | null;
      participantUserId: string;
      participantAvatarUrl: string | null;
      responseType: string;
      comment: string | null;
      createdAt: string;
    }> = [];

    const pendingDirectReplies: Array<{
      id: string;
      decisionId: string;
      decisionTitle: string;
      participantName: string | null;
      participantBadgeColor: string | null;
      participantUserId: string;
      participantAvatarUrl: string | null;
      responseType: string;
      comment: string | null;
      createdAt: string;
    }> = [];

    decisions.forEach((decision) => {
      if (decision.status === "archived") return;

      decision.participants?.forEach((participant) => {
        const rootResponses = participant.responses.filter((r) => !r.parent_response_id);
        const latestResponse = rootResponses[0];
        if (!latestResponse) return;

        if (
          decision.isCreator &&
          latestResponse.response_type === "question" &&
          !latestResponse.creator_response
        ) {
          openQuestions.push({
            id: latestResponse.id,
            decisionId: decision.id,
            decisionTitle: decision.title,
            participantName: participant.profile?.display_name || null,
            participantBadgeColor: participant.profile?.badge_color || null,
            participantUserId: participant.user_id,
            participantAvatarUrl: participant.profile?.avatar_url || null,
            comment: latestResponse.comment,
            createdAt: latestResponse.created_at,
            hasCreatorResponse: false,
          });
        }

        if (
          decision.isCreator &&
          latestResponse.comment &&
          !latestResponse.creator_response
        ) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (
            new Date(latestResponse.created_at) > sevenDaysAgo &&
            latestResponse.response_type !== "question"
          ) {
            newComments.push({
              id: latestResponse.id,
              decisionId: decision.id,
              decisionTitle: decision.title,
              participantName: participant.profile?.display_name || null,
              participantBadgeColor: participant.profile?.badge_color || null,
              participantUserId: participant.user_id,
              participantAvatarUrl: participant.profile?.avatar_url || null,
              responseType: latestResponse.response_type,
              comment: latestResponse.comment,
              createdAt: latestResponse.created_at,
            });
          }
        }

        const participantHasFollowedUp = participant.responses.some(
          (response) =>
            response.parent_response_id === latestResponse.id &&
            new Date(response.created_at).getTime() >
              new Date(latestResponse.updated_at || latestResponse.created_at).getTime(),
        );

        if (
          currentUserId &&
          participant.user_id === currentUserId &&
          !decision.isCreator &&
          latestResponse.creator_response &&
          !participantHasFollowedUp
        ) {
          pendingDirectReplies.push({
            id: latestResponse.id,
            decisionId: decision.id,
            decisionTitle: decision.title,
            participantName: decision.creator?.display_name || null,
            participantBadgeColor: decision.creator?.badge_color || null,
            participantUserId: decision.creator?.user_id || "",
            participantAvatarUrl: decision.creator?.avatar_url || null,
            responseType: latestResponse.response_type,
            comment: latestResponse.creator_response,
            createdAt: latestResponse.updated_at || latestResponse.created_at,
          });
        }
      });
    });

    const responseActivities = decisions
      .filter((d) => d.status !== "archived")
      .flatMap((decision) =>
        (decision.participants || []).flatMap((participant) =>
          participant.responses.map((response) => ({
            id: `response-${response.id}`,
            decisionId: decision.id,
            decisionTitle: decision.title,
            type: "response" as const,
            targetId: response.id,
            actorName: participant.profile?.display_name || null,
            actorBadgeColor: participant.profile?.badge_color || null,
            actorAvatarUrl: participant.profile?.avatar_url || null,
            content: response.comment,
            createdAt: response.created_at,
          })),
        ),
      );

    const decisionActivities = decisions
      .filter((d) => d.status !== "archived")
      .map((decision) => ({
        id: `decision-${decision.id}`,
        decisionId: decision.id,
        decisionTitle: decision.title,
        type: "decision" as const,
        targetId: decision.id,
        actorName: null,
        actorBadgeColor: null,
        actorAvatarUrl: null,
        content: decision.description || null,
        createdAt: decision.created_at,
      }));

    const recentActivities = [
      ...responseActivities,
      ...recentDiscussionActivities,
      ...decisionActivities,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { openQuestions, newComments, pendingDirectReplies, recentActivities };
  }, [decisions, recentDiscussionActivities, currentUserId]);

  return sidebarData;
}
