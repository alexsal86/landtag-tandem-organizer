import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface InformationBlock {
  id: string;
  name: string;
  label: string;
  block_data: any;
  block_type: string;
  is_default: boolean;
  is_active: boolean;
}

export const InformationBlockManager: React.FC = () => {
  const [blocks, setBlocks] = useState<InformationBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBlock, setEditingBlock] = useState<InformationBlock | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<InformationBlock>>({
    block_type: 'contact',
    is_default: false,
    is_active: true,
    block_data: {}
  });

  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  const blockTypes = [
    { value: 'contact', label: 'Kontaktperson' },
    { value: 'date', label: 'Datum/Zeit' },
    { value: 'reference', label: 'Aktenzeichen/Referenz' },
    { value: 'custom', label: 'Benutzerdefiniert' }
  ];

  useEffect(() => {
    if (currentTenant) {
      fetchBlocks();
    }
  }, [currentTenant]);

  const fetchBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from('information_blocks')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Informationsblöcke:', error);
      toast({
        title: "Fehler",
        description: "Informationsblöcke konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderBlockDataFields = () => {
    const blockType = formData.block_type;
    const blockData = formData.block_data || {};

    switch (blockType) {
      case 'contact':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_name">Ansprechpartner</Label>
                <Input
                  id="contact_name"
                  value={blockData.contact_name || ''}
                  onChange={(e) => setFormData({
                    ...formData, 
                    block_data: {...blockData, contact_name: e.target.value}
                  })}
                />
              </div>
              <div>
                <Label htmlFor="contact_title">Position</Label>
                <Input
                  id="contact_title"
                  value={blockData.contact_title || ''}
                  onChange={(e) => setFormData({
                    ...formData, 
                    block_data: {...blockData, contact_title: e.target.value}
                  })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_phone">Telefon</Label>
                <Input
                  id="contact_phone"
                  value={blockData.contact_phone || ''}
                  onChange={(e) => setFormData({
                    ...formData, 
                    block_data: {...blockData, contact_phone: e.target.value}
                  })}
                />
              </div>
              <div>
                <Label htmlFor="contact_email">E-Mail</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={blockData.contact_email || ''}
                  onChange={(e) => setFormData({
                    ...formData, 
                    block_data: {...blockData, contact_email: e.target.value}
                  })}
                />
              </div>
            </div>
          </div>
        );
      
      case 'date':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="date_format">Datumsformat</Label>
              <Select
                value={blockData.date_format || 'dd.mm.yyyy'}
                onValueChange={(value) => setFormData({
                  ...formData, 
                  block_data: {...blockData, date_format: value}
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd.mm.yyyy">TT.MM.JJJJ</SelectItem>
                  <SelectItem value="dd.mm.yy">TT.MM.JJ</SelectItem>
                  <SelectItem value="yyyy-mm-dd">JJJJ-MM-TT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show_time"
                checked={blockData.show_time || false}
                onCheckedChange={(checked) => setFormData({
                  ...formData, 
                  block_data: {...blockData, show_time: checked}
                })}
              />
              <Label htmlFor="show_time">Uhrzeit anzeigen</Label>
            </div>
          </div>
        );
      
      case 'reference':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="reference_prefix">Präfix</Label>
              <Input
                id="reference_prefix"
                value={blockData.reference_prefix || ''}
                onChange={(e) => setFormData({
                  ...formData, 
                  block_data: {...blockData, reference_prefix: e.target.value}
                })}
                placeholder="z.B. Az."
              />
            </div>
            <div>
              <Label htmlFor="reference_pattern">Muster</Label>
              <Input
                id="reference_pattern"
                value={blockData.reference_pattern || ''}
                onChange={(e) => setFormData({
                  ...formData, 
                  block_data: {...blockData, reference_pattern: e.target.value}
                })}
                placeholder="z.B. {Jahr}-{Nummer}"
              />
            </div>
          </div>
        );
      
      case 'custom':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom_content">Inhalt</Label>
              <Input
                id="custom_content"
                value={blockData.custom_content || ''}
                onChange={(e) => setFormData({
                  ...formData, 
                  block_data: {...blockData, custom_content: e.target.value}
                })}
              />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentTenant) return;

    try {
      if (editingBlock) {
        const { error } = await supabase
          .from('information_blocks')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingBlock.id);

        if (error) throw error;
        toast({
          title: "Erfolg",
          description: "Informationsblock wurde aktualisiert."
        });
      } else {
        const insertData = {
          name: formData.name!,
          label: formData.label!,
          block_type: formData.block_type || 'contact',
          block_data: formData.block_data || {},
          is_default: formData.is_default || false,
          is_active: formData.is_active || true,
          tenant_id: currentTenant?.id!,
          created_by: user.id
        };

        const { error } = await supabase
          .from('information_blocks')
          .insert(insertData);

        if (error) throw error;
        toast({
          title: "Erfolg",
          description: "Neuer Informationsblock wurde erstellt."
        });
      }

      setIsDialogOpen(false);
      setEditingBlock(null);
      setFormData({ 
        block_type: 'contact', 
        is_default: false, 
        is_active: true, 
        block_data: {} 
      });
      fetchBlocks();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler",
        description: "Informationsblock konnte nicht gespeichert werden.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (block: InformationBlock) => {
    setEditingBlock(block);
    setFormData(block);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('information_blocks')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Erfolg",
        description: "Informationsblock wurde gelöscht."
      });
      fetchBlocks();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: "Fehler",
        description: "Informationsblock konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div>Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Informationsblöcke</h2>
          <p className="text-muted-foreground">
            Verwalten Sie die Informationsblöcke für die rechte Seitenleiste Ihrer Briefe
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingBlock(null);
              setFormData({ 
                block_type: 'contact', 
                is_default: false, 
                is_active: true, 
                block_data: {} 
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Informationsblock
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingBlock ? 'Informationsblock bearbeiten' : 'Neuer Informationsblock'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="label">Anzeigename *</Label>
                  <Input
                    id="label"
                    value={formData.label || ''}
                    onChange={(e) => setFormData({...formData, label: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="block_type">Typ</Label>
                <Select
                  value={formData.block_type}
                  onValueChange={(value) => setFormData({
                    ...formData, 
                    block_type: value,
                    block_data: {}
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {blockTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {renderBlockDataFields()}

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default || false}
                  onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
                />
                <Label htmlFor="is_default">Als Standard festlegen</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit">
                  {editingBlock ? 'Aktualisieren' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {blocks.map((block) => (
          <Card key={block.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{block.label}</span>
                <div className="flex space-x-2">
                  {block.is_default && (
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">
                      Standard
                    </span>
                  )}
                  <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
                    {blockTypes.find(t => t.value === block.block_type)?.label}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(block)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(block.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <strong>Konfiguration:</strong>
                <pre className="mt-2 p-2 bg-muted rounded text-xs">
                  {JSON.stringify(block.block_data, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {blocks.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Noch keine Informationsblöcke vorhanden.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};