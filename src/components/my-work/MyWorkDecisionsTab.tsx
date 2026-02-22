import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useDecisionRefreshScheduler } from "@/hooks/useDecisionRefreshScheduler";
import { useMyWorkDecisionsData } from "@/hooks/useMyWorkDecisionsData";
import { useMyWorkDecisionsSidebarData } from "@/hooks/useMyWorkDecisionsSidebarData";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { DecisionEditDialog } from "@/components/task-decisions/DecisionEditDialog";
import { DecisionComments } from "@/components/task-decisions/DecisionComments";
import { DefaultParticipantsDialog } from "@/components/task-decisions/DefaultParticipantsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MyWorkDecisionCard } from "./decisions/MyWorkDecisionCard";
import { MyWorkDecisionSidebar } from "./decisions/MyWorkDecisionSidebar";
import { MyWorkDecision, getResponseSummary } from "./decisions/types";

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = usePersistentState<"for-me" | "answered" | "my-decisions" | "public">("mywork-decisions-active-tab", "for-me");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [highlightResponseId, setHighlightResponseId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [archivingDecisionId, setArchivingDecisionId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [commentsDecisionId, setCommentsDecisionId] = useState<string | null>(null);
  const [commentsDecisionTitle, setCommentsDecisionTitle] = useState("");
  const [defaultParticipantsOpen, setDefaultParticipantsOpen] = useState(false);
  const latestLoadRequestRef = useRef(0);

  const { decisions, setDecisions, loading, loadDecisions } = useMyWorkDecisionsData(user?.id);
  const { isHighlighted, highlightRef } = useNotificationHighlight();

  // Auto-switch tab when highlight param points to a decision in a different tab
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (!highlightId || decisions.length === 0 || !user?.id) return;

    const decision = decisions.find(d => d.id === highlightId);
    if (!decision) return;

    let targetTab: typeof activeTab = activeTab;
    if (decision.isParticipant && !decision.hasResponded && !decision.isCreator) {
      targetTab = 'for-me';
    } else if (decision.isCreator) {
      const s = getResponseSummary(decision.participants);
      if (s.questionCount > 0 || (s.total > 0 && s.pending < s.total)) {
        targetTab = 'for-me';
      } else {
        targetTab = 'my-decisions';
      }
    } else if (decision.isParticipant && decision.hasResponded) {
      targetTab = 'answered';
    } else if (decision.visible_to_all) {
      targetTab = 'public';
    }

    if (targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
  }, [decisions, searchParams]);

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

  const { scheduleRefresh: scheduleDecisionsRefresh } = useDecisionRefreshScheduler(loadDecisions);

  // Tab counts
  const tabCounts = useMemo(() => {
    const forMeParticipant = decisions.filter(d => d.isParticipant && !d.hasResponded && !d.isCreator);
    const forMeCreatorActivity = decisions.filter(d => {
      if (!d.isCreator) return false;
      const s = getResponseSummary(d.participants);
      return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
    });
    const forMeIds = new Set([...forMeParticipant.map(d => d.id), ...forMeCreatorActivity.map(d => d.id)]);
    return {
      forMe: forMeIds.size,
      answered: decisions.filter(d => d.isParticipant && d.hasResponded && !d.isCreator).length,
      myDecisions: decisions.filter(d => d.isCreator).length,
      public: decisions.filter(d => d.visible_to_all && !d.isCreator && !d.isParticipant).length,
    };
  }, [decisions]);

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
      case "for-me": {
        const forMeParticipant = filtered.filter(d => d.isParticipant && !d.hasResponded && !d.isCreator);
        const forMeCreatorActivity = filtered.filter(d => {
          if (!d.isCreator) return false;
          const s = getResponseSummary(d.participants);
          return s.questionCount > 0 || (s.total > 0 && s.pending < s.total);
        });
        const seen = new Set(forMeParticipant.map(d => d.id));
        return [...forMeParticipant, ...forMeCreatorActivity.filter(d => !seen.has(d.id))];
      }
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

  const sidebarData = useMyWorkDecisionsSidebarData(decisions, user?.id);

  // Inline reply to activity from card
  const sendActivityReply = async ({
    responseId,
    text,
    mode,
  }: {
    responseId: string;
    text: string;
    mode: 'creator_response' | 'participant_followup';
  }) => {
    if (!text?.trim()) return;

    if (mode === 'creator_response') {
      const { error } = await supabase
        .from('task_decision_responses')
        .update({ creator_response: text.trim() })
        .eq('id', responseId);

      if (error) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw error;
      }
    } else {
      const { data: parentResponse, error: parentError } = await supabase
        .from('task_decision_responses')
        .select('decision_id, participant_id')
        .eq('id', responseId)
        .maybeSingle();

      if (parentError || !parentResponse) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw parentError || new Error('Ausgangsnachricht nicht gefunden.');
      }

      const { error } = await supabase
        .from('task_decision_responses')
        .insert({
          decision_id: parentResponse.decision_id,
          participant_id: parentResponse.participant_id,
          response_type: 'question',
          comment: text.trim(),
          parent_response_id: responseId,
        });

      if (error) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw error;
      }
    }

    toast({
      title: "Erfolgreich",
      description: mode === 'creator_response'
        ? "Antwort wurde gesendet."
        : "Deine Rückfrage wurde gesendet.",
    });
    scheduleDecisionsRefresh();
  };

  // Actions
  const handleOpenDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setHighlightCommentId(null);
    setHighlightResponseId(null);
    setIsDetailsOpen(true);
  };

  const handleActivityOpen = (activity: { decisionId: string; type: "comment" | "response" | "decision"; targetId: string }) => {
    setSelectedDecisionId(activity.decisionId);
    setHighlightCommentId(activity.type === "comment" ? activity.targetId : null);
    setHighlightResponseId(activity.type === "response" ? activity.targetId : null);
    setIsDetailsOpen(true);
  };

  const archiveDecision = async (decisionId: string) => {
    if (!user) return;
    setArchivingDecisionId(decisionId);
    const previousDecisions = decisions;
    setDecisions((prev) => prev.filter((decision) => decision.id !== decisionId));
    try {
      const { error } = await supabase
        .from('task_decisions')
        .update({ status: 'archived', archived_at: new Date().toISOString(), archived_by: user.id })
        .eq('id', decisionId);
      if (error) throw error;
      toast({ title: "Archiviert", description: "Entscheidung wurde archiviert." });
    } catch (error) {
      setDecisions(previousDecisions);
      console.error('Error archiving:', error);
      toast({ title: "Fehler", description: "Archivierung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setArchivingDecisionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDecisionId) return;
    const decisionId = deletingDecisionId;
    const previousDecisions = decisions;
    setDecisions((prev) => prev.filter((decision) => decision.id !== decisionId));
    try {
      const { error } = await supabase.from('task_decisions').delete().eq('id', decisionId);
      if (error) throw error;
      toast({ title: "Gelöscht", description: "Entscheidung wurde gelöscht." });
      setDeletingDecisionId(null);
    } catch (error) {
      setDecisions(previousDecisions);
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
            onDecisionCreated={() => scheduleDecisionsRefresh(0)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDefaultParticipantsOpen(true)}
            title="Standard-Teilnehmer"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
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
                        isHighlighted={isHighlighted(decision.id)}
                        highlightRef={highlightRef(decision.id)}
                        onOpenDetails={handleOpenDetails}
                        onEdit={setEditingDecisionId}
                        onArchive={archiveDecision}
                        onDelete={setDeletingDecisionId}
                        onCreateTask={createTaskFromDecision}
                        onResponseSubmitted={() => scheduleDecisionsRefresh(0)}
                        onOpenComments={(id, title) => { setCommentsDecisionId(id); setCommentsDecisionTitle(title); }}
                        onReply={sendActivityReply}
                        commentCount={getCommentCount(decision.id)}
                        creatingTaskId={creatingTaskId}
                        archivingDecisionId={archivingDecisionId}
                        deletingDecisionId={deletingDecisionId}
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
                discussionComments={sidebarData.discussionComments}
                recentActivities={sidebarData.recentActivities}
                onQuestionClick={handleOpenDetails}
                onCommentClick={handleOpenDetails}
                onActivityClick={handleActivityOpen}
                onResponseSent={() => scheduleDecisionsRefresh(0)}
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
          onClose={() => { setIsDetailsOpen(false); setSelectedDecisionId(null); setHighlightCommentId(null); setHighlightResponseId(null); }}
          onArchived={() => scheduleDecisionsRefresh(0)}
          highlightCommentId={highlightCommentId}
          highlightResponseId={highlightResponseId}
        />
      )}

      {editingDecisionId && (
        <DecisionEditDialog
          decisionId={editingDecisionId}
          isOpen={true}
          onClose={() => setEditingDecisionId(null)}
          onUpdated={() => { setEditingDecisionId(null); scheduleDecisionsRefresh(0); }}
        />
      )}

      {commentsDecisionId && (
        <DecisionComments
          decisionId={commentsDecisionId}
          decisionTitle={commentsDecisionTitle}
          isOpen={!!commentsDecisionId}
          onClose={() => setCommentsDecisionId(null)}
          onCommentAdded={() => { refreshCommentCounts(); scheduleDecisionsRefresh(0); }}
        />
      )}

      <DefaultParticipantsDialog
        open={defaultParticipantsOpen}
        onOpenChange={setDefaultParticipantsOpen}
      />

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
