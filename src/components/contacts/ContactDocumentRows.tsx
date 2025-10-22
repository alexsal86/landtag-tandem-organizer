import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, ExternalLink } from "lucide-react";
import { useContactDocuments } from "@/hooks/useContactDocuments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactDocumentRowsProps {
  contactId: string;
  contactTags: string[];
}

export function ContactDocumentRows({ contactId, contactTags }: ContactDocumentRowsProps) {
  const { directDocuments, taggedDocuments, loading } = useContactDocuments(contactId, contactTags);

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      toast.error('Fehler beim Herunterladen des Dokuments');
    }
  };

  const handleOpenDocument = (documentId: string) => {
    window.open(`/documents?id=${documentId}`, '_blank');
  };

  if (loading) {
    return (
      <TableRow className="bg-muted/30 border-l-4 border-l-primary/30">
        <TableCell colSpan={8} className="text-center py-4">
          <span className="text-sm text-muted-foreground">Laden...</span>
        </TableCell>
      </TableRow>
    );
  }

  const allDocuments = [...directDocuments, ...taggedDocuments];

  if (allDocuments.length === 0) {
    return (
      <TableRow className="bg-muted/30 border-l-4 border-l-primary/30">
        <TableCell colSpan={8} className="text-center py-4">
          <span className="text-sm text-muted-foreground">Keine Dokumente gefunden</span>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {directDocuments.length > 0 && (
        <TableRow className="bg-muted/30 border-l-4 border-l-blue-500/30">
          <TableCell colSpan={8} className="py-2">
            <div className="flex items-center gap-2 pl-8">
              <Badge variant="default" className="text-xs">
                Direkt verknüpft ({directDocuments.length})
              </Badge>
            </div>
          </TableCell>
        </TableRow>
      )}
      {directDocuments.map((doc) => (
        <TableRow 
          key={`direct-${doc.id}`} 
          className="bg-muted/30 border-l-4 border-l-blue-500/30"
        >
          <TableCell></TableCell>
          <TableCell colSpan={3}>
            <div className="flex items-center gap-2 pl-8">
              <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
                <FileText className="h-3 w-3 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <div className="font-medium text-sm">{doc.title}</div>
                <div className="text-xs text-muted-foreground">
                  {doc.file_name}
                </div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            {doc.category && (
              <Badge variant="outline" className="text-xs">
                {doc.category}
              </Badge>
            )}
          </TableCell>
          <TableCell colSpan={2}>
            {doc.tags && doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {doc.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {doc.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{doc.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(doc.file_path, doc.file_name)}
                className="h-6 w-6 p-0"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDocument(doc.id)}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
      
      {taggedDocuments.length > 0 && (
        <TableRow className="bg-muted/30 border-l-4 border-l-green-500/30">
          <TableCell colSpan={8} className="py-2">
            <div className="flex items-center gap-2 pl-8">
              <Badge variant="secondary" className="text-xs">
                Über Tags ({taggedDocuments.length})
              </Badge>
            </div>
          </TableCell>
        </TableRow>
      )}
      {taggedDocuments.map((doc) => (
        <TableRow 
          key={`tagged-${doc.id}`} 
          className="bg-muted/30 border-l-4 border-l-green-500/30"
        >
          <TableCell></TableCell>
          <TableCell colSpan={3}>
            <div className="flex items-center gap-2 pl-8">
              <div className="p-1 bg-green-100 dark:bg-green-900 rounded">
                <FileText className="h-3 w-3 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <div className="font-medium text-sm">{doc.title}</div>
                <div className="text-xs text-muted-foreground">{doc.file_name}</div>
              </div>
            </div>
          </TableCell>
          <TableCell>
            {doc.category && (
              <Badge variant="outline" className="text-xs">
                {doc.category}
              </Badge>
            )}
          </TableCell>
          <TableCell colSpan={2}>
            {doc.tags && doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {doc.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {doc.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{doc.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDownload(doc.file_path, doc.file_name)}
                className="h-6 w-6 p-0"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenDocument(doc.id)}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
