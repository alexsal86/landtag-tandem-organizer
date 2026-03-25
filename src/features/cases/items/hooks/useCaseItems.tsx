import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import { buildCaseItemUpdatePayload } from "@/features/cases/shared/utils/caseInteropAdapters";
import { debugConsole } from "@/utils/debugConsole";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type CaseItemRow = Tables<"case_items">;
type CaseItemInsert = TablesInsert<"case_items">;
type CaseItemUpdate = TablesUpdate<"case_items">;
type CaseItemInteractionInsert = TablesInsert<"case_item_interactions">;

export interface CaseItem {
  id: string;
  user_id: string;
  tenant_id: string;
  source_channel: "phone" | "email" | "social" | "in_person" | "other";
  status: "neu" | "in_klaerung" | "antwort_ausstehend" | "erledigt" | "archiviert";
  priority: "low" | "medium" | "high" | "urgent";
  owner_user_id: string | null;
  contact_id: string | null;
  due_at: string | null;
  visible_to_all: boolean;
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
  visible_to_all?: boolean;
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


const caseItemComparator = (a: CaseItem, b: CaseItem) =>
  new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime();

const normalizeCaseItem = (row: Partial<CaseItemRow> & { id: string }): CaseItem => ({
  visible_to_all: false,
  intake_payload: null,
  confidentiality_level: null,
  contains_personal_data: false,
  resolution_summary: null,
  source_channel: null,
  status: null,
  priority: null,
  owner_user_id: null,
  contact_id: null,
  due_at: null,
  follow_up_at: null,
  subject: null,
  summary: null,
  source_received_at: null,
  source_reference: null,
  reporter_name: null,
  reporter_contact: null,
  case_file_id: null,
  case_scale: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...row,
} as CaseItem);

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
        .select("id, user_id, tenant_id, source_channel, status, priority, owner_user_id, contact_id, due_at, visible_to_all, follow_up_at, subject, summary, source_received_at, source_reference, reporter_name, reporter_contact, intake_payload, confidentiality_level, contains_personal_data, resolution_summary, case_file_id, case_scale, created_at, updated_at")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCaseItems(((data ?? []) as CaseItemRow[]).map((row) => normalizeCaseItem(row)).sort(caseItemComparator));
    } catch (error) {
      debugConsole.error("Error fetching case items:", error);
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
      // Pre-flight: check if tenant is in user's active memberships
      const { data: tenantCheck } = await supabase
        .rpc("get_user_tenant_ids", { _user_id: user.id });
      debugConsole.log("[createCaseItem] user tenant ids:", tenantCheck, "current tenant:", currentTenant.id);

      const caseItemId = crypto.randomUUID();

      const insertData = {
        id: caseItemId,
        source_channel: data.source_channel,
        status: data.status ?? "neu",
        priority: data.priority ?? "medium",
        subject: data.subject ?? null,
        summary: data.summary ?? null,
        resolution_summary: data.resolution_summary ?? null,
        due_at: data.due_at ?? null,
        visible_to_all: data.visible_to_all ?? false,
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

      debugConsole.log("[createCaseItem] insertData:", JSON.stringify(insertData, null, 2));

      const { error } = await supabase
        .from("case_items")
        .insert(insertData as CaseItemInsert);

      if (error) {
        debugConsole.error("[createCaseItem] Supabase error:", error.message, error.code, error.details, error.hint);
        throw error;
      }

      debugConsole.log("[createCaseItem] inserted with id:", caseItemId);

      toast({
        title: "Erfolgreich",
        description: "Vorgang wurde erstellt.",
      });

      // Notify assigned owner (if different from creator)
      if (data.owner_user_id && data.owner_user_id !== user.id) {
        supabase.rpc("create_notification", {
          user_id_param: data.owner_user_id,
          type_name: "case_item_assigned",
          title_param: "Vorgang zugewiesen",
          message_param: `Ihnen wurde der Vorgang "${data.subject || 'Ohne Betreff'}" zugewiesen.`,
          priority_param: "medium",
          data_param: JSON.stringify({ case_item_id: caseItemId }),
        }).then(({ error: nErr }) => {
          if (nErr) debugConsole.warn("Notification error (case_item_assigned):", nErr);
        });
      }

      await fetchCaseItems();
      return { id: caseItemId } as unknown as CaseItem;
    } catch (error: unknown) {
      debugConsole.error("Error creating case item:", error);
      let detail = "Unbekannter Fehler";
      if (error instanceof Error) {
        detail = error.message;
      } else if (error && typeof error === "object" && "message" in error) {
        detail = String((error as { message?: unknown }).message ?? detail);
      }
      toast({
        title: "Fehler beim Erstellen",
        description: detail,
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCaseItem = async (id: string, data: Partial<CaseItemFormData>) => {
    if (!user || !currentTenant) return false;

    try {
      // Fetch existing item to detect changes
      const existing = caseItems.find(ci => ci.id === id);

      const updateData = buildCaseItemUpdatePayload(data);
      const { error } = await supabase.from("case_items").update(updateData).eq("id", id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Vorgang wurde aktualisiert.",
      });

      const subject = data.subject ?? existing?.subject ?? "Ohne Betreff";

      // Notify on status change
      if (data.status && existing && data.status !== existing.status) {
        const notifyIds = new Set<string>();
        if (existing.user_id && existing.user_id !== user.id) notifyIds.add(existing.user_id);
        if (existing.owner_user_id && existing.owner_user_id !== user.id) notifyIds.add(existing.owner_user_id);
        for (const recipientId of notifyIds) {
          supabase.rpc("create_notification", {
            user_id_param: recipientId,
            type_name: "case_item_status_changed",
            title_param: "Vorgang-Status geändert",
            message_param: `Der Status von "${subject}" wurde auf "${data.status}" geändert.`,
            priority_param: "medium",
            data_param: JSON.stringify({ case_item_id: id, new_status: data.status }),
          }).then(({ error: nErr }) => {
            if (nErr) debugConsole.warn("Notification error (case_item_status_changed):", nErr);
          });
        }
      }

      // Notify on assignment change
      if (data.owner_user_id && data.owner_user_id !== user.id && data.owner_user_id !== existing?.owner_user_id) {
        supabase.rpc("create_notification", {
          user_id_param: data.owner_user_id,
          type_name: "case_item_assigned",
          title_param: "Vorgang zugewiesen",
          message_param: `Ihnen wurde der Vorgang "${subject}" zugewiesen.`,
          priority_param: "medium",
          data_param: JSON.stringify({ case_item_id: id }),
        }).then(({ error: nErr }) => {
          if (nErr) debugConsole.warn("Notification error (case_item_assigned):", nErr);
        });
      }

      await fetchCaseItems();
      return true;
    } catch (error) {
      debugConsole.error("Error updating case item:", error);
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
      debugConsole.error("Error deleting case item:", error);
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
        .insert([{
          ...data,
          tenant_id: currentTenant.id,
          created_by: user.id,
        } as CaseItemInteractionInsert])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "Interaktion wurde hinzugefügt.",
      });

      // Notify case item owner/creator about the new comment
      const caseItem = caseItems.find(ci => ci.id === data.case_item_id);
      if (caseItem) {
        const notifyIds = new Set<string>();
        if (caseItem.user_id && caseItem.user_id !== user.id) notifyIds.add(caseItem.user_id);
        if (caseItem.owner_user_id && caseItem.owner_user_id !== user.id) notifyIds.add(caseItem.owner_user_id);
        for (const recipientId of notifyIds) {
          supabase.rpc("create_notification", {
            user_id_param: recipientId,
            type_name: "case_item_comment",
            title_param: "Neuer Kommentar zum Vorgang",
            message_param: `Neuer Kommentar zum Vorgang "${caseItem.subject || 'Ohne Betreff'}".`,
            priority_param: "medium",
            data_param: JSON.stringify({ case_item_id: caseItem.id }),
          }).then(({ error: nErr }) => {
            if (nErr) debugConsole.warn("Notification error (case_item_comment):", nErr);
          });
        }
      }

      return interaction as unknown as CaseItemInteraction;
    } catch (error) {
      debugConsole.error("Error creating case item interaction:", error);
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
        debugConsole.error("Error fetching case item interactions:", error);
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
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = payload.old?.id as string | undefined;
            if (deletedId) {
              setCaseItems((prev) => prev.filter((item) => item.id !== deletedId));
            }
            return;
          }

          const nextRow = payload.new as Partial<CaseItemRow> & { id?: string };
          if (!nextRow.id) {
            void fetchCaseItems();
            return;
          }

          const normalized = normalizeCaseItem(nextRow as Partial<CaseItemRow> & { id: string });

          setCaseItems((prev) => {
            const existingIndex = prev.findIndex((item) => item.id === normalized.id);

            if (existingIndex === -1) {
              return [normalized, ...prev].sort(caseItemComparator);
            }

            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...normalized };
            return next.sort(caseItemComparator);
          });
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
