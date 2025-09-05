import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Save, X, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface DefaultGuest {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  order_index: number;
}

interface DefaultGuestForm {
  name: string;
  email: string;
  is_active: boolean;
}

export const DefaultGuestsAdmin: React.FC = () => {
  const { currentTenant } = useTenant();
  const [guests, setGuests] = useState<DefaultGuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DefaultGuestForm>({ name: '', email: '', is_active: true });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState<DefaultGuestForm>({ name: '', email: '', is_active: true });

  useEffect(() => {
    if (currentTenant?.id) {
      fetchDefaultGuests();
    }
  }, [currentTenant?.id]);

  const fetchDefaultGuests = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('default_appointment_guests')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('order_index');

      if (error) throw error;
      setGuests(data || []);
    } catch (error: any) {
      console.error('Error fetching default guests:', error);
      toast.error('Fehler beim Laden der Standard-Gäste');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addForm.email)) {
      toast.error('Bitte gültige E-Mail-Adresse eingeben');
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const maxOrderIndex = Math.max(...guests.map(g => g.order_index), -1);

      const { error } = await supabase
        .from('default_appointment_guests')
        .insert({
          tenant_id: currentTenant!.id,
          name: addForm.name.trim(),
          email: addForm.email.trim().toLowerCase(),
          is_active: addForm.is_active,
          order_index: maxOrderIndex + 1,
          created_by: user.user.id
        });

      if (error) throw error;

      toast.success('Standard-Gast hinzugefügt');
      setShowAddDialog(false);
      setAddForm({ name: '', email: '', is_active: true });
      fetchDefaultGuests();
    } catch (error: any) {
      console.error('Error adding default guest:', error);
      toast.error('Fehler beim Hinzufügen des Standard-Gastes');
    }
  };

  const handleEdit = (guest: DefaultGuest) => {
    setEditingId(guest.id);
    setEditForm({
      name: guest.name,
      email: guest.email,
      is_active: guest.is_active
    });
  };

  const handleSave = async (id: string) => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editForm.email)) {
      toast.error('Bitte gültige E-Mail-Adresse eingeben');
      return;
    }

    try {
      const { error } = await supabase
        .from('default_appointment_guests')
        .update({
          name: editForm.name.trim(),
          email: editForm.email.trim().toLowerCase(),
          is_active: editForm.is_active
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Standard-Gast aktualisiert');
      setEditingId(null);
      fetchDefaultGuests();
    } catch (error: any) {
      console.error('Error updating default guest:', error);
      toast.error('Fehler beim Aktualisieren des Standard-Gastes');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Möchten Sie den Standard-Gast "${name}" wirklich löschen?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('default_appointment_guests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Standard-Gast gelöscht');
      fetchDefaultGuests();
    } catch (error: any) {
      console.error('Error deleting default guest:', error);
      toast.error('Fehler beim Löschen des Standard-Gastes');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('default_appointment_guests')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(!currentActive ? 'Standard-Gast aktiviert' : 'Standard-Gast deaktiviert');
      fetchDefaultGuests();
    } catch (error: any) {
      console.error('Error toggling guest status:', error);
      toast.error('Fehler beim Ändern des Status');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ name: '', email: '', is_active: true });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Standard-Gäste verwalten
          </CardTitle>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen Standard-Gast hinzufügen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="add-name">Name</Label>
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Name des Gastes"
                  />
                </div>
                <div>
                  <Label htmlFor="add-email">E-Mail-Adresse</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="gast@example.com"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="add-active"
                    checked={addForm.is_active}
                    onCheckedChange={(checked) => setAddForm({ ...addForm, is_active: checked })}
                  />
                  <Label htmlFor="add-active">Aktiv</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleAdd}>
                    Hinzufügen
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Lade Standard-Gäste...</div>
          </div>
        ) : guests.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Noch keine Standard-Gäste konfiguriert</p>
            <p className="text-sm text-muted-foreground mt-1">
              Standard-Gäste werden automatisch bei neuen Terminen vorgeschlagen
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail-Adresse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell>
                    {editingId === guest.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      guest.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === guest.id ? (
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      guest.email
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === guest.id ? (
                      <Switch
                        checked={editForm.is_active}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={guest.is_active ? "default" : "secondary"}>
                          {guest.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                        <Switch
                          checked={guest.is_active}
                          onCheckedChange={() => handleToggleActive(guest.id, guest.is_active)}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {editingId === guest.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSave(guest.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancel}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(guest)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(guest.id, guest.name)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
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