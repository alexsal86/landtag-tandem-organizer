import { memo, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { EmailPreviewDialog } from "@/components/task-decisions/EmailPreviewDialog";
import { DecisionAttachmentPreviewDialog } from "@/components/task-decisions/DecisionAttachmentPreviewDialog";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES } from "@/features/appointments/requestMarkers";
import { MyWorkDecision, getBorderColor } from "./types";
import { deriveDeputyReference, buildMailtoFromTemplate } from "./utils";
import { useDecisionCardDerivedData } from "./hooks/useDecisionCardDerivedData";
import { DayTimelineItem, TimelineLayoutItem } from "./card/shared";
import { DecisionCardHeader } from "./card/DecisionCardHeader";
import { DecisionCardActions } from "./card/DecisionCardActions";
import { DecisionCardResponses } from "./card/DecisionCardResponses";
import { DecisionCardMeta } from "./card/DecisionCardMeta";
import { DecisionCardActivity } from "./card/DecisionCardActivity";
import { CalendarDays, ChevronDown, ChevronUp, Info } from "lucide-react";

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
  onReply?: (payload: { responseId: string; text: string; mode: "creator_response" | "participant_followup" }) => Promise<void>;
  commentCount: number;
  creatingTaskId: string | null;
  archivingDecisionId?: string | null;
  deletingDecisionId?: string | null;
  currentUserId: string;
}

const getPromptColorClasses = (color: string) => {
  switch (color) {
    case "red": return { container: "border-red-300 bg-red-50", icon: "text-red-600", submitButton: "bg-red-600 hover:bg-red-700 text-white" };
    case "orange": return { container: "border-orange-300 bg-orange-50", icon: "text-orange-600", submitButton: "bg-orange-600 hover:bg-orange-700 text-white" };
    case "yellow": return { container: "border-yellow-300 bg-yellow-50", icon: "text-yellow-700", submitButton: "bg-yellow-500 hover:bg-yellow-600 text-black" };
    case "blue": return { container: "border-blue-300 bg-blue-50", icon: "text-blue-600", submitButton: "bg-blue-600 hover:bg-blue-700 text-white" };
    case "purple": return { container: "border-purple-300 bg-purple-50", icon: "text-purple-600", submitButton: "bg-purple-600 hover:bg-purple-700 text-white" };
    case "lime": return { container: "border-lime-300 bg-lime-50", icon: "text-lime-700", submitButton: "bg-lime-600 hover:bg-lime-700 text-white" };
    case "gray": return { container: "border-gray-300 bg-gray-50", icon: "text-gray-600", submitButton: "bg-gray-600 hover:bg-gray-700 text-white" };
    default: return { container: "border-green-300 bg-green-50", icon: "text-green-600", submitButton: "bg-green-600 hover:bg-green-700 text-white" };
  }
};

