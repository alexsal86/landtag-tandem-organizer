import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { DropResult } from "@hello-pangea/dnd";
import type { ChecklistItem } from "../types";

const SYSTEM_POINT_OPTIONS = {
  none: { title: "", type: "item" },
  social_media: { title: "Social Media", type: "system_social_media" },
} as const;

type SystemPointKey = keyof typeof SYSTEM_POINT_OPTIONS;

interface UseChecklistOperationsParams {
  user: { id: string } | null;
  selectedPlanningId: string | undefined;
  collaborators: Array<{ event_planning_id: string; user_id: string; can_edit: boolean }>;
  selectedPlanningUserId: string | undefined;
  itemEmailActions: Record<string, any>;
  currentTenantId?: string;
  currentProfileId?: string | null;
  selectedPlanningTitle?: string;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  onRefreshDetails: (planningId: string) => Promise<void>;
}

export function useChecklistOperations({
  user,
  selectedPlanningId,
  collaborators,
  selectedPlanningUserId,
  itemEmailActions,
  currentTenantId,
  currentProfileId,
  selectedPlanningTitle,
  toast,
  onRefreshDetails,
}: UseChecklistOperationsParams) {
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
              const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("*").eq("event_planning_id", selectedPlanningId).order("order_index", { ascending: true });
              if (freshItems) setChecklistItems(freshItems.map(item => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })) as ChecklistItem[]);
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
          const { data: freshItems } = await supabase.from("event_planning_checklist_items").select("*").eq("event_planning_id", selectedPlanningId).order("order_index", { ascending: true });
          if (freshItems) setChecklistItems(freshItems.map(item => ({ ...item, sub_items: (item.sub_items || []) as { title: string; is_completed: boolean }[] })) as ChecklistItem[]);
        }
      }, 500);
    }
  };

  const updateChecklistItemTitle = async (itemId: string, title: string) => {
    const { error } = await supabase.from("event_planning_checklist_items").update({ title }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Checkliste konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, title } : item));
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

    const { data, error } = await supabase
      .from("event_planning_checklist_items")
      .insert([{ event_planning_id: selectedPlanningId, title, order_index: maxOrder + 1, type: itemType }])
      .select()
      .single();
    if (error) {
      toast({ title: "Fehler", description: "Checklisten-Punkt konnte nicht hinzugefügt werden.", variant: "destructive" });
      return;
    }

    if (itemType === "system_social_media") {
      if (!currentTenantId || !currentProfileId) {
        await supabase.from("event_planning_checklist_items").delete().eq("id", data.id);
        toast({ title: "Fehler", description: "Systempunkt konnte ohne Tenant-/Profilkontext nicht angelegt werden.", variant: "destructive" });
        return;
      }

      try {
        const topicId = crypto.randomUUID();
        const plannerItemId = crypto.randomUUID();
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
        } as any);
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
        } as any);
        if (plannerError) throw plannerError;

        const plannerUrl = `/my-work?tab=redaktion&highlight=${plannerItemId}`;
        const { error: actionError } = await supabase.from("event_planning_item_actions").insert({
          checklist_item_id: data.id,
          action_type: "social_planner",
          is_enabled: true,
          action_config: {
            system_point: "social_media",
            planner_item_id: plannerItemId,
            topic_backlog_id: topicId,
            planner_url: plannerUrl,
            label: "Im Social Planner öffnen",
          },
        });
        if (actionError) throw actionError;

        toast({ title: "Systempunkt angelegt", description: "Social-Media-Punkt wurde erstellt und mit dem Social Planner verknüpft." });
      } catch (systemPointError) {
        debugConsole.error("Error creating social media system point:", systemPointError);
        await supabase.from("event_planning_checklist_items").delete().eq("id", data.id);
        toast({ title: "Fehler", description: "Systempunkt konnte nicht vollständig angelegt werden.", variant: "destructive" });
        return;
      }
    }

    const transformedData: ChecklistItem = { ...data, sub_items: Array.isArray(data.sub_items) ? data.sub_items as any : (data.sub_items ? JSON.parse(data.sub_items as string) : []) };
    setChecklistItems([...checklistItems, transformedData]);
    setNewChecklistItem("");
    setNewChecklistItemType("none");
    await onRefreshDetails(selectedPlanningId);
  };

  const deleteChecklistItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from("event_planning_checklist_items").delete().eq("id", itemId);
      if (error) throw error;
      setChecklistItems(items => items.filter(item => item.id !== itemId));
      toast({ title: "Erfolg", description: "Checklisten-Punkt wurde gelöscht." });
    } catch (error) {
      debugConsole.error('Error deleting checklist item:', error);
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
    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) => index === subItemIndex ? { ...subItem, is_completed: !isCompleted } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const updateSubItemTitle = async (itemId: string, subItemIndex: number, title: string) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.map((subItem: any, index: number) => index === subItemIndex ? { ...subItem, title } : subItem);
    const { error } = await supabase.from("event_planning_checklist_items").update({ sub_items: updatedSubItems }).eq("id", itemId);
    if (error) { toast({ title: "Fehler", description: "Unterpunkt konnte nicht aktualisiert werden.", variant: "destructive" }); return; }
    setChecklistItems(items => items.map(item => item.id === itemId ? { ...item, sub_items: updatedSubItems } : item));
  };

  const removeSubItem = async (itemId: string, subItemIndex: number) => {
    const currentItem = checklistItems.find(item => item.id === itemId);
    if (!currentItem || !currentItem.sub_items) return;
    const updatedSubItems = currentItem.sub_items.filter((_: any, index: number) => index !== subItemIndex);
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
    } catch (error) {
      debugConsole.error('Error updating item order:', error);
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
    addChecklistItem,
    deleteChecklistItem,
    addSubItem,
    toggleSubItem,
    updateSubItemTitle,
    removeSubItem,
    onDragEnd,
  };
}
