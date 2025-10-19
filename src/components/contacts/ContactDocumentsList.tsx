import { useState } from "react";
import { FileText, Download, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useContactDocuments } from "@/hooks/useContactDocuments";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContactDocumentsListProps {
  contactId: string;
  contactTags?: string[];
  documentCount: {
    direct: number;
    tagged: number;
    total: number;
  };
}

export function ContactDocumentsList({ contactId, contactTags = [], documentCount }: ContactDocumentsListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { directDocuments, taggedDocuments, loading } = useContactDocuments(contactId, contactTags);
  const { toast } = useToast();

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toast({
        title: "Download erfolgreich",
        description: `${fileName} wurde heruntergeladen.`,
      });
    } catch (error: any) {
      toast({
        title: "Download-Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (documentCount.total === 0) {
    return (
      <span className="text-muted-foreground text-sm">—</span>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="inline-flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="gap-1 cursor-pointer hover:bg-muted"
                >
                  <FileText className="h-3 w-3" />
                  {documentCount.total}
                  <ChevronRight className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Dokumente:</p>
                  <p>Direkt: {documentCount.direct}</p>
                  <p>Tags: {documentCount.tagged}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
          {loading ? (
            <p className="text-xs text-muted-foreground">Lade Dokumente...</p>
          ) : (
            <>
              {directDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Direkt verknüpft:</p>
                  {directDocuments.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between gap-2 p-2 bg-background rounded border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc.file_path, doc.file_name);
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {taggedDocuments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Über Tags:</p>
                  {taggedDocuments.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="flex items-center justify-between gap-2 p-2 bg-background rounded border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc.file_path, doc.file_name);
                        }}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {directDocuments.length === 0 && taggedDocuments.length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Dokumente gefunden.</p>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
