import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { documentSearchFilter } from "@/features/documents/documentSearch";
import { CaseFileDocument, DOCUMENT_RELEVANCE } from "@/features/cases/files/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CaseFileDocumentsTabProps {
  documents: CaseFileDocument[];
  onAdd: (documentId: string, relevance: string, notes?: string, title?: string) => Promise<boolean>;
  onUpload: (file: File, title: string, relevance: string, notes: string, tenantId: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

const PAGE_SIZE = 50;

type AvailableDocument = {
  id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
};

export function CaseFileDocumentsTab({ documents, onAdd, onUpload, onRemove }: CaseFileDocumentsTabProps) {
  const { currentTenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<AvailableDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [relevance, setRelevance] = useState("supporting");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [mode, setMode] = useState<"existing" | "upload">("existing");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"loading" | "ready" | "error">("loading");
  const tenantId = currentTenant?.id;

  useEffect(() => {
    if (!dialogOpen || !tenantId || mode !== "existing") return;
    let cancelled = false;
    setSearchStatus("loading");
    const timer = window.setTimeout(async () => {
      let query = supabase.from("documents")
        .select("id, title, file_name, file_type, created_at")
        .eq("tenant_id", tenantId);
      if (searchTerm.trim()) query = query.or(documentSearchFilter(searchTerm));
      const from = page * PAGE_SIZE;
      const { data, error } = await query.order("created_at", { ascending: false })
        .order("id").range(from, from + PAGE_SIZE);
      if (cancelled) return;
      if (!error) {
        const rows = data?.slice(0, PAGE_SIZE) ?? [];
        setAvailableDocuments(current => page === 0 ? rows : [...current, ...rows]);
        setHasMore((data?.length ?? 0) > PAGE_SIZE);
      }
      setSearchStatus(error ? "error" : "ready");
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dialogOpen, tenantId, mode, searchTerm, page]);

  const handleAdd = async () => {
    if (isSubmitting || !tenantId) return;
    const selectedDoc = filteredDocuments.find(doc => doc.id === selectedDocumentId);
    if (mode === "upload" ? !file || !title.trim() : !selectedDoc) return;
    setIsSubmitting(true);
    try {
      const success = mode === "upload"
        ? await onUpload(file!, title.trim(), relevance, notes, tenantId)
        : await onAdd(selectedDoc!.id, relevance, notes || undefined, selectedDoc!.title);
      if (success) {
        setDialogOpen(false);
        setSelectedDocumentId(null);
        setFile(null);
        setTitle("");
        setRelevance("supporting");
        setNotes("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRelevanceLabel = (value: string) => {
    return DOCUMENT_RELEVANCE.find(r => r.value === value)?.label || value;
  };

  const linkedDocumentIds = new Set(documents.map(doc => doc.document_id));
  const filteredDocuments = availableDocuments.filter(doc => !linkedDocumentIds.has(doc.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Verknüpfte Dokumente
        </CardTitle>
        <Button onClick={() => { setPage(0); setSelectedDocumentId(null); setSearchStatus("loading"); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Dokument hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Dokumente verknüpft
          </p>
        ) : (
          <div className="space-y-3">
            {documents.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    {item.document && <Link className="font-medium hover:underline" to={`/documents?document=${item.document_id}`}>
                      {item.document.title}
                    </Link>}
                    <div className="text-sm text-muted-foreground">
                      {item.document?.file_name}
                      {item.document?.created_at && (
                        <> · {format(new Date(item.document.created_at), 'dd.MM.yyyy', { locale: de })}</>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{getRelevanceLabel(item.relevance)}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!isSubmitting) setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dokument hinzufügen</DialogTitle>
            <DialogDescription>
              Laden Sie eine Datei hoch oder wählen Sie ein vorhandenes Dokument aus.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={mode === "existing" ? "default" : "outline"} disabled={isSubmitting}
                onClick={() => { if (mode === "existing") return; setPage(0); setSelectedDocumentId(null); setSearchStatus("loading"); setMode("existing"); }}>Vorhandenes Dokument</Button>
              <Button type="button" variant={mode === "upload" ? "default" : "outline"} disabled={isSubmitting}
                onClick={() => setMode("upload")}>Datei hochladen</Button>
            </div>
            {mode === "upload" ? <div className="grid gap-3">
              <Label htmlFor="case-document-file">Datei</Label>
              <Input id="case-document-file" type="file" disabled={isSubmitting}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" onChange={event => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setTitle(nextFile?.name ?? "");
                }} />
              <Label htmlFor="case-document-title">Titel</Label>
              <Input id="case-document-title" value={title} disabled={isSubmitting} onChange={event => setTitle(event.target.value)} />
            </div> : <div className="grid gap-2">
              <Label htmlFor="case-document-search">In allen Ordnern suchen</Label>
              <Input id="case-document-search" value={searchTerm} disabled={isSubmitting} onChange={event => {
                setSearchTerm(event.target.value);
                setPage(0);
                setSelectedDocumentId(null);
                setSearchStatus("loading");
              }} />
              <ScrollArea className="h-48 rounded-md border">
                <div className="space-y-1 p-2">
                  {searchStatus === "ready" && filteredDocuments.map(doc => (
                    <button key={doc.id} type="button" disabled={isSubmitting}
                      aria-pressed={selectedDocumentId === doc.id}
                      className={`block w-full rounded p-2 text-left hover:bg-muted ${selectedDocumentId === doc.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedDocumentId(doc.id)}>
                      <span className="block text-sm font-medium">{doc.title}</span>
                      <span className="block text-xs text-muted-foreground">{doc.file_name}</span>
                    </button>
                  ))}
                  {searchStatus !== "ready" || filteredDocuments.length === 0 ? (
                    <p role="status" className="py-4 text-center text-sm text-muted-foreground">
                      {searchStatus === "loading" ? "Dokumente werden gesucht …" : searchStatus === "error"
                        ? "Die Suche ist fehlgeschlagen." : "Keine verfügbaren Dokumente gefunden"}
                    </p>
                  ) : null}
                  {searchStatus === "ready" && hasMore && <Button type="button" variant="ghost" disabled={isSubmitting}
                    onClick={() => setPage(current => current + 1)}>Weitere Dokumente laden</Button>}
                </div>
              </ScrollArea>
            </div>}
            <div className="grid gap-2">
              <Label>Relevanz</Label>
              <Select value={relevance} onValueChange={setRelevance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_RELEVANCE.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notizen (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Zusätzliche Informationen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={isSubmitting || (mode === "upload" ? !file || !title.trim() : searchStatus !== "ready" || !filteredDocuments.some(doc => doc.id === selectedDocumentId))}>
              {mode === "upload" ? "Hochladen und ablegen" : "Dokument verknüpfen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
