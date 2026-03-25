import { useState, useEffect, useRef } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES } from '@/features/appointments/requestMarkers';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, MessageCircle, Edit2, Paperclip, Circle, Star, ChevronDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DecisionFileUpload } from "./DecisionFileUpload";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { ResponseOption, getColorClasses, getDefaultOptions } from "@/lib/decisionTemplates";
import { LETTER_NOTIFICATION_TYPES } from '@/utils/letterNotificationTypes';
import type { DecisionParticipantProfile } from './types/domain';

interface ResponseSubmitMeta {
  responseType: string;
  color?: string;
}

type ParticipantProfileLookup = {
  profiles: Pick<DecisionParticipantProfile, "display_name"> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isParticipantProfileLookup = (value: unknown): value is ParticipantProfileLookup => {
  if (!isRecord(value) || !('profiles' in value)) return false;
  const profilesValue = value.profiles;
  if (profilesValue === null) return true;
  return isRecord(profilesValue) && (profilesValue.display_name === null || typeof profilesValue.display_name === 'string');
};

interface TaskDecisionResponseProps {
  decisionId: string;
  participantId: string;
  onResponseSubmitted: (meta?: ResponseSubmitMeta) => void;
  hasResponded?: boolean;
  creatorId?: string;
  layout?: "default" | "decision-panel";
  disabled?: boolean;
  showCreatorResponse?: boolean;
}

interface ResponseData {
  id: string;
  response_type: string;
  comment: string | null;
  creator_response: string | null;
  created_at: string;
}

const getIcon = (iconName?: string) => {
  switch (iconName) {
    case "check":
      return <Check className="h-3 w-3" />;
    case "x":
      return <X className="h-3 w-3" />;
    case "message-circle":
      return <MessageCircle className="h-3 w-3" />;
    case "star":
      return <Star className="h-3 w-3" />;
    default:
      return <Circle className="h-3 w-3" />;
  }
};

const getSolidColorClasses = (color: string) => {
  switch (color) {
    case "red":
      return "bg-red-600 hover:bg-red-700 border-red-700 text-white";
    case "orange":
      return "bg-orange-600 hover:bg-orange-700 border-orange-700 text-white";
    case "yellow":
      return "bg-yellow-500 hover:bg-yellow-600 border-yellow-600 text-black";
    case "blue":
      return "bg-blue-600 hover:bg-blue-700 border-blue-700 text-white";
    case "purple":
      return "bg-purple-600 hover:bg-purple-700 border-purple-700 text-white";
    case "lime":
      return "bg-lime-600 hover:bg-lime-700 border-lime-700 text-white";
    case "gray":
      return "bg-gray-600 hover:bg-gray-700 border-gray-700 text-white";
    case "green":
    default:
      return "bg-green-600 hover:bg-green-700 border-green-700 text-white";
  }
};

export const TaskDecisionResponse = ({ 
  decisionId, 
  participantId, 
  onResponseSubmitted,
  hasResponded = false,
  creatorId,
  disabled = false,
  showCreatorResponse = true,
}: TaskDecisionResponseProps) => {
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [questionComment, setQuestionComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<ResponseData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showCommentField, setShowCommentField] = useState(false);
  const [responseOptions, setResponseOptions] = useState<ResponseOption[]>(getDefaultOptions());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [panelOptionKey, setPanelOptionKey] = useState<string | null>(null);
  const [selectedResponseKey, setSelectedResponseKey] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const LONG_PRESS_MS = 500;
  const { toast } = useToast();

  useEffect(() => {
    setSelectedResponseKey(null);
    loadCurrentUser();
    loadDecisionOptions();
    if (hasResponded) {
      loadCurrentResponse();
    }
  }, [hasResponded, participantId, decisionId]);


  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadDecisionOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decisions')
        .select('response_options')
        .eq('id', decisionId)
        .maybeSingle();

      if (error) {
        debugConsole.error('Error loading decision options (using defaults):', error);
        return;
      }
      if (data?.response_options && Array.isArray(data.response_options)) {
        setResponseOptions(data.response_options as unknown as ResponseOption[]);
      }
    } catch (error) {
      debugConsole.error('Error loading decision options (using defaults):', error);
    }
  };

  const loadCurrentResponse = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decision_responses')
        .select('*')
        .eq('participant_id', participantId)
        .is('parent_response_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentResponse({
          ...data,
          response_type: data.response_type
        });
        setSelectedResponseKey(data.response_type);
      }
    } catch (error) {
      debugConsole.error('Error loading current response:', error);
    }
  };

  // Block creator from voting
  const isCreator = creatorId && currentUserId && creatorId === currentUserId;

  const handleResponse = async (responseType: string, comment?: string) => {
    setIsLoading(true);
    try {
      const { data: existingResponse, error: checkError } = await supabase
        .from('task_decision_responses')
        .select('id')
        .eq('participant_id', participantId)
        .eq('decision_id', decisionId)
        .is('parent_response_id', null)
        .maybeSingle();

      if (checkError) {
        debugConsole.error('Error checking existing response:', checkError);
        throw new Error('Antwort konnte nicht überprüft werden');
      }

      if (existingResponse) {
        const { error } = await supabase
          .from('task_decision_responses')
          .update({
            response_type: responseType,
            comment: comment || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResponse.id);

        if (error) {
          debugConsole.error('Error updating response:', error);
          throw new Error('Antwort konnte nicht aktualisiert werden');
        }
      } else {
        const { error } = await supabase
          .from('task_decision_responses')
          .insert([{
            decision_id: decisionId,
            participant_id: participantId,
            response_type: responseType,
            comment: comment || null,
          }]);

        if (error) {
          debugConsole.error('Error inserting response:', error);
          throw new Error('Antwort konnte nicht gespeichert werden');
        }
      }

      // Check if all participants have responded
      const { data: participants } = await supabase
        .from('task_decision_participants')
        .select('*')
        .eq('decision_id', decisionId);

      const { data: responses } = await supabase
        .from('task_decision_responses')
        .select('participant_id')
        .eq('decision_id', decisionId);

      if (participants && responses && participants.length === responses.length) {
        const { data: decision } = await supabase
          .from('task_decisions')
          .select('title, created_by')
          .eq('id', decisionId)
          .single();

        if (decision) {
          await supabase.rpc('create_notification', {
            user_id_param: decision.created_by,
            type_name: 'task_decision_completed',
            title_param: 'Entscheidungsergebnis verfügbar',
            message_param: `Alle Antworten für "${decision.title}" sind eingegangen.`,
            data_param: JSON.stringify({
              decision_id: decisionId,
              decision_title: decision.title
            }),
            priority_param: 'medium'
          });
        }
      }

      if (comment?.trim()) {
        const { data: decision } = await supabase
          .from('task_decisions')
          .select('title, created_by')
          .eq('id', decisionId)
          .single();

        if (decision && decision.created_by !== (await supabase.auth.getUser()).data.user?.id) {
          const { data: participantProfile } = await supabase
            .from('task_decision_participants')
            .select('profiles:user_id(display_name)')
            .eq('id', participantId)
            .single();

          const participantName = isParticipantProfileLookup(participantProfile)
            ? (participantProfile.profiles?.display_name || 'Ein Teilnehmer')
            : 'Ein Teilnehmer';

          await supabase.rpc('create_notification', {
            user_id_param: decision.created_by,
            type_name: 'task_decision_comment_received',
            title_param: 'Neuer Kommentar zu Entscheidungsanfrage',
            message_param: `${participantName} hat einen Kommentar zu "${decision.title}" hinterlassen.`,
            data_param: JSON.stringify({
              decision_id: decisionId,
              decision_title: decision.title
            }),
            priority_param: 'medium'
          });
        }
      }

      const currentUser = (await supabase.auth.getUser()).data.user;
      if (currentUser) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', currentUser.id)
          .eq('navigation_context', 'decisions');
      }

      // Auto-create appointment when approving a Terminanfrage
      if (responseType === 'yes') {
        try {
          const { data: decisionData } = await supabase
            .from('task_decisions')
            .select('title, description, created_by')
            .eq('id', decisionId)
            .single();

          if (decisionData?.title?.startsWith('Terminanfrage:')) {
            const desc = decisionData.description || '';
            const extractMarker = (marker: string): string | null => {
              const line = desc.split('\n').find((l: string) => l.startsWith(marker));
              return line ? line.slice(marker.length).trim() || null : null;
            };

            const appointmentTitle = extractMarker('appointment_request_title:')
              || decisionData.title.replace(/^Terminanfrage:\s*/i, '');
            const appointmentStart = extractMarker('appointment_request_start:');
            const appointmentLocation = extractMarker('appointment_request_location:');
            const existingAppointmentId = extractMarker('appointment_request_appointment_id:');

            if (!existingAppointmentId && appointmentStart) {
              const currentUser = (await supabase.auth.getUser()).data.user;
              if (currentUser) {
                const { data: tenantData } = await supabase
                  .from('user_tenant_memberships')
                  .select('tenant_id')
                  .eq('user_id', currentUser.id)
                  .eq('is_active', true)
                  .limit(1)
                  .single();

                if (tenantData) {
                  const startDate = new Date(appointmentStart);
                  const endDate = new Date(startDate.getTime() + APPOINTMENT_REQUEST_DEFAULT_DURATION_MINUTES * 60 * 1000);

                  const { data: createdApt } = await supabase
                    .from('appointments')
                    .insert([{
                      title: appointmentTitle,
                      description: `Automatisch aus Terminanfrage erstellt.\nappointment_request_decision_id:${decisionId}`,
                      location: appointmentLocation,
                      start_time: startDate.toISOString(),
                      end_time: endDate.toISOString(),
                      user_id: currentUser.id,
                      tenant_id: tenantData.tenant_id,
                      is_all_day: false,
                    }])
                    .select('id')
                    .single();

                  if (createdApt?.id) {
                    // Link appointment back to decision
                    const nextDescription = [
                      desc,
                      `appointment_request_appointment_id:${createdApt.id}`,
                    ].join('\n');

                    await supabase
                      .from('task_decisions')
                      .update({ description: nextDescription })
                      .eq('id', decisionId);
                  }
                }
              }
            }
          }
        } catch (appointmentError) {
          debugConsole.error('Error auto-creating appointment from Terminanfrage:', appointmentError);
        }
      }

      // Auto-update letter status when responding to a Brief freigeben decision
      try {
        const { data: decisionData } = await supabase
          .from('task_decisions')
          .select('title, description, created_by, tenant_id')
          .eq('id', decisionId)
          .single();

        if (decisionData?.title?.startsWith('Brief freigeben:')) {
          const desc = decisionData.description || '';
          const letterIdLine = desc.split('\n').find((l: string) => l.startsWith('letter_approval_letter_id:'));
          const letterId = letterIdLine ? letterIdLine.slice('letter_approval_letter_id:'.length).trim() : null;

          if (letterId) {
            const now = new Date().toISOString();
            const currentUser = (await supabase.auth.getUser()).data.user;
            const letterTitle = decisionData.title.replace(/^Brief freigeben:\s*/i, '');

            if (responseType === 'approve') {
              await supabase
                .from('letters')
                .update({ status: 'approved', approved_at: now, approved_by: currentUser?.id, updated_at: now })
                .eq('id', letterId);

              if (decisionData.tenant_id) {
                const { createLetterSendTask } = await import('@/utils/letterWorkflowActions');
                await createLetterSendTask(letterTitle, decisionData.created_by, currentUser?.id || '', decisionData.tenant_id);
              }

              // Notify letter creator about approval
              await supabase.rpc('create_notification', {
                user_id_param: decisionData.created_by,
                type_name: LETTER_NOTIFICATION_TYPES.REVIEW_COMPLETED,
                title_param: 'Brief freigegeben',
                message_param: `Der Brief "${letterTitle}" wurde freigegeben.`,
                data_param: JSON.stringify({ letter_id: letterId, letter_title: letterTitle }),
                priority_param: 'high',
              });
            } else if (responseType === 'reject') {
              await supabase
                .from('letters')
                .update({ status: 'revision_requested', updated_at: now })
                .eq('id', letterId);

              if (decisionData.tenant_id) {
                const { createLetterRevisionTask } = await import('@/utils/letterWorkflowActions');
                await createLetterRevisionTask(letterTitle, comment || '', decisionData.created_by, currentUser?.id || '', decisionData.tenant_id);
              }

              // Notify letter creator about rejection with reason
              await supabase.rpc('create_notification', {
                user_id_param: decisionData.created_by,
                type_name: LETTER_NOTIFICATION_TYPES.REVIEW_COMPLETED,
                title_param: 'Brief zur Überarbeitung zurückgewiesen',
                message_param: comment
                  ? `Der Brief "${letterTitle}" wurde zurückgewiesen. Begründung: ${comment}`
                  : `Der Brief "${letterTitle}" wurde zur Überarbeitung zurückgewiesen.`,
                data_param: JSON.stringify({ letter_id: letterId, letter_title: letterTitle }),
                priority_param: 'high',
              });
            }
          }
        }
      } catch (letterError) {
        debugConsole.error('Error auto-updating letter status from decision:', letterError);
      }

      toast({
        title: "Erfolgreich",
        description: "Ihre Antwort wurde gespeichert.",
      });

      const selectedOption = getOptionByKey(responseType);
      setSelectedResponseKey(responseType);
      setCurrentResponse((prev) => prev ? {
        ...prev,
        response_type: responseType,
        comment: comment || null,
      } : prev);
      setQuestionComment("");
      setIsQuestionDialogOpen(false);
      setShowEdit(false);
      onResponseSubmitted({
        responseType,
        color: selectedOption?.color,
      });
    } catch (error: unknown) {
      debugConsole.error('Error submitting response:', error);
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOptionByKey = (key: string): ResponseOption | undefined => {
    return responseOptions.find(o => o.key === key);
  };

  const hasExplicitCommentOption = responseOptions.some((option) => option.key === 'comment');
  const showReasonToggle = hasExplicitCommentOption;

  const handleQuestionSubmit = (option: ResponseOption) => {
    if (option.requires_comment && !questionComment.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Frage oder einen Kommentar ein.",
        variant: "destructive",
      });
      return;
    }
    handleResponse(option.key, questionComment.trim());
  };


  // Show current response if already responded
  if (hasResponded && currentResponse && !showEdit) {
    const option = getOptionByKey(currentResponse.response_type);
    const solidColorClasses = getSolidColorClasses(option?.color || "gray");

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={`${solidColorClasses} border`}>
            {option?.icon && getIcon(option.icon)}
            <span className="ml-1">{option?.label || currentResponse.response_type}</span>
            {renderRecommendedHint(option)}
          </Badge>
          {!isCreator && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuestionComment(currentResponse?.comment || "");
                setShowCommentField(true);
                setShowEdit(true);
              }}
              className="text-xs"
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Ändern
            </Button>
          )}
        </div>
        
        <span className="text-xs text-muted-foreground">
          Geantwortet am {new Date(currentResponse.created_at).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
        
        {currentResponse.comment && (
          <div className="text-xs">
            <strong className="text-muted-foreground">Ihre Begründung:</strong>
            <RichTextDisplay content={currentResponse.comment} className="mt-1" />
          </div>
        )}
        
        {showCreatorResponse && currentResponse.creator_response && (
          <div className="bg-muted p-2 rounded text-xs">
            <strong>Antwort:</strong>
            <RichTextDisplay content={currentResponse.creator_response} className="mt-1" />
          </div>
        )}
      </div>
    );
  }

  // Check special types BEFORE creator block
  const isSingleFreetext = responseOptions.length === 1 && responseOptions[0].requires_comment;
  const isSingleAcknowledgement = responseOptions.length === 1 && !responseOptions[0].requires_comment;

  // Block creator from voting — but NOT for acknowledgement/freetext types
  if (isCreator && !isSingleAcknowledgement && !isSingleFreetext) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Als Ersteller können Sie nur auf Rückmeldungen antworten, nicht selbst abstimmen.
      </div>
    );
  }

  // (isSingleFreetext and isSingleAcknowledgement already declared above)


  const renderDescriptionInfo = (description: string) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-label="Beschreibung anzeigen"
            className="ml-1 inline-flex items-center"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Info className="h-2.5 w-2.5 opacity-50" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  function renderRecommendedHint(option?: ResponseOption) {
    if (!option?.recommended) return null;

    const badge = (
      <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700">
        Empfohlen
      </span>
    );

    if (!option.recommendation_reason) return badge;

    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{option.recommendation_reason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const startLongPressForReason = (optionKey: string) => {
    if (!showReasonToggle) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTriggeredRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPanelOptionKey(optionKey);
      setShowCommentField(true);
    }, LONG_PRESS_MS);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderOptionButton = (option: ResponseOption) => {
    const colorClasses = getColorClasses(option.color);
    const solidColorClasses = getSolidColorClasses(option.color);
    const isSelected = selectedResponseKey === option.key;

    const baseButtonClasses = isSelected
      ? `${solidColorClasses} border`
      : `${colorClasses.textClass} ${colorClasses.borderClass} hover:${colorClasses.bgClass} ${option.recommended ? "ring-1 ring-amber-400/70" : ""}`;

    const button = option.requires_comment ? (
      <Dialog key={option.key} open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className={baseButtonClasses}
          >
            {getIcon(option.icon)}
            <span className="ml-1">{option.label}</span>
            {renderRecommendedHint(option)}
            {option.description && renderDescriptionInfo(option.description)}
          </Button>
        </DialogTrigger>
        <DialogContent className={`w-[95vw] min-w-[320px] sm:w-[40vw] max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col ${colorClasses.bgClass} ${colorClasses.borderClass}`}>
          <DialogHeader>
            <DialogTitle>{option.label}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-4">
              <SimpleRichTextEditor
                initialContent={questionComment}
                onChange={setQuestionComment}
                placeholder="Ihre Frage oder Ihr Kommentar..."
                minHeight="100px"
                maxHeight="45vh"
                scrollable
              />

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2 flex items-center">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Dateien anhängen (optional)
                </p>
                <DecisionFileUpload
                  decisionId={decisionId}
                  canUpload={true}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 border-t pt-4 mt-4 bg-transparent">
            <Button
              variant="outline"
              onClick={() => setIsQuestionDialogOpen(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => handleQuestionSubmit(option)}
              disabled={isLoading}
              className={solidColorClasses}
            >
              {isLoading ? "Sende..." : "Senden"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    ) : (
      <Button
        key={option.key}
        variant="outline"
        size="sm"
        onPointerDown={() => startLongPressForReason(option.key)}
        onPointerUp={() => clearLongPress()}
        onPointerLeave={() => clearLongPress()}
        onPointerCancel={() => clearLongPress()}
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          setPanelOptionKey(option.key);
          handleResponse(option.key, questionComment.trim() || undefined);
        }}
        disabled={isLoading}
        className={baseButtonClasses}
      >
        {getIcon(option.icon)}
        <span className="ml-1">{option.label}</span>
        {renderRecommendedHint(option)}
        {option.description && renderDescriptionInfo(option.description)}
      </Button>
    );

    return <div key={option.key}>{button}</div>;
  };


  // Single acknowledgement mode: show a single prominent button
  if (isSingleAcknowledgement) {
    const opt = responseOptions[0];
    const colorClasses = getColorClasses(opt.color);
    return (
      <div className="space-y-2">
        <Button
          onClick={() => handleResponse(opt.key)}
          disabled={isLoading}
          className={`w-full ${colorClasses.bgClass} hover:opacity-90 text-white`}
        >
          {getIcon(opt.icon)}
          <span className="ml-1">{isLoading ? "Sende..." : opt.label}</span>
        </Button>
        {showEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEdit(false)}
            className="text-xs"
          >
            Abbrechen
          </Button>
        )}
      </div>
    );
  }

  // Single freetext mode: show text field directly
  if (isSingleFreetext) {
    const opt = responseOptions[0];
    return (
      <div className="space-y-3 w-full max-w-3xl">
        <SimpleRichTextEditor
          initialContent={questionComment}
          onChange={setQuestionComment}
          placeholder="Ihre Rückmeldung..."
          minHeight="80px"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleQuestionSubmit(opt)}
            disabled={isLoading}
          >
            {isLoading ? "Sende..." : "Rückmeldung senden"}
          </Button>
          {showEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowEdit(false); setQuestionComment(""); }}
              className="text-xs"
            >
              Abbrechen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center flex-wrap gap-2">
        {responseOptions.map(renderOptionButton)}
        
        {showReasonToggle && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <Collapsible open={showCommentField} onOpenChange={setShowCommentField}>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs text-muted-foreground">
                      Begründung
                      <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${showCommentField ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
              </Collapsible>
              <TooltipContent>
                <p className="text-xs">Tipp: Antwort länger gedrückt halten, um direkt mit Begründung zu antworten.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {showEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowEdit(false);
              setQuestionComment("");
              setShowCommentField(false);
            }}
            className="text-xs"
          >
            Abbrechen
          </Button>
        )}
      </div>

      {showCommentField && (
        <div className="mt-2">
          <SimpleRichTextEditor
            initialContent={questionComment}
            onChange={setQuestionComment}
            placeholder={panelOptionKey ? `Begründung zu ${getOptionByKey(panelOptionKey)?.label || "Antwort"} (optional)...` : "Ihre Begründung (optional)..."}
            minHeight="80px"
          />
        </div>
      )}
    </div>
  );
};
