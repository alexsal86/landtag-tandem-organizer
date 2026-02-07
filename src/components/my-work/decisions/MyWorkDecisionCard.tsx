import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { DecisionViewerComment } from "@/components/task-decisions/DecisionViewerComment";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  MessageCircle, CheckCircle, MoreVertical, Edit, Archive, 
  ClipboardList, Trash2, Paperclip, Globe, MessageSquare 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MyWorkDecision, getResponseSummary, getBorderColor } from "./types";

interface MyWorkDecisionCardProps {
  decision: MyWorkDecision;
  onOpenDetails: (decisionId: string) => void;
  onEdit: (decisionId: string) => void;
  onArchive: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onCreateTask: (decision: MyWorkDecision) => void;
  onResponseSubmitted: () => void;
  onOpenComments: (decisionId: string, title: string) => void;
  commentCount: number;
  creatingTaskId: string | null;
  currentUserId: string;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function MyWorkDecisionCard({
  decision,
  onOpenDetails,
  onEdit,
  onArchive,
  onDelete,
  onCreateTask,
  onResponseSubmitted,
  onOpenComments,
  commentCount,
  creatingTaskId,
  currentUserId,
}: MyWorkDecisionCardProps) {
  const summary = getResponseSummary(decision.participants);

  const avatarParticipants = (decision.participants || []).map(p => ({
    user_id: p.user_id,
    display_name: p.profile?.display_name || null,
    badge_color: p.profile?.badge_color || null,
    avatar_url: p.profile?.avatar_url || null,
    response_type: p.responses[0]?.response_type || null,
  }));

  return (
    <Card 
      className={cn(
        "border-l-4 hover:bg-muted/50 transition-colors cursor-pointer",
        getBorderColor(summary)
      )}
      onClick={() => onOpenDetails(decision.id)}
    >
      <CardContent className="p-3">
        {/* Header: Status badges + Actions */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {summary.questionCount > 0 ? (
              <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-[10px] px-2 py-0.5">
                <MessageCircle className="h-2.5 w-2.5 mr-1" />
                Rückfrage
              </Badge>
            ) : summary.pending === 0 && summary.total > 0 ? (
              <Badge className="bg-green-500 hover:bg-green-500 text-white text-[10px] px-2 py-0.5">
                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                Entschieden
              </Badge>
            ) : summary.total > 0 ? (
              <Badge className="bg-gray-400 hover:bg-gray-400 text-white text-[10px] px-2 py-0.5">
                {summary.pending} ausstehend
              </Badge>
            ) : null}

            {decision.hasResponded && decision.isParticipant && (
              <CheckCircle className="h-3 w-3 text-emerald-500" />
            )}
          </div>

          {/* Actions dropdown for creators */}
          {decision.isCreator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(decision.id); }}>
                  <Edit className="h-4 w-4 mr-2" />Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(decision.id); }}>
                  <Archive className="h-4 w-4 mr-2" />Archivieren
                </DropdownMenuItem>
                {summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); onCreateTask(decision); }}
                      disabled={creatingTaskId === decision.id}
                    >
                      <ClipboardList className="h-4 w-4 mr-2" />
                      {creatingTaskId === decision.id ? 'Erstelle...' : 'Aufgabe erstellen'}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(decision.id); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm mb-0.5 line-clamp-1">{decision.title}</h3>

        {/* Description - 1 line truncated */}
        {decision.description && (
          <div onClick={(e) => e.stopPropagation()}>
            <RichTextDisplay content={decision.description} className="text-xs text-muted-foreground line-clamp-1" />
          </div>
        )}

        {/* Footer: Creator, Date, Visibility, Voting Stand */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t">
          <div className="flex items-center gap-2">
            {decision.creator && (
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  {decision.creator.avatar_url && (
                    <AvatarImage src={decision.creator.avatar_url} alt={decision.creator.display_name || 'Avatar'} />
                  )}
                  <AvatarFallback 
                    className="text-[8px]"
                    style={{ backgroundColor: decision.creator.badge_color || undefined }}
                  >
                    {getInitials(decision.creator.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-semibold text-foreground">
                  {decision.creator.display_name || 'Unbekannt'}
                </span>
              </div>
            )}

            <span className="text-[10px] text-muted-foreground">
              {new Date(decision.created_at).toLocaleDateString('de-DE')}
            </span>

            {decision.visible_to_all && (
              <Globe className="h-3 w-3 text-muted-foreground" />
            )}

            {(decision.attachmentCount ?? 0) > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Paperclip className="h-2.5 w-2.5" />
                {decision.attachmentCount}
              </span>
            )}

            {decision.topicIds && decision.topicIds.length > 0 && (
              <TopicDisplay topicIds={decision.topicIds} maxDisplay={1} />
            )}
          </div>

          {/* Right side: Comments + Voting stand + AvatarStack */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenComments(decision.id, decision.title); }}
              className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {commentCount > 0 && <span className="text-[10px]">{commentCount}</span>}
            </button>

            {decision.participants && decision.participants.length > 0 && (
              <>
                <div className="flex items-center gap-0.5 text-[10px]">
                  <span className="text-green-600 font-bold">{summary.yesCount}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-orange-600 font-bold">{summary.questionCount}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-red-600 font-bold">{summary.noCount}</span>
                </div>
                <AvatarStack participants={avatarParticipants} maxVisible={3} size="sm" />
              </>
            )}
          </div>
        </div>

        {/* Inline voting for unanswered participants */}
        {decision.isParticipant && decision.participant_id && !decision.hasResponded && (
          <div className="mt-2 pt-1.5 border-t" onClick={(e) => e.stopPropagation()}>
            <TaskDecisionResponse 
              decisionId={decision.id}
              participantId={decision.participant_id}
              onResponseSubmitted={onResponseSubmitted}
              hasResponded={decision.hasResponded}
            />
          </div>
        )}

        {/* Viewer comment for public decisions */}
        {!decision.isParticipant && decision.visible_to_all && (
          <div className="mt-2 pt-1.5 border-t" onClick={(e) => e.stopPropagation()}>
            <DecisionViewerComment
              decisionId={decision.id}
              creatorId={decision.created_by}
              decisionTitle={decision.title}
              onCommentSubmitted={onResponseSubmitted}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
