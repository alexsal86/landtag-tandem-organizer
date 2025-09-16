import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { PartyAssociation } from '@/hooks/usePartyAssociations';
import { useTenant } from '@/hooks/useTenant';

interface District {
  id: string;
  district_name: string;
  district_type: string;
  region: string;
}

export const PartyAssociationsAdmin: React.FC = () => {
  const { currentTenant } = useTenant();
  const [associations, setAssociations] = useState<PartyAssociation[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<PartyAssociation | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    party_name: 'Bündnis 90/Die Grünen',
    party_type: 'Kreisverband',
    phone: '',
    email: '',
    website: '',
    address_street: '',
    address_number: '',
    address_postal_code: '',
    address_city: '',
    administrative_boundaries: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [associationsRes, districtsRes] = await Promise.all([
        supabase.from('party_associations').select('*').order('name'),
        supabase.from('election_districts').select('id, district_name, district_type, region').order('district_name')
      ]);

      if (associationsRes.error) throw associationsRes.error;
      if (districtsRes.error) throw districtsRes.error;

      setAssociations(associationsRes.data || []);
      setDistricts(districtsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      party_name: 'Bündnis 90/Die Grünen',
      party_type: 'Kreisverband',
      phone: '',
      email: '',
      website: '',
      address_street: '',
      address_number: '',
      address_postal_code: '',
      address_city: '',
      administrative_boundaries: []
    });
    setEditingAssociation(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (association: PartyAssociation) => {
    setFormData({
      name: association.name,
      party_name: association.party_name,
      party_type: association.party_type,
      phone: association.phone || '',
      email: association.email || '',
      website: association.website || '',
      address_street: association.address_street || '',
      address_number: association.address_number || '',
      address_postal_code: association.address_postal_code || '',
      address_city: association.address_city || '',
      administrative_boundaries: association.administrative_boundaries || []
    });
    setEditingAssociation(association);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    if (!currentTenant?.id) {
      toast.error('Kein Tenant verfügbar');
      return;
    }

    try {
      const associationData = {
        name: formData.name.trim(),
        party_name: formData.party_name,
        party_type: formData.party_type,
        phone: formData.phone || null,
        email: formData.email || null,
        website: formData.website || null,
        address_street: formData.address_street || null,
        address_number: formData.address_number || null,
        address_postal_code: formData.address_postal_code || null,
        address_city: formData.address_city || null,
        full_address: [
          formData.address_street,
          formData.address_number,
          formData.address_postal_code,
          formData.address_city
        ].filter(Boolean).join(' ') || null,
        administrative_boundaries: formData.administrative_boundaries.length > 0 ? formData.administrative_boundaries : null,
        tenant_id: currentTenant.id
      };

      if (editingAssociation) {
        const { error } = await supabase
          .from('party_associations')
          .update(associationData)
          .eq('id', editingAssociation.id);

        if (error) throw error;
        toast.success('Kreisverband aktualisiert');
      } else {
        const { error } = await supabase
          .from('party_associations')
          .insert(associationData);

        if (error) throw error;
        toast.success('Kreisverband erstellt');
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving association:', error);
      toast.error('Fehler beim Speichern des Kreisverbands');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Kreisverband löschen möchten?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('party_associations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Kreisverband gelöscht');
      loadData();
    } catch (error) {
      console.error('Error deleting association:', error);
      toast.error('Fehler beim Löschen des Kreisverbands');
    }
  };

  const getDistrictsByType = (type: string) => {
    return districts.filter(d => d.district_type === type);
  };

  const getDistrictName = (districtId: string) => {
    const district = districts.find(d => d.id === districtId);
    return district ? `${district.district_name} (${district.district_type})` : districtId;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Grüne Kreisverbände verwalten</CardTitle>
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
          <CardTitle>Grüne Kreisverbände verwalten</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Neuer Kreisverband
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAssociation ? 'Kreisverband bearbeiten' : 'Neuer Kreisverband'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="z.B. Kreisverband Karlsruhe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="party_type">Typ</Label>
                    <Select value={formData.party_type} onValueChange={(value) => setFormData(prev => ({ ...prev, party_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kreisverband">Kreisverband</SelectItem>
                        <SelectItem value="Stadtverband">Stadtverband</SelectItem>
                        <SelectItem value="Ortsverband">Ortsverband</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="kontakt@gruene-example.de"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+49 721 123456"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.gruene-example.de"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      value={formData.address_street}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_street: e.target.value }))}
                      placeholder="Straße"
                      className="col-span-2"
                    />
                    <Input
                      value={formData.address_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_number: e.target.value }))}
                      placeholder="Nr."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={formData.address_postal_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_postal_code: e.target.value }))}
                      placeholder="PLZ"
                    />
                    <Input
                      value={formData.address_city}
                      onChange={(e) => setFormData(prev => ({ ...prev, address_city: e.target.value }))}
                      placeholder="Stadt"
                    />
                  </div>
                </div>

                <div>
                  <Label>Zuständige Wahlkreise/Landkreise</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {districts.map(district => (
                      <label key={district.id} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.administrative_boundaries.includes(district.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                administrative_boundaries: [...prev.administrative_boundaries, district.id]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                administrative_boundaries: prev.administrative_boundaries.filter(id => id !== district.id)
                              }));
                            }
                          }}
                          className="rounded"
                        />
                        <span>{district.district_name} ({district.district_type})</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingAssociation ? 'Aktualisieren' : 'Erstellen'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {associations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Keine Kreisverbände vorhanden.</p>
            <p className="text-sm">Erstellen Sie einen neuen Kreisverband, um zu beginnen.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Zuständigkeit</TableHead>
                <TableHead className="w-[120px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {associations.map((association) => (
                <TableRow key={association.id}>
                  <TableCell className="font-medium">{association.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{association.party_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {association.email && <div>{association.email}</div>}
                      {association.phone && <div>{association.phone}</div>}
                      {association.website && (
                        <div>
                          <a 
                            href={association.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Website
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {association.full_address && (
                      <div className="text-sm">{association.full_address}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {association.administrative_boundaries && association.administrative_boundaries.length > 0 ? (
                      <div className="space-y-1">
                        {association.administrative_boundaries.slice(0, 2).map((districtId: string) => (
                          <Badge key={districtId} variant="secondary" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            {getDistrictName(districtId)}
                          </Badge>
                        ))}
                        {association.administrative_boundaries.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{association.administrative_boundaries.length - 2} weitere
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Keine Zuordnung</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(association)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(association.id)}
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