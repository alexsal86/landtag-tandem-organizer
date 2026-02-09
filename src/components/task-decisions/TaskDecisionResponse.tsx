import { useState, useEffect } from "react";
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

interface TaskDecisionResponseProps {
  decisionId: string;
  participantId: string;
  onResponseSubmitted: () => void;
  hasResponded?: boolean;
  creatorId?: string;
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

export const TaskDecisionResponse = ({ 
  decisionId, 
  participantId, 
  onResponseSubmitted,
  hasResponded = false,
  creatorId,
}: TaskDecisionResponseProps) => {
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [questionComment, setQuestionComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<ResponseData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showCommentField, setShowCommentField] = useState(false);
  const [responseOptions, setResponseOptions] = useState<ResponseOption[]>(getDefaultOptions());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCurrentUser();
    loadDecisionOptions();
    if (hasResponded) {
      loadCurrentResponse();
    }
  }, [hasResponded, participantId, decisionId]);

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
        .single();

      if (error) {
        console.error('Error loading decision options (using defaults):', error);
        return;
      }
      if (data?.response_options && Array.isArray(data.response_options)) {
        setResponseOptions(data.response_options as unknown as ResponseOption[]);
      }
    } catch (error) {
      console.error('Error loading decision options (using defaults):', error);
    }
  };

  const loadCurrentResponse = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decision_responses')
        .select('*')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentResponse({
          ...data,
          response_type: data.response_type
        });
      }
    } catch (error) {
      console.error('Error loading current response:', error);
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
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing response:', checkError);
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
          console.error('Error updating response:', error);
          throw new Error('Antwort konnte nicht aktualisiert werden');
        }
      } else {
        const { error } = await supabase
          .from('task_decision_responses')
          .insert({
            decision_id: decisionId,
            participant_id: participantId,
            response_type: responseType,
            comment: comment || null,
          });

        if (error) {
          console.error('Error inserting response:', error);
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
            data_param: {
              decision_id: decisionId,
              decision_title: decision.title
            },
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

          const participantName = (participantProfile as any)?.profiles?.display_name || 'Ein Teilnehmer';

          await supabase.rpc('create_notification', {
            user_id_param: decision.created_by,
            type_name: 'task_decision_comment_received',
            title_param: 'Neuer Kommentar zu Entscheidungsanfrage',
            message_param: `${participantName} hat einen Kommentar zu "${decision.title}" hinterlassen.`,
            data_param: {
              decision_id: decisionId,
              decision_title: decision.title
            },
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

      toast({
        title: "Erfolgreich",
        description: "Ihre Antwort wurde gespeichert.",
      });

      setQuestionComment("");
      setIsQuestionDialogOpen(false);
      setShowEdit(false);
      onResponseSubmitted();
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast({
        title: "Fehler",
        description: error?.message || "Antwort konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getOptionByKey = (key: string): ResponseOption | undefined => {
    return responseOptions.find(o => o.key === key);
  };

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
    const colorClasses = option ? getColorClasses(option.color) : getColorClasses("gray");

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className={`${colorClasses.textClass} ${colorClasses.borderClass}`}>
            {option?.icon && getIcon(option.icon)}
            <span className="ml-1">{option?.label || currentResponse.response_type}</span>
          </Badge>
          {!isCreator && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuestionComment(currentResponse?.comment || "");
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
        
        {currentResponse.creator_response && (
          <div className="bg-muted p-2 rounded text-xs">
            <strong>Antwort:</strong>
            <RichTextDisplay content={currentResponse.creator_response} className="mt-1" />
          </div>
        )}
      </div>
    );
  }

  // Block creator from voting
  if (isCreator) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Als Ersteller können Sie nur auf Rückmeldungen antworten, nicht selbst abstimmen.
      </div>
    );
  }

  const optionRequiringComment = responseOptions.find(o => o.requires_comment);

  const renderOptionButton = (option: ResponseOption) => {
    const colorClasses = getColorClasses(option.color);
    
    const button = option.requires_comment ? (
      <Dialog key={option.key} open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className={`${colorClasses.textClass} ${colorClasses.borderClass} hover:${colorClasses.bgClass}`}
          >
            {getIcon(option.icon)}
            <span className="ml-1">{option.label}</span>
            {option.description && <Info className="h-2.5 w-2.5 ml-1 opacity-50" />}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{option.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <SimpleRichTextEditor
              initialContent={questionComment}
              onChange={setQuestionComment}
              placeholder="Ihre Frage oder Ihr Kommentar..."
              minHeight="100px"
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
            
            <div className="flex justify-end space-x-2">
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
              >
                {isLoading ? "Sende..." : "Senden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    ) : (
      <Button
        key={option.key}
        variant="outline"
        size="sm"
        onClick={() => handleResponse(option.key, questionComment.trim() || undefined)}
        disabled={isLoading}
        className={`${colorClasses.textClass} ${colorClasses.borderClass} hover:${colorClasses.bgClass}`}
      >
        {getIcon(option.icon)}
        <span className="ml-1">{option.label}</span>
        {option.description && <Info className="h-2.5 w-2.5 ml-1 opacity-50" />}
      </Button>
    );

    if (option.description) {
      return (
        <TooltipProvider key={option.key}>
          <Tooltip>
            <TooltipTrigger asChild>
              {button}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{option.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return button;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center flex-wrap gap-2">
        {responseOptions.map(renderOptionButton)}
        
        <Collapsible open={showCommentField} onOpenChange={setShowCommentField}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3 mr-1" />
              Begründung
              <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showCommentField ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
        
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
            placeholder="Ihre Begründung (optional)..."
            minHeight="80px"
          />
        </div>
      )}
    </div>
  );
};