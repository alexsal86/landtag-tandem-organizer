import { useState } from "react";
import { Button } from "@/components/ui/button";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Send, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DecisionViewerCommentProps {
  decisionId: string;
  creatorId: string;
  decisionTitle: string;
  onCommentSubmitted: () => void;
}

export function DecisionViewerComment({
  decisionId,
  creatorId,
  decisionTitle,
  onCommentSubmitted
}: DecisionViewerCommentProps) {
  const [comment, setComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!comment.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // First, create a participant entry if not exists (for viewers to comment)
      const { data: existingParticipant } = await supabase
        .from('task_decision_participants')
        .select('id')
        .eq('decision_id', decisionId)
        .eq('user_id', user.id)
        .single();

      let participantId = existingParticipant?.id;

      // If not a participant, create one as a viewer
      if (!participantId) {
        const { data: newParticipant, error: participantError } = await supabase
          .from('task_decision_participants')
          .insert({
            decision_id: decisionId,
            user_id: user.id,
          })
          .select('id')
          .single();

        if (participantError) throw participantError;
        participantId = newParticipant.id;
      }

      // Create the response with type 'question' (viewer comment)
      const { error: responseError } = await supabase
        .from('task_decision_responses')
        .insert({
          decision_id: decisionId,
          participant_id: participantId,
          response_type: 'question',
          comment: comment.trim(),
        });

      if (responseError) throw responseError;

      // Notify the creator
      if (creatorId && creatorId !== user.id) {
        await supabase.rpc('create_notification', {
          user_id_param: creatorId,
          type_name: 'task_decision_comment_received',
          title_param: 'Neuer Kommentar',
          message_param: `Ein Teammitglied hat einen Kommentar zu "${decisionTitle}" hinterlassen.`,
          data_param: {
            decision_id: decisionId,
            decision_title: decisionTitle
          },
          priority_param: 'medium'
        });
      }

      toast({
        title: "Kommentar gesendet",
        description: "Ihr Kommentar wurde erfolgreich übermittelt.",
      });

      setComment("");
      setIsExpanded(false);
      onCommentSubmitted();
    } catch (error) {
      console.error('Error submitting viewer comment:', error);
      toast({
        title: "Fehler",
        description: "Kommentar konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5 mr-2" />
          Kommentar hinzufügen
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 ml-auto" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 ml-auto" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <SimpleRichTextEditor
          initialContent={comment}
          onChange={setComment}
          placeholder="Ihr Kommentar oder Ihre Frage..."
          minHeight="60px"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !comment.trim()}
          >
            <Send className="h-3 w-3 mr-1" />
            {isSubmitting ? "Senden..." : "Senden"}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
