import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id?: string;
  file: File;
  path: string;
  uploaded: boolean;
  uploading: boolean;
  error?: string;
}

interface AppointmentFileUploadProps {
  appointmentId?: string;
  onFilesChange: (files: UploadedFile[]) => void;
  existingFiles?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string;
  }>;
}

export function AppointmentFileUpload({ 
  appointmentId, 
  onFilesChange, 
  existingFiles = [] 
}: AppointmentFileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      file,
      path: '',
      uploaded: false,
      uploading: false
    }));

    if (appointmentId) {
      // If we have an appointmentId, upload immediately
      await uploadFiles(newFiles);
    } else {
      // Otherwise, just add to pending files
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
    }
  };

  const uploadFiles = async (filesToUpload: UploadedFile[]) => {
    setUploading(true);
    
    const updatedFiles = [...files];
    
    for (const fileData of filesToUpload) {
      const index = updatedFiles.findIndex(f => f === fileData) !== -1 ? 
        updatedFiles.findIndex(f => f === fileData) : updatedFiles.length;
      
      if (index === updatedFiles.length) {
        updatedFiles.push(fileData);
      }
      
      updatedFiles[index] = { ...updatedFiles[index], uploading: true };
      setFiles([...updatedFiles]);

      try {
        const fileName = `appointment-${appointmentId}/${Date.now()}-${fileData.file.name}`;
        
        const { data, error } = await supabase.storage
          .from('documents')
          .upload(fileName, fileData.file);

        if (error) throw error;

        // Save to database
        const { data: docData, error: dbError } = await supabase
          .from('appointment_documents')
          .insert({
            appointment_id: appointmentId!,
            file_path: data.path,
            file_name: fileData.file.name,
            file_size: fileData.file.size,
            file_type: fileData.file.type,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id!
          })
          .select()
          .single();

        if (dbError) throw dbError;

        updatedFiles[index] = {
          ...updatedFiles[index],
          id: docData.id,
          path: data.path,
          uploaded: true,
          uploading: false
        };

        toast({
          title: "Datei hochgeladen",
          description: `${fileData.file.name} wurde erfolgreich hochgeladen.`,
        });

      } catch (error) {
        console.error('Upload error:', error);
        updatedFiles[index] = {
          ...updatedFiles[index],
          uploading: false,
          error: 'Upload fehlgeschlagen'
        };

        toast({
          title: "Upload fehlgeschlagen",
          description: `${fileData.file.name} konnte nicht hochgeladen werden.`,
          variant: "destructive",
        });
      }
    }

    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
    setUploading(false);
  };

  const removeFile = async (index: number) => {
    const fileToRemove = files[index];
    
    if (fileToRemove.uploaded && fileToRemove.id) {
      try {
        // Delete from storage
        if (fileToRemove.path) {
          await supabase.storage
            .from('documents')
            .remove([fileToRemove.path]);
        }

        // Delete from database
        await supabase
          .from('appointment_documents')
          .delete()
          .eq('id', fileToRemove.id);

        toast({
          title: "Datei gelöscht",
          description: `${fileToRemove.file.name} wurde gelöscht.`,
        });
      } catch (error) {
        console.error('Delete error:', error);
        toast({
          title: "Löschung fehlgeschlagen",
          description: "Die Datei konnte nicht gelöscht werden.",
          variant: "destructive",
        });
        return;
      }
    }

    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const allFiles = [
    ...existingFiles.map(file => ({
      id: file.id,
      file: { name: file.file_name, size: file.file_size } as File,
      path: file.file_path,
      uploaded: true,
      uploading: false
    })),
    ...files
  ];

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
          {uploading ? 'Uploading...' : 'Dateien auswählen'}
        </Button>
      </div>

      {allFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {allFiles.map((fileData, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center space-x-2">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {fileData.file.name || `Datei ${index + 1}`}
                      </p>
                      {fileData.file.size > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(fileData.file.size)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {fileData.uploading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                    {('error' in fileData && fileData.error) && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={fileData.uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
