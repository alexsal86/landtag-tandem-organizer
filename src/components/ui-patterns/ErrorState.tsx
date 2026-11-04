import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Etwas ist schiefgelaufen",
  description = "Die Daten konnten nicht geladen werden.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center gap-space-xs py-space-lg animate-fade-in",
        className,
      )}
    >
      <div className="flex items-center justify-center rounded-pill bg-destructive/10 p-space-sm text-destructive">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-space-2xs">
        <p className="font-medium text-body text-foreground">{title}</p>
        <p className="text-caption text-muted-foreground max-w-sm">{description}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-space-2xs">
          <RefreshCw className="h-4 w-4 mr-space-2xs" aria-hidden="true" />
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}
