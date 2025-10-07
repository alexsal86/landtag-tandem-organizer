import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <Card className={cn("overflow-hidden animate-fade-in", className)}>
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
        <div className="h-4 w-1/2 bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
        <div className="h-20 w-full bg-gradient-to-r from-muted via-muted/70 to-muted rounded animate-shimmer bg-[length:200%_100%]" />
      </div>
    </Card>
  );
}