const MyWorkDecisionCardInner = ({ decision, isHighlighted, highlightRef, onOpenDetails, onEdit, onArchive, onDelete, onCreateTask, onResponseSubmitted, onOpenComments, onReply, commentCount, creatingTaskId, archivingDecisionId, deletingDecisionId, currentUserId }: MyWorkDecisionCardProps) => {
  const [previewEmail, setPreviewEmail] = useState<{ file_path: string; file_name: string } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ file_path: string; file_name: string } | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [showCommentPrompt, setShowCommentPrompt] = useState(false);
  const [showCommentEditor, setShowCommentEditor] = useState(false);
  const [isSchedulePinnedOpen, setIsSchedulePinnedOpen] = useState(false);
  const [dayTimelineItems, setDayTimelineItems] = useState<DayTimelineItem[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentEditorKey, setCommentEditorKey] = useState(0);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentPromptColor, setCommentPromptColor] = useState("green");
  const [resolvedDeputyName, setResolvedDeputyName] = useState<string | null>(null);
  const responseRefreshTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { currentTenant } = useTenant();

  const { appointmentLink, appointmentRequestNarrative, displayDescription, isAppointmentRequest, isRequestedStartValid, plainDescription, requestedStart, requestedTitle, summary, summaryItems, targetDeputy, winningResponse } = useDecisionCardDerivedData(decision);

  const shouldLoadTimeline = isAppointmentRequest && isRequestedStartValid;
  const timelineWindowMinutes = 6 * 60 + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES;
  const timelineHeight = 264;
  const pixelsPerMinute = timelineHeight / timelineWindowMinutes;
  const previewCharacterLimit = 1240;
  const hasLongDescription = plainDescription.length > previewCharacterLimit;
  const showInlineSummaryCounts = !decision.isParticipant || decision.hasResponded;
  const pendingParticipantNames = (decision.participants || []).filter((participant) => !participant.responses?.[0]).map((participant) => participant.profile?.display_name || "Unbekannt").join(", ");

  const timelineBounds = useMemo(() => {
    if (!requestedStart) return [];
    const windowStart = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000);
    windowStart.setMinutes(0, 0, 0);
    const requestedEnd = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000);
    const windowEnd = new Date(requestedEnd.getTime() + 3 * 60 * 60 * 1000);
    windowEnd.setMinutes(0, 0, 0);
    if (windowEnd.getTime() <= requestedEnd.getTime() + 3 * 60 * 60 * 1000 - 1) {
      windowEnd.setHours(windowEnd.getHours() + 1);
    }
    return [windowStart, windowEnd] as const;
  }, [requestedStart]);

  const timelineHourSlots = useMemo(() => {
    if (!timelineBounds.length) return [];
    const [windowStart, windowEnd] = timelineBounds;
    const hourCount = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (60 * 60 * 1000)) + 1;
    return Array.from({ length: hourCount }, (_, index) => { const slot = new Date(windowStart); slot.setHours(windowStart.getHours() + index); return slot; });
  }, [timelineBounds]);

  const timelineLayoutItems = useMemo(() => {
    if (!timelineBounds.length) return [];
    const [windowStart, windowEnd] = timelineBounds;
    const windowStartMs = windowStart.getTime();
    const windowEndMs = windowEnd.getTime();
    const normalized = dayTimelineItems.map((item) => {
      const itemStart = new Date(item.start);
      const itemEnd = new Date(item.end || item.start);
      const safeEnd = itemEnd.getTime() > itemStart.getTime() ? itemEnd : new Date(itemStart.getTime() + 60 * 60 * 1000);
      const clippedStart = Math.max(itemStart.getTime(), windowStartMs);
      const clippedEnd = Math.min(safeEnd.getTime(), windowEndMs);
      if (clippedEnd <= clippedStart) return null;
      const startMinutes = Math.max(0, Math.floor((clippedStart - windowStartMs) / 60000));
      const endMinutes = Math.min(timelineWindowMinutes, Math.ceil((clippedEnd - windowStartMs) / 60000));
      return { item, startMinutes, endMinutes, durationMinutes: Math.max(15, endMinutes - startMinutes) };
    }).filter((entry): entry is Omit<TimelineLayoutItem, "column" | "totalColumns"> => Boolean(entry)).sort((a, b) => a.startMinutes - b.startMinutes);
    const layout: TimelineLayoutItem[] = [];
    const active: Array<{ endMinutes: number; column: number }> = [];
    normalized.forEach((entry) => {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        if (active[index].endMinutes <= entry.startMinutes) active.splice(index, 1);
      }
      let column = 0;
      while (active.some((item) => item.column === column)) column += 1;
      active.push({ endMinutes: entry.endMinutes, column });
      layout.push({ ...entry, column, totalColumns: Math.max(...active.map((item) => item.column)) + 1 });
    });
    return layout.map((entry) => {
      const overlapping = layout.filter((other) => other.startMinutes < entry.endMinutes && entry.startMinutes < other.endMinutes);
      return { ...entry, totalColumns: Math.max(...overlapping.map((item) => item.column)) + 1 };
    });
  }, [dayTimelineItems, timelineBounds]);

  useEffect(() => {
    let isMounted = true;
    const resolveDeputyName = async () => {
      if (!targetDeputy) return isMounted && setResolvedDeputyName(null);
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetDeputy);
      if (!looksLikeUuid) return isMounted && setResolvedDeputyName(targetDeputy);
      const participantName = decision.participants?.find((participant) => participant.user_id === targetDeputy)?.profile?.display_name;
      if (participantName) return isMounted && setResolvedDeputyName(participantName);
      const { data, error } = await supabase.from("profiles").select("display_name").eq("id", targetDeputy).maybeSingle();
      if (isMounted) setResolvedDeputyName(error ? targetDeputy : data?.display_name || targetDeputy);
    };
    void resolveDeputyName();
    return () => { isMounted = false; };
  }, [decision.participants, targetDeputy]);

  const appointmentMailBase = useMemo(() => {
    if (!isAppointmentRequest || !isRequestedStartValid || !requestedStart) return null;
    return {
      subject: requestedTitle,
      dateLabel: format(requestedStart, "dd.MM.yyyy", { locale: de }),
      timeLabel: format(requestedStart, "HH:mm", { locale: de }),
      deputy: deriveDeputyReference(resolvedDeputyName || targetDeputy),
    };
  }, [isAppointmentRequest, isRequestedStartValid, requestedStart, requestedTitle, resolvedDeputyName, targetDeputy]);

  const approvalMailText = useMemo(() => appointmentMailBase ? [
    `Zusage zum Termin „${appointmentMailBase.subject}“ von ${appointmentMailBase.deputy.dative} ${appointmentMailBase.deputy.fullName} MdL`, "", "Sehr geehrte Damen und Herren,", "", `haben Sie recht herzlichen Dank für ihre Anfrage an ${appointmentMailBase.deputy.accusative} ${appointmentMailBase.deputy.lastName}.`, `Sehr gerne nimmt ${appointmentMailBase.deputy.nominative} ${appointmentMailBase.deputy.lastName} den Termin am ${appointmentMailBase.dateLabel} um ${appointmentMailBase.timeLabel} Uhr an.`, "", "Mit freundlichen Grüßen",
  ].join("\n") : null, [appointmentMailBase]);

  const rejectionMailText = useMemo(() => appointmentMailBase ? [
    `Rückmeldung zum Termin „${appointmentMailBase.subject}“ von ${appointmentMailBase.deputy.dative} ${appointmentMailBase.deputy.fullName} MdL`, "", "Sehr geehrte Damen und Herren", "", `haben Sie recht herzlichen Dank für ihre Anfrage an ${appointmentMailBase.deputy.accusative} ${appointmentMailBase.deputy.lastName}.`, `Leider kann ${appointmentMailBase.deputy.nominative} ${appointmentMailBase.deputy.lastName} MdL den Termin am ${appointmentMailBase.dateLabel} um ${appointmentMailBase.timeLabel} Uhr nicht persönlich wahrnehmen.`, "", "Wir bitten dies daher zu entschuldigen und freuen uns auf weitere Einladungen ihrerseits.", "", "Mit freundlichen Grüßen",
  ].join("\n") : null, [appointmentMailBase]);

  const approvalMailto = useMemo(() => buildMailtoFromTemplate(approvalMailText), [approvalMailText]);
  const rejectionMailto = useMemo(() => buildMailtoFromTemplate(rejectionMailText), [rejectionMailText]);
  const promptColorClasses = getPromptColorClasses(commentPromptColor);
  const sanitizedCommentDraft = commentDraft.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

  const clearResponseRefreshTimeout = () => {
    if (responseRefreshTimeoutRef.current !== null) {
      window.clearTimeout(responseRefreshTimeoutRef.current);
      responseRefreshTimeoutRef.current = null;
    }
  };
  // hover handlers removed – HoverCard handles open/close natively

  const handleResponseSubmitted = (meta?: { responseType: string; color?: string }) => {
    clearResponseRefreshTimeout();
    setCommentPromptColor(meta?.color || decision.response_options?.find((option) => option.key === meta?.responseType)?.color || "green");
    setCommentDraft("");
    setCommentEditorKey((previous) => previous + 1);
    setShowCommentEditor(false);
    setShowCommentPrompt(true);
    responseRefreshTimeoutRef.current = window.setTimeout(() => { setShowCommentPrompt(false); setShowCommentEditor(false); onResponseSubmitted(); }, 10000);
  };
  const handleOpenJustificationEditor = () => { clearResponseRefreshTimeout(); setShowCommentEditor(true); };
  const handleCompleteImmediately = () => { clearResponseRefreshTimeout(); setShowCommentPrompt(false); setShowCommentEditor(false); setCommentDraft(""); setCommentEditorKey((previous) => previous + 1); onResponseSubmitted(); };
  const handleSubmitJustification = async () => {
    if (!sanitizedCommentDraft || isSubmittingComment || !decision.participant_id) return;
    setIsSubmittingComment(true);
    try {
      const { data: existingResponse, error: responseLookupError } = await supabase.from("task_decision_responses").select("id").eq("decision_id", decision.id).eq("participant_id", decision.participant_id).is("parent_response_id", null).maybeSingle();
      if (responseLookupError) throw responseLookupError;
      if (!existingResponse) throw new Error("Keine Rückmeldung gefunden, die ergänzt werden kann.");
      const { error } = await supabase.from("task_decision_responses").update({ comment: commentDraft.trim(), updated_at: new Date().toISOString() }).eq("id", existingResponse.id);
      if (error) throw error;
      toast({ title: "Begründung gespeichert", description: "Deine Begründung wurde als Rückmeldung zur Entscheidung gespeichert." });
      clearResponseRefreshTimeout();
      setShowCommentPrompt(false);
      setShowCommentEditor(false);
      setCommentDraft("");
      setCommentEditorKey((previous) => previous + 1);
      onResponseSubmitted();
    } catch {
      toast({ title: "Fehler", description: "Die Begründung konnte nicht zur Rückmeldung gespeichert werden.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  useEffect(() => () => {
    clearResponseRefreshTimeout();
  }, []);
  useEffect(() => {
    const loadDayTimeline = async () => {
      if (!shouldLoadTimeline || !currentTenant?.id || !requestedStart) return;
      setIsTimelineLoading(true);
      try {
        const contextStartIso = new Date(requestedStart.getTime() - 3 * 60 * 60 * 1000).toISOString();
        const requestedEndTime = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000);
        const contextEndIso = new Date(requestedEndTime.getTime() + 3 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase.from("appointments").select("id, title, start_time, end_time").eq("tenant_id", currentTenant.id).lt("start_time", contextEndIso).gt("end_time", contextStartIso).order("start_time", { ascending: true });
        if (error) throw error;
        const existingItems: DayTimelineItem[] = (data || []).map((item) => ({ id: item.id, title: item.title, start: item.start_time, end: item.end_time }));
        const simulatedStart = requestedStart.toISOString();
        const simulatedEnd = new Date(requestedStart.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000).toISOString();
        const combined = existingItems.some((item) => item.start === simulatedStart && item.title.trim().toLowerCase() === requestedTitle.trim().toLowerCase()) ? existingItems : [...existingItems, { id: `simulated-${decision.id}`, title: `${requestedTitle} (angefragt)`, start: simulatedStart, end: simulatedEnd, simulated: true }];
        combined.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        setDayTimelineItems(combined);
      } catch {
        setDayTimelineItems([]);
      } finally {
        setIsTimelineLoading(false);
      }
    };
    void loadDayTimeline();
  }, [shouldLoadTimeline, currentTenant?.id, requestedStart, requestedTitle, decision.id]);

  const openMailLink = (mailtoUrl: string) => { window.location.href = mailtoUrl; };
  const copyMailTemplate = async (text: string, type: "Zusage" | "Absage") => {
    try { await navigator.clipboard.writeText(text); toast({ title: `${type}-Mail kopiert`, description: `Der Text für die ${type.toLowerCase()} wurde in die Zwischenablage kopiert.` }); }
    catch { toast({ title: "Kopieren fehlgeschlagen", description: "Der Mailtext konnte nicht kopiert werden.", variant: "destructive" }); }
  };

  return (
    <>
      <Card ref={highlightRef as any} className={cn("group border-l-4 hover:bg-muted/40 transition-colors cursor-pointer", getBorderColor(summary, decision.response_options, decision.participants), isHighlighted && "notification-highlight")} onClick={() => onOpenDetails(decision.id)}>
        <CardContent className="p-4">
          <DecisionCardHeader decision={decision} archivingDecisionId={archivingDecisionId} deletingDecisionId={deletingDecisionId} creatingTaskId={creatingTaskId} onArchive={onArchive} onCreateTask={onCreateTask} onDelete={onDelete} onEdit={onEdit} />

          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-bold text-lg leading-snug">{decision.title}</h3>
                {isAppointmentRequest && isRequestedStartValid && (
                  <HoverCard openDelay={200} closeDelay={300}>
                    <HoverCardTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(event) => { event.stopPropagation(); setIsSchedulePinnedOpen((previous) => !previous); }} aria-label="Termin-Tagesvorschau anzeigen"><Info className="h-4 w-4" /></Button>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" align="start" className="w-[380px] p-2" onClick={(event) => event.stopPropagation()}>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><CalendarDays className="h-3.5 w-3.5" />Tageskontext ±3 Stunden ({requestedStart ? format(requestedStart, "dd.MM.yyyy HH:mm", { locale: de }) : ""} Uhr)</div>
                      {isTimelineLoading ? <p className="text-xs text-muted-foreground">Lade Termine…</p> : dayTimelineItems.length === 0 ? <p className="text-xs text-muted-foreground">Keine Termine für diesen Tag.</p> : (
                        <div className="grid grid-cols-[56px_1fr] border border-border rounded-md overflow-hidden bg-muted/15">
                          <div className="relative border-r border-border bg-muted/30" style={{ height: `${timelineHeight}px` }}>{timelineHourSlots.map((slot, index) => <div key={format(slot, "yyyy-MM-dd-HH", { locale: de })} className={cn("absolute left-0 right-0 -translate-y-1/2 px-2 text-[11px] font-mono text-muted-foreground", index === timelineHourSlots.length - 1 && "translate-y-[-95%]")} style={{ top: `${index * 44}px` }}>{format(slot, "HH:00", { locale: de })}</div>)}</div>
                          <div className="relative" style={{ height: `${timelineHeight}px` }}>
                            {timelineHourSlots.map((slot, index) => <div key={`line-${format(slot, "yyyy-MM-dd-HH", { locale: de })}`} className="absolute left-0 right-0 border-t border-border/70" style={{ top: `${index * 44}px` }} />)}
                            {timelineLayoutItems.map((entry) => <div key={entry.item.id} className={cn("absolute rounded-md border px-2 py-1 text-[11px] shadow-sm overflow-hidden", entry.item.simulated ? "bg-blue-100 border-blue-300 text-blue-900" : "bg-background border-border text-foreground")} style={{ top: `${entry.startMinutes * pixelsPerMinute}px`, height: `${Math.max(18, entry.durationMinutes * pixelsPerMinute)}px`, left: `calc(${(entry.column * 100) / entry.totalColumns}% + 2px)`, width: `calc(${100 / entry.totalColumns}% - 4px)` }}><div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{entry.item.title}</span>{entry.item.simulated && <Badge variant="secondary" className="text-[10px]">sim.</Badge>}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{format(new Date(entry.item.start), "HH:mm", { locale: de })}–{format(new Date(entry.item.end), "HH:mm", { locale: de })} · {Math.round((new Date(entry.item.end).getTime() - new Date(entry.item.start).getTime()) / 60000)} Min</div></div>)}
                          </div>
                        </div>
                      )}
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>

              {decision.description && (
                <div onClick={(event) => event.stopPropagation()}>
                  <div className="min-w-0">
                    {appointmentRequestNarrative && <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{appointmentRequestNarrative}</p>}
                    <div className={cn("relative", !detailsExpanded && hasLongDescription && "max-h-[26rem] overflow-hidden")}>
                      <RichTextDisplay content={displayDescription} className="leading-relaxed [&_p:last-child]:mb-0" />
                      {!detailsExpanded && hasLongDescription && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/95 to-transparent" />}
                    </div>
                    {hasLongDescription && <Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-xs" onClick={() => setDetailsExpanded((previous) => !previous)}>{detailsExpanded ? "Weniger Details" : "Details anzeigen"}{detailsExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}</Button>}
                  </div>
                </div>
              )}
            </div>

            <aside className="rounded-lg border border-border/70 bg-background/95 p-3.5 space-y-3 self-start lg:sticky lg:top-16" onClick={(event) => event.stopPropagation()}>
              <p className="text-sm font-semibold text-foreground">Deine Entscheidung</p>
              <DecisionCardActions
                commentEditorKey={commentEditorKey}
                decision={decision}
                handleCompleteImmediately={handleCompleteImmediately}
                handleOpenJustificationEditor={handleOpenJustificationEditor}
                handleSubmitJustification={handleSubmitJustification}
                isSubmittingComment={isSubmittingComment}
                onResponseSubmitted={handleResponseSubmitted}
                promptColorClasses={promptColorClasses}
                sanitizedCommentDraft={sanitizedCommentDraft}
                setCommentDraft={setCommentDraft}
                showCommentEditor={showCommentEditor}
                showCommentPrompt={showCommentPrompt}
              />

              <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground space-y-2">
                <DecisionCardResponses
                  appointmentLink={appointmentLink}
                  approvalMailText={approvalMailText}
                  approvalMailto={approvalMailto}
                  copyMailTemplate={copyMailTemplate}
                  isAppointmentRequest={isAppointmentRequest}
                  onOpenMailLink={openMailLink}
                  rejectionMailText={rejectionMailText}
                  rejectionMailto={rejectionMailto}
                  showInlineSummaryCounts={showInlineSummaryCounts}
                  summaryItems={summaryItems}
                  winningResponse={winningResponse}
                />
                <DecisionCardMeta
                  commentCount={commentCount}
                  decision={decision}
                  onOpenComments={onOpenComments}
                  onPreviewAttachment={setPreviewAttachment}
                  onPreviewEmail={setPreviewEmail}
                  pendingParticipantNames={pendingParticipantNames}
                  summaryItems={summaryItems}
                />
              </div>
            </aside>
          </div>

          <DecisionCardActivity decision={decision} currentUserId={currentUserId} onReply={onReply} />
        </CardContent>
      </Card>

      <EmailPreviewDialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)} filePath={previewEmail?.file_path || ""} fileName={previewEmail?.file_name || ""} />
      <DecisionAttachmentPreviewDialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)} filePath={previewAttachment?.file_path || ""} fileName={previewAttachment?.file_name || ""} />
    </>
  );
};

export const MyWorkDecisionCard = memo(MyWorkDecisionCardInner);
