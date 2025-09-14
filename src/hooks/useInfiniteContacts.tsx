import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debounce } from "@/utils/debounce";

export interface Contact {
  id: string;
  contact_type: "person" | "organization" | "archive";
  name: string;
  role?: string;
  organization?: string;
  organization_id?: string;
  email?: string;
  phone?: string;
  location?: string;
  address?: string;
  birthday?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  xing?: string;
  category?: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority?: "low" | "medium" | "high";
  last_contact?: string;
  avatar_url?: string;
  notes?: string;
  additional_info?: string;
  is_favorite?: boolean;
  legal_form?: string;
  industry?: string;
  main_contact_person?: string;
  business_description?: string;
}

interface UseInfiniteContactsProps {
  searchTerm: string;
  selectedCategory: string;
  selectedType: string;
  activeTab: "contacts" | "distribution-lists" | "archive";
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
}

const ITEMS_PER_PAGE = 50;

export const useInfiniteContacts = ({
  searchTerm,
  selectedCategory,
  selectedType,
  activeTab,
  sortColumn,
  sortDirection,
}: UseInfiniteContactsProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  // Reset pagination when filters change
  const resetPagination = useCallback(() => {
    setContacts([]);
    setCurrentPage(0);
    setHasMore(true);
    setTotalCount(0);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [searchTerm, selectedCategory, selectedType, activeTab, sortColumn, sortDirection, resetPagination]);

  // Initial fetch when user and tenant are available or when pagination resets
  useEffect(() => {
    if (user && currentTenant && currentPage === 0) {
      fetchContacts(false);
    }
  }, [user, currentTenant, currentPage]);

  const buildQuery = useCallback((offset: number, limit: number) => {
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', currentTenant?.id || '');

    // Filter by tab
    if (activeTab === "contacts") {
      query = query.neq('contact_type', 'archive');
    } else if (activeTab === "archive") {
      query = query.eq('contact_type', 'archive');
    }

    // Search filter
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%,industry.ilike.%${searchTerm}%,main_contact_person.ilike.%${searchTerm}%,legal_form.ilike.%${searchTerm}%`);
    }

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "favorites") {
        query = query.eq('is_favorite', true);
      } else {
        query = query.eq('category', selectedCategory);
      }
    }

    // Type filter
    if (selectedType !== "all") {
      query = query.eq('contact_type', selectedType);
    }

    // Sorting
    if (sortColumn) {
      query = query.order(sortColumn, { ascending: sortDirection === "asc" });
    } else {
      // Default sorting: favorites first, then by name
      query = query
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    return query;
  }, [currentTenant?.id, activeTab, searchTerm, selectedCategory, selectedType, sortColumn, sortDirection]);

  const fetchContacts = useCallback(async (isLoadMore = false) => {
    if (!user || !currentTenant) {
      console.log('Missing user or tenant:', { user: !!user, currentTenant: !!currentTenant });
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const offset = isLoadMore ? contacts.length : 0;
      const query = buildQuery(offset, ITEMS_PER_PAGE);
      
      console.log('Fetching contacts with query:', { 
        user: user.id, 
        tenant: currentTenant.id, 
        offset, 
        limit: ITEMS_PER_PAGE 
      });
      
      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      const formattedContacts = data?.map(contact => ({
        id: contact.id,
        contact_type: (contact.contact_type as "person" | "organization" | "archive") || "person",
        name: contact.name,
        role: contact.role,
        organization: contact.organization,
        organization_id: contact.organization_id,
        email: contact.email,
        phone: contact.phone,
        location: contact.location,
        address: contact.address,
        birthday: contact.birthday,
        website: contact.website,
        linkedin: contact.linkedin,
        twitter: contact.twitter,
        facebook: contact.facebook,
        instagram: contact.instagram,
        xing: contact.xing,
        category: contact.category as Contact["category"],
        priority: contact.priority as Contact["priority"],
        last_contact: contact.last_contact,
        avatar_url: contact.avatar_url,
        notes: contact.notes,
        additional_info: contact.additional_info,
        legal_form: contact.legal_form,
        industry: contact.industry,
        main_contact_person: contact.main_contact_person,
        business_description: contact.business_description,
        is_favorite: contact.is_favorite,
      })) || [];

      if (isLoadMore) {
        setContacts(prev => [...prev, ...formattedContacts]);
        setCurrentPage(prev => prev + 1);
      } else {
        setContacts(formattedContacts);
        setCurrentPage(1);
        
        // Insert sample data if no contacts exist and no filters are applied
        if (formattedContacts.length === 0 && !searchTerm && selectedCategory === "all" && selectedType === "all" && activeTab === "contacts") {
          await insertSampleContacts();
          return;
        }
      }

      setTotalCount(count || 0);
      setHasMore(formattedContacts.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Fehler",
        description: "Kontakte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, currentTenant, contacts.length, buildQuery, searchTerm, selectedCategory, selectedType, activeTab, toast]);

  const insertSampleContacts = async () => {
    try {
      const { error } = await supabase.rpc('insert_sample_contacts', {
        target_user_id: user!.id
      });

      if (error) throw error;

      toast({
        title: "Willkommen!",
        description: "Beispielkontakte wurden zu Ihrem Account hinzugefügt.",
      });

      // Fetch the newly inserted contacts
      fetchContacts(false);
    } catch (error) {
      console.error('Error inserting sample contacts:', error);
      toast({
        title: "Fehler",
        description: "Beispielkontakte konnten nicht erstellt werden.",
        variant: "destructive",
      });
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchContacts(true);
    }
  }, [fetchContacts, loadingMore, hasMore]);

  const toggleFavorite = async (contactId: string, isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite: isFavorite })
        .eq('id', contactId);

      if (error) throw error;

      // Update local state
      setContacts(contacts.map(contact => 
        contact.id === contactId 
          ? { ...contact, is_favorite: isFavorite }
          : contact
      ));

      toast({
        title: "Erfolg",
        description: isFavorite 
          ? "Kontakt zu Favoriten hinzugefügt" 
          : "Kontakt aus Favoriten entfernt",
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Fehler",
        description: "Favorit konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  };

  // Initial load and reload when dependencies change
  useEffect(() => {
    if (contacts.length === 0 && currentPage === 0) {
      fetchContacts(false);
    }
  }, [fetchContacts, contacts.length, currentPage]);

  return {
    contacts,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts: () => fetchContacts(false)
  };
};