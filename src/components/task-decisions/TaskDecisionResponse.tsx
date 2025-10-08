import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, MessageCircle, Edit2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DecisionFileUpload } from "./DecisionFileUpload";

interface TaskDecisionResponseProps {
  decisionId: string;
  participantId: string;
  onResponseSubmitted: () => void;
  hasResponded?: boolean;
}

interface ResponseData {
  id: string;
  response_type: 'yes' | 'no' | 'question';
  comment: string | null;
  creator_response: string | null;
  created_at: string;
}

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
  const { toast } = useToast();

  useEffect(() => {
    if (hasResponded) {
      loadCurrentResponse();
    }
  }, [hasResponded, participantId]);

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
          response_type: data.response_type as 'yes' | 'no' | 'question'
        });
      }
    } catch (error) {
      console.error('Error loading current response:', error);
    }
  };

  const handleResponse = async (responseType: 'yes' | 'no' | 'question', comment?: string) => {
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
        // UPDATE existing response (Trigger logs to history automatically)
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
        // INSERT new response (Trigger logs to history automatically)
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
        // Get decision details and creator
        const { data: decision } = await supabase
          .from('task_decisions')
          .select('title, created_by')
          .eq('id', decisionId)
          .single();

        if (decision) {
          const { error: notificationError } = await supabase.rpc('create_notification', {
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

          if (notificationError) {
            console.error('Error creating completion notification:', notificationError);
          }
        }
      }

      toast({
        title: "Erfolgreich",
        description: "Ihre Antwort wurde gespeichert.",
      });

      if (responseType === 'question') {
        setQuestionComment("");
        setIsQuestionDialogOpen(false);
      }
      
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

  const handleQuestionSubmit = () => {
    if (!questionComment.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Frage oder einen Kommentar ein.",
        variant: "destructive",
      });
      return;
    }
    handleResponse('question', questionComment.trim());
  };

  // Show current response if already responded
  if (hasResponded && currentResponse && !showEdit) {
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          {currentResponse.response_type === 'yes' && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Check className="h-3 w-3 mr-1" />
              Ja
            </Badge>
          )}
          {currentResponse.response_type === 'no' && (
            <Badge variant="outline" className="text-red-600 border-red-600">
              <X className="h-3 w-3 mr-1" />
              Nein
            </Badge>
          )}
          {currentResponse.response_type === 'question' && (
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <MessageCircle className="h-3 w-3 mr-1" />
              Rückfrage
            </Badge>
          )}
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
        
        {/* Show participant comment */}
        {currentResponse.comment && (
          <div className="text-xs text-muted-foreground">
            <strong>Ihr Kommentar:</strong> {currentResponse.comment}
          </div>
        )}
        
        {/* Show creator response */}
        {currentResponse.creator_response && (
          <div className="bg-muted p-2 rounded text-xs">
            <strong>Antwort:</strong> {currentResponse.creator_response}
          </div>
        )}
      </div>
    );
  }

  // Show response buttons (for new responses or when editing)
  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleResponse('yes')}
        disabled={isLoading}
        className="text-green-600 border-green-600 hover:bg-green-50"
      >
        <Check className="h-4 w-4" />
      </Button>
      
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="text-orange-600 border-orange-600 hover:bg-orange-50"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rückfrage stellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={questionComment}
              onChange={(e) => setQuestionComment(e.target.value)}
              placeholder="Ihre Frage oder Ihr Kommentar..."
              rows={4}
            />
            
            {/* File Upload Section */}
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
                onClick={handleQuestionSubmit}
                disabled={isLoading}
              >
                {isLoading ? "Sende..." : "Senden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleResponse('no')}
        disabled={isLoading}
        className="text-red-600 border-red-600 hover:bg-red-50"
      >
        <X className="h-4 w-4" />
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
};