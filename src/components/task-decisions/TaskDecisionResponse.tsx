import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, X, MessageCircle, Edit2, Paperclip, Circle, Star } from "lucide-react";
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
  hasResponded = false 
}: TaskDecisionResponseProps) => {
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [questionComment, setQuestionComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<ResponseData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [responseOptions, setResponseOptions] = useState<ResponseOption[]>(getDefaultOptions());
  const { toast } = useToast();

  useEffect(() => {
    loadDecisionOptions();
    if (hasResponded) {
      loadCurrentResponse();
    }
  }, [hasResponded, participantId, decisionId]);

  const loadDecisionOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decisions')
        .select('response_options')
        .eq('id', decisionId)
        .single();

      if (error) throw error;
      if (data?.response_options && Array.isArray(data.response_options)) {
        setResponseOptions(data.response_options as unknown as ResponseOption[]);
      }
    } catch (error) {
      console.error('Error loading decision options:', error);
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

  const handleResponse = async (responseType: string, comment?: string) => {
    setIsLoading(true);
    try {
      // Check if response already exists
      const { data: existingResponse } = await supabase
        .from('task_decision_responses')
        .select('id')
        .eq('participant_id', participantId)
        .eq('decision_id', decisionId)
        .maybeSingle();

      if (existingResponse) {
        // UPDATE existing response
        const { error } = await supabase
          .from('task_decision_responses')
          .update({
            response_type: responseType,
            comment: comment || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingResponse.id);

        if (error) throw error;
      } else {
        // INSERT new response
        const { error } = await supabase
          .from('task_decision_responses')
          .insert({
            decision_id: decisionId,
            participant_id: participantId,
            response_type: responseType,
            comment: comment || null,
          });

        if (error) throw error;
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

      // If all participants have responded, notify the creator
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

      // Notify creator if participant submitted a comment
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

      // Mark related decision notifications as read for this user
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
    } catch (error) {
      console.error('Error submitting response:', error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gespeichert werden.",
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEdit(true)}
            className="text-xs"
          >
            <Edit2 className="h-3 w-3 mr-1" />
            Ändern
          </Button>
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
            <strong className="text-muted-foreground">Ihr Kommentar:</strong>
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

  // Find option that requires comment for dialog
  const optionRequiringComment = responseOptions.find(o => o.requires_comment);

  // Show response buttons
  return (
    <div className="space-y-3">
      <SimpleRichTextEditor
        initialContent={questionComment}
        onChange={setQuestionComment}
        placeholder="Kommentar (optional)..."
        minHeight="80px"
      />
      
      <div className="flex items-center flex-wrap gap-2">
        {responseOptions.map((option) => {
          const colorClasses = getColorClasses(option.color);
          
          // Options requiring comment open a dialog
          if (option.requires_comment) {
            return (
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
            );
          }

          // Regular options submit directly
          return (
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
            </Button>
          );
        })}
        
        {showEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowEdit(false);
              setQuestionComment("");
            }}
            className="text-xs"
          >
            Abbrechen
          </Button>
        )}
      </div>
    </div>
  );
};
