import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";

export interface ApprovalComment {
  id: string;
  content_item_id: string;
  author_id: string;
  author_name: string | null;
  comment: string;
  is_change_request: boolean;
  created_at: string;
}

export function useApprovalComments(contentItemId: string | null) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contentItemId || !currentTenant?.id) {
      setComments([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("social_approval_comments")
        .select("id, content_item_id, author_id, comment, is_change_request, created_at, profiles:author_id(display_name)")
        .eq("content_item_id", contentItemId)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setComments(
        (data || []).map((row) => ({
          id: row.id,
          content_item_id: row.content_item_id,
          author_id: row.author_id,
          author_name: (row.profiles as { display_name?: string } | null)?.display_name ?? null,
          comment: row.comment,
          is_change_request: row.is_change_request,
          created_at: row.created_at,
        })),
      );
    } catch (error) {
      console.error("Error loading approval comments:", getErrorMessage(error), error);
    } finally {
      setLoading(false);
    }
  }, [contentItemId, currentTenant?.id]);

  const addComment = useCallback(
    async (comment: string, isChangeRequest: boolean, recipientUserId: string | null, topicTitle?: string) => {
      if (!contentItemId || !currentTenant?.id || !profileId || !user?.id) return;
      const trimmed = comment.trim();
      if (!trimmed) return;
      const { error } = await supabase.from("social_approval_comments").insert({
        tenant_id: currentTenant.id,
        content_item_id: contentItemId,
        author_id: profileId,
        comment: trimmed,
        is_change_request: isChangeRequest,
      });
      if (error) throw new Error(getErrorMessage(error));

      if (isChangeRequest && recipientUserId && recipientUserId !== user.id) {
        try {
          await supabase.rpc("create_notification", {
            user_id_param: recipientUserId,
            type_name: "social_post_change_requested",
            title_param: `Änderung gewünscht: ${topicTitle || "Social Post"}`,
            message_param: trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed,
            data_param: { content_item_id: contentItemId, route: `/redaktion?highlight=${contentItemId}` },
          });
        } catch (notifyError) {
          console.warn("Notification failed:", getErrorMessage(notifyError));
        }
      }
      await load();
    },
    [contentItemId, currentTenant?.id, load, profileId, user?.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => ({ comments, loading, addComment, reload: load }), [comments, loading, addComment, load]);
}
