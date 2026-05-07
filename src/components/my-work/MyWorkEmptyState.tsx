import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface MyWorkEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  ActionIcon?: LucideIcon;
  compact?: boolean;
}

/**
 * Konsistenter Leerzustand für alle „Meine Arbeit"-Tabs:
 * gedämpftes Icon + ein Satz + optionale Primär-Aktion.
 */
export function MyWorkEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  ActionIcon = Plus,
  compact = false,
}: MyWorkEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-lg border border-dashed bg-card/50 ${
        compact ? "py-6 px-4 gap-2" : "py-12 px-6 gap-3"
      }`}
    >
      {Icon && (
        <Icon
          className={`text-muted-foreground/50 ${compact ? "h-8 w-8" : "h-10 w-10"}`}
          aria-hidden
        />
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-1">
          <ActionIcon className="mr-1.5 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
