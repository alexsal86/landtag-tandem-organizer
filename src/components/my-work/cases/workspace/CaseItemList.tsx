import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Archive, Briefcase, CalendarDays, Circle, Clock, FileText, FolderOpen, Globe, GripVertical, Inbox, Link2, Mail, Phone, Plus, Trash2, Vote, ArchiveRestore } from "lucide-react";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CaseFile, CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { CasesWorkspaceToolbar } from "./CasesWorkspaceToolbar";
import { formatDateSafe } from "./utils/dateFormatting";

export type CaseItemSortKey = "channel" | "subject" | "description" | "status" | "received" | "due" | "category" | "priority" | "assignee";
export type SortDirection = "asc" | "desc";
export type SourceChannelMeta = Record<string, { icon: typeof Phone; label: string }>;

type StatusOption = { value: string; label: string; dotColor: string; badgeClass: string };
type PriorityOption = { value: string; label: string; color: string };

type CaseItemListProps = {
  itemFilterQuery: string;
  onItemFilterQueryChange: (value: string) => void;
  onCreateCaseItem: () => void;
  onOpenArchive: () => void;
  helperText: string;
  sortedCaseItems: CaseItem[];
  caseFilesById: Record<string, CaseFile>;
  allCaseFiles: CaseFile[];
  detailItemId: string | null;
  editableCaseItem: unknown;
  focusedItemIndex: number;
  onListKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  sortButtonClass: (key: CaseItemSortKey, direction: SortDirection) => string;
  toggleSort: (key: CaseItemSortKey, direction: SortDirection) => void;
  itemSort: { secondary: { enabled: boolean; direction: SortDirection } };
  toggleSecondarySort: () => void;
  toggleSecondaryDirection: () => void;
  getAssigneeIds: (item: CaseItem) => string[];
  teamUsers: TeamUser[];
  getCategory: (item: CaseItem) => string;
  getItemSubject: (item: CaseItem) => string;
  getItemDescription: (item: CaseItem) => string;
  getContactName: (payload: any) => string;
  getContactDetail: (payload: any) => string;
  sourceChannelMeta: SourceChannelMeta;
  getStatusMeta: (status: string | null) => StatusOption;
  priorityMeta: (priority: string | null) => { color: string; label: string };
  getInitials: (name: string) => string;
  isHighlighted: (id: string) => boolean;
  highlightRef: (id: string) => (node: HTMLElement | null) => void;
  handleSelectCaseItem: (item: CaseItem) => void;
  runAsync: (action: () => Promise<unknown>) => void;
  handleAssigneeToggle: (item: CaseItem, memberId: string, checked: boolean) => Promise<void>;
  statusOptions: StatusOption[];
  priorityOptions: PriorityOption[];
  handleQuickStatusChange: (item: CaseItem, newStatus: string) => Promise<void>;
  handleQuickPriorityChange: (item: CaseItem, newPriority: string) => Promise<void>;
  handleQuickVisibilityChange: (item: CaseItem, nextPublic: boolean) => Promise<void>;
  handleUnlinkFromFile: (item: CaseItem) => Promise<void>;
  handleQuickLinkToFile: (item: CaseItem, caseFileId: string) => Promise<void>;
  openDecisionCreator: (itemId: string) => void;
  openMeetingSelector: (itemId: string) => void;
  handleArchiveCaseItem: (item: CaseItem) => Promise<void>;
  onDeleteCaseItem: (itemId: string) => void;
  hasMoreItems: boolean;
  loadingMoreItems: boolean;
  loadMoreItems: () => Promise<unknown>;
};

