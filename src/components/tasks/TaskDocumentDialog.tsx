import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Trash2, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface TaskDocument {
  id: string;
  task_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  user_id: string;
  created_at: string;
}

interface TaskDocumentDialogProps {
  taskId: string | null;
  taskTitle?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDocumentDialog({ 
  taskId, 
  taskTitle,
  isOpen, 
  onOpenChange 
}: TaskDocumentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TaskDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen && taskId) {
      loadDocuments();
    }
  }, [isOpen, taskId]);

  const loadDocuments = async () => {
    if (!taskId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('task_documents')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !user) return;
    
    setUploading(true);
    try {
      const fileName = `${user.id}/tasks/${taskId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('task_documents')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_path: fileName,
          file_size: file.size,
          file_type: file.type,
          user_id: user.id
        });

      if (dbError) throw dbError;

      await loadDocuments();
      toast({ title: "Dokument hochgeladen" });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({ title: "Fehler beim Hochladen", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc: TaskDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({ title: "Fehler beim Download", variant: "destructive" });
    }
  };

  const handleDelete = async (doc: TaskDocument) => {
    try {
      await supabase.storage
        .from('task-documents')
        .remove([doc.file_path]);

      const { error } = await supabase
        .from('task_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast({ title: "Dokument gelöscht" });
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dokumente</DialogTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground truncate">{taskTitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload */}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              onChange={handleUpload}
              className="hidden"
              id="document-upload"
              disabled={uploading}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => document.getElementById('document-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Wird hochgeladen..." : "Dokument hochladen"}
            </Button>
          </div>

          {/* Document list */}
          <ScrollArea className="h-[300px]">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Dokumente vorhanden
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-3 p-3 border rounded-lg group hover:bg-muted/50"
                  >
                    <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), "dd.MM.yy", { locale: de })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
