import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface Guest {
  id?: string;
  name: string;
  email: string;
  status?: string;
}

interface DefaultGuest {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface GuestManagerProps {
  guests: Guest[];
  onGuestsChange: (guests: Guest[]) => void;
  className?: string;
}

export const GuestManager: React.FC<GuestManagerProps> = ({
  guests,
  onGuestsChange,
  className = ""
}) => {
  const { currentTenant } = useTenant();
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [defaultGuests, setDefaultGuests] = useState<DefaultGuest[]>([]);
  const [selectedDefaults, setSelectedDefaults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load default guests
  useEffect(() => {
    if (currentTenant?.id) {
      fetchDefaultGuests();
    }
  }, [currentTenant?.id]);

  const fetchDefaultGuests = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('default_appointment_guests')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('order_index');

      if (error) throw error;
      setDefaultGuests(data || []);
    } catch (error: any) {
      console.error('Error fetching default guests:', error);
      toast.error('Fehler beim Laden der Standard-Gäste');
    }
  };

  const addManualGuest = () => {
    if (!newGuestName.trim() || !newGuestEmail.trim()) {
      toast.error('Bitte Name und E-Mail-Adresse eingeben');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newGuestEmail)) {
      toast.error('Bitte gültige E-Mail-Adresse eingeben');
      return;
    }

    // Check for duplicates
    if (guests.some(g => g.email.toLowerCase() === newGuestEmail.toLowerCase())) {
      toast.error('Gast mit dieser E-Mail-Adresse bereits hinzugefügt');
      return;
    }

    const newGuest: Guest = {
      name: newGuestName.trim(),
      email: newGuestEmail.trim().toLowerCase(),
    };

    onGuestsChange([...guests, newGuest]);
    setNewGuestName('');
    setNewGuestEmail('');
    toast.success('Gast hinzugefügt');
  };

  const removeGuest = (index: number) => {
    const updatedGuests = guests.filter((_, i) => i !== index);
    onGuestsChange(updatedGuests);
    toast.success('Gast entfernt');
  };

  const handleDefaultGuestToggle = (defaultGuest: DefaultGuest, checked: boolean) => {
    if (checked) {
      // Check for duplicates
      if (guests.some(g => g.email.toLowerCase() === defaultGuest.email.toLowerCase())) {
        toast.error('Gast bereits hinzugefügt');
        return;
      }

      const newGuest: Guest = {
        name: defaultGuest.name,
        email: defaultGuest.email,
      };

      onGuestsChange([...guests, newGuest]);
      setSelectedDefaults([...selectedDefaults, defaultGuest.id]);
    } else {
      // Remove guest
      const updatedGuests = guests.filter(g => g.email.toLowerCase() !== defaultGuest.email.toLowerCase());
      onGuestsChange(updatedGuests);
      setSelectedDefaults(selectedDefaults.filter(id => id !== defaultGuest.id));
    }
  };

  const getGuestStatusBadge = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Bestätigt</Badge>;
      case 'declined':
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case 'invited':
        return <Badge variant="secondary">Eingeladen</Badge>;
      default:
        return <Badge variant="outline">Neu</Badge>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Gäste verwalten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Default Guests Selection */}
        {defaultGuests.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Standard-Gäste auswählen</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {defaultGuests.map((defaultGuest) => {
                const isSelected = guests.some(g => g.email.toLowerCase() === defaultGuest.email.toLowerCase());
                return (
                  <div key={defaultGuest.id} className="flex items-center space-x-2 p-2 rounded-md border">
                    <Checkbox
                      id={`default-${defaultGuest.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleDefaultGuestToggle(defaultGuest, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`default-${defaultGuest.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      <div className="font-medium">{defaultGuest.name}</div>
                      <div className="text-muted-foreground text-xs">{defaultGuest.email}</div>
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {defaultGuests.length > 0 && <Separator />}

        {/* Manual Guest Addition */}
        <div>
          <Label className="text-sm font-medium">Gast manuell hinzufügen</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <Input
                placeholder="Name des Gastes"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualGuest()}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="gast@example.com"
                value={newGuestEmail}
                onChange={(e) => setNewGuestEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualGuest()}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={addManualGuest}
                size="sm"
                className="px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Guest List */}
        {guests.length > 0 && (
          <div>
            <Label className="text-sm font-medium">
              Hinzugefügte Gäste ({guests.length})
            </Label>
            <div className="space-y-2 mt-2">
              {guests.map((guest, index) => (
                <div
                  key={`${guest.email}-${index}`}
                  className="flex items-center justify-between p-3 rounded-md border bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{guest.name}</div>
                      <div className="text-xs text-muted-foreground">{guest.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getGuestStatusBadge(guest.status)}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuest(index)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {guests.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Noch keine Gäste hinzugefügt</p>
            <p className="text-xs">Wählen Sie Standard-Gäste aus oder fügen Sie manuell hinzu</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};