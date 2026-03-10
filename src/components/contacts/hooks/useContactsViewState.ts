import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { debugConsole } from "@/utils/debugConsole";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { useInfiniteContacts, Contact } from "@/hooks/useInfiniteContacts";
import { useCounts } from "@/hooks/useCounts";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useContactDocumentCounts } from "@/hooks/useContactDocumentCounts";
import { getInitials } from "../utils/contactFormatters";
import { useContactsDistributionLists } from "./useContactsDistributionLists";
import { useContactsDocumentsExpansion } from "./useContactsDocumentsExpansion";
import { useContactsFiltersAndSorting } from "./useContactsFiltersAndSorting";
import { useContactsSelection } from "./useContactsSelection";
import { useContactsViewPreferences } from "./useContactsViewPreferences";

export type { DistributionList } from "./useContactsDistributionLists";

export interface UseContactsViewStateResult {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedCategory: string;
  setSelectedCategory: Dispatch<SetStateAction<string>>;
  selectedType: string;
  setSelectedType: Dispatch<SetStateAction<string>>;
  distributionLists: ReturnType<typeof useContactsDistributionLists>["distributionLists"];
  distributionListsLoading: boolean;
  selectedContactId: string | null;
  setSelectedContactId: Dispatch<SetStateAction<string | null>>;
  isSheetOpen: boolean;
  setIsSheetOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: ReturnType<typeof useContactsViewPreferences>["viewMode"];
  stakeholderViewMode: ReturnType<typeof useContactsViewPreferences>["stakeholderViewMode"];
  distributionViewMode: ReturnType<typeof useContactsViewPreferences>["distributionViewMode"];
  activeTab: ReturnType<typeof useContactsViewPreferences>["activeTab"];
  setActiveTab: ReturnType<typeof useContactsViewPreferences>["setActiveTab"];
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  stakeholderSortColumn: string | null;
  stakeholderSortDirection: "asc" | "desc";
  showScrollTop: boolean;
  selectedTagFilter: string;
  setSelectedTagFilter: Dispatch<SetStateAction<string>>;
  isDuplicateSheetOpen: boolean;
  setIsDuplicateSheetOpen: Dispatch<SetStateAction<boolean>>;
  selectedContactIds: Set<string>;
  isSelectionMode: boolean;
  setIsSelectionMode: Dispatch<SetStateAction<boolean>>;
  expandedDocuments: Set<string>;
  editingDistributionListId: string | null;
  setEditingDistributionListId: Dispatch<SetStateAction<string | null>>;
  creatingDistribution: boolean;
  setCreatingDistribution: Dispatch<SetStateAction<boolean>>;
  allTags: string[];
  user: ReturnType<typeof useAuth>["user"];
  currentTenant: ReturnType<typeof useTenant>["currentTenant"];
  tenantLoading: boolean;
  navigate: ReturnType<typeof useNavigate>;
  contacts: Contact[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => void;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  refreshContacts: () => void;
  contactsCount: number;
  stakeholdersCount: number;
  archiveCount: number;
  distributionListsCount: number;
  personContacts: ReturnType<typeof useAllPersonContacts>["personContacts"];
  documentCounts: ReturnType<typeof useContactDocumentCounts>["counts"];
  categories: Array<{ value: string; label: string; count: number }>;
  fetchDistributionLists: ReturnType<typeof useContactsDistributionLists>["fetchDistributionLists"];
  deleteDistributionList: ReturnType<typeof useContactsDistributionLists>["deleteDistributionList"];
  handleDeleteContact: (contactId: string, contactName: string) => Promise<void>;
  handleSort: (column: string) => void;
  handleStakeholderSort: (column: string) => void;
  toggleContactSelection: (contactId: string) => void;
  selectAllContacts: () => void;
  clearSelection: () => void;
  toggleDocumentsExpanded: (contactId: string) => void;
  scrollToTop: () => void;
  setViewModeAndPersist: ReturnType<typeof useContactsViewPreferences>["setViewModeAndPersist"];
}

export function useContactsViewState(): UseContactsViewStateResult {
  const navigate = useNavigate();
  const { subId } = useParams();
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  const preferences = useContactsViewPreferences(subId);
  const filtersAndSorting = useContactsFiltersAndSorting(preferences.activeTab);
  const selection = useContactsSelection();
  const documentsExpansion = useContactsDocumentsExpansion();

  const { contactsCount, stakeholdersCount, archiveCount, distributionListsCount } = useCounts();
  const { personContacts } = useAllPersonContacts();

  const {
    contacts,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts,
  } = useInfiniteContacts({
    searchTerm: filtersAndSorting.debouncedSearchTerm,
    selectedCategory: filtersAndSorting.selectedCategory,
    selectedType: filtersAndSorting.selectedType,
    activeTab: preferences.activeTab,
    sortColumn: filtersAndSorting.activeSortColumn,
    sortDirection: filtersAndSorting.activeSortDirection,
    selectedTagFilter: filtersAndSorting.selectedTagFilter,
  });

  const distributionListsState = useContactsDistributionLists(user, currentTenant?.id, toast);

  const visibleContactIds = contacts.map((contact) => contact.id);
  const { counts: documentCounts } = useContactDocumentCounts(visibleContactIds);

  const categories = useMemo(
    () => [
      { value: "all", label: "Alle Kontakte", count: totalCount },
      { value: "favorites", label: "Favoriten", count: contacts.filter((contact) => contact.is_favorite).length },
      { value: "citizen", label: "Bürger", count: contacts.filter((contact) => contact.category === "citizen").length },
      { value: "colleague", label: "Kollegen", count: contacts.filter((contact) => contact.category === "colleague").length },
      { value: "business", label: "Wirtschaft", count: contacts.filter((contact) => contact.category === "business").length },
      { value: "media", label: "Medien", count: contacts.filter((contact) => contact.category === "media").length },
      { value: "lobbyist", label: "Lobbyisten", count: contacts.filter((contact) => contact.category === "lobbyist").length },
    ],
    [contacts, totalCount],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();

    for (const contact of contacts) {
      for (const tag of contact.tags ?? []) {
        const normalizedTag = tag.trim();
        if (normalizedTag) {
          tags.add(normalizedTag);
        }
      }
    }

    return [...tags].sort((a, b) => a.localeCompare(b, "de"));
  }, [contacts]);

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);

      if (error) {
        throw error;
      }

      toast({ title: "Kontakt gelöscht", description: `${contactName} wurde erfolgreich gelöscht.` });
      refreshContacts();
    } catch (error) {
      debugConsole.error("Error deleting contact:", error);
      toast({ title: "Fehler", description: "Kontakt konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  return {
    searchTerm: filtersAndSorting.searchTerm,
    setSearchTerm: filtersAndSorting.setSearchTerm,
    selectedCategory: filtersAndSorting.selectedCategory,
    setSelectedCategory: filtersAndSorting.setSelectedCategory,
    selectedType: filtersAndSorting.selectedType,
    setSelectedType: filtersAndSorting.setSelectedType,
    distributionLists: distributionListsState.distributionLists,
    distributionListsLoading: distributionListsState.distributionListsLoading,
    selectedContactId: selection.selectedContactId,
    setSelectedContactId: selection.setSelectedContactId,
    isSheetOpen: selection.isSheetOpen,
    setIsSheetOpen: selection.setIsSheetOpen,
    viewMode: preferences.viewMode,
    stakeholderViewMode: preferences.stakeholderViewMode,
    distributionViewMode: preferences.distributionViewMode,
    activeTab: preferences.activeTab,
    setActiveTab: preferences.setActiveTab,
    showFilters: preferences.showFilters,
    setShowFilters: preferences.setShowFilters,
    sortColumn: filtersAndSorting.sortColumn,
    sortDirection: filtersAndSorting.sortDirection,
    stakeholderSortColumn: filtersAndSorting.stakeholderSortColumn,
    stakeholderSortDirection: filtersAndSorting.stakeholderSortDirection,
    showScrollTop: preferences.showScrollTop,
    selectedTagFilter: filtersAndSorting.selectedTagFilter,
    setSelectedTagFilter: filtersAndSorting.setSelectedTagFilter,
    isDuplicateSheetOpen: selection.isDuplicateSheetOpen,
    setIsDuplicateSheetOpen: selection.setIsDuplicateSheetOpen,
    selectedContactIds: selection.selectedContactIds,
    isSelectionMode: selection.isSelectionMode,
    setIsSelectionMode: selection.setIsSelectionMode,
    expandedDocuments: documentsExpansion.expandedDocuments,
    editingDistributionListId: distributionListsState.editingDistributionListId,
    setEditingDistributionListId: distributionListsState.setEditingDistributionListId,
    creatingDistribution: distributionListsState.creatingDistribution,
    setCreatingDistribution: distributionListsState.setCreatingDistribution,
    allTags,
    user,
    currentTenant,
    tenantLoading,
    navigate,
    contacts,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts,
    contactsCount,
    stakeholdersCount,
    archiveCount,
    distributionListsCount,
    personContacts,
    documentCounts,
    categories,
    fetchDistributionLists: distributionListsState.fetchDistributionLists,
    deleteDistributionList: distributionListsState.deleteDistributionList,
    handleDeleteContact,
    handleSort: filtersAndSorting.handleSort,
    handleStakeholderSort: filtersAndSorting.handleStakeholderSort,
    toggleContactSelection: selection.toggleContactSelection,
    selectAllContacts: () => selection.selectAllContacts(contacts),
    clearSelection: selection.clearSelection,
    toggleDocumentsExpanded: documentsExpansion.toggleDocumentsExpanded,
    scrollToTop: preferences.scrollToTop,
    setViewModeAndPersist: preferences.setViewModeAndPersist,
  };
}

// Utility functions
export function getCategoryColor(category: Contact["category"]) {
  switch (category) {
    case "citizen":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "colleague":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "business":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "media":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "lobbyist":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function getPriorityColor(priority: Contact["priority"]) {
  switch (priority) {
    case "high":
      return "border-l-4 border-l-destructive";
    case "medium":
      return "border-l-4 border-l-government-gold";
    case "low":
      return "border-l-4 border-l-muted-foreground";
  }
}

export { getInitials };

export function getGenderLabel(gender?: string) {
  if (gender === "m") return "Herr";
  if (gender === "f") return "Frau";
  if (gender === "d") return "Divers";
  return "";
}
