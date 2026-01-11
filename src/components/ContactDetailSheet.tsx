import { useState, useEffect } from "react";
import { Edit2, Trash2, Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink, PhoneCall, Plus, Tag, Linkedin, Facebook, Instagram, Hash, FileText, ChevronDown, Euro } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactEditForm } from "./ContactEditForm";
import { CallLogWidget } from "@/components/widgets/CallLogWidget";
import { formatGermanDate } from "@/lib/utils";
import { ActivityTimeline } from "./contacts/ActivityTimeline";
import { ContactDocumentList } from "./contacts/ContactDocumentList";
import { useContactDocuments } from "@/hooks/useContactDocuments";
import { FundingDialog } from "./contacts/FundingDialog";
import { ContactFundingsList } from "./contacts/ContactFundingsList";
import { useContactFundings } from "@/hooks/useContactFundings";

interface CallLog {
  id: string;
  contact_id?: string;
  caller_name?: string;
  caller_phone?: string;
  call_type: 'outgoing' | 'incoming' | 'missed';
  duration_minutes?: number;
  call_date: string;
  notes?: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  follow_up_completed: boolean;
  completion_notes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  created_by_name?: string;
}

interface Contact {
  id: string;
  contact_type: "person" | "organization";
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
  legal_form?: string;
  industry?: string;
  main_contact_person?: string;
  business_description?: string;
  tags?: string[];
  inherited_tags?: string[];
  business_street?: string;
  business_house_number?: string;
  business_postal_code?: string;
  business_city?: string;
  business_country?: string;
  coordinates?: { lat: number; lng: number };
  geocoded_at?: string;
}

interface ContactDetailSheetProps {
  contactId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdate: () => void;
}

