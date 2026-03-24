import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

// social_content_comments is a new table not yet reflected in generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as any;

export interface SocialContentComment {
  id: string;
  item_id: string;
  profile_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function useSocialContentComments(itemId: string | null) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const [comments, setComments] = useState<SocialContentComment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    if (!itemId || !user?.id || !currentTenant?.id) {
      setComments([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await db
        .from("social_content_comments")
        .select("id, item_id, profile_id, body, created_at, updated_at, profiles(display_name)")
        .eq("item_id", itemId)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setComments(
        (data || []).map((row) => {
          const profile = row.profiles as { display_name: string } | null;
          return {
            id: row.id,
            item_id: row.item_id,
            profile_id: row.profile_id,
            author_name: profile?.display_name || "Unbekannt",
            body: row.body,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        }),
      );
    } catch (error) {
      console.error("Error loading comments:", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [itemId, currentTenant?.id, user?.id]);

  const addComment = useCallback(
    async (body: string) => {
      if (!itemId || !user?.id || !currentTenant?.id || !profileId) return;

      const { error } = await db.from("social_content_comments").insert({
        item_id: itemId,
        tenant_id: currentTenant.id,
        profile_id: profileId,
        body: body.trim(),
      });

      if (error) throw new Error(getErrorMessage(error));
      await loadComments();
    },
    [itemId, currentTenant?.id, profileId, user?.id, loadComments],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!currentTenant?.id) return;

      const { error } = await db
        .from("social_content_comments")
        .delete()
        .eq("id", commentId)
        .eq("tenant_id", currentTenant.id);

      if (error) throw new Error(getErrorMessage(error));
      await loadComments();
    },
    [currentTenant?.id, loadComments],
  );

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!itemId || !currentTenant?.id) return;

    const channel = db
      .channel(`social-comments-${itemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_content_comments",
          filter: `item_id=eq.${itemId}`,
        },
        () => void loadComments(),
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [itemId, currentTenant?.id, loadComments]);

  return useMemo(
    () => ({ comments, loading, profileId, addComment, deleteComment }),
    [comments, loading, profileId, addComment, deleteComment],
  );
}
