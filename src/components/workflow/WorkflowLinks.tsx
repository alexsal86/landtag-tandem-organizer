import { annotationDocumentPath } from "@/features/annotations/mentions";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";

export function WorkflowLinks({ taskId, caseFileId }: { taskId?: string; caseFileId?: string }) {
  const { currentTenant } = useTenant();
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["workflow-links", currentTenant?.id, taskId, caseFileId],
    enabled: !!currentTenant && !!(taskId || caseFileId),
    queryFn: async () => {
      if (taskId) {
        const { data, error } = await supabase.from("tasks").select("source_type,source_id").eq("tenant_id", currentTenant!.id).eq("id", taskId).single();
        if (error) throw error;
        let annotationLink: { document_id: string; annotation_id: string | null } | null = null;
        if (data.source_type === "document_annotation") {
          const link = await supabase.from("document_annotation_tasks").select("document_id,annotation_id").eq("task_id", taskId).eq("tenant_id", currentTenant!.id).maybeSingle();
          if (link.error) throw link.error;
          annotationLink = link.data;
        }
        return { annotationLink, source: data, decisions: [] as Array<{ id: string; title: string }> };
      }
      const { data, error } = await supabase.from("task_decisions").select("id,title").eq("tenant_id", currentTenant!.id).eq("case_file_id", caseFileId!);
      if (error) throw error;
      return { annotationLink: null, source: null, decisions: data ?? [] };
    },
  });
  const source = query.data?.source;
  return <div className="space-y-1 text-sm">
    {query.isError && <button className="text-destructive underline" onClick={() => void query.refetch()}>Verknüpfungen erneut laden</button>}
    {query.data?.annotationLink && <Link className="text-primary underline" to={annotationDocumentPath(query.data.annotationLink.document_id, query.data.annotationLink.annotation_id)}>{query.data.annotationLink.annotation_id ? "Anmerkung im Originaldokument öffnen" : "Originaldokument öffnen"}</Link>}
    {source?.source_type === "decision" && source.source_id && <button className="text-primary underline" onClick={() => setDecisionId(source.source_id)}>Ursprüngliche Entscheidung öffnen</button>}
    {source?.source_type === "knowledge_review" && source.source_id && <Link className="text-primary underline" to={`/wissen?frage=${source.source_id}`}>Wissensantwort prüfen und freigeben</Link>}
    {source?.source_type === "case_step" && source.source_id && <Link className="text-primary underline" to={`/mywork?tab=cases&caseItemId=${source.source_id}`}>Zugehörigen Vorgang öffnen</Link>}
    {source?.source_type === "case_file" && source.source_id && <Link className="text-primary underline" to={`/cases?tab=files&id=${source.source_id}`}>Zugehörige Akte öffnen</Link>}
    {source?.source_type === "quick_note" && source.source_id && <Link className="text-primary underline" to={`/mywork?tab=capture&highlight=${source.source_id}`}>Ursprüngliche Notiz öffnen</Link>}
    {query.data?.decisions.map(d => <button key={d.id} className="block text-primary underline" onClick={() => setDecisionId(d.id)}>Entscheidung: {d.title}</button>)}
    <TaskDecisionDetails decisionId={decisionId} isOpen={!!decisionId} onClose={() => setDecisionId(null)} />
  </div>;
}
