import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface SenderInformation {
  id: string;
  name: string;
  organization: string;
  phone?: string;
  fax?: string;
  website?: string;
  instagram_profile?: string;
  facebook_profile?: string;
  // Landtag/Stuttgart Address
  landtag_street?: string;
  landtag_house_number?: string;
  landtag_postal_code?: string;
  landtag_city?: string;
  landtag_email?: string;
  // Wahlkreis Address
  wahlkreis_street?: string;
  wahlkreis_house_number?: string;
  wahlkreis_postal_code?: string;
  wahlkreis_city?: string;
  wahlkreis_email?: string;
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
          phone: formData.phone,
          fax: formData.fax,
          website: formData.website,
          instagram_profile: formData.instagram_profile,
          facebook_profile: formData.facebook_profile,
          landtag_street: formData.landtag_street,
          landtag_house_number: formData.landtag_house_number,
          landtag_postal_code: formData.landtag_postal_code,
          landtag_city: formData.landtag_city,
          landtag_email: formData.landtag_email,
          wahlkreis_street: formData.wahlkreis_street,
          wahlkreis_house_number: formData.wahlkreis_house_number,
          wahlkreis_postal_code: formData.wahlkreis_postal_code,
          wahlkreis_city: formData.wahlkreis_city,
          wahlkreis_email: formData.wahlkreis_email,
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
      setFormData({ is_default: false, is_active: true });
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
              setFormData({ is_default: false, is_active: true });
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Allgemeine Informationen */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Allgemeine Informationen</h3>
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
                    <Label htmlFor="organization">Organisation *</Label>
                    <Input
                      id="organization"
                      value={formData.organization || ''}
                      onChange={(e) => setFormData({...formData, organization: e.target.value})}
                      required
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram_profile">Instagram Profil</Label>
                    <Input
                      id="instagram_profile"
                      value={formData.instagram_profile || ''}
                      onChange={(e) => setFormData({...formData, instagram_profile: e.target.value})}
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebook_profile">Facebook Profil</Label>
                    <Input
                      id="facebook_profile"
                      value={formData.facebook_profile || ''}
                      onChange={(e) => setFormData({...formData, facebook_profile: e.target.value})}
                      placeholder="@username"
                    />
                  </div>
                </div>
              </div>

              {/* Adressen in Accordions */}
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="landtag">
                  <AccordionTrigger>Adresse Landtag</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="landtag_street">Straße</Label>
                        <Input
                          id="landtag_street"
                          value={formData.landtag_street || ''}
                          onChange={(e) => setFormData({...formData, landtag_street: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="landtag_house_number">Hausnummer</Label>
                        <Input
                          id="landtag_house_number"
                          value={formData.landtag_house_number || ''}
                          onChange={(e) => setFormData({...formData, landtag_house_number: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="landtag_postal_code">PLZ</Label>
                        <Input
                          id="landtag_postal_code"
                          value={formData.landtag_postal_code || ''}
                          onChange={(e) => setFormData({...formData, landtag_postal_code: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="landtag_city">Stadt</Label>
                        <Input
                          id="landtag_city"
                          value={formData.landtag_city || ''}
                          onChange={(e) => setFormData({...formData, landtag_city: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="landtag_email">E-Mail</Label>
                        <Input
                          id="landtag_email"
                          type="email"
                          value={formData.landtag_email || ''}
                          onChange={(e) => setFormData({...formData, landtag_email: e.target.value})}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="wahlkreis">
                  <AccordionTrigger>Adresse Wahlkreis</AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="wahlkreis_street">Straße</Label>
                        <Input
                          id="wahlkreis_street"
                          value={formData.wahlkreis_street || ''}
                          onChange={(e) => setFormData({...formData, wahlkreis_street: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="wahlkreis_house_number">Hausnummer</Label>
                        <Input
                          id="wahlkreis_house_number"
                          value={formData.wahlkreis_house_number || ''}
                          onChange={(e) => setFormData({...formData, wahlkreis_house_number: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="wahlkreis_postal_code">PLZ</Label>
                        <Input
                          id="wahlkreis_postal_code"
                          value={formData.wahlkreis_postal_code || ''}
                          onChange={(e) => setFormData({...formData, wahlkreis_postal_code: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="wahlkreis_city">Stadt</Label>
                        <Input
                          id="wahlkreis_city"
                          value={formData.wahlkreis_city || ''}
                          onChange={(e) => setFormData({...formData, wahlkreis_city: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="wahlkreis_email">E-Mail</Label>
                        <Input
                          id="wahlkreis_email"
                          type="email"
                          value={formData.wahlkreis_email || ''}
                          onChange={(e) => setFormData({...formData, wahlkreis_email: e.target.value})}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

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
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div>
                    <strong>Landtag Adresse:</strong><br />
                    {(info.landtag_street || info.landtag_house_number) && (
                      <>
                        {info.landtag_street} {info.landtag_house_number}<br />
                        {info.landtag_postal_code} {info.landtag_city}<br />
                      </>
                    )}
                    {info.landtag_email && <div>E-Mail: {info.landtag_email}</div>}
                  </div>
                  
                  <div>
                    <strong>Wahlkreis Adresse:</strong><br />
                    {(info.wahlkreis_street || info.wahlkreis_house_number) && (
                      <>
                        {info.wahlkreis_street} {info.wahlkreis_house_number}<br />
                        {info.wahlkreis_postal_code} {info.wahlkreis_city}<br />
                      </>
                    )}
                    {info.wahlkreis_email && <div>E-Mail: {info.wahlkreis_email}</div>}
                  </div>
                </div>
                
                <div>
                  <strong>Kommunikation:</strong><br />
                  {info.phone && <div>Tel: {info.phone}</div>}
                  {info.fax && <div>Fax: {info.fax}</div>}
                  {info.website && <div>Web: {info.website}</div>}
                  {info.instagram_profile && <div>Instagram: {info.instagram_profile}</div>}
                  {info.facebook_profile && <div>Facebook: {info.facebook_profile}</div>}
                </div>
              </div>
              {info.return_address_line && (
                <div className="mt-4 text-sm">
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