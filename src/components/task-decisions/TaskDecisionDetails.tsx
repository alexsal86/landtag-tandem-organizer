import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserBadge } from "@/components/ui/user-badge";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Check, X, MessageCircle, Send, Archive, History, Paperclip, Vote, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResponseHistoryTimeline } from "./ResponseHistoryTimeline";
import { DecisionFileUpload } from "./DecisionFileUpload";
import { TaskDecisionResponse } from "./TaskDecisionResponse";
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  user_id: string;
  profile: {
    display_name: string | null;
    badge_color: string | null;
  };
  responses: Array<{
    id: string;
    response_type: 'yes' | 'no' | 'question';
    comment: string | null;
    created_at: string;
    creator_response?: string;
  }>;
}

interface TaskDecisionDetailsProps {
  decisionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onArchived?: () => void;
}

export const TaskDecisionDetails = ({ decisionId, isOpen, onClose, onArchived }: TaskDecisionDetailsProps) => {
  const [decision, setDecision] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [creatorResponses, setCreatorResponses] = useState<{[key: string]: string}>({});
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (decisionId && isOpen) {
      loadDecisionDetails();
    }
  }, [decisionId, isOpen]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const loadDecisionDetails = async () => {
    if (!decisionId) return;

    try {
      // Load decision details
      const { data: decisionData, error: decisionError } = await supabase
        .from('task_decisions')
        .select(`
          id,
          title,
          description,
          created_by,
          created_at,
          status,
          tasks (
            id,
            title
          )
        `)
        .eq('id', decisionId)
        .single();

      if (decisionError) throw decisionError;

      // Load participants with responses
      const { data: participantsData, error: participantsError } = await supabase
        .from('task_decision_participants')
        .select(`
          id,
          user_id,
          task_decision_responses (
            id,
            response_type,
            comment,
            created_at,
            creator_response
          )
        `)
        .eq('decision_id', decisionId);

      if (participantsError) throw participantsError;

      // Get user profiles separately
      const userIds = participantsData?.map(p => p.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const formattedParticipants = participantsData?.map(participant => ({
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
      })) || [];

      setDecision(decisionData);
      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Error loading decision details:', error);
      toast({
        title: "Fehler",
        description: "Entscheidungsdetails konnten nicht geladen werden.",
        variant: "destructive",
      });
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
      loadDecisionDetails();
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

  const archiveDecision = async () => {
    if (!decision || !currentUserId) return;

    console.log("TaskDecisionDetails - Archiving decision:", { 
      decisionId: decision.id, 
      currentUserId,
      decisionCreator: decision.created_by 
    });

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_decisions')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: currentUserId,
        })
        .eq('id', decision.id)
        .select();

      console.log("Archive result:", { data, error });

      if (error) throw error;

      if (!data || data.length === 0) {
        // Prüfe ob bereits archiviert
        const { data: currentDecision } = await supabase
          .from('task_decisions')
          .select('status')
          .eq('id', decision.id)
          .single();
        
        if (currentDecision?.status === 'archived') {
          toast({
            title: "Bereits archiviert",
            description: "Diese Entscheidung ist bereits archiviert.",
          });
          onArchived?.();
          onClose();
          return;
        }
        
        throw new Error("Keine Berechtigung oder Entscheidung nicht gefunden");
      }

      // Mark related notifications as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId)
        .eq('navigation_context', 'decisions');

      toast({
        title: "Erfolgreich",
        description: "Entscheidung wurde archiviert.",
      });

      onArchived?.();
      onClose();
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

  const getResponseSummary = () => {
    const yesCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'yes').length;
    const noCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'no').length;
    const questionCount = participants.filter(p => p.responses.length > 0 && p.responses[0].response_type === 'question').length;
    const totalResponses = yesCount + noCount + questionCount;
    const pending = participants.length - totalResponses;

    return { yesCount, noCount, questionCount, pending, total: participants.length };
  };

  if (!decision) return null;

  const isCreator = currentUserId === decision.created_by;
  const summary = getResponseSummary();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{decision.title}</DialogTitle>
            {isCreator && (
              <Button
                variant="outline"
                size="sm"
                onClick={archiveDecision}
                disabled={isLoading}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Aufgabe: {decision.tasks?.title}
          </p>
          {decision.description && (
            <RichTextDisplay content={decision.description} className="mt-2" />
          )}
          <p className="text-xs text-muted-foreground">
            Erstellt am: {new Date(decision.created_at).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Response Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Abstimmungsübersicht</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4 text-sm">
                <span className="flex items-center text-green-600">
                  <Check className="h-4 w-4 mr-1" />
                  {summary.yesCount} Ja
                </span>
                <span className="flex items-center text-red-600">
                  <X className="h-4 w-4 mr-1" />
                  {summary.noCount} Nein
                </span>
                <span className="flex items-center text-orange-600">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  {summary.questionCount} Rückfragen
                </span>
                <span className="text-muted-foreground">
                  ({summary.pending} ausstehend)
                </span>
              </div>
              
              {/* Result badge when all have responded */}
              {summary.pending === 0 && summary.total > 0 && (
                <div className="mt-3 pt-3 border-t">
                  {summary.questionCount > 0 ? (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-orange-600 border-orange-600 bg-orange-50 dark:bg-orange-950"
                    >
                      <HelpCircle className="h-3.5 w-3.5 mr-1" />
                      Rückfragen offen
                    </Badge>
                  ) : summary.yesCount > summary.noCount ? (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-green-600 border-green-600 bg-green-50 dark:bg-green-950"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Angenommen
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="text-sm text-red-600 border-red-600 bg-red-50 dark:bg-red-950"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Abgelehnt
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current User's Response Section */}
          {(() => {
            const currentUserParticipant = participants.find(p => p.user_id === currentUserId);
            if (!currentUserParticipant) return null;
            
            const hasResponded = currentUserParticipant.responses && currentUserParticipant.responses.length > 0;
            
            return (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Vote className="h-4 w-4" />
                    Ihre Antwort
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TaskDecisionResponse
                    decisionId={decisionId!}
                    participantId={currentUserParticipant.id}
                    onResponseSubmitted={loadDecisionDetails}
                    hasResponded={hasResponded}
                  />
                </CardContent>
              </Card>
            );
          })()}

          {/* Participants */}
          <div className="space-y-3">
            <h4 className="font-medium">Teilnehmer</h4>
            {participants.map((participant) => {
              const latestResponse = participant.responses[0];
              return (
                <Card key={participant.id}>
                   <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <UserBadge 
                          userId={participant.user_id}
                          displayName={participant.profile?.display_name}
                          badgeColor={participant.profile?.badge_color}
                          size="sm"
                        />
                      </CardTitle>
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
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Ausstehend
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                   {latestResponse && (
                    <CardContent className="pt-0">
                      {latestResponse.comment && (
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="text-sm text-muted-foreground flex-1">
                              <strong>Kommentar:</strong>
                              <RichTextDisplay content={latestResponse.comment} className="mt-1" />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {new Date(latestResponse.created_at).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          {/* Creator Response - RichText */}
                          {latestResponse.creator_response && (
                            <div className="bg-muted p-2 rounded text-sm">
                              <strong>Antwort:</strong>
                              <RichTextDisplay content={latestResponse.creator_response} className="mt-1" />
                            </div>
                          )}

                          {/* Creator Response Input - RichText */}
                          {isCreator && latestResponse.comment && !latestResponse.creator_response && (
                            <div className="space-y-2">
                              <SimpleRichTextEditor
                                initialContent={creatorResponses[latestResponse.id] || ''}
                                onChange={(html) => setCreatorResponses(prev => ({
                                  ...prev,
                                  [latestResponse.id]: html
                                }))}
                                placeholder="Antwort eingeben..."
                                minHeight="80px"
                              />
                              <Button
                                size="sm"
                                onClick={() => sendCreatorResponse(latestResponse.id)}
                                disabled={isLoading || !creatorResponses[latestResponse.id]?.trim()}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Senden
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Response History Timeline */}
                      {participant.responses.length > 0 && (
                        <Collapsible className="mt-2">
                          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                            <History className="h-3 w-3 mr-1" />
                            Verlauf anzeigen
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ResponseHistoryTimeline 
                              participantId={participant.id}
                              decisionId={decisionId}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* File Attachments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center">
                <Paperclip className="h-4 w-4 mr-2" />
                Anhänge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DecisionFileUpload 
                decisionId={decisionId}
                onFilesChange={loadDecisionDetails}
                canUpload={true}
              />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};