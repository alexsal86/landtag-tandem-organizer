import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, HelpCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DecisionResponseSummaryProps {
  decisionId: string;
  className?: string;
  compact?: boolean;
}

interface ResponseSummary {
  yes: number;
  no: number;
  question: number;
  pending: number;
  total: number;
}

export function DecisionResponseSummary({ 
  decisionId, 
  className,
  compact = true 
}: DecisionResponseSummaryProps) {
  const [summary, setSummary] = useState<ResponseSummary>({
    yes: 0,
    no: 0,
    question: 0,
    pending: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [decisionId]);

  const loadSummary = async () => {
    if (!decisionId) return;
    
    try {
      // Get all participants for this decision
      const { data: participants, error: participantsError } = await supabase
        .from("task_decision_participants")
        .select("id, user_id")
        .eq("decision_id", decisionId);

      if (participantsError) throw participantsError;

      // Get responses for these participants
      const participantIds = participants?.map(p => p.id) || [];
      let responses: Record<string, string> = {};
      
      if (participantIds.length > 0) {
        const { data: responseData } = await supabase
          .from("task_decision_responses")
          .select("participant_id, response_type")
          .in("participant_id", participantIds);
        
        responseData?.forEach(r => {
          responses[r.participant_id] = r.response_type;
        });
      }

      const result: ResponseSummary = {
        yes: 0,
        no: 0,
        question: 0,
        pending: 0,
        total: participants?.length || 0
      };

      participants?.forEach(p => {
        const response = responses[p.id];
        if (!response) {
          result.pending++;
        } else if (response === 'yes') {
          result.yes++;
        } else if (response === 'no') {
          result.no++;
        } else if (response === 'question') {
          result.question++;
        } else {
          // Handle custom responses - count as "responded"
          result.yes++; // Default to counting as positive for custom responses
        }
      });

      setSummary(result);
    } catch (error) {
      console.error('Error loading decision summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={cn("animate-pulse bg-muted h-4 w-16 rounded", className)} />;
  }

  if (summary.total === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Keine Teilnehmer
      </span>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs font-medium", className)}>
        {summary.yes > 0 && (
          <span className="flex items-center gap-0.5 text-green-600">
            <Check className="h-3 w-3" />
            {summary.yes}
          </span>
        )}
        {summary.question > 0 && (
          <span className="flex items-center gap-0.5 text-amber-600">
            <HelpCircle className="h-3 w-3" />
            {summary.question}
          </span>
        )}
        {summary.no > 0 && (
          <span className="flex items-center gap-0.5 text-red-600">
            <X className="h-3 w-3" />
            {summary.no}
          </span>
        )}
        {summary.pending > 0 && (
          <span className="flex items-center gap-0.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {summary.pending}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      <div className="flex items-center gap-1 text-green-600">
        <Check className="h-4 w-4" />
        <span className="font-medium">{summary.yes}</span>
        <span className="text-muted-foreground">Ja</span>
      </div>
      <div className="flex items-center gap-1 text-amber-600">
        <HelpCircle className="h-4 w-4" />
        <span className="font-medium">{summary.question}</span>
        <span className="text-muted-foreground">Rückfrage</span>
      </div>
      <div className="flex items-center gap-1 text-red-600">
        <X className="h-4 w-4" />
        <span className="font-medium">{summary.no}</span>
        <span className="text-muted-foreground">Nein</span>
      </div>
      {summary.pending > 0 && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-medium">{summary.pending}</span>
          <span>ausstehend</span>
        </div>
      )}
    </div>
  );
}
