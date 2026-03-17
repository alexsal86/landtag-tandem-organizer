import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";

export type PlannerWorkflowStatus = "ideas" | "in_progress" | "in_review" | "approved" | "scheduled" | "published";

export interface SocialPlannerItem {
  id: string;
  topic_backlog_id: string;
  topic: string;
  tags: string[];
  workflow_status: PlannerWorkflowStatus;
  approval_state: string;
  channel_ids: string[];
  channel_names: string[];
  format: string | null;
  responsible_user_id: string | null;
  scheduled_for: string | null;
}

export interface PlannerChannel {
  id: string;
  name: string;
  slug: string;
}

const STATUS_MAP: Record<string, PlannerWorkflowStatus> = {
  idea: "ideas",
  ideas: "ideas",
  draft: "in_progress",
  in_progress: "in_progress",
  in_review: "in_review",
  review: "in_review",
  approved: "approved",
  scheduled: "scheduled",
  published: "published",
};

const STATUS_TO_DB: Record<PlannerWorkflowStatus, string> = {
  ideas: "idea",
  in_progress: "in_progress",
  in_review: "in_review",
  approved: "approved",
  scheduled: "scheduled",
  published: "published",
};

export function useSocialPlannerItems() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [items, setItems] = useState<SocialPlannerItem[]>([]);
  const [channels, setChannels] = useState<PlannerChannel[]>([]);
  const [loading, setLoading] = useState(false);

  const loadItems = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setItems([]);
      setChannels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: itemRows, error: itemError }, { data: channelRows, error: channelError }] = await Promise.all([
        supabase
          .from("social_content_items")
          .select(`
            id,
            topic_backlog_id,
            workflow_status,
            approval_state,
            format,
            responsible_user_id,
            scheduled_for,
            topic_backlog:topic_backlog_id(topic, tags),
            social_content_item_channels(channel_id, social_content_channels(name))
          `)
          .eq("tenant_id", currentTenant.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("social_content_channels")
          .select("id, name, slug")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (itemError) throw itemError;
      if (channelError) throw channelError;

      setChannels((channelRows || []) as PlannerChannel[]);

      setItems(
        (itemRows || []).map((row) => {
          const channelLinks = (row.social_content_item_channels || []) as Array<{
            channel_id: string;
            social_content_channels: { name: string } | null;
          }>;

          const topicData = row.topic_backlog as { topic: string; tags: string[] | null } | null;

          return {
            id: row.id,
            topic_backlog_id: row.topic_backlog_id,
            topic: topicData?.topic || "Ohne Thema",
            tags: topicData?.tags || [],
            workflow_status: STATUS_MAP[row.workflow_status] || "ideas",
            approval_state: row.approval_state || "open",
            format: row.format,
            responsible_user_id: row.responsible_user_id,
            scheduled_for: row.scheduled_for,
            channel_ids: channelLinks.map((entry) => entry.channel_id),
            channel_names: channelLinks.map((entry) => entry.social_content_channels?.name || "Unbekannter Kanal"),
          };
        }),
      );
    } catch (error) {
      debugConsole.error("Error loading social planner items:", error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  const createItem = useCallback(
    async (payload: {
      topic_backlog_id: string;
      workflow_status?: PlannerWorkflowStatus;
      approval_state?: string;
      format?: string | null;
      responsible_user_id?: string | null;
      scheduled_for?: string | null;
      channel_ids?: string[];
      hook?: string | null;
      core_message?: string | null;
      draft_text?: string | null;
      notes?: string | null;
      cta?: string | null;
    }) => {
      if (!user?.id || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("social_content_items")
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          topic_backlog_id: payload.topic_backlog_id,
          workflow_status: STATUS_TO_DB[payload.workflow_status || "ideas"],
          approval_state: payload.approval_state || "open",
          format: payload.format || null,
          responsible_user_id: payload.responsible_user_id || null,
          scheduled_for: payload.scheduled_for || null,
          hook: payload.hook || null,
          core_message: payload.core_message || null,
          draft_text: payload.draft_text || null,
          notes: payload.notes || null,
          cta: payload.cta || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (payload.channel_ids?.length) {
        const { error: channelInsertError } = await supabase.from("social_content_item_channels").insert(
          payload.channel_ids.map((channelId, index) => ({
            content_item_id: data.id,
            channel_id: channelId,
            created_by: user.id,
            tenant_id: currentTenant.id,
            is_primary: index === 0,
          })),
        );

        if (channelInsertError) throw channelInsertError;
      }

      await loadItems();
      return data;
    },
    [currentTenant?.id, loadItems, user?.id],
  );

  const updateItem = useCallback(async (id: string, patch: Partial<Pick<SocialPlannerItem, "workflow_status" | "approval_state" | "responsible_user_id" | "format" | "scheduled_for">>) => {
    if (!currentTenant?.id) return;

    const dbPatch: Record<string, string | null> = {};

    if (patch.workflow_status) dbPatch.workflow_status = STATUS_TO_DB[patch.workflow_status];
    if (typeof patch.approval_state !== "undefined") dbPatch.approval_state = patch.approval_state;
    if (typeof patch.responsible_user_id !== "undefined") dbPatch.responsible_user_id = patch.responsible_user_id;
    if (typeof patch.format !== "undefined") dbPatch.format = patch.format;
    if (typeof patch.scheduled_for !== "undefined") dbPatch.scheduled_for = patch.scheduled_for;

    const { error } = await supabase
      .from("social_content_items")
      .update(dbPatch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) throw error;
  }, [currentTenant?.id]);

  const updateItemChannels = useCallback(
    async (id: string, channelIds: string[]) => {
      if (!user?.id || !currentTenant?.id) return;

      const { error: deleteError } = await supabase
        .from("social_content_item_channels")
        .delete()
        .eq("content_item_id", id)
        .eq("tenant_id", currentTenant.id);

      if (deleteError) throw deleteError;

      if (channelIds.length === 0) {
        await loadItems();
        return;
      }

      const { error } = await supabase.from("social_content_item_channels").insert(
        channelIds.map((channelId, index) => ({
          content_item_id: id,
          channel_id: channelId,
          created_by: user.id,
          tenant_id: currentTenant.id,
          is_primary: index === 0,
        })),
      );

      if (error) throw error;
      await loadItems();
    },
    [currentTenant?.id, loadItems, user?.id],
  );

  const deleteItem = useCallback(async (id: string) => {
    if (!currentTenant?.id) return;

    const { error } = await supabase
      .from("social_content_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) throw error;
    await loadItems();
  }, [currentTenant?.id, loadItems]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!currentTenant?.id) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void loadItems();
      }, 200);
    };

    const channel = supabase
      .channel(`social-planner-${currentTenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_items", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_item_channels", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_channels", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_backlog", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, loadItems]);

  return useMemo(
    () => ({
      items,
      channels,
      loading,
      loadItems,
      createItem,
      updateItem,
      updateItemChannels,
      deleteItem,
    }),
    [items, channels, loading, loadItems, createItem, updateItem, updateItemChannels, deleteItem],
  );
}
