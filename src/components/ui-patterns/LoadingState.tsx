import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingStateProps {
  variant?: "list" | "card" | "detail" | "table" | "inline";
  rows?: number;
  className?: string;
  label?: string;
}

export function LoadingState({
  variant = "list",
  rows = 5,
  className,
  label = "Lädt…",
}: LoadingStateProps) {
  const items = Array.from({ length: rows });

  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn("flex items-center gap-xs text-caption text-muted-foreground animate-fade-in", className)}
      >
        <span className="inline-block h-2 w-2 rounded-pill bg-muted-foreground/60 animate-pulse" />
        {label}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div role="status" aria-label={label} className={cn("grid gap-sm animate-fade-in", className)}>
        {items.map((_, i) => (
          <div key={i} className="rounded-lg border border-border p-md space-y-xs">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div role="status" aria-label={label} className={cn("space-y-md animate-fade-in", className)}>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-xs pt-sm">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div role="status" aria-label={label} className={cn("space-y-2xs animate-fade-in", className)}>
        {items.map((_, i) => (
          <div key={i} className="flex items-center gap-sm py-2xs">
            <Skeleton className="h-4 w-4 rounded-pill" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="status" aria-label={label} className={cn("space-y-2xs animate-fade-in", className)}>
      {items.map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}
