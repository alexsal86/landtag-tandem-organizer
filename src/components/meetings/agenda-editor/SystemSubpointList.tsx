import { generatedAgendaKey } from "./liveAgenda";
import { SystemSubpointScope, type GeneratedAgendaEntry } from "./SystemSubpointScope";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { parseMeetingResults, type MeetingEntryResult } from "../platformAgendaRules";
import { agendaSubpointListClass, agendaSubpointNumber, agendaSubpointRowClass, orderSystemSubpoints, wasReservedForMeeting } from "./systemSubpoints";

export function SystemSubpointList<T extends { id: string; jour_fixe_reserved_meeting_id?: string | null }>({
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
  const scope = useContext(SystemSubpointScope);
  const parentKey = scope?.parentKey;
  const onEntries = scope?.onEntries;
  const entrySignature = JSON.stringify(ordered.map((entry, index) => ({
    id: entry.id, title: titleOf(entry), number: agendaSubpointNumber(agendaNumber, index),
  })));
  useEffect(() => {
    if (parentKey && onEntries) onEntries(parentKey, JSON.parse(entrySignature) as GeneratedAgendaEntry[]);
  }, [parentKey, onEntries, entrySignature]);
  useEffect(() => () => {
    if (parentKey && onEntries) onEntries(parentKey, []);
  }, [parentKey, onEntries]);

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
        const key = scope && generatedAgendaKey(scope.parentKey, entry.id);
        const isLiveCurrent = Boolean(key && key === scope?.liveKey);
        const isSelected = Boolean(key && key === scope?.selectedKey);
        const result = results[entry.id];
        const patch = (value: Partial<MeetingEntryResult>) =>
          onUpdateResult?.(JSON.stringify({ ...results, [entry.id]: { result: "", ...result, ...value } }));
        return (
          <li
            key={entry.id}
            className={cn(agendaSubpointRowClass, "group/subpoint relative scroll-mt-24",
              isSelected && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
              isLiveCurrent && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-success",
              targetIndex === index && "ring-1 ring-inset ring-primary")}
            data-system-subpoint
            data-live-agenda-current={isLiveCurrent || undefined}
            aria-current={isLiveCurrent ? "step" : undefined}
            tabIndex={scope ? 0 : undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (key && !(event.target instanceof Element && event.target.closest("button, a, input, textarea, select"))) scope?.onSelect(key);
            }}
            onKeyDown={(event) => {
              if (key && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                event.stopPropagation();
                scope?.onSelect(key);
              }
            }}
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
              {wasReservedForMeeting(scope?.meetingId, entry.jour_fixe_reserved_meeting_id) && (
                <Badge variant="outline" className="shrink-0 text-[10px]" title="Übernommen aus Vormerkung">Vorgemerkt</Badge>
              )}
              {metadata?.(entry)}
              {actions?.(entry)}
            </div>
            {(!scope?.liveKey || isLiveCurrent) && details?.(entry, result, patch)}
          </li>
        );
      })}
    </ul>
  );
}
