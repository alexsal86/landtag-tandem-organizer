import type { Database } from "@/integrations/supabase/types";

export type FactRow = Database["public"]["Tables"]["facts"]["Row"];

export type FactSortField = "updated_at" | "created_at" | "usage_count" | "text";
export type FactSortDir = "asc" | "desc";

export interface FactsFilters {
  search?: string;
  tags?: string[];
  dossierId?: string | null;
  contactId?: string | null;
  includeArchived?: boolean;
  sortField?: FactSortField;
  sortDir?: FactSortDir;
  page?: number;        // 0-based
  pageSize?: number;
}

export interface FactInput {
  id?: string;
  text: string;
  source?: string | null;
  tags?: string[];
  dossier_id?: string | null;
  contact_id?: string | null;
  valid_until?: string | null;
  is_archived?: boolean;
}
