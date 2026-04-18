import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

export type PlannerWorkflowStatus = "ideas" | "in_progress" | "in_review" | "approved" | "scheduled" | "published";

export interface SocialPlannerItem {
  id: string;
  topic_backlog_id: string;
  topic: string;
  tags: string[];
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  content_pillar: string | null;
  workflow_status: PlannerWorkflowStatus;
  approval_state: string;
  channel_ids: string[];
  channel_names: string[];
  channel_slugs: string[];
  image_url: string | null;
  format: string | null;
  content_goal: string | null;
  format_variant: string | null;
  asset_requirements: string[];
  approval_required: boolean;
  publish_link: string | null;
  performance_notes: string | null;
  hook: string | null;
  core_message: string | null;
  draft_text: string | null;
  cta: string | null;
  notes: string | null;
  responsible_user_id: string | null;
  scheduled_for: string | null;
  hashtags: string[];
  hashtags_in_comment: boolean;
  alt_text: string | null;
  variants: Record<string, SocialContentVariant>;
  appointment_id: string | null;
  published_at: string | null;
  reminder_sent_at: string | null;
}

export interface PlannerChannel {
  id: string;
  name: string;
  slug: string;
}

export type SocialContentMediaType = "image" | "video" | "carousel" | "link" | "text";
export type SocialContentPlatformStatus = "draft" | "ready" | "scheduled" | "published" | "failed";

export interface SocialContentVariant {
  id?: string;
  content_item_id?: string;
  channel_id: string;
  caption: string;
  first_comment: string;
  media_type: SocialContentMediaType | "";
  asset_ids: string[];
  platform_metadata: Record<string, unknown>;
  platform_status: SocialContentPlatformStatus;
  publish_link?: string | null;
  published_at?: string | null;
}

// DB workflow_status values: idea, draft, approval, scheduled, published
// UI workflow_status values: ideas, in_progress, in_review, approved, scheduled, published
const STATUS_FROM_DB: Record<string, PlannerWorkflowStatus> = {
  idea: "ideas",
  draft: "in_progress",
  approval: "in_review", // default; refined by approval_state below
  scheduled: "scheduled",
  published: "published",
};

const STATUS_TO_DB: Record<PlannerWorkflowStatus, string> = {
  ideas: "idea",
  in_progress: "draft",
  in_review: "approval",
  approved: "approval",
  scheduled: "scheduled",
  published: "published",
};

// DB approval_state values: draft, pending_approval, approved, rejected
const APPROVAL_TO_DB: Record<PlannerWorkflowStatus, string | undefined> = {
  ideas: undefined,
  in_progress: undefined,
  in_review: "pending_approval",
  approved: "approved",
  scheduled: undefined,
  published: undefined,
};

function deriveUiStatus(dbWorkflowStatus: string, dbApprovalState: string): PlannerWorkflowStatus {
  if (dbWorkflowStatus === "approval" && dbApprovalState === "approved") return "approved";
  return STATUS_FROM_DB[dbWorkflowStatus] || "ideas";
}

