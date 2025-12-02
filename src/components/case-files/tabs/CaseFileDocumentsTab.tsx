import { useState, useEffect } from "react";
import { CaseFileDocument, DOCUMENT_RELEVANCE } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
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
  onAdd: (documentId: string, relevance: string, notes?: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}

export function CaseFileDocumentsTab({ documents, onAdd, onRemove }: CaseFileDocumentsTabProps) {
  const { currentTenant } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [relevance, setRelevance] = useState("supporting");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (dialogOpen && currentTenant) {
      loadDocuments();
    }
  }, [dialogOpen, currentTenant]);

  const loadDocuments = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('documents')
      .select('id, title, file_name, file_type, created_at')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setAvailableDocuments(data || []);
  };

  const handleAdd = async () => {
    if (!selectedDocumentId) return;
    setIsSubmitting(true);
    const success = await onAdd(selectedDocumentId, relevance, notes || undefined);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
      setSelectedDocumentId(null);
      setRelevance("supporting");
      setNotes("");
    }
  };

  const getRelevanceLabel = (value: string) => {
    return DOCUMENT_RELEVANCE.find(r => r.value === value)?.label || value;
  };

  const filteredDocuments = availableDocuments.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkedDocumentIds = documents.map(d => d.document_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Verknüpfte Dokumente
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
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
                    <div className="font-medium">{item.document?.title}</div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dokument verknüpfen</DialogTitle>
            <DialogDescription>
              Wählen Sie ein Dokument aus und definieren Sie dessen Relevanz.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Dokument suchen</Label>
              <input
                type="text"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {filteredDocuments
                    .filter(doc => !linkedDocumentIds.includes(doc.id))
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className={`p-2 rounded cursor-pointer hover:bg-muted ${selectedDocumentId === doc.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedDocumentId(doc.id)}
                      >
                        <div className="font-medium text-sm">{doc.title}</div>
                        <div className="text-xs text-muted-foreground">{doc.file_name}</div>
                      </div>
                    ))}
                  {filteredDocuments.filter(doc => !linkedDocumentIds.includes(doc.id)).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine verfügbaren Dokumente gefunden
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAdd} disabled={!selectedDocumentId || isSubmitting}>
              {isSubmitting ? "Füge hinzu..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
