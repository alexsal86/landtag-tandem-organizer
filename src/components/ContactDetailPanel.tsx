import { useState, useEffect, type ComponentType } from "react";
import { Trash2, PhoneCall, Plus, FileText, ChevronDown, Euro, ArrowLeft, Star, Mail, Phone, Globe } from "lucide-react";
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
import { ActivityTimeline } from "./contacts/ActivityTimeline";
import { debugConsole } from "@/utils/debugConsole";
import { ContactDocumentList } from "./contacts/ContactDocumentList";
import { useContactDocuments } from "@/hooks/useContactDocuments";
import { FundingDialog } from "./contacts/FundingDialog";
import { ContactFundingsList } from "./contacts/ContactFundingsList";
import { useContactFundings } from "@/hooks/useContactFundings";
import { ContactInfoTab } from "./contacts/ContactInfoTab";
import { Facebook, Instagram, Linkedin, Twitter } from "@/components/icons/SocialIcons";
import { User, Calendar, Tag } from "lucide-react";

interface CallLog {
  id: string; contact_id?: string; caller_name?: string; caller_phone?: string;
  call_type: 'outgoing' | 'incoming' | 'missed'; duration_minutes?: number; call_date: string;
  notes?: string; follow_up_required: boolean; follow_up_date?: string; follow_up_completed: boolean;
  completion_notes?: string; priority: 'low' | 'medium' | 'high' | 'urgent'; created_at: string; created_by_name?: string;
}

interface Contact {
  id: string; contact_type: "person" | "organization"; name: string; role?: string; organization?: string;
  organization_id?: string; email?: string; phone?: string; location?: string; address?: string; birthday?: string;
  website?: string; linkedin?: string; twitter?: string; facebook?: string; instagram?: string; xing?: string;
  category?: "citizen" | "colleague" | "lobbyist" | "media" | "business";
  priority?: "low" | "medium" | "high"; last_contact?: string; avatar_url?: string; notes?: string;
  is_favorite?: boolean;
  additional_info?: string; legal_form?: string; industry?: string; main_contact_person?: string;
  business_description?: string; tags?: string[]; inherited_tags?: string[];
  business_street?: string; business_house_number?: string; business_postal_code?: string;
  business_city?: string; business_country?: string;
  coordinates?: { lat: number; lng: number }; geocoded_at?: string;
}

interface ContactDetailPanelProps {
  contactId: string | null;
  onClose: () => void;
  onContactUpdate: () => void;
}

interface ContactChannel {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
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

  const { directDocuments, taggedDocuments, loading: documentsLoading, removeDocumentLink } = useContactDocuments(contactId || undefined, [...(allTags.direct || []), ...(allTags.inherited || [])]);
  const { data: fundings = [], isLoading: fundingsLoading } = useContactFundings(contactId || undefined);

  useEffect(() => { if (contactId) { fetchContact(); fetchCallLogs(); fetchActivities(); setIsEditing(false); } }, [contactId]);

  const fetchCallLogs = async () => {
    if (!contactId) return;
    try { setLoadingCallLogs(true); const filter = contact?.phone ? `contact_id.eq.${contactId},caller_phone.ilike.%${contact.phone}%` : `contact_id.eq.${contactId}`; const { data, error } = await supabase.from('call_logs').select('*').or(filter).order('call_date', { ascending: false }); if (error) throw error; setCallLogs((data || []) as CallLog[]); } catch (error) { debugConsole.error('Error fetching call logs:', error); } finally { setLoadingCallLogs(false); }
  };

  const fetchActivities = async () => {
    if (!contactId) return;
    try { setActivitiesLoading(true); const { data, error } = await supabase.from("contact_activities").select(`*, profiles:created_by (display_name, avatar_url)`).eq("contact_id", contactId).order("created_at", { ascending: false }); if (error) throw error; setActivities(data || []); } catch (error) { debugConsole.error("Error fetching activities:", error); } finally { setActivitiesLoading(false); }
  };

