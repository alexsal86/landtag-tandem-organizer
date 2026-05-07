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
    bg: "bg-palette-red/20",
    border: "border-palette-red",
    text: "text-palette-red",
    icon: AlertTriangle,
    iconColor: "text-palette-red",
  },
  warning: {
    bg: "bg-palette-orange/20",
    border: "border-palette-orange",
    text: "text-palette-orange",
    icon: AlertCircle,
    iconColor: "text-palette-orange",
  },
  info: {
    bg: "bg-palette-blue/20",
    border: "border-palette-blue",
    text: "text-palette-blue",
    icon: Info,
    iconColor: "text-palette-blue",
  },
  success: {
    bg: "bg-palette-green/20",
    border: "border-palette-green",
    text: "text-palette-green",
    icon: CheckCircle,
    iconColor: "text-palette-green",
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
