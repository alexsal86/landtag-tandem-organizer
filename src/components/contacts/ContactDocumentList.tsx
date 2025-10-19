import { FileText, Download, ExternalLink, X, File, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Document, DirectDocument } from "@/hooks/useContactDocuments";

interface ContactDocumentListProps {
  documents: (Document | DirectDocument)[];
  type: 'direct' | 'tagged';
  contactTags?: string[];
  onRemove?: (documentContactId: string) => Promise<void>;
}

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="h-5 w-5 text-blue-500" />;
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <ImageIcon className="h-5 w-5 text-purple-500" />;
    default:
      return <File className="h-5 w-5 text-muted-foreground" />;
  }
};

const isDirectDocument = (doc: Document | DirectDocument): doc is DirectDocument => {
  return 'relationship_type' in doc && 'document_contact_id' in doc;
};

export function ContactDocumentList({ documents, type, contactTags = [], onRemove }: ContactDocumentListProps) {
  const { toast } = useToast();
  const [removingDocId, setRemovingDocId] = useState<string | null>(null);

  const handleDownload = async (document: Document | DirectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Download gestartet",
        description: `${document.file_name} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Fehler",
        description: "Dokument konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async (documentContactId: string) => {
    if (!onRemove) return;

    try {
      await onRemove(documentContactId);
      toast({
        title: "Verknüpfung entfernt",
        description: "Das Dokument wurde vom Kontakt getrennt.",
      });
      setRemovingDocId(null);
    } catch (error) {
      console.error('Error removing document link:', error);
      toast({
        title: "Fehler",
        description: "Verknüpfung konnte nicht entfernt werden.",
        variant: "destructive",
      });
    }
  };

  const getCommonTags = (docTags: string[] = []) => {
    return docTags.filter(tag => contactTags.includes(tag));
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {type === 'direct' 
          ? "Noch keine Dokumente direkt verknüpft"
          : "Keine Dokumente mit gemeinsamen Tags gefunden"
        }
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {documents.map((doc) => {
          const commonTags = type === 'tagged' ? getCommonTags(doc.tags) : [];
          const isDirectDoc = isDirectDocument(doc);

          return (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getFileIcon(doc.file_name)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{doc.file_name}</p>
                      </div>
                      
                      <div className="flex gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Herunterladen</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(`/documents?id=${doc.id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Details anzeigen</TooltipContent>
                        </Tooltip>

                        {type === 'direct' && isDirectDoc && onRemove && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setRemovingDocId(doc.document_contact_id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Verknüpfung entfernen</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {doc.category && (
                        <Badge variant="outline" className="text-xs">
                          {doc.category}
                        </Badge>
                      )}
                      
                      {isDirectDoc && (
                        <Badge variant="secondary" className="text-xs">
                          {doc.relationship_type}
                        </Badge>
                      )}

                      {type === 'tagged' && commonTags.map(tag => (
                        <Badge key={tag} variant="default" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {isDirectDoc && doc.relationship_notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        {doc.relationship_notes}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <AlertDialog open={!!removingDocId} onOpenChange={() => setRemovingDocId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Verknüpfung entfernen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie die Verknüpfung zwischen diesem Dokument und dem Kontakt wirklich entfernen? 
                Das Dokument selbst bleibt erhalten und wird nur vom Kontakt getrennt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => removingDocId && handleRemove(removingDocId)}>
                Verknüpfung entfernen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
