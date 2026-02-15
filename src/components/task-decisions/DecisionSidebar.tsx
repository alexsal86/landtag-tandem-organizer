import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MessageCircle, Bell, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface OpenQuestion {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantUserId: string;
  participantAvatarUrl?: string | null;
  comment: string | null;
  createdAt: string;
  hasCreatorResponse: boolean;
}

interface NewComment {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantUserId: string;
  participantAvatarUrl?: string | null;
  responseType: string;
  comment: string | null;
  createdAt: string;
}

interface DecisionSidebarProps {
  openQuestions: OpenQuestion[];
  newComments: NewComment[];
  recentActivities: Array<{
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
  onActivityClick: (decisionId: string) => void;
  onResponseSent?: () => void;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function DecisionSidebar({
  openQuestions,
  newComments,
  recentActivities,
  onQuestionClick,
  onCommentClick,
  onActivityClick,
  onResponseSent,
}: DecisionSidebarProps) {
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const totalItems = openQuestions.length + newComments.length;

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
    <aside className="hidden lg:block space-y-4 sticky top-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Letzte Aktivitäten</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {recentActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Keine Aktivitäten vorhanden.</p>
          ) : (
            recentActivities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => onActivityClick(activity.decisionId)}
                className="w-full text-left p-2 rounded-md border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-4 w-4">
                    {activity.actorAvatarUrl && <AvatarImage src={activity.actorAvatarUrl} />}
                    <AvatarFallback
                      className="text-[8px]"
                      style={{ backgroundColor: activity.actorBadgeColor || undefined }}
                    >
                      {getInitials(activity.actorName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {activity.actorName || "Unbekannt"} · {activity.type === "comment" ? "Kommentar" : "Rückmeldung"}
                  </span>
                </div>
                <p className="text-xs font-medium line-clamp-1">{activity.decisionTitle}</p>
                {activity.content && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    <RichTextDisplay content={activity.content} className="text-xs" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: de })}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">Was liegt für mich an?</CardTitle>
            {totalItems > 0 && (
              <Badge variant="destructive" className="text-xs">
                {totalItems}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-[60vh]">
            {totalItems === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Keine offenen Aktionen
              </p>
            ) : (
              <div className="space-y-4">
                {/* Offene Rückfragen */}
                {openQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600">
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Offene Rückfragen</span>
                      <Badge variant="outline" className="text-orange-600 border-orange-600 text-[10px] px-1.5 py-0">
                        {openQuestions.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {openQuestions.map((question) => (
                        <div
                          key={question.id}
                          className={cn(
                            "p-2.5 rounded-md border-l-2 border-l-orange-500",
                            "bg-orange-50 dark:bg-orange-950/20"
                          )}
                        >
                          <button
                            onClick={() => onQuestionClick(question.decisionId)}
                            className="w-full text-left hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors rounded -m-1 p-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold line-clamp-3">
                                  {question.decisionTitle}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-xs text-muted-foreground">von</span>
                                  <Avatar className="h-4 w-4">
                                    {question.participantAvatarUrl && (
                                      <AvatarImage src={question.participantAvatarUrl} />
                                    )}
                                    <AvatarFallback
                                      className="text-[8px]"
                                      style={{ backgroundColor: question.participantBadgeColor || undefined }}
                                    >
                                      {getInitials(question.participantName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">
                                    {question.participantName || 'Unbekannt'}
                                  </span>
                                </div>
                                {question.comment && (
                                  <div className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                                    <RichTextDisplay content={question.comment} className="text-xs" />
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            </div>
                          </button>

                          {/* Inline Response */}
                          {respondingTo === question.id ? (
                            <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800 space-y-2">
                              <SimpleRichTextEditor
                                initialContent=""
                                onChange={setResponseText}
                                placeholder="Ihre Antwort..."
                                minHeight="60px"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSendResponse(question.id)}
                                  disabled={isLoading || !responseText.trim()}
                                  className="text-xs"
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Senden
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => { setRespondingTo(null); setResponseText(""); }}
                                  className="text-xs"
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 text-xs w-full"
                              onClick={(e) => { e.stopPropagation(); setRespondingTo(question.id); }}
                            >
                              Antworten
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Neue Begründungen */}
                {newComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Bell className="h-3.5 w-3.5" />
                      <span>Neue Begründungen</span>
                      <Badge variant="outline" className="text-primary border-primary text-[10px] px-1.5 py-0">
                        {newComments.length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {newComments.map((comment) => (
                        <div
                          key={comment.id}
                          className={cn(
                            "w-full text-left p-2.5 rounded-md border-l-2",
                            comment.responseType === 'yes' && "border-l-green-500 bg-green-50 dark:bg-green-950/20",
                            comment.responseType === 'no' && "border-l-red-500 bg-red-50 dark:bg-red-950/20",
                            comment.responseType === 'question' && "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
                          )}
                        >
                          <button
                            onClick={() => onCommentClick(comment.decisionId)}
                            className="w-full text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold line-clamp-3">
                                  {comment.decisionTitle}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Avatar className="h-4 w-4">
                                    {comment.participantAvatarUrl && (
                                      <AvatarImage src={comment.participantAvatarUrl} />
                                    )}
                                    <AvatarFallback
                                      className="text-[8px]"
                                      style={{ backgroundColor: comment.participantBadgeColor || undefined }}
                                    >
                                      {getInitials(comment.participantName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs text-muted-foreground">
                                    {comment.participantName || 'Unbekannt'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {comment.responseType === 'yes' && '→ Ja'}
                                    {comment.responseType === 'no' && '→ Nein'}
                                    {comment.responseType === 'question' && '→ Rückfrage'}
                                  </span>
                                </div>
                                {comment.comment && (
                                  <div className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                                    <RichTextDisplay content={comment.comment} className="text-xs" />
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            </div>
                          </button>
                          {/* Reply button for new justifications */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 text-xs w-full"
                            onClick={(e) => { e.stopPropagation(); setRespondingTo(comment.id); }}
                          >
                            Antworten
                          </Button>
                          {respondingTo === comment.id && (
                            <div className="mt-2 pt-2 border-t space-y-2">
                              <SimpleRichTextEditor
                                initialContent=""
                                onChange={setResponseText}
                                placeholder="Ihre Antwort..."
                                minHeight="60px"
                              />
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSendResponse(comment.id)}
                                  disabled={isLoading || !responseText.trim()}
                                  className="text-xs"
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Senden
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => { setRespondingTo(null); setResponseText(""); }}
                                  className="text-xs"
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </aside>
  );
}
