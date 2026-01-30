import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { UserBadge } from "@/components/ui/user-badge";
import { Check, X, MessageCircle, Clock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";

interface CreatorProfile {
  user_id: string;
  display_name: string | null;
  badge_color: string | null;
}

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
  isPublic?: boolean;
  creator?: CreatorProfile;
}

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-decision') {
      setIsCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

      // Load decisions created by user - include response types for summary
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
            task_decision_responses (id, response_type)
          )
        `)
        .eq("created_by", user.id)
        .in("status", ["active", "open"]);

      if (creatorError) throw creatorError;

      // Load public decisions (visible_to_all = true) where user is not creator and not participant
      const { data: publicData, error: publicError } = await supabase
        .from("task_decisions")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          created_by,
          visible_to_all,
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (id, response_type)
          )
        `)
        .eq("visible_to_all", true)
        .in("status", ["active", "open"])
        .neq("created_by", user.id);

      if (publicError) throw publicError;

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

      // Format creator decisions and calculate pending + dominant response
      const creatorDecisions: Decision[] = (creatorData || [])
        .filter((item: any) => item.created_by === user.id)
        .map((item: any) => {
          const participants = item.task_decision_participants || [];
          const responses = participants.flatMap((p: any) => p.task_decision_responses || []);
          
          const pendingCount = participants.filter(
            (p: any) => !p.task_decision_responses || p.task_decision_responses.length === 0
          ).length;

          // Calculate dominant response for creator view
          const hasQuestions = responses.some((r: any) => r.response_type === 'question');
          const hasNo = responses.some((r: any) => r.response_type === 'no');
          const allYes = responses.length > 0 && 
                         participants.length === responses.length && 
                         responses.every((r: any) => r.response_type === 'yes');

          // Determine dominant response type for card color
          let dominantResponse: 'yes' | 'no' | 'question' | null = null;
          if (pendingCount === 0 && responses.length > 0) {
            if (hasNo) dominantResponse = 'no';
            else if (hasQuestions) dominantResponse = 'question';
            else if (allYes) dominantResponse = 'yes';
          }

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
            responseType: dominantResponse,
          };
        });

      // Get participant decision IDs to filter public decisions
      const participantDecisionIds = new Set(participantDecisions.map(d => d.id));

      // Format public decisions (exclude those where user is already participant)
      const publicDecisions: Decision[] = (publicData || [])
        .filter((item: any) => !participantDecisionIds.has(item.id))
        .map((item: any) => {
          const participants = item.task_decision_participants || [];
          const userParticipant = participants.find((p: any) => p.user_id === user.id);
          const responses = participants.flatMap((p: any) => p.task_decision_responses || []);
          const pendingCount = participants.filter(
            (p: any) => !p.task_decision_responses || p.task_decision_responses.length === 0
          ).length;

          // Calculate dominant response for public view
          const hasQuestions = responses.some((r: any) => r.response_type === 'question');
          const hasNo = responses.some((r: any) => r.response_type === 'no');
          const allYes = responses.length > 0 && 
                         participants.length === responses.length && 
                         responses.every((r: any) => r.response_type === 'yes');

          let dominantResponse: 'yes' | 'no' | 'question' | null = null;
          if (pendingCount === 0 && responses.length > 0) {
            if (hasNo) dominantResponse = 'no';
            else if (hasQuestions) dominantResponse = 'question';
            else if (allYes) dominantResponse = 'yes';
          }

          return {
            id: item.id,
            title: item.title,
            description: item.description,
            status: item.status,
            created_at: item.created_at,
            created_by: item.created_by,
            participant_id: userParticipant?.id || null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : true,
            isCreator: false,
            pendingCount,
            responseType: dominantResponse,
            isPublic: true,
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
      // Add public decisions
      publicDecisions.forEach(d => {
        if (!allDecisions.has(d.id)) {
          allDecisions.set(d.id, d);
        }
      });

      // Load creator profiles for all decisions
      const allCreatorIds = [...new Set(Array.from(allDecisions.values()).map(d => d.created_by))];
      const { data: creatorProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, badge_color')
        .in('user_id', allCreatorIds);

      const creatorProfileMap = new Map<string, CreatorProfile>(
        creatorProfiles?.map(p => [p.user_id, p]) || []
      );

      // Add creator info to all decisions
      allDecisions.forEach((decision, id) => {
        decision.creator = creatorProfileMap.get(decision.created_by) || {
          user_id: decision.created_by,
          display_name: null,
          badge_color: null,
        };
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
      case 'no': return <X className="h-4 w-4 text-red-600" />;
      case 'question': return <MessageCircle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBorderColor = (decision: Decision) => {
    // Wenn User Teilnehmer ist: Farbe basiert auf eigener Antwort
    if (decision.participant_id) {
      if (!decision.hasResponded) return 'border-l-gray-400';
      if (decision.responseType === 'question') return 'border-l-orange-500';
      if (decision.responseType === 'yes') return 'border-l-green-500';
      if (decision.responseType === 'no') return 'border-l-red-600';
      return 'border-l-gray-400';
    }
    
    // Wenn User Ersteller ist: basiert auf Gesamtergebnis
    if (decision.isCreator) {
      if (decision.responseType === 'question') return 'border-l-orange-500';
      if (decision.pendingCount > 0) return 'border-l-gray-400';
      if (decision.responseType === 'yes') return 'border-l-green-500';
      if (decision.responseType === 'no') return 'border-l-red-600';
      return 'border-l-gray-400';
    }
    
    // Öffentliche Entscheidung als Viewer: basiert auf Gesamtergebnis
    if (decision.isPublic) {
      if (decision.responseType === 'question') return 'border-l-orange-500';
      if (decision.responseType === 'yes') return 'border-l-green-500';
      if (decision.responseType === 'no') return 'border-l-red-600';
      // Grau wenn noch Antworten ausstehen oder keine Antworten
      if (decision.pendingCount > 0) return 'border-l-gray-400';
    }
    
    return 'border-l-gray-400';
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

  const handleDecisionClick = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDetailsOpen(true);
  };

  const handleDetailsClose = () => {
    setIsDetailsOpen(false);
    setSelectedDecisionId(null);
  };

  const handleDecisionCreated = () => {
    loadDecisions();
  };

  return (
    <>
      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="space-y-2 p-4">
          {decisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Keine offenen Entscheidungen</p>
              <StandaloneDecisionCreator 
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onDecisionCreated={handleDecisionCreated}
                variant="button"
              />
            </div>
          ) : (
            decisions.map((decision) => (
              <div
                key={decision.id}
                onClick={() => handleDecisionClick(decision.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer",
                  "border-l-4",
                  getBorderColor(decision)
                )}
              >
                <div className="mt-0.5">
                  {getResponseIcon(decision.responseType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{decision.title}</span>
                    {decision.isPublic && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Globe className="h-3 w-3" />
                        Öffentlich
                      </Badge>
                    )}
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
                    <RichTextDisplay 
                      content={decision.description} 
                      className="text-xs line-clamp-1 mt-0.5" 
                    />
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(decision.created_at), "dd.MM.yyyy", { locale: de })}
                    </p>
                    {decision.creator && !decision.isCreator && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>·</span>
                        <span>Von:</span>
                        <UserBadge 
                          userId={decision.creator.user_id}
                          displayName={decision.creator.display_name}
                          badgeColor={decision.creator.badge_color}
                          size="sm"
                        />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Decision Details Popup */}
      <TaskDecisionDetails
        decisionId={selectedDecisionId}
        isOpen={isDetailsOpen}
        onClose={handleDetailsClose}
        onArchived={loadDecisions}
      />

      {/* Create Decision Dialog - only show when there are decisions (otherwise it's in the empty state) */}
      {decisions.length > 0 && (
        <StandaloneDecisionCreator 
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onDecisionCreated={handleDecisionCreated}
        />
      )}
    </>
  );
}
