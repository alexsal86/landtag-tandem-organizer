import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

export type TopicEditorialStatus = "idea" | "planning" | "production" | "published" | "repurpose";

export interface TopicBacklogLinkedContent {
  id: string;
  hook: string | null;
  workflow_status: string;
  scheduled_for: string | null;
  responsible_user_id: string | null;
  responsible_person_name: string | null;
  asset_requirements: string[];
  primary_channel_name: string | null;
  channel_names: string[];
  format: string | null;
}

export interface TopicBacklogEntry {
  id: string;
  topic: string;
  tags: string[];
  status: TopicEditorialStatus;
  priority: number;
  owner_id: string | null;
  owner_name: string | null;
  short_description: string | null;
  linked_content_count: number;
  latest_scheduled_for: string | null;
  primary_channel_name: string | null;
  responsible_person_name: string | null;
  open_production_needs: string[];
  linked_content_items: TopicBacklogLinkedContent[];
}

export interface TopicBacklogChannel {
  id: string;
  name: string;
}

const DEFAULT_STATUS: TopicEditorialStatus = "idea";

function normalizeTopicStatus(status: string | null | undefined): TopicEditorialStatus {
  switch (status) {
    case "planning":
    case "production":
    case "published":
    case "repurpose":
    case "idea":
      return status;
    default:
      return DEFAULT_STATUS;
  }
}

