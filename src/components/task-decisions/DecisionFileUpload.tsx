import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, File, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id?: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  uploaded_by?: string;
  uploader_name?: string;
  created_at?: string;
}

interface DecisionFileUploadProps {
  decisionId: string;
  onFilesChange?: () => void;
  canUpload?: boolean;
}

export function DecisionFileUpload({ 
  decisionId, 
  onFilesChange,
  canUpload = true
}: DecisionFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadExistingFiles();
  }, [decisionId]);

  const loadExistingFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('task_decision_attachments')
        .select('*')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get uploader profiles separately
      const uploaderIds = data?.map(f => f.uploaded_by).filter(Boolean) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', uploaderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const formattedFiles = data?.map(file => ({
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        file_size: file.file_size,
        file_type: file.file_type,
        uploaded_by: file.uploaded_by,
        uploader_name: profileMap.get(file.uploaded_by)?.display_name || 'Unbekannt',
        created_at: file.created_at
      })) || [];

      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (!canUpload) return;

    setUploading(true);

    for (const file of Array.from(selectedFiles)) {
      try {
        // Get user ID for file path structure
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const fileName = `${user.id}/decisions/${decisionId}/${Date.now()}-${file.name}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('decision-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from('task_decision_attachments')
          .insert({
            decision_id: decisionId,
            file_path: uploadData.path,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id!
          });

        if (dbError) throw dbError;

        toast({
          title: "Datei hochgeladen",
          description: `${file.name} wurde erfolgreich hochgeladen.`,
        });

      } catch (error) {
        console.error('Upload error:', error);
        toast({
          title: "Upload fehlgeschlagen",
          description: `${file.name} konnte nicht hochgeladen werden.`,
          variant: "destructive",
        });
      }
    }

    setUploading(false);
    loadExistingFiles();
    onFilesChange?.();
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('decision-attachments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download gestartet",
        description: `${fileName} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download fehlgeschlagen",
        description: "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const removeFile = async (fileId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('decision-attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('task_decision_attachments')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast({
        title: "Datei gelöscht",
        description: "Die Datei wurde erfolgreich gelöscht.",
      });

      loadExistingFiles();
      onFilesChange?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Löschung fehlgeschlagen",
        description: "Die Datei konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canDelete = async (fileUploadedBy: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user is the uploader
    if (fileUploadedBy === user.id) return true;

    // Check if user is the decision creator
    const { data: decision } = await supabase
      .from('task_decisions')
      .select('created_by')
      .eq('id', decisionId)
      .single();

    return decision?.created_by === user.id;
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Wird hochgeladen...' : 'Dateien auswählen'}
          </Button>
        </div>
      )}

      {files.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center space-x-2 flex-1">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)} • {file.uploader_name}
                        {file.created_at && ` • ${new Date(file.created_at).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(file.file_path, file.file_name)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {file.uploaded_by && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (await canDelete(file.uploaded_by!)) {
                            removeFile(file.id!, file.file_path);
                          } else {
                            toast({
                              title: "Keine Berechtigung",
                              description: "Sie können nur Ihre eigenen Dateien löschen.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Noch keine Dateien hochgeladen
        </p>
      )}
    </div>
  );
}