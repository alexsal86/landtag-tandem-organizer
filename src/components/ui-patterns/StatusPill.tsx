import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "secondary";

export interface StatusPillProps {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: "soft" | "solid" | "outline";
}

const SOFT: Record<StatusTone, string> = {
  neutral:   "bg-muted text-muted-foreground",
  info:      "bg-info/15 text-info",
  success:   "bg-success/15 text-success",
  warning:   "bg-warning/20 text-warning-foreground",
  danger:    "bg-destructive/15 text-destructive",
  primary:   "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
};

const SOLID: Record<StatusTone, string> = {
  neutral:   "bg-muted-foreground text-background",
  info:      "bg-info text-info-foreground",
  success:   "bg-success text-success-foreground",
  warning:   "bg-warning text-warning-foreground",
  danger:    "bg-destructive text-destructive-foreground",
  primary:   "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
};

const OUTLINE: Record<StatusTone, string> = {
  neutral:   "border border-border text-muted-foreground",
  info:      "border border-info/40 text-info",
  success:   "border border-success/40 text-success",
  warning:   "border border-warning/40 text-warning-foreground",
  danger:    "border border-destructive/40 text-destructive",
  primary:   "border border-primary/40 text-primary",
  secondary: "border border-secondary/40 text-secondary",
};

export function StatusPill({
  tone = "neutral",
  children,
  icon,
  className,
  variant = "soft",
}: StatusPillProps) {
  const map = variant === "solid" ? SOLID : variant === "outline" ? OUTLINE : SOFT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2xs rounded-pill px-xs py-[2px] text-caption font-medium leading-none",
        map[tone],
        className,
      )}
    >
      {icon && <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}
