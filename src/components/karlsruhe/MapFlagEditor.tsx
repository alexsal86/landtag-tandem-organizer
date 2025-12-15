import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMapFlags, MapFlag } from '@/hooks/useMapFlags';
import { useMapFlagTypes } from '@/hooks/useMapFlagTypes';
import { useMapFlagTopics } from '@/hooks/useMapFlagTopics';
import { TopicSelector } from '@/components/topics/TopicSelector';

interface MapFlagEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  editFlag?: MapFlag | null;
}

export const MapFlagEditor = ({ open, onOpenChange, coordinates, editFlag }: MapFlagEditorProps) => {
  const { createFlag, updateFlag } = useMapFlags();
  const { flagTypes } = useMapFlagTypes();
  const { topicIds: existingTopicIds, saveTopics } = useMapFlagTopics(editFlag?.id);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [flagTypeId, setFlagTypeId] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  useEffect(() => {
    if (editFlag) {
      setTitle(editFlag.title);
      setDescription(editFlag.description || '');
      setFlagTypeId(editFlag.flag_type_id);
      setSelectedTopicIds(existingTopicIds);
    } else {
      setTitle('');
      setDescription('');
      setFlagTypeId(flagTypes[0]?.id || '');
      setSelectedTopicIds([]);
    }
  }, [editFlag, flagTypes, existingTopicIds]);

  const handleSave = async () => {
    if (!title.trim() || !flagTypeId) return;

    if (editFlag) {
      await updateFlag.mutateAsync({
        id: editFlag.id,
        updates: { title, description, flag_type_id: flagTypeId },
      });
      await saveTopics.mutateAsync({ flagId: editFlag.id, topicIds: selectedTopicIds });
    } else if (coordinates) {
      const result = await createFlag.mutateAsync({
        title,
        description,
        flag_type_id: flagTypeId,
        coordinates,
        metadata: {},
        tags: [],
      });
      // Save topics for the new flag
      if (result?.id && selectedTopicIds.length > 0) {
        await saveTopics.mutateAsync({ flagId: result.id, topicIds: selectedTopicIds });
      }
    }

    onOpenChange(false);
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
            <Label>Themen</Label>
            <TopicSelector
              selectedTopicIds={selectedTopicIds}
              onTopicsChange={setSelectedTopicIds}
              placeholder="Themen auswählen..."
            />
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
