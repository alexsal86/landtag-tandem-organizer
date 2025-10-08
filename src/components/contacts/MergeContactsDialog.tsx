import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Building, MapPin, Calendar, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  organization_id?: string;
  location?: string;
  address?: string;
  birthday?: string;
  website?: string;
  role?: string;
  category?: string;
  priority?: string;
  notes?: string;
  additional_info?: string;
  avatar_url?: string;
  contact_type?: string;
  tags?: string[];
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  xing?: string;
  [key: string]: any;
}

interface MergeContactsDialogProps {
  contact1: Contact;
  contact2: Contact;
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete: () => void;
}

const fieldConfig = [
  { key: 'name', label: 'Name', icon: User, required: true },
  { key: 'email', label: 'E-Mail', icon: Mail },
  { key: 'phone', label: 'Telefon', icon: Phone },
  { key: 'organization', label: 'Organisation', icon: Building },
  { key: 'role', label: 'Rolle', icon: User },
  { key: 'location', label: 'Ort', icon: MapPin },
  { key: 'address', label: 'Adresse', icon: MapPin },
  { key: 'birthday', label: 'Geburtstag', icon: Calendar },
  { key: 'website', label: 'Website', icon: FileText },
  { key: 'notes', label: 'Notizen', icon: FileText },
  { key: 'additional_info', label: 'Zusätzliche Infos', icon: FileText },
];

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export function MergeContactsDialog({
  contact1,
  contact2,
  isOpen,
  onClose,
  onMergeComplete,
}: MergeContactsDialogProps) {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [primaryContact, setPrimaryContact] = useState<string>(contact1.id);
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();

  const handleFieldSelection = (field: string, contactId: string) => {
    setSelectedValues(prev => ({
      ...prev,
      [field]: contactId,
    }));
  };

  const getMergedData = (): Partial<Contact> => {
    const merged: Partial<Contact> = {};
    
    // For each field, use the selected value or default to primary contact
    fieldConfig.forEach(({ key }) => {
      const selectedContactId = selectedValues[key] || primaryContact;
      const selectedContact = selectedContactId === contact1.id ? contact1 : contact2;
      
      if (selectedContact[key]) {
        merged[key] = selectedContact[key];
      }
    });

    // Merge tags (combine unique tags from both)
    const allTags = [
      ...(contact1.tags || []),
      ...(contact2.tags || []),
    ];
    merged.tags = [...new Set(allTags)];

    // Keep the primary contact's other fields
    const primary = primaryContact === contact1.id ? contact1 : contact2;
    merged.category = primary.category;
    merged.priority = primary.priority;
    merged.contact_type = primary.contact_type;
    
    return merged;
  };

  const handleMerge = async () => {
    setMerging(true);
    
    try {
      const mergedData = getMergedData();
      const secondaryContactId = primaryContact === contact1.id ? contact2.id : contact1.id;

      // Update primary contact with merged data
      const { error: updateError } = await supabase
        .from('contacts')
        .update(mergedData)
        .eq('id', primaryContact);

      if (updateError) throw updateError;

      // Update all references to secondary contact
      // Update call_logs
      await supabase
        .from('call_logs')
        .update({ contact_id: primaryContact })
        .eq('contact_id', secondaryContactId);

      // Update appointment_contacts
      await supabase
        .from('appointment_contacts')
        .update({ contact_id: primaryContact })
        .eq('contact_id', secondaryContactId);

      // Update contact_activities
      await supabase
        .from('contact_activities')
        .update({ contact_id: primaryContact })
        .eq('contact_id', secondaryContactId);

      // Update distribution_list_members
      await supabase
        .from('distribution_list_members')
        .update({ contact_id: primaryContact })
        .eq('contact_id', secondaryContactId);

      // Log merge activity
      const { data: userData } = await supabase.auth.getUser();
      const { data: contactData } = await supabase
        .from('contacts')
        .select('tenant_id')
        .eq('id', primaryContact)
        .single();

      if (userData.user && contactData) {
        await supabase
          .from('contact_activities')
          .insert({
            contact_id: primaryContact,
            tenant_id: contactData.tenant_id,
            activity_type: 'edit',
            title: 'Kontakte zusammengeführt',
            description: `Kontakt "${contact1.name}" und "${contact2.name}" wurden zusammengeführt`,
            created_by: userData.user.id,
            metadata: {
              merged_contact_id: secondaryContactId,
              merged_contact_name: secondaryContactId === contact1.id ? contact1.name : contact2.name,
            },
          });
      }

      // Delete secondary contact
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .eq('id', secondaryContactId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Kontakte zusammengeführt',
        description: 'Die Kontakte wurden erfolgreich zusammengeführt.',
      });

      onMergeComplete();
      onClose();
    } catch (error) {
      console.error('Error merging contacts:', error);
      toast({
        title: 'Fehler',
        description: 'Kontakte konnten nicht zusammengeführt werden.',
        variant: 'destructive',
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kontakte zusammenführen</DialogTitle>
          <DialogDescription>
            Wählen Sie für jedes Feld aus, welcher Wert übernommen werden soll.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Primary Contact Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Primärer Kontakt</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={primaryContact} onValueChange={setPrimaryContact}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={contact1.id} id="primary1" />
                    <Label htmlFor="primary1" className="flex items-center gap-2 cursor-pointer">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact1.avatar_url} />
                        <AvatarFallback>{getInitials(contact1.name)}</AvatarFallback>
                      </Avatar>
                      <span>{contact1.name}</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={contact2.id} id="primary2" />
                    <Label htmlFor="primary2" className="flex items-center gap-2 cursor-pointer">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact2.avatar_url} />
                        <AvatarFallback>{getInitials(contact2.name)}</AvatarFallback>
                      </Avatar>
                      <span>{contact2.name}</span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Field Selection */}
          <div className="space-y-4">
            {fieldConfig.map(({ key, label, icon: Icon, required }) => {
              const value1 = contact1[key];
              const value2 = contact2[key];
              
              // Skip if both values are empty
              if (!value1 && !value2) return null;

              const selectedContact = selectedValues[key] || primaryContact;

              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{label}</span>
                      {required && <Badge variant="outline">Erforderlich</Badge>}
                    </div>
                    <RadioGroup
                      value={selectedContact}
                      onValueChange={(value) => handleFieldSelection(key, value)}
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem 
                            value={contact1.id} 
                            id={`${key}-1`}
                            disabled={!value1}
                          />
                          <Label 
                            htmlFor={`${key}-1`} 
                            className={`flex-1 p-3 border rounded cursor-pointer ${
                              !value1 ? 'opacity-50' : ''
                            } ${
                              selectedContact === contact1.id ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            {value1 ? (
                              <span className="text-sm">{value1}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Kein Wert</span>
                            )}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem 
                            value={contact2.id} 
                            id={`${key}-2`}
                            disabled={!value2}
                          />
                          <Label 
                            htmlFor={`${key}-2`} 
                            className={`flex-1 p-3 border rounded cursor-pointer ${
                              !value2 ? 'opacity-50' : ''
                            } ${
                              selectedContact === contact2.id ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            {value2 ? (
                              <span className="text-sm">{value2}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Kein Wert</span>
                            )}
                          </Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={merging}>
            Abbrechen
          </Button>
          <Button onClick={handleMerge} disabled={merging}>
            {merging ? 'Zusammenführen...' : 'Zusammenführen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
