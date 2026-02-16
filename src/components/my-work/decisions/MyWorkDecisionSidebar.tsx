import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MessageCircle, Bell, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarDiscussionComment } from "./types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface OpenQuestion {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantAvatarUrl: string | null;
  comment: string | null;
}

interface NewComment {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantAvatarUrl: string | null;
  responseType: string;
  comment: string | null;
}

interface MyWorkDecisionSidebarProps {
  openQuestions: OpenQuestion[];
  newComments: NewComment[];
  discussionComments?: SidebarDiscussionComment[];
  recentActivities?: Array<{
    id: string;
    decisionId: string;
    decisionTitle: string;
    type: "comment" | "response";
    actorName: string | null;
    actorBadgeColor: string | null;
    actorAvatarUrl: string | null;
    content: string | null;
    createdAt: string;
  }>;
  onQuestionClick: (decisionId: string) => void;
  onCommentClick: (decisionId: string) => void;
  onResponseSent?: () => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function MyWorkDecisionSidebar({
  openQuestions,
  newComments,
  discussionComments = [],
  recentActivities = [],
  onQuestionClick,
  onCommentClick,
  onResponseSent,
}: MyWorkDecisionSidebarProps) {
  const ACTIVITY_BATCH_SIZE = 5;
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [visibleActivityCount, setVisibleActivityCount] = useState(ACTIVITY_BATCH_SIZE);

  const totalItems = openQuestions.length + newComments.length;
  const activityDatasetKey = useMemo(
    () => recentActivities.map((activity) => activity.id).join("|"),
    [recentActivities]
  );
  const visibleActivities = recentActivities.slice(0, visibleActivityCount);
  const hasMoreActivities = visibleActivityCount < recentActivities.length;

  useEffect(() => {
    setVisibleActivityCount(ACTIVITY_BATCH_SIZE);
  }, [activityDatasetKey]);

  const handleSendResponse = async (responseId: string) => {
    if (!responseText.trim()) return;
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: responseText.trim() })
        .eq('id', responseId);

      if (error) throw error;
      
      toast.success("Antwort gesendet");
      setResponseText("");
      setRespondingTo(null);
      onResponseSent?.();
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error("Fehler beim Senden");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="hidden lg:block space-y-3 sticky top-4">
      <Card>
        <CardHeader className="pb-2 px-3 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold">Was liegt für mich an?</CardTitle>
            {totalItems > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {totalItems}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-3">
          <ScrollArea className="max-h-[50vh]">
            {totalItems === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Keine offenen Antworten
              </p>
            ) : (
              <div className="space-y-3">
                {/* Open Questions */}
                {openQuestions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-xs font-medium text-orange-600">
                      <MessageCircle className="h-3 w-3" />
                      <span>Rückfragen</span>
                      <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs px-1.5 py-0">
                        {openQuestions.length}
                      </Badge>
                    </div>
                    {openQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="p-2 rounded-md border-l-2 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20"
                      >
                        <button
                          onClick={() => onQuestionClick(q.decisionId)}
                          className="w-full text-left hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors rounded -m-0.5 p-0.5"
                        >
                          <p className="text-xs font-semibold line-clamp-2">{q.decisionTitle}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Avatar className="h-4 w-4">
                              {q.participantAvatarUrl && <AvatarImage src={q.participantAvatarUrl} />}
                              <AvatarFallback className="text-[8px]" style={{ backgroundColor: q.participantBadgeColor || undefined }}>
                                {getInitials(q.participantName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">{q.participantName || 'Unbekannt'}</span>
                          </div>
                          {q.comment && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              <RichTextDisplay content={q.comment} className="text-xs" />
                            </div>
                          )}
                        </button>

                        {respondingTo === q.id ? (
                          <div className="mt-1.5 pt-1.5 border-t border-orange-200 dark:border-orange-800 space-y-1.5">
                            <SimpleRichTextEditor
                              initialContent=""
                              onChange={setResponseText}
                              placeholder="Antwort..."
                              minHeight="50px"
                            />
                            <div className="flex gap-1.5">
                              <Button 
                                size="sm" 
                                onClick={() => handleSendResponse(q.id)}
                                disabled={isLoading || !responseText.trim()}
                                className="text-[10px] h-6"
                              >
                                <Send className="h-2.5 w-2.5 mr-1" />Senden
                              </Button>
                              <Button 
                                size="sm" variant="ghost"
                                onClick={() => { setRespondingTo(null); setResponseText(""); }}
                                className="text-[10px] h-6"
                              >
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm" variant="outline"
                            className="mt-1.5 text-[10px] w-full h-6"
                            onClick={(e) => { e.stopPropagation(); setRespondingTo(q.id); }}
                          >
                            Antworten
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* New Begründungen */}
                {newComments.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      <Bell className="h-3 w-3" />
                      <span>Begründungen</span>
                      <Badge variant="outline" className="text-primary border-primary text-xs px-1.5 py-0">
                        {newComments.length}
                      </Badge>
                    </div>
                    {newComments.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onCommentClick(c.decisionId)}
                        className={cn(
                          "w-full text-left p-2 rounded-md border-l-2 transition-colors",
                          c.responseType === 'yes' && "border-l-green-500 bg-green-50 dark:bg-green-950/20 hover:bg-green-100",
                          c.responseType === 'no' && "border-l-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100",
                          c.responseType === 'question' && "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100",
                        )}
                      >
                        <p className="text-xs font-semibold line-clamp-2">{c.decisionTitle}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Avatar className="h-4 w-4">
                            {c.participantAvatarUrl && <AvatarImage src={c.participantAvatarUrl} />}
                            <AvatarFallback className="text-[8px]" style={{ backgroundColor: c.participantBadgeColor || undefined }}>
                              {getInitials(c.participantName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{c.participantName}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.responseType === 'yes' && '→ Ja'}
                            {c.responseType === 'no' && '→ Nein'}
                            {c.responseType === 'question' && '→ Rückfrage'}
                          </span>
                        </div>
                        {c.comment && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            <RichTextDisplay content={c.comment} className="text-xs" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 px-3 pt-3">
          <CardTitle className="text-sm font-bold">Letzte Aktivitäten</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-3 space-y-2">
          {recentActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Keine Aktivitäten vorhanden.</p>
          ) : (
            visibleActivities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => onCommentClick(activity.decisionId)}
                className="w-full text-left p-2 rounded-md border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-1 mb-1">
                  <Avatar className="h-4 w-4">
                    {activity.actorAvatarUrl && <AvatarImage src={activity.actorAvatarUrl} />}
                    <AvatarFallback className="text-[8px]" style={{ backgroundColor: activity.actorBadgeColor || undefined }}>
                      {getInitials(activity.actorName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {activity.actorName || 'Unbekannt'} · {activity.type === 'comment' ? 'Kommentar' : 'Rückmeldung'}
                  </span>
                </div>
                <p className="text-xs font-semibold line-clamp-1">{activity.decisionTitle}</p>
                {activity.content && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    <RichTextDisplay content={activity.content} className="text-xs" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: de })}
                </p>
              </button>
            ))
          )}
          {hasMoreActivities && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setVisibleActivityCount((prev) => prev + ACTIVITY_BATCH_SIZE)}
            >
              5 weitere laden
            </Button>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
