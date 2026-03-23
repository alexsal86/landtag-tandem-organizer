import { AvatarStack } from "@/components/ui/AvatarStack";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MyWorkDecision } from "../types";
import { DecisionSummaryItem } from "../utils";

interface DecisionCardParticipantsProps {
  decision: MyWorkDecision;
  pendingParticipantNames: string;
  summaryItems: DecisionSummaryItem[];
}

export function DecisionCardParticipants({ decision, pendingParticipantNames, summaryItems }: DecisionCardParticipantsProps) {
  const avatarParticipants = (decision.participants || []).map((participant) => ({
    user_id: participant.user_id,
    display_name: participant.profile?.display_name || null,
    badge_color: participant.profile?.badge_color || null,
    avatar_url: participant.profile?.avatar_url || null,
    response_type: participant.responses[0]?.response_type || null,
  }));
  const pendingParticipants = (decision.participants || []).filter((participant) => !participant.responses?.[0]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="shrink-0">
            <AvatarStack participants={avatarParticipants} maxVisible={4} size="sm" showTooltips={false} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="z-[140] max-w-xs">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1 text-xs font-semibold">
              {summaryItems.map((item, index) => (
                <span key={item.key} className="inline-flex items-center gap-1">
                  {index > 0 && <span className="text-muted-foreground">•</span>}
                  <span className={item.textClass}>{item.count}</span>
                  <span className={item.textClass}>{item.label}</span>
                </span>
              ))}
            </div>
            {pendingParticipants.length > 0 && <div className="text-xs text-muted-foreground">Ausstehend: {pendingParticipantNames}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
