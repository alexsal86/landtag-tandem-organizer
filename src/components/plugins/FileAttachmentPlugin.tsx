import React, { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Upload, File, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FileUploadDialogProps {
  onInsert: (src: string, name: string, type: string) => void;
  onCancel: () => void;
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({ onInsert, onCancel }) => {
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setFileUrl(data.publicUrl);
      setFileName(file.name);
      
      toast({
        title: "Erfolg",
        description: "Datei erfolgreich hochgeladen",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Hochladen der Datei",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
    return '📎';
  };

  return (
    <Card className="w-96">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Datei anhängen</h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium">Datei hochladen</label>
          <Input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Word, Excel, PowerPoint, Text-Dateien
          </p>
        </div>

        {fileUrl && (
          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getFileIcon(fileName)}</span>
              <span className="font-medium">{fileName}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => onInsert(fileUrl, fileName, 'file')}
            disabled={!fileUrl || uploading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Einfügen
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export function FileAttachmentPlugin() {
  const [editor] = useLexicalComposerContext();
  const [showDialog, setShowDialog] = useState(false);

  const insertFile = (src: string, name: string, type: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Insert as clickable file link
        const fileText = $createTextNode(`📎 [${name}](${src})`);
        selection.insertNodes([fileText]);
      }
    });
    setShowDialog(false);
  };

  return (
    <>
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <FileUploadDialog
            onInsert={insertFile}
            onCancel={() => setShowDialog(false)}
          />
        </div>
      )}
    </>
  );
}