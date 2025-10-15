import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMapFlagTypes, MapFlagType } from '@/hooks/useMapFlagTypes';
import { useTags } from '@/hooks/useTags';
import { Settings, Plus, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TagIconPicker } from '@/components/contacts/TagIconPicker';
import { icons } from 'lucide-react';

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export const MapFlagTypeManager = () => {
  const { flagTypes, createFlagType, updateFlagType, deleteFlagType } = useMapFlagTypes();
  const { tags, loading: tagsLoading } = useTags();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingType, setEditingType] = useState<MapFlagType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [selectedIcon, setSelectedIcon] = useState('map-pin');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createFlagType.mutateAsync({
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      is_active: true,
      order_index: flagTypes.length,
      tag_filter: tagFilter || undefined,
      description: description.trim() || undefined,
    });

    setName('');
    setDescription('');
    setTagFilter(undefined);
    setSelectedIcon('map-pin');
    setSelectedColor('#3b82f6');
    setOpen(false);
  };

  const handleEdit = (type: MapFlagType) => {
    setEditingType(type);
    setName(type.name);
    setDescription(type.description || '');
    setTagFilter(type.tag_filter || undefined);
    setSelectedIcon(type.icon);
    setSelectedColor(type.color);
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingType || !name.trim()) return;

    await updateFlagType.mutateAsync({
      id: editingType.id,
      updates: {
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        tag_filter: tagFilter || undefined,
        description: description.trim() || undefined,
      },
    });

    setName('');
    setDescription('');
    setTagFilter(undefined);
    setSelectedIcon('map-pin');
    setSelectedColor('#3b82f6');
    setEditingType(null);
    setEditOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Flaggentypen verwalten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Flaggentypen verwalten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing flag types */}
          <div className="space-y-2">
            <Label>Vorhandene Flaggentypen</Label>
            <div className="grid gap-2">
              {flagTypes.map((type) => {
                const Icon = icons[type.icon as keyof typeof icons];
                return (
                  <Card key={type.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {Icon ? (
                        <Icon className="h-5 w-5 flex-shrink-0" style={{ color: type.color }} />
                      ) : (
                        <span className="text-xl">{type.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="font-medium">{type.name}</span>
                        </div>
                        {type.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {type.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(type)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFlagType.mutate(type.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Create new flag type */}
          <div className="space-y-4 pt-4 border-t">
            <Label>Neuen Flaggentyp erstellen</Label>
            
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Veranstaltungen"
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschreiben Sie den Verwendungszweck dieses Flaggentyps..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tag für Kontakt-Filter (optional)</Label>
              <Select
                value={tagFilter}
                onValueChange={(value) => setTagFilter(value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen Sie einen Tag aus..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Filter</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kontakte mit diesem Tag werden automatisch auf der Karte angezeigt
              </p>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex items-center gap-2">
                <TagIconPicker
                  value={selectedIcon}
                  onChange={setSelectedIcon}
                />
                <span className="text-sm text-muted-foreground">
                  Über 1000 Icons verfügbar - durchsuchen Sie die Sammlung
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color 
                        ? 'border-primary scale-110' 
                        : 'border-border hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button 
              onClick={handleCreate} 
              disabled={!name.trim() || createFlagType.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Flaggentyp erstellen
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Flaggentyp bearbeiten</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Veranstaltungen"
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschreiben Sie den Verwendungszweck dieses Flaggentyps..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tag für Kontakt-Filter (optional)</Label>
              <Select
                value={tagFilter}
                onValueChange={(value) => setTagFilter(value === 'none' ? undefined : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen Sie einen Tag aus..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Filter</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.name}>
                      {tag.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kontakte mit diesem Tag werden automatisch auf der Karte angezeigt
              </p>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex items-center gap-2">
                <TagIconPicker
                  value={selectedIcon}
                  onChange={setSelectedIcon}
                />
                <span className="text-sm text-muted-foreground">
                  Über 1000 Icons verfügbar - durchsuchen Sie die Sammlung
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color 
                        ? 'border-primary scale-110' 
                        : 'border-border hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleUpdate} 
                disabled={!name.trim() || updateFlagType.isPending}
                className="flex-1"
              >
                Änderungen speichern
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingType(null);
                  setName('');
                  setDescription('');
                  setTagFilter(undefined);
                  setSelectedIcon('map-pin');
                  setSelectedColor('#3b82f6');
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

