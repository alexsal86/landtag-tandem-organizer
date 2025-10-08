import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Check, X, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ResponseHistoryEntry {
  id: string;
  response_type: 'yes' | 'no' | 'question';
  comment: string | null;
  created_at: string;
  changed_by: string | null;
  profiles?: {
    display_name: string | null;
  };
}

interface ResponseHistoryTimelineProps {
  participantId: string;
  decisionId: string;
}

export const ResponseHistoryTimeline = ({ participantId, decisionId }: ResponseHistoryTimelineProps) => {
  const [history, setHistory] = useState<ResponseHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [participantId, decisionId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_decision_response_history')
        .select(`
          id,
          response_type,
          comment,
          created_at,
          changed_by
        `)
        .eq('participant_id', participantId)
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
      } else if (data) {
        // Type assertion after validating data structure
        setHistory(data.map(item => ({
          ...item,
          response_type: item.response_type as 'yes' | 'no' | 'question'
        })));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Lade Verlauf...</div>;
  }

  if (history.length === 0) {
    return <div className="text-xs text-muted-foreground">Keine Änderungen vorhanden</div>;
  }

  return (
    <div className="space-y-2 mt-2">
      <h5 className="text-xs font-medium text-muted-foreground">Änderungsverlauf</h5>
      {history.map((entry, index) => (
        <div key={entry.id} className="flex items-start space-x-2 text-xs border-l-2 border-muted pl-2 py-1">
          <div className="flex-shrink-0 w-24 text-muted-foreground">
            {new Date(entry.created_at).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              {entry.response_type === 'yes' && (
                <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Ja
                </Badge>
              )}
              {entry.response_type === 'no' && (
                <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                  <X className="h-3 w-3 mr-1" />
                  Nein
                </Badge>
              )}
              {entry.response_type === 'question' && (
                <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                  <MessageCircle className="h-3 w-3 mr-1" />
                  Rückfrage
                </Badge>
              )}
              {index === 0 && (
                <Badge variant="secondary" className="text-xs">Aktuell</Badge>
              )}
            </div>
            {entry.comment && (
              <p className="text-muted-foreground text-xs">{entry.comment}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
