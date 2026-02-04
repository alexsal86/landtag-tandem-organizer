import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserBadge } from "@/components/ui/user-badge";
import { MessageCircle, Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpenQuestion {
  id: string;
  decisionId: string;
  decisionTitle: string;
  participantName: string | null;
  participantBadgeColor: string | null;
  participantUserId: string;
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
  responseType: 'yes' | 'no' | 'question';
  comment: string | null;
  createdAt: string;
}

interface DecisionSidebarProps {
  openQuestions: OpenQuestion[];
  newComments: NewComment[];
  onQuestionClick: (decisionId: string) => void;
  onCommentClick: (decisionId: string) => void;
}

export function DecisionSidebar({
  openQuestions,
  newComments,
  onQuestionClick,
  onCommentClick,
}: DecisionSidebarProps) {
  const totalItems = openQuestions.length + newComments.length;

  return (
    <aside className="hidden lg:block space-y-4 sticky top-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Was liegt für mich an?</CardTitle>
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
                    <div className="space-y-1.5">
                      {openQuestions.map((question) => (
                        <button
                          key={question.id}
                          onClick={() => onQuestionClick(question.decisionId)}
                          className={cn(
                            "w-full text-left p-2 rounded-md border-l-2 border-l-orange-500",
                            "bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40",
                            "transition-colors group"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {question.decisionTitle}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">von</span>
                                <UserBadge
                                  userId={question.participantUserId}
                                  displayName={question.participantName}
                                  badgeColor={question.participantBadgeColor}
                                  size="sm"
                                />
                              </div>
                              {question.comment && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                  "{question.comment}"
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Neue Kommentare */}
                {newComments.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Bell className="h-3.5 w-3.5" />
                      <span>Neue Kommentare</span>
                      <Badge variant="outline" className="text-primary border-primary text-[10px] px-1.5 py-0">
                        {newComments.length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {newComments.map((comment) => (
                        <button
                          key={comment.id}
                          onClick={() => onCommentClick(comment.decisionId)}
                          className={cn(
                            "w-full text-left p-2 rounded-md border-l-2",
                            comment.responseType === 'yes' && "border-l-green-500 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40",
                            comment.responseType === 'no' && "border-l-red-500 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40",
                            comment.responseType === 'question' && "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40",
                            "transition-colors group"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {comment.decisionTitle}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <UserBadge
                                  userId={comment.participantUserId}
                                  displayName={comment.participantName}
                                  badgeColor={comment.participantBadgeColor}
                                  size="sm"
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {comment.responseType === 'yes' && '→ Ja'}
                                  {comment.responseType === 'no' && '→ Nein'}
                                  {comment.responseType === 'question' && '→ Rückfrage'}
                                </span>
                              </div>
                              {comment.comment && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                  "{comment.comment}"
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
                          </div>
                        </button>
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
