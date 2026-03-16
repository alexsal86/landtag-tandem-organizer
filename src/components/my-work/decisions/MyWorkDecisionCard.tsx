import { useMemo, useState, memo, useEffect, useRef } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskDecisionResponse } from "@/components/task-decisions/TaskDecisionResponse";
import { DecisionCardActivity } from "@/components/task-decisions/DecisionCardActivity";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
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
  Send,
  Mail,
  Star,
  ChevronDown,
  ChevronUp,
  Info,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MyWorkDecision, getResponseSummary, getBorderColor, getCustomResponseSummary } from "./types";
import { getColorClasses } from "@/lib/decisionTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";

const APPOINTMENT_REQUEST_TITLE_MARKER = 'appointment_request_title:';
const APPOINTMENT_REQUEST_START_MARKER = 'appointment_request_start:';
const APPOINTMENT_REQUEST_REQUESTER_MARKER = 'appointment_request_requester:';

interface DayTimelineItem {
  id: string;
  title: string;
  start: string;
  end: string;
  simulated?: boolean;
}

const extractMarkerValue = (description: string | null, marker: string): string | null => {
  if (!description) return null;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}(.+)`, 'i'));
  return match?.[1]?.trim() ?? null;
};

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

const getPromptColorClasses = (color: string) => {
  switch (color) {
    case 'red':
      return {
        container: 'border-red-300 bg-red-50',
        icon: 'text-red-600',
        submitButton: 'bg-red-600 hover:bg-red-700 text-white',
      };
    case 'orange':
      return {
        container: 'border-orange-300 bg-orange-50',
        icon: 'text-orange-600',
        submitButton: 'bg-orange-600 hover:bg-orange-700 text-white',
      };
    case 'yellow':
      return {
        container: 'border-yellow-300 bg-yellow-50',
        icon: 'text-yellow-700',
        submitButton: 'bg-yellow-500 hover:bg-yellow-600 text-black',
      };
    case 'blue':
      return {
        container: 'border-blue-300 bg-blue-50',
        icon: 'text-blue-600',
        submitButton: 'bg-blue-600 hover:bg-blue-700 text-white',
      };
    case 'purple':
      return {
        container: 'border-purple-300 bg-purple-50',
        icon: 'text-purple-600',
        submitButton: 'bg-purple-600 hover:bg-purple-700 text-white',
      };
    case 'lime':
      return {
        container: 'border-lime-300 bg-lime-50',
        icon: 'text-lime-700',
        submitButton: 'bg-lime-600 hover:bg-lime-700 text-white',
      };
    case 'gray':
      return {
        container: 'border-gray-300 bg-gray-50',
        icon: 'text-gray-600',
        submitButton: 'bg-gray-600 hover:bg-gray-700 text-white',
      };
    case 'green':
    default:
      return {
        container: 'border-green-300 bg-green-50',
        icon: 'text-green-600',
        submitButton: 'bg-green-600 hover:bg-green-700 text-white',
      };
  }
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
  const [showCommentPrompt, setShowCommentPrompt] = useState(false);
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [isSchedulePinnedOpen, setIsSchedulePinnedOpen] = useState(false);
  const [isScheduleHoverOpen, setIsScheduleHoverOpen] = useState(false);
  const [dayTimelineItems, setDayTimelineItems] = useState<DayTimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentEditorKey, setCommentEditorKey] = useState(0);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentPromptColor, setCommentPromptColor] = useState('green');
  const responseRefreshTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const isAppointmentRequest = decision.title.toLowerCase().startsWith('terminanfrage:');
  const requestedTitle = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_TITLE_MARKER) || decision.title.replace(/^Terminanfrage:\s*/i, '');
  const requestedStartIso = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_START_MARKER);
  const requestedBy = extractMarkerValue(decision.description, APPOINTMENT_REQUEST_REQUESTER_MARKER) || 'Ein Mitarbeiter';
  const requestedStart = requestedStartIso ? new Date(requestedStartIso) : null;
  const isRequestedStartValid = Boolean(requestedStart && !Number.isNaN(requestedStart.getTime()));
  const shouldShowTimeline = isAppointmentRequest && isRequestedStartValid && (isSchedulePinnedOpen || isScheduleHoverOpen);

  const appointmentRequestNarrative = useMemo(() => {
    if (!isAppointmentRequest || !isRequestedStartValid || !requestedStart) {
      return null;
    }

    return `${requestedBy} fragt an, ob du den Termin „${requestedTitle}“ am ${format(requestedStart, 'dd.MM.yyyy', { locale: de })} um ${format(requestedStart, 'HH:mm', { locale: de })} Uhr zusagen möchtest.`;
  }, [isAppointmentRequest, isRequestedStartValid, requestedBy, requestedStart, requestedTitle]);

  const summary = getResponseSummary(decision.participants);
  const isArchiving = archivingDecisionId === decision.id;
  const isDeleting = deletingDecisionId === decision.id;
  const isBusy = isArchiving || isDeleting;

  const displayDescription = useMemo(() => {
    if (!decision.description) return '';
    if (!isAppointmentRequest) return decision.description;

    return decision.description
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim().toLowerCase();
        return !(
          trimmed.startsWith(APPOINTMENT_REQUEST_TITLE_MARKER)
          || trimmed.startsWith(APPOINTMENT_REQUEST_START_MARKER)
          || trimmed.startsWith(APPOINTMENT_REQUEST_REQUESTER_MARKER)
          || trimmed.startsWith('appointment_request_location:')
          || trimmed.startsWith('appointment_request_target_deputy:')
          || trimmed.startsWith('appointment_request_appointment_id:')
        );
      })
      .join('\n')
      .trim();
  }, [decision.description, isAppointmentRequest]);

  const plainDescription = useMemo(() => {
    if (!displayDescription) return '';

    return displayDescription
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, [displayDescription]);
  const previewCharacterLimit = 1240;
  const hasLongDescription = plainDescription.length > previewCharacterLimit;

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

  const showInlineSummaryCounts = !decision.isParticipant || decision.hasResponded;

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


  const promptColorClasses = getPromptColorClasses(commentPromptColor);

  const avatarParticipants = (decision.participants || []).map((p) => ({
    user_id: p.user_id,
    display_name: p.profile?.display_name || null,
    badge_color: p.profile?.badge_color || null,
    avatar_url: p.profile?.avatar_url || null,
    response_type: p.responses[0]?.response_type || null,
  }));


  const pendingParticipants = (decision.participants || []).filter((participant) => !participant.responses?.[0]);
  const pendingParticipantNames = pendingParticipants
    .map((participant) => participant.profile?.display_name || 'Unbekannt')
    .join(', ');

  const clearResponseRefreshTimeout = () => {
    if (responseRefreshTimeoutRef.current !== null) {
      window.clearTimeout(responseRefreshTimeoutRef.current);
      responseRefreshTimeoutRef.current = null;
    }
  };

  const sanitizedCommentDraft = commentDraft
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const handleResponseSubmitted = (meta?: { responseType: string; color?: string }) => {
    clearResponseRefreshTimeout();
    const optionColor = meta?.color
      || decision.response_options?.find((option) => option.key === meta?.responseType)?.color
      || 'green';

    setCommentPromptColor(optionColor);
    setCommentDraft('');
    setCommentEditorKey((prev) => prev + 1);
    setShowCommentEditor(false);
    setShowCommentPrompt(true);

    responseRefreshTimeoutRef.current = window.setTimeout(() => {
      setShowCommentPrompt(false);
      setShowCommentEditor(false);
      onResponseSubmitted();
    }, 10000);
  };

  const handleOpenJustificationEditor = () => {
    clearResponseRefreshTimeout();
    setShowCommentEditor(true);
  };

  const handleCompleteImmediately = () => {
    clearResponseRefreshTimeout();
    setShowCommentPrompt(false);
    setShowCommentEditor(false);
    setCommentDraft('');
    setCommentEditorKey((prev) => prev + 1);
    onResponseSubmitted();
  };

  const handleSubmitJustification = async () => {
    const plainComment = sanitizedCommentDraft;
    if (!plainComment || isSubmittingComment || !decision.participant_id) return;

    setIsSubmittingComment(true);
    try {
      const { data: existingResponse, error: responseLookupError } = await supabase
        .from('task_decision_responses')
        .select('id')
        .eq('decision_id', decision.id)
        .eq('participant_id', decision.participant_id)
        .is('parent_response_id', null)
        .maybeSingle();

      if (responseLookupError) throw responseLookupError;

      if (!existingResponse) {
        throw new Error('Keine Rückmeldung gefunden, die ergänzt werden kann.');
      }

      const { error } = await supabase
        .from('task_decision_responses')
        .update({
          comment: commentDraft.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingResponse.id);

      if (error) throw error;

      toast({
        title: "Begründung gespeichert",
        description: "Deine Begründung wurde als Rückmeldung zur Entscheidung gespeichert.",
      });

      clearResponseRefreshTimeout();
      setShowCommentPrompt(false);
      setShowCommentEditor(false);
      setCommentDraft('');
      setCommentEditorKey((prev) => prev + 1);
      onResponseSubmitted();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Die Begründung konnte nicht zur Rückmeldung gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  useEffect(() => {
    return () => {
      clearResponseRefreshTimeout();
    };
  }, []);

  useEffect(() => {
    const loadDayTimeline = async () => {
      if (!shouldShowTimeline || !currentTenant?.id || !requestedStart) return;

      setIsTimelineLoading(true);
      try {
        const contextStart = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000);
        const contextEnd = new Date(requestedStart.getTime() + 3 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('appointments')
          .select('id, title, start_time, end_time')
          .eq('tenant_id', currentTenant.id)
          .gte('start_time', contextStart.toISOString())
          .lte('start_time', contextEnd.toISOString())
          .order('start_time', { ascending: true });

        if (error) throw error;

        const existingItems: DayTimelineItem[] = (data || []).map((item) => ({
          id: item.id,
          title: item.title,
          start: item.start_time,
          end: item.end_time,
        }));

        const simulatedStart = requestedStart.toISOString();
        const simulatedEnd = new Date(requestedStart.getTime() + 60 * 60 * 1000).toISOString();
        const hasSameSlot = existingItems.some(
          (item) => item.start === simulatedStart && item.title.trim().toLowerCase() === requestedTitle.trim().toLowerCase(),
        );

        const combined = hasSameSlot
          ? existingItems
          : [...existingItems, {
              id: `simulated-${decision.id}`,
              title: `${requestedTitle} (angefragt)`,
              start: simulatedStart,
              end: simulatedEnd,
              simulated: true,
            }];

        combined.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setDayTimelineItems(combined);
      } catch (error) {
        setDayTimelineItems([]);
      } finally {
        setIsTimelineLoading(false);
      }
    };

    loadDayTimeline();
  }, [shouldShowTimeline, currentTenant?.id, requestedStartIso, requestedTitle, decision.id]);

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
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-bold text-lg leading-snug">{decision.title}</h3>
                {isAppointmentRequest && isRequestedStartValid && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsSchedulePinnedOpen((prev) => !prev);
                          }}
                          onMouseEnter={() => setIsScheduleHoverOpen(true)}
                          onMouseLeave={() => setIsScheduleHoverOpen(false)}
                          aria-label="Termin-Tagesvorschau anzeigen"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tagessimulation für den angefragten Termin anzeigen</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {shouldShowTimeline && (
                <div className="mb-3 rounded-md border border-blue-200 bg-blue-50/60 p-2">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Tageskontext ±3 Stunden ({requestedStart ? format(requestedStart, 'dd.MM.yyyy HH:mm', { locale: de }) : ''} Uhr)
                  </div>
                  {isTimelineLoading ? (
                    <p className="text-xs text-muted-foreground">Lade Termine…</p>
                  ) : dayTimelineItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Termine für diesen Tag.</p>
                  ) : (
                    <div className="space-y-1">
                      {dayTimelineItems.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 rounded px-1.5 py-1 text-xs',
                            item.simulated ? 'bg-blue-100 border border-blue-300' : 'bg-background/80 border border-transparent'
                          )}
                        >
                          <span className="w-11 shrink-0 font-mono text-muted-foreground">
                            {format(new Date(item.start), 'HH:mm', { locale: de })}
                          </span>
                          <span className="truncate text-foreground">{item.title}</span>
                          {item.simulated && (
                            <Badge variant="secondary" className="ml-auto text-[10px]">simuliert</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {decision.description && (
                <div onClick={(e) => e.stopPropagation()}>
                  {appointmentRequestNarrative && (
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{appointmentRequestNarrative}</p>
                  )}
                  <div className={cn('relative', !detailsExpanded && hasLongDescription && 'max-h-[26rem] overflow-hidden')}>
                    <RichTextDisplay
                      content={displayDescription}
                      className="leading-relaxed [&_p:last-child]:mb-0"
                    />
                    {!detailsExpanded && hasLongDescription && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/95 to-transparent" />
                    )}
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
              className="rounded-lg border border-border/70 bg-background/95 p-3.5 space-y-3 self-start lg:sticky lg:top-16"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-foreground">Deine Entscheidung</p>

              {decision.isParticipant && decision.participant_id && (
                <TaskDecisionResponse
                  decisionId={decision.id}
                  participantId={decision.participant_id || ''}
                  onResponseSubmitted={handleResponseSubmitted}
                  hasResponded={decision.hasResponded}
                  creatorId={decision.created_by}
                  layout="decision-panel"
                  disabled={!decision.isParticipant || !decision.participant_id}
                  showCreatorResponse={false}
                />
              )}

              {showCommentPrompt && (
                <div className={cn('animate-in fade-in slide-in-from-top-1 mt-3 rounded-lg border p-3 space-y-2', promptColorClasses.container)}>
                  {!showCommentEditor ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <MessageSquare className={cn("h-4 w-4", promptColorClasses.icon)} />
                        Entscheidung erfasst.
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={handleOpenJustificationEditor}
                          className="underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          Begründung hinzufügen
                        </button>{' '}
                        oder{' '}
                        <button
                          type="button"
                          onClick={handleCompleteImmediately}
                          className="underline underline-offset-2 hover:text-foreground transition-colors"
                        >
                          sofort erledigen
                        </button>
                        .<br />
                        Ohne Aktion wird in 10 Sekunden automatisch aktualisiert.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <MessageSquare className={cn("h-4 w-4", promptColorClasses.icon)} />
                        Begründung ergänzen
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Bitte begründe deine Entscheidung kurz. Der Refresh erfolgt nach dem Absenden.
                      </p>
                      <SimpleRichTextEditor
                        key={commentEditorKey}
                        initialContent=""
                        onChange={setCommentDraft}
                        placeholder="Kurze Begründung eingeben..."
                        minHeight="90px"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSubmitJustification}
                          disabled={isSubmittingComment || !sanitizedCommentDraft}
                          className={promptColorClasses.submitButton}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {isSubmittingComment ? 'Speichere...' : 'Begründung absenden'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-2">
                {(winningResponse || showInlineSummaryCounts) && (
                  <>
                    {winningResponse && (
                      <div className={cn('text-lg font-extrabold', winningResponse.textClass)}>
                        Ergebnis: {winningResponse.label}
                      </div>
                    )}
                    {showInlineSummaryCounts && (
                      <div className="flex flex-wrap items-center gap-1 text-sm font-semibold">
                        {summaryItems.map((item, idx) => (
                          <span key={item.key} className="inline-flex items-center gap-1">
                            {idx > 0 && <span className="text-muted-foreground">•</span>}
                            <span className={item.textClass}>{item.count}</span>
                            <span className={item.textClass}>{item.label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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
                            {summaryItems.map((item, idx) => (
                              <span key={item.key} className="inline-flex items-center gap-1">
                                {idx > 0 && <span className="text-muted-foreground">•</span>}
                                <span className={item.textClass}>{item.count}</span>
                                <span className={item.textClass}>{item.label}</span>
                              </span>
                            ))}
                          </div>
                          {pendingParticipants.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Ausstehend: {pendingParticipantNames}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
