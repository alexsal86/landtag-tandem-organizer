import { Check, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt?: Date | null;
}

export function AutosaveIndicator({ status, lastSavedAt }: AutosaveIndicatorProps) {
  const [, force] = useState(0);
  // tick every 30s so "vor X" stays fresh
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Speichere…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" />
        Fehler beim Speichern
      </span>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3 w-3 text-palette-green" />
        Gespeichert vor {formatDistanceToNow(lastSavedAt, { locale: de })}
      </span>
    );
  }
  return null;
}
