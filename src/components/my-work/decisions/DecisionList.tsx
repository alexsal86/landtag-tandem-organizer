import { DecisionContextMenu } from "./DecisionContextMenu";
import { MyWorkDecisionCard } from "./MyWorkDecisionCard";
import { MyWorkDecision } from "./types";

interface DecisionListProps {
  archivingDecisionId: string | null;
  creatingTaskId: string | null;
  currentUserId: string;
  decisions: MyWorkDecision[];
  deletingDecisionId: string | null;
  emptyMessage: string;
  getCommentCount: (decisionId: string) => number;
  getHighlightRef: (decisionId: string) => ((el: HTMLElement | null) => void) | undefined;
  isHighlighted: (decisionId: string) => boolean;
  onAddParticipants: (decisionId: string, userIds: string[]) => Promise<void>;
  onAddToJourFixe: (decisionId: string) => void;
  onArchive: (decisionId: string) => void;
  onCreateTask: (decision: MyWorkDecision) => Promise<void>;
  onDelete: (decisionId: string) => void;
  onEdit: (decisionId: string) => void;
  onOpenComments: (decisionId: string, title: string) => void;
  onOpenDetails: (decisionId: string) => void;
  onRemoveParticipant: (decisionId: string, userId: string) => Promise<void>;
  onReply?: (payload: {
    responseId: string;
    text: string;
    mode: "creator_response" | "participant_followup";
  }) => Promise<void>;
  onResponseSubmitted: () => void;
  onTogglePriority: (decisionId: string, currentPriority: number) => Promise<void>;
  onTogglePublic: (decisionId: string, currentValue: boolean) => Promise<void>;
  onUpdateDeadline: (decisionId: string, date: string | null) => Promise<void>;
  tenantUsers: Array<{ id: string; display_name?: string | null; avatar_url?: string | null }>;
}

export function DecisionList({
  archivingDecisionId,
  creatingTaskId,
  currentUserId,
  decisions,
  deletingDecisionId,
  emptyMessage,
  getCommentCount,
  getHighlightRef,
  isHighlighted,
  onAddParticipants,
  onAddToJourFixe,
  onArchive,
  onCreateTask,
  onDelete,
  onEdit,
  onOpenComments,
  onOpenDetails,
  onRemoveParticipant,
  onReply,
  onResponseSubmitted,
  onTogglePriority,
  onTogglePublic,
  onUpdateDeadline,
  tenantUsers,
}: DecisionListProps) {
  if (decisions.length === 0) {
    return <div className="py-8 text-center text-xs text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {decisions.map((decision) => (
        <div key={decision.id} className="w-full">
          <DecisionContextMenu
            decision={decision}
            isCreator={decision.isCreator}
            tenantUsers={tenantUsers}
            existingParticipantIds={(decision.participants || []).map(
              (participant) => participant.user_id,
            )}
            onUpdateDeadline={onUpdateDeadline}
            onTogglePublic={onTogglePublic}
            onAddParticipants={onAddParticipants}
            onRemoveParticipant={onRemoveParticipant}
            onArchive={onArchive}
            onDelete={onDelete}
            onAddToJourFixe={onAddToJourFixe}
            onTogglePriority={onTogglePriority}
          >
            <MyWorkDecisionCard
              decision={decision}
              isHighlighted={isHighlighted(decision.id)}
              highlightRef={getHighlightRef(decision.id)}
              onOpenDetails={onOpenDetails}
              onEdit={onEdit}
              onArchive={onArchive}
              onDelete={onDelete}
              onCreateTask={onCreateTask}
              onResponseSubmitted={onResponseSubmitted}
              onOpenComments={onOpenComments}
              onReply={onReply}
              commentCount={getCommentCount(decision.id)}
              creatingTaskId={creatingTaskId}
              archivingDecisionId={archivingDecisionId}
              deletingDecisionId={deletingDecisionId}
              currentUserId={currentUserId}
            />
          </DecisionContextMenu>
        </div>
      ))}
    </div>
  );
}
