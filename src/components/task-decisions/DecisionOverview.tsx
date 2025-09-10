import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { TaskDecisionDetails } from "./TaskDecisionDetails";
import { StandaloneDecisionCreator } from "./StandaloneDecisionCreator";
import { Check, X, MessageCircle, Send, Vote, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface DecisionRequest {
  id: string;
  task_id: string | null;
  title: string;
  description: string | null;
  created_at: string;
  created_by: string;
  participant_id: string | null;
  task: {
    title: string;
  } | null;
  hasResponded: boolean;
  isParticipant?: boolean;
  isStandalone: boolean;
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

export const DecisionOverview = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [decisions, setDecisions] = useState<DecisionRequest[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [creatorResponses, setCreatorResponses] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  console.log('DecisionOverview component rendered - user from useAuth:', user?.id);

  useEffect(() => {
    console.log('DecisionOverview useEffect triggered - user from hook:', user?.id);
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
            tasks (
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

      // Load all decisions created by or assigned to user
      const { data: allDecisions, error: allError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          created_by,
          status,
          tasks (
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
        .eq('status', 'active');

      console.log('All decisions query result:', { allDecisions, allError });

      if (allError) throw allError;

      // Format participant decisions
      const formattedParticipantData = participantDecisions?.map(item => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
        participant_id: item.id,
        task: item.task_decisions.tasks ? {
          title: item.task_decisions.tasks.title,
        } : null,
        hasResponded: item.task_decision_responses.length > 0,
        isParticipant: true,
        isStandalone: !item.task_decisions.task_id,
      })) || [];

      // Format all decisions - filter for relevant ones
      const formattedAllData = allDecisions
        ?.filter(item => {
          // Include if user is creator, participant, or assigned to task
          const isCreator = item.created_by === currentUserId;
          const isParticipant = item.task_decision_participants.some(p => p.user_id === currentUserId);
          const assignedTo = item.tasks?.assigned_to;
          const isAssigned = assignedTo ? assignedTo.includes(currentUserId) : false;
          const shouldInclude = isCreator || isParticipant || isAssigned;
          
          console.log('Decision:', item.title, 'isCreator:', isCreator, 'isParticipant:', isParticipant, 'isAssigned:', isAssigned, 'shouldInclude:', shouldInclude);
          return shouldInclude;
        })
        ?.map(item => {
          const userParticipant = item.task_decision_participants.find(p => p.user_id === currentUserId);
          return {
            id: item.id,
            task_id: item.task_id,
            title: item.title,
            description: item.description,
            created_at: item.created_at,
            created_by: item.created_by,
            participant_id: userParticipant?.id || null,
            task: item.tasks ? {
              title: item.tasks.title,
            } : null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
            isParticipant: !!userParticipant,
            isStandalone: !item.task_id,
          };
        }) || [];

      console.log('Formatted all data after filtering:', formattedAllData);

      // Combine and deduplicate (prefer participant data when available)
      const allDecisionsList = [...formattedParticipantData];
      
      formattedAllData.forEach(decision => {
        if (!allDecisionsList.some(existing => existing.id === decision.id)) {
          allDecisionsList.push(decision);
        }
      });

      // Now load all participants and responses for each decision
      if (allDecisionsList.length > 0) {
        const decisionIds = allDecisionsList.map(d => d.id);

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
        allDecisionsList.forEach((decision: any) => {
          decision.participants = participantsByDecision.get(decision.id) || [];
        });
      }

      // Sort by creation date
      allDecisionsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Final decisions list:', allDecisionsList);
      console.log('Total decisions found:', allDecisionsList.length);

      setDecisions(allDecisionsList);
    } catch (error) {
      console.error('Error loading decision requests:', error);
    }
  };

  const sendCreatorResponse = async (responseId: string) => {
    const responseText = creatorResponses[responseId];
    console.log('sendCreatorResponse called with:', { responseId, responseText, creatorResponses });
    
    if (!responseText?.trim()) return;

    setIsLoading(true);
    try {
      console.log('Updating task_decision_responses with:', { responseId, responseText });
      
      const { data, error } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: responseText })
        .eq('id', responseId)
        .select('*');

      if (error) {
        console.error('Error updating creator response:', error);
        throw error;
      }

      console.log('Updated response data:', data);

      toast({
        title: "Erfolgreich",
        description: "Antwort wurde gesendet.",
      });

      // Clear the input first
      setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));
      
      // Then reload decisions
      if (user?.id) {
        console.log('Reloading decisions after creator response');
        await loadDecisionRequests(user.id);
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
      return 'border-l-orange-500';
    }
    
    if (!allResponsesReceived) {
      return 'border-l-gray-400';
    }
    
    if (summary.yesCount > summary.noCount) {
      return 'border-l-green-500';
    } else {
      return 'border-l-red-600';
    }
  };

  const filteredDecisions = decisions.filter(decision => {
    switch (activeTab) {
      case "standalone":
        return decision.isStandalone;
      case "task-based":
        return !decision.isStandalone;
      case "my-requests":
        return decision.created_by === user?.id;
      case "to-respond":
        return decision.isParticipant && !decision.hasResponded;
      default:
        return true;
    }
  });

  const renderDecisionCard = (decision: DecisionRequest) => {
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
              {decision.task ? (
                <p className="text-xs text-muted-foreground">
                  Aufgabe: {decision.task.title}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Eigenständige Entscheidung
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {decision.isStandalone ? (
                <Badge variant="secondary">
                  <Vote className="h-3 w-3 mr-1" />
                  Eigenständig
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Task-bezogen
                </Badge>
              )}
            </div>
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
                            onClick={() => {
                              console.log('Sending creator response for responseId:', latestResponse.id, 'Text:', creatorResponses[latestResponse.id]);
                              sendCreatorResponse(latestResponse.id);
                            }}
                            disabled={isLoading || !creatorResponses[latestResponse.id]?.trim()}
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

            {/* Response option for participants */}
            {decision.isParticipant && !decision.hasResponded && decision.participant_id && (
              <div onClick={(e) => e.stopPropagation()}>
                <TaskDecisionResponse 
                  decisionId={decision.id}
                  participantId={decision.participant_id}
                  onResponseSubmitted={handleResponseSubmitted}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Entscheidungen</h2>
        <StandaloneDecisionCreator onDecisionCreated={() => user?.id && loadDecisionRequests(user.id)} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Alle ({decisions.length})</TabsTrigger>
          <TabsTrigger value="standalone">Eigenständig ({decisions.filter(d => d.isStandalone).length})</TabsTrigger>
          <TabsTrigger value="task-based">Task-bezogen ({decisions.filter(d => !d.isStandalone).length})</TabsTrigger>
          <TabsTrigger value="my-requests">Meine Anfragen ({decisions.filter(d => d.created_by === user?.id).length})</TabsTrigger>
          <TabsTrigger value="to-respond">Zu beantworten ({decisions.filter(d => d.isParticipant && !d.hasResponded).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeTab === "all" && "Keine Entscheidungen vorhanden."}
              {activeTab === "standalone" && "Keine eigenständigen Entscheidungen vorhanden."}
              {activeTab === "task-based" && "Keine task-bezogenen Entscheidungen vorhanden."}
              {activeTab === "my-requests" && "Sie haben noch keine Entscheidungsanfragen erstellt."}
              {activeTab === "to-respond" && "Keine offenen Entscheidungen zu beantworten."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDecisions.map(renderDecisionCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedDecisionId && (
        <TaskDecisionDetails
          decisionId={selectedDecisionId}
          isOpen={isDetailsOpen}
          onClose={handleCloseDetails}
          onArchived={handleDecisionArchived}
        />
      )}
    </div>
  );
};