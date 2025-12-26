import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MessageCircle, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Decision {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  hasResponded: boolean;
  isCreator: boolean;
  pendingCount: number;
  responseType?: 'yes' | 'no' | 'question' | null;
}

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDecisions();
    }
  }, [user]);

  const loadDecisions = async () => {
    if (!user) return;
    
    try {
      // Load decisions where user is participant
      const { data: participantData, error: participantError } = await supabase
        .from("task_decision_participants")
        .select(`
          id,
          decision_id,
          task_decisions!inner (
            id,
            title,
            description,
            status,
            created_at,
            created_by
          ),
          task_decision_responses (
            id,
            response_type
          )
        `)
        .eq("user_id", user.id)
        .in("task_decisions.status", ["active", "open"]);

      if (participantError) throw participantError;

      // Load decisions created by user
      const { data: creatorData, error: creatorError } = await supabase
        .from("task_decisions")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          created_by,
          task_decision_participants (
            id,
            task_decision_responses (id)
          )
        `)
        .eq("created_by", user.id)
        .in("status", ["active", "open"]);

      if (creatorError) throw creatorError;

      // Format participant decisions
      const participantDecisions: Decision[] = (participantData || []).map((item: any) => ({
        id: item.task_decisions.id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        status: item.task_decisions.status,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
        participant_id: item.id,
        hasResponded: item.task_decision_responses.length > 0,
        isCreator: item.task_decisions.created_by === user.id,
        pendingCount: 0,
        responseType: item.task_decision_responses[0]?.response_type || null,
      }));

      // Format creator decisions and calculate pending
      const creatorDecisions: Decision[] = (creatorData || [])
        .filter((item: any) => item.created_by === user.id)
        .map((item: any) => {
          const participants = item.task_decision_participants || [];
          const pendingCount = participants.filter(
            (p: any) => !p.task_decision_responses || p.task_decision_responses.length === 0
          ).length;

          return {
            id: item.id,
            title: item.title,
            description: item.description,
            status: item.status,
            created_at: item.created_at,
            created_by: item.created_by,
            participant_id: null,
            hasResponded: true,
            isCreator: true,
            pendingCount,
            responseType: null,
          };
        });

      // Merge and deduplicate
      const allDecisions = new Map<string, Decision>();
      participantDecisions.forEach(d => allDecisions.set(d.id, d));
      creatorDecisions.forEach(d => {
        if (!allDecisions.has(d.id)) {
          allDecisions.set(d.id, d);
        } else {
          // Merge pendingCount
          const existing = allDecisions.get(d.id)!;
          existing.pendingCount = d.pendingCount;
        }
      });

      // Sort: unanswered first, then by date
      const sorted = Array.from(allDecisions.values()).sort((a, b) => {
        if (!a.hasResponded && b.hasResponded) return -1;
        if (a.hasResponded && !b.hasResponded) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setDecisions(sorted);
    } catch (error) {
      console.error("Error loading decisions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getResponseIcon = (responseType: string | null | undefined) => {
    switch (responseType) {
      case 'yes': return <Check className="h-4 w-4 text-green-500" />;
      case 'no': return <X className="h-4 w-4 text-red-500" />;
      case 'question': return <MessageCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-4">
        {decisions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine offenen Entscheidungen</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <div
              key={decision.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors",
                !decision.hasResponded && "border-l-4 border-l-primary"
              )}
            >
              <div className="mt-0.5">
                {getResponseIcon(decision.responseType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{decision.title}</span>
                  {!decision.hasResponded && (
                    <Badge variant="destructive" className="text-xs">Ausstehend</Badge>
                  )}
                  {decision.isCreator && decision.pendingCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {decision.pendingCount} warten
                    </Badge>
                  )}
                </div>
                {decision.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {decision.description.replace(/<[^>]*>/g, '')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(decision.created_at), "dd.MM.yyyy", { locale: de })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => navigate("/decisions")}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
