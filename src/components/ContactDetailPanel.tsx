import { useState, useEffect } from "react";
import { Edit2, Trash2, Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink, PhoneCall, Plus, Tag, Linkedin, Facebook, Instagram, Hash, FileText, ChevronDown, Euro, ArrowLeft } from "lucide-react";
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

interface ContactDetailPanelProps {
  contactId: string | null;
  onClose: () => void;
  onContactUpdate: () => void;
}

export function ContactDetailPanel({ contactId, onClose, onContactUpdate }: ContactDetailPanelProps) {
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

  const { directDocuments, taggedDocuments, loading: documentsLoading, removeDocumentLink } = useContactDocuments(
    contactId || undefined,
    [...(allTags.direct || []), ...(allTags.inherited || [])]
  );

  const { data: fundings = [], isLoading: fundingsLoading } = useContactFundings(contactId || undefined);

  const cleanUsername = (input: string): string => {
    if (!input) return '';
    return input
      .replace(/^https?:\/\//, '')
      .replace(/^(www\.)?/, '')
      .replace(/^(linkedin\.com\/in\/|x\.com\/|facebook\.com\/|instagram\.com\/|xing\.com\/profile\/)/, '')
      .replace(/^@/, '')
      .replace(/\/$/, '')
      .trim();
  };

  const generateSocialMediaUrl = (platform: string, username: string): string => {
    const cleanedUsername = cleanUsername(username);
    switch (platform) {
      case 'linkedin': return `https://www.linkedin.com/in/${cleanedUsername}`;
      case 'twitter': return `https://x.com/${cleanedUsername}`;
      case 'facebook': return `https://www.facebook.com/${cleanedUsername}`;
      case 'instagram': return `https://www.instagram.com/${cleanedUsername}`;
      case 'xing': return `https://www.xing.com/profile/${cleanedUsername}`;
      default: return `https://${cleanedUsername}`;
    }
  };

  useEffect(() => {
    if (contactId) {
      fetchContact();
      fetchCallLogs();
      fetchActivities();
      setIsEditing(false);
    }
  }, [contactId]);

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
        .select(`*, profiles:created_by (display_name, avatar_url)`)
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
      setAllTags({ direct: data.tags || [], inherited: inheritedTags });
    } catch (error) {
      console.error('Error fetching contact:', error);
      toast({ title: "Fehler", description: "Kontakt konnte nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
      if (error) throw error;
      toast({ title: "Kontakt gelöscht", description: `${contact.name} wurde erfolgreich gelöscht.` });
      onContactUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({ title: "Fehler", description: "Kontakt konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const getCategoryColor = (category: Contact["category"]) => {
    switch (category) {
      case "citizen": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "colleague": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "business": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "media": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "lobbyist": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();

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
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!contactId) return null;

  if (isEditing && contact) {
    return (
      <div className="p-6 overflow-y-auto h-full">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>
          <h2 className="text-lg font-semibold">Kontakt bearbeiten</h2>
        </div>
        <ContactEditForm contact={contact} onSuccess={handleEditSuccess} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Kontakt nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={contact.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{contact.name}</h2>
            <p className="text-sm text-muted-foreground truncate">
              {contact.contact_type === "organization"
                ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                : contact.role}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setIsEditing(true)} className="flex-1" size="sm">
            <Edit2 className="h-4 w-4 mr-2" />Bearbeiten
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />Löschen
          </Button>
        </div>

        <Separator />

        <Tabs defaultValue="details" className="w-full">
          <div className="border-b border-border mb-4">
            <TabsList className="flex w-full h-auto bg-transparent p-0 gap-0">
              <TabsTrigger value="details" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs">
                <User className="h-3.5 w-3.5 mr-1" />Kontakt
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{activities.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="calls" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs">
                <PhoneCall className="h-3.5 w-3.5 mr-1" />
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{callLogs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs">
                <FileText className="h-3.5 w-3.5 mr-1" />
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{directDocuments.length + taggedDocuments.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="fundings" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs">
                <Euro className="h-3.5 w-3.5 mr-1" />
                <Badge variant="secondary" className="text-[10px] h-4 px-1">{fundings.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="space-y-4">
            {/* Classification */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Klassifizierung</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Kategorie</p>
                    <Badge className={getCategoryColor(contact.category)}>
                      {contact.category === "citizen" && "Bürger"}
                      {contact.category === "colleague" && "Kollege"}
                      {contact.category === "business" && "Wirtschaft"}
                      {contact.category === "media" && "Medien"}
                      {contact.category === "lobbyist" && "Lobbyist"}
                      {!contact.category && "Keine"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Priorität</p>
                    <Badge variant="outline" className={
                      contact.priority === 'high' ? 'border-destructive text-destructive' :
                      contact.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                      'border-muted-foreground text-muted-foreground'
                    }>
                      {contact.priority === 'high' && '🔴 Hoch'}
                      {contact.priority === 'medium' && '🟡 Mittel'}
                      {contact.priority === 'low' && '🟢 Niedrig'}
                      {!contact.priority && 'Keine'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Kontaktinformationen</h3>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">E-Mail</p>
                      <p className="text-sm font-medium truncate">{contact.email}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Telefon</p>
                      <p className="text-sm font-medium">{contact.phone}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`tel:${contact.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                    </Button>
                  </div>
                )}
                {contact.contact_type === "person" && contact.organization && (
                  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Organisation</p>
                      <p className="text-sm font-medium">{contact.organization}</p>
                    </div>
                  </div>
                )}
                {contact.birthday && (
                  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Geburtstag</p>
                      <p className="text-sm font-medium">{formatGermanDate(contact.birthday)}</p>
                    </div>
                  </div>
                )}
                {contact.website && (
                  <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Website</p>
                      <p className="text-sm font-medium truncate">{contact.website}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Address */}
            {(contact.business_street || contact.business_city || contact.address || contact.location) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Geschäftsadresse</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    {contact.business_street && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-muted-foreground text-xs">Straße</p>
                          <p className="font-medium">{contact.business_street} {contact.business_house_number}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">PLZ / Ort</p>
                          <p className="font-medium">{contact.business_postal_code} {contact.business_city}</p>
                        </div>
                      </div>
                    )}
                    {contact.business_country && (
                      <div><p className="text-muted-foreground text-xs">Land</p><p className="font-medium">{contact.business_country}</p></div>
                    )}
                    {!contact.business_street && (contact.address || contact.location) && (
                      <p className="font-medium">{contact.address || contact.location}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Media */}
            {(contact.linkedin || contact.twitter || contact.facebook || contact.instagram || contact.xing) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Social Media</h3>
                  <div className="space-y-2">
                    {contact.linkedin && (
                      <div className="flex items-center gap-3">
                        <Linkedin className="h-4 w-4 text-blue-600" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium">LinkedIn</p><p className="text-xs text-muted-foreground truncate">@{cleanUsername(contact.linkedin)}</p></div>
                        <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl('linkedin', contact.linkedin)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </div>
                    )}
                    {contact.twitter && (
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-foreground" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium">X</p><p className="text-xs text-muted-foreground truncate">@{cleanUsername(contact.twitter)}</p></div>
                        <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl('twitter', contact.twitter)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </div>
                    )}
                    {contact.facebook && (
                      <div className="flex items-center gap-3">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium">Facebook</p><p className="text-xs text-muted-foreground truncate">{cleanUsername(contact.facebook)}</p></div>
                        <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl('facebook', contact.facebook)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </div>
                    )}
                    {contact.instagram && (
                      <div className="flex items-center gap-3">
                        <Instagram className="h-4 w-4 text-pink-500" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium">Instagram</p><p className="text-xs text-muted-foreground truncate">@{cleanUsername(contact.instagram)}</p></div>
                        <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl('instagram', contact.instagram)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </div>
                    )}
                    {contact.xing && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-green-600" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium">XING</p><p className="text-xs text-muted-foreground truncate">{cleanUsername(contact.xing)}</p></div>
                        <Button size="sm" variant="outline" asChild><a href={generateSocialMediaUrl('xing', contact.xing)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {contact.contact_type === "organization" && contact.business_description && (
              <Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Geschäftsbeschreibung</h3><p className="text-sm text-muted-foreground">{contact.business_description}</p></CardContent></Card>
            )}

            {(allTags.direct.length > 0 || allTags.inherited.length > 0) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.inherited.map((tag) => (
                      <Badge key={`inherited-${tag}`} variant="outline" className="bg-muted/30 text-muted-foreground border-dashed flex items-center gap-1 text-xs">
                        <Tag className="h-3 w-3" />{tag}<span className="text-[10px]">(geerbt)</span>
                      </Badge>
                    ))}
                    {allTags.direct.map((tag) => (<Badge key={`direct-${tag}`} variant="secondary" className="text-xs">{tag}</Badge>))}
                  </div>
                </CardContent>
              </Card>
            )}

            {contact.notes && (
              <Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Notizen</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</p></CardContent></Card>
            )}

            {contact.additional_info && (
              <Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Zusätzliche Informationen</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.additional_info}</p></CardContent></Card>
            )}

            {contact.last_contact && (
              <Card><CardContent className="p-4"><h3 className="font-semibold mb-2">Letzter Kontakt</h3><p className="text-sm text-muted-foreground">{contact.last_contact}</p></CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="activities" className="space-y-4 mt-4">
            <ActivityTimeline activities={activities} loading={activitiesLoading} />
          </TabsContent>

          <TabsContent value="calls" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Anrufhistorie</CardTitle>
                  <Button size="sm" onClick={() => setShowCallLogWidget(!showCallLogWidget)}>
                    <Plus className="h-4 w-4 mr-1" />Anruf
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {showCallLogWidget && (
                  <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                    <div className="text-sm font-medium mb-2">Neuen Anruf protokollieren</div>
                    <CallLogWidget className="border-0 shadow-none bg-transparent" configuration={{ compact: true, showFollowUps: false }} />
                  </div>
                )}
                {loadingCallLogs ? (
                  <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div></div>
                ) : callLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6"><PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Noch keine Anrufe</p></div>
                ) : (
                  <div className="space-y-2">
                    {callLogs.map((log) => (
                      <div key={log.id} className="p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-2">
                          {getCallTypeIcon(log.call_type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-xs">
                                {log.call_type === 'outgoing' ? 'Ausgehend' : log.call_type === 'incoming' ? 'Eingehend' : 'Verpasst'}
                              </span>
                              {log.duration_minutes && <Badge variant="outline" className="text-[10px]">{log.duration_minutes} Min</Badge>}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{formatDate(log.call_date)}</div>
                            {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                            {log.follow_up_required && (
                              <Badge variant={log.follow_up_completed ? "default" : "destructive"} className="text-[10px] mt-1">
                                {log.follow_up_completed ? "Follow-up erledigt" : "Follow-up nötig"}
                              </Badge>
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
              <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
              <>
                <Collapsible open={showDirectDocs} onOpenChange={setShowDirectDocs}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">Direkt verknüpft</CardTitle>
                          <Badge variant="secondary" className="text-xs">{directDocuments.length}</Badge>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showDirectDocs ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent><ContactDocumentList documents={directDocuments} type="direct" onRemove={removeDocumentLink} /></CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                <Collapsible open={showTaggedDocs} onOpenChange={setShowTaggedDocs}>
                  <Card>
                    <CardHeader className="pb-3">
                      <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm">Über Tags verknüpft</CardTitle>
                          <Badge variant="secondary" className="text-xs">{taggedDocuments.length}</Badge>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showTaggedDocs ? 'rotate-180' : ''}`} />
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent><ContactDocumentList documents={taggedDocuments} type="tagged" contactTags={[...(allTags.direct || []), ...(allTags.inherited || [])]} /></CardContent>
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
                  <CardTitle className="text-base flex items-center gap-2"><Euro className="h-4 w-4" />Förderungen</CardTitle>
                  <Button size="sm" onClick={() => setFundingDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Neu</Button>
                </div>
              </CardHeader>
              <CardContent>
                {fundingsLoading ? (
                  <div className="flex items-center justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                ) : fundings.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground"><Euro className="h-10 w-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Keine Förderungen</p></div>
                ) : (
                  <ContactFundingsList contactId={contactId || ''} isExpanded={fundingsExpanded} onToggle={() => setFundingsExpanded(!fundingsExpanded)} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {contactId && (
        <FundingDialog open={fundingDialogOpen} onOpenChange={setFundingDialogOpen} initialContactId={contactId} />
      )}
    </div>
  );
}
