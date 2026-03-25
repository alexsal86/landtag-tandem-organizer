import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { debugConsole } from "@/utils/debugConsole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getResponseSummary } from "../utils/decisionOverview";
import type { DecisionRequest } from "../utils/decisionOverview";
import type { DecisionResponseNotificationLookup } from "@/types/taskDecisions";

type NotificationResponseRow = Pick<DecisionResponseNotificationLookup, "task_decision_participants" | "task_decisions"> & {
  decision_id: string;
};

type FollowupSourceResponseRow = {
  decision_id: string;
  participant_id: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasOwnProperty = <TKey extends PropertyKey>(
  value: object,
  key: TKey,
): value is Record<TKey, unknown> => Object.prototype.hasOwnProperty.call(value, key);

const isNotificationResponseRow = (value: unknown): value is NotificationResponseRow => {
  if (!isRecord(value)) return false;
  if (!hasOwnProperty(value, "decision_id") || typeof value.decision_id !== "string") return false;

  const participant = value.task_decision_participants;
  if (participant !== null && (!isRecord(participant) || typeof participant.user_id !== "string")) {
    return false;
  }

  const decision = value.task_decisions;
  if (decision !== null && (!isRecord(decision) || typeof decision.title !== "string")) {
    return false;
  }

  return true;
};

const isFollowupSourceResponseRow = (value: unknown): value is FollowupSourceResponseRow => {
  if (!isRecord(value)) return false;
  return typeof value.decision_id === "string" && typeof value.participant_id === "string";
};

interface UseDecisionActionsOptions {
  user: User | null;
  currentTenant: { id: string } | null;
  onRefresh: (userId: string) => void;
}

export function useDecisionActions({
  user,
  currentTenant,
  onRefresh,
}: UseDecisionActionsOptions) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [creatorResponses, setCreatorResponses] = useState<Record<string, string>>({});
  const [creatingTaskFromDecisionId, setCreatingTaskFromDecisionId] = useState<string | null>(null);

  const refresh = () => {
    if (user?.id) onRefresh(user.id);
  };

  const sendCreatorResponse = async (
    responseId: string,
    responseText?: string,
    mode: "creator_response" | "participant_followup" = "creator_response",
  ) => {
    const text = responseText || creatorResponses[responseId];
    if (!text?.trim()) return;

    setIsLoading(true);

    try {
      const actionError =
        mode === "creator_response"
          ? (
              await supabase
                .from("task_decision_responses")
                .update({ creator_response: text.trim() })
                .eq("id", responseId)
            ).error
          : await supabase
              .from("task_decision_responses")
              .select("decision_id, participant_id")
              .eq("id", responseId)
              .maybeSingle()
              .then(async ({ data, error }) => {
                if (error) return error;
                if (!isFollowupSourceResponseRow(data)) {
                  return new Error("Ausgangsnachricht nicht gefunden.");
                }

                const { error: insertError } = await supabase
                  .from("task_decision_responses")
                  .insert([
                    {
                      decision_id: data.decision_id,
                      participant_id: data.participant_id,
                      response_type: "question",
                      comment: text.trim(),
                      parent_response_id: responseId,
                    },
                  ]);

                return insertError;
              });

      if (actionError) throw actionError;

      toast({
        title: "Erfolgreich",
        description:
          mode === "creator_response"
            ? "Antwort wurde gesendet."
            : "Rückmeldung wurde gesendet.",
      });

      setCreatorResponses((prev) => ({ ...prev, [responseId]: "" }));
      refresh();

      try {
        if (mode !== "creator_response") return;

        const { data: responseData } = await supabase
          .from("task_decision_responses")
          .select(
            `id, decision_id, task_decision_participants!inner(user_id), task_decisions!inner(title)`,
          )
          .eq("id", responseId)
          .maybeSingle();

        if (isNotificationResponseRow(responseData)) {
          const participantUserId = responseData.task_decision_participants?.user_id;
          const decisionTitle = responseData.task_decisions?.title;

          if (participantUserId && participantUserId !== user?.id) {
            await supabase.rpc("create_notification", {
              user_id_param: participantUserId,
              type_name: "task_decision_creator_response",
              title_param: "Antwort auf Ihren Kommentar",
              message_param: `Der Ersteller hat auf Ihren Kommentar zu "${decisionTitle}" geantwortet.`,
              data_param: JSON.stringify({
                decision_id: responseData.decision_id,
                decision_title: decisionTitle,
              }),
              priority_param: "medium",
            });
          }
        }
      } catch (notifError) {
        debugConsole.warn(
          "Creator response notification failed (core action succeeded):",
          notifError,
        );
      }
    } catch (error) {
      debugConsole.error("Creator response core action failed:", error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const archiveDecision = async (decisionId: string) => {
    if (!user?.id) {
      toast({ title: "Fehler", description: "Nicht angemeldet.", variant: "destructive" });
      return;
    }

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
      refresh();
    } catch (error) {
      debugConsole.error("Error archiving decision:", error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht archiviert werden.",
        variant: "destructive",
      });
    }
  };

  const deleteDecision = async (decisionId: string) => {
    try {
      const { error } = await supabase
        .from("task_decisions")
        .delete()
        .eq("id", decisionId);

      if (error) throw error;

      toast({ title: "Gelöscht", description: "Entscheidung wurde endgültig gelöscht." });
      refresh();
    } catch (error) {
      debugConsole.error("Error deleting decision:", error);
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
        .from("task_decisions")
        .update({ status: "active", archived_at: null, archived_by: null })
        .eq("id", decisionId);

      if (error) throw error;

      toast({ title: "Erfolgreich", description: "Entscheidung wurde wiederhergestellt." });
      refresh();
    } catch (error) {
      debugConsole.error("Error restoring decision:", error);
      toast({
        title: "Fehler",
        description: "Entscheidung konnte nicht wiederhergestellt werden.",
        variant: "destructive",
      });
    }
  };

  const createTaskFromDecision = async (decision: DecisionRequest) => {
    if (!user?.id || !currentTenant?.id) {
      toast({ title: "Fehler", description: "Nicht angemeldet", variant: "destructive" });
      return;
    }

    setCreatingTaskFromDecisionId(decision.id);
    const summary = getResponseSummary(decision.participants);

    let resultText = "Ergebnis: ";
    if (summary.yesCount > summary.noCount) resultText += "Angenommen";
    else if (summary.noCount > summary.yesCount) resultText += "Abgelehnt";
    else resultText += "Unentschieden";

    const taskDescription = `
      <h3>Aus Entscheidung: ${decision.title}</h3>
      <p><strong>${resultText}</strong> (Ja: ${summary.yesCount}, Nein: ${summary.noCount})</p>
      ${decision.description ? `<div>${decision.description}</div>` : ""}
    `;

    try {
      const { error } = await supabase.from("tasks").insert([
        {
          user_id: user.id,
          title: `[Entscheidung] ${decision.title}`,
          description: taskDescription,
          assigned_to: user.id,
          tenant_id: currentTenant.id,
          status: "todo",
          priority: "medium",
          category: "personal",
        },
      ]);

      if (error) throw error;

      toast({ title: "Aufgabe erstellt", description: "Die Aufgabe wurde aus der Entscheidung erstellt." });
      setCreatingTaskFromDecisionId(null);
      refresh();
    } catch (error) {
      debugConsole.error("Error creating task from decision:", error);
      toast({
        title: "Fehler",
        description: "Aufgabe konnte nicht erstellt werden.",
        variant: "destructive",
      });
      setCreatingTaskFromDecisionId(null);
    }
  };

  return {
    isLoading,
    creatorResponses,
    creatingTaskFromDecisionId,
    sendCreatorResponse,
    archiveDecision,
    deleteDecision,
    restoreDecision,
    createTaskFromDecision,
  };
}
