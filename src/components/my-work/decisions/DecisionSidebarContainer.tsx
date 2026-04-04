import { SidebarDiscussionComment, SidebarNewComment, SidebarOpenQuestion } from "./types";
import { MyWorkDecisionSidebar } from "./MyWorkDecisionSidebar";

interface DecisionSidebarContainerProps {
  isCreateOpen: boolean;
  discussionComments?: SidebarDiscussionComment[];
  newComments: SidebarNewComment[];
  onCreateOpenChange: (open: boolean) => void;
  onDecisionCreated: () => void;
  onOpenDefaultParticipants: () => void;
  onSearchChange: (value: string) => void;
  onActivityClick?: (activity: { decisionId: string; type: "comment" | "response" | "decision"; targetId: string }) => void;
  onCommentClick: (decisionId: string) => void;
  onQuestionClick: (decisionId: string) => void;
  onResponseSent?: () => void;
  openQuestions: SidebarOpenQuestion[];
  pendingDirectReplies: SidebarNewComment[];
  searchQuery: string;
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
