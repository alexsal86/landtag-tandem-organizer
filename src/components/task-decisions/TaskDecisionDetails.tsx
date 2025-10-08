import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserBadge } from "@/components/ui/user-badge";
import { Check, X, MessageCircle, Send, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    if (!decision) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: currentUserId,
        })
        .eq('id', decision.id);

      if (error) throw error;

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
            <p className="text-sm text-muted-foreground">{decision.description}</p>
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
            </CardContent>
          </Card>

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
                          <p className="text-sm text-muted-foreground">
                            <strong>Kommentar:</strong> {latestResponse.comment}
                          </p>
                          
                          {/* Creator Response */}
                          {latestResponse.creator_response && (
                            <div className="bg-muted p-2 rounded text-sm">
                              <strong>Antwort:</strong> {latestResponse.creator_response}
                            </div>
                          )}

                          {/* Creator Response Input */}
                          {isCreator && latestResponse.response_type === 'question' && !latestResponse.creator_response && (
                            <div className="flex space-x-2">
                              <Textarea
                                placeholder="Antwort eingeben..."
                                value={creatorResponses[latestResponse.id] || ''}
                                onChange={(e) => setCreatorResponses(prev => ({
                                  ...prev,
                                  [latestResponse.id]: e.target.value
                                }))}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => sendCreatorResponse(latestResponse.id)}
                                disabled={isLoading || !creatorResponses[latestResponse.id]?.trim()}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(latestResponse.created_at).toLocaleString('de-DE')}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};