import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, File, AlertCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id?: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type?: string;
  uploaded: boolean;
  uploading: boolean;
  error?: string;
}

interface AppointmentPreparationFileUploadProps {
  preparationId: string;
  tenantId: string;
}

export function AppointmentPreparationFileUpload({ 
  preparationId, 
  tenantId 
}: AppointmentPreparationFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load existing files
  useEffect(() => {
    loadFiles();
  }, [preparationId]);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_preparation_documents')
        .select('*')
        .eq('preparation_id', preparationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const loadedFiles: UploadedFile[] = (data || []).map(doc => ({
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size: doc.file_size,
        file_type: doc.file_type,
        uploaded: true,
        uploading: false
      }));

      setFiles(loadedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Fehler",
        description: "Dateien konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesToUpload = Array.from(selectedFiles);
    await uploadFiles(filesToUpload);
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true);
    
    for (const file of filesToUpload) {
      const tempFile: UploadedFile = {
        file_name: file.name,
        file_path: '',
        file_size: file.size,
        file_type: file.type,
        uploaded: false,
        uploading: true
      };

      setFiles(prev => [...prev, tempFile]);

      try {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${tenantId}/preparations/${preparationId}/${fileName}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('planning-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Save to database
        const { data: docData, error: dbError } = await supabase
          .from('appointment_preparation_documents')
          .insert({
            preparation_id: preparationId,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: user.id
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Update file list
        setFiles(prev => prev.map(f => 
          f.file_name === file.name && f.uploading ? {
            id: docData.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded: true,
            uploading: false
          } : f
        ));

        toast({
          title: "Datei hochgeladen",
          description: `${file.name} wurde erfolgreich hochgeladen.`,
        });

      } catch (error) {
        console.error('Upload error:', error);
        
        setFiles(prev => prev.map(f => 
          f.file_name === file.name && f.uploading ? {
            ...f,
            uploading: false,
            error: 'Upload fehlgeschlagen'
          } : f
        ));

        toast({
          title: "Upload fehlgeschlagen",
          description: `${file.name} konnte nicht hochgeladen werden.`,
          variant: "destructive",
        });
      }
    }

    setUploading(false);
  };

  const downloadFile = async (file: UploadedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('planning-documents')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download gestartet",
        description: `${file.file_name} wird heruntergeladen.`,
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

  const removeFile = async (file: UploadedFile) => {
    if (!file.id) return;

    try {
      // Delete from storage
      if (file.file_path) {
        await supabase.storage
          .from('planning-documents')
          .remove([file.file_path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('appointment_preparation_documents')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== file.id));

      toast({
        title: "Datei gelöscht",
        description: `${file.file_name} wurde gelöscht.`,
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          {uploading ? 'Wird hochgeladen...' : 'Dateien hochladen'}
        </Button>
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={file.id || index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {file.uploading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                    {file.error && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    {file.uploaded && !file.uploading && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(file)}
                          title="Herunterladen"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file)}
                          title="Löschen"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {files.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Dokumente hochgeladen</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
