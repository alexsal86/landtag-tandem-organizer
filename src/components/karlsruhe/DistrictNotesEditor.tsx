import { useState, useEffect } from 'react';
import { useDistrictNotes } from '@/hooks/useDistrictNotes';
import { KarlsruheDistrict } from '@/hooks/useKarlsruheDistricts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Save, FileText, Loader2 } from 'lucide-react';

interface DistrictNotesEditorProps {
  district: KarlsruheDistrict;
}

export const DistrictNotesEditor = ({ district }: DistrictNotesEditorProps) => {
  const { note, isLoading, saveNote } = useDistrictNotes(district.id);
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setContent(note?.content || '');
    setHasChanges(false);
  }, [note]);

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(value !== (note?.content || ''));
  };

  const handleSave = async () => {
    await saveNote.mutateAsync(content);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notizen: {district.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Notizen zu diesem Stadtteil eingeben..."
          rows={6}
          className="resize-none"
        />
        
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {note?.updated_at && (
              <>Zuletzt aktualisiert: {new Date(note.updated_at).toLocaleDateString('de-DE')}</>
            )}
          </div>
          
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || saveNote.isPending}
            size="sm"
          >
            {saveNote.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
