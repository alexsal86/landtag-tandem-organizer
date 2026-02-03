import { Users, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAnnouncementProgress } from "@/hooks/useTeamAnnouncements";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface AnnouncementProgressProps {
  announcementId: string;
  expanded?: boolean;
}

export function AnnouncementProgress({ announcementId, expanded = false }: AnnouncementProgressProps) {
  const { progress, loading } = useAnnouncementProgress(announcementId);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground animate-pulse">
        Lade Fortschritt...
      </div>
    );
  }

  const percentage = progress.totalCount > 0 
    ? Math.round((progress.dismissedCount / progress.totalCount) * 100) 
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>
            {progress.dismissedCount} von {progress.totalCount} haben als erledigt markiert
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      <Progress value={percentage} className="h-2" />

      {expanded && progress.dismissals.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Erledigt von:</p>
          {progress.dismissals.map((dismissal) => (
            <div 
              key={dismissal.user_id}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span>{dismissal.display_name}</span>
              </div>
              <span className="text-muted-foreground">
                {format(new Date(dismissal.dismissed_at), "dd.MM. HH:mm", { locale: de })}
              </span>
            </div>
          ))}
        </div>
      )}

      {expanded && progress.dismissals.length === 0 && (
        <div className="mt-3 text-xs text-muted-foreground border-t pt-3">
          Noch niemand hat diese Mitteilung als erledigt markiert.
        </div>
      )}
    </div>
  );
}
