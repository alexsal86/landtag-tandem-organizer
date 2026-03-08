import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";

export interface CaseItem {
  id: string;
  user_id: string;
  tenant_id: string;
  source_channel: "phone" | "email" | "social" | "in_person" | "other";
  status: "neu" | "in_klaerung" | "antwort_ausstehend" | "erledigt";
  priority: "low" | "medium" | "high" | "urgent";
  owner_user_id: string | null;
  contact_id: string | null;
  due_at: string | null;
  follow_up_at: string | null;
  subject: string | null;
  summary: string | null;
  source_received_at: string | null;
  source_reference: string | null;
  reporter_name: string | null;
  reporter_contact: string | null;
  intake_payload: CaseItemIntakePayload | null;
  confidentiality_level: string | null;
  contains_personal_data: boolean;
  resolution_summary: string | null;
  case_file_id: string | null;
  case_scale: string | null;
  created_at: string;
  updated_at: string;
  last_modified_by: string | null;
  last_modified_at: string;
}

export interface CaseItemInteraction {
  id: string;
  case_item_id: string;
  tenant_id: string;
  interaction_type: "phone" | "email" | "social" | "in_person" | "other";
  interaction_at: string;
  direction: "inbound" | "outbound" | "internal";
  summary: string | null;
  payload: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  visibility: "internal" | "team" | "public_to_case_participants";
}

export interface CaseItemFormData {
  source_channel: CaseItem["source_channel"];
  status?: CaseItem["status"];
  priority?: CaseItem["priority"];
  owner_user_id?: string | null;
  contact_id?: string | null;
  due_at?: string | null;
  follow_up_at?: string | null;
  subject?: string | null;
  summary?: string | null;
  source_received_at?: string | null;
  source_reference?: string | null;
  reporter_name?: string | null;
  reporter_contact?: string | null;
  intake_payload?: CaseItemIntakePayload | null;
  confidentiality_level?: "public" | "internal" | "restricted" | "strictly_confidential" | null;
  contains_personal_data?: boolean;
  resolution_summary?: string | null;
  case_file_id?: string | null;
  case_scale?: string | null;
}

export interface CaseItemInteractionFormData {
  case_item_id: string;
  interaction_type: CaseItemInteraction["interaction_type"];
  interaction_at?: string;
  direction?: CaseItemInteraction["direction"];
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  visibility?: CaseItemInteraction["visibility"];
}

export const useCaseItems = () => {
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const fetchCaseItems = useCallback(async () => {
    if (!user || !currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("case_items")
        .select("id, user_id, tenant_id, source_channel, status, priority, owner_user_id, contact_id, due_at, follow_up_at, subject, summary, source_received_at, source_reference, reporter_name, reporter_contact, intake_payload, confidentiality_level, contains_personal_data, resolution_summary, case_file_id, case_scale, created_at, updated_at")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCaseItems((data ?? []) as unknown as CaseItem[]);
    } catch (error) {
      console.error("Error fetching case items:", error);
      toast({
        title: "Fehler",
        description: "Vorgänge konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant, toast]);

  const createCaseItem = async (data: CaseItemFormData) => {
    if (!user || !currentTenant) {
      toast({
        title: "Fehlender Kontext",
        description: "Keine aktive Mandanten-/Sitzungskontext. Bitte neu anmelden oder Mandant auswählen.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const insertData = {
        source_channel: data.source_channel,
        status: data.status ?? "neu",
        priority: data.priority ?? "medium",
        subject: data.subject ?? null,
        summary: data.summary ?? null,
        resolution_summary: data.resolution_summary ?? null,
        due_at: data.due_at ?? null,
        follow_up_at: data.follow_up_at ?? null,
        owner_user_id: data.owner_user_id ?? null,
        contact_id: data.contact_id ?? null,
        source_received_at: data.source_received_at ?? null,
        source_reference: data.source_reference ?? null,
        reporter_name: data.reporter_name ?? null,
        reporter_contact: data.reporter_contact ?? null,
        confidentiality_level: data.confidentiality_level ?? null,
        contains_personal_data: data.contains_personal_data ?? false,
        case_file_id: data.case_file_id ?? null,
        case_scale: data.case_scale ?? null,
        intake_payload: data.intake_payload ?? null,
        user_id: user.id,
        tenant_id: currentTenant.id,
      };

      const { error } = await supabase
        .from("case_items")
        .insert(insertData as any);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Vorgang wurde erstellt.",
      });

      await fetchCaseItems();
      // Return a placeholder; the real item is now in caseItems state
      return { id: "new" } as unknown as CaseItem;
    } catch (error: unknown) {
      console.error("Error creating case item:", error);
      const detail = error instanceof Error ? error.message : String(error);
      toast({
        title: "Fehler beim Erstellen",
        description: detail,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCaseItem = async (id: string, data: Partial<CaseItemFormData>) => {
    try {
      const updateData = { ...data, intake_payload: data.intake_payload as any };
      const { error } = await supabase.from("case_items").update(updateData as any).eq("id", id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Vorgang wurde aktualisiert.",
      });

      await fetchCaseItems();
      return true;
    } catch (error) {
      console.error("Error updating case item:", error);
      toast({
        title: "Fehler",
        description: "Vorgang konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCaseItem = async (id: string) => {
    try {
      const { error } = await supabase.from("case_items").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Vorgang wurde gelöscht.",
      });

      await fetchCaseItems();
      return true;
    } catch (error) {
      console.error("Error deleting case item:", error);
      toast({
        title: "Fehler",
        description: "Vorgang konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const createCaseItemInteraction = async (data: CaseItemInteractionFormData) => {
    if (!user || !currentTenant) return null;

    try {
      const { data: interaction, error } = await supabase
        .from("case_item_interactions")
        .insert({
          ...data,
          tenant_id: currentTenant.id,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Interaktion wurde hinzugefügt.",
      });

      return interaction as unknown as CaseItemInteraction;
    } catch (error) {
      console.error("Error creating case item interaction:", error);
      toast({
        title: "Fehler",
        description: "Interaktion konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      return null;
    }
  };

  const fetchCaseItemInteractions = useCallback(
    async (caseItemId: string) => {
      if (!user || !currentTenant) return [];

      try {
        const { data, error } = await supabase
          .from("case_item_interactions")
          .select("id, case_item_id, tenant_id, interaction_type, interaction_at, direction, summary, payload, created_by, created_at, visibility")
          .eq("tenant_id", currentTenant.id)
          .eq("case_item_id", caseItemId)
          .order("interaction_at", { ascending: false });

        if (error) throw error;
        return (data ?? []) as unknown as CaseItemInteraction[];
      } catch (error) {
        console.error("Error fetching case item interactions:", error);
        toast({
          title: "Fehler",
          description: "Interaktionen konnten nicht geladen werden.",
          variant: "destructive",
        });
        return [];
      }
    },
    [user, currentTenant, toast]
  );

  useEffect(() => {
    fetchCaseItems();
  }, [fetchCaseItems]);

  useEffect(() => {
    if (!user || !currentTenant) return;

    const channel = supabase
      .channel("case-items-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "case_items",
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchCaseItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTenant, fetchCaseItems]);

  return {
    caseItems,
    loading,
    fetchCaseItems,
    createCaseItem,
    updateCaseItem,
    deleteCaseItem,
    createCaseItemInteraction,
    fetchCaseItemInteractions,
  };
};
