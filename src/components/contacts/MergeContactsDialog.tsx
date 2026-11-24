import { useState } from 'react';
import { debugConsole } from '@/utils/debugConsole';
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
import { getInitials } from './utils/contactFormatters';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Phone, Building, MapPin, Calendar, FileText, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import type { MergeContact } from '@/types/contact';
import { MANUAL_MERGE_FIELDS, resolveDuplicateContact } from '@/components/contact-import/duplicateResolution';
import { notify } from "@/lib/notify";
import { useQueryClient } from '@tanstack/react-query';

interface MergeContactsDialogProps {
  contact1: MergeContact;
  contact2: MergeContact;
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete: () => void;
}

const mergeFieldMeta: Record<
  (typeof MANUAL_MERGE_FIELDS)[number],
  { label: string; icon: LucideIcon }
> = {
  name: { label: 'Name', icon: User },
  email: { label: 'E-Mail', icon: Mail },
  phone: { label: 'Telefon', icon: Phone },
  organization: { label: 'Organisation', icon: Building },
  position: { label: 'Position', icon: User },
  business_city: { label: 'Ort', icon: MapPin },
  address: { label: 'Adresse', icon: MapPin },
  birthday: { label: 'Geburtstag', icon: Calendar },
  website: { label: 'Website', icon: FileText },
  notes: { label: 'Notizen', icon: FileText },
};

const fieldConfig = MANUAL_MERGE_FIELDS.map((key) => ({
  key,
  ...mergeFieldMeta[key],
  required: key === 'name',
}));

/**
 * Columns the duplicate sheet has to load so this dialog can show and merge
 * them; without them tags, notes, position, address and website stay empty and
 * the import merge rules can never fill them.
 */
export const MERGE_CONTACT_SELECT_FIELDS = [
  'id',
  'contact_type',
  'organization_id',
  'avatar_url',
  'tags',
  ...fieldConfig.map(({ key }) => key),
].join(',');


export function MergeContactsDialog({
  contact1,
  contact2,
  isOpen,
  onClose,
  onMergeComplete,
}: MergeContactsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [primaryContact, setPrimaryContact] = useState<string>(contact1.id);
  const [merging, setMerging] = useState(false);

  const handleFieldSelection = (field: string, contactId: string) => {
    setSelectedValues(prev => ({
      ...prev,
      [field]: contactId,
    }));
  };

  const getMergedData = (): TablesUpdate<'contacts'> => {
    const primary = primaryContact === contact1.id ? contact1 : contact2;
    const secondary = primaryContact === contact1.id ? contact2 : contact1;

    // Same rules as the contact import: keep the primary values, fill gaps from
    // the secondary contact, unite tags and append notes instead of losing data.
    const incoming: Record<string, unknown> = { tags: secondary.tags ?? [] };
    fieldConfig.forEach(({ key }) => {
      if (secondary[key]) incoming[key] = secondary[key];
    });

    const { payload } = resolveDuplicateContact(
      primary as unknown as Record<string, unknown>,
      incoming,
      'merge',
    );
    const merged = payload as Record<string, unknown>;

    // Explicit per-field choices win over the gap-filling defaults.
    fieldConfig.forEach(({ key }) => {
      if (selectedValues[key] === secondary.id && secondary[key]) {
        merged[key] = secondary[key];
      }
    });

    // The organization id may only change together with the organization text.
    if (!('organization' in merged)) {
      delete merged.organization_id;
    } else if (secondary.organization_id) {
      merged.organization_id = secondary.organization_id;
    } else {
      merged.organization_id = null;
    }

    return payload;
  };

  const handleMerge = async () => {
    setMerging(true);
    
    try {
      const mergedData = getMergedData();
      const secondary = primaryContact === contact1.id ? contact2 : contact1;

      // Die Datenbank führt Kontakt, Verknüpfungen, Protokoll und Löschung in
      // einer Transaktion aus: entweder ist alles umgehängt oder nichts.
      const { error: mergeError } = await supabase.rpc('merge_contacts', {
        p_target: primaryContact,
        p_source: secondary.id,
        p_updates: mergedData as Json,
      });

      if (mergeError) throw mergeError;

      // Der Merge kann den Geburtstag des überlebenden Kontakts ändern.
      void queryClient.invalidateQueries({ queryKey: ['dashboard-birthdays'] });

      notify.success('Kontakte zusammengeführt', {
        description: 'Die Kontakte wurden erfolgreich zusammengeführt.'
});

      onMergeComplete();
      onClose();
    } catch (error) {
      debugConsole.error('Error merging contacts:', error);
      // PostgREST-Fehler sind keine Error-Instanzen; die Servermeldung nennt die
      // Ursache des abgebrochenen Merges (z. B. eine nicht verschiebbare Verknüpfung).
      const details = error && typeof error === 'object' && 'message' in error ? ` ${String(error.message)}` : '';
      notify.error('Fehler', {
        description: `Kontakte konnten nicht zusammengeführt werden.${details}`
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
            Wählen Sie für jedes Feld aus, welcher Wert übernommen werden soll. Fehlende Angaben des
            zweiten Kontakts werden ergänzt, Schlagworte vereinigt und Notizen zusammengeführt; alle
            Verknüpfungen (z. B. Fallakten, Dokumente, Themen, Verteiler) wandern mit.
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
                        <AvatarImage src={contact1.avatar_url ?? undefined} />
                        <AvatarFallback>{getInitials(contact1.name)}</AvatarFallback>
                      </Avatar>
                      <span>{contact1.name}</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={contact2.id} id="primary2" />
                    <Label htmlFor="primary2" className="flex items-center gap-2 cursor-pointer">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact2.avatar_url ?? undefined} />
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
                              <span className="text-sm">{String(value1)}</span>
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
                              <span className="text-sm">{String(value2)}</span>
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
