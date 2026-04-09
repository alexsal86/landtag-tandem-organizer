import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Archive, CalendarDays, Circle, FolderOpen, Globe, Link2, Trash2, Vote, ArchiveRestore, Phone } from "lucide-react";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CaseFile, CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { formatDateSafe } from "./utils/dateFormatting";

export type CaseItemSortKey = "channel" | "subject" | "description" | "status" | "received" | "due" | "category" | "priority" | "assignee";
export type SortDirection = "asc" | "desc";
export type SourceChannelMeta = Record<string, { icon: typeof Phone; label: string }>;

type StatusOption = { value: string; label: string; dotColor: string; badgeClass: string };
type PriorityOption = { value: string; label: string; color: string };

type CaseItemListProps = {
  onCreateCaseItem: () => void;
  onOpenArchive: () => void;
  itemQuery: string;
  onItemQueryChange: (value: string) => void;
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
    <div className="flex h-full min-h-0 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="shrink-0 space-y-2 border-b p-4">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-primary">Vorgangsliste</h3>
            <p className="text-sm text-muted-foreground">Übersicht und schneller Zugriff</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={props.onOpenArchive}>
            Archiv
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={props.itemQuery}
            onChange={(event) => props.onItemQueryChange(event.target.value)}
            placeholder="Suchen..."
            className="h-9"
          />
          <Button type="button" size="sm" onClick={props.onCreateCaseItem}>
            + Neu
          </Button>
        </div>
      </div>

      {/* Card list */}
      <ScrollArea className="flex-1 min-h-0">
        <Droppable droppableId="case-items-list" isDropDisabled>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2 p-2"
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
                  const statusMeta = props.getStatusMeta(item.status);
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
                                  "group w-full rounded-3xl border bg-card px-5 py-5 text-left transition-colors hover:bg-muted/30",
                                  isActive && "border-primary/60 bg-primary/5 shadow-sm",
                                  !isActive && "border-border",
                                  props.focusedItemIndex >= 0 && props.focusedItemIndex === index && "ring-1 ring-primary/40",
                                )}
                                onClick={() => props.handleSelectCaseItem(item)}
                              >
                                <div {...dragProvided.dragHandleProps}>
                                  {/* Row 1: Marker + title */}
                                  <div className="flex items-center gap-3">
                                    <Circle className={cn("h-[10px] w-[10px] shrink-0 fill-current", props.priorityMeta(item.priority).color)} />
                                    <p className="min-w-0 flex-1 text-sm font-bold leading-snug line-clamp-1">
                                      {props.getItemSubject(item)}
                                    </p>
                                  </div>

                                  {/* Row 2: Description */}
                                  {props.getItemDescription(item) && (
                                    <p className="mt-1 line-clamp-1 pl-[22px] text-sm text-muted-foreground">
                                      {props.getItemDescription(item)}
                                    </p>
                                  )}

                                  {/* Row 3: Date + status */}
                                  <div className="mt-2 flex items-center justify-between gap-2 pl-[22px]">
                                    <span className="text-xs text-muted-foreground">
                                      Fällig: {formatDateSafe(item.due_at, "dd.MM.yy", "–", { locale: de })}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "h-auto rounded-full border px-2 py-0.5 text-xs font-bold",
                                        statusMeta.badgeClass,
                                      )}
                                    >
                                      {statusMeta.label}
                                    </Badge>
                                  </div>

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
