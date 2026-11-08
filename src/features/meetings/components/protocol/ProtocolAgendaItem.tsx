import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { parseMeetingResults } from "@/components/meetings/platformAgendaRules";
import { cn } from "@/lib/utils";
import type { ProtocolAgendaItem } from "./types";
interface Props {
  item: ProtocolAgendaItem;
  number: string;
  onlyResults: boolean;
  getChildren: (id: string) => ProtocolAgendaItem[];
  getAssignedUserNames: (ids?: string[] | null) => string | null;
  getSystemIcon: (type?: string | null) => ReactNode;
}
/** Presentation predicate: suppressed birthday results never count as visible content. */
function hasProtocolContent(
  item: ProtocolAgendaItem,
  getChildren: Props["getChildren"],
): boolean {
  const entries = item.system_type
    ? Object.values(parseMeetingResults(item.result_text))
    : [];
  const result =
    !item.system_type?.includes("birthday") &&
    (entries.length
      ? entries.some((entry) => entry.result.trim())
      : !!item.result_text?.trim());
  return !!(
    item.description?.trim() ||
    item.notes?.trim() ||
    item.assigned_to?.length ||
    result ||
    getChildren(item.id).some((child) => hasProtocolContent(child, getChildren))
  );
}
export function ProtocolAgendaEntry({
  item,
  number,
  onlyResults,
  getChildren,
  getAssignedUserNames,
  getSystemIcon,
}: Props) {
  const children = getChildren(item.id);
  const hasContent = hasProtocolContent(item, getChildren);
  if (onlyResults && !hasContent) return null;
  const entries = item.system_type
    ? Object.entries(parseMeetingResults(item.result_text))
    : [];
  const showResult =
    !!item.result_text?.trim() &&
    !item.system_type?.includes("birthday") &&
    (!entries.length || entries.some(([, entry]) => entry.result.trim()));
  const resultColor =
    item.system_type === "decisions"
      ? "border-palette-violet/50 bg-palette-violet/10"
      : item.system_type === "quick_notes"
        ? "border-palette-amber/50 bg-palette-amber/10"
        : item.system_type === "tasks"
          ? "border-palette-blue/50 bg-palette-blue/10"
          : item.system_type === "case_items"
            ? "border-palette-green/50 bg-palette-green/10"
            : "border-primary/50 bg-primary/10";
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-t border-border/60 py-3 first:border-0 break-inside-avoid">
      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0">
        <h3
          className={cn(
            "flex flex-wrap items-center gap-2",
            item.parent_id ? "text-sm font-semibold" : "font-semibold",
            !hasContent && "font-normal text-muted-foreground",
          )}
        >
          {getSystemIcon(item.system_type)}
          {item.title}
          {item.is_completed && (
            <Badge
              variant="outline"
              className="text-xs text-palette-green border-palette-green/40"
            >
              Erledigt
            </Badge>
          )}
          {item.system_type && !hasContent && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              leer
            </Badge>
          )}
        </h3>
        {item.description?.trim() && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {item.description}
          </p>
        )}
        {item.notes?.trim() && (
          <p className="mt-2 border-l-2 pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {item.notes}
          </p>
        )}
        {!!item.assigned_to?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.assigned_to.map((id) => {
              const name = getAssignedUserNames([id]) || "Unbekannter Benutzer";
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 py-0.5 pl-0.5 pr-2 text-xs"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-semibold"
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  {name}
                </span>
              );
            })}
          </div>
        )}
        {showResult && (
          <div
            className={cn(
              "mt-2 rounded-lg border-l-2 px-3 py-2 break-inside-avoid print:shadow-none",
              resultColor,
            )}
          >
            <p className="mb-1 text-xs font-semibold">Ergebnis</p>
            {entries.length ? (
              <ul className="list-disc space-y-1 pl-4">
                {entries
                  .filter(([, entry]) => entry.result.trim())
                  .map(([id, entry]) => (
                    <li key={id} className="text-sm whitespace-pre-wrap">
                      {entry.result}
                      {entry.follow_up && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Folgeaufgabe
                        </Badge>
                      )}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{item.result_text}</p>
            )}
          </div>
        )}
        {children.length > 0 && (
          <div className="mt-2">
            {children.map((child, index) => (
              <ProtocolAgendaEntry
                key={child.id}
                item={child}
                number={`${number.replace(/\.$/, "")}.${index + 1}`}
                onlyResults={onlyResults}
                getChildren={getChildren}
                getAssignedUserNames={getAssignedUserNames}
                getSystemIcon={getSystemIcon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
