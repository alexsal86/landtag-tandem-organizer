import type { Database, Json } from "@/integrations/supabase/types";

export type KnowledgeQuestion =
  Database["public"]["Tables"]["knowledge_questions"]["Row"];
export interface KnowledgePerson {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}
export interface KnowledgePersonFields {
  created_by_person: KnowledgePerson;
  assigned_to_person: KnowledgePerson | null;
  verified_by_person: KnowledgePerson | null;
}
// The view selects whole knowledge_questions rows; generated view types mark every column nullable.
export type KnowledgeCard = KnowledgeQuestion &
  KnowledgePersonFields & {
    effective_review_status: string | null;
    server_now: string;
  };
export type KnowledgeAttachment =
  Database["public"]["Tables"]["knowledge_question_attachments"]["Row"];
export type KnowledgeEvent =
  Database["public"]["Tables"]["knowledge_question_events"]["Row"];
export type KnowledgeView = "answers" | "open" | "mine" | "assigned" | "review";
export type ReviewStatus = "unverified" | "verified" | "needs_review";
export interface AnswerDraft {
  plainText: string;
  nodesJson?: string;
  html?: string;
}
export interface KnowledgeNode {
  type: string;
  text?: string;
  url?: string;
  children?: KnowledgeNode[];
  [key: string]: Json | KnowledgeNode[] | undefined;
}

export type KnowledgeSummary = Pick<
  KnowledgeCard,
  | "id"
  | "tenant_id"
  | "title"
  | "description"
  | "answered_at"
  | "review_status"
  | "effective_review_status"
  | "review_due_at"
  | "assigned_to"
  | "created_by"
  | "created_at"
  | "updated_at"
  | "answer_updated_at"
  | "revision"
  | "server_now"
  | "verified_at"
> &
  KnowledgePersonFields & { answer_excerpt: string; tags?: KnowledgeTag[] };
export interface KnowledgePage {
  items: KnowledgeSummary[];
  total_count: number;
  next_cursor: Json | null;
}

export interface KnowledgeFilters {
  status: "" | "open" | "unverified" | "verified" | "needs_review";
  assignee: string;
  sort: "updated" | "oldest";
}

export interface KnowledgeTag { id: string; name: string }
