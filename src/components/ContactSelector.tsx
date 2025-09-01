import React, { useEffect, useState } from 'react';
import { Search, User, Building, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  contact_type: 'person' | 'organization';
  category?: string;
  avatar_url?: string;
  // Address fields for DIN 5008
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
  private_street?: string;
  private_house_number?: string;
  private_postal_code?: string;
  private_city?: string;
  private_country?: string;
  address?: string; // Fallback address field
}

interface ContactSelectorProps {
  onSelect: (contact: Contact) => void;
  selectedContactId?: string;
  placeholder?: string;
  className?: string;
}

export const ContactSelector: React.FC<ContactSelectorProps> = ({
  onSelect,
  selectedContactId,
  placeholder = "Kontakt auswählen...",
  className = ""
}) => {
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (currentTenant) {
      fetchContacts();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (selectedContactId && contacts.length > 0) {
      const contact = contacts.find(c => c.id === selectedContactId);
      setSelectedContact(contact || null);
    }
  }, [selectedContactId, contacts]);

  const fetchContacts = async () => {
    if (!currentTenant) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, name, organization, email, phone, contact_type, category, avatar_url,
          business_street, business_house_number, business_postal_code, business_city, business_country,
          private_street, private_house_number, private_postal_code, private_city, private_country,
          address
        `)
        .eq('tenant_id', currentTenant.id)
        .neq('contact_type', 'archive')
        .order('name');

      if (error) throw error;
      setContacts((data || []).map(contact => ({
        ...contact,
        contact_type: contact.contact_type as 'person' | 'organization'
      })));
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.organization && contact.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatContactAddress = (contact: Contact): string => {
    // Try business address first, then private, then fallback
    const businessAddr = contact.business_street && contact.business_city 
      ? `${contact.business_street}${contact.business_house_number ? ' ' + contact.business_house_number : ''}\n${contact.business_postal_code || ''} ${contact.business_city || ''}${contact.business_country && contact.business_country !== 'Deutschland' ? '\n' + contact.business_country : ''}`
      : '';
    
    const privateAddr = contact.private_street && contact.private_city
      ? `${contact.private_street}${contact.private_house_number ? ' ' + contact.private_house_number : ''}\n${contact.private_postal_code || ''} ${contact.private_city || ''}${contact.private_country && contact.private_country !== 'Deutschland' ? '\n' + contact.private_country : ''}`
      : '';
    
    return businessAddr || privateAddr || contact.address || '';
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setIsOpen(false);
    setSearchTerm('');
    
    // Add formatted address to contact object
    const contactWithAddress = {
      ...contact,
      formatted_address: formatContactAddress(contact)
    };
    
    onSelect(contactWithAddress);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'citizen': return 'bg-blue-100 text-blue-800';
      case 'colleague': return 'bg-green-100 text-green-800';
      case 'business': return 'bg-purple-100 text-purple-800';
      case 'media': return 'bg-orange-100 text-orange-800';
      case 'lobbyist': return 'bg-gray-100 text-gray-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left"
      >
        {selectedContact ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={selectedContact.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(selectedContact.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedContact.name}</span>
            {selectedContact.organization && (
              <span className="text-muted-foreground text-sm">
                ({selectedContact.organization})
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <Search className="h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kontakte durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Kontakte werden geladen...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'Keine Kontakte gefunden' : 'Keine Kontakte verfügbar'}
              </div>
            ) : (
              <div className="p-1">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-sm cursor-pointer"
                    onClick={() => handleContactSelect(contact)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback>
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{contact.name}</span>
                        {contact.contact_type === 'organization' ? (
                          <Building className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      
                      {contact.organization && (
                        <div className="text-sm text-muted-foreground truncate">
                          {contact.organization}
                        </div>
                      )}
                      
                      {contact.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.email}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {contact.category && contact.category !== 'citizen' && (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getCategoryColor(contact.category)}`}
                        >
                          {contact.category}
                        </Badge>
                      )}
                      
                      {selectedContactId === contact.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-2 border-t bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="w-full"
            >
              Schließen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};