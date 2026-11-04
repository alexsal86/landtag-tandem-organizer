import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { QuickNote } from "./types";
import type { NoteScope, NoteWrite } from "./storage";

const optionalId = z.string().nullable().optional().transform(value => value ?? undefined);
const schema = z.object({
  id: z.string(), tenant_id: z.string(), revision: z.number(),
  user_id: z.string(), title: z.string().nullable(), content: z.string(),
  color: z.string().nullable(), color_full_card: z.boolean().nullable().optional().transform(Boolean),
  is_pinned: z.boolean().nullable().transform(Boolean), created_at: z.string(), updated_at: z.string(),
  task_id: optionalId, decision_id: optionalId, case_item_id: optionalId, meeting_id: optionalId, topic_backlog_id: optionalId,
  follow_up_date: optionalId, priority_level: z.number().nullable().optional().transform(v => v ?? 0),
  is_archived: z.boolean().nullable().optional().transform(Boolean),
  pending_for_jour_fixe: z.boolean().nullable().optional().transform(Boolean),
  is_shared: z.boolean().optional(), can_edit: z.boolean().optional(), share_count: z.number().optional(),
  task_archived_info: z.unknown().optional(), decision_archived_info: z.unknown().optional(), meeting_archived_info: z.unknown().optional(),
  owner: z.object({ display_name: z.string().nullable(), avatar_url: z.string().nullable() }).nullable().optional(),
  shared_with_users: z.array(z.object({ id: z.string(), display_name: z.string().nullable() })).optional(),
  meetings: z.object({ title: z.string(), meeting_date: z.string(), status: z.string().nullable() }).nullable().optional(),
});
export const parseNote = (value: unknown): QuickNote => schema.parse(value);
export async function fetchNotes(tenantId: string, noteId?: string, signal?: AbortSignal): Promise<QuickNote[]> {
  let request = supabase.rpc("list_quick_notes", { p_tenant_id: tenantId, ...(noteId ? { p_note_id: noteId } : {}) });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return schema.array().parse(data);
}
export async function sendWrite(scope: NoteScope, write: NoteWrite): Promise<QuickNote> {
  const { data, error } = await supabase.rpc("save_quick_note", {
    p_actor_id: scope.userId, p_tenant_id: scope.tenantId, p_note_id: write.noteId, p_operation_id: write.id,
    p_title: write.title, p_content: write.content, p_create: write.kind === "create",
    ...(write.baseRevision === undefined ? {} : { p_base_revision: write.baseRevision }),
    p_color: write.color, p_is_pinned: write.isPinned,
  });
  if (error) throw error;
  return parseNote(data);
}
export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  return !navigator.onLine || /failed to fetch|network|fetch failed|load failed|timeout|timed out/i.test(message);
}
