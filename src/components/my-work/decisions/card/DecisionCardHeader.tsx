import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Archive, CheckCircle, ClipboardList, Edit, Globe, MoreVertical, Star, Trash2 } from "lucide-react";
import { MyWorkDecision, getResponseSummary } from "../types";
import { getDecisionStatus } from "../utils";

interface DecisionCardHeaderProps {
  archivingDecisionId?: string | null;
  creatingTaskId: string | null;
  decision: MyWorkDecision;
  deletingDecisionId?: string | null;
  onArchive: (decisionId: string) => void;
  onCreateTask: (decision: MyWorkDecision) => void;
  onDelete: (decisionId: string) => void;
  onEdit: (decisionId: string) => void;
}

export function DecisionCardHeader({ archivingDecisionId, creatingTaskId, decision, deletingDecisionId, onArchive, onCreateTask, onDelete, onEdit }: DecisionCardHeaderProps) {
  const summary = getResponseSummary(decision.participants);
  const isArchiving = archivingDecisionId === decision.id;
  const isDeleting = deletingDecisionId === decision.id;
  const isBusy = isArchiving || isDeleting;
  const status = getDecisionStatus(decision);

  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        {status === "question" ? (
          <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-sm px-3 py-1 font-bold">Rückfrage</Badge>
        ) : status === "decided" ? (
          <Badge className="bg-green-100 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-sm px-3 py-1 font-bold">Entschieden</Badge>
        ) : status === "pending" ? (
          <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-sm px-3 py-1 font-bold">Ausstehend</Badge>
        ) : null}

        {(decision.priority ?? 0) > 0 && (
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Star className="h-4 w-4 text-amber-500 fill-amber-500" /></TooltipTrigger><TooltipContent><p>Prioritär</p></TooltipContent></Tooltip></TooltipProvider>
        )}
        {decision.visible_to_all && (
          <TooltipProvider><Tooltip><TooltipTrigger asChild><Globe className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Öffentlich</p></TooltipContent></Tooltip></TooltipProvider>
        )}
        {decision.hasResponded && decision.isParticipant && <CheckCircle className="h-4 w-4 text-emerald-500" />}
      </div>

      {decision.isCreator && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onEdit(decision.id); }}><Edit className="h-4 w-4 mr-2" />Bearbeiten</DropdownMenuItem>
            <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onArchive(decision.id); }} disabled={isBusy}><Archive className="h-4 w-4 mr-2" />{isArchiving ? "Archiviere..." : "Archivieren"}</DropdownMenuItem>
            {summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onCreateTask(decision); }} disabled={creatingTaskId === decision.id || isBusy}><ClipboardList className="h-4 w-4 mr-2" />{creatingTaskId === decision.id ? "Erstelle..." : "Aufgabe erstellen"}</DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(event) => { event.stopPropagation(); onDelete(decision.id); }} disabled={isBusy} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />{isDeleting ? "Lösche..." : "Löschen"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
