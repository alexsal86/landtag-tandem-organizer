import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserBadge } from "@/components/ui/user-badge";
import { cn } from "@/lib/utils";
import { getBorderColor, getResponseSummary } from "./utils/decisionOverview";
import type { DecisionRequest } from "./utils/decisionOverview";

interface DecisionArchivedCardProps {
  decision: DecisionRequest;
  highlightRef: (id: string) => React.RefCallback<HTMLDivElement> | null;
  isHighlighted: (id: string) => boolean;
  onOpenDetails: (id: string) => void;
  onRestore: (id: string) => Promise<void>;
}

export function DecisionArchivedCard({
  decision,
  highlightRef,
  isHighlighted,
  onOpenDetails,
  onRestore,
}: DecisionArchivedCardProps) {
  const summary = getResponseSummary(decision.participants);

  return (
    <Card
      ref={highlightRef(decision.id)}
      className={cn(
        "border-l-4 bg-muted/30",
        getBorderColor(decision, summary),
        isHighlighted(decision.id) && "notification-highlight",
      )}
      onClick={() => onOpenDetails(decision.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">{decision.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>
                Archiviert:{" "}
                {decision.archived_at &&
                  new Date(decision.archived_at).toLocaleDateString("de-DE")}
              </span>
              {decision.creator && (
                <>
                  <span>•</span>
                  <UserBadge
                    userId={decision.creator.user_id}
                    displayName={decision.creator.display_name}
                    badgeColor={decision.creator.badge_color}
                    size="sm"
                  />
                </>
              )}
            </div>
          </div>

          {decision.isCreator && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRestore(decision.id);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Wiederherstellen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
