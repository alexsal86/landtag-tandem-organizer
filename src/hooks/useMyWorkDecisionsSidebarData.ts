import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MyWorkDecision, SidebarDiscussionComment, SidebarNewComment, SidebarOpenQuestion } from "@/components/my-work/decisions/types";

export function useMyWorkDecisionsSidebarData(decisions: MyWorkDecision[], userId?: string) {
  const [sidebarComments, setSidebarComments] = useState<SidebarDiscussionComment[]>([]);
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;

    if (!userId || decisions.length === 0) {
      setSidebarComments([]);
      return;
    }

    const loadDiscussionComments = async () => {
      const decisionIds = decisions.map((d) => d.id);
      const { data: comments } = await supabase
        .from("task_decision_comments")
        .select("id, decision_id, user_id, content, created_at")
        .in("decision_id", decisionIds)
        .order("created_at", { ascending: false })
        .limit(40);

      if (requestRef.current !== requestId) return;

      if (!comments || comments.length === 0) {
        setSidebarComments([]);
        return;
      }

      const userIds = [...new Set(comments.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, badge_color, avatar_url")
        .in("user_id", userIds);

      if (requestRef.current !== requestId) return;

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const decisionTitleMap = new Map(decisions.map((d) => [d.id, d.title]));

      const recentComments: SidebarDiscussionComment[] = comments.map((c) => {
        const profile = profileMap.get(c.user_id);
        const isMention = c.content?.includes(`data-mention-user-id="${userId}"`) || false;
        return {
          id: c.id,
          decisionId: c.decision_id,
          decisionTitle: decisionTitleMap.get(c.decision_id) || "Entscheidung",
          authorName: profile?.display_name || null,
          authorBadgeColor: profile?.badge_color || null,
          authorAvatarUrl: profile?.avatar_url || null,
          content: c.content,
          createdAt: c.created_at,
          isMention,
        };
      });

      setSidebarComments(recentComments);
    };

    void loadDiscussionComments();
  }, [decisions, userId]);

  return useMemo(() => {
    const openQuestions: SidebarOpenQuestion[] = [];
    const newComments: SidebarNewComment[] = [];

    decisions.forEach((decision) => {
      decision.participants?.forEach((participant) => {
        const latest = participant.responses[0];
        if (!latest) return;

        if (decision.isCreator && latest.response_type === "question" && !latest.creator_response) {
          openQuestions.push({
            id: latest.id,
            decisionId: decision.id,
            decisionTitle: decision.title,
            participantName: participant.profile?.display_name || null,
            participantBadgeColor: participant.profile?.badge_color || null,
            participantAvatarUrl: participant.profile?.avatar_url || null,
            comment: latest.comment,
            createdAt: latest.created_at,
          });
        }

        if (decision.isCreator && latest.comment && latest.response_type !== "question" && !latest.creator_response) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (new Date(latest.created_at) > sevenDaysAgo) {
            newComments.push({
              id: latest.id,
              decisionId: decision.id,
              decisionTitle: decision.title,
              participantName: participant.profile?.display_name || null,
              participantBadgeColor: participant.profile?.badge_color || null,
              participantAvatarUrl: participant.profile?.avatar_url || null,
              responseType: latest.response_type,
              comment: latest.comment,
              createdAt: latest.created_at,
            });
          }
        }
      });
    });

    const responseActivities = decisions
      .filter((decision) => decision.status !== "archived")
      .flatMap((decision) =>
        (decision.participants || []).flatMap((participant) =>
          participant.responses.map((response) => ({
            id: `response-${response.id}`,
            decisionId: decision.id,
            decisionTitle: decision.title,
            type: "response" as const,
            actorName: participant.profile?.display_name || null,
            actorBadgeColor: participant.profile?.badge_color || null,
            actorAvatarUrl: participant.profile?.avatar_url || null,
            content: response.comment,
            createdAt: response.created_at,
          })),
        ),
      );

    const commentActivities = sidebarComments.map((comment) => ({
      id: `comment-${comment.id}`,
      decisionId: comment.decisionId,
      decisionTitle: comment.decisionTitle,
      type: "comment" as const,
      actorName: comment.authorName,
      actorBadgeColor: comment.authorBadgeColor,
      actorAvatarUrl: comment.authorAvatarUrl,
      content: comment.content,
      createdAt: comment.createdAt,
    }));

    const recentActivities = [...responseActivities, ...commentActivities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);

    return { openQuestions, newComments, discussionComments: sidebarComments, recentActivities };
  }, [decisions, sidebarComments]);
}
