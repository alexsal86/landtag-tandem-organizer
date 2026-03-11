import { useMemo, useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { DecisionCardActivity } from "@/components/task-decisions/DecisionCardActivity";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { TopicDisplay } from "@/components/topics/TopicSelector";
import { EmailPreviewDialog } from "@/components/task-decisions/EmailPreviewDialog";
import { DecisionAttachmentPreviewDialog } from "@/components/task-decisions/DecisionAttachmentPreviewDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  CheckCircle,
  MoreVertical,
  Edit,
  Archive,
  ClipboardList,
  Trash2,
  Paperclip,
  Globe,
  MessageSquare,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MyWorkDecision, getResponseSummary, getBorderColor, getCustomResponseSummary } from "./types";
import { getColorClasses } from "@/lib/decisionTemplates";

interface MyWorkDecisionCardProps {
  decision: MyWorkDecision;
  isHighlighted?: boolean;
  highlightRef?: (el: HTMLElement | null) => void;
  onOpenDetails: (decisionId: string) => void;
  onEdit: (decisionId: string) => void;
  onArchive: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onCreateTask: (decision: MyWorkDecision) => void;
  onResponseSubmitted: () => void;
  onOpenComments: (decisionId: string, title: string) => void;
  onReply?: (payload: {
    responseId: string;
    text: string;
    mode: 'creator_response' | 'participant_followup';
  }) => Promise<void>;
  commentCount: number;
  creatingTaskId: string | null;
  archivingDecisionId?: string | null;
  deletingDecisionId?: string | null;
  currentUserId: string;
}

