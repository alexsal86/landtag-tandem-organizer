import { useEffect, useRef } from "react";
import { format, startOfDay, addDays, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { QuickNote } from "./types";

export function useQuickNoteFollowUps(notes: QuickNote[], userId?: string, tenantId?: string) {
  const running = useRef(false);
  useEffect(() => {
    if (!userId || !tenantId || !navigator.onLine || running.current) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const key = `quick-note-follow-ups:${userId}:${tenantId}:${today}`;
    let sent: string[];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) || "[]");
      sent = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { sent = []; }
    const due = notes.filter(note => note.user_id === userId && !sent.includes(note.id) && note.follow_up_date && isBefore(startOfDay(new Date(note.follow_up_date)), addDays(startOfDay(new Date()), 1)));
    if (!due.length) return;
    running.current = true;
    void Promise.all(due.map(async note => {
      const { error } = await supabase.rpc("create_notification", {
        user_id_param: userId, type_name: "note_follow_up", title_param: "Fällige Wiedervorlage",
        message_param: `Notiz „${note.title?.replace(/<[^>]*>/g, "") || "Ohne Titel"}“ hat eine fällige Wiedervorlage`,
        data_param: JSON.stringify({ noteId: note.id, date: today }), priority_param: "high",
      });
      if (!error) sent.push(note.id);
    })).then(() => { try { localStorage.setItem(key, JSON.stringify(sent)); } catch { /* Notification is still delivered. */ } })
      .catch(() => {}).finally(() => { running.current = false; });
  }, [notes, userId, tenantId]);
}
