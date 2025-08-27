import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskDecisionResponseProps {
  decisionId: string;
  participantId: string;
  onResponseSubmitted: () => void;
  hasResponded?: boolean;
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
  const { toast } = useToast();

  const handleResponse = async (responseType: 'yes' | 'no' | 'question', comment?: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .insert({
          decision_id: decisionId,
          participant_id: participantId,
          response_type: responseType,
          comment: comment || null,
        });

      if (error) throw error;

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

  if (hasResponded) {
    return (
      <div className="text-sm text-muted-foreground">
        Bereits beantwortet
      </div>
    );
  }

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
    </div>
  );
};