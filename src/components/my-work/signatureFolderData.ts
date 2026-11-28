import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/lib/query-cache";
import { supabase } from "@/integrations/supabase/client";

export const folderTypes = [
  { id: "letter", label: "Brief", filter: "Briefe", color: "bg-blue-100 text-blue-800" },
  { id: "press", label: "Presse", filter: "Presse", color: "bg-violet-100 text-violet-800" },
  { id: "social", label: "Social", filter: "Social", color: "bg-[#e7f3df] text-[#326a1c]" },
  { id: "protocol", label: "Protokoll", filter: "Protokoll", color: "bg-amber-100 text-amber-900" },
] as const;

export type FolderType = (typeof folderTypes)[number]["id"];
export interface FolderEntry {
  id: string;
  type: FolderType;
  title: string;
  author?: string | null;
  authorId?: string | null;
  date?: string | null;
  content?: string | null;
  metadata?: string;
  image?: string | null;
  hashtags?: string[];
  version?: string;
  decisionId?: string;
  participantId?: string;
  creatorId?: string;
  reminder?: string;
  path?: string;
  results?: { title: string; content: string }[];
}

export function folderDate(value: string, now = new Date()) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", dateStyle: "short" });
  const date = new Date(value);
  const previous = new Date(day.format(now) + "T12:00:00Z");
  previous.setUTCDate(previous.getUTCDate() - 1);
  if (day.format(date) === day.format(now)) return "heute";
  if (day.format(date) === day.format(previous)) return "gestern";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short" }).format(date);
}

const clock = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

export function signatureFolderKey(tenantId?: string, userId?: string) {
  return ["signature-folder", tenantId, userId] as const;
}

export function useSignatureFolderQuery(tenantId?: string, userId?: string, enabled = true) {
  return useQuery({
    queryKey: signatureFolderKey(tenantId, userId),
    queryFn: () => loadSignatureFolder(tenantId!, userId!),
    enabled: enabled && !!tenantId && !!userId,
    staleTime: STALE_TIME.LIST_WITH_REALTIME,
    refetchInterval: STALE_TIME.LIST_WITH_REALTIME,
    refetchOnWindowFocus: true,
  });
}

