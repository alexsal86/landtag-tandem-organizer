import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LinkedValueChipProps {
  label?: string;
  value: string;
  onRemove?: () => void;
  className?: string;
}

export function LinkedValueChip({ label, value, onRemove, className }: LinkedValueChipProps) {
  return (
    <div
      className={cn(
        "group inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 via-background to-background px-3 py-2 shadow-sm transition-colors",
        className,
      )}
    >
      <div className="min-w-0">
        {label ? <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p> : null}
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label={`${label ?? "Eintrag"} entfernen`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
