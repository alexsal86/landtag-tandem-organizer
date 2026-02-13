import { useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { DecisionCardActivity } from "@/components/task-decisions/DecisionCardActivity";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { EmailPreviewDialog } from "@/components/task-decisions/EmailPreviewDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  MessageCircle, CheckCircle, MoreVertical, Edit, Archive, 
  ClipboardList, Trash2, Paperclip, Globe, MessageSquare, Mail, Star 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MyWorkDecision, getResponseSummary, getBorderColor, getCustomResponseSummary } from "./types";
import { getColorClasses } from "@/lib/decisionTemplates";

interface MyWorkDecisionCardProps {
  decision: MyWorkDecision;
  onOpenDetails: (decisionId: string) => void;
  onEdit: (decisionId: string) => void;
  onArchive: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onCreateTask: (decision: MyWorkDecision) => void;
  onResponseSubmitted: () => void;
  onOpenComments: (decisionId: string, title: string) => void;
  onReply?: (responseId: string, text: string) => Promise<void>;
  commentCount: number;
  creatingTaskId: string | null;
  currentUserId: string;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const TruncatedDescription = ({ content, maxLength = 150 }: { content: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const plainText = content.replace(/<[^>]*>/g, '');
  const isTruncated = plainText.length > maxLength;

  if (!isTruncated || expanded) {
    return (
      <div>
        <RichTextDisplay content={content} className="text-sm text-muted-foreground" />
        {isTruncated && (
          <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(false); }} className="text-xs p-0 h-auto text-muted-foreground hover:text-primary">
            weniger
          </Button>
        )}
      </div>
    );
  }

  const truncatedPlain = plainText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  return (
    <div>
      <p className="text-sm text-muted-foreground">{truncatedPlain}</p>
      <Button variant="link" size="sm" onClick={(e) => { e.stopPropagation(); setExpanded(true); }} className="text-xs p-0 h-auto text-muted-foreground hover:text-primary">
        mehr
      </Button>
    </div>
  );
};

