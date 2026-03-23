import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useDecisionRefreshScheduler } from "@/hooks/useDecisionRefreshScheduler";
import { useMyWorkDecisionsData } from "@/hooks/useMyWorkDecisionsData";
import { useMyWorkDecisionsSidebarData } from "@/hooks/useMyWorkDecisionsSidebarData";
import { DecisionTabId, useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MyWorkDecision } from "./decisions/types";
import { DecisionListToolbar } from "./decisions/DecisionListToolbar";
import { DecisionList } from "./decisions/DecisionList";
import { DecisionDialogs } from "./decisions/DecisionDialogs";
import { DecisionSidebarContainer } from "./decisions/DecisionSidebarContainer";
import { filterDecisionsByQuery, filterDecisionsByTab, getDecisionTabCounts, getVisibleDecisionTab } from "./decisions/utils";

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistentState<DecisionTabId>("mywork-decisions-active-tab", "for-me");
  const [searchQuery, setSearchQuery] = useState("");
  const { decisionTabOrder, hiddenDecisionTabs, updateDecisionTabSettings } = useMyWorkSettings();
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
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingSelectorDecisionId, setMeetingSelectorDecisionId] = useState<string | null>(null);
  const { users: tenantUsers } = useTenantUsers();
  const { decisions, setDecisions, loading, loadDecisions } = useMyWorkDecisionsData(user?.id);
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { scheduleRefresh: scheduleDecisionsRefresh } = useDecisionRefreshScheduler(() => loadDecisions({ silent: true }));
  const sidebarData = useMyWorkDecisionsSidebarData(decisions, user?.id);

  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || decisions.length === 0 || !user?.id) return;
    const decision = decisions.find((entry) => entry.id === highlightId);
    if (!decision) return;
    const targetTab = getVisibleDecisionTab(decision);
    if (targetTab && targetTab !== activeTab) setActiveTab(targetTab);
  }, [activeTab, decisions, searchParams, setActiveTab, user?.id]);

  const decisionIds = useMemo(() => decisions.map((decision) => decision.id), [decisions]);
  const { getCommentCount, refresh: refreshCommentCounts } = useDecisionComments(decisionIds);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-decision") {
      setIsCreateOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const tabCounts = useMemo(() => getDecisionTabCounts(decisions), [decisions]);
  const filteredDecisions = useMemo(() => filterDecisionsByTab(filterDecisionsByQuery(decisions, searchQuery), activeTab), [decisions, searchQuery, activeTab]);

  const sendActivityReply = async ({ responseId, text, mode }: { responseId: string; text: string; mode: "creator_response" | "participant_followup" }) => {
    if (!text?.trim()) return;
    if (mode === "creator_response") {
      const { error } = await supabase.from("task_decision_responses").update({ creator_response: text.trim() }).eq("id", responseId);
      if (error) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw error;
      }
    } else {
      const { data: parentResponse, error: parentError } = await supabase.from("task_decision_responses").select("decision_id, participant_id").eq("id", responseId).maybeSingle();
      if (parentError || !parentResponse) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw parentError || new Error("Ausgangsnachricht nicht gefunden.");
      }
      const { error } = await supabase.from("task_decision_responses").insert([{ decision_id: parentResponse.decision_id, participant_id: parentResponse.participant_id, response_type: "question", comment: text.trim(), parent_response_id: responseId }]);
      if (error) {
        toast({ title: "Fehler", description: "Antwort konnte nicht gesendet werden.", variant: "destructive" });
        throw error;
      }
    }
    toast({ title: "Erfolgreich", description: mode === "creator_response" ? "Antwort wurde gesendet." : "Deine Rückfrage wurde gesendet." });
    scheduleDecisionsRefresh();
  };

  const handleOpenDetails = (decisionId: string) => { setSelectedDecisionId(decisionId); setHighlightCommentId(null); setHighlightResponseId(null); setIsDetailsOpen(true); };
  const handleActivityOpen = (activity: { decisionId: string; type: "comment" | "response" | "decision"; targetId: string }) => { setSelectedDecisionId(activity.decisionId); setHighlightCommentId(activity.type === "comment" ? activity.targetId : null); setHighlightResponseId(activity.type === "response" ? activity.targetId : null); setIsDetailsOpen(true); };

  const archiveDecision = async (decisionId: string) => {
    if (!user) return;
    setArchivingDecisionId(decisionId);
    const previousDecisions = decisions;
    setDecisions((current) => current.filter((decision) => decision.id !== decisionId));
    try {
      const { error } = await supabase.from("task_decisions").update({ status: "archived", archived_at: new Date().toISOString(), archived_by: user.id }).eq("id", decisionId);
      if (error) throw error;
      toast({ title: "Archiviert", description: "Entscheidung wurde archiviert." });
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error archiving:", error);
      toast({ title: "Fehler", description: "Archivierung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setArchivingDecisionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingDecisionId) return;
    const decisionId = deletingDecisionId;
    const previousDecisions = decisions;
    setDecisions((current) => current.filter((decision) => decision.id !== decisionId));
    try {
      const { error } = await supabase.from("task_decisions").delete().eq("id", decisionId);
      if (error) throw error;
      toast({ title: "Gelöscht", description: "Entscheidung wurde gelöscht." });
      setDeletingDecisionId(null);
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error deleting:", error);
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    }
  };

  const createTaskFromDecision = async (decision: MyWorkDecision) => {
    if (!user?.id || !currentTenant?.id) return;
    setCreatingTaskId(decision.id);
    const summary = decision.participants ? { yesCount: decision.participants.filter((p) => p.responses[0]?.response_type === "yes").length, noCount: decision.participants.filter((p) => p.responses[0]?.response_type === "no").length } : { yesCount: 0, noCount: 0 };
    let resultText = "Ergebnis: ";
    if (summary.yesCount > summary.noCount) resultText += "Angenommen";
    else if (summary.noCount > summary.yesCount) resultText += "Abgelehnt";
    else resultText += "Unentschieden";
    try {
      const { error } = await supabase.from("tasks").insert([{ user_id: user.id, title: `[Entscheidung] ${decision.title}`, description: `<h3>Aus Entscheidung: ${decision.title}</h3><p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>${decision.description ? `<div>${decision.description}</div>` : ""}`, assigned_to: user.id, tenant_id: currentTenant.id, status: "todo", priority: "medium", category: "personal" }]);
      if (error) throw error;
      toast({ title: "Aufgabe erstellt", description: "Aufgabe wurde aus der Entscheidung erstellt." });
    } catch (error) {
      debugConsole.error("Error creating task:", error);
      toast({ title: "Fehler", description: "Aufgabe konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setCreatingTaskId(null);
    }
  };

  const handleUpdateDeadline = async (decisionId: string, date: string | null) => {
    try {
      const { error } = await supabase.from("task_decisions").update({ response_deadline: date } as never).eq("id", decisionId);
      if (error) throw error;
      setDecisions((current) => current.map((decision) => decision.id === decisionId ? { ...decision, response_deadline: date } : decision));
      toast({ title: "Gespeichert", description: date ? "Antwortfrist wurde geändert." : "Antwortfrist wurde entfernt." });
    } catch (error) {
      debugConsole.error("Error updating deadline:", error);
      toast({ title: "Fehler", description: "Frist konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleTogglePublic = async (decisionId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    try {
      const { error } = await supabase.from("task_decisions").update({ visible_to_all: newValue } as never).eq("id", decisionId);
      if (error) throw error;
      setDecisions((current) => current.map((decision) => decision.id === decisionId ? { ...decision, visible_to_all: newValue } : decision));
      toast({ title: newValue ? "Öffentlich" : "Nicht öffentlich", description: newValue ? "Entscheidung ist jetzt öffentlich." : "Entscheidung ist jetzt nicht mehr öffentlich." });
    } catch (error) {
      debugConsole.error("Error toggling public:", error);
      toast({ title: "Fehler", description: "Sichtbarkeit konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleAddParticipants = async (decisionId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const { error } = await supabase.from("task_decision_participants").insert(userIds.map((userId) => ({ decision_id: decisionId, user_id: userId })));
      if (error) throw error;
      toast({ title: "Hinzugefügt", description: `${userIds.length} Teilnehmer hinzugefügt.` });
      scheduleDecisionsRefresh(0);
    } catch (error) {
      debugConsole.error("Error adding participants:", error);
      toast({ title: "Fehler", description: "Teilnehmer konnten nicht hinzugefügt werden.", variant: "destructive" });
    }
  };

  const handleRemoveParticipant = async (decisionId: string, userId: string) => {
    try {
      const { error } = await supabase.from("task_decision_participants").delete().eq("decision_id", decisionId).eq("user_id", userId);
      if (error) throw error;
      toast({ title: "Entfernt", description: "Teilnehmer wurde entfernt." });
      scheduleDecisionsRefresh(0);
    } catch (error) {
      debugConsole.error("Error removing participant:", error);
      toast({ title: "Fehler", description: "Teilnehmer konnte nicht entfernt werden.", variant: "destructive" });
    }
  };

  const handleTogglePriority = async (decisionId: string, currentPriority: number) => {
    const newPriority = currentPriority > 0 ? 0 : 1;
    try {
      const { error } = await supabase.from("task_decisions").update({ priority: newPriority } as never).eq("id", decisionId);
      if (error) throw error;
      setDecisions((current) => current.map((decision) => decision.id === decisionId ? { ...decision, priority: newPriority } : decision));
      toast({ title: newPriority > 0 ? "Prioritär" : "Priorität entfernt" });
    } catch (error) {
      debugConsole.error("Error toggling priority:", error);
      toast({ title: "Fehler", description: "Priorität konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleAddToJourFixe = (decisionId: string) => { setMeetingSelectorDecisionId(decisionId); setMeetingSelectorOpen(true); };
  const handleMeetingSelected = async (meetingId: string) => {
    if (!meetingSelectorDecisionId) return;
    try {
      const { error } = await supabase.from("task_decisions").update({ meeting_id: meetingId, pending_for_jour_fixe: false } as never).eq("id", meetingSelectorDecisionId);
      if (error) throw error;
      toast({ title: "Zugeordnet", description: "Entscheidung wurde dem Jour Fixe zugeordnet." });
    } catch (error) {
      debugConsole.error("Error assigning to meeting:", error);
      toast({ title: "Fehler", description: "Zuordnung fehlgeschlagen.", variant: "destructive" });
    }
    setMeetingSelectorDecisionId(null);
  };
  const handleMarkForNextJourFixe = async () => {
    if (!meetingSelectorDecisionId) return;
    try {
      const { error } = await supabase.from("task_decisions").update({ pending_for_jour_fixe: true, meeting_id: null } as never).eq("id", meetingSelectorDecisionId);
      if (error) throw error;
      toast({ title: "Vorgemerkt", description: "Entscheidung wurde für den nächsten Jour Fixe vorgemerkt." });
    } catch (error) {
      debugConsole.error("Error marking for jour fixe:", error);
      toast({ title: "Fehler", description: "Vormerkung fehlgeschlagen.", variant: "destructive" });
    }
    setMeetingSelectorDecisionId(null);
  };

  const visibleDecisionTabs = decisionTabOrder.filter((tab) => !hiddenDecisionTabs.includes(tab));
  useEffect(() => { if (visibleDecisionTabs.length > 0 && !visibleDecisionTabs.includes(activeTab)) setActiveTab(visibleDecisionTabs[0]); }, [activeTab, setActiveTab, visibleDecisionTabs]);

  const tabConfig: Record<DecisionTabId, { label: string; count: number }> = {
    "for-me": { label: "Für mich", count: tabCounts.forMe },
    answered: { label: "Beantwortet", count: tabCounts.answered },
    "my-decisions": { label: "Von mir", count: tabCounts.myDecisions },
    public: { label: "Öffentlich", count: tabCounts.public },
  };
  const emptyMessages: Record<DecisionTabId, string> = {
    "for-me": "Keine offenen Entscheidungen für Sie.",
    answered: "Keine beantworteten Entscheidungen.",
    "my-decisions": "Noch keine eigenen Entscheidungen erstellt.",
    public: "Keine öffentlichen Entscheidungen.",
  };

  if (loading) {
    return <div className="space-y-2 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-20 bg-muted animate-pulse rounded-md" />)}</div>;
  }

  return (
    <>
      <div className="space-y-3 p-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DecisionTabId)}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div>
              <DecisionListToolbar
                isCreateOpen={isCreateOpen}
                onCreateOpenChange={setIsCreateOpen}
                onDecisionCreated={() => {
                  setIsCreateOpen(false);
                  scheduleDecisionsRefresh(0);
                }}
                onOpenDefaultParticipants={() => setDefaultParticipantsOpen(true)}
                onSearchChange={setSearchQuery}
                searchQuery={searchQuery}
                tabConfig={tabConfig}
                visibleDecisionTabs={visibleDecisionTabs}
              />
              <TabsContent value={activeTab} className="mt-3">
                <DecisionList
                  archivingDecisionId={archivingDecisionId}
                  creatingTaskId={creatingTaskId}
                  currentUserId={user?.id || ""}
                  decisions={filteredDecisions}
                  deletingDecisionId={deletingDecisionId}
                  emptyMessage={emptyMessages[activeTab]}
                  getCommentCount={getCommentCount}
                  getHighlightRef={highlightRef}
                  isHighlighted={isHighlighted}
                  onAddParticipants={handleAddParticipants}
                  onAddToJourFixe={handleAddToJourFixe}
                  onArchive={archiveDecision}
                  onCreateTask={createTaskFromDecision}
                  onDelete={setDeletingDecisionId}
                  onEdit={setEditingDecisionId}
                  onOpenComments={(decisionId, title) => { setCommentsDecisionId(decisionId); setCommentsDecisionTitle(title); }}
                  onOpenDetails={handleOpenDetails}
                  onRemoveParticipant={handleRemoveParticipant}
                  onReply={sendActivityReply}
                  onResponseSubmitted={() => scheduleDecisionsRefresh(0)}
                  onTogglePriority={handleTogglePriority}
                  onTogglePublic={handleTogglePublic}
                  onUpdateDeadline={handleUpdateDeadline}
                  tenantUsers={tenantUsers as Array<{ id: string; display_name?: string | null }>}
                />
              </TabsContent>
            </div>

            <DecisionSidebarContainer
              openQuestions={sidebarData.openQuestions}
              newComments={sidebarData.newComments}
              pendingDirectReplies={sidebarData.pendingDirectReplies}
              discussionComments={sidebarData.discussionComments}
              recentActivities={sidebarData.recentActivities}
              onQuestionClick={handleOpenDetails}
              onCommentClick={handleOpenDetails}
              onActivityClick={handleActivityOpen}
              onResponseSent={() => scheduleDecisionsRefresh(0)}
            />
          </div>
        </Tabs>
      </div>

      <DecisionDialogs
        commentsDecisionId={commentsDecisionId}
        commentsDecisionTitle={commentsDecisionTitle}
        decisionTabOrder={decisionTabOrder}
        defaultParticipantsOpen={defaultParticipantsOpen}
        deletingDecisionId={deletingDecisionId}
        editingDecisionId={editingDecisionId}
        hiddenDecisionTabs={hiddenDecisionTabs}
        highlightCommentId={highlightCommentId}
        highlightResponseId={highlightResponseId}
        isDetailsOpen={isDetailsOpen}
        meetingSelectorOpen={meetingSelectorOpen}
        onCloseComments={() => setCommentsDecisionId(null)}
        onCloseDetails={() => { setIsDetailsOpen(false); setSelectedDecisionId(null); setHighlightCommentId(null); setHighlightResponseId(null); }}
        onCommentsAdded={() => { refreshCommentCounts(); scheduleDecisionsRefresh(0); }}
        onDeleteConfirm={() => void handleDelete()}
        onDeleteDialogOpenChange={(open) => { if (!open) setDeletingDecisionId(null); }}
        onMeetingOpenChange={(open) => { setMeetingSelectorOpen(open); if (!open) setMeetingSelectorDecisionId(null); }}
        onMeetingSelected={handleMeetingSelected}
        onOpenChangeDefaultParticipants={setDefaultParticipantsOpen}
        onSelectNextJourFixe={handleMarkForNextJourFixe}
        onUpdated={() => { setEditingDecisionId(null); scheduleDecisionsRefresh(0); }}
        selectedDecisionId={selectedDecisionId}
        setEditingDecisionId={setEditingDecisionId}
        updateDecisionTabSettings={updateDecisionTabSettings}
      />
    </>
  );
}
