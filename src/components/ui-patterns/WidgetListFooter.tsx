import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface WidgetListFooterProps {
  /** Anzahl-Zeile, z. B. „3 von 7 offenen Entscheidungen“. */
  countLabel: string;
  linkLabel: string;
  to: string;
  className?: string;
}

/**
 * Fußzeile für Kacheln, die nur einen Auszug zeigen: nennt die Gesamtzahl der
 * offenen Einträge und verlinkt die vollständige Liste.
 */
export function WidgetListFooter({ countLabel, linkLabel, to, className }: WidgetListFooterProps) {
  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-meta text-muted-foreground",
        className,
      )}
    >
      <span className="tabular-nums">{countLabel}</span>
      <Link
        to={to}
        className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}
