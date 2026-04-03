import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolderArchive, Search, Settings2 } from "lucide-react";
import { StandaloneDecisionCreator } from "./StandaloneDecisionCreator";
import { DecisionSidebar } from "./DecisionSidebar";
import { DecisionDialogs } from "./DecisionDialogs";
import { DecisionCardList } from "./DecisionCardList";
import { DecisionCompactCard } from "./DecisionCompactCard";
import { DecisionArchivedCard } from "./DecisionArchivedCard";
import { useDecisionComments } from "@/hooks/useDecisionComments";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useMyWorkSettings } from "@/hooks/useMyWorkSettings";
import { useDecisionOverviewData } from "./hooks/useDecisionOverviewData";
import { useDecisionActions } from "./hooks/useDecisionActions";
import { useDecisionSidebarData } from "./hooks/useDecisionSidebarData";
import { useDecisionFiltering } from "./hooks/useDecisionFiltering";
import { getResponseSummary } from "./utils/decisionOverview";
import type { DecisionRequest } from "./utils/decisionOverview";

export const DecisionOverview = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const { decisionTabOrder, hiddenDecisionTabs, updateDecisionTabSettings } = useMyWorkSettings();
  const { isHighlighted, highlightRef } = useNotificationHighlight();
  const { decisions, loadDecisionRequests } = useDecisionOverviewData();

  // Dialog/panel state
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [highlightResponseId, setHighlightResponseId] = useState<string | null>(null);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [defaultParticipantsOpen, setDefaultParticipantsOpen] = useState(false);
  const [commentsDecisionId, setCommentsDecisionId] = useState<string | null>(null);
  const [commentsDecisionTitle, setCommentsDecisionTitle] = useState<string>("");
  const [attachmentFilesByDecision, setAttachmentFilesByDecision] = useState<
    Record<string, Array<{ id: string; file_name: string; file_path: string }>>
  >({});
  const [previewAttachment, setPreviewAttachment] = useState<{
    file_path: string;
    file_name: string;
  } | null>(null);

  // Core hooks
  const refresh = (userId: string) => loadDecisionRequests(userId);

  const actions = useDecisionActions({ user, currentTenant, onRefresh: refresh });

  const sidebarData = useDecisionSidebarData(decisions, user?.id);

  const filtering = useDecisionFiltering({ decisions, decisionTabOrder, hiddenDecisionTabs });

  // URL action handler
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-decision") {
      setIsCreateDialogOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (user?.id) loadDecisionRequests(user.id);
  }, [user?.id]);

  // Auto-switch tab when notification highlight points to a decision in a different tab
  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || decisions.length === 0 || !user?.id) return;

    const decision = decisions.find((d) => d.id === highlightId);
    if (!decision) {
      toast({
        title: "Element nicht gefunden",
        description: "Diese Entscheidung existiert nicht mehr oder wurde gelöscht.",
        variant: "destructive",
      });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("highlight");
        return next;
      }, { replace: true });
      return;
    }

    let targetTab = filtering.activeTab;
    if (decision.status === "archived") {
      targetTab = "archived";
    } else if (decision.isParticipant && !decision.hasResponded && !decision.isCreator) {
      targetTab = "for-me";
    } else if (decision.isCreator) {
      const s = getResponseSummary(decision.participants);
      targetTab =
        s.questionCount > 0 || (s.total > 0 && s.pending < s.total) ? "for-me" : "my-decisions";
    } else if (decision.isParticipant && decision.hasResponded) {
      targetTab = "answered";
    } else if (decision.visible_to_all) {
      targetTab = "public";
    }

    if (targetTab !== filtering.activeTab) filtering.setActiveTab(targetTab);
  }, [decisions, searchParams]);

  // Comment counts
  const decisionIds = useMemo(() => decisions.map((d) => d.id), [decisions]);
  const { getCommentCount, refresh: refreshCommentCounts } = useDecisionComments(decisionIds);

  // Navigation handlers
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

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedDecisionId(null);
    setHighlightCommentId(null);
    setHighlightResponseId(null);
  };

  const handleDecisionArchived = () => {
    if (user?.id) loadDecisionRequests(user.id);
    handleCloseDetails();
  };

  const loadAttachmentFiles = async (decisionId: string) => {
    if (attachmentFilesByDecision[decisionId]) return;

    const { data, error } = await supabase
      .from("task_decision_attachments")
      .select("id, file_name, file_path")
      .eq("decision_id", decisionId)
      .order("created_at", { ascending: false });

    if (error) {
      debugConsole.error("Error loading attachment files:", error);
      toast({ title: "Fehler", description: "Anhänge konnten nicht geladen werden.", variant: "destructive" });
      return;
    }

    setAttachmentFilesByDecision((prev) => ({ ...prev, [decisionId]: data || [] }));
  };

  // Card render functions
  const renderCompactCard = (decision: DecisionRequest) => (
    <DecisionCompactCard
      key={decision.id}
      decision={decision}
      highlightRef={highlightRef}
      isHighlighted={isHighlighted}
      currentUserId={user?.id}
      creatingTaskFromDecisionId={actions.creatingTaskFromDecisionId}
      attachmentFilesByDecision={attachmentFilesByDecision}
      getCommentCount={getCommentCount}
      onOpenDetails={handleOpenDetails}
      onOpenComments={(id, title) => {
        setCommentsDecisionId(id);
        setCommentsDecisionTitle(title);
      }}
      onLoadAttachmentFiles={loadAttachmentFiles}
      onPreviewAttachment={setPreviewAttachment}
      onEdit={setEditingDecisionId}
      onDelete={setDeletingDecisionId}
      onArchive={actions.archiveDecision}
      onCreateTask={actions.createTaskFromDecision}
      onResponseSubmitted={() => user?.id && loadDecisionRequests(user.id)}
      onSendCreatorResponse={actions.sendCreatorResponse}
    />
  );

  const renderArchivedCard = (decision: DecisionRequest) => (
    <DecisionArchivedCard
      key={decision.id}
      decision={decision}
      highlightRef={highlightRef}
      isHighlighted={isHighlighted}
      onOpenDetails={handleOpenDetails}
      onRestore={actions.restoreDecision}
    />
  );

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-1">Entscheidungen</h1>
        <p className="text-base text-muted-foreground">
          Verwalten Sie Entscheidungsanfragen und Abstimmungen
        </p>
      </div>

      <div className="flex items-center justify-end mb-4">
        <StandaloneDecisionCreator
          onDecisionCreated={() => user?.id && loadDecisionRequests(user.id)}
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>

      <Tabs value={filtering.activeTab} onValueChange={filtering.setActiveTab} className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          {/* Main Content */}
          <div>
            <TabsList
              className="grid w-full h-9 mb-4"
              style={{
                gridTemplateColumns: `repeat(${filtering.configuredDecisionTabs.length + 2}, minmax(0, 1fr))`,
              }}
            >
              {filtering.configuredDecisionTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab} className="text-xs">
                  {filtering.decisionTabLabels[tab]}
                  {tab === "for-me" && filtering.decisionTabCounts[tab] > 0 ? (
                    <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                      {filtering.decisionTabCounts[tab]}
                    </Badge>
                  ) : tab !== "for-me" ? (
                    ` (${filtering.decisionTabCounts[tab]})`
                  ) : null}
                </TabsTrigger>
              ))}
              <TabsTrigger value="questions" className="text-xs">
                Rückfragen
                {filtering.tabCounts.questions > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-1.5 text-orange-600 border-orange-600 text-[10px] px-1.5 py-0"
                  >
                    {filtering.tabCounts.questions}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs">
                <FolderArchive className="h-3 w-3 mr-1" />
                Archiv ({filtering.tabCounts.archived})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filtering.activeTab} className="mt-0 space-y-3">
              <DecisionCardList
                activeTab={filtering.activeTab}
                filteredDecisions={filtering.filteredDecisions}
                renderArchivedCard={renderArchivedCard}
                renderCompactCard={renderCompactCard}
              />
            </TabsContent>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Entscheidungen durchsuchen..."
                  value={filtering.searchQuery}
                  onChange={(e) => filtering.setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setDefaultParticipantsOpen(true)}
                title="Standard-Einstellungen"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            <DecisionSidebar
              openQuestions={sidebarData.openQuestions}
              newComments={sidebarData.newComments}
              pendingDirectReplies={sidebarData.pendingDirectReplies}
              recentActivities={sidebarData.recentActivities}
              onQuestionClick={handleOpenDetails}
              onCommentClick={handleOpenDetails}
              onActivityClick={handleActivityOpen}
              onResponseSent={() => user?.id && loadDecisionRequests(user.id)}
            />
          </div>
        </div>
      </Tabs>

      <DecisionDialogs
        selectedDecisionId={selectedDecisionId}
        isDetailsOpen={isDetailsOpen}
        onCloseDetails={handleCloseDetails}
        onArchived={handleDecisionArchived}
        highlightCommentId={highlightCommentId}
        highlightResponseId={highlightResponseId}
        editingDecisionId={editingDecisionId}
        setEditingDecisionId={setEditingDecisionId}
        onUpdated={() => {
          setEditingDecisionId(null);
          if (user?.id) loadDecisionRequests(user.id);
        }}
        commentsDecisionId={commentsDecisionId}
        commentsDecisionTitle={commentsDecisionTitle}
        onCloseComments={() => setCommentsDecisionId(null)}
        onCommentAdded={() => {
          refreshCommentCounts();
          if (user?.id) loadDecisionRequests(user.id);
        }}
        defaultParticipantsOpen={defaultParticipantsOpen}
        onDefaultParticipantsOpenChange={setDefaultParticipantsOpen}
        decisionTabOrder={decisionTabOrder}
        hiddenDecisionTabs={hiddenDecisionTabs}
        updateDecisionTabSettings={updateDecisionTabSettings}
        previewAttachment={previewAttachment}
        onPreviewAttachmentChange={() => setPreviewAttachment(null)}
        deletingDecisionId={deletingDecisionId}
        setDeletingDecisionId={setDeletingDecisionId}
        onDeleteDecision={() => {
          if (deletingDecisionId) actions.deleteDecision(deletingDecisionId);
          setDeletingDecisionId(null);
        }}
      />
    </div>
  );
};