  const fetchContact = async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('contacts').select('*').eq('id', contactId).single();
      if (error) throw error;
      setContact({ ...data, contact_type: data.contact_type as "person" | "organization", category: data.category as Contact["category"], priority: data.priority as Contact["priority"], tags: data.tags || [], coordinates: data.coordinates as { lat: number; lng: number } | undefined } as Contact);
      let inheritedTags: string[] = [];
      if (data.contact_type === 'person' && data.organization_id) {
        const { data: orgData, error: orgError } = await supabase.from('contacts').select('tags').eq('id', data.organization_id).single();
        if (!orgError && orgData?.tags) inheritedTags = orgData.tags;
      }
      setAllTags({ direct: data.tags || [], inherited: inheritedTags });
    } catch (error) { debugConsole.error('Error fetching contact:', error); toast({ title: "Fehler", description: "Kontakt konnte nicht geladen werden.", variant: "destructive" }); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!contact) return;
    try { const { error } = await supabase.from('contacts').delete().eq('id', contact.id); if (error) throw error; toast({ title: "Kontakt gelöscht", description: `${contact.name} wurde erfolgreich gelöscht.` }); onContactUpdate(); onClose(); } catch (error) { debugConsole.error('Error deleting contact:', error); toast({ title: "Fehler", description: "Kontakt konnte nicht gelöscht werden.", variant: "destructive" }); }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase();
  const handleEditSuccess = () => { setIsEditing(false); fetchContact(); fetchCallLogs(); onContactUpdate(); };
  const getCallTypeIcon = (type: 'outgoing' | 'incoming' | 'missed') => <PhoneCall className={`h-4 w-4 ${type === 'outgoing' ? 'text-green-500' : type === 'incoming' ? 'text-blue-500' : 'text-red-500'}`} />;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const detailLineParts =
    contact?.contact_type === "organization"
      ? [contact.legal_form, contact.industry || contact.main_contact_person]
      : [contact?.role, contact?.organization];
  const detailLine = detailLineParts
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" • ");


  const socialChannels = [
    contact?.email ? { key: "email", href: `mailto:${contact.email}`, label: "E-Mail", icon: Mail } : null,
    contact?.phone ? { key: "phone", href: `tel:${contact.phone}`, label: "Telefon", icon: Phone } : null,
    contact?.website ? { key: "website", href: contact.website.startsWith("http") ? contact.website : `https://${contact.website}`, label: "Website", icon: Globe } : null,
    contact?.linkedin ? { key: "linkedin", href: contact.linkedin.startsWith("http") ? contact.linkedin : `https://${contact.linkedin}`, label: "LinkedIn", icon: Linkedin } : null,
    contact?.twitter ? { key: "twitter", href: contact.twitter.startsWith("http") ? contact.twitter : `https://${contact.twitter}`, label: "Twitter/X", icon: Twitter } : null,
    contact?.facebook ? { key: "facebook", href: contact.facebook.startsWith("http") ? contact.facebook : `https://${contact.facebook}`, label: "Facebook", icon: Facebook } : null,
    contact?.instagram ? { key: "instagram", href: contact.instagram.startsWith("http") ? contact.instagram : `https://${contact.instagram}`, label: "Instagram", icon: Instagram } : null,
    contact?.xing ? { key: "xing", href: contact.xing.startsWith("http") ? contact.xing : `https://${contact.xing}`, label: "Xing", icon: Globe } : null,
  ].filter((channel): channel is ContactChannel => Boolean(channel));

  if (!contactId) return null;
  if (isEditing && contact) return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-4"><Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}><ArrowLeft className="h-4 w-4 mr-1" /> Zurück</Button><h2 className="text-lg font-semibold">Kontakt bearbeiten</h2></div>
      <ContactEditForm contact={contact} onSuccess={handleEditSuccess} onCancel={() => setIsEditing(false)} />
    </div>
  );
  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!contact) return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Kontakt nicht gefunden</p></div>;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 shrink-0" aria-label="Zurück">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Favorisieren">
                <Star className={`h-5 w-5 ${contact.is_favorite ? "text-yellow-500 fill-current" : "text-muted-foreground"}`} />
              </Button>
              <Button onClick={() => setIsEditing(true)} size="sm" className="rounded-full px-5">
                Bearbeiten
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete} className="h-10 w-10 text-muted-foreground hover:text-destructive" aria-label="Löschen">
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={contact.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold leading-tight">{contact.name}</h2>
              {detailLine && <p className="text-base text-muted-foreground mt-1 line-clamp-2">{detailLine}</p>}
            </div>
          </div>
        </div>
        <Separator />

        {socialChannels.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {socialChannels.map((channel) => {
              const Icon = channel.icon;
              return (
                <a
                  key={channel.key}
                  href={channel.href}
                  target={channel.key === "email" || channel.key === "phone" ? undefined : "_blank"}
                  rel={channel.key === "email" || channel.key === "phone" ? undefined : "noreferrer"}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  aria-label={channel.label}
                  title={channel.label}
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        )}

        <Tabs defaultValue="details" className="w-full">
          <div className="border-b border-border mb-4">
            <TabsList className="flex w-full h-auto bg-transparent p-0 gap-0">
              <TabsTrigger value="details" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs"><User className="h-3.5 w-3.5 mr-1" />Kontakt</TabsTrigger>
              <TabsTrigger value="activities" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs"><Calendar className="h-3.5 w-3.5 mr-1" /><Badge variant="secondary" className="text-[10px] h-4 px-1">{activities.length}</Badge></TabsTrigger>
              <TabsTrigger value="calls" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs"><PhoneCall className="h-3.5 w-3.5 mr-1" /><Badge variant="secondary" className="text-[10px] h-4 px-1">{callLogs.length}</Badge></TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs"><FileText className="h-3.5 w-3.5 mr-1" /><Badge variant="secondary" className="text-[10px] h-4 px-1">{directDocuments.length + taggedDocuments.length}</Badge></TabsTrigger>
              <TabsTrigger value="fundings" className="flex-1 py-2.5 px-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary transition-all text-xs"><Euro className="h-3.5 w-3.5 mr-1" /><Badge variant="secondary" className="text-[10px] h-4 px-1">{fundings.length}</Badge></TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details"><ContactInfoTab contact={contact} allTags={allTags} /></TabsContent>

          <TabsContent value="activities" className="space-y-4 mt-4"><ActivityTimeline activities={activities} loading={activitiesLoading} /></TabsContent>

          <TabsContent value="calls" className="space-y-4 mt-4">
            <Card>
              <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Anrufhistorie</CardTitle><Button size="sm" onClick={() => setShowCallLogWidget(!showCallLogWidget)}><Plus className="h-4 w-4 mr-1" />Anruf</Button></div></CardHeader>
              <CardContent>
                {showCallLogWidget && <div className="mb-4 p-3 border rounded-lg bg-muted/30"><div className="text-sm font-medium mb-2">Neuen Anruf protokollieren</div><CallLogWidget className="border-0 shadow-none bg-transparent" configuration={{ compact: true, showFollowUps: false }} /></div>}
                {loadingCallLogs ? <div className="text-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div></div>
                : callLogs.length === 0 ? <div className="text-center text-muted-foreground py-6"><PhoneCall className="h-8 w-8 mx-auto mb-2 opacity-50" /><p className="text-sm">Noch keine Anrufe</p></div>
                : <div className="space-y-2">
                    {callLogs.map((log) => (
                      <div key={log.id} className="p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-start gap-2">
                          {getCallTypeIcon(log.call_type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-xs">{log.call_type === 'outgoing' ? 'Ausgehend' : log.call_type === 'incoming' ? 'Eingehend' : 'Verpasst'}</span>
                              {log.duration_minutes && <Badge variant="outline" className="text-[10px]">{log.duration_minutes} Min</Badge>}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{formatDate(log.call_date)}</div>
                            {log.notes && <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>}
                            {log.follow_up_required && <Badge variant={log.follow_up_completed ? "default" : "destructive"} className="text-[10px] mt-1">{log.follow_up_completed ? "Follow-up erledigt" : "Follow-up nötig"}</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            {documentsLoading ? <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : (
              <>
                <Collapsible open={showDirectDocs} onOpenChange={setShowDirectDocs}>
                  <Card><CardHeader className="pb-3"><CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Direkt verknüpft</CardTitle><Badge variant="secondary" className="text-xs">{directDocuments.length}</Badge></div><ChevronDown className={`h-4 w-4 transition-transform ${showDirectDocs ? 'rotate-180' : ''}`} /></CollapsibleTrigger></CardHeader><CollapsibleContent><CardContent><ContactDocumentList documents={directDocuments} type="direct" onRemove={removeDocumentLink} /></CardContent></CollapsibleContent></Card>
                </Collapsible>
                <Collapsible open={showTaggedDocs} onOpenChange={setShowTaggedDocs}>
                  <Card><CardHeader className="pb-3"><CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"><div className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><CardTitle className="text-sm">Über Tags verknüpft</CardTitle><Badge variant="secondary" className="text-xs">{taggedDocuments.length}</Badge></div><ChevronDown className={`h-4 w-4 transition-transform ${showTaggedDocs ? 'rotate-180' : ''}`} /></CollapsibleTrigger></CardHeader><CollapsibleContent><CardContent><ContactDocumentList documents={taggedDocuments} type="tagged" contactTags={[...(allTags.direct || []), ...(allTags.inherited || [])]} /></CardContent></CollapsibleContent></Card>
                </Collapsible>
              </>
            )}
          </TabsContent>

          <TabsContent value="fundings" className="space-y-4 mt-4">
            <Card>
              <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><Euro className="h-4 w-4" />Förderungen</CardTitle><Button size="sm" onClick={() => setFundingDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Neu</Button></div></CardHeader>
              <CardContent>
                {fundingsLoading ? <div className="flex items-center justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                : fundings.length === 0 ? <div className="text-center py-6 text-muted-foreground"><Euro className="h-10 w-10 mx-auto mb-2 opacity-20" /><p className="text-sm">Keine Förderungen</p></div>
                : <ContactFundingsList contactId={contactId || ''} isExpanded={fundingsExpanded} onToggle={() => setFundingsExpanded(!fundingsExpanded)} />}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {contactId && <FundingDialog open={fundingDialogOpen} onOpenChange={setFundingDialogOpen} initialContactId={contactId} />}
    </div>
  );
}
