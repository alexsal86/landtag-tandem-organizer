import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMapFlags } from '@/hooks/useMapFlags';
import { useMapFlagTypes } from '@/hooks/useMapFlagTypes';
import { useTags } from '@/hooks/useTags';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface MapFlagEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  editFlag?: any;
}

export const MapFlagEditor = ({ open, onOpenChange, coordinates, editFlag }: MapFlagEditorProps) => {
  const { createFlag, updateFlag } = useMapFlags();
  const { flagTypes } = useMapFlagTypes();
  const { tags, loading: tagsLoading } = useTags();
  
  console.log('Tags geladen:', tags.length, 'Loading:', tagsLoading);
  console.log('Tags:', tags);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [flagTypeId, setFlagTypeId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (editFlag) {
      setTitle(editFlag.title);
      setDescription(editFlag.description || '');
      setFlagTypeId(editFlag.flag_type_id);
      setSelectedTags(editFlag.tags || []);
    } else {
      setTitle('');
      setDescription('');
      setFlagTypeId(flagTypes[0]?.id || '');
      setSelectedTags([]);
    }
  }, [editFlag, flagTypes]);

  const handleSave = async () => {
    if (!title.trim() || !flagTypeId) return;

    console.log('Speichere Flagge mit Tags:', selectedTags);

    if (editFlag) {
      await updateFlag.mutateAsync({
        id: editFlag.id,
        updates: { title, description, flag_type_id: flagTypeId, tags: selectedTags },
      });
    } else if (coordinates) {
      await createFlag.mutateAsync({
        title,
        description,
        flag_type_id: flagTypeId,
        coordinates,
        metadata: {},
        tags: selectedTags,
      });
    }

    onOpenChange(false);
  };

  const toggleTag = (tagLabel: string) => {
    setSelectedTags(prev => 
      prev.includes(tagLabel) 
        ? prev.filter(t => t !== tagLabel)
        : [...prev, tagLabel]
    );
  };

  if (flagTypes.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keine Flaggentypen vorhanden</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Bitte erstellen Sie zuerst einen Flaggentyp über "Flaggentypen verwalten".
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editFlag ? 'Flagge bearbeiten' : 'Neue Flagge setzen'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Sommerfest 2025"
            />
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Weitere Details..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Flaggentyp</Label>
            <Select value={flagTypeId} onValueChange={setFlagTypeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {flagTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center gap-2">
                      <span>{type.icon}</span>
                      <span>{type.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Verknüpfte Stakeholder-Tags</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Stakeholder mit diesen Tags werden an dieser Flagge angezeigt
            </div>
            <div className="flex flex-wrap gap-2 p-3 border border-border rounded-md min-h-[60px]">
              {tagsLoading ? (
                <span className="text-sm text-muted-foreground">Lade Tags...</span>
              ) : tags.length === 0 ? (
                <span className="text-sm text-muted-foreground">Keine Tags verfügbar</span>
              ) : (
                tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.label);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      style={isSelected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                      onClick={() => toggleTag(tag.label)}
                    >
                      {tag.icon && <span className="mr-1">{tag.icon}</span>}
                      {tag.label}
                      {isSelected && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                  );
                })
              )}
            </div>
            {selectedTags.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedTags.length} Tag{selectedTags.length !== 1 ? 's' : ''} ausgewählt
              </div>
            )}
          </div>

          {coordinates && !editFlag && (
            <div className="text-sm text-muted-foreground">
              Position: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Abbrechen
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!title.trim() || !flagTypeId}
              className="flex-1"
            >
              {editFlag ? 'Aktualisieren' : 'Flagge setzen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
