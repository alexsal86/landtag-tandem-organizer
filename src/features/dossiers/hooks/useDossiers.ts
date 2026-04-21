import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { toast } from "sonner";
import type { Dossier } from "../types";
import { useEffect } from "react";

export function useDossiers() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const profileId = useCurrentProfileId();

  const query = useQuery({
    queryKey: ["dossiers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dossiers")
        .select("id, title, summary, status, priority, owner_id, topic_id, tenant_id, created_by, created_at, updated_at, open_questions, positions, risks_opportunities, review_interval_days, next_review_at, last_briefing_at, notes_html, parent_id, constituency_relevance, affected_locations")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Dossier[];
    },
  });

  useEffect(() => {
    const ensureReviewTasks = async () => {
      if (!tenantId || !profileId || !query.data?.length) return;

      const nowIso = new Date().toISOString();
      const dueDossiers = query.data.filter((dossier) =>
        dossier.owner_id &&
        dossier.next_review_at &&
        dossier.next_review_at <= nowIso
      );

      if (dueDossiers.length === 0) return;

      const dossierIds = dueDossiers.map((dossier) => dossier.id);
      const { data: existingTasks, error: taskFetchError } = await supabase
        .from("tasks")
        .select("id, source_id, due_date")
        .eq("tenant_id", tenantId)
        .eq("source_type", "dossier_review")
        .in("source_id", dossierIds);

      if (taskFetchError) return;

      const existingKeys = new Set(
        (existingTasks ?? []).map((task) => `${task.source_id ?? ""}::${task.due_date ?? ""}`)
      );

      const tasksToCreate = dueDossiers
        .filter((dossier) => !existingKeys.has(`${dossier.id}::${dossier.next_review_at}`))
        .map((dossier) => ({
          tenant_id: tenantId,
          user_id: profileId,
          assigned_to: dossier.owner_id,
          title: `Dossier-Review fällig: ${dossier.title}`,
          description: `Bitte Dossier „${dossier.title}“ prüfen.`,
          due_date: dossier.next_review_at,
          priority: "medium",
          status: "todo",
          category: "dossier",
          source_type: "dossier_review",
          source_id: dossier.id,
        }));

      if (tasksToCreate.length === 0) return;

      await supabase.from("tasks").insert(tasksToCreate);
    };

    void ensureReviewTasks();
  }, [profileId, query.data, tenantId]);

  return query;
}

export function useCreateDossier() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();

  return useMutation({
    mutationFn: async (input: { title: string; summary?: string; status?: string; priority?: string }) => {
      if (!currentTenant?.id || !profileId) throw new Error("Nicht angemeldet");
      const { data, error } = await supabase
        .from("dossiers")
        .insert({
          title: input.title,
          summary: input.summary ?? null,
          status: input.status ?? "aktiv",
          priority: input.priority ?? "mittel",
          tenant_id: currentTenant.id,
          created_by: profileId,
          owner_id: profileId,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as Dossier;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Dossier erstellt");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}

export function useUpdateDossier() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      summary?: string;
      status?: string;
      priority?: string;
      open_questions?: string;
      positions?: string;
      risks_opportunities?: string;
      notes_html?: string;
      review_interval_days?: number | null;
      next_review_at?: string | null;
      last_briefing_at?: string | null;
      owner_id?: string | null;
    }) => {
      const { id, ...updates } = input;
      const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
      // Remove undefined keys so we don't overwrite with null
      for (const key of Object.keys(payload)) {
        if (payload[key] === undefined) delete payload[key];
      }
      const { error } = await supabase
        .from("dossiers")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossiers"] });
      toast.success("Dossier aktualisiert");
    },
    onError: (err) => toast.error(`Fehler: ${err.message}`),
  });
}
