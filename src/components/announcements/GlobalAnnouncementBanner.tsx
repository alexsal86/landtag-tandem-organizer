import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamAnnouncements, TeamAnnouncement } from "@/hooks/useTeamAnnouncements";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const priorityStyles = {
  critical: {
    bg: "bg-red-100 dark:bg-red-950/50",
    border: "border-red-500",
    text: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400",
  },
  warning: {
    bg: "bg-orange-100 dark:bg-orange-950/50",
    border: "border-orange-500",
    text: "text-orange-800 dark:text-orange-200",
    icon: AlertCircle,
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  info: {
    bg: "bg-blue-100 dark:bg-blue-950/50",
    border: "border-blue-500",
    text: "text-blue-800 dark:text-blue-200",
    icon: Info,
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  success: {
    bg: "bg-green-100 dark:bg-green-950/50",
    border: "border-green-500",
    text: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
    iconColor: "text-green-600 dark:text-green-400",
  },
};

const MAX_VISIBLE_BANNERS = 3;

export function GlobalAnnouncementBanner() {
  const { user } = useAuth();
  const { activeAnnouncements, dismissAnnouncement } = useTeamAnnouncements();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  if (!user || activeAnnouncements.length === 0) {
    return null;
  }

  const visibleAnnouncements = showAll 
    ? activeAnnouncements 
    : activeAnnouncements.slice(0, MAX_VISIBLE_BANNERS);

  const hiddenCount = activeAnnouncements.length - MAX_VISIBLE_BANNERS;

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDismiss = async (announcement: TeamAnnouncement) => {
    await dismissAnnouncement(announcement.id);
  };

  return (
    <div className="w-full">
      {visibleAnnouncements.map((announcement) => {
        const styles = priorityStyles[announcement.priority];
        const Icon = styles.icon;
        const isExpanded = expanded.has(announcement.id);
        const hasLongMessage = announcement.message.length > 150;

        return (
          <div
            key={announcement.id}
            className={cn(
              "border-b-2 px-4 py-3 transition-all duration-200",
              styles.bg,
              styles.border
            )}
          >
            <div className="max-w-7xl mx-auto">
              <div className="flex items-start gap-3">
                <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", styles.iconColor)} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={cn("font-semibold", styles.text)}>
                      {announcement.title}
                    </h4>
                    <span className={cn("text-xs opacity-75", styles.text)}>
                      von {announcement.author_name} • {format(new Date(announcement.created_at), "dd. MMM yyyy, HH:mm", { locale: de })}
                    </span>
                  </div>
                  
                  <p className={cn(
                    "mt-1 text-sm",
                    styles.text,
                    !isExpanded && hasLongMessage && "line-clamp-2"
                  )}>
                    {announcement.message}
                  </p>

                  {hasLongMessage && (
                    <button
                      onClick={() => toggleExpanded(announcement.id)}
                      className={cn("text-xs mt-1 flex items-center gap-1 hover:underline", styles.text)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Weniger anzeigen
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Mehr anzeigen
                        </>
                      )}
                    </button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(announcement)}
                  className={cn(
                    "flex-shrink-0 h-8 px-2 gap-1",
                    styles.text,
                    "hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Erledigt</span>
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {hiddenCount > 0 && !showAll && (
        <div className="bg-muted/50 border-b px-4 py-2">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
          >
            <ChevronDown className="h-4 w-4" />
            {hiddenCount} weitere Mitteilung{hiddenCount > 1 ? "en" : ""} anzeigen
          </button>
        </div>
      )}

      {showAll && activeAnnouncements.length > MAX_VISIBLE_BANNERS && (
        <div className="bg-muted/50 border-b px-4 py-2">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
          >
            <ChevronUp className="h-4 w-4" />
            Weniger anzeigen
          </button>
        </div>
      )}
    </div>
  );
}
