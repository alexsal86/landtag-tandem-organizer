import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { debounce } from "@/utils/debounce";
import { debugConsole } from '@/utils/debugConsole';
import type { Contact } from "@/types/contact";
export type { Contact } from "@/types/contact";

interface UseInfiniteContactsProps {
  searchTerm?: string;
  selectedCategory?: string;
  selectedType?: string;
  activeTab?: "contacts" | "stakeholders" | "stakeholder-network" | "distribution-lists" | "archive";
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  selectedTagFilter?: string;
}

const ITEMS_PER_PAGE = 50;

export const useInfiniteContacts = ({
  searchTerm = "",
  selectedCategory = "all",
  selectedType = "all",
  activeTab = "contacts",
  sortColumn = null,
  sortDirection = "asc",
  selectedTagFilter = ""
}: UseInfiniteContactsProps = {}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Refs for pagination offset and stale-request cancellation
  const pageRef = useRef(0);            // current loaded page count (for offset calc)
  const fetchGenerationRef = useRef(0); // monotonic counter; stale fetches check this

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const buildQuery = useCallback((offset: number, limit: number) => {
    let query = supabase
      .from('contacts')
      .select('id, contact_type, name, role, organization, organization_id, email, phone, address, birthday, website, linkedin, twitter, facebook, instagram, xing, category, priority, last_contact, avatar_url, notes, is_favorite, gender, tags, business_street, business_house_number, business_postal_code, business_city, business_country', { count: 'planned' })
      .eq('tenant_id', currentTenant?.id || '');

    // Filter by tab
    if (activeTab === "contacts") {
      query = query.eq('contact_type', 'person').neq('name', 'Archivierter Kontakt');
    } else if (activeTab === "stakeholders" || activeTab === "stakeholder-network") {
      query = query.eq('contact_type', 'organization');
    } else if (activeTab === "archive") {
      query = query.eq('name', 'Archivierter Kontakt');
    }

    // Search filter
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,organization.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "favorites") {
        query = query.eq('is_favorite', true);
      } else {
        query = query.eq('category', selectedCategory);
      }
    }

    // Tag filter
    if (selectedTagFilter) {
      query = query.contains('tags', [selectedTagFilter]);
    }

    // Type filter
    if (selectedType !== "all") {
      query = query.eq('contact_type', selectedType);
    }

    // Sorting
    if (sortColumn) {
      query = query.order(sortColumn, { ascending: sortDirection === "asc" });
    } else {
      // Different default sorting for stakeholders vs other tabs
      if (activeTab === "stakeholders") {
        // For stakeholders, sort alphabetically by name to ensure consistent ordering
        query = query.order('name', { ascending: true });
      } else {
        // Default sorting for contacts: favorites first, then by name
        query = query
          .order('is_favorite', { ascending: false })
          .order('name', { ascending: true });
      }
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    return query;
  }, [currentTenant?.id, activeTab, searchTerm, selectedCategory, selectedType, selectedTagFilter, sortColumn, sortDirection]);

  const insertSampleContacts = useCallback(async () => {
    if (!user) return false;
    try {
      const { error } = await supabase.rpc('insert_sample_contacts', {
        target_user_id: user.id
      });

      if (error) throw error;

      toast({
        title: "Willkommen!",
        description: "Beispielkontakte wurden zu Ihrem Account hinzugefügt.",
      });

      return true;
    } catch (error) {
      debugConsole.error('Error inserting sample contacts:', error);
      toast({
        title: "Fehler",
        description: "Beispielkontakte konnten nicht erstellt werden.",
        variant: "destructive",
      });
      return false;
    }
  }, [user, toast]);

  const fetchContacts = useCallback(async (isLoadMore: boolean, generation: number) => {
    if (!user || !currentTenant) {
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

      const offset = isLoadMore ? pageRef.current * ITEMS_PER_PAGE : 0;
      const query = buildQuery(offset, ITEMS_PER_PAGE);

      const { data, error, count } = await query;

      // Discard results if a newer fetch has been started
      if (generation !== fetchGenerationRef.current) return;

      if (error) {
        debugConsole.error('Supabase query error:', error);
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
        is_favorite: contact.is_favorite,
        gender: (contact as { gender?: string }).gender,
        tags: contact.tags || [],
      })) || [];

      if (isLoadMore) {
        setContacts(prev => [...prev, ...formattedContacts]);
        pageRef.current += 1;
      } else {
        setContacts(formattedContacts);
        pageRef.current = 1;

        // Insert sample data if no contacts exist and no filters are applied
        if (formattedContacts.length === 0 && !searchTerm && selectedCategory === "all" && selectedType === "all" && activeTab === "contacts") {
          const sampleInserted = await insertSampleContacts();
          if (sampleInserted && generation === fetchGenerationRef.current) {
            const { data: newData, error: newError, count: newCount } = await buildQuery(0, ITEMS_PER_PAGE);
            if (!newError && newData && generation === fetchGenerationRef.current) {
              const newFormattedContacts = newData.map(contact => ({
                id: contact.id,
                contact_type: (contact.contact_type as "person" | "organization" | "archive") || "person",
                name: contact.name,
                role: contact.role,
                organization: contact.organization,
                organization_id: contact.organization_id,
                email: contact.email,
                phone: contact.phone,
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
                is_favorite: contact.is_favorite,
                gender: (contact as { gender?: string }).gender,
                tags: contact.tags || [],
              }));
              setContacts(newFormattedContacts);
              setTotalCount(newCount || 0);
              setHasMore(newFormattedContacts.length === ITEMS_PER_PAGE);
            }
          }
          if (generation === fetchGenerationRef.current) {
            setLoading(false);
            setLoadingMore(false);
          }
          return;
        }
      }

      setTotalCount(count || 0);
      setHasMore(formattedContacts.length === ITEMS_PER_PAGE);

    } catch (error) {
      if (generation !== fetchGenerationRef.current) return;
      debugConsole.error('Error fetching contacts:', error);
      toast({
        title: "Fehler",
        description: "Kontakte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [user, currentTenant, buildQuery, searchTerm, selectedCategory, selectedType, selectedTagFilter, activeTab, insertSampleContacts, toast]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchContacts(true, fetchGenerationRef.current);
    }
  }, [fetchContacts, loadingMore, hasMore]);

  const toggleFavorite = useCallback(async (contactId: string, isFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite: isFavorite })
        .eq('id', contactId);

      if (error) throw error;

      // Update local state
      setContacts(prev => prev.map(contact =>
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
      debugConsole.error('Error toggling favorite:', error);
      toast({
        title: "Fehler",
        description: "Favorit konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Single consolidated effect: resets state AND fetches when filters/auth change.
  // fetchContacts is in deps so it always uses the current closure (no stale-closure bug).
  // The generation counter ensures any in-flight request from a previous filter set
  // is discarded before it can overwrite state.
  useEffect(() => {
    fetchGenerationRef.current += 1;
    const generation = fetchGenerationRef.current;

    pageRef.current = 0;
    setContacts([]);
    setHasMore(true);
    setTotalCount(0);

    if (user && currentTenant) {
      fetchContacts(false, generation);
    }
  }, [user, currentTenant, searchTerm, selectedCategory, selectedType, selectedTagFilter, activeTab, sortColumn, sortDirection, fetchContacts]);

  const refreshContacts = useCallback(() => {
    if (!user || !currentTenant) return;

    fetchGenerationRef.current += 1;
    const generation = fetchGenerationRef.current;

    pageRef.current = 0;
    setContacts([]);
    setHasMore(true);
    setTotalCount(0);
    fetchContacts(false, generation);
  }, [user, currentTenant, fetchContacts]);

  return {
    contacts,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts
  };
};
