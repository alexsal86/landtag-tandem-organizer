import React, { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Image, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadDialogProps {
  onInsert: (src: string, alt: string) => void;
  onCancel: () => void;
}

const ImageUploadDialog: React.FC<ImageUploadDialogProps> = ({ onInsert, onCancel }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setImageUrl(data.publicUrl);
      toast({
        title: "Erfolg",
        description: "Bild erfolgreich hochgeladen",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Hochladen des Bildes",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-96">
      <CardContent className="p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Bild-URL</label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>
        
        <div>
          <label className="text-sm font-medium">Alt-Text</label>
          <Input
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Beschreibung des Bildes"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Oder Datei hochladen</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            disabled={uploading}
          />
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={() => onInsert(imageUrl, altText)}
            disabled={!imageUrl || uploading}
          >
            <Image className="h-4 w-4 mr-2" />
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

export function ImagePlugin() {
  const [editor] = useLexicalComposerContext();
  const [showDialog, setShowDialog] = useState(false);

  const insertImage = (src: string, alt: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const imageText = $createTextNode(`![${alt}](${src})`);
        selection.insertNodes([imageText]);
      }
    });
    setShowDialog(false);
  };

  return (
    <>
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <ImageUploadDialog
            onInsert={insertImage}
            onCancel={() => setShowDialog(false)}
          />
        </div>
      )}
    </>
  );
}

