import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import { extractMentionedUserIds } from "@/utils/noteMentions";
import { notifyQuickNoteShared } from "@/utils/shareNotifications";
import { stripHtml } from "@/components/my-work/utils/editorContent";
import { notify } from "@/lib/notify";

type QuickCaptureValues = {
  title: string;
  content: string;
  selectedColor: string;
  isPinned: boolean;
};

type MentionedUser = {
  id: string;
  displayName: string;
};

type UseQuickCaptureActionsParams = {
  values: QuickCaptureValues;
  canSaveNote: boolean;
  onResetForm: () => void;
  onNoteSaved?: () => void;
};

export function useQuickCaptureActions({
  values,
  canSaveNote,
  onResetForm,
  onNoteSaved,
}: UseQuickCaptureActionsParams) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [saving, setSaving] = useState(false);
  const [savingAsTask, setSavingAsTask] = useState(false);
  const [mentionPromptOpen, setMentionPromptOpen] = useState(false);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);

  const handleSaveNote = async () => {
    if (!canSaveNote || !user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .insert([
          {
            user_id: user.id,
            title: values.title.trim() || null,
            content: stripHtml(values.content) ? values.content.trim() : "",
            color: values.selectedColor,
            is_pinned: values.isPinned,
            category: "general",
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      const mentionedUserIds = extractMentionedUserIds(values.title, values.content).filter(
        (mentionedUserId) => mentionedUserId !== user.id
      );

      if (mentionedUserIds.length > 0 && currentTenant?.id && data?.id) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .eq("tenant_id", currentTenant.id)
          .in("user_id", mentionedUserIds);

        setNewNoteId(data.id);
        setMentionedUsers(
          mentionedUserIds.map((userId) => ({
            id: userId,
            displayName:
              profiles?.find((profile: Record<string, any>) => profile.user_id === userId)?.display_name || "Unbekannt",
          }))
        );
        setMentionPromptOpen(true);
      }

      notify.success("Notiz gespeichert");
      onResetForm();
      onNoteSaved?.();
    } catch (error) {
      debugConsole.error("Error saving note:", error);
      notify.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleShareMentionedUsers = async (userIds: string[], permission: "view" | "edit") => {
    if (!newNoteId || !user?.id || userIds.length === 0) return;

    const { error } = await supabase.from("quick_note_shares").insert(
      userIds.map((sharedWithUserId) => ({
        note_id: newNoteId,
        shared_with_user_id: sharedWithUserId,
        shared_by_user_id: user.id,
        permission_type: permission,
      }))
    );

    if (error) {
      notify.error("Freigabe für erwähnte Personen fehlgeschlagen");
      return;
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: noteData } = await supabase
      .from("quick_notes")
      .select("title")
      .eq("id", newNoteId)
      .maybeSingle();

    await Promise.all(
      userIds
        .filter((recipientUserId) => recipientUserId !== user.id)
        .map((recipientUserId) =>
          notifyQuickNoteShared({
            recipientUserId,
            senderName: senderProfile?.display_name,
            itemTitle: noteData?.title,
            itemId: newNoteId,
          })
        )
    );

    notify.success("Notiz für erwähnte Personen freigegeben");
  };

  const handleSaveAsTask = async () => {
    if (!stripHtml(values.content) || !user || !currentTenant) return;

    setSavingAsTask(true);
    try {
      const plainText = stripHtml(values.content);
      const taskTitle = stripHtml(values.title) || plainText.substring(0, 100);

      const { error } = await supabase.from("tasks").insert([
        {
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: taskTitle,
          description: values.content,
          status: "todo",
          priority: "medium",
          category: "personal",
        },
      ]);

      if (error) throw error;

      notify.success("Als Aufgabe gespeichert");
      onResetForm();
      onNoteSaved?.();
    } catch (error) {
      debugConsole.error("Error saving as task:", error);
      notify.error("Fehler beim Speichern");
    } finally {
      setSavingAsTask(false);
    }
  };

  return {
    handleSaveNote,
    handleSaveAsTask,
    handleShareMentionedUsers,
    saving,
    savingAsTask,
    mentionPromptOpen,
    setMentionPromptOpen,
    mentionedUsers,
  };
}
