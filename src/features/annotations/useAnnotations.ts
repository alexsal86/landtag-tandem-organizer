import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { annotationPatchMatches } from "./annotationModel";
import type { AnnotationPatch, AnnotationColor, DocumentAnnotation, DraftAnnotation, AnnotationFileKind } from "./types";

const COLS = "id, tenant_id, document_id, parent_id, file_kind, file_version, annotation_type, page_number, target_selector, quote_text, color, content, resolved, created_by, created_at, updated_at";
const key = (documentId: string) => ["document-annotations", documentId];

export function useAnnotations(documentId: string | null) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: key(documentId ?? "none"),
    enabled: !!documentId,
    staleTime: 30_000,
    queryFn: async (): Promise<DocumentAnnotation[]> => {
      const { data, error } = await supabase.from("document_annotations").select(COLS)
        .eq("document_id", documentId!).order("page_number", { ascending: true, nullsFirst: true }).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as DocumentAnnotation[];
    },
  });
  const invalidate = () => {
    return Promise.all([
      qc.invalidateQueries({ queryKey: key(documentId ?? "none") }),
      qc.invalidateQueries({ queryKey: ["document-annotation-counts"] }),
    ]);
  };

  useEffect(() => {
    if (!documentId) return;
    const channel = supabase.channel(`document-annotations:${documentId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_annotations", filter: `document_id=eq.${documentId}` }, () => {
        void qc.invalidateQueries({ queryKey: key(documentId) });
        void qc.invalidateQueries({ queryKey: ["document-annotation-counts"] });
      }).subscribe(status => {
        if (status === "SUBSCRIBED") void qc.invalidateQueries({ queryKey: key(documentId) });
      });
    return () => { void supabase.removeChannel(channel); };
  }, [documentId, qc]);

  const create = useMutation({
    mutationFn: async (args: { tenantId: string; fileKind: AnnotationFileKind; fileVersion: string; draft: DraftAnnotation; color: AnnotationColor; content: string; userId: string; parentId?: string }) => {
      const { data, error } = await supabase.from("document_annotations").insert({
        parent_id: args.parentId ?? null, tenant_id: args.tenantId, document_id: documentId!, file_kind: args.fileKind, file_version: args.fileVersion,
        annotation_type: args.draft.annotation_type, page_number: args.draft.page_number,
        target_selector: JSON.parse(JSON.stringify(args.draft.target_selector)), quote_text: args.draft.quote_text,
        color: args.color, content: args.content, created_by: args.userId,
      }).select(COLS).single();
      if (error) throw error;
      return data as unknown as DocumentAnnotation;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async (args: { id: string; patch: AnnotationPatch; expected?: AnnotationPatch }) => {
      let query = supabase.from("document_annotations").update({ ...args.patch, ...(args.patch.target_selector ? { target_selector: JSON.parse(JSON.stringify(args.patch.target_selector)) } : {}) })
        .eq("id", args.id).eq("document_id", documentId!);
      if (args.expected) {
        const current = await supabase.from("document_annotations").select(COLS).eq("id", args.id).eq("document_id", documentId!).single();
        if (current.error) throw current.error;
        if (!annotationPatchMatches(current.data, args.expected)) throw new Error("Diese Anmerkung wurde inzwischen geändert. Bitte die aktuelle Fassung prüfen.");
        query = query.eq("updated_at", current.data.updated_at);
      }
      const { data, error } = await query.select(COLS).single();
      if (error) throw error;
      return data as unknown as DocumentAnnotation;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_annotations").delete().eq("id", id).select("id").single();
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { annotations: list.data ?? [], isLoading: list.isLoading, isError: list.isError, refetch: list.refetch, create, update, remove };
}

/** Open (not resolved) annotation counts per document for list badges. */
export function useAnnotationCounts(tenantId: string | undefined, documentIds: string[]) {
  return useQuery({
    queryKey: ["document-annotation-counts", tenantId, documentIds.slice().sort().join(",")],
    enabled: !!tenantId && documentIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("document_annotations").select("document_id")
        .eq("tenant_id", tenantId!).eq("resolved", false).is("parent_id", null).in("document_id", documentIds.slice(0, 300));
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.document_id] = (counts[r.document_id] ?? 0) + 1;
      return counts;
    },
  });
}
