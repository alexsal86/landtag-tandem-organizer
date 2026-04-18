import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

export interface HashtagSet {
  id: string;
  name: string;
  description: string | null;
  hashtags: string[];
  channel_slug: string | null;
}

// Tabelle: social_hashtag_sets (siehe Migration). Bis Supabase types regeneriert sind,
// rufen wir die Tabelle dynamisch über supabase.from(...) auf und casten nur die Reihe.
type HashtagSetRow = {
  id: string;
  name: string;
  description: string | null;
  hashtags: string[] | null;
  channel_slug: string | null;
};

export function useHashtagSets() {
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const [sets, setSets] = useState<HashtagSet[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) {
      setSets([]);
      return;
    }
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("social_hashtag_sets")
        .select("id, name, description, hashtags, channel_slug")
        .eq("tenant_id", currentTenant.id)
        .order("name", { ascending: true });
      if (error) throw error;
      setSets(
        ((data as HashtagSetRow[] | null) || []).map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          hashtags: row.hashtags || [],
          channel_slug: row.channel_slug,
        })),
      );
    } catch (err) {
      console.error("useHashtagSets load failed:", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  const createSet = useCallback(
    async (input: { name: string; hashtags: string[]; description?: string | null; channel_slug?: string | null }) => {
      if (!currentTenant?.id || !profileId) return;

      const { error } = await supabase.from("social_hashtag_sets").insert({
        tenant_id: currentTenant.id,
        created_by: profileId,
        name: input.name,
        description: input.description ?? null,
        hashtags: input.hashtags,
        channel_slug: input.channel_slug ?? null,
      });
      if (error) throw new Error(getErrorMessage(error));
      await load();
    },
    [currentTenant?.id, profileId, load],
  );

  const deleteSet = useCallback(
    async (id: string) => {
      if (!currentTenant?.id) return;

      const { error } = await supabase.from("social_hashtag_sets").delete().eq("id", id).eq("tenant_id", currentTenant.id);
      if (error) throw new Error(getErrorMessage(error));
      await load();
    },
    [currentTenant?.id, load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => ({ sets, loading, createSet, deleteSet, reload: load }), [sets, loading, createSet, deleteSet, load]);
}
