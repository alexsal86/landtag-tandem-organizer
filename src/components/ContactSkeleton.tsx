import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface ContactSkeletonProps {
  count?: number;
  viewMode?: "grid" | "list";
}

export const ContactSkeleton = ({ count = 6, viewMode = "grid" }: ContactSkeletonProps) => {
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-muted via-muted/70 to-muted animate-shimmer bg-[length:200%_100%]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-[200px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
              <div className="h-3 w-[150px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
            </div>
            <div className="h-3 w-[100px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
            <div className="h-3 w-[120px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
            <div className="h-8 w-8 bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="h-[200px] animate-scale-in-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-muted via-muted/70 to-muted animate-shimmer bg-[length:200%_100%]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-[120px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
                <div className="h-3 w-[100px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
              <div className="h-3 w-[80%] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
              <div className="h-6 w-[60px] bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};