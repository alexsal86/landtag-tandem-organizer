import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { Check, X, ArrowRight, Reply, Send, Loader2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

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
    response_type: string;
    comment: string | null;
    creator_response: string | null;
    parent_response_id?: string | null;
    created_at: string;
    updated_at?: string;
  }>;
}

interface DecisionCardActivityProps {
  participants?: Participant[];
  maxItems?: number;
  isCreator?: boolean;
  currentUserId?: string;
  creatorProfile?: {
    display_name: string | null;
    badge_color: string | null;
    avatar_url: string | null;
  };
  onReply?: (payload: {
    responseId: string;
    text: string;
    mode: 'creator_response' | 'participant_followup';
  }) => Promise<void>;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function DecisionCardActivity({ participants = [], maxItems = 2, isCreator = false, currentUserId, creatorProfile, onReply }: DecisionCardActivityProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const activityItems: Array<{
    id: string;
    type: string;
    name: string | null;
    badgeColor: string | null;
    avatarUrl: string | null;
    comment: string | null;
    creatorResponse: string | null;
    participantFollowup: string | null;
    createdAt: string;
    userId: string;
  }> = [];

  participants.forEach(p => {
    const latest = p.responses.find((response) => !response.parent_response_id);
    if (!latest) return;

    const latestFollowup = p.responses
      .filter((response) => response.parent_response_id === latest.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (latest.response_type === 'question') {
      activityItems.unshift({
        id: latest.id,
        type: 'question',
        name: p.profile?.display_name || null,
        badgeColor: p.profile?.badge_color || null,
        avatarUrl: p.profile?.avatar_url || null,
        comment: latest.comment,
        creatorResponse: latest.creator_response,
        participantFollowup: latestFollowup?.comment || null,
        createdAt: latest.updated_at || latest.created_at,
        userId: p.user_id,
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
        participantFollowup: latestFollowup?.comment || null,
        createdAt: latest.updated_at || latest.created_at,
        userId: p.user_id,
      });
    }
  });

  if (activityItems.length === 0) return null;

  const displayed = activityItems.slice(0, maxItems);

  const handleSendReply = async (responseId: string, mode: 'creator_response' | 'participant_followup') => {
    if (!replyText.trim() || !onReply) return;
    setIsSending(true);
    try {
      await onReply({ responseId, text: replyText.trim(), mode });
      setReplyText("");
      setReplyingTo(null);
    } catch (e) {
      console.error('Reply failed:', e);
    } finally {
      setIsSending(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: de });
    } catch {
      return '';
    }
  };

  const getReplyMode = () => {
    if (isCreator) return 'creator_response' as const;
    return 'participant_followup' as const;
  };

  return (
    <div className="mt-2 pt-2 border-t space-y-1.5">
      <span className="text-xs font-bold text-muted-foreground">Letzte Aktivität:</span>
      {displayed.map(item => (
        <div key={item.id}>
          <div
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
                  <Reply className="h-3 w-3 text-orange-500 flex-shrink-0" />
                )}
                {item.type === 'yes' && (
                  <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                )}
                {item.type === 'no' && (
                  <X className="h-3 w-3 text-red-600 flex-shrink-0" />
                )}
                <span className="text-[9px] text-muted-foreground ml-auto flex-shrink-0">
                  {timeAgo(item.createdAt)}
                </span>
              </div>
              {item.comment && (
                <div className="text-muted-foreground line-clamp-1">
                  <RichTextDisplay content={item.comment} className="text-[11px] [&_p]:m-0" />
                </div>
              )}
              {/* Creator response - nested with visual hierarchy */}
              {item.creatorResponse && (
                <div className="ml-4 mt-1 pl-2 border-l-2 border-orange-300 bg-muted/50 rounded-r px-2 py-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <CheckCheck className="h-2.5 w-2.5 flex-shrink-0 text-primary" />
                    {creatorProfile && (
                      <Avatar className="h-3 w-3 flex-shrink-0">
                        {creatorProfile.avatar_url && <AvatarImage src={creatorProfile.avatar_url} />}
                        <AvatarFallback className="text-[6px]" style={{ backgroundColor: creatorProfile.badge_color || undefined }}>
                          {getInitials(creatorProfile.display_name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-medium text-[10px] text-muted-foreground">
                      {creatorProfile?.display_name || 'Ersteller'}
                    </span>
                  </div>
                  <div className="line-clamp-2">
                    <RichTextDisplay content={item.creatorResponse} className="text-[11px] [&_p]:m-0" />
                  </div>
                </div>
              )}

              {item.participantFollowup && (
                <div className="ml-8 mt-1 pl-2 border-l-2 border-primary/40 bg-muted/30 rounded-r px-2 py-1">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Avatar className="h-3 w-3 flex-shrink-0">
                      {item.avatarUrl && <AvatarImage src={item.avatarUrl} />}
                      <AvatarFallback className="text-[6px]" style={{ backgroundColor: item.badgeColor || undefined }}>
                        {getInitials(item.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-[10px] text-muted-foreground">
                      {item.name || 'Unbekannt'}
                    </span>
                  </div>
                  <div className="line-clamp-2">
                    <RichTextDisplay content={item.participantFollowup} className="text-[11px] [&_p]:m-0" />
                  </div>
                </div>
              )}
              {/* Reply button for unanswered questions (creator only) */}
              {isCreator && !item.creatorResponse && onReply && replyingTo !== item.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-orange-600 hover:text-orange-700 mt-0.5 -ml-1.5"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(item.id); }}
                >
                  <Reply className="h-2.5 w-2.5 mr-0.5" />
                  Antworten
                </Button>
              )}

              {!isCreator && currentUserId === item.userId && item.creatorResponse && onReply && replyingTo !== item.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-primary hover:text-primary mt-0.5 -ml-1.5"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(item.id); }}
                >
                  <ArrowRight className="h-2.5 w-2.5 mr-0.5" />
                  Antworten
                </Button>
              )}
            </div>
          </div>

          {/* Inline reply editor */}
          {replyingTo === item.id && (
            <div className="mt-1 ml-5 space-y-1" onClick={(e) => e.stopPropagation()}>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ihre Antwort..."
                className="min-h-[50px] text-xs resize-none"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={(e) => { e.stopPropagation(); handleSendReply(item.id, getReplyMode()); }}
                  disabled={isSending || !replyText.trim()}
                >
                  {isSending ? (
                    <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                  ) : (
                    <Send className="h-2.5 w-2.5 mr-0.5" />
                  )}
                  Senden
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(""); }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
