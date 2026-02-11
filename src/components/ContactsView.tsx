import { useState, useEffect, useCallback, useMemo } from "react";
import React from "react";
import { cn } from "@/lib/utils";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, Mail, Phone, MapPin, Building, User, Filter, Grid3X3, List, Users, Edit, Trash2, Archive, Upload, ChevronUp, ChevronDown, ChevronRight, Star, Tag, Merge, CheckSquare, Square, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { ContactDetailSheet } from "./ContactDetailSheet";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { useInfiniteContacts, Contact } from "@/hooks/useInfiniteContacts";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";
import { ContactSkeleton } from "./ContactSkeleton";
import { StakeholderView } from "./StakeholderView";
import { DuplicateContactsSheet } from "./contacts/DuplicateContactsSheet";
import { BulkActionsToolbar } from "./contacts/BulkActionsToolbar";
import { ContactQuickActions } from "./contacts/ContactQuickActions";
import { debounce } from "@/utils/debounce";
import { useCounts } from "@/hooks/useCounts";
import { useAllPersonContacts } from "@/hooks/useAllPersonContacts";
import { useContactDocumentCounts } from "@/hooks/useContactDocumentCounts";
import { ContactDocumentsList } from "./contacts/ContactDocumentsList";
import { ContactDocumentRows } from "./contacts/ContactDocumentRows";
import { useContactDocuments } from "@/hooks/useContactDocuments";

interface DistributionList {
  id: string;
  name: string;
  description?: string;
  topic?: string;
  created_at: string;
  member_count: number;
  members: Contact[];
}

// Lazy load DistributionListForm to avoid circular imports
import { DistributionListForm } from "@/components/DistributionListForm";

