import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseMeetingResults, type MeetingEntryResult } from "../platformAgendaRules";
import { agendaSubpointListClass, agendaSubpointNumber, agendaSubpointRowClass, orderSystemSubpoints } from "./systemSubpoints";

export function SystemSubpointList<T extends { id: string }>({
  entries, titleOf, agendaNumber, resultText, onUpdateResult, details, actions, metadata, checkable = false, label,
}: {
  entries: readonly T[];
  titleOf: (entry: T) => string;
  agendaNumber?: string;
  resultText?: string | null;
  onUpdateResult?: (value: string) => void;
  details?: (entry: T, result: MeetingEntryResult | undefined, patch: (value: Partial<MeetingEntryResult>) => void) => ReactNode;
  actions?: (entry: T) => ReactNode;
  metadata?: (entry: T) => ReactNode;
  checkable?: boolean;
  label?: string;
}) {
  const results = parseMeetingResults(resultText);
  const ordered = orderSystemSubpoints(entries, results);
  const sourceId = useRef<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const resetDrag = () => {
    sourceId.current = null;
    setTargetIndex(null);
  };
  const move = (id: string, target: number) => {
    const source = ordered.findIndex((entry) => entry.id === id);
    if (!onUpdateResult || source < 0 || source === target || !ordered[target]) return;
    const moved = [...ordered];
    const [entry] = moved.splice(source, 1);
    moved.splice(target, 0, entry);
    onUpdateResult(JSON.stringify({
      ...results,
      ...Object.fromEntries(moved.map(({ id }, order_index) => [id, { result: "", ...results[id], order_index }])),
    }));
  };

  return (
    <ul aria-label={label} className={agendaSubpointListClass}>
      {ordered.map((entry, index) => {
        const title = titleOf(entry);
        const result = results[entry.id];
        const patch = (value: Partial<MeetingEntryResult>) =>
          onUpdateResult?.(JSON.stringify({ ...results, [entry.id]: { result: "", ...result, ...value } }));
        return (
          <li
            key={entry.id}
            className={cn(agendaSubpointRowClass, "group/subpoint relative", targetIndex === index && "ring-1 ring-inset ring-primary")}
            onDragOver={(event) => {
              if (!sourceId.current) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "move";
              setTargetIndex(index);
            }}
            onDrop={(event) => {
              if (!sourceId.current) return;
              event.preventDefault();
              event.stopPropagation();
              move(sourceId.current, index);
              resetDrag();
            }}
          >
            {onUpdateResult && ordered.length > 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    draggable
                    className="absolute left-1 top-2.5 grid size-5 cursor-grab place-items-center text-muted-foreground opacity-0 group-hover/subpoint:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label={`${title} verschieben`}
                    title="Ziehen oder Pfeiltaste nach oben / unten"
                    onDragStart={(event) => {
                      event.stopPropagation();
                      sourceId.current = entry.id;
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", entry.id);
                    }}
                    onDragEnd={resetDrag}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                      event.preventDefault();
                      event.stopPropagation();
                      move(entry.id, index + (event.key === "ArrowUp" ? -1 : 1));
                    }}
                  >
                    <GripVertical className="size-4" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="flex w-auto flex-col gap-1 p-1">
                  <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => move(entry.id, index - 1)}>
                    <ArrowUp className="size-4" /> Nach oben
                  </Button>
                  <Button size="sm" variant="ghost" disabled={index === ordered.length - 1} onClick={() => move(entry.id, index + 1)}>
                    <ArrowDown className="size-4" /> Nach unten
                  </Button>
                </PopoverContent>
              </Popover>
            )}
            {checkable && (
              <Checkbox
                checked={Boolean(result?.completed)}
                disabled={!onUpdateResult}
                aria-label={`Erledigt: ${title}`}
                onCheckedChange={(value) => patch({ completed: value === true })}
                className="absolute left-6 top-2.5 size-5 rounded-md"
              />
            )}
            <div className={cn("flex min-h-5 items-baseline gap-2", result?.completed && "text-muted-foreground line-through")}>
              <span className="shrink-0 tabular-nums text-muted-foreground">{agendaSubpointNumber(agendaNumber, index)}</span>
              <span className="min-w-0 flex-1 break-words">{title}</span>
              {metadata?.(entry)}
              {actions?.(entry)}
            </div>
            {details?.(entry, result, patch)}
          </li>
        );
      })}
    </ul>
  );
}