export async function loadSignatureFolder(tenantId: string, userId: string): Promise<FolderEntry[]> {
  const [press, social, protocols, decisions, profiles] = await Promise.all([
    supabase.from("press_releases").select("id,title,content,content_html,created_by,submitted_at,updated_at")
      .eq("tenant_id", tenantId).eq("status", "pending_approval").order("submitted_at").limit(200),
    supabase.from("social_content_items")
      .select("id,draft_text,core_message,image_url,hashtags,scheduled_for,created_by,updated_at,topic_backlog(topic),social_content_item_channels(social_content_channels(name))")
      .eq("tenant_id", tenantId).eq("approval_state", "pending_approval").neq("workflow_status", "published")
      .order("scheduled_for").limit(200),
    supabase.from("meeting_protocol_details")
      .select("meeting_id,recorder_name,meetings!inner(title,description,meeting_date,updated_at,meeting_agenda_items(title,result_html,result_text,order_index))")
      .eq("meetings.tenant_id", tenantId).eq("meetings.status", "archived").is("approved_at", null).limit(200),
    supabase.from("task_decision_participants")
      .select("id,task_decisions!inner(id,description,created_by,dashboard_decision_nudges(nudged_at,nudged_by))")
      .eq("user_id", userId).eq("task_decisions.tenant_id", tenantId).neq("task_decisions.created_by", userId)
      .in("task_decisions.status", ["active", "open"])
      .like("task_decisions.description", "%letter_approval_letter_id:%").limit(200),
    supabase.from("profiles").select("user_id,display_name").eq("tenant_id", tenantId),
  ]);
  for (const result of [press, social, protocols, decisions, profiles]) {
    if (result.error) throw result.error;
  }
  const names = new Map<string, string | null>();
  for (const profile of profiles.data ?? []) names.set(profile.user_id, profile.display_name);
  const approvalByLetter = new Map<string, NonNullable<typeof decisions.data>[number]>();
  for (const participant of decisions.data ?? []) {
    const id = participant.task_decisions.description?.match(/^letter_approval_letter_id:([0-9a-f-]{36})\s*$/im)?.[1];
    if (id) approvalByLetter.set(id, participant);
  }
  const letterIds = [...approvalByLetter.keys()];
  const letters = await supabase.from("letters")
    .select("id,title,subject,content,content_html,created_by,submitted_for_review_at,updated_at")
    .eq("tenant_id", tenantId).eq("status", "pending_approval")
    .or(letterIds.length ? `submitted_to_user.eq.${userId},id.in.(${letterIds.join(",")})` : `submitted_to_user.eq.${userId}`)
    .order("submitted_for_review_at").limit(200);
  if (letters.error) throw letters.error;
  const letterEntries: FolderEntry[] = (letters.data ?? []).map(row => {
    const participant = approvalByLetter.get(row.id);
    const decision = participant?.task_decisions;
    const nudge = decision?.dashboard_decision_nudges;
    const reminder = nudge?.nudged_at
      ? ["Erinnerung", nudge.nudged_by && names.get(nudge.nudged_by), `${folderDate(nudge.nudged_at)} ${clock.format(new Date(nudge.nudged_at))}`].filter(Boolean).join(" · ")
      : undefined;
    return { id: row.id, type: "letter", title: row.subject || row.title, content: row.content_html || row.content,
      authorId: row.created_by, date: row.submitted_for_review_at, version: row.updated_at,
      decisionId: decision?.id, participantId: participant?.id, creatorId: decision?.created_by, reminder,
      path: `/letters/${row.id}` };
  });
  const entries: FolderEntry[] = [
    ...(press.data ?? []).map((row): FolderEntry => ({ id: row.id, type: "press", title: row.title,
      content: row.content_html || row.content, authorId: row.created_by, date: row.submitted_at, version: row.updated_at })),
    ...letterEntries,
    ...(social.data ?? []).map((row): FolderEntry => ({
      id: row.id, type: "social", title: row.topic_backlog?.topic || "Social-Media-Beitrag",
      content: row.draft_text || row.core_message, image: row.image_url, hashtags: row.hashtags,
      authorId: row.created_by, version: row.updated_at,
      metadata: [row.social_content_item_channels.map(link => link.social_content_channels?.name).filter(Boolean).join(" + "),
        row.scheduled_for && `geplant ${folderDate(row.scheduled_for)} ${clock.format(new Date(row.scheduled_for))}`].filter(Boolean).join(" · "),
      path: `/redaktion?highlight=${row.id}`,
    })),
    ...(protocols.data ?? []).map(({ meeting_id: id, recorder_name: author, meetings: meeting }): FolderEntry => {
      const results = meeting.meeting_agenda_items
        .filter(item => item.result_html?.trim() || item.result_text?.trim())
        .sort((a, b) => a.order_index - b.order_index);
      return { id, type: "protocol", title: meeting.title, author, version: meeting.updated_at,
        date: meeting.meeting_date, metadata: results.length ? `${results.length} ${results.length === 1 ? "Ergebnis" : "Ergebnisse"}` : undefined,
        content: meeting.description, results: results.map(item => ({ title: item.title, content: item.result_html || item.result_text || "" })), path: `/meetings?protocol=${id}` };
    }),
  ];
  return entries.map(entry => ({
    ...entry,
    author: entry.author || (entry.authorId ? names.get(entry.authorId) : undefined),
  }));
}

export async function decideFolderEntry(entry: FolderEntry, tenantId: string, userId: string, note?: string) {
  if (entry.type === "press") {
    const now = new Date().toISOString();
    const updates = note
      ? { status: "revision_requested", revision_comment: note, revision_requested_at: now, revision_requested_by: userId }
      : { status: "approved", approved_at: now, approved_by: userId };
    const { error } = await supabase.from("press_releases").update(updates)
      .eq("tenant_id", tenantId).eq("id", entry.id).eq("status", "pending_approval").eq("updated_at", entry.version ?? "")
      .select("id").single();
    if (error) throw error;
  } else if (entry.type === "social") {
    const { error } = note
      ? await supabase.rpc("request_social_post_changes", { _item: entry.id, _comment: note, _due_days: 3 })
      : await supabase.from("social_content_items").update({ approval_state: "approved" })
        .eq("tenant_id", tenantId).eq("id", entry.id).eq("approval_state", "pending_approval").eq("updated_at", entry.version ?? "")
        .select("id").single();
    if (error) throw error;
  } else if (entry.type === "protocol" && !note) {
    const { error } = await supabase.rpc("update_meeting_protocol", { _meeting_id: entry.id, _action: "approve" });
    if (error) throw error;
  } else {
    throw new Error("Diese Aktion ist für den Vorgang nicht verfügbar.");
  }
}
