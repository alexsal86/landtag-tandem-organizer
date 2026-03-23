import { Droppable } from "@hello-pangea/dnd";
import { Archive, FileText, Trash2, ChevronRight } from "lucide-react";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { CaseFile } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { CasesWorkspaceToolbar } from "./CasesWorkspaceToolbar";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";

type CaseFileTypeConfig = { name: string; label?: string | null; color?: string | null };

type CaseFileListProps = {
  fileFilterQuery: string;
  onFileFilterQueryChange: (value: string) => void;
  onCreateCaseFile: () => void;
  onOpenArchive: () => void;
  filteredCaseFiles: CaseFile[];
  recentCaseFiles: CaseFile[];
  groupedCaseFiles: Record<string, CaseFile[]>;
  linkedItemsCountByFile: Record<string, number>;
  onSelectCaseFile: (cf: CaseFile) => void;
  onArchiveCaseFile: (cf: CaseFile) => void;
  onDeleteCaseFile: (cf: CaseFile) => void;
  caseFileTypes: CaseFileTypeConfig[];
  hasMoreFiles: boolean;
  loadingMoreFiles: boolean;
  onLoadMoreFiles: () => void;
};

const DroppableCaseFileRow = ({ cf, linkedCount, onSelectCaseFile, onArchiveCaseFile, onDeleteCaseFile }: { cf: CaseFile; linkedCount: number; onSelectCaseFile: (cf: CaseFile) => void; onArchiveCaseFile: (cf: CaseFile) => void; onDeleteCaseFile: (cf: CaseFile) => void; }) => (
  <Droppable key={cf.id} droppableId={`casefile-${cf.id}`}>
    {(dropProvided, dropSnapshot) => (
      <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full border-b px-2 py-2 text-left transition-colors hover:bg-muted/40 rounded-md",
                dropSnapshot.isDraggingOver && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20",
              )}
              onClick={() => onSelectCaseFile(cf)}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium line-clamp-1 flex-1">{cf.title}</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">{cf.reference_number && <span>{cf.reference_number}</span>}</div>
                {linkedCount > 0 && <span><FileText className="inline h-3 w-3 mr-0.5" />{linkedCount} {linkedCount === 1 ? "Vorgang" : "Vorgänge"}</span>}
              </div>
              {dropSnapshot.isDraggingOver && <p className="mt-1 text-xs text-blue-600 font-medium">Vorgang hier ablegen zum Verknüpfen</p>}
              {cf.current_status_note && !dropSnapshot.isDraggingOver && (
                <div className="mt-1 [&_p]:line-clamp-1">
                  <RichTextDisplay content={cf.current_status_note} className="text-xs" />
                </div>
              )}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => onArchiveCaseFile(cf)}>
              <Archive className="mr-2 h-3 w-3" />
              {cf.status === "archived" ? "Wiederherstellen" : "Archivieren"}
            </ContextMenuItem>
            <ContextMenuItem className="text-destructive" onClick={() => onDeleteCaseFile(cf)}>
              <Trash2 className="mr-2 h-3 w-3" />
              Löschen
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {dropProvided.placeholder}
      </div>
    )}
  </Droppable>
);

export function CaseFileList(props: CaseFileListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CasesWorkspaceToolbar
          title={<><FolderOpen className="h-4 w-4" />Fallakten</>}
          searchValue={props.fileFilterQuery}
          onSearchChange={props.onFileFilterQueryChange}
          searchPlaceholder="Filtern…"
          onCreate={props.onCreateCaseFile}
          createLabel="Neu"
          onOpenArchive={props.onOpenArchive}
          archiveButtonClassName="h-8 gap-1.5"
          searchClassName="relative"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 pr-2">
          {props.filteredCaseFiles.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
              <p>Keine Fallakten gefunden.</p>
              <Button size="sm" onClick={props.onCreateCaseFile}>Fallakte erstellen</Button>
            </div>
          ) : (
            <>
              {props.recentCaseFiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Zuletzt bearbeitet</p>
                  {props.recentCaseFiles.map((cf) => (
                    <DroppableCaseFileRow key={cf.id} cf={cf} linkedCount={props.linkedItemsCountByFile[cf.id] || 0} onSelectCaseFile={props.onSelectCaseFile} onArchiveCaseFile={props.onArchiveCaseFile} onDeleteCaseFile={props.onDeleteCaseFile} />
                  ))}
                </div>
              )}
              {Object.entries(props.groupedCaseFiles).map(([typeKey, files]) => {
                const typeConfig = props.caseFileTypes.find((t) => t.name === typeKey);
                const label = typeConfig?.label || typeKey;
                return (
                  <Collapsible key={typeKey}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-1 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors group">
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                      {typeConfig?.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeConfig.color }} />}
                      {label} ({files.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1.5 mt-1">
                      {files.map((cf) => (
                        <DroppableCaseFileRow key={cf.id} cf={cf} linkedCount={props.linkedItemsCountByFile[cf.id] || 0} onSelectCaseFile={props.onSelectCaseFile} onArchiveCaseFile={props.onArchiveCaseFile} onDeleteCaseFile={props.onDeleteCaseFile} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </>
          )}
          {props.hasMoreFiles && <Button type="button" variant="outline" size="sm" disabled={props.loadingMoreFiles} onClick={props.onLoadMoreFiles}>{props.loadingMoreFiles ? "Lade weitere Fallakten…" : "Weitere Fallakten laden"}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
