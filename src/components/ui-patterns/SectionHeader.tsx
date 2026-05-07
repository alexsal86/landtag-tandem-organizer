import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: string;
  count?: number;
  description?: string;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "h4";
}

export function SectionHeader({
  title,
  count,
  description,
  actions,
  className,
  as: Heading = "h3",
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-sm py-2xs", className)}>
      <div className="flex items-baseline gap-xs min-w-0">
        <Heading className="section-label text-foreground truncate">{title}</Heading>
        {typeof count === "number" && (
          <span className="text-caption tabular-nums text-muted-foreground">{count}</span>
        )}
        {description && (
          <span className="text-caption text-muted-foreground truncate hidden md:inline">
            · {description}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2xs shrink-0">{actions}</div>}
    </div>
  );
}
