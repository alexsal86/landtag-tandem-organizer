import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Search, User, Building, Check, Star, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { debounce } from '@/utils/debounce';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  contact_type: 'person' | 'organization';
  category?: string;
  avatar_url?: string;
  is_favorite?: boolean;
  usage_count?: number;
  last_used_at?: string;
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
  address?: string;
}

interface ContactSelectorProps {
  onSelect: (contact: Contact) => void;
  selectedContactId?: string;
  placeholder?: string;
  className?: string;
  clearAfterSelect?: boolean;
}

const CONTACT_COLUMNS = `
  id, name, organization, email, phone, contact_type, category, avatar_url, is_favorite,
  business_street, business_house_number, business_postal_code, business_city, business_country,
  private_street, private_house_number, private_postal_code, private_city, private_country,
  address
`;

const formatContactAddress = (contact: Contact): string => {
  const businessAddr = contact.business_street && contact.business_city
    ? `${contact.business_street}${contact.business_house_number ? ' ' + contact.business_house_number : ''}\n${contact.business_postal_code || ''} ${contact.business_city || ''}${contact.business_country && contact.business_country !== 'Deutschland' ? '\n' + contact.business_country : ''}`
    : '';
  const privateAddr = contact.private_street && contact.private_city
    ? `${contact.private_street}${contact.private_house_number ? ' ' + contact.private_house_number : ''}\n${contact.private_postal_code || ''} ${contact.private_city || ''}${contact.private_country && contact.private_country !== 'Deutschland' ? '\n' + contact.private_country : ''}`
    : '';
  return businessAddr || privateAddr || contact.address || '';
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

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

const mergeWithUsageStats = (contacts: any[], usageData: any[] | null): Contact[] => {
  return contacts.map(c => ({
    ...c,
    contact_type: c.contact_type as 'person' | 'organization',
    usage_count: usageData?.find(u => u.contact_id === c.id)?.usage_count || 0,
    last_used_at: usageData?.find(u => u.contact_id === c.id)?.last_used_at,
  }));
};

const ContactItem: React.FC<{
  contact: Contact;
  isSelected: boolean;
  onSelect: (contact: Contact) => void;
}> = ({ contact, isSelected, onSelect }) => (
  <div
    className="flex items-center gap-3 p-2 hover:bg-muted rounded-sm cursor-pointer"
    onClick={() => onSelect(contact)}
  >
    <Avatar className="h-8 w-8">
      <AvatarImage src={contact.avatar_url} />
      <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium truncate">{contact.name}</span>
        {contact.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
        {!contact.is_favorite && (contact.usage_count || 0) > 0 && <Flame className="h-3 w-3 text-orange-500" />}
        {contact.contact_type === 'organization' ? (
          <Building className="h-3 w-3 text-muted-foreground" />
        ) : (
          <User className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      {contact.organization && <div className="text-sm text-muted-foreground truncate">{contact.organization}</div>}
      {contact.email && <div className="text-xs text-muted-foreground truncate">{contact.email}</div>}
    </div>
    <div className="flex flex-col items-end gap-1">
      {contact.category && contact.category !== 'citizen' && (
        <Badge variant="secondary" className={`text-xs ${getCategoryColor(contact.category)}`}>
          {contact.category}
        </Badge>
      )}
      {isSelected && <Check className="h-4 w-4 text-primary" />}
    </div>
  </div>
);

export const ContactSelector: React.FC<ContactSelectorProps> = ({
  onSelect,
  selectedContactId,
  placeholder = "Kontakt auswählen...",
  className = "",
  clearAfterSelect = false
}) => {
  const { currentTenant } = useTenant();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const hasFetchedInitial = useRef(false);

  // Fetch selected contact by ID (lightweight, only when needed)
  useEffect(() => {
    if (!selectedContactId || !currentTenant) return;
    // Check if already in loaded contacts
    const existing = contacts.find(c => c.id === selectedContactId);
    if (existing) { setSelectedContact(existing); return; }
    // Otherwise fetch just this one contact
    supabase
      .from('contacts')
      .select(CONTACT_COLUMNS)
      .eq('id', selectedContactId)
      .single()
      .then(({ data }) => {
        if (data) setSelectedContact({ ...data, contact_type: data.contact_type as 'person' | 'organization' });
      });
  }, [selectedContactId, currentTenant]);

  const fetchContacts = useCallback(async (search: string) => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      if (!search) {
        // No search: load favorites + top used, limited
        const [favResult, topResult] = await Promise.all([
          supabase
            .from('contacts')
            .select(CONTACT_COLUMNS)
            .eq('tenant_id', currentTenant.id)
            .neq('contact_type', 'archive')
            .eq('is_favorite', true)
            .order('name')
            .limit(10),
          supabase
            .from('contact_usage_stats')
            .select('contact_id, usage_count, last_used_at')
            .eq('tenant_id', currentTenant.id)
            .order('usage_count', { ascending: false })
            .limit(20),
        ]);

        const favContacts = favResult.data || [];
        const topUsageIds = (topResult.data || []).map(u => u.contact_id);
        const favIds = new Set(favContacts.map(c => c.id));
        const missingIds = topUsageIds.filter(id => !favIds.has(id));

        let topContacts: any[] = [];
        if (missingIds.length > 0) {
          const { data } = await supabase
            .from('contacts')
            .select(CONTACT_COLUMNS)
            .in('id', missingIds)
            .neq('contact_type', 'archive');
          topContacts = data || [];
        }

        // Also load a few alphabetical contacts to fill
        const loadedIds = [...favContacts.map(c => c.id), ...topContacts.map((c: any) => c.id)];
        let alphaContacts: any[] = [];
        if (loadedIds.length < 20) {
          const { data } = await supabase
            .from('contacts')
            .select(CONTACT_COLUMNS)
            .eq('tenant_id', currentTenant.id)
            .neq('contact_type', 'archive')
            .order('name')
            .limit(20 - loadedIds.length);
          alphaContacts = (data || []).filter((c: any) => !loadedIds.includes(c.id));
        }

        const allContacts = [...favContacts, ...topContacts, ...alphaContacts];
        const allIds = allContacts.map(c => c.id);

        // Fetch usage stats only for loaded contacts
        let usageData: any[] | null = null;
        if (allIds.length > 0) {
          const { data } = await supabase
            .from('contact_usage_stats')
            .select('contact_id, usage_count, last_used_at')
            .eq('tenant_id', currentTenant.id)
            .in('contact_id', allIds);
          usageData = data;
        }

        const merged = mergeWithUsageStats(allContacts, usageData);
        merged.sort((a, b) => {
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          if (a.usage_count !== b.usage_count) return (b.usage_count || 0) - (a.usage_count || 0);
          return a.name.localeCompare(b.name);
        });
        setContacts(merged);
      } else {
        // Server-side search
        const pattern = `%${search}%`;
        const { data: searchData, error } = await supabase
          .from('contacts')
          .select(CONTACT_COLUMNS)
          .eq('tenant_id', currentTenant.id)
          .neq('contact_type', 'archive')
          .or(`name.ilike.${pattern},organization.ilike.${pattern},email.ilike.${pattern}`)
          .order('is_favorite', { ascending: false })
          .order('name')
          .limit(30);

        if (error) throw error;
        const ids = (searchData || []).map(c => c.id);
        let usageData: any[] | null = null;
        if (ids.length > 0) {
          const { data } = await supabase
            .from('contact_usage_stats')
            .select('contact_id, usage_count, last_used_at')
            .eq('tenant_id', currentTenant.id)
            .in('contact_id', ids);
          usageData = data;
        }
        setContacts(mergeWithUsageStats(searchData || [], usageData));
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((term: string) => fetchContacts(term), 300),
    [fetchContacts]
  );

  // Lazy load: fetch only when dropdown opens
  useEffect(() => {
    if (isOpen && currentTenant && !hasFetchedInitial.current) {
      hasFetchedInitial.current = true;
      fetchContacts('');
    }
  }, [isOpen, currentTenant, fetchContacts]);

  // Trigger debounced search on searchTerm change
  useEffect(() => {
    if (!isOpen) return;
    debouncedSearch(searchTerm);
  }, [searchTerm, isOpen, debouncedSearch]);

  // Grouped contacts for display
  const favorites = useMemo(() => contacts.filter(c => c.is_favorite), [contacts]);
  const frequentlyUsed = useMemo(() => contacts.filter(c => !c.is_favorite && (c.usage_count || 0) > 0), [contacts]);
  const otherContacts = useMemo(() => contacts.filter(c => !c.is_favorite && (c.usage_count || 0) === 0), [contacts]);

  const handleContactSelect = async (contact: Contact) => {
    if (clearAfterSelect) {
      setSelectedContact(null);
    } else {
      setSelectedContact(contact);
    }
    setIsOpen(false);
    setSearchTerm('');

    try {
      await supabase.rpc('update_contact_usage', {
        p_contact_id: contact.id,
        p_tenant_id: currentTenant?.id
      });
    } catch (error) {
      console.error('Error tracking contact usage:', error);
    }

    onSelect({ ...contact, formatted_address: formatContactAddress(contact) } as any);
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
        type="button"
        className="w-full justify-between text-left"
      >
        {selectedContact ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={selectedContact.avatar_url} />
              <AvatarFallback className="text-xs">{getInitials(selectedContact.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedContact.name}</span>
            {selectedContact.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-current" />}
            {selectedContact.organization && (
              <span className="text-muted-foreground text-sm">({selectedContact.organization})</span>
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
              <div className="p-4 text-center text-muted-foreground">Kontakte werden geladen...</div>
            ) : contacts.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? 'Keine Kontakte gefunden' : 'Keine Kontakte verfügbar'}
              </div>
            ) : (
              <div className="p-1">
                {favorites.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50 rounded-sm mb-1 flex items-center gap-1">
                      <Star className="h-3 w-3" /> Favoriten
                    </div>
                    {favorites.map(c => <ContactItem key={c.id} contact={c} isSelected={selectedContactId === c.id} onSelect={handleContactSelect} />)}
                  </>
                )}
                {frequentlyUsed.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50 rounded-sm mb-1 mt-2 flex items-center gap-1">
                      <Flame className="h-3 w-3" /> Häufig kontaktiert
                    </div>
                    {frequentlyUsed.map(c => <ContactItem key={c.id} contact={c} isSelected={selectedContactId === c.id} onSelect={handleContactSelect} />)}
                  </>
                )}
                {otherContacts.length > 0 && (
                  <>
                    {(favorites.length > 0 || frequentlyUsed.length > 0) && (
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50 rounded-sm mb-1 mt-2">Alle Kontakte</div>
                    )}
                    {otherContacts.map(c => <ContactItem key={c.id} contact={c} isSelected={selectedContactId === c.id} onSelect={handleContactSelect} />)}
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-2 border-t bg-muted/50">
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="w-full">Schließen</Button>
          </div>
        </div>
      )}
    </div>
  );
};
