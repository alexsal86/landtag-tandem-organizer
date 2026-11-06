import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { canTransitionStatus } from "@/components/letters/types";
import { archiveLetter } from "@/utils/letterArchiving";

export function letterTransitionUpdates(from: string, to: string, userId: string, locked = false, now = new Date().toISOString()) {
  if (!canTransitionStatus(from, to)) throw new Error(`Ungültiger Statuswechsel: ${from} → ${to}`);
  const updates: Database["public"]["Tables"]["letters"]["Update"] = { status: to };
  if (!locked && (to === "review" || to === "pending_approval")) {
    updates.submitted_for_review_at = now;
    updates.submitted_for_review_by = userId;
  }
  if (!locked && to === "approved") { updates.approved_at = now; updates.approved_by = userId; }
  if (to === "sent") {
    if (!locked) { updates.sent_at = now; updates.sent_by = userId; }
    updates.workflow_locked = true;
    updates.sent_date = now.slice(0, 10);
  }
  return updates;
}

/** Gemeinsamer Anwendungspfad für Editor und Selbsttest, inklusive Archivierung. */
export async function persistLetterTransition(letterId: string, from: string, to: string, userId: string, locked = false) {
  const now = new Date().toISOString();
  const updates = letterTransitionUpdates(from, to, userId, locked, now);
  if (to === "sent") {
    const archive = await archiveLetter(letterId, userId);
    if (!archive.success) throw new Error(archive.error || "Die Archivierung konnte nicht abgeschlossen werden.");
    return { updates, archive };
  }
  const { error } = await supabase.from("letters").update({ ...updates, updated_at: now }).eq("id", letterId);
  if (error) throw error;
  return { updates, archive: undefined };
}

export async function uploadLetterAttachment(file: File, letterId: string, userId: string, trackUpload?: (path: string) => void) {
  if (!userId) throw new Error("Anmeldung für Upload erforderlich.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Die Anlage ist größer als 10 MB.");
  const path = `${letterId}/${crypto.randomUUID()}_${file.name}`;
  trackUpload?.(path);
  const upload = await supabase.storage.from("documents").upload(path, file);
  if (upload.error) throw upload.error;
  try {
    const result = await supabase.from("letter_attachments").insert({
      letter_id: letterId, file_name: file.name, file_path: path,
      file_type: file.type, file_size: file.size, uploaded_by: userId,
    }).select().single();
    if (result.error || !result.data) throw result.error ?? new Error("Anlage wurde nicht gespeichert.");
    return result.data;
  } catch (error) {
    const cleanup = await supabase.storage.from("documents").remove([path]);
    if (cleanup.error) throw Object.assign(new Error(`Anlage konnte nicht gespeichert und Upload nicht entfernt werden: ${cleanup.error.message}`), { cause: error });
    throw error;
  }
}
