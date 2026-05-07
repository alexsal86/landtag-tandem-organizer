import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { wrap: "py-xs gap-2xs", icon: "h-6 w-6", title: "text-body" },
  md: { wrap: "py-lg gap-xs",  icon: "h-8 w-8", title: "text-body-lg" },
  lg: { wrap: "py-2xl gap-sm", icon: "h-10 w-10", title: "text-title" },
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const s = sizeMap[size];
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        s.wrap,
        className,
      )}
    >
      <div className="flex items-center justify-center rounded-pill bg-muted/60 p-sm text-muted-foreground">
        <Icon className={s.icon} aria-hidden="true" />
      </div>
      <div className="space-y-2xs">
        <p className={cn("font-medium text-foreground", s.title)}>{title}</p>
        {description && (
          <p className="text-caption text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && (
        <Button
          size="sm"
          variant="outline"
          onClick={action.onClick}
          className="mt-2xs"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-2xs" aria-hidden="true" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
