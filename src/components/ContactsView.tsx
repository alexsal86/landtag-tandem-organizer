import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Mail, Phone, MapPin, Building, User, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  role?: string;
  organization?: string;
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
}

export function ContactsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user!.id)
        .order('name');

      if (error) throw error;

      // If no contacts exist, insert sample data
      if (!data || data.length === 0) {
        await insertSampleContacts();
        return;
      }

      setContacts(data?.map(contact => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
        organization: contact.organization,
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

  const categories = [
    { value: "all", label: "Alle Kontakte", count: contacts.length },
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
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.organization && contact.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (contact.role && contact.role.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || contact.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Kontakte</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre wichtigsten Kontakte und Beziehungen
            </p>
          </div>
          <Link to="/contacts/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Kontakt
            </Button>
          </Link>
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
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>

        {/* Category Tabs */}
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
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map((contact) => (
          <Card
            key={contact.id}
            className={`bg-card shadow-card border-border hover:shadow-elegant transition-all duration-300 cursor-pointer ${getPriorityColor(
              contact.priority
            )}`}
            onClick={() => navigate(`/contacts/${contact.id}`)}
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
                  <div>
                    <CardTitle className="text-lg">{contact.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                  </div>
                </div>
                <Badge className={getCategoryColor(contact.category)}>
                  {contact.category === "citizen" && "Bürger"}
                  {contact.category === "colleague" && "Kollege"}
                  {contact.category === "business" && "Wirtschaft"}
                  {contact.category === "media" && "Medien"}
                  {contact.category === "lobbyist" && "Lobbyist"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building className="h-4 w-4" />
                  <span className="truncate">{contact.organization || "Keine Organisation"}</span>
                </div>
                
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

      {filteredContacts.length === 0 && (
        <Card className="bg-card shadow-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Kontakte gefunden</h3>
            <p className="text-muted-foreground text-center mb-4">
              Es wurden keine Kontakte gefunden, die Ihren Suchkriterien entsprechen.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ersten Kontakt hinzufügen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}