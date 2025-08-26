import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X, MessageCircle, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskDecisionStatusProps {
  taskId: string;
  createdBy: string;
}

interface DecisionWithResponses {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  participants: {
    id: string;
    user_id: string;
    profile: {
      display_name: string | null;
    };
    responses: Array<{
      response_type: 'yes' | 'no' | 'question';
      comment: string | null;
      created_at: string;
    }>;
  }[];
}

export const TaskDecisionStatus = ({ taskId, createdBy }: TaskDecisionStatusProps) => {
  const [decisions, setDecisions] = useState<DecisionWithResponses[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDecisions();
    getCurrentUser();
  }, [taskId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadDecisions = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decisions')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          task_decision_participants!inner (
            id,
            user_id,
            task_decision_responses (
              response_type,
              comment,
              created_at
            )
          )
        `)
        .eq('task_id', taskId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user profiles separately
      const userIds = data?.flatMap(d => d.task_decision_participants?.map(p => p.user_id) || []) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const formattedData = data?.map(decision => ({
        ...decision,
        participants: decision.task_decision_participants?.map(participant => ({
          id: participant.id,
          user_id: participant.user_id,
          profile: profileMap.get(participant.user_id) || { display_name: null },
          responses: (participant.task_decision_responses || []).map(response => ({
            ...response,
            response_type: response.response_type as 'yes' | 'no' | 'question'
          })),
        })) || [],
      })) || [];

      setDecisions(formattedData);
    } catch (error) {
      console.error('Error loading decisions:', error);
    }
  };

  const archiveDecision = async (decisionId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: currentUserId,
        })
        .eq('id', decisionId);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde archiviert.",
      });

      loadDecisions();
    } catch (error) {
      console.error('Error archiving decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht archiviert werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getResponseSummary = (participants: DecisionWithResponses['participants']) => {
    const yesCount = participants.filter(p => p.responses.some(r => r.response_type === 'yes')).length;
    const noCount = participants.filter(p => p.responses.some(r => r.response_type === 'no')).length;
    const questionCount = participants.filter(p => p.responses.some(r => r.response_type === 'question')).length;
    const totalResponses = yesCount + noCount + questionCount;
    const pending = participants.length - totalResponses;

    return { yesCount, noCount, questionCount, pending, total: participants.length };
  };

  if (decisions.length === 0) {
    return null;
  }

  const isCreator = currentUserId === createdBy;

  return (
    <div className="space-y-3">
      {decisions.map((decision) => {
        const summary = getResponseSummary(decision.participants);
        
        return (
          <Card key={decision.id} className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {decision.title}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                    Entscheidung
                  </Badge>
                  {isCreator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => archiveDecision(decision.id)}
                      disabled={isLoading}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Archive className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              {decision.description && (
                <p className="text-xs text-muted-foreground">{decision.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs">
                  <span className="flex items-center text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    {summary.yesCount}
                  </span>
                  <span className="flex items-center text-orange-600">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    {summary.questionCount}
                  </span>
                  <span className="flex items-center text-red-600">
                    <X className="h-3 w-3 mr-1" />
                    {summary.noCount}
                  </span>
                  <span className="text-muted-foreground">
                    ({summary.pending} ausstehend)
                  </span>
                </div>
                {isCreator && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Details anzeigen
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>{decision.title}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {decision.participants.map((participant) => {
                          const latestResponse = participant.responses[0];
                          return (
                            <div key={participant.id} className="flex items-center justify-between p-3 border rounded">
                              <span className="font-medium">
                                {participant.profile?.display_name || 'Unbekannter Benutzer'}
                              </span>
                              <div className="flex items-center space-x-2">
                                {latestResponse ? (
                                  <div className="flex items-center space-x-2">
                                    {latestResponse.response_type === 'yes' && (
                                      <Badge variant="outline" className="text-green-600 border-green-600">
                                        <Check className="h-3 w-3 mr-1" />
                                        Ja
                                      </Badge>
                                    )}
                                    {latestResponse.response_type === 'no' && (
                                      <Badge variant="outline" className="text-red-600 border-red-600">
                                        <X className="h-3 w-3 mr-1" />
                                        Nein
                                      </Badge>
                                    )}
                                    {latestResponse.response_type === 'question' && (
                                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                                        <MessageCircle className="h-3 w-3 mr-1" />
                                        Rückfrage
                                      </Badge>
                                    )}
                                    {latestResponse.comment && (
                                      <span className="text-xs text-muted-foreground">
                                        "{latestResponse.comment}"
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    Ausstehend
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};