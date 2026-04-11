import { Badge } from "@/components/ui/badge";
import type { EventPayloadStatus } from "@/components/event-planning/types";

export function getStatusBadge(status: EventPayloadStatus | string) {
  if (status === "draft") {
    return null;
  }

  const statusColors = {
    draft: "secondary",
    in_progress: "default",
    completed: "default",
  } as const;

  const statusLabels = {
    draft: "Entwurf",
    in_progress: "In Bearbeitung",
    completed: "Abgeschlossen",
  } as const;

  return (
    <Badge variant={statusColors[status as keyof typeof statusColors] || "secondary"}>
      {statusLabels[status as keyof typeof statusLabels] || status}
    </Badge>
  );
}
