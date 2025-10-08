import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { TaskDecisionDetails } from "./TaskDecisionDetails";
import { StandaloneDecisionCreator } from "./StandaloneDecisionCreator";
import { DecisionEditDialog } from "./DecisionEditDialog";
import { UserBadge } from "@/components/ui/user-badge";
import { Check, X, MessageCircle, Send, Vote, CheckSquare, Globe, Edit, Trash2, MoreVertical, Archive, RotateCcw, Paperclip } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  visible_to_all?: boolean;
  status: string;
  archived_at: string | null;
  archived_by: string | null;
  task: {
    title: string;
  } | null;
  hasResponded: boolean;
  isParticipant?: boolean;
  isStandalone: boolean;
  isCreator: boolean;
  attachmentCount?: number;
  creator?: {
    user_id: string;
    display_name: string | null;
    badge_color: string | null;
  };
  participants?: Array<{
    id: string;
    user_id: string;
    profile?: {
      display_name: string | null;
      badge_color: string | null;
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
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadDecisionRequests(user.id);
    }
  }, [user?.id]);

  const loadDecisionRequests = async (currentUserId: string) => {
    try {
      // Load active decisions where user is a participant
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
            archived_at,
            archived_by,
            visible_to_all,
            tasks (
              title
            ),
            task_decision_attachments (count)
          ),
          task_decision_responses (
            id
          )
        `)
        .eq('user_id', currentUserId)
        .in('task_decisions.status', ['active', 'open']);

      if (participantError) throw participantError;

      // Load all active decisions created by user, assigned to user, or visible to all
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
          archived_at,
          archived_by,
          visible_to_all,
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
          ),
          task_decision_attachments (count)
        `)
        .in('status', ['active', 'open']);

      if (allError) throw allError;

      // Load archived decisions
      const { data: archivedDecisions, error: archivedError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          task_id,
          title,
          description,
          created_at,
          created_by,
          status,
          archived_at,
          archived_by,
          visible_to_all,
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
          ),
          task_decision_attachments (count)
        `)
        .eq('status', 'archived');

      if (archivedError) throw archivedError;

      // Combine active and archived decisions
      const combinedDecisions = [...(allDecisions || []), ...(archivedDecisions || [])];

      // Format participant decisions
      const formattedParticipantData = participantDecisions?.map(item => ({
        id: item.task_decisions.id,
        task_id: item.task_decisions.task_id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
        status: item.task_decisions.status,
        archived_at: item.task_decisions.archived_at,
        archived_by: item.task_decisions.archived_by,
        visible_to_all: item.task_decisions.visible_to_all,
        participant_id: item.id,
        task: item.task_decisions.tasks ? {
          title: item.task_decisions.tasks.title,
        } : null,
        hasResponded: item.task_decision_responses.length > 0,
        isParticipant: true,
        isStandalone: !item.task_decisions.task_id,
        isCreator: item.task_decisions.created_by === currentUserId,
        attachmentCount: item.task_decisions.task_decision_attachments?.[0]?.count || 0,
      })) || [];

      // Format all decisions - filter for relevant ones
      const formattedAllData = combinedDecisions
        ?.filter(item => {
          // Include if user is creator, participant, assigned to task, or visible_to_all
          const isCreator = item.created_by === currentUserId;
          const isParticipant = item.task_decision_participants.some(p => p.user_id === currentUserId);
          const assignedTo = item.tasks?.assigned_to;
          const isAssigned = assignedTo ? assignedTo.includes(currentUserId) : false;
          const isVisibleToAll = item.visible_to_all === true;
          const shouldInclude = isCreator || isParticipant || isAssigned || isVisibleToAll;
          
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
            status: item.status,
            archived_at: item.archived_at,
            archived_by: item.archived_by,
            visible_to_all: item.visible_to_all,
            participant_id: userParticipant?.id || null,
            task: item.tasks ? {
              title: item.tasks.title,
            } : null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : false,
            isParticipant: !!userParticipant,
            isStandalone: !item.task_id,
            isCreator: item.created_by === currentUserId,
            attachmentCount: item.task_decision_attachments?.[0]?.count || 0,
          };
        }) || [];

      // Intelligente Deduplizierung: Merge participant data with all data
      const decisionsMap = new Map<string, any>();

      // Zuerst alle Decisions aus formattedAllData hinzufügen
      formattedAllData.forEach(decision => {
        decisionsMap.set(decision.id, decision);
      });

      // Dann participant-spezifische Daten mergen/überschreiben
      formattedParticipantData.forEach(participantDecision => {
        const existing = decisionsMap.get(participantDecision.id);
        if (existing) {
          // Merge: Participant-Daten haben Priorität für participant_id und hasResponded
          decisionsMap.set(participantDecision.id, {
            ...existing,
            participant_id: participantDecision.participant_id,
            hasResponded: participantDecision.hasResponded,
            isParticipant: true, // User ist definitiv Participant
          });
        } else {
          // Neue Decision nur in participant data
          decisionsMap.set(participantDecision.id, participantDecision);
        }
      });

      const allDecisionsList = Array.from(decisionsMap.values());

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

        // Get user profiles for participants and creators
        const allUserIds = [...new Set([
          ...participantsData?.map(p => p.user_id) || [],
          ...allDecisionsList.map(d => d.created_by)
        ])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, badge_color')
          .in('user_id', allUserIds);

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
              badge_color: profileMap.get(participant.user_id)?.badge_color || null,
            },
            responses: (participant.task_decision_responses || [])
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map(response => ({
                ...response,
                response_type: response.response_type as 'yes' | 'no' | 'question'
              })),
          });
        });

        // Add participants data and creator info to decisions
        allDecisionsList.forEach((decision: any) => {
          decision.participants = participantsByDecision.get(decision.id) || [];
          const creatorProfile = profileMap.get(decision.created_by);
          decision.creator = {
            user_id: decision.created_by,
            display_name: creatorProfile?.display_name || null,
            badge_color: creatorProfile?.badge_color || null,
          };
        });
      }

      // Sort by creation date
      allDecisionsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDecisions(allDecisionsList);
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

      // Clear the input first
      setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));
      
      // Then reload decisions
      if (user?.id) {
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

  const handleDeleteDecision = async () => {
    if (!deletingDecisionId) return;

    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({ status: 'archived' })
        .eq('id', deletingDecisionId);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde gelöscht.",
      });

      setDeletingDecisionId(null);
      if (user?.id) {
        loadDecisionRequests(user.id);
      }
    } catch (error) {
      console.error('Error deleting decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const restoreDecision = async (decisionId: string) => {
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({
          status: 'open',
          archived_at: null,
          archived_by: null,
        })
        .eq('id', decisionId);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde wiederhergestellt.",
      });

      if (user?.id) {
        loadDecisionRequests(user.id);
      }
    } catch (error) {
      console.error('Error restoring decision:', error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht wiederhergestellt werden.",
        variant: "destructive",
      });
    }
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
    if (activeTab === "archived") {
      return decision.status === 'archived';
    }
    
    // For all other tabs, only show non-archived decisions
    if (decision.status === 'archived') return false;
    
    switch (activeTab) {
      case "my-decisions":
        return decision.isCreator;
      case "participating":
        return decision.isParticipant;
      default:
        return true;
    }
  });

  const renderDecisionCard = (decision: DecisionRequest) => {
    const summary = getResponseSummary(decision.participants);
    
    return (
      <Card 
        key={decision.id} 
        className={`border-l-4 ${getBorderColor(summary)} hover:bg-muted/50 transition-colors`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium cursor-pointer" onClick={() => handleOpenDetails(decision.id)}>
              {decision.title}
            </CardTitle>
            
            {decision.isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingDecisionId(decision.id); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); setDeletingDecisionId(decision.id); }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            {/* Left Column: Description */}
            <div className="space-y-1 cursor-pointer" onClick={() => handleOpenDetails(decision.id)}>
              {decision.description && (
                <p className="text-xs text-muted-foreground line-clamp-3">{decision.description}</p>
              )}
              {decision.task && (
                <p className="text-xs text-muted-foreground italic">
                  Aufgabe: {decision.task.title}
                </p>
              )}
            </div>

            {/* Right Column: Metadata, Badges, Voting, Actions */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Erstellt: {new Date(decision.created_at).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              
              <div className="flex items-center gap-1 flex-wrap">
                {decision.creator && (
                  <UserBadge 
                    userId={decision.creator.user_id}
                    displayName={decision.creator.display_name}
                    badgeColor={decision.creator.badge_color}
                    size="sm"
                  />
                )}
                {decision.visible_to_all && (
                  <Badge variant="secondary" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    Öffentlich
                  </Badge>
                )}
                {decision.isStandalone ? (
                  <Badge variant="secondary" className="text-xs">
                    <Vote className="h-3 w-3 mr-1" />
                    Eigenständig
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Task
                  </Badge>
                )}
                {(decision.attachmentCount ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Paperclip className="h-3 w-3 mr-1" />
                    {decision.attachmentCount}
                  </Badge>
                )}
              </div>

              {/* Voting Results */}
              {decision.participants && decision.participants.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
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
          </div>

          {/* Questions section - Full width */}
          {user?.id === decision.created_by && decision.participants && (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              {decision.participants.map(participant => {
                const latestResponse = participant.responses[0];
                if (!latestResponse || latestResponse.response_type !== 'question') return null;
                
                return (
                  <div key={participant.id} className="bg-orange-50 p-2 rounded text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-orange-700 flex items-center gap-2">
                        Rückfrage von 
                        <UserBadge 
                          userId={participant.user_id}
                          displayName={participant.profile?.display_name}
                          badgeColor={participant.profile?.badge_color}
                          size="sm"
                        />
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
        </CardContent>
      </Card>
    );
  };

  const renderArchivedDecisionCard = (decision: DecisionRequest) => {
    const summary = getResponseSummary(decision.participants);
    
    return (
      <Card 
        key={decision.id} 
        className={`border-l-4 ${getBorderColor(summary)} bg-muted/30`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground cursor-pointer" onClick={() => handleOpenDetails(decision.id)}>
              {decision.title}
            </CardTitle>
            
            {decision.isCreator && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  restoreDecision(decision.id);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Wiederherstellen
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Description */}
            <div className="space-y-1 cursor-pointer" onClick={() => handleOpenDetails(decision.id)}>
              {decision.description && (
                <p className="text-xs text-muted-foreground line-clamp-3">{decision.description}</p>
              )}
              {decision.task && (
                <p className="text-xs text-muted-foreground italic">
                  Aufgabe: {decision.task.title}
                </p>
              )}
            </div>

            {/* Right Column: Metadata, Badges, Voting */}
            <div className="space-y-2">
              <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                <p>
                  Erstellt: {new Date(decision.created_at).toLocaleString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                {decision.archived_at && (
                  <p>
                    • Archiviert: {new Date(decision.archived_at).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-1 flex-wrap">
                {decision.creator && (
                  <UserBadge 
                    userId={decision.creator.user_id}
                    displayName={decision.creator.display_name}
                    badgeColor={decision.creator.badge_color}
                    size="sm"
                  />
                )}
                <Badge variant="outline" className="text-gray-600 border-gray-600 text-xs">
                  <Archive className="h-3 w-3 mr-1" />
                  Archiviert
                </Badge>
                {decision.isStandalone ? (
                  <Badge variant="secondary" className="text-xs">
                    <Vote className="h-3 w-3 mr-1" />
                    Eigenständig
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Task
                  </Badge>
                )}
                {(decision.attachmentCount ?? 0) > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Paperclip className="h-3 w-3 mr-1" />
                    {decision.attachmentCount}
                  </Badge>
                )}
              </div>

              {/* Final Result */}
              {decision.participants && decision.participants.length > 0 && (
                <div className="flex items-center gap-3 text-xs">
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
                  {summary.pending > 0 && (
                    <span className="text-muted-foreground">
                      ({summary.pending} ausstehend)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Entscheidungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Entscheidungsanfragen und Abstimmungen
        </p>
      </div>
      
      <div className="space-y-6">
        <div className="flex justify-center mb-4">
          <StandaloneDecisionCreator onDecisionCreated={() => user?.id && loadDecisionRequests(user.id)} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Alle ({decisions.filter(d => d.status !== 'archived').length})</TabsTrigger>
          <TabsTrigger value="my-decisions">Meine Anfragen ({decisions.filter(d => d.isCreator && d.status !== 'archived').length})</TabsTrigger>
          <TabsTrigger value="participating">Teilnehmend ({decisions.filter(d => d.isParticipant && d.status !== 'archived').length})</TabsTrigger>
          <TabsTrigger value="archived">Archiviert ({decisions.filter(d => d.status === 'archived').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeTab === "all" && "Keine Entscheidungen vorhanden."}
              {activeTab === "my-decisions" && "Sie haben noch keine Entscheidungsanfragen erstellt."}
              {activeTab === "participating" && "Sie nehmen an keinen Entscheidungen teil."}
              {activeTab === "archived" && "Keine archivierten Entscheidungen vorhanden."}
            </div>
          ) : (
            <div className="space-y-3">
              {activeTab === "archived" 
                ? filteredDecisions.map(renderArchivedDecisionCard)
                : filteredDecisions.map(renderDecisionCard)
              }
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

      {editingDecisionId && (
        <DecisionEditDialog
          decisionId={editingDecisionId}
          isOpen={true}
          onClose={() => setEditingDecisionId(null)}
          onUpdated={() => {
            setEditingDecisionId(null);
            if (user?.id) {
              loadDecisionRequests(user.id);
            }
          }}
        />
      )}

      <AlertDialog open={!!deletingDecisionId} onOpenChange={() => setDeletingDecisionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Entscheidung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDecision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
};