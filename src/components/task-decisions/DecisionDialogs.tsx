import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DecisionComments } from './DecisionComments';
import { DecisionAttachmentPreviewDialog } from './DecisionAttachmentPreviewDialog';
import { DecisionEditDialog } from './DecisionEditDialog';
import { DefaultParticipantsDialog } from './DefaultParticipantsDialog';
import { TaskDecisionDetails } from './TaskDecisionDetails';
import { DecisionTabId } from '@/hooks/useMyWorkSettings';

interface DecisionDialogsProps {
  selectedDecisionId: string | null;
  isDetailsOpen: boolean;
  onCloseDetails: () => void;
  onArchived: () => void;
  highlightCommentId: string | null;
  highlightResponseId: string | null;
  editingDecisionId: string | null;
  setEditingDecisionId: (value: string | null) => void;
  onUpdated: () => void;
  commentsDecisionId: string | null;
  commentsDecisionTitle: string;
  onCloseComments: () => void;
  onCommentAdded: () => void;
  defaultParticipantsOpen: boolean;
  onDefaultParticipantsOpenChange: (open: boolean) => void;
  decisionTabOrder: DecisionTabId[];
  hiddenDecisionTabs: DecisionTabId[];
  updateDecisionTabSettings: (settings: { order: DecisionTabId[]; hiddenTabs: DecisionTabId[] }) => Promise<boolean>;
  previewAttachment: { file_path: string; file_name: string } | null;
  onPreviewAttachmentChange: () => void;
  deletingDecisionId: string | null;
  setDeletingDecisionId: (value: string | null) => void;
  onDeleteDecision: () => void;
}

export const DecisionDialogs = ({
  selectedDecisionId,
  isDetailsOpen,
  onCloseDetails,
  onArchived,
  highlightCommentId,
  highlightResponseId,
  editingDecisionId,
  setEditingDecisionId,
  onUpdated,
  commentsDecisionId,
  commentsDecisionTitle,
  onCloseComments,
  onCommentAdded,
  defaultParticipantsOpen,
  onDefaultParticipantsOpenChange,
  decisionTabOrder,
  hiddenDecisionTabs,
  updateDecisionTabSettings,
  previewAttachment,
  onPreviewAttachmentChange,
  deletingDecisionId,
  setDeletingDecisionId,
  onDeleteDecision,
}: DecisionDialogsProps) => (
  <>
    {selectedDecisionId && (
      <TaskDecisionDetails
        decisionId={selectedDecisionId}
        isOpen={isDetailsOpen}
        onClose={onCloseDetails}
        onArchived={onArchived}
        highlightCommentId={highlightCommentId}
        highlightResponseId={highlightResponseId}
      />
    )}

    {editingDecisionId && (
      <DecisionEditDialog
        decisionId={editingDecisionId}
        isOpen={true}
        onClose={() => setEditingDecisionId(null)}
        onUpdated={onUpdated}
      />
    )}

    {commentsDecisionId && (
      <DecisionComments
        decisionId={commentsDecisionId}
        decisionTitle={commentsDecisionTitle}
        isOpen={!!commentsDecisionId}
        onClose={onCloseComments}
        onCommentAdded={onCommentAdded}
      />
    )}

    <DefaultParticipantsDialog
      open={defaultParticipantsOpen}
      onOpenChange={onDefaultParticipantsOpenChange}
      decisionTabSettings={{
        order: decisionTabOrder,
        hiddenTabs: hiddenDecisionTabs,
        onSave: updateDecisionTabSettings,
      }}
    />

    <DecisionAttachmentPreviewDialog
      open={!!previewAttachment}
      onOpenChange={onPreviewAttachmentChange}
      filePath={previewAttachment?.file_path || ''}
      fileName={previewAttachment?.file_name || ''}
    />

    <AlertDialog open={!!deletingDecisionId} onOpenChange={() => setDeletingDecisionId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Entscheidung endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Diese Aktion löscht die Entscheidung unwiderruflich. Alle zugehörigen Antworten und Kommentare werden ebenfalls gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onDeleteDecision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