export function ContactsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [distributionListsLoading, setDistributionListsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return localStorage.getItem('contacts-view-mode') as "grid" | "list" || "grid";
  });
  const [stakeholderViewMode, setStakeholderViewMode] = useState<"grid" | "list">(() => {
    return localStorage.getItem('stakeholders-view-mode') as "grid" | "list" || "grid";
  });
  const [distributionViewMode, setDistributionViewMode] = useState<"grid" | "list">(() => {
    return localStorage.getItem('distribution-view-mode') as "grid" | "list" || "grid";
  });
  const [activeTab, setActiveTab] = useState<"contacts" | "stakeholders" | "distribution-lists" | "archive">("contacts");
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [stakeholderSortColumn, setStakeholderSortColumn] = useState<string | null>(null);
  const [stakeholderSortDirection, setStakeholderSortDirection] = useState<"asc" | "desc">("asc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [editingDistributionListId, setEditingDistributionListId] = useState<string | null>(null);
  const [creatingDistribution, setCreatingDistribution] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

  // Note: create-contact action is handled globally by GlobalQuickActionHandler

  // Get accurate counts for tab badges - MUST be before early returns
  const { contactsCount, stakeholdersCount, archiveCount, distributionListsCount } = useCounts();

  // Load all person contacts for stakeholder assignments - MUST be before early returns  
  const { personContacts, loading: personContactsLoading } = useAllPersonContacts();

  // Use infinite contacts hook - MUST be before early returns
  const {
    contacts,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    toggleFavorite,
    refreshContacts
  } = useInfiniteContacts({
    searchTerm: debouncedSearchTerm,
    selectedCategory,
    selectedType,
    activeTab,
    sortColumn: activeTab === "stakeholders" ? stakeholderSortColumn : sortColumn,
    sortDirection: activeTab === "stakeholders" ? stakeholderSortDirection : sortDirection,
    selectedTagFilter,
  });

  // Get document counts for visible contacts
  const visibleContactIds = contacts.map(c => c.id);
  const { counts: documentCounts } = useContactDocumentCounts(visibleContactIds);

  // Create stable debounced function - MUST be before early returns
  const debouncedUpdate = useMemo(
    () => debounce((term: string) => {
      setDebouncedSearchTerm(term);
    }, 300),
    []
  );

  // Categories memo - MUST be before early returns
  const categories = useMemo(() => [
    { value: "all", label: "Alle Kontakte", count: totalCount },
    { value: "favorites", label: "Favoriten", count: contacts.filter(c => c.is_favorite).length },
    { value: "citizen", label: "Bürger", count: contacts.filter(c => c.category === "citizen").length },
    { value: "colleague", label: "Kollegen", count: contacts.filter(c => c.category === "colleague").length },
    { value: "business", label: "Wirtschaft", count: contacts.filter(c => c.category === "business").length },
    { value: "media", label: "Medien", count: contacts.filter(c => c.category === "media").length },
    { value: "lobbyist", label: "Lobbyisten", count: contacts.filter(c => c.category === "lobbyist").length },
  ], [contacts, totalCount]);

  // Update debounced search term when searchTerm changes - MUST be before early returns
  useEffect(() => {
    debouncedUpdate(searchTerm);
  }, [searchTerm, debouncedUpdate]);

  // Fetch distribution lists - MUST be before early returns
  useEffect(() => {
    if (user && currentTenant) {
      fetchDistributionLists();
    }
  }, [user, currentTenant]);

  // Scroll event listener for back-to-top button - MUST be before early returns
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleDocumentsExpanded = (contactId: string) => {
    setExpandedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };


  // Show loading until auth and tenant are resolved
  if (!user || tenantLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">System wird geladen...</p>
        </div>
      </div>
    );
  }

  // Show error if no tenant access
  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">Kein Zugriff</h2>
          <p className="text-muted-foreground mb-6">
            Sie haben keinen Zugriff auf einen Mandanten. Bitte wenden Sie sich an Ihren Administrator.
          </p>
          <Button onClick={() => navigate("/auth")} variant="outline">
            Zurück zur Anmeldung
          </Button>
        </div>
      </div>
    );
  }

  const fetchDistributionLists = async () => {
    try {
      setDistributionListsLoading(true);
      const { data, error } = await supabase
        .from('distribution_lists')
        .select(`
          *,
          distribution_list_members(
            contacts(id, name, email, organization, avatar_url, category)
          )
        `)
        .order('name');

      if (error) throw error;

      const formattedLists = data?.map(list => ({
        id: list.id,
        name: list.name,
        description: list.description,
        topic: list.topic,
        created_at: list.created_at,
        member_count: list.distribution_list_members?.length || 0,
        members: list.distribution_list_members?.map((member: any) => member.contacts) || [],
      })) || [];

      setDistributionLists(formattedLists);
    } catch (error) {
      console.error('Error fetching distribution lists:', error);
      toast({
        title: "Fehler",
        description: "Verteiler konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setDistributionListsLoading(false);
    }
  };

  const deleteDistributionList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('distribution_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Verteiler wurde erfolgreich gelöscht.",
      });

      fetchDistributionLists();
    } catch (error) {
      console.error('Error deleting distribution list:', error);
      toast({
        title: "Fehler",
        description: "Verteiler konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  // toggleFavorite is now handled by the hook

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Kontakt gelöscht",
        description: `${contactName} wurde erfolgreich gelöscht.`,
      });

      refreshContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  const getCategoryColor = (category: Contact["category"]) => {
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
  };

  const getPriorityColor = (priority: Contact["priority"]) => {
    switch (priority) {
      case "high":
        return "border-l-4 border-l-destructive";
      case "medium":
        return "border-l-4 border-l-government-gold";
      case "low":
        return "border-l-4 border-l-muted-foreground";
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleStakeholderSort = (column: string) => {
    if (stakeholderSortColumn === column) {
      setStakeholderSortDirection(stakeholderSortDirection === "asc" ? "desc" : "asc");
    } else {
      setStakeholderSortColumn(column);
      setStakeholderSortDirection("asc");
    }
  };

  // Contacts are now filtered server-side by the hook
  const filteredContacts = contacts;

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const selectAllContacts = () => {
    setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedContactIds(new Set());
    setIsSelectionMode(false);
  };

  const selectedContacts = filteredContacts.filter(c => selectedContactIds.has(c.id));

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const SortableTableHead = ({ children, sortKey, className = "" }: { 
    children: React.ReactNode; 
    sortKey: string; 
    className?: string; 
  }) => (
    <TableHead className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`} onClick={() => handleSort(sortKey)}>
      <div className="flex items-center gap-2">
        {children}
        <div className="flex flex-col gap-0">
          <ChevronUp 
            className={`h-3 w-3 transition-colors ${
              sortColumn === sortKey && sortDirection === "asc" 
                ? "text-primary" 
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`} 
          />
          <ChevronDown 
            className={`h-3 w-3 transition-colors -mt-0.5 ${
              sortColumn === sortKey && sortDirection === "desc" 
                ? "text-primary" 
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`} 
          />
        </div>
      </div>
    </TableHead>
  );

  if (loading && contacts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Kontakte werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: Contact List */}
      <div className={cn(
        "flex-1 overflow-y-auto transition-all",
        selectedContactId && !isSheetOpen ? "hidden md:block md:w-2/5 lg:w-2/5" : "w-full"
      )}>
    <div className="min-h-0 bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Kontakte & Organisationen</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre wichtigsten Kontakte, Organisationen und Beziehungen
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/contacts/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Neuer Kontakt
              </Button>
            </Link>
            <Link to="/contacts/import">
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Kontakte importieren
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setIsDuplicateSheetOpen(true)}
            >
              <Merge className="h-4 w-4" />
              Duplikate prüfen
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => { setActiveTab("distribution-lists"); setCreatingDistribution(true); }}>
              <Users className="h-4 w-4" />
              Neuer Verteiler
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "contacts" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("contacts")}
            className="gap-2"
          >
            <User className="h-4 w-4" />
            Kontakte ({contactsCount})
          </Button>
          <Button
            variant={activeTab === "stakeholders" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("stakeholders")}
            className="gap-2"
          >
            <Building className="h-4 w-4" />
            Stakeholder ({stakeholdersCount})
          </Button>
          <Button
            variant={activeTab === "distribution-lists" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("distribution-lists")}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Verteiler ({distributionListsCount})
          </Button>
          <Button
            variant={activeTab === "archive" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("archive")}
            className="gap-2"
          >
            <Archive className="h-4 w-4" />
            Archiv ({archiveCount})
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Kontakte durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {selectedTagFilter && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Tag: {selectedTagFilter}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTagFilter("")}
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                ×
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex border border-border rounded-md">
              <Button
                variant={
                  (activeTab === "contacts" ? viewMode : 
                   activeTab === "stakeholders" ? stakeholderViewMode : 
                   distributionViewMode) === "grid" ? "default" : "ghost"
                }
                size="sm"
                onClick={() => {
                  if (activeTab === "contacts") {
                    setViewMode("grid");
                    localStorage.setItem('contacts-view-mode', 'grid');
                  } else if (activeTab === "stakeholders") {
                    setStakeholderViewMode("grid");
                    localStorage.setItem('stakeholders-view-mode', 'grid');
                  } else {
                    setDistributionViewMode("grid");
                    localStorage.setItem('distribution-view-mode', 'grid');
                  }
                }}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  (activeTab === "contacts" ? viewMode : 
                   activeTab === "stakeholders" ? stakeholderViewMode : 
                   distributionViewMode) === "list" ? "default" : "ghost"
                }
                size="sm"
                onClick={() => {
                  if (activeTab === "contacts") {
                    setViewMode("list");
                    localStorage.setItem('contacts-view-mode', 'list');
                  } else if (activeTab === "stakeholders") {
                    setStakeholderViewMode("list");
                    localStorage.setItem('stakeholders-view-mode', 'list');
                  } else {
                    setDistributionViewMode("list");
                    localStorage.setItem('distribution-view-mode', 'list');
                  }
                }}
                className="rounded-l-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant={showFilters ? "default" : "outline"} 
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            {activeTab === "contacts" && (
              <>
                <Button 
                  variant={isSelectionMode ? "default" : "outline"} 
                  className="gap-2"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) {
                      clearSelection();
                    }
                  }}
                >
                  {isSelectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  Auswählen
                </Button>
                {isSelectionMode && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (selectedContactIds.size === filteredContacts.length) {
                        clearSelection();
                      } else {
                        selectAllContacts();
                      }
                    }}
                  >
                    {selectedContactIds.size === filteredContacts.length ? 'Alle abwählen' : 'Alle auswählen'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Type Filter - Only show for contacts tab and when filters are open */}
        {activeTab === "contacts" && showFilters && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <Button
            variant={selectedType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("all")}
            className="whitespace-nowrap min-h-[44px]"
          >
            Alle ({contacts.length})
          </Button>
          <Button
            variant={selectedType === "person" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("person")}
            className="whitespace-nowrap min-h-[44px]"
          >
            Personen ({contacts.filter(c => c.contact_type === "person").length})
          </Button>
          <Button
            variant={selectedType === "organization" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("organization")}
            className="whitespace-nowrap min-h-[44px]"
          >
            Organisationen ({contacts.filter(c => c.contact_type === "organization").length})
          </Button>
        </div>
        )}

        {/* Category Tabs - Only show for contacts tab and when filters are open */}
        {activeTab === "contacts" && showFilters && (
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((category) => (
            <Button
              key={category.value}
              variant={selectedCategory === category.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.value)}
              className="whitespace-nowrap min-h-[44px]"
            >
              {category.label} ({category.count})
            </Button>
          ))}
        </div>
        )}
      </div>

      {/* Content Display */}
      {activeTab === "contacts" ? (
        <div className="space-y-6">
          {loading && contacts.length === 0 ? (
            <ContactSkeleton count={12} viewMode={viewMode} />
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              className={`bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer group relative ${getPriorityColor(
                contact.priority
              )} ${selectedContactIds.has(contact.id) ? 'ring-2 ring-primary' : ''}`}
              onClick={() => {
                if (isSelectionMode) {
                  toggleContactSelection(contact.id);
                } else {
                  setSelectedContactId(contact.id);
                }
              }}
            >
              {isSelectionMode && (
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedContactIds.has(contact.id)}
                    onCheckedChange={() => toggleContactSelection(contact.id)}
                  />
                </div>
              )}
              
              {!isSelectionMode && (
                <ContactQuickActions contact={contact} />
              )}
              
               <CardHeader className="pb-3">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                       <div className="flex-1">
                         <CardTitle className="text-lg mb0">{contact.name}</CardTitle>
                         <p className="text-sm text-muted-foreground">
                           {contact.contact_type === "organization" 
                             ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                             : contact.role
                           }
                         </p>                       
                       </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(contact.id, !contact.is_favorite);
                      }}
                      className="p-2"
                    >
                      <Star 
                        className={`h-4 w-4 transition-colors ${
                          contact.is_favorite 
                            ? 'text-yellow-500 fill-current' 
                            : 'text-muted-foreground hover:text-yellow-500'
                        }`} 
                      />
                    </Button>
                 </div>
               </CardHeader>
              <CardContent>
                { /* <div className="mt-2">
                   <Badge className={getCategoryColor(contact.category)}>
                            {contact.category === "citizen" && "Bürger"}
                            {contact.category === "colleague" && "Kollege"}
                            {contact.category === "business" && "Wirtschaft"}
                            {contact.category === "media" && "Medien"}
                            {contact.category === "lobbyist" && "Lobbyist"}
                          </Badge>
                </div> */}
                <div className="space-y-3">
                  {contact.contact_type === "person" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span className="truncate">{contact.organization || "Keine Organisation"}</span>
                    </div>
                  ) : contact.business_description ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span className="truncate">{contact.business_description}</span>
                    </div>
                  ) : null}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{contact.email || "Keine E-Mail"}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{contact.phone || "Keine Telefonnummer"}</span>
                  </div>
                  
                  {contact.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{contact.location}</span>
                  </div>
                )}

                {contact.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{contact.address}</span>
                  </div>
                )}
                
                {contact.last_contact && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Letzter Kontakt: {contact.last_contact}
                    </span>
                  </div>
                )}
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Mail className="h-4 w-4 mr-1" />
                    E-Mail
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Phone className="h-4 w-4 mr-1" />
                    Anrufen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Sind Sie sicher, dass Sie "${contact.name}" löschen möchten?`)) {
                        handleDeleteContact(contact.id, contact.name);
                      }
                    }}
                    className="px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Avatar</TableHead>
                <SortableTableHead sortKey="name">Name</SortableTableHead>
                <SortableTableHead sortKey="organization">Organisation/Rolle</SortableTableHead>
                <SortableTableHead sortKey="email">Kontakt</SortableTableHead>
                <SortableTableHead sortKey="address">Adresse</SortableTableHead>
                <SortableTableHead sortKey="last_contact">Letzter Kontakt</SortableTableHead>
                <TableHead className="text-center w-24">Dokumente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <React.Fragment key={contact.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedContactId(contact.id);
                    }}
                  >
                  <TableCell>
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={contact.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(contact.id, !contact.is_favorite);
                        }}
                        className="absolute -top-1 -right-1 h-4 w-4 p-0 bg-background rounded-full shadow-sm hover:bg-muted"
                      >
                        <Star 
                          className={`h-3 w-3 transition-colors ${
                            contact.is_favorite 
                              ? 'text-yellow-500 fill-current' 
                              : 'text-muted-foreground hover:text-yellow-500'
                          }`} 
                        />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>
                    {contact.contact_type === "organization" 
                      ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                      : contact.organization || contact.role || "—"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {contact.email && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(contact.email!);
                                  toast({ title: "E-Mail kopiert" });
                                }}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{contact.email}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {contact.phone && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(contact.phone!);
                                  toast({ title: "Telefon kopiert" });
                                }}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{contact.phone}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {contact.website && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(contact.website!);
                                  toast({ title: "Website kopiert" });
                                }}
                              >
                                <Building className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{contact.website}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {contact.linkedin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(contact.linkedin!);
                                  toast({ title: "LinkedIn kopiert" });
                                }}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{contact.linkedin}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {(contact.address || contact.location) && (
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div className="leading-tight">
                            <div>{contact.address || contact.location}</div>
                          </div>
                        </div>
                      )}
                      {!contact.address && !contact.location && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.last_contact || "—"}
                  </TableCell>
                  <TableCell 
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {documentCounts[contact.id]?.total > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDocumentsExpanded(contact.id)}
                        className="p-1 h-auto text-sm hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight 
                            className={`h-3 w-3 transition-transform ${
                              expandedDocuments.has(contact.id) ? 'rotate-90' : ''
                            }`} 
                          />
                          <FileText className="h-3 w-3" />
                          <span>{documentCounts[contact.id].total}</span>
                        </div>
                      </Button>
                    )}
                    {(!documentCounts[contact.id] || documentCounts[contact.id].total === 0) && "—"}
                  </TableCell>
                  </TableRow>
                  {/* Collapsible document rows */}
                  {expandedDocuments.has(contact.id) && (
                    <ContactDocumentRows contactId={contact.id} contactTags={contact.tags || []} />
                  )}
                </React.Fragment>
              ))}

                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="py-8">
              <ContactSkeleton count={6} viewMode={viewMode} />
            </div>
          )}
          
          {/* Infinite Scroll Trigger */}
          <InfiniteScrollTrigger
            onLoadMore={loadMore}
            loading={loadingMore}
            hasMore={hasMore}
          />
          
          {/* Load More Button (Fallback) */}
          {!loadingMore && hasMore && filteredContacts.length > 0 && (
            <div className="text-center py-6">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={loadingMore}
                className="gap-2"
              >
                Weitere Kontakte laden ({totalCount - contacts.length} verbleibend)
              </Button>
            </div>
          )}
          
          {/* No More Results */}
          {!hasMore && filteredContacts.length > 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <p>Alle Kontakte wurden geladen.</p>
            </div>
          )}
          
          {/* Empty State */}
          {!loading && filteredContacts.length === 0 && (
            <Card className="bg-card shadow-card border-border">
              <CardContent className="text-center py-12">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Kontakte gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedCategory !== "all" || selectedType !== "all"
                    ? "Versuchen Sie es mit anderen Suchkriterien."
                    : "Erstellen Sie Ihren ersten Kontakt."}
                </p>
                <Link to="/contacts/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Neuen Kontakt erstellen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
          )}
        </div>
      ) : activeTab === "stakeholders" ? (
        <div className="space-y-6">
          {loading && contacts.length === 0 ? (
            <ContactSkeleton count={6} viewMode="grid" />
          ) : (
            <StakeholderView
              stakeholders={contacts}
              contacts={personContacts}
              viewMode={stakeholderViewMode}
              onToggleFavorite={toggleFavorite}
              onContactClick={(contactId) => {
                console.log('ContactsView: Stakeholder contact clicked:', contactId);
                setSelectedContactId(contactId);
              }}
              onRefresh={refreshContacts}
              hasMore={hasMore}
              loadMore={loadMore}
              loadingMore={loadingMore}
              sortColumn={stakeholderSortColumn}
              sortDirection={stakeholderSortDirection}
              onSort={handleStakeholderSort}
              onTagClick={(tag) => setSelectedTagFilter(tag)}
            />
          )}
          
          {/* Only one InfiniteScrollTrigger per view to prevent duplicates */}
          {hasMore && !loading && (
            <InfiniteScrollTrigger
              onLoadMore={loadMore}
              loading={loadingMore}
              hasMore={hasMore}
            />
          )}
        </div>
      ) : activeTab === "archive" ? (
        // Archive Display
        <div className="space-y-6">
          <Card className="bg-card shadow-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Kontakt-Archiv
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Automatisch erstellte Kontakte aus Follow-Ups unbekannter Telefonnummern, gruppiert nach Nummer.
              </p>
            </CardHeader>
            <CardContent>
              {contacts.filter(c => c.contact_type === 'archive').length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Kein Archiv vorhanden</h3>
                  <p className="text-muted-foreground">
                    Follow-Ups von unbekannten Kontakten werden automatisch hier archiviert.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Group archive contacts by phone number */}
                  {Object.entries(
                    contacts
                      .filter(c => c.contact_type === 'archive')
                      .reduce((groups, contact) => {
                        const phone = contact.phone || 'Unbekannte Nummer';
                        if (!groups[phone]) groups[phone] = [];
                        groups[phone].push(contact);
                        return groups;
                      }, {} as Record<string, Contact[]>)
                  ).map(([phone, groupContacts]) => (
                    <Card key={phone} className="border-l-4 border-l-muted">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {phone}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {groupContacts.length} Follow-Up{groupContacts.length !== 1 ? 's' : ''} archiviert
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {groupContacts.map(contact => (
                            <div key={contact.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <div>
                                <p className="font-medium">{contact.name}</p>
                                {contact.notes && (
                                  <p className="text-sm text-muted-foreground truncate max-w-md">
                                    {contact.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // Distribution Lists Display
        <div className="space-y-6">
          {/* Inline Distribution List Form */}
          {(creatingDistribution || editingDistributionListId) ? (
            <DistributionListForm
              distributionListId={editingDistributionListId || undefined}
              onSuccess={() => {
                setCreatingDistribution(false);
                setEditingDistributionListId(null);
                fetchDistributionLists();
              }}
              onBack={() => {
                setCreatingDistribution(false);
                setEditingDistributionListId(null);
              }}
            />
          ) : distributionListsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verteiler werden geladen...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {distributionLists.map((list) => (
                <Card key={list.id} className="bg-card shadow-card border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{list.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {list.member_count} Kontakte{list.topic && ` • ${list.topic}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1"
                          onClick={() => setEditingDistributionListId(list.id)}
                        >
                          <Edit className="h-4 w-4" />
                          Bearbeiten
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Sind Sie sicher, dass Sie den Verteiler "${list.name}" löschen möchten?`)) {
                              deleteDistributionList(list.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {list.description && (
                      <p className="text-sm text-muted-foreground mb-4">{list.description}</p>
                    )}
                    {list.members.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Mitglieder ({list.members.length}):</p>
                        <div className="border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="h-8 text-xs">Name</TableHead>
                                <TableHead className="h-8 text-xs">E-Mail</TableHead>
                                <TableHead className="h-8 text-xs hidden sm:table-cell">Organisation</TableHead>
                                <TableHead className="h-8 text-xs hidden md:table-cell">Kategorie</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.members.map((member) => (
                                <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedContactId(member.id); }}>
                                  <TableCell className="py-1.5 text-sm font-medium">{member.name}</TableCell>
                                  <TableCell className="py-1.5 text-sm text-muted-foreground">{member.email || '–'}</TableCell>
                                  <TableCell className="py-1.5 text-sm text-muted-foreground hidden sm:table-cell">{member.organization || '–'}</TableCell>
                                  <TableCell className="py-1.5 hidden md:table-cell">
                                    {member.category && (
                                      <Badge variant="outline" className="text-xs">
                                        {member.category === "citizen" ? "Bürger" : member.category === "colleague" ? "Kollege" : member.category === "business" ? "Wirtschaft" : member.category === "media" ? "Medien" : member.category === "lobbyist" ? "Lobbyist" : member.category}
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {distributionLists.length === 0 && (
                <Card className="bg-card shadow-card border-border">
                  <CardContent className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Keine Verteiler vorhanden</h3>
                    <p className="text-muted-foreground mb-4">
                      Erstellen Sie Ihren ersten Verteiler, um Kontakte zu organisieren.
                    </p>
                    <Button className="gap-2" onClick={() => setCreatingDistribution(true)}>
                      <Plus className="h-4 w-4" />
                      Ersten Verteiler erstellen
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Back to Top Button */}
      {showScrollTop && (
        <Button
          className="fixed bottom-6 right-6 rounded-full p-3 shadow-lg z-50"
          onClick={scrollToTop}
          size="sm"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}

      <BulkActionsToolbar
        selectedContacts={selectedContacts}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          clearSelection();
          refreshContacts();
        }}
        allTags={allTags}
      />

      <ContactDetailSheet
        contactId={selectedContactId}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedContactId(null);
        }}
        onContactUpdate={refreshContacts}
      />

      <DuplicateContactsSheet
        isOpen={isDuplicateSheetOpen}
        onClose={() => setIsDuplicateSheetOpen(false)}
        onDuplicatesResolved={refreshContacts}
      />
    </div>
    </div>

      {/* Right: Contact Detail Panel (inline, not overlay) */}
      {selectedContactId && !isSheetOpen && (
        <div className="w-full md:w-3/5 lg:w-3/5 border-l border-border overflow-hidden bg-background">
          <ContactDetailPanel
            contactId={selectedContactId}
            onClose={() => setSelectedContactId(null)}
            onContactUpdate={refreshContacts}
          />
        </div>
      )}
    </div>
  );
}