import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { MessageCircle, Check, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  responses: Array<{
    id: string;
    response_type: 'yes' | 'no' | 'question';
    comment: string | null;
    creator_response: string | null;
    created_at: string;
  }>;
}

interface DecisionCardActivityProps {
  participants?: Participant[];
  maxItems?: number;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function DecisionCardActivity({ participants = [], maxItems = 2 }: DecisionCardActivityProps) {
  // Collect activity items: open inquiries first, then responses with comments
  const activityItems: Array<{
    id: string;
    type: 'question' | 'yes' | 'no';
    name: string | null;
    badgeColor: string | null;
    avatarUrl: string | null;
    comment: string | null;
    creatorResponse: string | null;
    createdAt: string;
  }> = [];

  participants.forEach(p => {
    const latest = p.responses[0];
    if (!latest) return;

    // Prioritize open inquiries
    if (latest.response_type === 'question') {
      activityItems.unshift({
        id: latest.id,
        type: 'question',
        name: p.profile?.display_name || null,
        badgeColor: p.profile?.badge_color || null,
        avatarUrl: p.profile?.avatar_url || null,
        comment: latest.comment,
        creatorResponse: latest.creator_response,
        createdAt: latest.created_at,
      });
    } else if (latest.comment) {
      activityItems.push({
        id: latest.id,
        type: latest.response_type,
        name: p.profile?.display_name || null,
        badgeColor: p.profile?.badge_color || null,
        avatarUrl: p.profile?.avatar_url || null,
        comment: latest.comment,
        creatorResponse: latest.creator_response,
        createdAt: latest.created_at,
      });
    }
  });

  if (activityItems.length === 0) return null;

  const displayed = activityItems.slice(0, maxItems);

  return (
    <div className="mt-2 pt-2 border-t space-y-1.5">
      <span className="text-[10px] font-medium text-muted-foreground">Letzte Aktivität:</span>
      {displayed.map(item => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-1.5 rounded px-1.5 py-1 text-[11px]",
            item.type === 'question' && "bg-orange-50 dark:bg-orange-950/20",
            item.type === 'yes' && "bg-green-50 dark:bg-green-950/20",
            item.type === 'no' && "bg-red-50 dark:bg-red-950/20",
          )}
        >
          <Avatar className="h-4 w-4 flex-shrink-0 mt-0.5">
            {item.avatarUrl && <AvatarImage src={item.avatarUrl} />}
            <AvatarFallback
              className="text-[7px]"
              style={{ backgroundColor: item.badgeColor || undefined }}
            >
              {getInitials(item.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium truncate">{item.name || 'Unbekannt'}</span>
              {item.type === 'question' && (
                <MessageCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
              )}
              {item.type === 'yes' && (
                <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
              )}
              {item.type === 'no' && (
                <X className="h-3 w-3 text-red-600 flex-shrink-0" />
              )}
            </div>
            {item.comment && (
              <div className="text-muted-foreground line-clamp-1">
                <RichTextDisplay content={item.comment} className="text-[11px] [&_p]:m-0" />
              </div>
            )}
            {item.creatorResponse && (
              <div className="flex items-start gap-1 mt-0.5 text-muted-foreground">
                <ArrowRight className="h-2.5 w-2.5 mt-0.5 flex-shrink-0" />
                <div className="line-clamp-1">
                  <RichTextDisplay content={item.creatorResponse} className="text-[11px] [&_p]:m-0" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
