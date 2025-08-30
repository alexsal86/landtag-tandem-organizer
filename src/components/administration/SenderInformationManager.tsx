import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface SenderInformation {
  id: string;
  name: string;
  title?: string;
  department?: string;
  organization: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  country: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  return_address_line?: string;
  is_default: boolean;
  is_active: boolean;
}

export const SenderInformationManager: React.FC = () => {
  const [senderInfos, setSenderInfos] = useState<SenderInformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInfo, setEditingInfo] = useState<SenderInformation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<SenderInformation>>({
    country: 'Deutschland',
    is_default: false,
    is_active: true
  });

  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (currentTenant) {
      fetchSenderInfos();
    }
  }, [currentTenant]);

  const fetchSenderInfos = async () => {
    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Absenderinformationen:', error);
      toast({
        title: "Fehler",
        description: "Absenderinformationen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentTenant) return;

    try {
      if (editingInfo) {
        const { error } = await supabase
          .from('sender_information')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingInfo.id);

        if (error) throw error;
        toast({
          title: "Erfolg",
          description: "Absenderinformationen wurden aktualisiert."
        });
      } else {
        const insertData = {
          name: formData.name!,
          organization: formData.organization!,
          title: formData.title,
          department: formData.department,
          street: formData.street,
          house_number: formData.house_number,
          postal_code: formData.postal_code,
          city: formData.city,
          country: formData.country || 'Deutschland',
          phone: formData.phone,
          fax: formData.fax,
          email: formData.email,
          website: formData.website,
          return_address_line: formData.return_address_line,
          is_default: formData.is_default || false,
          is_active: formData.is_active || true,
          tenant_id: currentTenant?.id!,
          created_by: user.id
        };

        const { error } = await supabase
          .from('sender_information')
          .insert(insertData);

        if (error) throw error;
        toast({
          title: "Erfolg",
          description: "Neue Absenderinformationen wurden erstellt."
        });
      }

      setIsDialogOpen(false);
      setEditingInfo(null);
      setFormData({ country: 'Deutschland', is_default: false, is_active: true });
      fetchSenderInfos();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler",
        description: "Absenderinformationen konnten nicht gespeichert werden.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (info: SenderInformation) => {
    setEditingInfo(info);
    setFormData(info);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sender_information')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Erfolg",
        description: "Absenderinformationen wurden gelöscht."
      });
      fetchSenderInfos();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      toast({
        title: "Fehler",
        description: "Absenderinformationen konnten nicht gelöscht werden.",
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
          <h2 className="text-2xl font-bold">Absenderinformationen</h2>
          <p className="text-muted-foreground">
            Verwalten Sie die Absender- und Rücksendeangaben für Ihre Briefe
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingInfo(null);
              setFormData({ country: 'Deutschland', is_default: false, is_active: true });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Absenderinformation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInfo ? 'Absenderinformation bearbeiten' : 'Neue Absenderinformation'}
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
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Abteilung</Label>
                  <Input
                    id="department"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="organization">Organisation *</Label>
                  <Input
                    id="organization"
                    value={formData.organization || ''}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="street">Straße</Label>
                  <Input
                    id="street"
                    value={formData.street || ''}
                    onChange={(e) => setFormData({...formData, street: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="house_number">Hausnummer</Label>
                  <Input
                    id="house_number"
                    value={formData.house_number || ''}
                    onChange={(e) => setFormData({...formData, house_number: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="postal_code">PLZ</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code || ''}
                    onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Stadt</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="country">Land</Label>
                  <Input
                    id="country"
                    value={formData.country || 'Deutschland'}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={formData.fax || ''}
                    onChange={(e) => setFormData({...formData, fax: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="return_address_line">Rücksendeangabe (einzeilig)</Label>
                <Textarea
                  id="return_address_line"
                  value={formData.return_address_line || ''}
                  onChange={(e) => setFormData({...formData, return_address_line: e.target.value})}
                  placeholder="z.B. Max Mustermann, Musterstraße 1, 12345 Musterstadt"
                  rows={2}
                />
              </div>

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
                  {editingInfo ? 'Aktualisieren' : 'Erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {senderInfos.map((info) => (
          <Card key={info.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{info.name} - {info.organization}</span>
                <div className="flex space-x-2">
                  {info.is_default && (
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">
                      Standard
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleEdit(info)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(info.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Adresse:</strong><br />
                  {info.street} {info.house_number}<br />
                  {info.postal_code} {info.city}<br />
                  {info.country}
                </div>
                <div>
                  <strong>Kontakt:</strong><br />
                  {info.phone && <div>Tel: {info.phone}</div>}
                  {info.email && <div>E-Mail: {info.email}</div>}
                  {info.website && <div>Web: {info.website}</div>}
                </div>
              </div>
              {info.return_address_line && (
                <div className="mt-2 text-sm">
                  <strong>Rücksendeangabe:</strong> {info.return_address_line}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {senderInfos.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Noch keine Absenderinformationen vorhanden.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};