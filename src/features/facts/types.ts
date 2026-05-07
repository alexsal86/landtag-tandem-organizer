import type { Database } from "@/integrations/supabase/types";

export type FactRow = Database["public"]["Tables"]["facts"]["Row"];

export interface FactsFilters {
  search?: string;
  tags?: string[];
  dossierId?: string | null;
  contactId?: string | null;
  includeArchived?: boolean;
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