export function useSocialPlannerItems() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
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

      const [
        { data: itemRows, error: itemError },
        { data: channelRows, error: channelError },
        { data: variantRows, error: variantError },
      ] = await Promise.all([
        supabase
          .from("social_content_items")
          .select(`
            id,
            topic_backlog_id,
            workflow_status,
            approval_state,
            format,
            content_goal,
            format_variant,
            asset_requirements,
            approval_required,
            publish_link,
            performance_notes,
            hook,
            core_message,
            draft_text,
            cta,
            notes,
            responsible_user_id,
            scheduled_for,
            hashtags,
            hashtags_in_comment,
            alt_text,
            image_url,
            campaign_id,
            content_pillar,
            social_campaigns:campaign_id(name, start_date, end_date),
            topic_backlog:topic_backlog_id(topic, tags, campaign_id, content_pillar),
            social_content_item_channels(channel_id, social_content_channels(name, slug))
          `)
          .eq("tenant_id", currentTenant.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("social_content_channels")
          .select("id, name, slug")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("social_content_variants")
          .select("id, content_item_id, channel_id, caption, first_comment, media_type, asset_ids, platform_metadata, platform_status")
          .eq("tenant_id", currentTenant.id),
      ]);

      if (itemError) throw itemError;
      if (channelError) throw channelError;
      if (variantError) throw variantError;

      setChannels((channelRows || []) as PlannerChannel[]);
      const groupedVariants = new Map<string, Record<string, SocialContentVariant>>();
      ((variantRows || []) as Array<{
        id: string;
        content_item_id: string;
        channel_id: string;
        caption: string | null;
        first_comment: string | null;
        media_type: SocialContentMediaType | null;
        asset_ids: string[] | null;
        platform_metadata: Record<string, unknown> | null;
        platform_status: SocialContentPlatformStatus | null;
      }>).forEach((variant) => {
        const byChannel = groupedVariants.get(variant.content_item_id) || {};
        byChannel[variant.channel_id] = {
          id: variant.id,
          content_item_id: variant.content_item_id,
          channel_id: variant.channel_id,
          caption: variant.caption || "",
          first_comment: variant.first_comment || "",
          media_type: variant.media_type || "",
          asset_ids: variant.asset_ids || [],
          platform_metadata: variant.platform_metadata || {},
          platform_status: variant.platform_status || "draft",
        };
        groupedVariants.set(variant.content_item_id, byChannel);
      });

      setItems(
        (itemRows || []).map((row) => {
          const channelLinks = (row.social_content_item_channels || []) as Array<{
            channel_id: string;
            social_content_channels: { name: string; slug: string } | null;
          }>;

          const topicData = row.topic_backlog as { topic: string; tags: string[] | null; campaign_id?: string | null; content_pillar?: string | null } | null;
          const campaignData = row.social_campaigns as { name: string; start_date: string | null; end_date: string | null } | null;

          return {
            id: row.id,
            topic_backlog_id: row.topic_backlog_id,
            topic: topicData?.topic || "Ohne Thema",
            tags: topicData?.tags || [],
            campaign_id: row.campaign_id || topicData?.campaign_id || null,
            campaign_name: campaignData?.name || null,
            campaign_start_date: campaignData?.start_date || null,
            campaign_end_date: campaignData?.end_date || null,
            content_pillar: row.content_pillar || topicData?.content_pillar || null,
            workflow_status: deriveUiStatus(row.workflow_status, row.approval_state),
            approval_state: row.approval_state || "draft",
            format: row.format,
            content_goal: row.content_goal,
            format_variant: row.format_variant,
            asset_requirements: row.asset_requirements || [],
            approval_required: row.approval_required ?? true,
            publish_link: row.publish_link,
            performance_notes: row.performance_notes,
            hook: row.hook,
            core_message: row.core_message,
            draft_text: row.draft_text,
            cta: row.cta,
            notes: row.notes,
            responsible_user_id: row.responsible_user_id,
            scheduled_for: row.scheduled_for,
            hashtags: row.hashtags || [],
            hashtags_in_comment: row.hashtags_in_comment ?? false,
            alt_text: row.alt_text,
            channel_ids: channelLinks.map((entry) => entry.channel_id),
            channel_names: channelLinks.map((entry) => entry.social_content_channels?.name || "Unbekannter Kanal"),
            channel_slugs: channelLinks.map((entry) => entry.social_content_channels?.slug || ""),
            image_url: row.image_url || null,
            variants: groupedVariants.get(row.id) || {},
          };
        }),
      );
    } catch (error) {
      console.error("Error loading social planner items:", getErrorMessage(error), error);
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
      content_goal?: string | null;
      format_variant?: string | null;
      asset_requirements?: string[];
      approval_required?: boolean;
      publish_link?: string | null;
      performance_notes?: string | null;
      hook?: string | null;
      core_message?: string | null;
      draft_text?: string | null;
      notes?: string | null;
      cta?: string | null;
      variants?: SocialContentVariant[];
      campaign_id?: string | null;
      content_pillar?: string | null;
    }) => {
      if (!user?.id || !currentTenant?.id || !profileId) return null;

      const uiStatus = payload.workflow_status || "ideas";
      const id = crypto.randomUUID();
      const { error } = await supabase
        .from("social_content_items")
        .insert({
          id,
          tenant_id: currentTenant.id,
          created_by: profileId,
          topic_backlog_id: payload.topic_backlog_id,
          workflow_status: STATUS_TO_DB[uiStatus],
          approval_state: APPROVAL_TO_DB[uiStatus] || payload.approval_state || "draft",
          format: payload.format || null,
          content_goal: payload.content_goal || null,
          format_variant: payload.format_variant || payload.format || null,
          asset_requirements: payload.asset_requirements || [],
          approval_required: payload.approval_required ?? true,
          publish_link: payload.publish_link || null,
          performance_notes: payload.performance_notes || null,
          responsible_user_id: payload.responsible_user_id || null,
          scheduled_for: payload.scheduled_for || null,
          hook: payload.hook || null,
          core_message: payload.core_message || null,
          draft_text: payload.draft_text || null,
          notes: payload.notes || null,
          cta: payload.cta || null,
          campaign_id: payload.campaign_id || null,
          content_pillar: payload.content_pillar || null,
        });

      if (error) {
        console.error("createItem failed:", getErrorMessage(error), error);
        throw new Error(getErrorMessage(error));
      }

      if (payload.channel_ids?.length) {
        const { error: channelInsertError } = await supabase.from("social_content_item_channels").insert(
          payload.channel_ids.map((channelId, index) => ({
            content_item_id: id,
            channel_id: channelId,
            created_by: profileId,
            tenant_id: currentTenant.id,
            is_primary: index === 0,
          })),
        );

        if (channelInsertError) {
          console.error("Channel link failed:", getErrorMessage(channelInsertError), channelInsertError);
          throw new Error(getErrorMessage(channelInsertError));
        }
      }

      if (payload.variants?.length) {
        const { error: variantError } = await supabase.from("social_content_variants").insert(
          payload.variants.map((variant) => ({
            id: variant.id,
            content_item_id: id,
            channel_id: variant.channel_id,
            tenant_id: currentTenant.id,
            created_by: profileId,
            caption: variant.caption || null,
            first_comment: variant.first_comment || null,
            media_type: variant.media_type || null,
            asset_ids: variant.asset_ids || [],
            platform_metadata: variant.platform_metadata || {},
            platform_status: variant.platform_status || "draft",
          })),
        );
        if (variantError) throw new Error(getErrorMessage(variantError));
      }

      await loadItems();
      return { id };
    },
    [currentTenant?.id, loadItems, user?.id, profileId],
  );

  const updateItem = useCallback(async (
    id: string,
    patch: Partial<Pick<SocialPlannerItem, "topic" | "tags" | "workflow_status" | "approval_state" | "responsible_user_id" | "format" | "content_goal" | "format_variant" | "asset_requirements" | "approval_required" | "publish_link" | "performance_notes" | "scheduled_for" | "hook" | "core_message" | "draft_text" | "cta" | "notes" | "channel_ids" | "hashtags" | "hashtags_in_comment" | "alt_text" | "image_url" | "variants" | "campaign_id" | "content_pillar">>,
  ) => {
    if (!currentTenant?.id) return;

    const dbPatch: Record<string, string | string[] | boolean | null> = {};

    if (patch.workflow_status) {
      dbPatch.workflow_status = STATUS_TO_DB[patch.workflow_status];
      const approvalForStatus = APPROVAL_TO_DB[patch.workflow_status];
      if (approvalForStatus) dbPatch.approval_state = approvalForStatus;
    }
    if (typeof patch.approval_state !== "undefined") dbPatch.approval_state = patch.approval_state;
    if (typeof patch.responsible_user_id !== "undefined") dbPatch.responsible_user_id = patch.responsible_user_id;
    if (typeof patch.format !== "undefined") dbPatch.format = patch.format;
    if (typeof patch.content_goal !== "undefined") dbPatch.content_goal = patch.content_goal;
    if (typeof patch.format_variant !== "undefined") dbPatch.format_variant = patch.format_variant;
    if (typeof patch.asset_requirements !== "undefined") dbPatch.asset_requirements = patch.asset_requirements;
    if (typeof patch.approval_required !== "undefined") dbPatch.approval_required = patch.approval_required;
    if (typeof patch.publish_link !== "undefined") dbPatch.publish_link = patch.publish_link;
    if (typeof patch.performance_notes !== "undefined") dbPatch.performance_notes = patch.performance_notes;
    if (typeof patch.scheduled_for !== "undefined") dbPatch.scheduled_for = patch.scheduled_for;
    if (typeof patch.hook !== "undefined") dbPatch.hook = patch.hook;
    if (typeof patch.core_message !== "undefined") dbPatch.core_message = patch.core_message;
    if (typeof patch.draft_text !== "undefined") dbPatch.draft_text = patch.draft_text;
    if (typeof patch.cta !== "undefined") dbPatch.cta = patch.cta;
    if (typeof patch.notes !== "undefined") dbPatch.notes = patch.notes;
    if (typeof patch.hashtags !== "undefined") dbPatch.hashtags = patch.hashtags;
    if (typeof patch.hashtags_in_comment !== "undefined") dbPatch.hashtags_in_comment = patch.hashtags_in_comment;
    if (typeof patch.alt_text !== "undefined") dbPatch.alt_text = patch.alt_text;
    if (typeof patch.image_url !== "undefined") dbPatch.image_url = patch.image_url;
    if (typeof patch.campaign_id !== "undefined") dbPatch.campaign_id = patch.campaign_id;
    if (typeof patch.content_pillar !== "undefined") dbPatch.content_pillar = patch.content_pillar;

    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase
        .from("social_content_items")
        .update(dbPatch)
        .eq("id", id)
        .eq("tenant_id", currentTenant.id);
      if (error) throw new Error(getErrorMessage(error));
    }

    const currentItem = items.find((item) => item.id === id);
    if (typeof patch.topic !== "undefined" && patch.topic.trim() && currentItem?.topic_backlog_id) {
      const { error: topicError } = await supabase
        .from("topic_backlog")
        .update({ topic: patch.topic.trim() })
        .eq("id", currentItem.topic_backlog_id)
        .eq("tenant_id", currentTenant.id);
      if (topicError) throw new Error(getErrorMessage(topicError));
    }

    if (typeof patch.tags !== "undefined" && currentItem?.topic_backlog_id) {
      const { error: tagsError } = await supabase
        .from("topic_backlog")
        .update({ tags: patch.tags })
        .eq("id", currentItem.topic_backlog_id)
        .eq("tenant_id", currentTenant.id);
      if (tagsError) throw new Error(getErrorMessage(tagsError));
    }

    if (typeof patch.channel_ids !== "undefined") {
      if (!user?.id || !profileId) return;

      const { error: deleteError } = await supabase
        .from("social_content_item_channels")
        .delete()
        .eq("content_item_id", id)
        .eq("tenant_id", currentTenant.id);

      if (deleteError) throw new Error(getErrorMessage(deleteError));

      if (patch.channel_ids.length > 0) {
        const { error: channelError } = await supabase.from("social_content_item_channels").insert(
          patch.channel_ids.map((channelId, index) => ({
            content_item_id: id,
            channel_id: channelId,
            created_by: profileId,
            tenant_id: currentTenant.id,
            is_primary: index === 0,
          })),
        );

        if (channelError) throw new Error(getErrorMessage(channelError));
      }
    }

    if (typeof patch.variants !== "undefined") {
      if (!user?.id || !profileId) return;
      const variants = Object.values(patch.variants);
      const { error: clearError } = await supabase
        .from("social_content_variants")
        .delete()
        .eq("content_item_id", id)
        .eq("tenant_id", currentTenant.id);
      if (clearError) throw new Error(getErrorMessage(clearError));

      if (variants.length > 0) {
        const { error: upsertError } = await supabase.from("social_content_variants").upsert(
          variants.map((variant) => ({
            id: variant.id,
            content_item_id: id,
            channel_id: variant.channel_id,
            tenant_id: currentTenant.id,
            created_by: profileId,
            caption: variant.caption || null,
            first_comment: variant.first_comment || null,
            media_type: variant.media_type || null,
            asset_ids: variant.asset_ids || [],
            platform_metadata: variant.platform_metadata || {},
            platform_status: variant.platform_status || "draft",
          })),
          { onConflict: "content_item_id,channel_id" },
        );
        if (upsertError) throw new Error(getErrorMessage(upsertError));
      }
    }

    await loadItems();
  }, [currentTenant?.id, items, loadItems, profileId, user?.id]);

  const updateItemChannels = useCallback(
    async (id: string, channelIds: string[]) => {
      if (!user?.id || !currentTenant?.id || !profileId) return;

      const { error: deleteError } = await supabase
        .from("social_content_item_channels")
        .delete()
        .eq("content_item_id", id)
        .eq("tenant_id", currentTenant.id);

      if (deleteError) throw new Error(getErrorMessage(deleteError));

      if (channelIds.length === 0) {
        await loadItems();
        return;
      }

      const { error } = await supabase.from("social_content_item_channels").insert(
        channelIds.map((channelId, index) => ({
          content_item_id: id,
          channel_id: channelId,
          created_by: profileId,
          tenant_id: currentTenant.id,
          is_primary: index === 0,
        })),
      );

      if (error) throw new Error(getErrorMessage(error));
      await loadItems();
    },
    [currentTenant?.id, loadItems, user?.id, profileId],
  );

  const deleteItem = useCallback(async (id: string) => {
    if (!currentTenant?.id) return;

    const { error } = await supabase
      .from("social_content_items")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);
    if (error) throw new Error(getErrorMessage(error));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_variants", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
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
