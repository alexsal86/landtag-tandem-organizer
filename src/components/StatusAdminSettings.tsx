import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, GripVertical, Palette } from 'lucide-react';
import { StatusOption } from '@/hooks/useUserStatus';
import { EmojiPicker } from './EmojiPicker';

export const StatusAdminSettings: React.FC = () => {
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<StatusOption | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    emoji: '',
    color: '#3b82f6',
    is_active: true
  });

  useEffect(() => {
    loadStatusOptions();
  }, []);

  const loadStatusOptions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_status_options')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error loading status options:', error);
      toast.error('Fehler beim Laden der Status-Optionen');
    } else {
      setStatusOptions(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      emoji: '',
      color: '#3b82f6',
      is_active: true
    });
    setEditingOption(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (option: StatusOption) => {
    setFormData({
      name: option.name,
      emoji: option.emoji || '',
      color: option.color,
      is_active: true // Will be loaded from DB
    });
    setEditingOption(option);
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    try {
      console.log('Attempting to save status option:', formData);
      const statusData = {
        name: formData.name.trim(),
        emoji: formData.emoji || null,
        color: formData.color,
        is_active: formData.is_active,
        sort_order: editingOption?.sort_order || statusOptions.length
      };
      console.log('Status data to save:', statusData);

      if (editingOption) {
        // Update existing option
        console.log('Updating existing option with ID:', editingOption.id);
        const { error } = await supabase
          .from('admin_status_options')
          .update(statusData)
          .eq('id', editingOption.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        toast.success('Status-Option aktualisiert');
      } else {
        // Create new option
        console.log('Creating new status option');
        const { error } = await supabase
          .from('admin_status_options')
          .insert(statusData);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        toast.success('Status-Option erstellt');
      }

      setIsCreateDialogOpen(false);
      resetForm();
      loadStatusOptions();
    } catch (error) {
      console.error('Error saving status option:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error(`Fehler beim Speichern der Status-Option: ${error.message || 'Unbekannter Fehler'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diese Status-Option löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_status_options')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Status-Option gelöscht');
      loadStatusOptions();
    } catch (error) {
      console.error('Error deleting status option:', error);
      toast.error('Fehler beim Löschen der Status-Option');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_status_options')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Status-Option ${!isActive ? 'aktiviert' : 'deaktiviert'}`);
      loadStatusOptions();
    } catch (error) {
      console.error('Error toggling status option:', error);
      toast.error('Fehler beim Ändern der Status-Option');
    }
  };

  const predefinedColors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#84cc16', // Lime
    '#ec4899', // Pink
    '#6b7280'  // Gray
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status-Optionen verwalten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Status-Optionen verwalten</CardTitle>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Neue Option
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingOption ? 'Status-Option bearbeiten' : 'Neue Status-Option'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Online, In Besprechung"
                  />
                </div>

                <div>
                  <Label htmlFor="emoji">Emoji</Label>
                  <EmojiPicker
                    value={formData.emoji}
                    onEmojiSelect={(emoji) => setFormData(prev => ({ ...prev, emoji }))}
                  />
                </div>

                <div>
                  <Label htmlFor="color">Farbe</Label>
                  <div className="space-y-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-full h-10"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {predefinedColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-500 transition-colors"
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Aktiv</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="flex-1"
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingOption ? 'Aktualisieren' : 'Erstellen'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {statusOptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine Status-Optionen vorhanden.</p>
            <p className="text-sm">Erstellen Sie eine neue Option, um zu beginnen.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Reihenfolge</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[80px]">Emoji</TableHead>
                <TableHead className="w-[100px]">Farbe</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[120px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusOptions.map((option) => (
                <TableRow key={option.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <span className="text-sm">{option.sort_order}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{option.name}</TableCell>
                  <TableCell>
                    <span className="text-lg">{option.emoji}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: option.color }}
                      />
                      <span className="text-xs font-mono">{option.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={true} // All loaded options are active
                      onCheckedChange={() => handleToggleActive(option.id, true)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(option)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(option.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};