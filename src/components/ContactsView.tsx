import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Mail, Phone, MapPin, Building, User, Filter, Grid3X3, List, Users, Edit, Trash2, Archive, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { ContactDetailSheet } from "./ContactDetailSheet";

interface Contact {
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
  // Organization-specific fields
  legal_form?: string;
  industry?: string;
  main_contact_person?: string;
  business_description?: string;
}

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributionListsLoading, setDistributionListsLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return localStorage.getItem('contacts-view-mode') as "grid" | "list" || "grid";
  });
  const [activeTab, setActiveTab] = useState<"contacts" | "distribution-lists" | "archive">("contacts");
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  useEffect(() => {
    if (user && currentTenant) {
      fetchContacts();
      fetchDistributionLists();
    }
  }, [user, currentTenant]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', currentTenant?.id || '')
        .order('name');

      if (error) throw error;

      // If no contacts exist, insert sample data
      if (!data || data.length === 0) {
        await insertSampleContacts();
        return;
      }

      setContacts(data?.map(contact => ({
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
      })) || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: "Fehler",
        description: "Kontakte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
      fetchContacts();
    } catch (error) {
      console.error('Error inserting sample contacts:', error);
      toast({
        title: "Fehler",
        description: "Beispielkontakte konnten nicht erstellt werden.",
        variant: "destructive",
      });
    }
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

  const categories = [
    { value: "all", label: "Alle Kontakte", count: contacts.filter(c => c.contact_type !== 'archive').length },
    { value: "citizen", label: "Bürger", count: contacts.filter(c => c.category === "citizen").length },
    { value: "colleague", label: "Kollegen", count: contacts.filter(c => c.category === "colleague").length },
    { value: "business", label: "Wirtschaft", count: contacts.filter(c => c.category === "business").length },
    { value: "media", label: "Medien", count: contacts.filter(c => c.category === "media").length },
    { value: "lobbyist", label: "Lobbyisten", count: contacts.filter(c => c.category === "lobbyist").length },
  ];

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

  const filteredContacts = contacts.filter(contact => {
    // Filter out archive contacts from regular view
    if (activeTab === "contacts" && contact.contact_type === 'archive') return false;
    if (activeTab === "archive" && contact.contact_type !== 'archive') return false;
    
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.organization && contact.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.role && contact.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.industry && contact.industry.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.main_contact_person && contact.main_contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.legal_form && contact.legal_form.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || contact.category === selectedCategory;
    const matchesType = selectedType === "all" || contact.contact_type === selectedType;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  if (loading) {
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
            Kontakte ({contacts.filter(c => c.contact_type !== 'archive').length})
          </Button>
          <Button
            variant={activeTab === "distribution-lists" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("distribution-lists")}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Verteiler ({distributionLists.length})
          </Button>
          <Button
            variant={activeTab === "archive" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("archive")}
            className="gap-2"
          >
            <Archive className="h-4 w-4" />
            Archiv ({contacts.filter(c => c.contact_type === 'archive').length})
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
        viewMode === "grid" ? (
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
                <TableHead className="w-12">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Organisation/Rolle</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Letzter Kontakt</TableHead>
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
        )
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

      {/* No contacts message */}
      {activeTab === "contacts" && filteredContacts.length === 0 && (
        <Card className="bg-card shadow-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {selectedType === "organization" ? "Keine Organisationen gefunden" :
               selectedType === "person" ? "Keine Personen gefunden" : "Keine Kontakte gefunden"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Es wurden keine {selectedType === "organization" ? "Organisationen" : 
                             selectedType === "person" ? "Personen" : "Kontakte"} gefunden, 
              die Ihren Suchkriterien entsprechen.
            </p>
            <Link to="/contacts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {selectedType === "organization" ? "Neue Organisation hinzufügen" :
                 selectedType === "person" ? "Neue Person hinzufügen" : "Neuen Kontakt hinzufügen"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <ContactDetailSheet
        contactId={selectedContactId}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedContactId(null);
        }}
        onContactUpdate={fetchContacts}
      />
    </div>
  );
}