export function useTopicBacklog() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const [topics, setTopics] = useState<TopicBacklogEntry[]>([]);
  const [channels, setChannels] = useState<TopicBacklogChannel[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTopics = useCallback(async () => {
    if (!user?.id || !currentTenant?.id) {
      setTopics([]);
      setChannels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [{ data: topicRows, error: topicError }, { data: channelRows, error: channelError }] = await Promise.all([
        supabase
          .from("topic_backlog")
          .select("id, topic, tags, status, priority, owner_id, short_description")
          .eq("tenant_id", currentTenant.id)
          .order("priority", { ascending: false })
          .order("updated_at", { ascending: false }),
        supabase
          .from("social_content_channels")
          .select("id, name")
          .eq("tenant_id", currentTenant.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

      if (topicError) throw topicError;
      if (channelError) throw channelError;

      setChannels((channelRows || []) as TopicBacklogChannel[]);

      const { data: plannerActionRows, error: plannerActionError } = await supabase
        .from("event_planning_item_actions")
        .select("action_config")
        .eq("action_type", "social_planner");

      if (plannerActionError) throw plannerActionError;

      const eventPlanningTopicIds = new Set(
        (plannerActionRows || [])
          .map((row) => (row.action_config as { topic_backlog_id?: string | null } | null)?.topic_backlog_id)
          .filter((value): value is string => Boolean(value)),
      );

      const topicData = (topicRows || []).filter((row) => !eventPlanningTopicIds.has(row.id));
      const ownerIds = Array.from(new Set(topicData.map((row) => row.owner_id).filter((value): value is string => Boolean(value))));
      const topicIds = topicData.map((row) => row.id);

      const [{ data: ownerRows, error: ownerError }, { data: linkedRows, error: linkedError }] = await Promise.all([
        ownerIds.length
          ? supabase.from("profiles").select("id, display_name").in("id", ownerIds).eq("tenant_id", currentTenant.id)
          : Promise.resolve({ data: [], error: null }),
        topicIds.length
          ? supabase
              .from("social_content_items")
              .select(`
                id,
                topic_backlog_id,
                hook,
                workflow_status,
                scheduled_for,
                responsible_user_id,
                asset_requirements,
                format,
                social_content_item_channels(channel_id, is_primary, social_content_channels(name))
              `)
              .eq("tenant_id", currentTenant.id)
              .in("topic_backlog_id", topicIds)
              .order("scheduled_for", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ownerError) throw ownerError;
      if (linkedError) throw linkedError;

      const responsibleIds = Array.from(new Set((linkedRows || []).map((row) => row.responsible_user_id).filter((value): value is string => Boolean(value))));
      const { data: responsibleRows, error: responsibleError } = responsibleIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", responsibleIds).eq("tenant_id", currentTenant.id)
        : { data: [], error: null };

      if (responsibleError) throw responsibleError;

      const ownerNameById = new Map((ownerRows || []).map((row) => [row.id, row.display_name || null]));
      const responsibleNameById = new Map((responsibleRows || []).map((row) => [row.id, row.display_name || null]));
      const linkedByTopic = new Map<string, TopicBacklogLinkedContent[]>();

      for (const row of linkedRows || []) {
        // INTEROP-ANY(TS-4823, Redaktion-Backlog, 2026-04-22): Supabase join payload is dynamic until typed view contract is finalized.
        const channelLinks = ((row as any).social_content_item_channels || []) as Array<{
          channel_id: string;
          is_primary: boolean;
          social_content_channels: { name: string | null } | null;
        }>;
        const primaryChannel = channelLinks.find((entry) => entry.is_primary)?.social_content_channels?.name || channelLinks[0]?.social_content_channels?.name || null;
        const channelNames = channelLinks
          .map((entry) => entry.social_content_channels?.name)
          .filter((value): value is string => Boolean(value));
        const mappedItem: TopicBacklogLinkedContent = {
          id: row.id,
          hook: row.hook,
          workflow_status: row.workflow_status,
          scheduled_for: row.scheduled_for,
          responsible_user_id: row.responsible_user_id,
          responsible_person_name: row.responsible_user_id ? (responsibleNameById.get(row.responsible_user_id) as string) || null : null,
          asset_requirements: row.asset_requirements || [],
          primary_channel_name: primaryChannel,
          channel_names: channelNames,
          format: row.format,
        };

        const topicItems = linkedByTopic.get(row.topic_backlog_id) || [];
        topicItems.push(mappedItem);
        linkedByTopic.set(row.topic_backlog_id, topicItems);
      }

      setTopics(
        topicData.map((row) => {
          const linkedContentItems = linkedByTopic.get(row.id) || [];
          const latestScheduledItem = linkedContentItems.find((item) => Boolean(item.scheduled_for)) || null;
          const openProductionNeeds = Array.from(
            new Set(
              linkedContentItems
                .filter((item) => item.workflow_status !== "published")
                .flatMap((item) => item.asset_requirements || [])
                .filter(Boolean),
            ),
          );

          return {
            id: row.id,
            topic: row.topic,
            tags: row.tags || [],
            status: normalizeTopicStatus(row.status),
            priority: row.priority,
            owner_id: row.owner_id,
            owner_name: row.owner_id ? ownerNameById.get(row.owner_id) || null : null,
            short_description: row.short_description || null,
            linked_content_count: linkedContentItems.length,
            latest_scheduled_for: latestScheduledItem?.scheduled_for || null,
            primary_channel_name: latestScheduledItem?.primary_channel_name || linkedContentItems[0]?.primary_channel_name || null,
            responsible_person_name: latestScheduledItem?.responsible_person_name || linkedContentItems[0]?.responsible_person_name || (row.owner_id ? ownerNameById.get(row.owner_id) || null : null),
            open_production_needs: openProductionNeeds,
            linked_content_items: linkedContentItems,
          };
        }),
      );
    } catch (error) {
      console.error("Error loading topic backlog:", getErrorMessage(error), error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user?.id]);

  const createTopic = useCallback(
    async (payload: { topic: string; tags?: string[]; priority?: number; status?: TopicEditorialStatus; owner_id?: string | null; short_description?: string | null }) => {
      if (!user?.id || !currentTenant?.id || !profileId) return null;

      const id = crypto.randomUUID();
      const normalizedStatus = normalizeTopicStatus(payload.status);
      const { error } = await supabase
        .from("topic_backlog")
        .insert({
          id,
          tenant_id: currentTenant.id,
          created_by: profileId,
          topic: payload.topic,
          tags: payload.tags || [],
          priority: payload.priority ?? 1,
          status: normalizedStatus,
          owner_id: payload.owner_id ?? null,
          short_description: payload.short_description ?? null,
        });

      if (error) {
        console.error("createTopic failed:", getErrorMessage(error), error);
        throw new Error(getErrorMessage(error));
      }
      await loadTopics();
      return {
        id,
        topic: payload.topic,
        tags: payload.tags || [],
        status: normalizedStatus,
        priority: payload.priority ?? 1,
        owner_id: payload.owner_id ?? null,
      };
    },
    [currentTenant?.id, loadTopics, user?.id, profileId],
  );

  const updateTopic = useCallback(async (id: string, patch: Partial<TopicBacklogEntry>) => {
    if (!currentTenant?.id) return;

    const topicPatch: Record<string, unknown> = { ...patch };
    if (typeof patch.status !== "undefined") {
      topicPatch.status = normalizeTopicStatus(patch.status);
    }
    delete topicPatch.owner_name;
    delete topicPatch.linked_content_count;
    delete topicPatch.latest_scheduled_for;
    delete topicPatch.primary_channel_name;
    delete topicPatch.responsible_person_name;
    delete topicPatch.open_production_needs;
    delete topicPatch.linked_content_items;

    const { error } = await supabase
      .from("topic_backlog")
      .update(topicPatch)
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);

    if (error) throw new Error(getErrorMessage(error));
    await loadTopics();
  }, [currentTenant?.id, loadTopics]);

  const deleteTopic = useCallback(async (id: string) => {
    if (!currentTenant?.id) return;

    const { error } = await supabase
      .from("topic_backlog")
      .delete()
      .eq("id", id)
      .eq("tenant_id", currentTenant.id);

    if (error) throw new Error(getErrorMessage(error));
    await loadTopics();
  }, [currentTenant?.id, loadTopics]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (!currentTenant?.id) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void loadTopics();
      }, 250);
    };

    const channel = supabase
      .channel(`topic-backlog-${currentTenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_backlog", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_items", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_item_channels", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "social_content_channels", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, loadTopics]);

  return {
    topics,
    channels,
    loading,
    loadTopics,
    createTopic,
    updateTopic,
    deleteTopic,
  };
}
