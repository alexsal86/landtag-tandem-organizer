import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Clock, Hourglass, LayoutGrid, List } from "lucide-react";
import { ViewType } from "@/hooks/useViewPreference";
import { cn } from "@/lib/utils";

interface MyWorkTasksToolbarProps {
  totalTasks: number;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  taskStatuses: { name: string; label: string }[];
  viewType: ViewType;
  onViewTypeChange: (value: ViewType) => void;
  dueFollowUpCount: number;
  dueFollowUpsExpanded: boolean;
  onDueFollowUpsExpandedChange: (open: boolean) => void;
  hiddenScheduledCount: number;
  scheduledFollowUpsExpanded: boolean;
  onScheduledFollowUpsExpandedChange: (open: boolean) => void;
}

export function MyWorkTasksToolbar({
  totalTasks,
  statusFilter,
  onStatusFilterChange,
  taskStatuses,
  viewType,
  onViewTypeChange,
  dueFollowUpCount,
  dueFollowUpsExpanded,
  onDueFollowUpsExpandedChange,
  hiddenScheduledCount,
  scheduledFollowUpsExpanded,
  onScheduledFollowUpsExpandedChange,
}: MyWorkTasksToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Aufgaben</span>
          <Badge variant="outline">{totalTasks}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {taskStatuses.map((status) => (
                <SelectItem key={status.name} value={status.name}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={viewType}
            onValueChange={(value) => value && onViewTypeChange(value as ViewType)}
            className="bg-muted rounded-md p-0.5"
          >
            <ToggleGroupItem value="card" aria-label="Kartenansicht" className="h-7 w-7 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Listenansicht" className="h-7 w-7 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {dueFollowUpCount > 0 && (
        <div className="px-4 pt-2">
          <Collapsible open={dueFollowUpsExpanded} onOpenChange={onDueFollowUpsExpandedChange}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !dueFollowUpsExpanded && "-rotate-90")} />
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Fällige Wiedervorlagen</span>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">{dueFollowUpCount}</Badge>
              </div>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      )}

      {hiddenScheduledCount > 0 && (
        <div className="px-4 pb-3">
          <Collapsible open={scheduledFollowUpsExpanded} onOpenChange={onScheduledFollowUpsExpandedChange}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronDown className={cn("h-4 w-4 transition-transform", !scheduledFollowUpsExpanded && "-rotate-90")} />
                <Hourglass className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Geplant (bis zum Datum ausgeblendet)</span>
                <Badge variant="secondary" className="text-xs">{hiddenScheduledCount}</Badge>
              </div>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      )}
    </>
  );
}