export function ContactDetailSheet({ contactId, isOpen, onClose, onContactUpdate }: ContactDetailSheetProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCallLogs, setLoadingCallLogs] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCallLogWidget, setShowCallLogWidget] = useState(false);
  const [allTags, setAllTags] = useState<{ direct: string[], inherited: string[] }>({ direct: [], inherited: [] });
  const [showDirectDocs, setShowDirectDocs] = useState(true);
  const [showTaggedDocs, setShowTaggedDocs] = useState(true);
  const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
  const [fundingsExpanded, setFundingsExpanded] = useState(false);
  const { toast } = useToast();

  // Fetch documents related to this contact
  const { directDocuments, taggedDocuments, loading: documentsLoading, removeDocumentLink } = useContactDocuments(
    contactId || undefined,
    [...(allTags.direct || []), ...(allTags.inherited || [])]
  );

  // Fetch fundings related to this contact
  const { data: fundings = [], isLoading: fundingsLoading } = useContactFundings(contactId || undefined);

  // Helper functions for social media
  const cleanUsername = (input: string): string => {
    if (!input) return '';
    
    return input
      .replace(/^https?:\/\//, '') // Remove protocol
      .replace(/^(www\.)?/, '') // Remove www
      .replace(/^(linkedin\.com\/in\/|x\.com\/|facebook\.com\/|instagram\.com\/|xing\.com\/profile\/)/, '') // Remove platform prefixes
      .replace(/^@/, '') // Remove @ symbol
      .replace(/\/$/, '') // Remove trailing slash
      .trim();
  };

  const generateSocialMediaUrl = (platform: string, username: string): string => {
    const cleanedUsername = cleanUsername(username);
    
    switch (platform) {
      case 'linkedin':
        return `https://www.linkedin.com/in/${cleanedUsername}`;
      case 'twitter':
        return `https://x.com/${cleanedUsername}`;
      case 'facebook':
        return `https://www.facebook.com/${cleanedUsername}`;
      case 'instagram':
        return `https://www.instagram.com/${cleanedUsername}`;
      case 'xing':
        return `https://www.xing.com/profile/${cleanedUsername}`;
      default:
        return `https://${cleanedUsername}`;
    }
  };

  useEffect(() => {
    if (contactId && isOpen) {
      fetchContact();
      fetchCallLogs();
      fetchActivities();
    }
  }, [contactId, isOpen]);

  const fetchCallLogs = async () => {
    if (!contactId) return;
    
    try {
      setLoadingCallLogs(true);
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .or(`contact_id.eq.${contactId},caller_phone.ilike.%${contact?.phone || ''}%`)
        .order('call_date', { ascending: false });

      if (error) throw error;

      setCallLogs((data || []) as CallLog[]);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setLoadingCallLogs(false);
    }
  };

  const fetchActivities = async () => {
    if (!contactId) return;

    try {
      setActivitiesLoading(true);
      const { data, error } = await supabase
        .from("contact_activities")
        .select(`
          *,
          profiles:created_by (
            display_name,
            avatar_url
          )
        `)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchContact = async () => {
    if (!contactId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) throw error;

      setContact({
        ...data,
        contact_type: data.contact_type as "person" | "organization",
        category: data.category as Contact["category"],
        priority: data.priority as Contact["priority"],
        tags: data.tags || [],
        coordinates: data.coordinates as { lat: number; lng: number } | undefined,
      });
      
      // Tags direkt hier laden, nachdem contact gesetzt wurde
      let inheritedTags: string[] = [];
      if (data.contact_type === 'person' && data.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', data.organization_id)
          .single();
        
        if (!orgError && orgData?.tags) {
          inheritedTags = orgData.tags;
        }
      }
      
      const directTags = data.tags || [];
      setAllTags({ direct: directTags, inherited: inheritedTags });
      
    } catch (error) {
      console.error('Error fetching contact:', error);
      toast({
        title: "Fehler",
        description: "Kontakt konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async () => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: "Kontakt gelöscht",
        description: `${contact.name} wurde erfolgreich gelöscht.`,
      });

      onContactUpdate();
      onClose();
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

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    fetchContact();
    fetchCallLogs();
    onContactUpdate();
  };

  const getCallTypeIcon = (type: 'outgoing' | 'incoming' | 'missed') => {
    switch (type) {
      case 'outgoing': return <PhoneCall className="h-4 w-4 text-green-500" />;
      case 'incoming': return <PhoneCall className="h-4 w-4 text-blue-500" />;
      case 'missed': return <PhoneCall className="h-4 w-4 text-red-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isEditing && contact) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[600px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kontakt bearbeiten</SheetTitle>
            <SheetDescription>
              Bearbeiten Sie die Informationen für {contact.name}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ContactEditForm
              contact={contact}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[700px] sm:w-[640px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : contact ? (
          <div className="space-y-6">
            <SheetHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={contact.avatar_url} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <SheetTitle className="text-2xl">{contact.name}</SheetTitle>
                  </div>
                  <SheetDescription className="text-base">
                    {contact.contact_type === "organization" 
                      ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                      : contact.role
                    }
                  </SheetDescription>
                  {contact.contact_type === "organization" && (
                    <Badge className={`mt-2 ${getCategoryColor(contact.category)}`}>
                      {contact.category === "citizen" && "Bürger"}
                      {contact.category === "colleague" && "Kollege"}
                      {contact.category === "business" && "Wirtschaft"}
                      {contact.category === "media" && "Medien"}
                      {contact.category === "lobbyist" && "Lobbyist"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setIsEditing(true)} className="flex-1">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Löschen
                </Button>
              </div>
            </SheetHeader>

            <Separator />

            <Tabs defaultValue="details" className="w-full">
              <div className="border-b border-border mb-4">
                <TabsList className="flex w-full h-auto bg-transparent p-0 gap-0">
                  <TabsTrigger 
                    value="details" 
                    className="flex-1 py-3 px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all"
                  >
                    <User className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Kontakt</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="activities" 
                    className="flex-1 py-3 px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all"
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Aktivitäten</span>
                    <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">{activities.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="calls" 
                    className="flex-1 py-3 px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all"
                  >
                    <PhoneCall className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Anrufe</span>
                    <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">{callLogs.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="documents" 
                    className="flex-1 py-3 px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Doku</span>
                    <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">{directDocuments.length + taggedDocuments.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="fundings" 
                    className="flex-1 py-3 px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all"
                  >
                    <Euro className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Förder.</span>
                    <Badge variant="secondary" className="ml-1.5 text-xs h-5 px-1.5">{fundings.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="details" className="space-y-6">
                {/* Classification Card - Category & Priority */}
                <Card className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Tag className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">Klassifizierung</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Kategorie</p>
                        <Badge className={getCategoryColor(contact.category)}>
                          {contact.category === "citizen" && "Bürger"}
                          {contact.category === "colleague" && "Kollege"}
                          {contact.category === "business" && "Wirtschaft"}
                          {contact.category === "media" && "Medien"}
                          {contact.category === "lobbyist" && "Lobbyist"}
                          {!contact.category && "Keine Kategorie"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Priorität</p>
                        <Badge variant="outline" className={
                          contact.priority === 'high' ? 'border-destructive text-destructive' :
                          contact.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                          'border-muted-foreground text-muted-foreground'
                        }>
                          {contact.priority === 'high' && '🔴 Hoch'}
                          {contact.priority === 'medium' && '🟡 Mittel'}
                          {contact.priority === 'low' && '🟢 Niedrig'}
                          {!contact.priority && 'Keine Priorität'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact Information */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-lg">Kontaktinformationen</h3>
                    </div>
                
                {contact.email && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">{contact.email}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${contact.email}`}>
                        <Mail className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Telefon</p>
                      <p className="font-medium">{contact.phone}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${contact.phone}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                )}

                {contact.contact_type === "person" && contact.organization && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Organisation</p>
                      <p className="font-medium">{contact.organization}</p>
                    </div>
                  </div>
                )}

                {contact.birthday && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Geburtstag</p>
                      <p className="font-medium">{formatGermanDate(contact.birthday)}</p>
                    </div>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Website</p>
                      <p className="font-medium">{contact.website}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                 )}
               </CardContent>
                </Card>

                {/* Business Address - More Detailed */}
                {(contact.business_street || contact.business_city || contact.address || contact.location) && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Geschäftsadresse</h3>
                        {contact.coordinates && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            <MapPin className="h-3 w-3 mr-1" />
                            Geocodiert
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {contact.business_street && (
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Straße</p>
                              <p className="font-medium">{contact.business_street} {contact.business_house_number}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">PLZ / Ort</p>
                              <p className="font-medium">{contact.business_postal_code} {contact.business_city}</p>
                            </div>
                          </div>
                        )}
                        {contact.business_country && (
                          <div className="text-sm">
                            <p className="text-muted-foreground">Land</p>
                            <p className="font-medium">{contact.business_country}</p>
                          </div>
                        )}
                        {!contact.business_street && (contact.address || contact.location) && (
                          <p className="text-sm font-medium">{contact.address || contact.location}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Social Media */}
                {(contact.linkedin || contact.twitter || contact.facebook || contact.instagram || contact.xing) && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-4">Social Media</h3>
                      <div className="space-y-3">
                        {contact.linkedin && (
                          <div className="flex items-center gap-3">
                            <Linkedin className="h-5 w-5 text-blue-600" />
                            <div className="flex-1">
                              <p className="font-medium">LinkedIn</p>
                              <p className="text-muted-foreground text-sm">@{cleanUsername(contact.linkedin)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={generateSocialMediaUrl('linkedin', contact.linkedin)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                        {contact.twitter && (
                          <div className="flex items-center gap-3">
                            <Hash className="h-5 w-5 text-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">X</p>
                              <p className="text-muted-foreground text-sm">@{cleanUsername(contact.twitter)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={generateSocialMediaUrl('twitter', contact.twitter)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                        {contact.facebook && (
                          <div className="flex items-center gap-3">
                            <Facebook className="h-5 w-5 text-blue-600" />
                            <div className="flex-1">
                              <p className="font-medium">Facebook</p>
                              <p className="text-muted-foreground text-sm">{cleanUsername(contact.facebook)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={generateSocialMediaUrl('facebook', contact.facebook)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                        {contact.instagram && (
                          <div className="flex items-center gap-3">
                            <Instagram className="h-5 w-5 text-pink-500" />
                            <div className="flex-1">
                              <p className="font-medium">Instagram</p>
                              <p className="text-muted-foreground text-sm">@{cleanUsername(contact.instagram)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={generateSocialMediaUrl('instagram', contact.instagram)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                        {contact.xing && (
                          <div className="flex items-center gap-3">
                            <User className="h-5 w-5 text-green-600" />
                            <div className="flex-1">
                              <p className="font-medium">XING</p>
                              <p className="text-muted-foreground text-sm">{cleanUsername(contact.xing)}</p>
                            </div>
                            <Button size="sm" variant="outline" asChild>
                              <a href={generateSocialMediaUrl('xing', contact.xing)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Organization Details */}
                {contact.contact_type === "organization" && contact.business_description && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">Geschäftsbeschreibung</h3>
                      <p className="text-muted-foreground">{contact.business_description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Tags */}
                {(allTags.direct.length > 0 || allTags.inherited.length > 0) && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {allTags.inherited.map((tag) => (
                          <Badge 
                            key={`inherited-${tag}`} 
                            variant="outline" 
                            className="bg-muted/30 text-muted-foreground border-dashed flex items-center gap-1"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            <span className="text-xs">(geerbt)</span>
                          </Badge>
                        ))}
                        {allTags.direct.map((tag) => (
                          <Badge key={`direct-${tag}`} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {contact.notes && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">Notizen</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Additional Info */}
                {contact.additional_info && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">Zusätzliche Informationen</h3>
                      <p className="text-muted-foreground whitespace-pre-wrap">{contact.additional_info}</p>
                    </CardContent>
                  </Card>
                )}

                {contact.last_contact && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">Letzter Kontakt</h3>
                      <p className="text-muted-foreground">{contact.last_contact}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-4 mt-4">
                <ActivityTimeline activities={activities} loading={activitiesLoading} />
              </TabsContent>

              <TabsContent value="calls" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Anrufhistorie</CardTitle>
                      <Button 
                        size="sm" 
                        onClick={() => setShowCallLogWidget(!showCallLogWidget)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Anruf protokollieren
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {showCallLogWidget && (
                      <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                        <div className="text-sm font-medium mb-2">Neuen Anruf protokollieren</div>
                        <CallLogWidget 
                          className="border-0 shadow-none bg-transparent" 
                          configuration={{ compact: true, showFollowUps: false }}
                        />
                      </div>
                    )}

                    {loadingCallLogs ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                      </div>
                    ) : callLogs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Noch keine Anrufe protokolliert</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {callLogs.map((log) => (
                          <div key={log.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-start gap-3">
                              {getCallTypeIcon(log.call_type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">
                                    {log.call_type === 'outgoing' ? 'Ausgehender Anruf' : 
                                     log.call_type === 'incoming' ? 'Eingehender Anruf' : 'Verpasster Anruf'}
                                  </span>
                                  {log.duration_minutes && (
                                    <Badge variant="outline" className="text-xs">
                                      {log.duration_minutes} Min
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {log.priority}
                                  </Badge>
                                </div>
                                
                                <div className="text-xs text-muted-foreground mb-2">
                                  {formatDate(log.call_date)}
                                  {log.created_by_name && ` • Protokolliert von ${log.created_by_name}`}
                                </div>

                                {log.notes && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {log.notes}
                                  </p>
                                )}

                                 {log.follow_up_required && (
                                   <div className="flex items-center gap-2 text-xs">
                                     <Badge variant={log.follow_up_completed ? "default" : "destructive"} className="text-xs">
                                       {log.follow_up_completed ? "Follow-up erledigt" : "Follow-up erforderlich"}
                                     </Badge>
                                     {log.follow_up_date && (
                                       <span className="text-muted-foreground">
                                         bis {formatDate(log.follow_up_date)}
                                       </span>
                                     )}
                                   </div>
                                 )}

                                 {log.follow_up_completed && log.completion_notes && (
                                   <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                     <span className="font-medium text-muted-foreground">Erledigungsnotiz: </span>
                                     <span className="text-muted-foreground">{log.completion_notes}</span>
                                   </div>
                                 )}
                              </div>
                            </div>
                          </div>
                        ))}
                       </div>
                     )}
                   </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4 mt-4">
                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      {/* Directly linked documents */}
                      <Collapsible open={showDirectDocs} onOpenChange={setShowDirectDocs}>
                        <Card>
                          <CardHeader className="pb-3">
                            <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                              <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                <CardTitle className="text-base">Direkt verknüpfte Dokumente</CardTitle>
                                <Badge variant="secondary">{directDocuments.length}</Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 transition-transform ${showDirectDocs ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <ContactDocumentList
                                documents={directDocuments}
                                type="direct"
                                onRemove={removeDocumentLink}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      {/* Tag-based documents */}
                      <Collapsible open={showTaggedDocs} onOpenChange={setShowTaggedDocs}>
                        <Card>
                          <CardHeader className="pb-3">
                            <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                              <div className="flex items-center gap-2">
                                <Tag className="h-5 w-5 text-primary" />
                                <CardTitle className="text-base">Über Tags verknüpft</CardTitle>
                                <Badge variant="secondary">{taggedDocuments.length}</Badge>
                              </div>
                              <ChevronDown className={`h-4 w-4 transition-transform ${showTaggedDocs ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <ContactDocumentList
                                documents={taggedDocuments}
                                type="tagged"
                                contactTags={[...(allTags.direct || []), ...(allTags.inherited || [])]}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="fundings" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Euro className="h-5 w-5" />
                          Förderungen & Unterstützungen
                        </CardTitle>
                        <Button 
                          size="sm" 
                          onClick={() => setFundingDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Neue Förderung
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {fundingsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : fundings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Euro className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>Keine Förderungen vorhanden</p>
                        </div>
                      ) : (
                        <ContactFundingsList
                          contactId={contactId || ''}
                          isExpanded={fundingsExpanded}
                          onToggle={() => setFundingsExpanded(!fundingsExpanded)}
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
           </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Kontakt nicht gefunden</p>
          </div>
        )}
      </SheetContent>

      {contactId && (
        <FundingDialog
          open={fundingDialogOpen}
          onOpenChange={setFundingDialogOpen}
          initialContactId={contactId}
        />
      )}
    </Sheet>
  );
}