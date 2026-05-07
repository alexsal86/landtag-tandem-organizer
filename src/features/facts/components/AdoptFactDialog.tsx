import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useIncrementFactUsage } from "../hooks/useFacts";
import type { FactRow } from "../types";
import { notify } from "@/lib/notify";

interface PreparationRow {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  preparation_data: Record<string, unknown> | null;
}

interface Props {
  fact: FactRow;
  onClose: () => void;
}

export function AdoptFactDialog({ fact, onClose }: Props) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const qc = useQueryClient();
  const incrementUsage = useIncrementFactUsage();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: preps = [], isLoading } = useQuery({
    queryKey: ["preparations-open", tenantId],
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_preparations")
        .select("id,title,status,updated_at,preparation_data")
        .eq("tenant_id", tenantId!)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PreparationRow[];
    },
  });

  const adopt = async (prep: PreparationRow) => {
    setBusyId(prep.id);
    try {
      const data = (prep.preparation_data ?? {}) as {
        structured_facts?: Array<{
          id: string;
          fact_id?: string;
          text: string;
          source?: string;
          link_type: "general" | "partner" | "topic";
          link_id?: string;
        }>;
      };
      const existing = data.structured_facts ?? [];
      if (existing.some((f) => f.fact_id === fact.id)) {
        notify.info("Fakt ist bereits in dieser Vorbereitung enthalten.");
        onClose();
        return;
      }
      const next = [
        ...existing,
        {
          id: crypto.randomUUID(),
          fact_id: fact.id,
          text: "",
          link_type: "general" as const,
        },
      ];
      const { error } = await supabase
        .from("appointment_preparations")
        .update({
          preparation_data: { ...data, structured_facts: next },
          updated_at: new Date().toISOString(),
        })
        .eq("id", prep.id);
      if (error) throw error;
      incrementUsage.mutate(fact.id);
      notify.success(`In „${prep.title}" übernommen.`);
      qc.invalidateQueries({ queryKey: ["preparations-open"] });
      onClose();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Fehler beim Übernehmen");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>In Vorbereitung übernehmen</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground line-clamp-2">{fact.text}</p>
        <ScrollArea className="max-h-[50vh] mt-2">
          {isLoading && (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && preps.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Keine offenen Vorbereitungen vorhanden.
            </div>
          )}
          <div className="divide-y">
            {preps.map((prep) => (
              <button
                key={prep.id}
                type="button"
                disabled={busyId !== null}
                onClick={() => adopt(prep)}
                className="w-full text-left py-2.5 px-1 hover:bg-muted/40 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{prep.title}</div>
                  <div className="text-xs text-muted-foreground">{prep.status}</div>
                </div>
                {busyId === prep.id && <Loader2 className="h-4 w-4 animate-spin" />}
              </button>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
