import { Button } from "@/components/ui/button";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { cn } from "@/lib/utils";
import { MessageSquare, Send } from "lucide-react";
import { MyWorkDecision } from "../types";

interface DecisionCardActionsProps {
  commentEditorKey: number;
  decision: MyWorkDecision;
  handleCompleteImmediately: () => void;
  handleOpenJustificationEditor: () => void;
  handleSubmitJustification: () => Promise<void>;
  isSubmittingComment: boolean;
  onResponseSubmitted: (meta?: { responseType: string; color?: string }) => void;
  promptColorClasses: { container: string; icon: string; submitButton: string };
  sanitizedCommentDraft: string;
  setCommentDraft: (value: string) => void;
  showCommentEditor: boolean;
  showCommentPrompt: boolean;
}

export function DecisionCardActions({ commentEditorKey, decision, handleCompleteImmediately, handleOpenJustificationEditor, handleSubmitJustification, isSubmittingComment, onResponseSubmitted, promptColorClasses, sanitizedCommentDraft, setCommentDraft, showCommentEditor, showCommentPrompt }: DecisionCardActionsProps) {
  return (
    <>
      {decision.isParticipant && decision.participant_id && (
        <TaskDecisionResponse
          decisionId={decision.id}
          participantId={decision.participant_id || ""}
          onResponseSubmitted={onResponseSubmitted}
          hasResponded={decision.hasResponded}
          creatorId={decision.created_by}
          layout="decision-panel"
          disabled={!decision.isParticipant || !decision.participant_id}
          showCreatorResponse={false}
        />
      )}

      {showCommentPrompt && (
        <div className={cn("animate-in fade-in slide-in-from-top-1 mt-3 rounded-lg border p-3 space-y-2", promptColorClasses.container)}>
          {!showCommentEditor ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-foreground"><MessageSquare className={cn("h-4 w-4", promptColorClasses.icon)} />Entscheidung erfasst.</div>
              <div className="text-xs text-muted-foreground">
                <button type="button" onClick={handleOpenJustificationEditor} className="underline underline-offset-2 hover:text-foreground transition-colors">Begründung hinzufügen</button> oder <button type="button" onClick={handleCompleteImmediately} className="underline underline-offset-2 hover:text-foreground transition-colors">sofort erledigen</button>.<br />
                Ohne Aktion wird in 10 Sekunden automatisch aktualisiert.
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MessageSquare className={cn("h-4 w-4", promptColorClasses.icon)} />Begründung ergänzen</div>
              <p className="text-xs text-muted-foreground">Bitte begründe deine Entscheidung kurz. Der Refresh erfolgt nach dem Absenden.</p>
              <SimpleRichTextEditor
                initialContent=""
                contentVersion={commentEditorKey}
                onChange={setCommentDraft}
                placeholder="Kurze Begründung eingeben..."
                minHeight="90px"
              />
              <div className="flex justify-end"><Button type="button" size="sm" onClick={() => void handleSubmitJustification()} disabled={isSubmittingComment || !sanitizedCommentDraft} className={promptColorClasses.submitButton}><Send className="h-3.5 w-3.5 mr-1" />{isSubmittingComment ? "Speichere..." : "Begründung absenden"}</Button></div>
            </>
          )}
        </div>
      )}
    </>
  );
}
