import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from '@/utils/debugConsole';
import { fetchEntityTopicIds } from "@/features/topics/useEntityTopics";
import type { Contact } from "@/types/contact";
import { buildContactSearchFilter } from "@/features/contacts/search/contactSearch";
import { notify } from "@/lib/notify";
export type { Contact } from "@/types/contact";

interface UseInfiniteContactsProps {
  searchTerm?: string;
  selectedCategory?: string;
  activeTab?: "contacts" | "stakeholders" | "stakeholder-network" | "distribution-lists" | "archive";
  sortColumn?: string | null;
  sortDirection?: "asc" | "desc";
  selectedTagFilter?: string;
}

const ITEMS_PER_PAGE = 50;

export const useInfiniteContacts = ({
  searchTerm = "",
  selectedCategory = "all",
  activeTab = "contacts",
  sortColumn = null,
  sortDirection = "asc",
  selectedTagFilter = ""
}: UseInfiniteContactsProps = {}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Refs for pagination offset and stale-request cancellation
  const inFlightGenerationRef = useRef<number | null>(null);
  const pageRef = useRef(0);            // current loaded page count (for offset calc)
  const fetchGenerationRef = useRef(0); // monotonic counter; stale fetches check this

  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const userId = user?.id;
  const tenantId = currentTenant?.id;

  const buildQuery = useCallback((offset: number, limit: number) => {
    let query = supabase
      .from('contacts')
      .select(
        // Felder für Listenansicht (Detail-only: website, twitter, facebook, instagram, xing, business_street/postal/country/house_number)
        'id, contact_type, name, role:position, organization, organization_id, email, phone, ' +
        'avatar_url, is_favorite, category, priority, last_contact, gender, ' +
        'address, business_city, birthday, notes, linkedin',
        { count: 'planned' }
      )
      .eq('tenant_id', tenantId || '');

    // Filter by tab
    if (activeTab === "contacts") {
      query = query.eq('contact_type', 'person').neq('name', 'Archivierter Kontakt');
    } else if (activeTab === "stakeholders" || activeTab === "stakeholder-network") {
      query = query.eq('contact_type', 'organization');
    } else if (activeTab === "archive") {
      query = query.eq('name', 'Archivierter Kontakt');
    }

    // Search filter: quoted values keep commas and parentheses literal, and the
    // phone/address fields make a number typed from a letterhead findable.
    const searchFilter = buildContactSearchFilter(searchTerm);
    if (searchFilter) {
      query = query.or(searchFilter);
    }

    // Category filter
    if (selectedCategory !== "all") {
      if (selectedCategory === "favorites") {
        query = query.eq('is_favorite', true);
      } else if (selectedCategory === "review_due") {
        const today = new Date().toISOString().slice(0, 10);
        query = query.or(`retention_review_date.is.null,retention_review_date.lte.${today}`);
      } else {
        query = query.eq('category', selectedCategory);
      }
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
  }, [tenantId, activeTab, searchTerm, selectedCategory, selectedTagFilter, sortColumn, sortDirection]);

  const fetchContacts = useCallback(async (isLoadMore: boolean, generation: number) => {
    if (!userId || !tenantId) {
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    if (inFlightGenerationRef.current === generation) return;
    inFlightGenerationRef.current = generation;
    setLoadError(false);

    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const offset = isLoadMore ? pageRef.current * ITEMS_PER_PAGE : 0;
      let query = buildQuery(offset, ITEMS_PER_PAGE);

      if (selectedTagFilter) {
        const { data: topicLinks, error: topicLinkError } = await supabase
          .from('contact_topics')
          .select('contact_id')
          .eq('tenant_id', tenantId)
          .eq('topic_id', selectedTagFilter);
        if (topicLinkError) throw topicLinkError;
        const filteredIds = [...new Set((topicLinks ?? []).map((link) => link.contact_id))];
        if (filteredIds.length === 0) {
          setContacts([]);
          setTotalCount(0);
          setHasMore(false);
          return;
        }
        query = query.in('id', filteredIds);
      }

      const { data, error, count } = await query;

      // Discard results if a newer fetch has been started
      if (generation !== fetchGenerationRef.current) return;

      if (error) {
        debugConsole.error('Supabase query error:', error);
        throw error;
      }

      const topicMap = await fetchEntityTopicIds(
        "contact",
        ((data ?? []) as Array<Record<string, any>>).map((contact) => contact.id),
        tenantId,
      );

      const formattedContacts = data?.map((contact: Record<string, any>) => ({
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
        linkedin: contact.linkedin,
        category: contact.category as Contact["category"],
        priority: contact.priority as Contact["priority"],
        last_contact: contact.last_contact,
        avatar_url: contact.avatar_url,
        notes: contact.notes,
        is_favorite: contact.is_favorite,
        gender: contact.gender,
        topic_ids: topicMap[contact.id] ?? [],
        // Detail-only Felder (nicht in Listenansicht geladen): website, twitter, facebook, instagram, xing, business_street/postal/country/house_number
      })) || [];

      if (isLoadMore) {
        setContacts(prev => [...prev, ...formattedContacts]);
        pageRef.current += 1;
      } else {
        setContacts(formattedContacts);
        pageRef.current = 1;
      }

      setTotalCount(count || 0);
      setHasMore(formattedContacts.length === ITEMS_PER_PAGE);

    } catch (error) {
      if (generation !== fetchGenerationRef.current) return;
      setLoadError(true);
      setHasMore(false);
      debugConsole.error('Error fetching contacts:', error);
      notify.error("Fehler", {
        description: "Kontakte konnten nicht geladen werden."
});
    } finally {
      if (inFlightGenerationRef.current === generation) {
        inFlightGenerationRef.current = null;
      }
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [userId, tenantId, buildQuery, searchTerm, selectedCategory, activeTab]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      fetchContacts(true, fetchGenerationRef.current);
    }
  }, [fetchContacts, loading, loadingMore, hasMore]);

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

      notify.success("Erfolg", {
        description: isFavorite
          ? "Kontakt zu Favoriten hinzugefügt"
          : "Kontakt aus Favoriten entfernt"
});
    } catch (error) {
      debugConsole.error('Error toggling favorite:', error);
      notify.error("Fehler", {
        description: "Favorit konnte nicht aktualisiert werden."
});
    }
  }, []);

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

    setLoadError(false);
    if (userId && tenantId) {
      void fetchContacts(false, generation);
    } else {
      setLoading(false);
      setLoadingMore(false);
    }
    return () => { fetchGenerationRef.current += 1; };
  }, [userId, tenantId, searchTerm, selectedCategory, selectedTagFilter, activeTab, sortColumn, sortDirection, fetchContacts]);

  const refreshContacts = useCallback(() => {
    if (!userId || !tenantId) return;

    fetchGenerationRef.current += 1;
    const generation = fetchGenerationRef.current;

    pageRef.current = 0;
    setContacts([]);
    setHasMore(true);
    setTotalCount(0);
    fetchContacts(false, generation);
  }, [userId, tenantId, fetchContacts]);

  return {
    contacts,
    loading,
    loadingMore,
    loadError,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts
  };
};
