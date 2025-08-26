import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { supabase } from "@/integrations/supabase/client";

interface DecisionRequest {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  created_at: string;
  participant_id: string | null;
  task: {
    title: string;
  };
  hasResponded: boolean;
  isParticipant?: boolean;
}

export const TaskDecisionList = () => {
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadDecisionRequests();
    }
  }, [currentUserId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadDecisionRequests = async () => {
    if (!currentUserId) return;

    try {
      // Load decisions where user is a participant
      const { data: participantDecisions, error: participantError } = await supabase
        .from('task_decision_participants')
        .select(`
          id,
          decision_id,
          task_decisions!inner (
            id,
            task_id,
            title,
            description,
            created_at,
            status,
            tasks!inner (
              title
            )
          ),
          task_decision_responses (
            id
          )
        `)
        .eq('user_id', currentUserId)
        .eq('task_decisions.status', 'active')
        .order('task_decisions.created_at', { ascending: false });

      if (participantError) throw participantError;

      // Load decisions for tasks assigned to user (where user is not necessarily a participant)
      const { data: assignedTaskDecisions, error: assignedError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          status,
          tasks!inner (
            title,
            assigned_to
          ),
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (
              id
            )
          )
        `)
        .eq('status', 'active')
        .contains('tasks.assigned_to', currentUserId)
        .order('created_at', { ascending: false });

      if (assignedError) throw assignedError;

      // Format participant decisions
      const formattedParticipantData = participantDecisions?.map(item => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        participant_id: item.id,
        task: {
          title: item.task_decisions.tasks.title,
        },
        hasResponded: item.task_decision_responses.length > 0,
        isParticipant: true,
      })) || [];

      // Format assigned task decisions
      const formattedAssignedData = assignedTaskDecisions?.map(item => {
        const userParticipant = item.task_decision_participants.find(p => p.user_id === currentUserId);
        return {
          id: item.id,
          task_id: item.task_id,
          title: item.title,
          description: item.description,
          created_at: item.created_at,
          participant_id: userParticipant?.id || null,
          task: {
            title: item.tasks.title,
          },
          hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
          isParticipant: !!userParticipant,
        };
      }) || [];

      // Combine and deduplicate (participant decisions take priority)
      const allDecisions = [...formattedParticipantData];
      
      formattedAssignedData.forEach(assigned => {
        if (!allDecisions.some(existing => existing.id === assigned.id)) {
          allDecisions.push(assigned);
        }
      });

      // Sort by creation date
      allDecisions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDecisions(allDecisions);
    } catch (error) {
      console.error('Error loading decision requests:', error);
    }
  };

  const handleResponseSubmitted = () => {
    loadDecisionRequests();
  };

  if (decisions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="border-t-4 border-t-destructive my-6"></div>
      <h3 className="text-lg font-semibold text-foreground">Entscheidungsanfragen</h3>
      <div className="space-y-3">
        {decisions.map((decision) => (
          <Card key={decision.id} className="border-l-4 border-l-destructive">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">{decision.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Aufgabe: {decision.task.title}
                  </p>
                </div>
                <Badge variant="destructive">
                  Entscheidung
                </Badge>
              </div>
              {decision.description && (
                <p className="text-xs text-muted-foreground mt-1">{decision.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(decision.created_at).toLocaleDateString('de-DE')}
                </span>
                {decision.isParticipant && decision.participant_id ? (
                  <TaskDecisionResponse
                    decisionId={decision.id}
                    participantId={decision.participant_id}
                    onResponseSubmitted={handleResponseSubmitted}
                    hasResponded={decision.hasResponded}
                  />
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Zur Info
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};