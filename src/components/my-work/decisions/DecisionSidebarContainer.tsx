import { SidebarDiscussionComment, SidebarNewComment, SidebarOpenQuestion } from "./types";
import { MyWorkDecisionSidebar } from "./MyWorkDecisionSidebar";

interface DecisionSidebarContainerProps {
  discussionComments?: SidebarDiscussionComment[];
  newComments: SidebarNewComment[];
  onActivityClick?: (activity: { decisionId: string; type: "comment" | "response" | "decision"; targetId: string }) => void;
  onCommentClick: (decisionId: string) => void;
  onQuestionClick: (decisionId: string) => void;
  onResponseSent?: () => void;
  openQuestions: SidebarOpenQuestion[];
  pendingDirectReplies: SidebarNewComment[];
  recentActivities?: Array<{
    id: string;
    decisionId: string;
    decisionTitle: string;
    type: "comment" | "response" | "decision";
    targetId: string;
    actorName: string | null;
    actorBadgeColor: string | null;
    actorAvatarUrl: string | null;
    content: string | null;
    createdAt: string;
  }>;
}

export function DecisionSidebarContainer(props: DecisionSidebarContainerProps) {
  return <MyWorkDecisionSidebar {...props} />;
}
