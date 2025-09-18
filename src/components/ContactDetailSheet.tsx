import { useState, useEffect } from "react";
import { Edit2, Trash2, Mail, Phone, MapPin, Building, User, Calendar, Globe, ExternalLink, PhoneCall, Plus, Tag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactEditForm } from "./ContactEditForm";
import { CallLogWidget } from "@/components/widgets/CallLogWidget";

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
  const [loading, setLoading] = useState(false);
  const [loadingCallLogs, setLoadingCallLogs] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCallLogWidget, setShowCallLogWidget] = useState(false);
  const [allTags, setAllTags] = useState<{ direct: string[], inherited: string[] }>({ direct: [], inherited: [] });
  const { toast } = useToast();

  useEffect(() => {
    if (contactId && isOpen) {
      fetchContact();
      fetchCallLogs();
      fetchContactTags();
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
      });
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

  const fetchContactTags = async () => {
    if (!contactId || !contact) return;
    
    try {
      let inheritedTags: string[] = [];
      
      // If this is a person with an organization, fetch inherited tags
      if (contact.contact_type === 'person' && contact.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contact.organization_id)
          .single();
        
        if (!orgError && orgData?.tags) {
          inheritedTags = orgData.tags;
        }
      }
      
      const directTags = contact.tags || [];
      setAllTags({ direct: directTags, inherited: inheritedTags });
    } catch (error) {
      console.error('Error fetching contact tags:', error);
      setAllTags({ direct: [], inherited: [] });
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
    fetchContactTags();
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
                    <Badge variant="outline">
                      {contact.contact_type === "organization" ? "Organisation" : "Person"}
                    </Badge>
                  </div>
                  <SheetDescription className="text-base">
                    {contact.contact_type === "organization" 
                      ? `${contact.legal_form ? contact.legal_form + " • " : ""}${contact.industry || contact.main_contact_person || ""}`
                      : contact.role
                    }
                  </SheetDescription>
                  <Badge className={`mt-2 ${getCategoryColor(contact.category)}`}>
                    {contact.category === "citizen" && "Bürger"}
                    {contact.category === "colleague" && "Kollege"}
                    {contact.category === "business" && "Wirtschaft"}
                    {contact.category === "media" && "Medien"}
                    {contact.category === "lobbyist" && "Lobbyist"}
                  </Badge>
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Kontaktdaten</TabsTrigger>
                <TabsTrigger value="calls">Anrufliste ({callLogs.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Contact Information */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <h3 className="font-semibold text-lg">Kontaktinformationen</h3>
                
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">E-Mail</p>
                      <p className="text-muted-foreground">{contact.email}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Telefon</p>
                      <p className="text-muted-foreground">{contact.phone}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Phone className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {contact.contact_type === "person" && contact.organization && (
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Organisation</p>
                      <p className="text-muted-foreground">{contact.organization}</p>
                    </div>
                  </div>
                )}

                {(contact.location || contact.address) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Adresse</p>
                      <p className="text-muted-foreground">
                        {contact.address || contact.location}
                      </p>
                    </div>
                  </div>
                )}

                {contact.birthday && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Geburtstag</p>
                      <p className="text-muted-foreground">{contact.birthday}</p>
                    </div>
                  </div>
                )}

                {contact.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Website</p>
                      <p className="text-muted-foreground">{contact.website}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={contact.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                 )}
               </CardContent>
                </Card>

                {/* Social Media */}
                {(contact.linkedin || contact.twitter || contact.facebook || contact.instagram || contact.xing) && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-4">Social Media</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {contact.linkedin && (
                          <div>
                            <p className="font-medium">LinkedIn</p>
                            <p className="text-muted-foreground text-sm">{contact.linkedin}</p>
                          </div>
                        )}
                        {contact.twitter && (
                          <div>
                            <p className="font-medium">Twitter</p>
                            <p className="text-muted-foreground text-sm">{contact.twitter}</p>
                          </div>
                        )}
                        {contact.facebook && (
                          <div>
                            <p className="font-medium">Facebook</p>
                            <p className="text-muted-foreground text-sm">{contact.facebook}</p>
                          </div>
                        )}
                        {contact.instagram && (
                          <div>
                            <p className="font-medium">Instagram</p>
                            <p className="text-muted-foreground text-sm">{contact.instagram}</p>
                          </div>
                        )}
                        {contact.xing && (
                          <div>
                            <p className="font-medium">XING</p>
                            <p className="text-muted-foreground text-sm">{contact.xing}</p>
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
             </Tabs>
           </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">Kontakt nicht gefunden</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}