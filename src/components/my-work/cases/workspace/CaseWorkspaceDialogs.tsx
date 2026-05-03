import { ArchiveRestore } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { CaseItemMeetingSelector } from "@/components/my-work/CaseItemMeetingSelector";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { CaseFileCreateDialog } from "@/features/cases/files/components";
import type { CaseFile, CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";

type ArchivedItem = { id: string; title: string; subtitle: string; onRestore: () => void };
type DeleteConfig = { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void };

type CaseWorkspaceDialogsProps = {
  isCaseItemDialogOpen: boolean;
  setIsCaseItemDialogOpen: (open: boolean) => void;
  onCaseItemCreated: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createCaseItem: (...args: any[]) => any;
  teamUsers: TeamUser[];
  defaultAssigneeId: string | null;
  categoryOptions: string[];
  isCaseFileDialogOpen: boolean;
  onCaseFileDialogOpenChange: (open: boolean) => void;
  onCaseFileCreated: (id: string) => void;
  isDecisionCreatorOpen: boolean;
  setIsDecisionCreatorOpen: (open: boolean) => void;
  decisionCreatorItemId: string | null;
  caseItems: CaseItem[];
  onDecisionCreatorReload: () => void;
  onDecisionCreatedWithId: (decisionId: string) => void;
  isMeetingSelectorOpen: boolean;
  setIsMeetingSelectorOpen: (open: boolean) => void;
  onMeetingSelected: (meetingId: string, meetingTitle: string) => void | Promise<void>;
  onMarkForNextJourFixe: () => void | Promise<void>;
  archivedCaseItems: ArchivedItem[];
  isItemArchiveOpen: boolean;
  setIsItemArchiveOpen: (open: boolean) => void;
  archivedCaseFiles: ArchivedItem[];
  isFileArchiveOpen: boolean;
  setIsFileArchiveOpen: (open: boolean) => void;
  deleteCaseFile: DeleteConfig;
  deleteCaseItem: DeleteConfig;
};

export function CaseWorkspaceDialogs(props: CaseWorkspaceDialogsProps) {
  return (
    <>
      <CaseItemCreateDialog
        open={props.isCaseItemDialogOpen}
        onOpenChange={props.setIsCaseItemDialogOpen}
        onCreated={props.onCaseItemCreated}
        createCaseItem={props.createCaseItem}
        assignees={props.teamUsers}
        defaultAssigneeId={props.defaultAssigneeId}
        categoryOptions={props.categoryOptions}
      />

      <CaseFileCreateDialog
        open={props.isCaseFileDialogOpen}
        onOpenChange={props.onCaseFileDialogOpenChange}
        onSuccess={(caseFile) => props.onCaseFileCreated(caseFile.id)}
      />

      {props.isDecisionCreatorOpen && (
        <StandaloneDecisionCreator
          isOpen={props.isDecisionCreatorOpen}
          onOpenChange={props.setIsDecisionCreatorOpen}
          onDecisionCreated={props.onDecisionCreatorReload}
          caseItemId={props.decisionCreatorItemId || undefined}
          defaultTitle={props.decisionCreatorItemId ? (props.caseItems.find((item) => item.id === props.decisionCreatorItemId)?.subject || "") : ""}
          defaultDescription={props.decisionCreatorItemId ? (props.caseItems.find((item) => item.id === props.decisionCreatorItemId)?.summary || "") : ""}
          onCreatedWithId={props.onDecisionCreatedWithId}
        />
      )}

      <CaseItemMeetingSelector
        open={props.isMeetingSelectorOpen}
        onOpenChange={props.setIsMeetingSelectorOpen}
        onSelect={props.onMeetingSelected}
        onMarkForNextJourFixe={props.onMarkForNextJourFixe}
      />

      <Dialog open={props.isItemArchiveOpen} onOpenChange={props.setIsItemArchiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Archivierte Vorgänge</DialogTitle>
            <DialogDescription>Vorgänge verwalten und bei Bedarf wiederherstellen.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {props.archivedCaseItems.length === 0 ? <p className="text-sm text-muted-foreground">Keine archivierten Vorgänge vorhanden.</p> : props.archivedCaseItems.map((item) => (
              <div key={item.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </div>
                <Button size="sm" variant="outline" onClick={item.onRestore}>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                  Wiederherstellen
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={props.isFileArchiveOpen} onOpenChange={props.setIsFileArchiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Archivierte Fallakten</DialogTitle>
            <DialogDescription>Fallakten verwalten und bei Bedarf wiederherstellen.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {props.archivedCaseFiles.length === 0 ? <p className="text-sm text-muted-foreground">Keine archivierten Fallakten vorhanden.</p> : props.archivedCaseFiles.map((cf) => (
              <div key={cf.id} className="border rounded-md p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{cf.title}</p>
                  <p className="text-xs text-muted-foreground">{cf.subtitle}</p>
                </div>
                <Button size="sm" variant="outline" onClick={cf.onRestore}>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                  Wiederherstellen
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={props.deleteCaseFile.open} onOpenChange={props.deleteCaseFile.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fallakte löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Fallakte und ihre Verknüpfungen werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={props.deleteCaseFile.onConfirm}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={props.deleteCaseItem.open} onOpenChange={props.deleteCaseItem.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorgang endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vorgang wird unwiderruflich gelöscht. Verknüpfte Zeitstrahlereignisse und Interaktionen gehen ebenfalls verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={props.deleteCaseItem.onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
