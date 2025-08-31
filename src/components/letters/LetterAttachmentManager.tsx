import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Download, Trash2, FileText, Image, File, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
}

interface LetterAttachmentManagerProps {
  letterId: string;
  attachments: Attachment[];
  onAttachmentUpdate: () => void;
  readonly?: boolean;
}

const LetterAttachmentManager: React.FC<LetterAttachmentManagerProps> = ({
  letterId,
  attachments,
  onAttachmentUpdate,
  readonly = false
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return File;
    if (fileType.startsWith('image/')) return Image;
    if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
    return File;
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    console.log('Upload started', { files: files?.length, readonly, letterId, userId: user?.id });
    
    if (!files || files.length === 0 || readonly) {
      console.log('Upload cancelled: no files or readonly', { files: files?.length, readonly });
      return;
    }

    setUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log('Processing file:', { name: file.name, size: file.size, type: file.type });
        
        // File size limit (10MB)
        if (file.size > 10 * 1024 * 1024) {
          console.log('File too large:', file.name);
          toast({
            title: "Datei zu groß",
            description: `${file.name} ist größer als 10MB und wurde übersprungen.`,
            variant: "destructive",
          });
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${file.name}`;
        const filePath = `${letterId}/${fileName}`;
        
        console.log('Uploading to storage:', { filePath, bucketName: 'documents' });

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Upload-Fehler",
            description: `${file.name} konnte nicht hochgeladen werden: ${uploadError.message}`,
            variant: "destructive",
          });
          continue;
        }
        
        console.log('Storage upload successful:', uploadData);
        console.log('Inserting into database:', {
          letter_id: letterId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id
        });

        // Save attachment record
        const { data: insertData, error: insertError } = await supabase
          .from('letter_attachments')
          .insert({
            letter_id: letterId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id
          });

        if (insertError) {
          console.error('Database insert error:', insertError);
          // Clean up uploaded file
          await supabase.storage.from('documents').remove([filePath]);
          toast({
            title: "Datenbankfehler",
            description: `${file.name} konnte nicht gespeichert werden: ${insertError.message}`,
            variant: "destructive",
          });
          continue;
        }
        
        console.log('Database insert successful:', insertData);
      }

      console.log('All files processed, calling onAttachmentUpdate');
      onAttachmentUpdate();
      toast({
        title: "Upload erfolgreich",
        description: "Alle Dateien wurden erfolgreich hochgeladen.",
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload-Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [letterId, readonly, user?.id, onAttachmentUpdate, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (readonly) return;

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('letter_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([attachment.file_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      onAttachmentUpdate();
      toast({
        title: "Datei gelöscht",
        description: `${attachment.file_name} wurde erfolgreich gelöscht.`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Lösch-Fehler",
        description: "Die Datei konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Anlagen
          <Badge variant="secondary">{attachments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readonly && (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              id={`file-upload-${letterId}`}
              disabled={uploading}
            />
            <label
              htmlFor={`file-upload-${letterId}`}
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="text-sm text-muted-foreground">
                {uploading ? (
                  "Dateien werden hochgeladen..."
                ) : (
                  <>
                    <span className="font-medium">Dateien hochladen</span>
                    <br />
                    Ziehen Sie Dateien hierher oder klicken Sie zum Auswählen
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Maximale Dateigröße: 10MB
              </div>
            </label>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.file_type);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {attachment.file_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file_size)}
                        {attachment.file_type && ` • ${attachment.file_type}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!readonly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(attachment)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {attachments.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Keine Anlagen vorhanden</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LetterAttachmentManager;