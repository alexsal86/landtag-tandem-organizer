import type { Dispatch, SetStateAction, KeyboardEvent } from "react";
import type {
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaItem, LinkedTask } from "../types";
import type { agendaTiming } from "./agendaTiming";
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
  hasContentIndicator: (item: AgendaItem) => boolean;
  hasSubItems: (item: AgendaItem) => boolean;
  isMainItemCollapsed: (item: AgendaItem) => boolean;
  isHiddenByCollapsedParent: (item: AgendaItem) => boolean;
  setCollapsedMainItems: Dispatch<SetStateAction<Record<string, boolean>>>;
  timing: ReturnType<typeof agendaTiming>;
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
  hasContentIndicator,
  hasSubItems,
  isMainItemCollapsed,
  setCollapsedMainItems,
  isHiddenByCollapsedParent,
  timing,
  onToggleVisibility,
  setDirty,
  onAddSubItem,
  onDeleteAgendaItem,
  showTaskSelector,
  onSetShowTaskSelector,
  tasks,
  onAddTaskToAgenda,
}: Props) {
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
            "group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-b border-border/60 hover:bg-muted/30 focus-within:bg-muted/40",
            getItemKey(item, index) === selectedKey && "bg-muted/50",
            snapshot.isDragging && "shadow-lg bg-card rounded-lg border",
            (item.parentLocalKey || item.parent_id) && "ml-7 border-l pl-2",
            item.is_optional && "border-dashed",
            item.is_optional && item.is_visible === false && "opacity-50",
            isHiddenByCollapsedParent(item) && "hidden",
          )}
        >
          <div className="py-2 px-3">
            <div className="space-y-3">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 group">
                {hasEditPermission && (
                  <div
                    {...provided.dragHandleProps}
                    aria-label="Punkt verschieben"
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing opacity-0 group-data-[selected=true]:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-muted-foreground font-medium min-w-[1.75rem] text-right">
                  {getAgendaNumber(item)}
                </span>
                <Input
                  value={item.title}
                  onChange={(e) => change(index, "title", e.target.value)}
                  onKeyDown={(e) => handleTitleKeyDown(e, item, index)}
                  placeholder={
                    item.parentLocalKey || item.parent_id
                      ? "Unterpunkt-Titel"
                      : "Agenda-Punkt Titel"
                  }
                  aria-label="Titel des Agenda-Punkts"
                  className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-auto border-transparent bg-transparent shadow-none hover:border-border focus-visible:ring-2 font-medium"
                  readOnly={!hasEditPermission}
                />
                {/* Carryover badge */}
                {item.source_meeting_id && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 max-w-48 truncate"
                  >
                    ↩{" "}
                    {item.original_meeting_title
                      ? `von ${item.original_meeting_title}`
                      : "Übertragen"}
                  </Badge>
                )}
                {/* Optional visibility toggle */}
                {item.is_optional && item.id && hasEditPermission && (
                  <Button
                    aria-label="Sichtbarkeit umschalten"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 h-7 w-7"
                    onClick={() =>
                      onToggleVisibility(item.id!, item.is_visible !== false)
                    }
                  >
                    {item.is_visible !== false ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
                {item.carry_over_to_next && (
                  <Badge
                    variant="outline"
                    title="Auf nächstes Meeting übertragen"
                    className="whitespace-nowrap"
                  >
                    ↩ Übertragen
                  </Badge>
                )}
                {!item.parent_id &&
                  !item.parentLocalKey &&
                  timing.total > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {timing.starts.get(item)} · {item.duration_minutes ?? 0}{" "}
                      min
                    </span>
                  )}
                {hasEditPermission && (
                  <span className="flex opacity-0 group-data-[selected=true]:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
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
                {hasContentIndicator(item) && (
                  <span
                    className="h-2 w-2 rounded-full bg-palette-blue/80 shrink-0"
                    title="Enthält Beschreibung, Notizen oder Dokumente"
                  />
                )}
                {hasSubItems(item) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Unterpunkte ein- oder ausklappen"
                    aria-expanded={!isMainItemCollapsed(item)}
                    className="h-6 w-6 shrink-0 ml-auto opacity-0 group-data-[selected=true]:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={() => {
                      const key = item.localKey || item.id;
                      if (!key) return;
                      setCollapsedMainItems((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }));
                    }}
                  >
                    {isMainItemCollapsed(item) ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
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
                          className="h-7 w-7 opacity-0 group-data-[selected=true]:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
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
              </div>
            </div>
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
