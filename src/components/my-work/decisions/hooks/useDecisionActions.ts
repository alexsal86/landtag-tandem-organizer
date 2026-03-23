import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MyWorkDecision } from "../types";
import { getResponseSummary } from "../types";

interface UseDecisionActionsOptions {
  currentTenantId: string | null | undefined;
  decisions: MyWorkDecision[];
  scheduleRefresh: (delayMs?: number) => void;
  setDecisions: Dispatch<SetStateAction<MyWorkDecision[]>>;
  user: User | null;
}

interface ReplyPayload {
  mode: "creator_response" | "participant_followup";
  responseId: string;
  text: string;
}

export function useDecisionActions({
  currentTenantId,
  decisions,
  scheduleRefresh,
  setDecisions,
  user,
}: UseDecisionActionsOptions) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [deletingDecisionId, setDeletingDecisionId] = useState<string | null>(null);
  const [archivingDecisionId, setArchivingDecisionId] = useState<string | null>(null);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [commentsDecisionId, setCommentsDecisionId] = useState<string | null>(null);
  const [commentsDecisionTitle, setCommentsDecisionTitle] = useState("");
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingSelectorDecisionId, setMeetingSelectorDecisionId] = useState<string | null>(null);

  const refreshNow = useCallback(() => scheduleRefresh(0), [scheduleRefresh]);

  const openCreate = useCallback(() => setIsCreateOpen(true), []);
  const setCreateOpen = useCallback((open: boolean) => setIsCreateOpen(open), []);
  const handleDecisionCreated = useCallback(() => {
    setIsCreateOpen(false);
    refreshNow();
  }, [refreshNow]);

  const openEdit = useCallback((decisionId: string) => setEditingDecisionId(decisionId), []);
  const closeEdit = useCallback(() => setEditingDecisionId(null), []);
  const handleDecisionUpdated = useCallback(() => {
    setEditingDecisionId(null);
    refreshNow();
  }, [refreshNow]);

  const requestDelete = useCallback((decisionId: string) => setDeletingDecisionId(decisionId), []);
  const setDeleteDialogOpen = useCallback((open: boolean) => {
    if (!open) setDeletingDecisionId(null);
  }, []);

  const openComments = useCallback((decisionId: string, title: string) => {
    setCommentsDecisionId(decisionId);
    setCommentsDecisionTitle(title);
  }, []);
  const closeComments = useCallback(() => setCommentsDecisionId(null), []);
  const handleCommentsAdded = useCallback(() => refreshNow(), [refreshNow]);

  const openMeetingSelector = useCallback((decisionId: string) => {
    setMeetingSelectorDecisionId(decisionId);
    setMeetingSelectorOpen(true);
  }, []);
  const setMeetingDialogOpen = useCallback((open: boolean) => {
    setMeetingSelectorOpen(open);
    if (!open) setMeetingSelectorDecisionId(null);
  }, []);

  const archiveDecision = async (decisionId: string) => {
    if (!user?.id) return;

    setArchivingDecisionId(decisionId);
    const previousDecisions = decisions;
    setDecisions((current) => current.filter((decision) => decision.id !== decisionId));

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          archived_by: user.id,
        })
        .eq("id", decisionId);

      if (error) throw error;

      toast({ title: "Archiviert", description: "Entscheidung wurde archiviert." });
      refreshNow();
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error archiving decision:", error);
      toast({
        title: "Fehler",
        description: "Archivierung fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setArchivingDecisionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDecisionId) return;

    const decisionId = deletingDecisionId;
    const previousDecisions = decisions;
    setDecisions((current) => current.filter((decision) => decision.id !== decisionId));

    try {
      const { error } = await supabase.from("task_decisions").delete().eq("id", decisionId);
      if (error) throw error;

      toast({ title: "Gelöscht", description: "Entscheidung wurde gelöscht." });
      setDeletingDecisionId(null);
      refreshNow();
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error deleting decision:", error);
      toast({
        title: "Fehler",
        description: "Löschen fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const createTaskFromDecision = async (decision: MyWorkDecision) => {
    if (!user?.id || !currentTenantId) return;

    setCreatingTaskId(decision.id);
    const summary = getResponseSummary(decision.participants);

    let resultText = "Ergebnis: ";
    if (summary.yesCount > summary.noCount) resultText += "Angenommen";
    else if (summary.noCount > summary.yesCount) resultText += "Abgelehnt";
    else resultText += "Unentschieden";

    try {
      const { error } = await supabase.from("tasks").insert([
        {
          user_id: user.id,
          title: `[Entscheidung] ${decision.title}`,
          description: `<h3>Aus Entscheidung: ${decision.title}</h3><p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>${decision.description ? `<div>${decision.description}</div>` : ""}`,
          assigned_to: user.id,
          tenant_id: currentTenantId,
          status: "todo",
          priority: "medium",
          category: "personal",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Aufgabe erstellt",
        description: "Aufgabe wurde aus der Entscheidung erstellt.",
      });
    } catch (error) {
      debugConsole.error("Error creating task from decision:", error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setCreatingTaskId(null);
    }
  };

  const assignMeeting = async (meetingId: string) => {
    if (!meetingSelectorDecisionId) return;

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({ meeting_id: meetingId, pending_for_jour_fixe: false } as never)
        .eq("id", meetingSelectorDecisionId);

      if (error) throw error;

      toast({ title: "Zugeordnet", description: "Entscheidung wurde dem Jour Fixe zugeordnet." });
      refreshNow();
    } catch (error) {
      debugConsole.error("Error assigning decision to meeting:", error);
      toast({
        title: "Fehler",
        description: "Zuordnung fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setMeetingSelectorDecisionId(null);
    }
  };

  const markForNextJourFixe = async () => {
    if (!meetingSelectorDecisionId) return;

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({ pending_for_jour_fixe: true, meeting_id: null } as never)
        .eq("id", meetingSelectorDecisionId);

      if (error) throw error;

      toast({
        title: "Vorgemerkt",
        description: "Entscheidung wurde für den nächsten Jour Fixe vorgemerkt.",
      });
      refreshNow();
    } catch (error) {
      debugConsole.error("Error marking decision for jour fixe:", error);
      toast({
        title: "Fehler",
        description: "Vormerkung fehlgeschlagen.",
        variant: "destructive",
      });
    } finally {
      setMeetingSelectorDecisionId(null);
    }
  };

  const sendActivityReply = async ({ responseId, text, mode }: ReplyPayload) => {
    if (!text.trim()) return;

    try {
      if (mode === "creator_response") {
        const { error } = await supabase
          .from("task_decision_responses")
          .update({ creator_response: text.trim() })
          .eq("id", responseId);

        if (error) throw error;
      } else {
        const { data: currentResponse, error: responseError } = await supabase
          .from("task_decision_responses")
          .select("id, decision_id, participant_id, parent_response_id")
          .eq("id", responseId)
          .maybeSingle();

        if (responseError || !currentResponse) {
          throw responseError || new Error("Ausgangsnachricht nicht gefunden.");
        }

        if (currentResponse.parent_response_id) {
          const { error } = await supabase
            .from("task_decision_responses")
            .update({ comment: text.trim(), updated_at: new Date().toISOString() })
            .eq("id", currentResponse.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("task_decision_responses").insert([
            {
              decision_id: currentResponse.decision_id,
              participant_id: currentResponse.participant_id,
              response_type: "question",
              comment: text.trim(),
              parent_response_id: responseId,
            },
          ]);

          if (error) throw error;
        }
      }

      toast({
        title: "Erfolgreich",
        description:
          mode === "creator_response"
            ? "Antwort wurde gesendet."
            : "Deine Rückfrage wurde gesendet.",
      });
      refreshNow();
    } catch (error) {
      debugConsole.error("Error sending activity reply:", error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateDeadline = async (decisionId: string, date: string | null) => {
    const previousDecisions = decisions;
    setDecisions((current) => current.map((decision) => (
      decision.id === decisionId ? { ...decision, response_deadline: date } : decision
    )));

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({ response_deadline: date } as never)
        .eq("id", decisionId);

      if (error) throw error;

      toast({
        title: "Gespeichert",
        description: date ? "Antwortfrist wurde geändert." : "Antwortfrist wurde entfernt.",
      });
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error updating deadline:", error);
      toast({
        title: "Fehler",
        description: "Frist konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const togglePublic = async (decisionId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const previousDecisions = decisions;
    setDecisions((current) => current.map((decision) => (
      decision.id === decisionId ? { ...decision, visible_to_all: newValue } : decision
    )));

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({ visible_to_all: newValue } as never)
        .eq("id", decisionId);

      if (error) throw error;

      toast({
        title: newValue ? "Öffentlich" : "Nicht öffentlich",
        description: newValue
          ? "Entscheidung ist jetzt öffentlich."
          : "Entscheidung ist jetzt nicht mehr öffentlich.",
      });
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error toggling decision visibility:", error);
      toast({
        title: "Fehler",
        description: "Sichtbarkeit konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const addParticipants = async (decisionId: string, userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const { error } = await supabase
        .from("task_decision_participants")
        .insert(userIds.map((userId) => ({ decision_id: decisionId, user_id: userId })));

      if (error) throw error;

      toast({
        title: "Hinzugefügt",
        description: `${userIds.length} Teilnehmer hinzugefügt.`,
      });
      refreshNow();
    } catch (error) {
      debugConsole.error("Error adding participants:", error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnten nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const removeParticipant = async (decisionId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("task_decision_participants")
        .delete()
        .eq("decision_id", decisionId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({ title: "Entfernt", description: "Teilnehmer wurde entfernt." });
      refreshNow();
    } catch (error) {
      debugConsole.error("Error removing participant:", error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };

  const togglePriority = async (decisionId: string, currentPriority: number) => {
    const newPriority = currentPriority > 0 ? 0 : 1;
    const previousDecisions = decisions;
    setDecisions((current) => current.map((decision) => (
      decision.id === decisionId ? { ...decision, priority: newPriority } : decision
    )));

    try {
      const { error } = await supabase
        .from("task_decisions")
        .update({ priority: newPriority } as never)
        .eq("id", decisionId);

      if (error) throw error;

      toast({ title: newPriority > 0 ? "Prioritär" : "Priorität entfernt" });
    } catch (error) {
      setDecisions(previousDecisions);
      debugConsole.error("Error toggling priority:", error);
      toast({
        title: "Fehler",
        description: "Priorität konnte nicht geändert werden.",
        variant: "destructive",
      });
    }
  };

  const actions = useMemo(() => ({
      addParticipants,
      archiveDecision,
      assignMeeting,
      confirmDelete,
      createTaskFromDecision,
      handleCommentsAdded,
      handleDecisionCreated,
      handleDecisionUpdated,
      markForNextJourFixe,
      openComments,
      openCreate,
      openEdit,
      openMeetingSelector,
      removeParticipant,
      requestDelete,
      sendActivityReply,
      setCreateOpen,
      setDeleteDialogOpen,
      setMeetingDialogOpen,
      togglePriority,
      togglePublic,
      updateDeadline,
      closeComments,
      closeEdit,
    }), [
      addParticipants,
      archiveDecision,
      assignMeeting,
      closeComments,
      closeEdit,
      confirmDelete,
      createTaskFromDecision,
      handleCommentsAdded,
      handleDecisionCreated,
      handleDecisionUpdated,
      markForNextJourFixe,
      openComments,
      openCreate,
      openEdit,
      openMeetingSelector,
      removeParticipant,
      requestDelete,
      sendActivityReply,
      setCreateOpen,
      setDeleteDialogOpen,
      setMeetingDialogOpen,
      togglePriority,
      togglePublic,
      updateDeadline,
    ]);

  return {
    actions,
    state: {
      archivingDecisionId,
      commentsDecisionId,
      commentsDecisionTitle,
      creatingTaskId,
      deletingDecisionId,
      editingDecisionId,
      isCreateOpen,
      meetingSelectorOpen,
    },
  };
}
