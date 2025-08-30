import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Trash2, Download, Paperclip } from 'lucide-react';

interface LetterAttachment {
  id: string;
  letter_id: string;
  document_id?: string;
  file_name: string;
  file_path?: string;
  file_size?: number;
  created_at: string;
}

interface LetterAttachmentManagerProps {
  letterId?: string;
  attachments?: string[];
  onAttachmentsChange?: (attachments: string[]) => void;
  disabled?: boolean;
}

export const LetterAttachmentManager: React.FC<LetterAttachmentManagerProps> = ({
  letterId,
  attachments = [],
  onAttachmentsChange,
  disabled = false
}) => {
  const [letterAttachments, setLetterAttachments] = useState<LetterAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (letterId) {
      fetchAttachments();
    }
  }, [letterId]);

  const fetchAttachments = async () => {
    if (!letterId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('letter_attachments')
        .select('*')
        .eq('letter_id', letterId)
        .order('created_at');

      if (error) throw error;
      setLetterAttachments(data || []);
      
      // Update parent component with attachment names
      const attachmentNames = data?.map(att => att.file_name) || [];
      onAttachmentsChange?.(attachmentNames);
    } catch (error) {
      console.error('Fehler beim Laden der Anlagen:', error);
      toast({
        title: "Fehler",
        description: "Anlagen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !letterId || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `letters/${letterId}/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save attachment record
        const { error: insertError } = await supabase
          .from('letter_attachments')
          .insert({
            letter_id: letterId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size
          });

        if (insertError) throw insertError;
      }

      toast({
        title: "Erfolg",
        description: `${files.length} Datei(en) wurden hochgeladen.`
      });

      fetchAttachments();
    } catch (error) {
      console.error('Fehler beim Upload:', error);
      toast({
        title: "Upload Fehler",
        description: "Dateien konnten nicht hochgeladen werden.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, filePath?: string) => {
    try {
      // Delete from database
      const { error: deleteError } = await supabase
        .from('letter_attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) throw deleteError;

      // Delete from storage if file path exists
      if (filePath) {
        await supabase.storage
          .from('documents')
          .remove([filePath]);
      }

      toast({
        title: "Erfolg",
        description: "Anlage wurde gelöscht."
      });

      fetchAttachments();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: "Fehler",
        description: "Anlage konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadAttachment = async (attachment: LetterAttachment) => {
    if (!attachment.file_path) return;

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
      console.error('Fehler beim Download:', error);
      toast({
        title: "Download Fehler",
        description: "Datei konnte nicht heruntergeladen werden.",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unbekannt';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Anlagen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        {!disabled && letterId && (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Dateien per Drag & Drop hinzufügen oder
              </p>
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button disabled={uploading} variant="outline" size="sm" asChild>
                  <span>
                    {uploading ? 'Lade hoch...' : 'Dateien auswählen'}
                  </span>
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        )}

        {/* Attachment List */}
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">
            Lade Anlagen...
          </div>
        ) : (
          <div className="space-y-2">
            {letterAttachments.length > 0 ? (
              letterAttachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file_size)} • {new Date(attachment.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment.id, attachment.file_path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-4">
                Keine Anlagen vorhanden
              </div>
            )}
          </div>
        )}

        {/* Attachment List Preview for non-database attachments */}
        {attachments.length > 0 && !letterId && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Geplante Anlagen:</p>
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {attachment}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};