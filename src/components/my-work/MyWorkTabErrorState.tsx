import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MyWorkTabErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function MyWorkTabErrorState({
  title = "Tab konnte nicht geladen werden",
  description = "Beim Laden dieses Bereichs ist ein Fehler aufgetreten.",
  onRetry,
}: MyWorkTabErrorStateProps) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground max-w-lg">{description}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Erneut versuchen
      </Button>
    </div>
  );
}