const getInitials = (name: string | null) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const MyWorkDecisionCardInner = ({
  decision,
  isHighlighted: highlighted,
  highlightRef: hRef,
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
  archivingDecisionId,
  deletingDecisionId,
  currentUserId,
}: MyWorkDecisionCardProps) => {
  const [previewEmail, setPreviewEmail] = useState<{ file_path: string; file_name: string } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ file_path: string; file_name: string } | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const summary = getResponseSummary(decision.participants);
  const isArchiving = archivingDecisionId === decision.id;
  const isDeleting = deletingDecisionId === decision.id;
  const isBusy = isArchiving || isDeleting;

  const plainDescription = useMemo(() => {
    if (!decision.description) return '';

    return decision.description
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [decision.description]);
  const previewCharacterLimit = 620;
  const hasLongDescription = plainDescription.length > previewCharacterLimit;
  const previewText = hasLongDescription
    ? `${plainDescription.slice(0, previewCharacterLimit).replace(/\s+\S*$/, '')}…`
    : plainDescription;

  const customSummary = useMemo(() => {
    if (!decision.response_options || decision.response_options.length === 0) {
      return null;
    }

    const keys = decision.response_options.map((option) => option.key).sort();
    const isStandardOptions =
      (keys.length === 2 && keys[0] === 'no' && keys[1] === 'yes') ||
      (keys.length === 3 && keys[0] === 'no' && keys[1] === 'question' && keys[2] === 'yes');

    if (isStandardOptions || !decision.participants) {
      return null;
    }

    return getCustomResponseSummary(decision.participants, decision.response_options);
  }, [decision.participants, decision.response_options]);

  const summaryItems = customSummary
    ? [
        ...customSummary.counts.map((entry) => ({
          key: entry.key,
          label: entry.label,
          count: entry.count,
          textClass: getColorClasses(entry.color).textClass,
        })),
        { key: 'pending', label: 'Ausstehend', count: customSummary.pending, textClass: 'text-muted-foreground' },
      ]
    : [
        { key: 'yes', label: 'Ja', count: summary.yesCount, textClass: 'text-green-600' },
        { key: 'no', label: 'Nein', count: summary.noCount, textClass: 'text-red-600' },
        { key: 'question', label: 'Rückfrage', count: summary.questionCount, textClass: 'text-orange-600' },
      ];

  const winningResponse = useMemo(() => {
    if (summary.pending !== 0 || summary.total === 0) return null;

    const sorted = [...summaryItems]
      .filter((item) => item.key !== 'pending' && item.count > 0)
      .sort((a, b) => b.count - a.count);

    const winner = sorted[0];
    if (!winner || winner.key === 'question') return null;

    return {
      label: winner.label,
      textClass: winner.textClass,
    };
  }, [summary.pending, summary.total, summaryItems]);

  const avatarParticipants = (decision.participants || []).map((p) => ({
    user_id: p.user_id,
    display_name: p.profile?.display_name || null,
    badge_color: p.profile?.badge_color || null,
    avatar_url: p.profile?.avatar_url || null,
    response_type: p.responses[0]?.response_type || null,
  }));

  return (
    <>
      <Card
        ref={hRef as any}
        className={cn(
          'group border-l-4 hover:bg-muted/40 transition-colors cursor-pointer',
          getBorderColor(summary, decision.response_options, decision.participants),
          highlighted && 'notification-highlight',
        )}
        onClick={() => onOpenDetails(decision.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {summary.questionCount > 0 ? (
                <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 text-sm px-3 py-1 font-bold">
                  Rückfrage
                </Badge>
              ) : summary.pending === 0 && summary.total > 0 ? (
                <Badge className="bg-green-100 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-sm px-3 py-1 font-bold">
                  Entschieden
                </Badge>
              ) : summary.total > 0 ? (
                <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-sm px-3 py-1 font-bold">
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
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(decision.id); }} disabled={isBusy}>
                    <Archive className="h-4 w-4 mr-2" />{isArchiving ? 'Archiviere...' : 'Archivieren'}
                  </DropdownMenuItem>
                  {summary.pending === 0 && decision.participants && decision.participants.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onCreateTask(decision); }}
                        disabled={creatingTaskId === decision.id || isBusy}
                      >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        {creatingTaskId === decision.id ? 'Erstelle...' : 'Aufgabe erstellen'}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(decision.id); }}
                    disabled={isBusy}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />{isDeleting ? 'Lösche...' : 'Löschen'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0">
              <h3 className="font-bold text-lg leading-snug mb-2">{decision.title}</h3>

              {decision.description && (
                <div onClick={(e) => e.stopPropagation()}>
                  <div className={cn(!detailsExpanded && hasLongDescription && 'max-h-52 overflow-hidden')}>
                    <RichTextDisplay
                      content={detailsExpanded ? decision.description : previewText}
                      className="leading-relaxed [&_p:last-child]:mb-0"
                    />
                  </div>
                  {hasLongDescription && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-7 px-0 text-xs"
                      onClick={() => setDetailsExpanded((prev) => !prev)}
                    >
                      {detailsExpanded ? 'Weniger Details' : 'Details anzeigen'}
                      {detailsExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <aside
              className="rounded-lg border border-border/70 bg-background/95 p-3.5 space-y-3 self-start lg:sticky lg:top-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Deine Entscheidung</p>

              {decision.isParticipant && decision.participant_id && (
                <TaskDecisionResponse
                  decisionId={decision.id}
                  participantId={decision.participant_id || ''}
                  onResponseSubmitted={onResponseSubmitted}
                  hasResponded={decision.hasResponded}
                  creatorId={decision.created_by}
                  layout="decision-panel"
                  disabled={!decision.isParticipant || !decision.participant_id}
                />
              )}

              <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-2">
                {winningResponse && (
                  <div className={cn('text-lg font-extrabold', winningResponse.textClass)}>
                    Ergebnis: {winningResponse.label}
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                    {summaryItems.map((item, idx) => (
                      <span key={item.key} className="inline-flex items-center gap-1">
                        {idx > 0 && <span className="text-muted-foreground">•</span>}
                        <span className={item.textClass}>{item.count}</span>
                        <span className={item.textClass}>{item.label}</span>
                      </span>
                    ))}
                  </div>
                  <AvatarStack participants={avatarParticipants} maxVisible={4} size="sm" />
                </div>
              </div>

              <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span>{new Date(decision.created_at).toLocaleDateString('de-DE')}</span>
                  {decision.creator && (
                    <>
                      <span>•</span>
                      <span>{decision.creator.display_name || 'Unbekannt'}</span>
                    </>
                  )}
                  <span>•</span>
                  <button
                    onClick={() => onOpenComments(decision.id, decision.title)}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {commentCount > 0 ? `${commentCount} Kommentar${commentCount !== 1 ? 'e' : ''}` : 'Kommentar schreiben'}
                  </button>

                  {(decision.fileAttachments?.length ?? 0) > 0 && (
                    <>
                      <span>•</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                          <Paperclip className="h-3.5 w-3.5" />
                          {decision.fileAttachments?.length}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-medium mb-1.5">Angehängte Dateien</p>
                        <div className="space-y-1">
                          {(decision.fileAttachments || []).map((att) => (
                            <button
                              key={att.id}
                              onClick={() => setPreviewAttachment({ file_path: att.file_path, file_name: att.file_name })}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1 py-1 transition-colors w-full text-left cursor-pointer"
                            >
                              <Paperclip className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{att.file_name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    </>
                  )}

                  {(decision.emailAttachmentCount ?? 0) > 0 && (
                    <>
                      <span>•</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                          <Mail className="h-3.5 w-3.5" />
                          {decision.emailAttachmentCount}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs font-medium mb-1.5">Angehängte E-Mails</p>
                        <div className="space-y-1">
                          {(decision.emailAttachments || []).map((att) => (
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
                    </>
                  )}
                </div>

                {decision.topicIds && decision.topicIds.length > 0 && (
                  <TopicDisplay topicIds={decision.topicIds} maxDisplay={1} />
                )}
              </div>
            </aside>
          </div>

          <DecisionCardActivity
            participants={decision.participants}
            maxItems={2}
            isCreator={decision.isCreator}
            currentUserId={currentUserId}
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

      <DecisionAttachmentPreviewDialog
        open={!!previewAttachment}
        onOpenChange={() => setPreviewAttachment(null)}
        filePath={previewAttachment?.file_path || ''}
        fileName={previewAttachment?.file_name || ''}
      />
    </>
  );
};

export const MyWorkDecisionCard = memo(MyWorkDecisionCardInner);
