import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMapFlagTypes, MapFlagType } from '@/hooks/useMapFlagTypes';
import { Settings, Plus, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';

const PRESET_ICONS = ['📍', '🚧', '🎉', '⚠️', '🏗️', '🌳', '🏢', '🚶', '🚲', '🚗'];
const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export const MapFlagTypeManager = () => {
  const { flagTypes, createFlagType, updateFlagType, deleteFlagType } = useMapFlagTypes();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingType, setEditingType] = useState<MapFlagType | null>(null);
  const [name, setName] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📍');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const handleCreate = async () => {
    if (!name.trim()) return;

    await createFlagType.mutateAsync({
      name: name.trim(),
      icon: selectedIcon,
      color: selectedColor,
      is_active: true,
      order_index: flagTypes.length,
      tag_filter: tagFilter.trim() || undefined,
    });

    setName('');
    setTagFilter('');
    setSelectedIcon('📍');
    setSelectedColor('#3b82f6');
    setOpen(false);
  };

  const handleEdit = (type: MapFlagType) => {
    setEditingType(type);
    setName(type.name);
    setTagFilter(type.tag_filter || '');
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
        tag_filter: tagFilter.trim() || undefined,
      },
    });

    setName('');
    setTagFilter('');
    setSelectedIcon('📍');
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
              {flagTypes.map((type) => (
                <Card key={type.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="font-medium">{type.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
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
              ))}
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
              <Label>Tag für Kontakt-Filter</Label>
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="z.B. schule, kita, spielplatz"
              />
              <p className="text-xs text-muted-foreground">
                Kontakte mit diesem Tag werden automatisch auf der Karte angezeigt
              </p>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={`text-2xl p-2 rounded border-2 transition-all ${
                      selectedIcon === icon 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
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
              <Label>Tag für Kontakt-Filter</Label>
              <Input
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="z.B. schule, kita, spielplatz"
              />
              <p className="text-xs text-muted-foreground">
                Kontakte mit diesem Tag werden automatisch auf der Karte angezeigt
              </p>
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={`text-2xl p-2 rounded border-2 transition-all ${
                      selectedIcon === icon 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
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
                  setTagFilter('');
                  setSelectedIcon('📍');
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

