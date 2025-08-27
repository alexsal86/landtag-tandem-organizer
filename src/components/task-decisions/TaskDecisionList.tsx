import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { TaskDecisionDetails } from "./TaskDecisionDetails";
import { Check, X, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface DecisionRequest {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  task: {
    title: string;
  };
  hasResponded: boolean;
  isParticipant?: boolean;
  participants?: Array<{
    id: string;
    user_id: string;
    profile?: {
      display_name: string | null;
    };
    responses: Array<{
      id: string;
      response_type: 'yes' | 'no' | 'question';
      comment: string | null;
      creator_response: string | null;
      created_at: string;
    }>;
  }>;
}

export const TaskDecisionList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [creatorResponses, setCreatorResponses] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);

  console.log('TaskDecisionList component rendered - user from useAuth:', user?.id);

  useEffect(() => {
    console.log('TaskDecisionList useEffect triggered - user from hook:', user?.id);
    if (user?.id) {
      loadDecisionRequests(user.id);
    } else {
      console.log('No user yet, skipping loadDecisionRequests');
    }
  }, [user?.id]);

  const loadDecisionRequests = async (currentUserId: string) => {
    console.log('Loading decision requests for user:', currentUserId);

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
            created_by,
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
        .eq('task_decisions.status', 'active');

      console.log('Participant decisions query result:', { participantDecisions, participantError });

      if (participantError) throw participantError;

      // Load decisions for tasks assigned to user 
      const { data: assignedTaskDecisions, error: assignedError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          created_by,
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
        .ilike('tasks.assigned_to', `%${currentUserId}%`);

      console.log('Assigned task decisions query result:', { assignedTaskDecisions, assignedError });

      if (assignedError) throw assignedError;

      // Format participant decisions
      const formattedParticipantData = participantDecisions?.map(item => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
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
          created_by: item.created_by,
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

      // Now load all participants and responses for each decision
      if (allDecisions.length > 0) {
        const decisionIds = allDecisions.map(d => d.id);

        // Get participants for these decisions
        const { data: participantsData, error: participantsError } = await supabase
          .from('task_decision_participants')
          .select(`
            id,
            user_id,
            decision_id,
            task_decision_responses (
              id,
              response_type,
              comment,
              creator_response,
              created_at
            )
          `)
          .in('decision_id', decisionIds);

        if (participantsError) throw participantsError;

        // Get user profiles for participants
        const userIds = [...new Set(participantsData?.map(p => p.user_id) || [])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Group participants by decision
        const participantsByDecision = new Map();
        participantsData?.forEach(participant => {
          if (!participantsByDecision.has(participant.decision_id)) {
            participantsByDecision.set(participant.decision_id, []);
          }
          participantsByDecision.get(participant.decision_id).push({
            id: participant.id,
            user_id: participant.user_id,
            profile: {
              display_name: profileMap.get(participant.user_id)?.display_name || null,
            },
            responses: (participant.task_decision_responses || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(response => ({
                ...response,
                response_type: response.response_type as 'yes' | 'no' | 'question'
              })),
          });
        });

        // Add participants data to decisions
        allDecisions.forEach((decision: any) => {
          decision.participants = participantsByDecision.get(decision.id) || [];
        });
      }

      // Sort by creation date
      allDecisions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Final decisions list:', allDecisions);
      console.log('Total decisions found:', allDecisions.length);

      setDecisions(allDecisions);
    } catch (error) {
      console.error('Error loading decision requests:', error);
    }
  };

  const sendCreatorResponse = async (responseId: string) => {
    const responseText = creatorResponses[responseId];
    if (!responseText?.trim()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: responseText })
        .eq('id', responseId);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Antwort wurde gesendet.",
      });

      setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));
      
      // Reload decisions
      if (user?.id) {
        loadDecisionRequests(user.id);
      }
    } catch (error) {
      console.error('Error sending creator response:', error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResponseSubmitted = () => {
    if (user?.id) {
      loadDecisionRequests(user.id);
    }
  };

  const handleOpenDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedDecisionId(null);
  };

  const handleDecisionArchived = () => {
    if (user?.id) {
      loadDecisionRequests(user.id);
    }
    handleCloseDetails();
  };

  const getResponseSummary = (participants: DecisionRequest['participants'] = []) => {
    const yesCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
    const noCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
    const questionCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
    const totalResponses = yesCount + noCount + questionCount;
    const pending = participants.length - totalResponses;

    return { yesCount, noCount, questionCount, pending, total: participants.length };
  };

  const getBorderColor = (summary: ReturnType<typeof getResponseSummary>) => {
    const allResponsesReceived = summary.pending === 0;
    const hasQuestions = summary.questionCount > 0;
    
    if (hasQuestions) {
      return 'border-l-orange-500'; // Es gibt Rückfragen
    }
    
    if (!allResponsesReceived) {
      return 'border-l-gray-400'; // Noch nicht alle haben abgestimmt
    }
    
    // Alle haben abgestimmt, keine Rückfragen
    if (summary.yesCount > summary.noCount) {
      return 'border-l-green-500'; // Mehr ja als nein
    } else {
      return 'border-l-red-600'; // Mehr nein als ja (oder gleich)
    }
  };

  if (decisions.length === 0) {
    return null;
  }

  return (
    <>
      <h3 className="text-lg font-semibold text-foreground">Entscheidungsanfragen</h3>
      <div className="space-y-3">
        {decisions.map((decision) => {
          const summary = getResponseSummary(decision.participants);
          return (
            <Card 
              key={decision.id} 
              className={`border-l-4 ${getBorderColor(summary)} cursor-pointer hover:bg-muted/50 transition-colors`}
              onClick={() => handleOpenDetails(decision.id)}
            >
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
                <div className="space-y-2">
                  {/* Voting Results */}
                  {decision.participants && decision.participants.length > 0 && (
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
                  )}

                  {/* Show questions and responses for creators */}
                  {user?.id === decision.created_by && decision.participants && (
                    <div className="space-y-2 mb-3" onClick={(e) => e.stopPropagation()}>
                      {decision.participants.map(participant => {
                        const latestResponse = participant.responses[0];
                        if (!latestResponse || latestResponse.response_type !== 'question') return null;
                        
                        return (
                          <div key={participant.id} className="bg-orange-50 p-2 rounded text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-orange-700">
                                Rückfrage von {participant.profile?.display_name || 'Unbekannt'}:
                              </span>
                              <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                                <MessageCircle className="h-2 w-2 mr-1" />
                                Rückfrage
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">{latestResponse.comment}</p>
                            
                            {latestResponse.creator_response ? (
                              <div className="bg-white p-2 rounded border">
                                <strong className="text-green-700">Ihre Antwort:</strong> {latestResponse.creator_response}
                              </div>
                            ) : (
                              <div className="flex space-x-2 mt-2">
                                <Textarea
                                  placeholder="Antwort eingeben..."
                                  value={creatorResponses[latestResponse.id] || ''}
                                  onChange={(e) => setCreatorResponses(prev => ({
                                    ...prev,
                                    [latestResponse.id]: e.target.value
                                  }))}
                                  className="flex-1 text-xs min-h-[60px]"
                                  rows={2}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => sendCreatorResponse(latestResponse.id)}
                                  disabled={isLoading || !creatorResponses[latestResponse.id]?.trim()}
                                  className="self-end"
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(decision.created_at).toLocaleDateString('de-DE')}
                    </span>
                    {decision.isParticipant && decision.participant_id ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <TaskDecisionResponse
                          decisionId={decision.id}
                          participantId={decision.participant_id}
                          onResponseSubmitted={handleResponseSubmitted}
                          hasResponded={decision.hasResponded}
                        />
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Zur Info
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="border-t-4 border-t-destructive my-6"></div>
      
      <TaskDecisionDetails
        decisionId={selectedDecisionId}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
        onArchived={handleDecisionArchived}
      />
    </>
  );
};