const MyWorkDecisionCardInner = ({
  decision,
  onOpenDetails,
  onEdit,
  onArchive,
  onDelete,
  onCreateTask,
  onResponseSubmitted,
  onOpenComments,
  onReply,
  commentCount,
  creatingTaskId,
  currentUserId,
}: MyWorkDecisionCardProps) => {
  const [previewEmail, setPreviewEmail] = useState<{ file_path: string; file_name: string } | null>(null);
  const summary = getResponseSummary(decision.participants);
  const isCustomTemplate = decision.response_options && decision.response_options.length > 0 &&
    !(['yes','no','question'].every(k => decision.response_options!.some(o => o.key === k)) && decision.response_options!.length <= 3);
  const customSummary = isCustomTemplate ? getCustomResponseSummary(decision.participants, decision.response_options!) : null;

  const avatarParticipants = (decision.participants || []).map(p => ({
    user_id: p.user_id,
    display_name: p.profile?.display_name || null,
    badge_color: p.profile?.badge_color || null,
    avatar_url: p.profile?.avatar_url || null,
    response_type: p.responses[0]?.response_type || null,
  }));

  return (
    <>
    <Card 
      className={cn(
        "group border-l-4 hover:bg-muted/50 transition-colors cursor-pointer",
        getBorderColor(summary, decision.response_options, decision.participants)
      )}
      onClick={() => onOpenDetails(decision.id)}
    >
      <CardContent className="p-4">
        {/* Header: Status badges + Actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {summary.questionCount > 0 ? (
              <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5 inline-block" />
                Rückfrage
              </Badge>
            ) : summary.pending === 0 && summary.total > 0 ? (
              <Badge className="bg-green-100 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 inline-block" />
                Entschieden
              </Badge>
            ) : summary.total > 0 ? (
              <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-sm px-3 py-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 inline-block" />
                Ausstehend
              </Badge>
            ) : null}

              {(decision.priority ?? 0) > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent><p>Prioritär</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

            {decision.visible_to_all && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent><p>Öffentlich</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {decision.hasResponded && decision.isParticipant && (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            )}
          </div>

          {decision.isCreator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
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
        <div className="max-w-[85%]">
          <h3 className="font-bold text-lg mb-1 line-clamp-2">{decision.title}</h3>

          {/* Description */}
          {decision.description && (
            <div onClick={(e) => e.stopPropagation()}>
              <TruncatedDescription content={decision.description} maxLength={100} />
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex items-center flex-wrap gap-3 mt-4 text-xs text-muted-foreground overflow-x-auto">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {new Date(decision.created_at).toLocaleDateString('de-DE')}
          </span>

          {decision.creator && (
            <span className="flex items-center gap-1">
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
              <span className="font-medium text-foreground">{decision.creator.display_name || 'Unbekannt'}</span>
            </span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onOpenComments(decision.id, decision.title); }}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount > 0 
              ? `${commentCount} Kommentar${commentCount !== 1 ? 'e' : ''}`
              : 'Kommentar schreiben'
            }
          </button>

          {(decision.attachmentCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {(decision.attachmentCount ?? 0) - (decision.emailAttachmentCount ?? 0) > 0 
                ? (decision.attachmentCount ?? 0) - (decision.emailAttachmentCount ?? 0) 
                : null}
            </span>
          )}

          {(decision.emailAttachmentCount ?? 0) > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {decision.emailAttachmentCount}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium mb-1.5">Angehängte E-Mails</p>
                <div className="space-y-1">
                  {(decision.emailAttachments || []).map(att => (
                    <button 
                      key={att.id} 
                      onClick={() => setPreviewEmail({ file_path: att.file_path, file_name: att.file_name })}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-0.5 transition-colors w-full text-left cursor-pointer"
                    >
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{att.file_name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {decision.topicIds && decision.topicIds.length > 0 && (
            <TopicDisplay topicIds={decision.topicIds} maxDisplay={1} />
          )}
        </div>

        {/* Voting row */}
        {decision.participants && decision.participants.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div onClick={(e) => e.stopPropagation()}>
              {decision.isParticipant && decision.participant_id && !decision.hasResponded && (
                <TaskDecisionResponse 
                  decisionId={decision.id}
                  participantId={decision.participant_id}
                  onResponseSubmitted={onResponseSubmitted}
                  hasResponded={decision.hasResponded}
                  creatorId={decision.created_by}
                />
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                {customSummary ? (() => {
                  const sortedCounts = [...customSummary.counts].sort((a, b) => b.count - a.count);
                  const winningCount = sortedCounts[0];

                  if (!winningCount || winningCount.count === 0) {
                    return <span className="text-muted-foreground font-medium">Noch offen</span>;
                  }

                  const winningOption = decision.response_options?.find((opt) => opt.key === winningCount.key);
                  const cc = getColorClasses(winningCount.color);

                  return (
                    <span className={cn("font-medium", cc.textClass)}>
                      {winningCount.label}
                      {winningOption?.description ? ` - ${winningOption.description}` : ""}
                    </span>
                  );
                })() : (
                  <>
                    <span className="text-green-600">{summary.yesCount}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-orange-600">{summary.questionCount}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-red-600">{summary.noCount}</span>
                    {summary.otherCount > 0 && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-600">{summary.otherCount}</span>
                      </>
                    )}
                  </>
                )}
              </div>
              <AvatarStack participants={avatarParticipants} maxVisible={3} size="sm" />
            </div>
          </div>
        )}

        {/* Activity preview */}
        <DecisionCardActivity 
          participants={decision.participants} 
          maxItems={2} 
          isCreator={decision.isCreator}
          creatorProfile={decision.creator ? {
            display_name: decision.creator.display_name,
            badge_color: decision.creator.badge_color,
            avatar_url: decision.creator.avatar_url,
          } : undefined}
          onReply={onReply}
        />
      </CardContent>
    </Card>

    <EmailPreviewDialog
      open={!!previewEmail}
      onOpenChange={() => setPreviewEmail(null)}
      filePath={previewEmail?.file_path || ''}
      fileName={previewEmail?.file_name || ''}
    />
    </>
  );
};

export const MyWorkDecisionCard = memo(MyWorkDecisionCardInner);
