import { DecisionCardActivity as BaseDecisionCardActivity } from "@/components/task-decisions/DecisionCardActivity";
import { MyWorkDecision } from "../types";

interface DecisionCardActivityProps {
  currentUserId: string;
  decision: MyWorkDecision;
  onReply?: (payload: { responseId: string; text: string; mode: "creator_response" | "participant_followup" }) => Promise<void>;
}

export function DecisionCardActivity({ currentUserId, decision, onReply }: DecisionCardActivityProps) {
  return (
    <BaseDecisionCardActivity
      participants={decision.participants}
      maxItems={2}
      isCreator={decision.isCreator}
      currentUserId={currentUserId}
      creatorProfile={decision.creator ? {
        display_name: decision.creator.display_name,
        badge_color: decision.creator.badge_color,
        avatar_url: decision.creator.avatar_url,
      } : undefined}
      onReply={onReply}
    />
  );
}
