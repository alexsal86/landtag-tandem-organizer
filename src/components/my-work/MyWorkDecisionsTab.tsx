import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useDecisionRefreshScheduler } from "@/hooks/useDecisionRefreshScheduler";
import { useMyWorkDecisionsData } from "@/hooks/useMyWorkDecisionsData";
import { useMyWorkDecisionsSidebarData } from "@/hooks/useMyWorkDecisionsSidebarData";
import { DecisionTabId, useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { Search, Settings2 } from "lucide-react";
import { DecisionListToolbar } from "./decisions/DecisionListToolbar";
import { DecisionList } from "./decisions/DecisionList";
import { DecisionDialogs } from "./decisions/DecisionDialogs";
import { DecisionSidebarContainer } from "./decisions/DecisionSidebarContainer";
import {
  filterDecisionsByQuery,
  filterDecisionsByTab,
  getDecisionTabCounts,
  getVisibleDecisionTab,
} from "./decisions/utils";
import { useDecisionActions } from "./decisions/hooks/useDecisionActions";

export function MyWorkDecisionsTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistentState<DecisionTabId>(
    "mywork-decisions-active-tab",
    "for-me",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const { decisionTabOrder, hiddenDecisionTabs, updateDecisionTabSettings } = useMyWorkSettings();
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [highlightResponseId, setHighlightResponseId] = useState<string | null>(null);
  const [defaultParticipantsOpen, setDefaultParticipantsOpen] = useState(false);
  const { users: tenantUsers } = useTenantUsers();
  const { decisions, setDecisions, loading, loadDecisions } = useMyWorkDecisionsData(user?.id);
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { scheduleRefresh: scheduleDecisionsRefresh } = useDecisionRefreshScheduler(() =>
    loadDecisions({ silent: true }),
  );
  const sidebarData = useMyWorkDecisionsSidebarData(decisions, user?.id);

  const { actions, state } = useDecisionActions({
    currentTenantId: currentTenant?.id,
    decisions,
    scheduleRefresh: scheduleDecisionsRefresh,
    setDecisions,
    user,
  });

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
    if (action !== "create-decision") return;

    actions.openCreate();
    searchParams.delete("action");
    setSearchParams(searchParams, { replace: true });
  }, [actions.openCreate, searchParams, setSearchParams]);

  const tabCounts = useMemo(() => getDecisionTabCounts(decisions), [decisions]);
  const filteredDecisions = useMemo(
    () => filterDecisionsByTab(filterDecisionsByQuery(decisions, searchQuery), activeTab),
    [decisions, searchQuery, activeTab],
  );

  const handleOpenDetails = (decisionId: string) => {
    setSelectedDecisionId(decisionId);
    setHighlightCommentId(null);
    setHighlightResponseId(null);
    setIsDetailsOpen(true);
  };

  const handleActivityOpen = (activity: {
    decisionId: string;
    type: "comment" | "response" | "decision";
    targetId: string;
  }) => {
    setSelectedDecisionId(activity.decisionId);
    setHighlightCommentId(activity.type === "comment" ? activity.targetId : null);
    setHighlightResponseId(activity.type === "response" ? activity.targetId : null);
    setIsDetailsOpen(true);
  };

  const visibleDecisionTabs = decisionTabOrder.filter((tab) => !hiddenDecisionTabs.includes(tab));

  useEffect(() => {
    if (visibleDecisionTabs.length > 0 && !visibleDecisionTabs.includes(activeTab)) {
      setActiveTab(visibleDecisionTabs[0]);
    }
  }, [activeTab, setActiveTab, visibleDecisionTabs]);

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
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 p-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DecisionTabId)}>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <DecisionListToolbar
                tabConfig={tabConfig}
                visibleDecisionTabs={visibleDecisionTabs}
              />
              <div className="mt-3 flex items-center gap-2 lg:hidden">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Suchen..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="pl-8 h-8 text-xs" />
                </div>
                <StandaloneDecisionCreator isOpen={state.isCreateOpen} onOpenChange={actions.setCreateOpen} onDecisionCreated={actions.handleDecisionCreated} />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDefaultParticipantsOpen(true)} title="Standard-Teilnehmer">
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <TabsContent value={activeTab} className="mt-3">
                <DecisionList
                  archivingDecisionId={state.archivingDecisionId}
                  creatingTaskId={state.creatingTaskId}
                  currentUserId={user?.id || ""}
                  decisions={filteredDecisions}
                  deletingDecisionId={state.deletingDecisionId}
                  emptyMessage={emptyMessages[activeTab]}
                  getCommentCount={getCommentCount}
                  getHighlightRef={highlightRef}
                  isHighlighted={isHighlighted}
                  onAddParticipants={actions.addParticipants}
                  onAddToJourFixe={actions.openMeetingSelector}
                  onArchive={actions.archiveDecision}
                  onCreateTask={actions.createTaskFromDecision}
                  onDelete={actions.requestDelete}
                  onEdit={actions.openEdit}
                  onOpenComments={actions.openComments}
                  onOpenDetails={handleOpenDetails}
                  onRemoveParticipant={actions.removeParticipant}
                  onReply={actions.sendActivityReply}
                  onResponseSubmitted={() => scheduleDecisionsRefresh(0)}
                  onTogglePriority={actions.togglePriority}
                  onTogglePublic={actions.togglePublic}
                  onUpdateDeadline={actions.updateDeadline}
                  tenantUsers={tenantUsers as any}
                />
              </TabsContent>
            </div>

            <DecisionSidebarContainer
              isCreateOpen={state.isCreateOpen}
              openQuestions={sidebarData.openQuestions}
              newComments={sidebarData.newComments}
              onCreateOpenChange={actions.setCreateOpen}
              onDecisionCreated={actions.handleDecisionCreated}
              onOpenDefaultParticipants={() => setDefaultParticipantsOpen(true)}
              onSearchChange={setSearchQuery}
              pendingDirectReplies={sidebarData.pendingDirectReplies}
              discussionComments={sidebarData.discussionComments}
              searchQuery={searchQuery}
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
        commentsDecisionId={state.commentsDecisionId}
        commentsDecisionTitle={state.commentsDecisionTitle}
        decisionTabOrder={decisionTabOrder}
        defaultParticipantsOpen={defaultParticipantsOpen}
        deletingDecisionId={state.deletingDecisionId}
        editingDecisionId={state.editingDecisionId}
        hiddenDecisionTabs={hiddenDecisionTabs}
        highlightCommentId={highlightCommentId}
        highlightResponseId={highlightResponseId}
        isDetailsOpen={isDetailsOpen}
        meetingSelectorOpen={state.meetingSelectorOpen}
        onCloseComments={actions.closeComments}
        onCloseDetails={() => {
          setIsDetailsOpen(false);
          setSelectedDecisionId(null);
          setHighlightCommentId(null);
          setHighlightResponseId(null);
        }}
        onCommentsAdded={() => {
          refreshCommentCounts();
          actions.handleCommentsAdded();
        }}
        onDeleteConfirm={() => void actions.confirmDelete()}
        onDeleteDialogOpenChange={actions.setDeleteDialogOpen}
        onMeetingOpenChange={actions.setMeetingDialogOpen}
        onMeetingSelected={actions.assignMeeting}
        onOpenChangeDefaultParticipants={setDefaultParticipantsOpen}
        onSelectNextJourFixe={actions.markForNextJourFixe}
        onUpdated={actions.handleDecisionUpdated}
        selectedDecisionId={selectedDecisionId}
        setEditingDecisionId={(decisionId) =>
          decisionId ? actions.openEdit(decisionId) : actions.closeEdit()
        }
        updateDecisionTabSettings={updateDecisionTabSettings}
      />
    </>
  );
}
