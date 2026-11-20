import type { Dispatch, SetStateAction, KeyboardEvent } from "react";
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GripVertical,
  Plus,
  Trash,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ListTodo,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItem, LinkedTask, Profile } from "../types";
import { AgendaRowDetails } from "./AgendaRowDetails";
import { stripHtml } from "@/utils/textDiff";
interface Props {
  item: AgendaItem;
  index: number;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  hasEditPermission: boolean;
  selectedKey: string | null;
  setSelectedKey: (key: string) => void;
  getItemKey: (item: AgendaItem, index: number) => string;
  getAgendaNumber: (item: AgendaItem) => string | undefined;
  change: (index: number, field: keyof AgendaItem, value: unknown) => void;
  handleTitleKeyDown: (
    e: KeyboardEvent<HTMLInputElement>,
    item: AgendaItem,
    index: number,
  ) => void;
  subItemCount: number;
  documentCount: number;
  isMainItemCollapsed: (item: AgendaItem) => boolean;
  isHiddenByCollapsedParent: (item: AgendaItem) => boolean;
  setCollapsedMainItems: Dispatch<SetStateAction<Record<string, boolean>>>;
  profiles: Profile[];
  onToggleVisibility: (id: string, visible: boolean) => void;
  setDirty: (dirty: boolean) => void;
  onAddSubItem: (item: AgendaItem, title: string) => void;
  onDeleteAgendaItem: (item: AgendaItem, index: number) => void;
  showTaskSelector: { itemIndex: number } | null;
  onSetShowTaskSelector: (value: { itemIndex: number } | null) => void;
  tasks: LinkedTask[];
  onAddTaskToAgenda: (
    task: LinkedTask,
    item: AgendaItem,
    index: number,
  ) => void;
}
export function AgendaRow({
  item,
  index,
  provided,
  snapshot,
  hasEditPermission,
  selectedKey,
  setSelectedKey,
  getItemKey,
  getAgendaNumber,
  change,
  handleTitleKeyDown,
  subItemCount,
  documentCount,
  isMainItemCollapsed,
  setCollapsedMainItems,
  isHiddenByCollapsedParent,
  profiles,
  onToggleVisibility,
  setDirty,
  onAddSubItem,
  onDeleteAgendaItem,
  showTaskSelector,
  onSetShowTaskSelector,
  tasks,
  onAddTaskToAgenda,
}: Props) {
  const isSubItem = Boolean(item.parentLocalKey || item.parent_id);
  const preview = [item.description, item.result_text, item.notes]
    .map((text) => stripHtml(text ?? "")).find(Boolean);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          data-selected={getItemKey(item, index) === selectedKey}
          tabIndex={0}
          aria-label={`Details: ${item.title || "Neuer Punkt"}`}
          onFocus={() => setSelectedKey(getItemKey(item, index))}
          onClick={() => setSelectedKey(getItemKey(item, index))}
          className={cn(
            "group border-b border-b-[color:var(--agenda-row-divider)] dark:border-b-border border-l-[3px] border-l-transparent transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            isSubItem && "bg-[var(--agenda-subpoint-bg)] hover:bg-[var(--agenda-subpoint-bg)] dark:bg-slate-800 dark:hover:bg-slate-700",
            getItemKey(item, index) === selectedKey &&
              (isSubItem ? "border-l-primary" : "border-l-primary bg-primary/10 hover:bg-primary/10"),
            snapshot.combineTargetFor && "bg-primary/10 ring-2 ring-inset ring-primary",
            snapshot.isDragging && "bg-card shadow-lg",
            item.is_optional && item.is_visible === false && "opacity-50",
            isHiddenByCollapsedParent(item) && "hidden",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-1 pr-3 sm:pr-5">
            <div className="flex min-w-0 flex-1 basis-48 items-start">
              {hasEditPermission && (
                <div
                  {...provided.dragHandleProps}
                  aria-label="Punkt verschieben"
                  className="mr-2 flex h-8 shrink-0 cursor-grab items-center text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </div>
              )}
              <span aria-hidden="true" className="mr-2 grid size-8 shrink-0 place-items-center">
                {!isSubItem && (
                  <span className="grid size-full place-items-center rounded-lg bg-slate-600 text-white">
                    {item.task_id ? <ListTodo className="size-4" /> : <List className="size-4" />}
                  </span>
                )}
              </span>
              <span className={cn("flex h-8 shrink-0 items-center text-sm tabular-nums", isSubItem ? "font-medium text-muted-foreground" : "font-semibold text-foreground")}>
                {getAgendaNumber(item)}
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  value={item.title}
                  onChange={(e) => change(index, "title", e.target.value)}
                  onKeyDown={(e) => handleTitleKeyDown(e, item, index)}
                  placeholder={isSubItem ? "Unterpunkt-Titel" : "Agenda-Punkt Titel"}
                  aria-label="Titel des Agenda-Punkts"
                  className={cn(
                    "h-8 min-w-0 px-px text-sm border-transparent bg-transparent shadow-none hover:border-border focus:bg-card",
                    isSubItem ? "font-medium" : "font-semibold",
                    item.is_completed && "text-muted-foreground line-through",
                  )}
                  readOnly={!hasEditPermission}
                />
                {preview && <p className="truncate px-0.5 text-sm text-muted-foreground">{preview}</p>}
                {documentCount > 0 && (
                  <span className="block px-0.5 text-xs text-muted-foreground">
                    {documentCount} {documentCount === 1 ? "Anhang" : "Anhänge"}
                  </span>
                )}
              </div>
            </div>
            {item.is_recurring && <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Wiederkehrend</span>}
            {item.is_optional && item.id && hasEditPermission && (
              <Button aria-label="Sichtbarkeit umschalten" size="icon" variant="ghost" className="size-7 shrink-0"
                onClick={() => onToggleVisibility(item.id!, item.is_visible !== false)}>
                {item.is_visible !== false ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
            )}
            {hasEditPermission && (
              <span className="flex shrink-0 max-w-0 -ml-1 overflow-hidden opacity-0 transition-[max-width,margin,opacity] duration-200 ease-out group-hover:max-w-14 group-hover:ml-0 group-hover:opacity-100 group-focus-within:max-w-14 group-focus-within:ml-0 group-focus-within:opacity-100 group-data-[selected=true]:max-w-14 group-data-[selected=true]:ml-0 group-data-[selected=true]:opacity-100 motion-reduce:transition-none">
                {!item.parent_id && !item.parentLocalKey && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Unterpunkt hinzufügen"
                    className="h-7 w-7"
                    onClick={() => {
                      setDirty(true);
                      onAddSubItem(item, "");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Punkt löschen"
                  className="h-7 w-7"
                  onClick={() => {
                    setDirty(true);
                    onDeleteAgendaItem(item, index);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </span>
            )}
            {subItemCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                aria-label="Unterpunkte ein- oder ausklappen"
                aria-expanded={!isMainItemCollapsed(item)}
                className="h-7 shrink-0 gap-1 px-2 text-xs font-medium text-primary"
                onClick={() => {
                  const key = item.localKey || item.id;
                  if (!key) return;
                  setCollapsedMainItems((prev) => ({ ...prev, [key]: !prev[key] }));
                }}
              >
                {isMainItemCollapsed(item) ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                {subItemCount} {subItemCount === 1 ? "Unterpunkt" : "Unterpunkte"}
              </Button>
            )}
            {!(item.parentLocalKey || item.parent_id) &&
              hasEditPermission && (
                <Popover
                  open={showTaskSelector?.itemIndex === index}
                  onOpenChange={(open) =>
                    onSetShowTaskSelector(
                      open ? { itemIndex: index } : null,
                    )
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Aufgabe als Unterpunkt"
                      className="h-7 shrink-0 w-0 max-w-0 -ml-1 overflow-hidden p-0 opacity-0 transition-[width,max-width,margin,opacity] duration-200 ease-out group-hover:w-7 group-hover:max-w-7 group-hover:ml-0 group-hover:opacity-100 group-focus-within:w-7 group-focus-within:max-w-7 group-focus-within:ml-0 group-focus-within:opacity-100 group-data-[selected=true]:w-7 group-data-[selected=true]:max-w-7 group-data-[selected=true]:ml-0 group-data-[selected=true]:opacity-100 motion-reduce:transition-none"
                    >
                      <ListTodo className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(92vw,32rem)]">
                    <div className="space-y-2">
                      <div className="text-sm font-medium mb-3">
                        Aufgabe als Unterpunkt hinzufügen
                      </div>
                      {tasks.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {tasks.map((task) => (
                            <Button
                              key={task.id}
                              variant="outline"
                              className="w-full justify-start text-left h-auto p-3 whitespace-normal"
                              onClick={() => {
                                setDirty(true);
                                onAddTaskToAgenda(task, item, index);
                              }}
                            >
                              <div>
                                <div className="font-medium whitespace-normal break-words">
                                  {task.title}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          Keine offenen Aufgaben verfügbar
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            <AgendaRowDetails
              item={item}
              profiles={profiles}
              onComplete={hasEditPermission ? (completed) => change(index, "is_completed", completed) : undefined}
            />
          </div>
        </div>
      </ContextMenuTrigger>
      {hasEditPermission && (
        <ContextMenuContent className="w-56">
          {!(item.parentLocalKey || item.parent_id) && (
            <>
              <ContextMenuItem
                onClick={() => {
                  setDirty(true);
                  onAddSubItem(item, "");
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Unterpunkt hinzufügen
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => onSetShowTaskSelector({ itemIndex: index })}
              >
                <ListTodo className="h-4 w-4 mr-2" /> Aufgabe als Unterpunkt
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() =>
                  change(index, "is_completed", !item.is_completed)
                }
              >
                <Checkbox checked={item.is_completed} className="mr-2" /> Status
                umschalten
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              setDirty(true);
              onDeleteAgendaItem(item, index);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash className="h-4 w-4 mr-2" /> Punkt löschen
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
