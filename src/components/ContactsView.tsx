import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Mail, Phone, MapPin, Building, User, Filter, Grid3X3, List, Users, Edit, Trash2, Archive, Upload, ArrowUpWideNarrow, ArrowDownWideNarrow, Star, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { ContactDetailSheet } from "./ContactDetailSheet";
import { useInfiniteContacts, Contact } from "@/hooks/useInfiniteContacts";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";
import { ContactSkeleton } from "./ContactSkeleton";
import { StakeholderView } from "./StakeholderView";
import { debounce } from "@/utils/debounce";
import { useCounts } from "@/hooks/useCounts";

interface DistributionList {
  id: string;
  name: string;
  description?: string;
  topic?: string;
  created_at: string;
  member_count: number;
  members: Contact[];
}

export function ContactsView() {
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
  const [activeTab, setActiveTab] = useState<"contacts" | "stakeholders" | "distribution-lists" | "archive">("contacts");
  const [showFilters, setShowFilters] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const { toast } = useToast();

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
  
  // Get accurate counts for tab badges
  const { contactsCount, archiveCount, distributionListsCount } = useCounts();

  // Use infinite contacts hook
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
    sortColumn,
    sortDirection,
  });

  // Calculate stakeholders count after contacts are loaded
  const stakeholdersCount = useMemo(() => 
    contacts.filter(c => c.contact_type === "organization").length, 
    [contacts]
  );

  // Create stable debounced function
  const debouncedUpdate = useMemo(
    () => debounce((term: string) => {
      setDebouncedSearchTerm(term);
    }, 300),
    []
  );

  // Update debounced search term when searchTerm changes
  useEffect(() => {
    debouncedUpdate(searchTerm);
  }, [searchTerm, debouncedUpdate]);

  // Fetch distribution lists
  useEffect(() => {
    if (user && currentTenant) {
      fetchDistributionLists();
    }
  }, [user, currentTenant]);

  // Scroll event listener for back-to-top button
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

  const categories = useMemo(() => [
    { value: "all", label: "Alle Kontakte", count: totalCount },
    { value: "favorites", label: "Favoriten", count: contacts.filter(c => c.is_favorite).length },
    { value: "citizen", label: "Bürger", count: contacts.filter(c => c.category === "citizen").length },
    { value: "colleague", label: "Kollegen", count: contacts.filter(c => c.category === "colleague").length },
    { value: "business", label: "Wirtschaft", count: contacts.filter(c => c.category === "business").length },
    { value: "media", label: "Medien", count: contacts.filter(c => c.category === "media").length },
    { value: "lobbyist", label: "Lobbyisten", count: contacts.filter(c => c.category === "lobbyist").length },
  ], [contacts, totalCount]);

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

  // Contacts are now filtered server-side by the hook
  const filteredContacts = contacts;

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
          <ArrowUpWideNarrow 
            className={`h-3 w-3 transition-colors ${
              sortColumn === sortKey && sortDirection === "asc" 
                ? "text-primary" 
                : "text-muted-foreground/40 hover:text-muted-foreground/60"
            }`} 
          />
          <ArrowDownWideNarrow 
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
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Kontakte & Organisationen</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre wichtigsten Kontakte, Organisationen und Beziehungen
            </p>
          </div>
          <div className="flex gap-2">
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
            <Link to="/distribution-lists/new">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Neuer Verteiler
              </Button>
            </Link>
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
          <div className="flex gap-2">
            <div className="flex border border-border rounded-md">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("grid");
                  localStorage.setItem('contacts-view-mode', 'grid');
                }}
                className="rounded-r-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("list");
                  localStorage.setItem('contacts-view-mode', 'list');
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
          </div>
        </div>

        {/* Type Filter - Only show for contacts tab and when filters are open */}
        {activeTab === "contacts" && showFilters && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <Button
            variant={selectedType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("all")}
            className="whitespace-nowrap"
          >
            Alle ({contacts.length})
          </Button>
          <Button
            variant={selectedType === "person" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("person")}
            className="whitespace-nowrap"
          >
            Personen ({contacts.filter(c => c.contact_type === "person").length})
          </Button>
          <Button
            variant={selectedType === "organization" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedType("organization")}
            className="whitespace-nowrap"
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
              className="whitespace-nowrap"
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
              className={`bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer ${getPriorityColor(
                contact.priority
              )}`}
              onClick={() => {
                setSelectedContactId(contact.id);
                setIsSheetOpen(true);
              }}
            >
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
                <TableHead className="w-12">Favorit</TableHead>
                <TableHead className="w-12">Avatar</TableHead>
                <SortableTableHead sortKey="name">Name</SortableTableHead>
                <SortableTableHead sortKey="organization">Organisation/Rolle</SortableTableHead>
                <SortableTableHead sortKey="email">Kontakt</SortableTableHead>
                <SortableTableHead sortKey="address">Adresse</SortableTableHead>
                <SortableTableHead sortKey="last_contact">Letzter Kontakt</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    setIsSheetOpen(true);
                  }}
                >
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(contact.id, !contact.is_favorite);
                      }}
                      className="p-1 h-6 w-6"
                    >
                      <Star 
                        className={`h-3 w-3 transition-colors ${
                          contact.is_favorite 
                            ? 'text-yellow-500 fill-current' 
                            : 'text-muted-foreground hover:text-yellow-500'
                        }`} 
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>
                    {contact.contact_type === "organization" 
                      ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                      : contact.organization || contact.role || "—"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {(contact.address || contact.location) && (
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <div className="leading-tight">
                            {contact.address && (
                              <div>{contact.address}</div>
                            )}
                            {contact.location && (
                              <div className="text-muted-foreground">{contact.location}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {!contact.address && !contact.location && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.last_contact || "—"}
                  </TableCell>
                </TableRow>
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
              stakeholders={contacts.filter(c => c.contact_type === "organization")}
              contacts={contacts.filter(c => c.contact_type === "person")}
              onToggleFavorite={toggleFavorite}
              onContactClick={(contactId) => {
                setSelectedContactId(contactId);
                setIsSheetOpen(true);
              }}
            />
          )}
          
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
          {distributionListsLoading ? (
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
                        <Link to={`/distribution-lists/${list.id}/edit`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Edit className="h-4 w-4" />
                            Bearbeiten
                          </Button>
                        </Link>
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
                  {list.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4">{list.description}</p>
                      {list.members.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Mitglieder:</p>
                          <div className="flex flex-wrap gap-2">
                            {list.members.slice(0, 5).map((member) => (
                              <Badge key={member.id} variant="secondary" className="text-xs">
                                {member.name}
                              </Badge>
                            ))}
                            {list.members.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{list.members.length - 5} weitere
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
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
                    <Link to="/distribution-lists/new">
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Ersten Verteiler erstellen
                      </Button>
                    </Link>
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

      <ContactDetailSheet
        contactId={selectedContactId}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedContactId(null);
        }}
        onContactUpdate={refreshContacts}
      />
    </div>
  );
}