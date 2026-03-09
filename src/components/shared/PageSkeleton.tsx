import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  /** Number of content rows to show */
  rows?: number;
  /** Show a header skeleton */
  showHeader?: boolean;
  /** Show sidebar skeleton */
  showSidebar?: boolean;
}

export function PageSkeleton({ rows = 4, showHeader = true, showSidebar = false }: PageSkeletonProps) {
  return (
    <div className="flex-1 p-6 space-y-6 animate-in fade-in duration-300">
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      )}

      <div className={showSidebar ? "flex gap-6" : ""}>
        {showSidebar && (
          <div className="w-64 shrink-0 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        <div className="flex-1 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