export function CaseItemList(props: CaseItemListProps) {
  return (
    <div className="flex flex-col h-full min-h-0 border-r bg-muted/30">
      {/* Header */}
      <div className="shrink-0 p-3 border-b space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" />
          <span>Vorgänge</span>
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {props.sortedCaseItems.length}
          </span>
        </div>
        <CasesWorkspaceToolbar
          title=""
          searchValue={props.itemFilterQuery}
          onSearchChange={props.onItemFilterQueryChange}
          searchPlaceholder="Filtern…"
          onCreate={props.onCreateCaseItem}
          createLabel="Neu"
          onOpenArchive={props.onOpenArchive}
        />
      </div>

      {/* Compact card list */}
      <ScrollArea className="flex-1 min-h-0">
        <Droppable droppableId="case-items-list" isDropDisabled>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="p-1.5 space-y-0.5"
              tabIndex={0}
              onKeyDown={props.onListKeyDown}
            >
              {props.sortedCaseItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3 m-2">
                  <p>Keine Vorgänge gefunden.</p>
                  <Button size="sm" onClick={props.onCreateCaseItem}>Vorgang erstellen</Button>
                </div>
              ) : (
                props.sortedCaseItems.map((item, index) => {
                  const isActive = props.detailItemId === item.id;
                  const linkedFile = item.case_file_id ? props.caseFilesById[item.case_file_id] : null;
                  const channel = item.source_channel ? props.sourceChannelMeta[item.source_channel] : null;
                  const ChannelIcon = channel?.icon ?? Briefcase;
                  const statusMeta = props.getStatusMeta(item.status);
                  const contactName = props.getContactName(item.intake_payload);

                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={(el) => {
                            dragProvided.innerRef(el);
                            if (props.isHighlighted(item.id) && el) props.highlightRef(item.id)(el);
                          }}
                          {...dragProvided.draggableProps}
                          className={cn(
                            "outline-none focus:outline-none",
                            dragSnapshot.isDragging && "opacity-80 shadow-lg rounded-md bg-background z-50",
                            props.isHighlighted(item.id) && "notification-highlight",
                          )}
                        >
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "w-full text-left rounded-md px-2.5 py-2 transition-colors hover:bg-muted/60 group",
                                  isActive && "bg-primary/8 border-l-2 border-primary",
                                  !isActive && "border-l-2 border-transparent",
                                  props.focusedItemIndex >= 0 && props.focusedItemIndex === index && "ring-1 ring-primary/40",
                                )}
                                onClick={() => props.handleSelectCaseItem(item)}
                              >
                                {/* Row 1: Channel icon + Title */}
                                <div className="flex items-start gap-2">
                                  <span
                                    {...dragProvided.dragHandleProps}
                                    className="mt-0.5 inline-flex items-center justify-center cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </span>
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-muted-foreground shrink-0 mt-0.5">
                                    <ChannelIcon className="h-3 w-3" />
                                  </span>
                                  <p className="text-sm font-medium line-clamp-1 flex-1 min-w-0">
                                    {props.getItemSubject(item)}
                                  </p>
                                  <Circle className={cn("h-2.5 w-2.5 fill-current shrink-0 mt-1", props.priorityMeta(item.priority).color)} />
                                </div>

                                {/* Row 2: Description */}
                                {props.getItemDescription(item) && (
                                  <p className="text-xs text-muted-foreground line-clamp-1 ml-[38px] mt-0.5">
                                    {props.getItemDescription(item)}
                                  </p>
                                )}

                                {/* Row 3: Metadata chips */}
                                <div className="flex items-center gap-1.5 mt-1.5 ml-[38px] flex-wrap">
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", statusMeta.badgeClass)}>
                                    {statusMeta.label}
                                  </Badge>
                                  {item.due_at && (
                                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDateSafe(item.due_at, "dd.MM.", "–", { locale: de })}
                                    </span>
                                  )}
                                  {contactName && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                      👤 {contactName}
                                    </span>
                                  )}
                                  {linkedFile && (
                                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                                      <Link2 className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                  {item.visible_to_all && (
                                    <Globe className="h-2.5 w-2.5 text-blue-500" />
                                  )}
                                </div>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>Status ändern</ContextMenuSubTrigger>
                                <ContextMenuSubContent className="w-48">
                                  {props.statusOptions.map((opt) => (
                                    <ContextMenuItem
                                      key={opt.value}
                                      className={cn(item.status === opt.value && "bg-accent")}
                                      onClick={() => props.runAsync(() => props.handleQuickStatusChange(item, opt.value))}
                                    >
                                      <span className={cn("mr-2 h-2 w-2 rounded-full inline-block", opt.dotColor)} />
                                      {opt.label}
                                      {item.status === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                                    </ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>Priorität ändern</ContextMenuSubTrigger>
                                <ContextMenuSubContent className="w-48">
                                  {props.priorityOptions.map((opt) => (
                                    <ContextMenuItem
                                      key={opt.value}
                                      className={cn(item.priority === opt.value && "bg-accent")}
                                      onClick={() => props.runAsync(() => props.handleQuickPriorityChange(item, opt.value))}
                                    >
                                      <Circle className={cn("mr-2 h-3 w-3 fill-current", opt.color)} />
                                      {opt.label}
                                      {item.priority === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                                    </ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuItem onClick={() => props.runAsync(() => props.handleQuickVisibilityChange(item, !item.visible_to_all))}>
                                <Globe className="mr-2 h-3 w-3" />
                                {item.visible_to_all ? "Nicht öffentlich machen" : "Öffentlich machen"}
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>Akte zuordnen</ContextMenuSubTrigger>
                                <ContextMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                                  {item.case_file_id && (
                                    <>
                                      <ContextMenuItem onClick={() => props.runAsync(() => props.handleUnlinkFromFile(item))} className="text-destructive">
                                        Verknüpfung lösen
                                      </ContextMenuItem>
                                      <ContextMenuSeparator />
                                    </>
                                  )}
                                  {props.allCaseFiles.slice(0, 20).map((cf) => (
                                    <ContextMenuItem
                                      key={cf.id}
                                      className={cn(item.case_file_id === cf.id && "bg-accent")}
                                      onClick={() => props.runAsync(() => props.handleQuickLinkToFile(item, cf.id))}
                                    >
                                      <FolderOpen className="mr-2 h-3 w-3 shrink-0" />
                                      <span className="truncate">{cf.title}</span>
                                      {cf.reference_number && <span className="ml-auto text-xs text-muted-foreground pl-2">{cf.reference_number}</span>}
                                    </ContextMenuItem>
                                  ))}
                                </ContextMenuSubContent>
                              </ContextMenuSub>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => props.openDecisionCreator(item.id)}>
                                <Vote className="mr-2 h-3 w-3" />Entscheidung stellen
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => props.openMeetingSelector(item.id)}>
                                <CalendarDays className="mr-2 h-3 w-3" />Zum Jour Fixe hinzufügen
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => props.runAsync(() => props.handleArchiveCaseItem(item))}>
                                {item.status === "archiviert" ? <ArchiveRestore className="mr-2 h-3 w-3" /> : <Archive className="mr-2 h-3 w-3" />}
                                {item.status === "archiviert" ? "Wiederherstellen" : "Archivieren"}
                              </ContextMenuItem>
                              <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => props.onDeleteCaseItem(item.id)}>
                                <Trash2 className="mr-2 h-3 w-3" />Vorgang löschen
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      )}
                    </Draggable>
                  );
                })
              )}
              {props.hasMoreItems && (
                <div className="pt-2 px-2">
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled={props.loadingMoreItems} onClick={() => props.runAsync(props.loadMoreItems)}>
                    {props.loadingMoreItems ? "Lade…" : "Mehr laden"}
                  </Button>
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </ScrollArea>
    </div>
  );
}
