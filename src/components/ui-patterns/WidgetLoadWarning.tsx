import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WidgetLoadWarningProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Schmale Warnzeile für teilweise geladene Kacheln: Daten der erfolgreichen
 * Quellen bleiben sichtbar, die fehlgeschlagenen Quellen werden hier benannt.
 */
export function WidgetLoadWarning({ message, onRetry, className }: WidgetLoadWarningProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md bg-palette-orange/10 px-2.5 py-1.5 text-meta text-[#c2410c]",
        className,
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto shrink-0 font-medium underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2410c]"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
