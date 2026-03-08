import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useInfiniteContacts, Contact } from "@/hooks/useInfiniteContacts";
import { useCounts } from "@/hooks/useCounts";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useContactDocumentCounts } from "@/hooks/useContactDocumentCounts";
import { debounce } from "@/utils/debounce";

export interface DistributionList {
  id: string;
  name: string;
  description?: string;
  topic?: string;
  created_at: string;
  member_count: number;
  members: Contact[];
}

export function useContactsViewState() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [distributionListsLoading, setDistributionListsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => localStorage.getItem('contacts-view-mode') as "grid" | "list" || "grid");
  const [stakeholderViewMode, setStakeholderViewMode] = useState<"grid" | "list">(() => localStorage.getItem('stakeholders-view-mode') as "grid" | "list" || "grid");
  const [distributionViewMode, setDistributionViewMode] = useState<"grid" | "list">(() => localStorage.getItem('distribution-view-mode') as "grid" | "list" || "grid");
  const [activeTab, setActiveTab] = useState<"contacts" | "stakeholders" | "stakeholder-network" | "distribution-lists" | "archive">("contacts");
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [stakeholderSortColumn, setStakeholderSortColumn] = useState<string | null>(null);
  const [stakeholderSortDirection, setStakeholderSortDirection] = useState<"asc" | "desc">("asc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [editingDistributionListId, setEditingDistributionListId] = useState<string | null>(null);
  const [creatingDistribution, setCreatingDistribution] = useState(false);
  const [allTags] = useState<string[]>([]);

  const navigate = useNavigate();
  const { subId } = useParams();
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  const { contactsCount, stakeholdersCount, archiveCount, distributionListsCount } = useCounts();
  const { personContacts, loading: personContactsLoading } = useAllPersonContacts();

  const {
    contacts, loading, loadingMore, hasMore, totalCount, loadMore, toggleFavorite, refreshContacts,
  } = useInfiniteContacts({
    searchTerm: debouncedSearchTerm, selectedCategory, selectedType, activeTab,
    sortColumn: activeTab === "stakeholders" ? stakeholderSortColumn : sortColumn,
    sortDirection: activeTab === "stakeholders" ? stakeholderSortDirection : sortDirection,
    selectedTagFilter,
  });

  const visibleContactIds = contacts.map(c => c.id);
  const { counts: documentCounts } = useContactDocumentCounts(visibleContactIds);

  const debouncedUpdate = useMemo(() => debounce((term: string) => setDebouncedSearchTerm(term), 300), []);

  const categories = useMemo(() => [
    { value: "all", label: "Alle Kontakte", count: totalCount },
    { value: "favorites", label: "Favoriten", count: contacts.filter(c => c.is_favorite).length },
    { value: "citizen", label: "Bürger", count: contacts.filter(c => c.category === "citizen").length },
    { value: "colleague", label: "Kollegen", count: contacts.filter(c => c.category === "colleague").length },
    { value: "business", label: "Wirtschaft", count: contacts.filter(c => c.category === "business").length },
    { value: "media", label: "Medien", count: contacts.filter(c => c.category === "media").length },
    { value: "lobbyist", label: "Lobbyisten", count: contacts.filter(c => c.category === "lobbyist").length },
  ], [contacts, totalCount]);

  useEffect(() => { debouncedUpdate(searchTerm); }, [searchTerm, debouncedUpdate]);

  useEffect(() => {
    if (subId === "netzwerk") { setActiveTab("stakeholder-network"); return; }
    if (subId === "stakeholder") { setActiveTab("stakeholders"); return; }
  }, [subId]);

  useEffect(() => { if (user && currentTenant) fetchDistributionLists(); }, [user, currentTenant]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchDistributionLists = async () => {
    try {
      setDistributionListsLoading(true);
      const { data, error } = await supabase.from('distribution_lists')
        .select(`*, distribution_list_members(contacts(id, name, email, organization, avatar_url, category))`).order('name');
      if (error) throw error;
      setDistributionLists(data?.map(list => ({
        id: list.id, name: list.name, description: list.description, topic: list.topic, created_at: list.created_at,
        member_count: list.distribution_list_members?.length || 0,
        members: list.distribution_list_members?.map((m: any) => m.contacts) || [],
      })) || []);
    } catch (error) {
      console.error('Error fetching distribution lists:', error);
      toast({ title: "Fehler", description: "Verteiler konnten nicht geladen werden.", variant: "destructive" });
    } finally { setDistributionListsLoading(false); }
  };

  const deleteDistributionList = async (id: string) => {
    try {
      const { error } = await supabase.from('distribution_lists').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Erfolg", description: "Verteiler wurde erfolgreich gelöscht." });
      fetchDistributionLists();
    } catch (error) {
      console.error('Error deleting distribution list:', error);
      toast({ title: "Fehler", description: "Verteiler konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId);
      if (error) throw error;
      toast({ title: "Kontakt gelöscht", description: `${contactName} wurde erfolgreich gelöscht.` });
      refreshContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({ title: "Fehler", description: "Kontakt konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) { setSortDirection(d => d === "asc" ? "desc" : "asc"); }
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const handleStakeholderSort = (column: string) => {
    if (stakeholderSortColumn === column) { setStakeholderSortDirection(d => d === "asc" ? "desc" : "asc"); }
    else { setStakeholderSortColumn(column); setStakeholderSortDirection("asc"); }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
      const s = new Set(prev);
      if (s.has(contactId)) s.delete(contactId); else s.add(contactId);
      return s;
    });
  };

  const selectAllContacts = () => setSelectedContactIds(new Set(contacts.map(c => c.id)));
  const clearSelection = () => { setSelectedContactIds(new Set()); setIsSelectionMode(false); };

  const toggleDocumentsExpanded = (contactId: string) => {
    setExpandedDocuments(prev => {
      const s = new Set(prev);
      if (s.has(contactId)) s.delete(contactId); else s.add(contactId);
      return s;
    });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const setViewModeAndPersist = (mode: "grid" | "list", tab: string) => {
    if (tab === "contacts") { setViewMode(mode); localStorage.setItem('contacts-view-mode', mode); }
    else if (tab === "stakeholders") { setStakeholderViewMode(mode); localStorage.setItem('stakeholders-view-mode', mode); }
    else { setDistributionViewMode(mode); localStorage.setItem('distribution-view-mode', mode); }
  };

  return {
    // State
    searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, selectedType, setSelectedType,
    distributionLists, distributionListsLoading, selectedContactId, setSelectedContactId,
    isSheetOpen, setIsSheetOpen, viewMode, stakeholderViewMode, distributionViewMode,
    activeTab, setActiveTab, showFilters, setShowFilters,
    sortColumn, sortDirection, stakeholderSortColumn, stakeholderSortDirection,
    showScrollTop, selectedTagFilter, setSelectedTagFilter,
    isDuplicateSheetOpen, setIsDuplicateSheetOpen,
    selectedContactIds, isSelectionMode, setIsSelectionMode,
    expandedDocuments, editingDistributionListId, setEditingDistributionListId,
    creatingDistribution, setCreatingDistribution, allTags,
    // Data
    user, currentTenant, tenantLoading, navigate,
    contacts, loading, loadingMore, hasMore, totalCount, loadMore, toggleFavorite, refreshContacts,
    contactsCount, stakeholdersCount, archiveCount, distributionListsCount,
    personContacts, documentCounts, categories,
    // Actions
    fetchDistributionLists, deleteDistributionList, handleDeleteContact,
    handleSort, handleStakeholderSort,
    toggleContactSelection, selectAllContacts, clearSelection,
    toggleDocumentsExpanded, scrollToTop, setViewModeAndPersist,
  };
}

// Utility functions
export function getCategoryColor(category: Contact["category"]) {
  switch (category) {
    case "citizen": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "colleague": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "business": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "media": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "lobbyist": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default: return "bg-muted text-muted-foreground";
  }
}

export function getPriorityColor(priority: Contact["priority"]) {
  switch (priority) {
    case "high": return "border-l-4 border-l-destructive";
    case "medium": return "border-l-4 border-l-government-gold";
    case "low": return "border-l-4 border-l-muted-foreground";
  }
}

export function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase();
}

export function getGenderLabel(gender?: string) {
  if (gender === "m") return "Herr";
  if (gender === "f") return "Frau";
  if (gender === "d") return "Divers";
  return "";
}
