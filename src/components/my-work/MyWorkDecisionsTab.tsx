import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { DecisionEditDialog } from "@/components/task-decisions/DecisionEditDialog";
import { DecisionComments } from "@/components/task-decisions/DecisionComments";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MyWorkDecisionCard } from "./decisions/MyWorkDecisionCard";
import { MyWorkDecisionSidebar } from "./decisions/MyWorkDecisionSidebar";
import { MyWorkDecision, SidebarOpenQuestion, SidebarNewComment, getResponseSummary } from "./decisions/types";

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [decisions, setDecisions] = useState<MyWorkDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("for-me");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [commentsDecisionId, setCommentsDecisionId] = useState<string | null>(null);
  const [commentsDecisionTitle, setCommentsDecisionTitle] = useState("");

  // Comment counts
  const decisionIds = useMemo(() => decisions.map(d => d.id), [decisions]);
  const { getCommentCount, refresh: refreshCommentCounts } = useDecisionComments(decisionIds);

  // Handle URL action param
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-decision') {
      setIsCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (user) loadDecisions();
  }, [user]);

  const loadDecisions = async () => {
    if (!user) return;
    
    try {
      // Load participant decisions
      const { data: participantData, error: participantError } = await supabase
        .from("task_decision_participants")
        .select(`
          id,
          decision_id,
          task_decisions!inner (
            id, title, description, status, created_at, created_by, visible_to_all,
            task_decision_attachments (count)
          ),
          task_decision_responses (id, response_type)
        `)
        .eq("user_id", user.id)
        .in("task_decisions.status", ["active", "open"]);

      if (participantError) throw participantError;

      // Load creator decisions
      const { data: creatorData, error: creatorError } = await supabase
        .from("task_decisions")
        .select(`
          id, title, description, status, created_at, created_by, visible_to_all,
          task_decision_participants (id, user_id, task_decision_responses (id, response_type)),
          task_decision_attachments (count)
        `)
        .eq("created_by", user.id)
        .in("status", ["active", "open"]);

      if (creatorError) throw creatorError;

      // Load public decisions
      const { data: publicData, error: publicError } = await supabase
        .from("task_decisions")
        .select(`
          id, title, description, status, created_at, created_by, visible_to_all,
          task_decision_participants (id, user_id, task_decision_responses (id, response_type)),
          task_decision_attachments (count)
        `)
        .eq("visible_to_all", true)
        .in("status", ["active", "open"])
        .neq("created_by", user.id);

      if (publicError) throw publicError;

      // Format participant decisions
      const participantDecisions: MyWorkDecision[] = (participantData || []).map((item: any) => ({
        id: item.task_decisions.id,
        title: item.task_decisions.title,
        description: item.task_decisions.description,
        status: item.task_decisions.status,
        created_at: item.task_decisions.created_at,
        created_by: item.task_decisions.created_by,
        participant_id: item.id,
        hasResponded: item.task_decision_responses.length > 0,
        isCreator: item.task_decisions.created_by === user.id,
        isParticipant: true,
        pendingCount: 0,
        responseType: item.task_decision_responses[0]?.response_type || null,
        visible_to_all: item.task_decisions.visible_to_all,
        attachmentCount: item.task_decisions.task_decision_attachments?.[0]?.count || 0,
      }));

      // Format creator decisions
      const creatorDecisions: MyWorkDecision[] = (creatorData || []).map((item: any) => {
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
          isParticipant: false,
          pendingCount,
          visible_to_all: item.visible_to_all,
          attachmentCount: item.task_decision_attachments?.[0]?.count || 0,
        };
      });

      // Format public decisions
      const participantDecisionIds = new Set(participantDecisions.map(d => d.id));
      const publicDecisions: MyWorkDecision[] = (publicData || [])
        .filter((item: any) => !participantDecisionIds.has(item.id))
        .map((item: any) => {
          const participants = item.task_decision_participants || [];
          const userParticipant = participants.find((p: any) => p.user_id === user.id);
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
            participant_id: userParticipant?.id || null,
            hasResponded: userParticipant ? userParticipant.task_decision_responses.length > 0 : true,
            isCreator: false,
            isParticipant: !!userParticipant,
            pendingCount,
            isPublic: true,
            visible_to_all: true,
            attachmentCount: item.task_decision_attachments?.[0]?.count || 0,
          };
        });

      // Merge and deduplicate
      const allDecisionsMap = new Map<string, MyWorkDecision>();
      participantDecisions.forEach(d => allDecisionsMap.set(d.id, d));
      creatorDecisions.forEach(d => {
        if (!allDecisionsMap.has(d.id)) {
          allDecisionsMap.set(d.id, d);
        } else {
          const existing = allDecisionsMap.get(d.id)!;
          existing.pendingCount = d.pendingCount;
          existing.isCreator = true;
        }
      });
      publicDecisions.forEach(d => {
        if (!allDecisionsMap.has(d.id)) allDecisionsMap.set(d.id, d);
      });

      const allDecisionsList = Array.from(allDecisionsMap.values());
      const allDecisionIds = allDecisionsList.map(d => d.id);

      if (allDecisionIds.length > 0) {
        // Load participants with profiles and responses
        const { data: participantsWithProfiles } = await supabase
          .from('task_decision_participants')
          .select(`
            id, user_id, decision_id,
            task_decision_responses (id, response_type, comment, creator_response, created_at)
          `)
          .in('decision_id', allDecisionIds);

        // Load topics
        const { data: topicsData } = await supabase
          .from('task_decision_topics')
          .select('decision_id, topic_id')
          .in('decision_id', allDecisionIds);

        // Load all user profiles
        const allUserIds = [...new Set([
          ...(participantsWithProfiles || []).map(p => p.user_id),
          ...allDecisionsList.map(d => d.created_by),
        ])];

        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, badge_color, avatar_url')
          .in('user_id', allUserIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        // Build topics map
        const topicsByDecision = new Map<string, string[]>();
        topicsData?.forEach(t => {
          if (!topicsByDecision.has(t.decision_id)) topicsByDecision.set(t.decision_id, []);
          topicsByDecision.get(t.decision_id)!.push(t.topic_id);
        });

        // Build participants map
        const participantsByDecision = new Map<string, any[]>();
        participantsWithProfiles?.forEach(p => {
          if (!participantsByDecision.has(p.decision_id)) participantsByDecision.set(p.decision_id, []);
          participantsByDecision.get(p.decision_id)!.push({
            id: p.id,
            user_id: p.user_id,
            profile: {
              display_name: profileMap.get(p.user_id)?.display_name || null,
              badge_color: profileMap.get(p.user_id)?.badge_color || null,
              avatar_url: profileMap.get(p.user_id)?.avatar_url || null,
            },
            responses: (p.task_decision_responses || [])
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((r: any) => ({ ...r, response_type: r.response_type as 'yes' | 'no' | 'question' })),
          });
        });

        // Enrich decisions
        allDecisionsList.forEach(d => {
          d.participants = participantsByDecision.get(d.id) || [];
          d.topicIds = topicsByDecision.get(d.id) || [];
          const cp = profileMap.get(d.created_by);
          d.creator = {
            user_id: d.created_by,
            display_name: cp?.display_name || null,
            badge_color: cp?.badge_color || null,
            avatar_url: cp?.avatar_url || null,
          };
        });
      }

      // Sort: unanswered first, then questions, then by date
      allDecisionsList.sort((a, b) => {
        const aUnanswered = a.isParticipant && !a.hasResponded;
        const bUnanswered = b.isParticipant && !b.hasResponded;
        if (aUnanswered && !bUnanswered) return -1;
        if (!aUnanswered && bUnanswered) return 1;

        const summA = getResponseSummary(a.participants);
        const summB = getResponseSummary(b.participants);
        if (summA.questionCount > 0 && summB.questionCount === 0) return -1;
        if (summA.questionCount === 0 && summB.questionCount > 0) return 1;

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setDecisions(allDecisionsList);
    } catch (error) {
      console.error("Error loading decisions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Tab counts
  const tabCounts = useMemo(() => ({
    forMe: decisions.filter(d => d.isParticipant && !d.hasResponded).length,
    answered: decisions.filter(d => d.isParticipant && d.hasResponded && !d.isCreator).length,
    myDecisions: decisions.filter(d => d.isCreator).length,
    public: decisions.filter(d => d.visible_to_all && !d.isCreator && !d.isParticipant).length,
  }), [decisions]);

  // Filtered decisions
  const filteredDecisions = useMemo(() => {
    let filtered = decisions;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(q) || 
        (d.description && d.description.toLowerCase().includes(q))
      );
    }

    switch (activeTab) {
      case "for-me":
        return filtered.filter(d => d.isParticipant && !d.hasResponded);
      case "answered":
        return filtered.filter(d => d.isParticipant && d.hasResponded && !d.isCreator);
      case "my-decisions":
        return filtered.filter(d => d.isCreator);
      case "public":
        return filtered.filter(d => d.visible_to_all && !d.isCreator && !d.isParticipant);
      default:
        return filtered;
    }
  }, [decisions, activeTab, searchQuery]);

  // Sidebar data
  const sidebarData = useMemo(() => {
    const openQuestions: SidebarOpenQuestion[] = [];
    const newComments: SidebarNewComment[] = [];

    decisions.forEach(decision => {
      decision.participants?.forEach(participant => {
        const latest = participant.responses[0];
        if (!latest) return;

        if (decision.isCreator && latest.response_type === 'question' && !latest.creator_response) {
          openQuestions.push({
            id: latest.id,
            decisionId: decision.id,
            decisionTitle: decision.title,
            participantName: participant.profile?.display_name || null,
            participantBadgeColor: participant.profile?.badge_color || null,
            participantAvatarUrl: participant.profile?.avatar_url || null,
            comment: latest.comment,
          });
        }

        if (decision.isCreator && latest.comment && latest.response_type !== 'question') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (new Date(latest.created_at) > sevenDaysAgo) {
            newComments.push({
              id: latest.id,
              decisionId: decision.id,
              decisionTitle: decision.title,
              participantName: participant.profile?.display_name || null,
              participantBadgeColor: participant.profile?.badge_color || null,
              participantAvatarUrl: participant.profile?.avatar_url || null,
              responseType: latest.response_type,
              comment: latest.comment,
            });
          }
        }
      });
    });

    return { openQuestions, newComments };
  }, [decisions]);

  // Actions
  const handleOpenDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setIsDetailsOpen(true);
  };

  const archiveDecision = async (decisionId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({ status: 'archived', archived_at: new Date().toISOString(), archived_by: user.id })
        .eq('id', decisionId);
      if (error) throw error;
      toast({ title: "Archiviert", description: "Entscheidung wurde archiviert." });
      loadDecisions();
    } catch (error) {
      console.error('Error archiving:', error);
      toast({ title: "Fehler", description: "Archivierung fehlgeschlagen.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deletingDecisionId) return;
    try {
      const { error } = await supabase.from('task_decisions').delete().eq('id', deletingDecisionId);
      if (error) throw error;
      toast({ title: "Gelöscht", description: "Entscheidung wurde gelöscht." });
      setDeletingDecisionId(null);
      loadDecisions();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const createTaskFromDecision = async (decision: MyWorkDecision) => {
    if (!user?.id || !currentTenant?.id) return;
    setCreatingTaskId(decision.id);
    const summary = getResponseSummary(decision.participants);
    
    let resultText = 'Ergebnis: ';
    if (summary.yesCount > summary.noCount) resultText += 'Angenommen';
    else if (summary.noCount > summary.yesCount) resultText += 'Abgelehnt';
    else resultText += 'Unentschieden';
    
    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: `[Entscheidung] ${decision.title}`,
        description: `<h3>Aus Entscheidung: ${decision.title}</h3><p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>${decision.description ? `<div>${decision.description}</div>` : ''}`,
        assigned_to: user.id,
        tenant_id: currentTenant.id,
        status: 'todo',
        priority: 'medium',
        category: 'personal'
      });
      if (error) throw error;
      toast({ title: "Aufgabe erstellt", description: "Aufgabe wurde aus der Entscheidung erstellt." });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({ title: "Fehler", description: "Aufgabe konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setCreatingTaskId(null);
    }
  };

  const emptyMessages: Record<string, string> = {
    "for-me": "Keine offenen Entscheidungen für Sie.",
    "answered": "Keine beantworteten Entscheidungen.",
    "my-decisions": "Noch keine eigenen Entscheidungen erstellt.",
    "public": "Keine öffentlichen Entscheidungen.",
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 p-4">
        {/* Search + Create */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <StandaloneDecisionCreator 
            isOpen={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onDecisionCreated={loadDecisions}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="for-me" className="text-[10px] px-1">
              Für mich
              {tabCounts.forMe > 0 && (
                <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 h-4">
                  {tabCounts.forMe}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="answered" className="text-[10px] px-1">
              Beantwortet ({tabCounts.answered})
            </TabsTrigger>
            <TabsTrigger value="my-decisions" className="text-[10px] px-1">
              Von mir ({tabCounts.myDecisions})
            </TabsTrigger>
            <TabsTrigger value="public" className="text-[10px] px-1">
              Öffentlich ({tabCounts.public})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
              {/* Main cards */}
              <div>
                {filteredDecisions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    {emptyMessages[activeTab] || "Keine Entscheidungen."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDecisions.map(decision => (
                      <MyWorkDecisionCard
                        key={decision.id}
                        decision={decision}
                        onOpenDetails={handleOpenDetails}
                        onEdit={setEditingDecisionId}
                        onArchive={archiveDecision}
                        onDelete={setDeletingDecisionId}
                        onCreateTask={createTaskFromDecision}
                        onResponseSubmitted={loadDecisions}
                        onOpenComments={(id, title) => { setCommentsDecisionId(id); setCommentsDecisionTitle(title); }}
                        commentCount={getCommentCount(decision.id)}
                        creatingTaskId={creatingTaskId}
                        currentUserId={user?.id || ""}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <MyWorkDecisionSidebar
                openQuestions={sidebarData.openQuestions}
                newComments={sidebarData.newComments}
                onQuestionClick={handleOpenDetails}
                onCommentClick={handleOpenDetails}
                onResponseSent={loadDecisions}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {selectedDecisionId && (
        <TaskDecisionDetails
          decisionId={selectedDecisionId}
          isOpen={isDetailsOpen}
          onClose={() => { setIsDetailsOpen(false); setSelectedDecisionId(null); }}
          onArchived={loadDecisions}
        />
      )}

      {editingDecisionId && (
        <DecisionEditDialog
          decisionId={editingDecisionId}
          isOpen={true}
          onClose={() => setEditingDecisionId(null)}
          onUpdated={() => { setEditingDecisionId(null); loadDecisions(); }}
        />
      )}

      {commentsDecisionId && (
        <DecisionComments
          decisionId={commentsDecisionId}
          decisionTitle={commentsDecisionTitle}
          isOpen={!!commentsDecisionId}
          onClose={() => setCommentsDecisionId(null)}
          onCommentAdded={() => { refreshCommentCounts(); loadDecisions(); }}
        />
      )}

      <AlertDialog open={!!deletingDecisionId} onOpenChange={() => setDeletingDecisionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion löscht die Entscheidung unwiderruflich mit allen Antworten und Kommentaren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
