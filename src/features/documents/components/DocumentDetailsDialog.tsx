import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Document } from "@/components/documents/types";
import { getAnnotationFileKind } from "@/features/annotations/annotationModel";
import { supabase } from "@/integrations/supabase/client";

interface DocumentDetailsDialogProps {
  documentId: string;
  tenantId: string;
  onClose: () => void;
  onDownload: (document: Document) => void;
  onAnnotate: (document: Document) => void;
}

export function DocumentDetailsDialog({ documentId, tenantId, onClose, onDownload, onAnnotate }: DocumentDetailsDialogProps) {
  const documentQuery = useQuery({
    queryKey: ["document-details", tenantId, documentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents")
        .select("id, tenant_id, user_id, title, description, file_name, file_path, file_size, file_type, category, status, created_at, updated_at")
        .eq("tenant_id", tenantId).eq("id", documentId).maybeSingle();
      if (error) throw error;
      return data ? { ...data, status: data.status ?? "draft" } : null;
    },
  });
  const linksQuery = useQuery({
    queryKey: ["document-links", tenantId, documentId],
    enabled: !!documentQuery.data,
    queryFn: async () => {
      const [cases, tasks, contacts] = await Promise.all([
        supabase.from("case_file_documents")
          .select("case_file:case_files!inner(id, title)")
          .eq("document_id", documentId).eq("case_file.tenant_id", tenantId),
        supabase.from("document_annotation_tasks")
          .select("task:tasks!inner(id, title)")
          .eq("document_id", documentId).eq("tenant_id", tenantId).eq("task.tenant_id", tenantId),
        supabase.from("document_contacts")
          .select("contact:contacts(id, name)")
          .eq("document_id", documentId).eq("contact.tenant_id", tenantId),
      ]);
      if (cases.error || tasks.error || contacts.error) throw cases.error ?? tasks.error ?? contacts.error;
      return [
        ...(cases.data ?? []).flatMap(({ case_file }) => case_file
          ? [{ label: case_file.title, href: `/casefiles?caseFileId=${case_file.id}`, type: "Akte" }] : []),
        ...(tasks.data ?? []).flatMap(({ task }) => task
          ? [{ label: task.title, href: `/tasks?highlight=${task.id}`, type: "Aufgabe" }] : []),
        ...(contacts.data ?? []).flatMap(({ contact }) => contact
          ? [{ label: contact.name, href: `/contacts/${contact.id}`, type: "Kontakt" }] : []),
      ];
    },
  });
  const document = documentQuery.data;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{document?.title ?? "Dokumentdetails"}</DialogTitle>
          <DialogDescription>{document?.file_name ?? "Datei und Verknüpfungen"}</DialogDescription>
        </DialogHeader>
        {documentQuery.isPending && <p role="status">Dokument wird geladen …</p>}
        {documentQuery.isError && <p role="alert">Das Dokument konnte nicht geladen werden.</p>}
        {document === null && <p role="status">Das Dokument ist in diesem Büro nicht verfügbar.</p>}
        {document && <>
          {document.description && <p className="whitespace-pre-wrap text-sm">{document.description}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onDownload(document)}>Herunterladen</Button>
            {getAnnotationFileKind(document.file_name, document.file_type) &&
              <Button variant="outline" onClick={() => onAnnotate(document)}>Ansehen und annotieren</Button>}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Verknüpfungen</h3>
            {linksQuery.isPending && <p role="status" className="text-sm">Verknüpfungen werden geladen …</p>}
            {linksQuery.isError && <p role="alert" className="text-sm">Die Verknüpfungen konnten nicht geladen werden.</p>}
            {linksQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">Keine Verknüpfungen vorhanden.</p>}
            {!!linksQuery.data?.length && <ul className="space-y-1 text-sm">
              {linksQuery.data.map(link => <li key={link.href}>
                <Link to={link.href} className="text-primary hover:underline">{link.label}</Link>
                <span className="ml-2 text-muted-foreground">{link.type}</span>
              </li>)}
            </ul>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
