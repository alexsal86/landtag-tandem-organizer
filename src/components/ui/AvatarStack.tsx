import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, MessageCircle, Clock } from "lucide-react";

interface Participant {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
  response_type?: 'yes' | 'no' | 'question' | null;
}

interface AvatarStackProps {
  participants: Participant[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

export function AvatarStack({ participants, maxVisible = 4, size = 'sm' }: AvatarStackProps) {
  const visibleParticipants = participants.slice(0, maxVisible);
  const remainingCount = participants.length - maxVisible;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getResponseIcon = (responseType: 'yes' | 'no' | 'question' | null | undefined) => {
    switch (responseType) {
      case 'yes':
        return <Check className="h-2.5 w-2.5 text-green-600" />;
      case 'no':
        return <X className="h-2.5 w-2.5 text-red-600" />;
      case 'question':
        return <MessageCircle className="h-2.5 w-2.5 text-orange-600" />;
      default:
        return <Clock className="h-2.5 w-2.5 text-muted-foreground" />;
    }
  };

  const getResponseBorderColor = (responseType: 'yes' | 'no' | 'question' | null | undefined) => {
    switch (responseType) {
      case 'yes':
        return 'ring-green-500';
      case 'no':
        return 'ring-red-500';
      case 'question':
        return 'ring-orange-500';
      default:
        return 'ring-muted';
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'h-6 w-6 text-[10px]' 
    : 'h-8 w-8 text-xs';

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-2">
        {visibleParticipants.map((participant, index) => (
          <Tooltip key={participant.user_id}>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  "relative rounded-full ring-2 ring-background",
                  getResponseBorderColor(participant.response_type)
                )}
                style={{ zIndex: maxVisible - index }}
              >
                <Avatar className={sizeClasses}>
                  <AvatarFallback
                    className="text-foreground font-medium"
                    style={{
                      backgroundColor: participant.badge_color || 'hsl(var(--muted))',
                    }}
                  >
                    {getInitials(participant.display_name)}
                  </AvatarFallback>
                </Avatar>
                {/* Response indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                  {getResponseIcon(participant.response_type)}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="flex items-center gap-1.5">
                <span>{participant.display_name || 'Unbekannt'}</span>
                {participant.response_type === 'yes' && <span className="text-green-600">✓ Ja</span>}
                {participant.response_type === 'no' && <span className="text-red-600">✕ Nein</span>}
                {participant.response_type === 'question' && <span className="text-orange-600">? Rückfrage</span>}
                {!participant.response_type && <span className="text-muted-foreground">Ausstehend</span>}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="relative rounded-full ring-2 ring-background bg-muted"
                style={{ zIndex: 0 }}
              >
                <Avatar className={sizeClasses}>
                  <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                    +{remainingCount}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {participants.slice(maxVisible).map(p => p.display_name || 'Unbekannt').join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
