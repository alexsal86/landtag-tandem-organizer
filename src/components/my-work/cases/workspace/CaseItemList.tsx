import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ArrowDown, ArrowUp, Briefcase, CalendarDays, Circle, Clock, FileText, FolderOpen, Globe, GripVertical, Inbox, Link2, Phone, Plus, Trash2, Vote, Archive, ArchiveRestore } from "lucide-react";
import { de } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CaseFile, CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { CasesWorkspaceToolbar } from "./CasesWorkspaceToolbar";
import { CaseItemDetailContainer } from "./CaseItemDetailContainer";
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
  detailPanelForItem: (item: CaseItem, contactDisplay: string) => ReactNode;
  hasMoreItems: boolean;
  loadingMoreItems: boolean;
  loadMoreItems: () => Promise<unknown>;
};

export function CaseItemList(props: CaseItemListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" />
          <span>Vorgänge</span>
        </div>
        <div className="mt-2">
          <CasesWorkspaceToolbar
            title=""
            searchValue={props.itemFilterQuery}
            onSearchChange={props.onItemFilterQueryChange}
            searchPlaceholder="Vorgänge filtern…"
            onCreate={props.onCreateCaseItem}
            createLabel="Neu"
            onOpenArchive={props.onOpenArchive}
          />
          <p className="text-xs text-muted-foreground mt-1">{props.helperText}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5 overflow-hidden">
        <Droppable droppableId="case-items-list" isDropDisabled>
          {(provided) => (
            <div className="space-y-1.5 pr-2">
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5" tabIndex={0} onKeyDown={props.onListKeyDown}>
                {props.sortedCaseItems.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                    <p>Keine Vorgänge gefunden.</p>
                    <Button size="sm" onClick={props.onCreateCaseItem}>Vorgang erstellen</Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="hidden xl:grid grid-cols-[28px_34px_minmax(220px,2fr)_minmax(420px,4fr)_72px_minmax(90px,0.8fr)_36px_44px_92px] gap-2 border-b px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span />
                      <span className="group inline-flex items-center justify-center gap-0.5"><button type="button" className={props.sortButtonClass("channel", "asc")} onClick={() => props.toggleSort("channel", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("channel", "desc")} onClick={() => props.toggleSort("channel", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="group inline-flex items-center gap-0.5">Betreff<button type="button" className={props.sortButtonClass("subject", "asc")} onClick={() => props.toggleSort("subject", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("subject", "desc")} onClick={() => props.toggleSort("subject", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="group inline-flex items-center gap-0.5">Beschreibung<button type="button" className={props.sortButtonClass("description", "asc")} onClick={() => props.toggleSort("description", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("description", "desc")} onClick={() => props.toggleSort("description", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="group inline-flex items-center gap-0.5">Fällig<button type="button" className={props.sortButtonClass("due", "asc")} onClick={() => props.toggleSort("due", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("due", "desc")} onClick={() => props.toggleSort("due", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="group inline-flex items-center gap-0.5">Status<button type="button" className={props.sortButtonClass("status", "asc")} onClick={() => props.toggleSort("status", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("status", "desc")} onClick={() => props.toggleSort("status", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="group inline-flex items-center justify-center gap-0.5"><button type="button" className={props.sortButtonClass("priority", "asc")} onClick={() => props.toggleSort("priority", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("priority", "desc")} onClick={() => props.toggleSort("priority", "desc")}><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center justify-center">Öff./Akte</span>
                      <span className="group inline-flex items-center gap-0.5">Bearbeiter<button type="button" className={props.sortButtonClass("assignee", "asc")} onClick={() => props.toggleSort("assignee", "asc")}><ArrowUp className="h-3 w-3" /></button><button type="button" className={props.sortButtonClass("assignee", "desc")} onClick={() => props.toggleSort("assignee", "desc")}><ArrowDown className="h-3 w-3" /></button>{props.itemSort.secondary.enabled ? <button type="button" className="rounded p-0.5 transition-all hover:bg-muted" onClick={props.toggleSecondaryDirection}>{props.itemSort.secondary.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}</button> : null}<button type="button" className={cn("rounded p-0.5 ml-1 transition-all hover:bg-muted", props.itemSort.secondary.enabled && "bg-primary/15 text-primary")} onClick={props.toggleSecondarySort}><Link2 className="h-3 w-3" /></button></span>
                    </div>
                    {props.sortedCaseItems.map((item, index) => {
                      const linkedFile = item.case_file_id ? props.caseFilesById[item.case_file_id] : null;
                      const isActive = props.detailItemId === item.id;
                      const channel = item.source_channel ? props.sourceChannelMeta[item.source_channel] : null;
                      const ChannelIcon = channel?.icon ?? Briefcase;
                      const assigneeIds = props.getAssigneeIds(item);
                      const assignees = assigneeIds.map((id) => props.teamUsers.find((member) => member.id === id)).filter(Boolean) as TeamUser[];
                      const contactName = props.getContactName(item.intake_payload);
                      const contactDetail = props.getContactDetail(item.intake_payload);
                      const contactDisplay = [contactName, contactDetail].filter(Boolean).join(" · ");
                      return (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div ref={(el) => { dragProvided.innerRef(el); if (props.isHighlighted(item.id) && el) props.highlightRef(item.id)(el); }} {...dragProvided.draggableProps} className={cn("border-b outline-none focus:outline-none focus-visible:ring-0", dragSnapshot.isDragging && "opacity-80 shadow-lg rounded-md bg-background", props.isHighlighted(item.id) && "notification-highlight")}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <button type="button" className={cn("w-full px-2 py-2 text-left transition-colors hover:bg-muted/40", isActive && "bg-primary/5", props.focusedItemIndex >= 0 && props.focusedItemIndex === index && "ring-1 ring-primary/40")} onClick={() => props.handleSelectCaseItem(item)}>
                                    <div className="hidden xl:grid h-12 grid-cols-[28px_34px_minmax(220px,2fr)_minmax(420px,4fr)_72px_minmax(90px,0.8fr)_36px_44px_92px] items-center gap-2 text-xs text-muted-foreground">
                                      <span {...dragProvided.dragHandleProps} className="inline-flex items-center justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground" onClick={(e) => e.stopPropagation()}><GripVertical className="h-4 w-4" /></span>
                                      <span className="inline-flex" title={channel?.label || "Kanal unbekannt"}><span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground"><ChannelIcon className="h-4 w-4" /></span></span>
                                      <span className="truncate text-sm font-medium text-foreground inline-flex items-center gap-1">{props.getItemSubject(item)}</span>
                                      <span className="truncate text-sm font-medium text-foreground" title={props.getItemDescription(item) || "–"}>{props.getItemDescription(item) || "–"}</span>
                                      <span>{formatDateSafe(item.due_at, "dd.MM.yy", "–", { locale: de, warnKey: `${item.id}:due_at:list`, warnItemId: item.id, warnField: "due_at" })}</span>
                                      <span><Badge variant="outline" className={cn("text-[11px]", props.getStatusMeta(item.status).badgeClass)}>{props.getStatusMeta(item.status).label}</Badge></span>
                                      <span className="inline-flex items-center justify-center" title={props.priorityMeta(item.priority).label}><Circle className={cn("h-3.5 w-3.5 fill-current", props.priorityMeta(item.priority).color)} /></span>
                                      <span className="inline-flex items-center justify-center gap-0.5"><span className="inline-flex h-4 w-4 items-center justify-center">{item.visible_to_all && <Globe className="h-3.5 w-3.5 text-blue-500" />}</span><span className="inline-flex h-4 w-4 items-center justify-center">{linkedFile && <Link2 className="h-3.5 w-3.5 text-blue-500" />}</span></span>
                                      <div className="flex min-w-0 items-center" onClick={(event) => event.stopPropagation()}><div className="inline-flex items-end gap-1"><div className="relative z-10 flex items-center -space-x-2">{assignees.slice(0,3).map((member) => <Avatar key={member.id} className="h-6 w-6 border bg-background"><AvatarImage src={member.avatarUrl || undefined} /><AvatarFallback className="text-[10px]">{props.getInitials(member.name)}</AvatarFallback></Avatar>)}</div><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="outline" className="relative left-[-11px] z-0 mt-1 h-6 w-6 rounded-full border bg-background p-0 shadow-sm"><Plus className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56">{props.teamUsers.map((member) => <DropdownMenuCheckboxItem key={member.id} checked={assigneeIds.includes(member.id)} onCheckedChange={(checked) => { props.runAsync(() => props.handleAssigneeToggle(item, member.id, checked === true)); }}>{member.name}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div></div>
                                    </div>
                                    <div className="space-y-3 xl:hidden">
                                      <div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground"><ChannelIcon className="h-3 w-3" /></span><p className="truncate text-sm font-medium flex-1">{props.getItemSubject(item)}</p>{item.visible_to_all && <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />}{linkedFile && <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />}</div>{props.getItemDescription(item) && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{props.getItemDescription(item)}</p>}<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", props.getStatusMeta(item.status).badgeClass)}>{props.getStatusMeta(item.status).label}</Badge><span className="inline-flex items-center gap-1" title={props.priorityMeta(item.priority).label}><Circle className={cn("h-2.5 w-2.5 fill-current", props.priorityMeta(item.priority).color)} /></span>{contactDisplay && <span className="text-[10px]">👤 {contactDisplay}</span>}</div></div><span {...dragProvided.dragHandleProps} className="inline-flex items-center justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground pt-1" onClick={(e) => e.stopPropagation()}><GripVertical className="h-4 w-4" /></span></div>
                                      <div className="flex items-center justify-between gap-3 pt-2 border-t"><div className="flex items-center gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Inbox className="h-3 w-3" />{formatDateSafe(item.source_received_at, "dd.MM.yy", "–", { locale: de })}</span>{item.due_at && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateSafe(item.due_at, "dd.MM.yy", "–", { locale: de })}</span>}</div><div className="flex items-center" onClick={(event) => event.stopPropagation()}><div className="inline-flex items-end gap-1"><div className="relative z-10 flex items-center -space-x-2">{assignees.slice(0,2).map((member) => <Avatar key={member.id} className="h-6 w-6 border bg-background"><AvatarImage src={member.avatarUrl || undefined} /><AvatarFallback className="text-[10px]">{props.getInitials(member.name)}</AvatarFallback></Avatar>)}</div><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="icon" variant="outline" className="relative left-[-11px] z-0 mt-1 h-6 w-6 rounded-full border bg-background p-0 shadow-sm"><Plus className="h-3 w-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56">{props.teamUsers.map((member) => <DropdownMenuCheckboxItem key={member.id} checked={assigneeIds.includes(member.id)} onCheckedChange={(checked) => { props.runAsync(() => props.handleAssigneeToggle(item, member.id, checked === true)); }}>{member.name}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu></div></div></div>
                                    </div>
                                  </button>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56">
                                  <ContextMenuSub><ContextMenuSubTrigger>Status ändern</ContextMenuSubTrigger><ContextMenuSubContent className="w-48">{props.statusOptions.map((opt) => <ContextMenuItem key={opt.value} className={cn(item.status === opt.value && "bg-accent")} onClick={() => props.runAsync(() => props.handleQuickStatusChange(item, opt.value))}><span className={cn("mr-2 h-2 w-2 rounded-full inline-block", opt.dotColor)} />{opt.label}{item.status === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}</ContextMenuItem>)}</ContextMenuSubContent></ContextMenuSub>
                                  <ContextMenuSub><ContextMenuSubTrigger>Priorität ändern</ContextMenuSubTrigger><ContextMenuSubContent className="w-48">{props.priorityOptions.map((opt) => <ContextMenuItem key={opt.value} className={cn(item.priority === opt.value && "bg-accent")} onClick={() => props.runAsync(() => props.handleQuickPriorityChange(item, opt.value))}><Circle className={cn("mr-2 h-3 w-3 fill-current", opt.color)} />{opt.label}{item.priority === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}</ContextMenuItem>)}</ContextMenuSubContent></ContextMenuSub>
                                  <ContextMenuItem onClick={() => props.runAsync(() => props.handleQuickVisibilityChange(item, !item.visible_to_all))}><Globe className="mr-2 h-3 w-3" />{item.visible_to_all ? "Nicht öffentlich machen" : "Öffentlich machen"}</ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuSub><ContextMenuSubTrigger>Akte zuordnen</ContextMenuSubTrigger><ContextMenuSubContent className="w-56 max-h-64 overflow-y-auto">{item.case_file_id && <><ContextMenuItem onClick={() => props.runAsync(() => props.handleUnlinkFromFile(item))} className="text-destructive">Verknüpfung lösen</ContextMenuItem><ContextMenuSeparator /></>}{props.allCaseFiles.slice(0, 20).map((cf) => <ContextMenuItem key={cf.id} className={cn(item.case_file_id === cf.id && "bg-accent")} onClick={() => props.runAsync(() => props.handleQuickLinkToFile(item, cf.id))}><FolderOpen className="mr-2 h-3 w-3 shrink-0" /><span className="truncate">{cf.title}</span>{cf.reference_number && <span className="ml-auto text-xs text-muted-foreground pl-2">{cf.reference_number}</span>}</ContextMenuItem>)}</ContextMenuSubContent></ContextMenuSub>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => props.openDecisionCreator(item.id)}><Vote className="mr-2 h-3 w-3" />Entscheidung stellen</ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => props.openMeetingSelector(item.id)}><CalendarDays className="mr-2 h-3 w-3" />Zum Jour Fixe hinzufügen</ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => props.runAsync(() => props.handleArchiveCaseItem(item))}>{item.status === "archiviert" ? <ArchiveRestore className="mr-2 h-3 w-3" /> : <Archive className="mr-2 h-3 w-3" />}{item.status === "archiviert" ? "Wiederherstellen" : "Archivieren"}</ContextMenuItem>
                                  <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => props.onDeleteCaseItem(item.id)}><Trash2 className="mr-2 h-3 w-3" />Vorgang löschen</ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                              <CaseItemDetailContainer open={isActive && Boolean(props.editableCaseItem)}>{props.detailPanelForItem(item, contactDisplay)}</CaseItemDetailContainer>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {props.hasMoreItems && <div className="pt-2"><Button type="button" variant="outline" size="sm" disabled={props.loadingMoreItems} onClick={() => props.runAsync(props.loadMoreItems)}>{props.loadingMoreItems ? "Lade weitere Vorgänge…" : "Weitere Vorgänge laden"}</Button></div>}
                  </div>
                )}
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
}
