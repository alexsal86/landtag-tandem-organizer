import { useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { DropResult } from "@hello-pangea/dnd";
import type { AppUserRef, ChecklistSubItem } from "@/components/shared/featureDomainTypes";
import type { ChecklistItem } from "../types";

const SYSTEM_POINT_OPTIONS = {
  none: { title: "", type: "item" },
  social_media: { title: "Social Media", type: "system_social_media" },
  rsvp: { title: "Einladungen & RSVP", type: "system_rsvp" },
} as const;

type SystemPointKey = keyof typeof SYSTEM_POINT_OPTIONS;

interface UseChecklistOperationsParams {
  user: AppUserRef | null;
  selectedPlanningId: string | undefined;
  collaborators: Array<{ event_planning_id: string; user_id: string; can_edit: boolean }>;
  selectedPlanningUserId: string | undefined;
  itemEmailActions: Record<string, { id: string; is_enabled?: boolean }>;
  currentTenantId?: string;
  currentProfileId?: string | null;
  selectedPlanningTitle?: string;
  selectedPlanningConfirmedDate?: string | null;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onRefreshDetails: (planningId: string) => Promise<void>;
  onSocialPlannerActionCreated?: (itemId: string, action: { id: string }) => void;
}

export type ChecklistOperationEvent =
  | { type: "network-interruption"; context: "toggle-checklist-item" | "fetch-checklist-state"; error: unknown }
  | { type: "system-point-create-failed"; systemPoint: "social_media" | "rsvp"; error: unknown }
  | { type: "checklist-refresh-failed"; error: unknown }
  | { type: "delete-checklist-item-failed"; error: unknown }
  | { type: "reorder-checklist-item-failed"; error: unknown };

export interface UseChecklistOperationsReturn {
  checklistItems: ChecklistItem[];
  setChecklistItems: Dispatch<SetStateAction<ChecklistItem[]>>;
  newChecklistItem: string;
  setNewChecklistItem: Dispatch<SetStateAction<string>>;
  newChecklistItemType: SystemPointKey;
  setNewChecklistItemType: Dispatch<SetStateAction<SystemPointKey>>;
  toggleChecklistItem: (itemId: string, isCompleted: boolean) => Promise<void>;
  updateChecklistItemTitle: (itemId: string, title: string) => Promise<void>;
  updateChecklistItemColor: (itemId: string, color: string) => Promise<void>;
  addChecklistItem: () => Promise<void>;
  deleteChecklistItem: (itemId: string) => Promise<void>;
  addSubItem: (itemId: string) => Promise<void>;
  toggleSubItem: (itemId: string, subItemIndex: number, isCompleted: boolean) => Promise<void>;
  updateSubItemTitle: (itemId: string, subItemIndex: number, title: string) => Promise<void>;
  removeSubItem: (itemId: string, subItemIndex: number) => Promise<void>;
  onDragEnd: (result: DropResult) => Promise<void>;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.details;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return "Unbekannter Fehler";
};

const logChecklistOperationEvent = (event: ChecklistOperationEvent): void => {
  switch (event.type) {
    case "network-interruption":
      debugConsole.warn(`Checklist ${event.context}:`, event.error);
      break;
    case "system-point-create-failed":
      debugConsole.error(`Error creating ${event.systemPoint} system point:`, event.error);
      break;
    case "checklist-refresh-failed":
      debugConsole.warn("Checklist refresh after item creation failed; keeping optimistic system point.", event.error);
      break;
    case "delete-checklist-item-failed":
      debugConsole.error("Error deleting checklist item:", event.error);
      break;
    case "reorder-checklist-item-failed":
      debugConsole.error("Error updating item order:", event.error);
      break;
  }
};

export function useChecklistOperations({
  user,
  selectedPlanningId,
  collaborators,
  selectedPlanningUserId,
  itemEmailActions,
  currentTenantId,
  currentProfileId,
  selectedPlanningTitle,
  selectedPlanningConfirmedDate,
  toast,
  onRefreshDetails,
  onSocialPlannerActionCreated,
}: UseChecklistOperationsParams): UseChecklistOperationsReturn {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newChecklistItemType, setNewChecklistItemType] = useState<SystemPointKey>("none");

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    const canEdit =
      selectedPlanningUserId === user?.id ||
      collaborators.some(
        (c) =>
          c.event_planning_id === selectedPlanningId &&
          c.user_id === user?.id &&
          c.can_edit,
      );
    if (!canEdit) {
      toast({ title: "Keine Berechtigung", description: "Sie haben keine Bearbeitungsrechte für diese Checkliste.", variant: "destructive" });
      return;
    }

    const previousItems = [...checklistItems];
    const newCompletedState = !isCompleted;
    setChecklistItems(prev => prev.map(item => item.id === itemId ? { ...item, is_completed: newCompletedState } : item));

    try {
      const { error } = await supabase.from("event_planning_checklist_items").update({ is_completed: newCompletedState }).eq("id", itemId);
      if (error) {
        const isNetworkError = error.message?.includes("Failed to fetch") || error.message?.includes("NetworkError") || error.message?.includes("TypeError");
        if (isNetworkError) {
          debugConsole.warn("Network interruption detected, verifying server state...", error);
          setTimeout(async () => {
            if (selectedPlanningId) {
const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("id, event_planning_id, title, is_completed, order_index, sub_items, assigned_to, due_date, category, notes, is_system_item, system_type, created_at, color, type, relative_due_days").eq("event_planning_id", selectedPlanningId).order("order_index", { ascending: true });
               if (freshItems) setChecklistItems(freshItems.map(item: Record<string, any> => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })) as ChecklistItem[]);
             }
           }, 500);
           return;
         }
         debugConsole.error("Checklist update error:", error);
         setChecklistItems(previousItems);
         toast({ title: "Fehler", description: "Checkliste konnte nicht aktualisiert werden.", variant: "destructive" });
         return;
       }

       const emailAction = itemEmailActions[itemId];
       if (newCompletedState && emailAction?.is_enabled) {
         try {
           const { data: { session } } = await supabase.auth.getSession();
           if (session) {
             await supabase.functions.invoke("send-checklist-email", { body: { actionId: emailAction.id, checklistItemId: itemId } });
             toast({ title: "E-Mail versendet", description: "Benachrichtigung wurde automatisch versendet." });
           }
         } catch (emailError) { debugConsole.error("Error sending email:", emailError); }
       }
     } catch (fetchError) {
       debugConsole.warn("Network error during checklist update, verifying state...", fetchError);
       setTimeout(async () => {
         if (selectedPlanningId) {
           const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("id, event_planning_id, title, is_completed, order_index, sub_items, assigned_to, due_date, category, notes, is_system_item, system_type, created_at, color, type, relative_due_days").eq("event_planning_id", selectedPlanningId).order("order_index", { ascending: true });
          if (freshItems) setChecklistItems(freshItems.map(item: Record<string, any> => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })) as ChecklistItem[]);
        }
      }, 500);
    }
  };

  const updateChecklistItemTitle = async (itemId: string, title: string) => {
    const { error } = await supabase.from("event_planning_checklist_items").update({ title }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Checkliste konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, title } : item));
  };

  const updateChecklistItemColor = async (itemId: string, color: string) => {
    const { error } = await supabase.from("event_planning_checklist_items").update({ color }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Farbe konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, color } : item));
  };

  const addChecklistItem = async () => {
    if (!selectedPlanningId) return;

    const selectedSystemPoint = SYSTEM_POINT_OPTIONS[newChecklistItemType];
    const rawTitle = newChecklistItem.trim();
    const isSeparator = newChecklistItemType === "none" && rawTitle.startsWith("---");
    const itemType = selectedSystemPoint.type === "item"
      ? (isSeparator ? "separator" : "item")
      : selectedSystemPoint.type;
    const title = itemType === "separator"
      ? rawTitle.replace(/^---\s*/, "")
      : (selectedSystemPoint.title || rawTitle);

    if (!title) return;

    const maxOrder = Math.max(...checklistItems.map(item => item.order_index), -1);

    const itemId = crypto.randomUUID();

    const { error } = await supabase
      .from("event_planning_checklist_items")
      .insert([{ id: itemId, event_planning_id: selectedPlanningId, title, order_index: maxOrder + 1, type: itemType, relative_due_days: null }]);
    if (error) {
      toast({ title: "Fehler", description: "Checklisten-Punkt konnte nicht hinzugefügt werden.", variant: "destructive" });
      return;
    }

    // Build a data object from the known values (no .select().single() needed)
    const data = { id: itemId, event_planning_id: selectedPlanningId, title, order_index: maxOrder + 1, type: itemType, relative_due_days: null, is_completed: false, sub_items: [] as ChecklistSubItem[] };

    if (itemType === "system_social_media" || itemType === "system_rsvp") {
      if (!currentTenantId || !currentProfileId) {
        await supabase.from("event_planning_checklist_items").delete().eq("id", itemId);
        toast({ title: "Fehler", description: "Systempunkt konnte ohne Tenant-/Profilkontext nicht angelegt werden.", variant: "destructive" });
        return;
      }

      if (itemType === "system_social_media") {
        const topicId = crypto.randomUUID();
        const plannerItemId = crypto.randomUUID();

        try {
          const topicTitle = `${title}: ${selectedPlanningTitle || "Veranstaltung"}`;

          const { error: topicError } = await supabase.from("topic_backlog").insert({
            id: topicId,
            tenant_id: currentTenantId,
            created_by: currentProfileId,
            topic: topicTitle,
            tags: ["eventplanung", "social-media"],
            priority: 1,
            status: "idea",
            short_description: selectedPlanningTitle ? `Automatisch aus Veranstaltungsplanung "${selectedPlanningTitle}" angelegt.` : "Automatisch aus der Veranstaltungsplanung angelegt.",
          } as Record<string, unknown>);
          if (topicError) throw topicError;

          const { error: plannerError } = await supabase.from("social_content_items").insert({
            id: plannerItemId,
            tenant_id: currentTenantId,
            created_by: currentProfileId,
            topic_backlog_id: topicId,
            workflow_status: "idea",
            approval_state: "draft",
            format: "Social Media",
            notes: selectedPlanningTitle ? `Automatisch aus Veranstaltungsplanung "${selectedPlanningTitle}" angelegt.` : "Automatisch aus der Veranstaltungsplanung angelegt.",
            scheduled_for: selectedPlanningConfirmedDate || null,
          } as Record<string, unknown>);
          if (plannerError) throw plannerError;

          const plannerUrl = `/mywork?tab=redaktion&highlight=${plannerItemId}`;
          const { data: createdAction, error: actionError } = await supabase
            .from("event_planning_item_actions")
            .insert({
              checklist_item_id: itemId,
              action_type: "social_planner",
              is_enabled: true,
              action_config: {
                system_point: "social_media",
                planner_item_id: plannerItemId,
                topic_backlog_id: topicId,
                planner_url: plannerUrl,
                label: "Im Social Planner öffnen",
              },
            })
            .select()
            .single();
          if (actionError) throw actionError;

          onSocialPlannerActionCreated?.(itemId, createdAction);
          toast({ title: "Systempunkt angelegt", description: "Social-Media-Punkt wurde erstellt und mit dem Social Planner verknüpft." });
        } catch (systemPointError: unknown) {
          logChecklistOperationEvent({ type: "system-point-create-failed", systemPoint: "social_media", error: systemPointError });
          // Rollback all created resources using pre-generated IDs
          await Promise.allSettled([
            supabase.from("event_planning_checklist_items").delete().eq("id", itemId),
            supabase.from("social_content_items").delete().eq("id", plannerItemId),
            supabase.from("topic_backlog").delete().eq("id", topicId),
          ]);
          const errMsg = getErrorMessage(systemPointError);
          toast({ title: "Fehler", description: `Social-Media-Systempunkt konnte nicht angelegt werden: ${errMsg}`, variant: "destructive" });
          return;
        }
      }

      if (itemType === "system_rsvp") {
        try {
          // Check if RSVP guests exist for this event planning
          const { data: rsvpGuests } = await supabase
            .from("event_rsvps")
            .select("id, status, invitation_sent, invited_at")
            .eq("event_planning_id", selectedPlanningId)
            .limit(100);

          const guestCount = rsvpGuests?.length || 0;
          const sentCount = rsvpGuests?.filter((g: Record<string, any>) => g.invitation_sent)?.length || 0;

          const rsvpUrl = `/eventplanning/${selectedPlanningId}#rsvp-manager`;
          const { data: createdAction, error: actionError } = await supabase
            .from("event_planning_item_actions")
            .insert({
              checklist_item_id: itemId,
              action_type: "rsvp",
              is_enabled: true,
              action_config: {
                system_point: "rsvp",
                event_planning_id: selectedPlanningId,
                rsvp_url: rsvpUrl,
                label: "Einladungen verwalten",
                guest_count: guestCount,
                sent_count: sentCount,
              },
            })
            .select()
            .single();
          if (actionError) throw actionError;

          onSocialPlannerActionCreated?.(itemId, createdAction);

          // If invitations were already sent, create a timeline assignment
          if (sentCount > 0) {
            const earliestSent = rsvpGuests
              ?.filter((g: Record<string, any>) => g.invitation_sent && g.invited_at)
              ?.sort((a: Record<string, any>, b: Record<string, any>) => new Date(a.invited_at).getTime() - new Date(b.invited_at).getTime())?.[0];

            if (earliestSent) {
              await supabase.from("event_planning_timeline_assignments").insert({
                event_planning_id: selectedPlanningId,
                checklist_item_id: itemId,
                due_date: earliestSent.invited_at.split("T")[0],
                notes: `${sentCount} Einladung(en) versandt`,
              } as Record<string, unknown>);
            }
          }

          toast({
            title: "Systempunkt angelegt",
            description: guestCount > 0
              ? `RSVP-Punkt erstellt (${guestCount} Gäste, ${sentCount} eingeladen).`
              : "RSVP-Punkt erstellt. Fügen Sie Gäste im RSVP-Manager hinzu.",
          });
        } catch (rsvpError: unknown) {
          logChecklistOperationEvent({ type: "system-point-create-failed", systemPoint: "rsvp", error: rsvpError });
          await supabase.from("event_planning_checklist_items").delete().eq("id", itemId);
          const errMsg = getErrorMessage(rsvpError);
          toast({ title: "Fehler", description: `RSVP-Systempunkt konnte nicht angelegt werden: ${errMsg}`, variant: "destructive" });
          return;
        }
      }
    }

    const transformedData: ChecklistItem = { ...data, sub_items: Array.isArray(data.sub_items) ? (data.sub_items as ChecklistSubItem[]) : (data.sub_items ? (JSON.parse(data.sub_items as string) as ChecklistSubItem[]) : []) };
    setChecklistItems((prev) => {
      const nextItems = [...prev.filter((item) => item.id !== transformedData.id), transformedData];
      return nextItems.sort((a, b) => a.order_index - b.order_index);
    });
    setNewChecklistItem("");
    setNewChecklistItemType("none");

    try {
      await onRefreshDetails(selectedPlanningId);
    } catch (refreshError: unknown) {
      logChecklistOperationEvent({ type: "checklist-refresh-failed", error: refreshError });
    }
  };

  const deleteChecklistItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("event_planning_checklist_items").delete().eq("id", itemId);
      if (error) throw error;
      setChecklistItems(items => items.filter(item => item.id !== itemId));
      toast({ title: "Erfolg", description: "Checklisten-Punkt wurde gelöscht." });
    } catch (error: unknown) {
      logChecklistOperationEvent({ type: "delete-checklist-item-failed", error });
      toast({ title: "Fehler", description: "Checklisten-Punkt konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const addSubItem = async (itemId: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem) return;
    const currentSubItems = currentItem.sub_items || [];
    const newSubItems = [...currentSubItems, { title: '', is_completed: false }];
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: newSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht hinzugefügt werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: newSubItems } : item));
  };

  const toggleSubItem = async (itemId: string, subItemIndex: number, isCompleted: boolean) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.map((subItem: ChecklistSubItem, index: number) => index === subItemIndex ? { ...subItem, is_completed: !isCompleted } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const updateSubItemTitle = async (itemId: string, subItemIndex: number, title: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.map((subItem: ChecklistSubItem, index: number) => index === subItemIndex ? { ...subItem, title } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const removeSubItem = async (itemId: string, subItemIndex: number) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.filter((_: ChecklistSubItem, index: number) => index !== subItemIndex);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht entfernt werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(checklistItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setChecklistItems(items);
    const updates = items.map((item, index) => ({ id: item.id, order_index: index }));
    try {
      for (const update of updates) {
        await supabase.from("event_planning_checklist_items").update({ order_index: update.order_index }).eq("id", update.id);
      }
    } catch (error: unknown) {
      logChecklistOperationEvent({ type: "reorder-checklist-item-failed", error });
      toast({ title: "Fehler", description: "Reihenfolge konnte nicht gespeichert werden.", variant: "destructive" });
      if (selectedPlanningId) onRefreshDetails(selectedPlanningId);
    }
  };

  return {
    checklistItems,
    setChecklistItems,
    newChecklistItem,
    setNewChecklistItem,
    newChecklistItemType,
    setNewChecklistItemType,
    toggleChecklistItem,
    updateChecklistItemTitle,
    updateChecklistItemColor,
    addChecklistItem,
    deleteChecklistItem,
    addSubItem,
    toggleSubItem,
    updateSubItemTitle,
    removeSubItem,
    onDragEnd,
  };
}
