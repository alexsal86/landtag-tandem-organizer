import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Send, 
  Users, 
  UserCircle, 
  X, 
  Search,
  FileText,
  Eye,
  Mail,
  ChevronDown,
  Save,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Contact {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  avatar_url?: string;
  phone?: string;
}

interface DistributionList {
  id: string;
  name: string;
  topic?: string;
  memberCount?: number;
}

interface Document {
  id: string;
  title: string;
  file_name: string;
}

interface SenderInfo {
  id: string;
  name: string;
  landtag_email: string;
  is_default?: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
}

// Represents a recipient entry with its type (to/cc/bcc)
interface RecipientEntry {
  id: string; // unique key
  type: 'to' | 'cc' | 'bcc';
  label: string;
  email?: string;
  source: 'manual' | 'contact' | 'distribution_list';
  sourceId?: string; // contact_id or distribution_list_id
}

export function EmailComposer() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined);

  // Sender
  const [senderInfos, setSenderInfos] = useState<SenderInfo[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);

  // Press release tracking
  const [pressReleaseId, setPressReleaseId] = useState<string | null>(null);

  // Data sources
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Unified recipients with An/CC/BCC
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Which field are we adding to?
  const [activeRecipientField, setActiveRecipientField] = useState<'to' | 'cc' | 'bcc'>('to');
  const [manualEmailInput, setManualEmailInput] = useState("");

  useEffect(() => {
    if (currentTenant) {
      fetchDistributionLists();
      fetchContacts();
      fetchDocuments();
      fetchSenderInfos();
      fetchEmailTemplates();
    }
  }, [currentTenant]);

  // Handle press release compose action from URL params
  useEffect(() => {
    const action = searchParams.get('action');
    const prId = searchParams.get('pressReleaseId');
    if (action === 'compose-press' && prId && currentTenant) {
      setPressReleaseId(prId);
      loadPressReleaseForEmail(prId);
      searchParams.delete('action');
      searchParams.delete('pressReleaseId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, currentTenant]);

  const loadPressReleaseForEmail = async (prId: string) => {
    try {
      const { data: pr, error: prError } = await supabase
        .from('press_releases')
        .select('id, title, excerpt, content_html, ghost_post_url, published_at')
        .eq('id', prId)
        .single();

      if (prError) throw prError;

      // Load press email template and default distribution list from app_settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('tenant_id', currentTenant!.id)
        .in('setting_key', ['press_email_template_subject', 'press_email_template_body', 'press_default_distribution_list_id']);

      let templateSubject = 'Pressemitteilung: {{titel}}';
      let templateBody = 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere aktuelle Pressemitteilung:\n\n{{titel}}\n\n{{excerpt}}\n\nDen vollständigen Beitrag finden Sie unter:\n{{link}}';
      let defaultDistListId: string | null = null;

      (settings || []).forEach(s => {
        if (s.setting_key === 'press_email_template_subject' && s.setting_value) {
          templateSubject = s.setting_value;
        }
        if (s.setting_key === 'press_email_template_body' && s.setting_value) {
          templateBody = s.setting_value;
        }
        if (s.setting_key === 'press_default_distribution_list_id' && s.setting_value) {
          defaultDistListId = s.setting_value;
        }
      });

      const publishedDate = pr.published_at
        ? format(new Date(pr.published_at), "dd.MM.yyyy", { locale: de })
        : format(new Date(), "dd.MM.yyyy", { locale: de });

      const replacePressVars = (text: string) => {
        return text
          .replace(/\{\{titel\}\}/g, pr.title || '')
          .replace(/\{\{excerpt\}\}/g, pr.excerpt || '')
          .replace(/\{\{link\}\}/g, pr.ghost_post_url || '')
          .replace(/\{\{datum\}\}/g, publishedDate)
          .replace(/\{\{inhalt\}\}/g, pr.content_html || '');
      };

      setSubject(replacePressVars(templateSubject));
      const bodyWithVars = replacePressVars(templateBody);
      const bodyAsHtml = bodyWithVars.replace(/\n/g, '<br>');
      setBodyHtml(bodyAsHtml);

      // Auto-add default distribution list as BCC
      if (defaultDistListId) {
        const list = distributionLists.find(l => l.id === defaultDistListId);
        if (list) {
          addDistributionListRecipient(list, 'bcc');
        }
      }

      // Auto-set sender email as "An" recipient
      const defaultSenderInfo = senderInfos.find(s => s.id === selectedSender);
      if (defaultSenderInfo?.landtag_email) {
        // Add sender as To recipient for press emails
        setRecipients(prev => {
          // Don't add duplicate
          if (prev.some(r => r.email === defaultSenderInfo.landtag_email && r.type === 'to')) return prev;
          return [...prev, {
            id: `manual-${Date.now()}`,
            type: 'to',
            label: defaultSenderInfo.landtag_email,
            email: defaultSenderInfo.landtag_email,
            source: 'manual',
          }];
        });
      }

      toast({
        title: "Presse-E-Mail vorbereitet",
        description: `Daten aus "${pr.title}" wurden geladen.`,
      });
    } catch (error: any) {
      console.error('Error loading press release for email:', error);
      toast({
        title: "Fehler",
        description: "Pressemitteilung konnte nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const fetchSenderInfos = async () => {
    try {
      const { data, error } = await supabase
        .from("sender_information")
        .select("id, name, landtag_email, is_default")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true);
      
      if (error) throw error;
      setSenderInfos(data || []);
      
      const defaultSender = data?.find((s: any) => s.is_default);
      if (defaultSender) setSelectedSender(defaultSender.id);
      else if (data && data.length > 0) setSelectedSender(data[0].id);
    } catch (error) {
      console.error("Error fetching sender infos:", error);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject, body_html")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error("Error fetching email templates:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
      setSelectedTemplate(templateId);
      toast({ title: "Template geladen", description: `"${template.name}" wurde geladen` });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({
        title: "Fehler",
        description: "Betreff und Nachricht müssen ausgefüllt sein",
        variant: "destructive",
      });
      return;
    }

    const templateName = prompt("Template-Name eingeben:");
    if (!templateName) return;

    try {
      const { error } = await supabase.from("email_templates").insert({
        tenant_id: currentTenant!.id,
        created_by: user!.id,
        name: templateName,
        subject,
        body_html: bodyHtml,
        is_active: true,
      });

      if (error) throw error;

      toast({ title: "Template gespeichert", description: `"${templateName}" wurde erstellt` });
      fetchEmailTemplates();
    } catch (error: any) {
      toast({
        title: "Fehler beim Speichern",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const insertVariable = (variable: string) => {
    setBodyHtml(bodyHtml + `{{${variable}}}`);
  };

  const replaceVariables = (text: string, contact: Contact | null) => {
    if (!contact) return text;
    return text
      .replace(/\{\{name\}\}/g, contact.name)
      .replace(/\{\{email\}\}/g, contact.email || "")
      .replace(/\{\{organization\}\}/g, contact.organization || "")
      .replace(/\{\{phone\}\}/g, contact.phone || "");
  };

  const fetchDistributionLists = async () => {
    try {
      const { data: lists, error } = await supabase
        .from("distribution_lists")
        .select("id, name, topic")
        .eq("user_id", user!.id)
        .order("name");

      if (error) throw error;

      const listsWithCounts = await Promise.all(
        (lists || []).map(async (list) => {
          const { count } = await supabase
            .from("distribution_list_members")
            .select("*", { count: "exact", head: true })
            .eq("distribution_list_id", list.id);
          return { ...list, memberCount: count || 0 };
        })
      );

      setDistributionLists(listsWithCounts);
    } catch (error: any) {
      console.error("Error fetching distribution lists:", error);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, organization, avatar_url, phone")
        .eq("tenant_id", currentTenant!.id)
        .not("email", "is", null)
        .order("name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_name")
        .eq("tenant_id", currentTenant!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
    }
  };

  // --- Recipient management ---
  const addManualRecipient = () => {
    const email = manualEmailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Ungültige E-Mail", description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.", variant: "destructive" });
      return;
    }
    // Check duplicate
    if (recipients.some(r => r.email === email && r.type === activeRecipientField)) {
      toast({ title: "Bereits vorhanden", description: "Diese E-Mail ist bereits hinzugefügt.", variant: "destructive" });
      return;
    }
    setRecipients(prev => [...prev, {
      id: `manual-${Date.now()}-${Math.random()}`,
      type: activeRecipientField,
      label: email,
      email,
      source: 'manual',
    }]);
    setManualEmailInput("");
  };

  const addContactRecipient = (contact: Contact) => {
    if (!contact.email) return;
    if (recipients.some(r => r.sourceId === contact.id && r.source === 'contact' && r.type === activeRecipientField)) return;
    setRecipients(prev => [...prev, {
      id: `contact-${contact.id}-${activeRecipientField}`,
      type: activeRecipientField,
      label: contact.name,
      email: contact.email,
      source: 'contact',
      sourceId: contact.id,
    }]);
  };

  const addDistributionListRecipient = (list: DistributionList, type?: 'to' | 'cc' | 'bcc') => {
    const recipientType = type || activeRecipientField;
    if (recipients.some(r => r.sourceId === list.id && r.source === 'distribution_list' && r.type === recipientType)) return;
    setRecipients(prev => [...prev, {
      id: `list-${list.id}-${recipientType}`,
      type: recipientType,
      label: `${list.name} (${list.memberCount} Mitglieder)`,
      source: 'distribution_list',
      sourceId: list.id,
    }]);
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const getRecipientsByType = (type: 'to' | 'cc' | 'bcc') => recipients.filter(r => r.type === type);

  const getTotalRecipients = () => recipients.length;

  // Check if only BCC recipients exist (no To)
  const onlyBccRecipients = recipients.length > 0 && getRecipientsByType('to').length === 0 && getRecipientsByType('bcc').length > 0;

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie einen Betreff ein.", variant: "destructive" });
      return;
    }
    if (!bodyHtml.trim()) {
      toast({ title: "Fehler", description: "Bitte geben Sie eine Nachricht ein.", variant: "destructive" });
      return;
    }
    if (getTotalRecipients() === 0) {
      toast({ title: "Fehler", description: "Bitte wählen Sie mindestens einen Empfänger aus.", variant: "destructive" });
      return;
    }
    if (isScheduled && !scheduledFor) {
      toast({ title: "Fehler", description: "Bitte wählen Sie einen Zeitpunkt für den geplanten Versand.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Split recipients by type
      const toRecipients = getRecipientsByType('to');
      const ccRecipients = getRecipientsByType('cc');
      const bccRecipients = getRecipientsByType('bcc');

      // Collect emails and IDs
      const manualToEmails = toRecipients.filter(r => r.source === 'manual').map(r => r.email!);
      const manualCcEmails = ccRecipients.filter(r => r.source === 'manual').map(r => r.email!);
      const manualBccEmails = bccRecipients.filter(r => r.source === 'manual').map(r => r.email!);
      
      const contactToIds = toRecipients.filter(r => r.source === 'contact').map(r => r.sourceId!);
      const contactCcIds = ccRecipients.filter(r => r.source === 'contact').map(r => r.sourceId!);
      const contactBccIds = bccRecipients.filter(r => r.source === 'contact').map(r => r.sourceId!);
      
      const distListIds = [...new Set(recipients.filter(r => r.source === 'distribution_list').map(r => r.sourceId!))];

      // If only BCC, use sender as To
      const senderInfo = senderInfos.find(s => s.id === selectedSender);
      let finalToEmails = manualToEmails;
      if (onlyBccRecipients && senderInfo) {
        finalToEmails = [senderInfo.landtag_email];
      }

      // Merge contact_ids + contact emails from cc/bcc
      // The edge function handles contact_ids as "to" recipients, so we need to resolve cc/bcc contacts to emails
      const ccContactEmails: string[] = [];
      const bccContactEmails: string[] = [];
      
      for (const cId of contactCcIds) {
        const c = contacts.find(ct => ct.id === cId);
        if (c?.email) ccContactEmails.push(c.email);
      }
      for (const cId of contactBccIds) {
        const c = contacts.find(ct => ct.id === cId);
        if (c?.email) bccContactEmails.push(c.email);
      }

      const emailData = {
        subject,
        body_html: bodyHtml,
        reply_to: replyTo || undefined,
        recipients: finalToEmails,
        recipient_emails: [],
        cc: [...manualCcEmails, ...ccContactEmails],
        bcc: [...manualBccEmails, ...bccContactEmails],
        distribution_list_ids: distListIds,
        contact_ids: contactToIds, // only To contacts go as contact_ids
        document_ids: selectedDocuments,
        tenant_id: currentTenant!.id,
        user_id: user!.id,
        sender_id: selectedSender,
      };

      if (isScheduled && scheduledFor) {
        const { error } = await supabase.from("scheduled_emails").insert({
          ...emailData,
          scheduled_for: scheduledFor.toISOString(),
          status: "scheduled",
        });

        if (error) throw error;

        toast({
          title: "E-Mail geplant",
          description: `E-Mail wird am ${format(scheduledFor, "dd.MM.yyyy 'um' HH:mm", { locale: de })} versendet.`,
        });
      } else {
        const { data, error } = await supabase.functions.invoke("send-document-email", {
          body: emailData,
        });

        if (error) throw error;

        if (data.failed > 0 && data.failed_recipients) {
          toast({
            title: "Teilweise versendet",
            description: `${data.sent} von ${data.total} E-Mails erfolgreich versendet. ${data.failed} fehlgeschlagen.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "E-Mails versendet",
            description: `${data.sent} von ${data.total} E-Mails erfolgreich versendet.`,
          });
        }

        // Update press_releases if this was a press email
        if (pressReleaseId && user) {
          await supabase
            .from('press_releases')
            .update({
              email_sent_at: new Date().toISOString(),
              email_sent_by: user.id,
            })
            .eq('id', pressReleaseId);
          setPressReleaseId(null);
        }
      }

      // Reset form
      setSubject("");
      setBodyHtml("");
      setReplyTo("");
      setIsScheduled(false);
      setScheduledFor(undefined);
      setRecipients([]);
      setSelectedDocuments([]);
    } catch (error: any) {
      console.error("Error sending emails:", error);
      toast({
        title: "Fehler beim Versenden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  // --- Which field+source is open for adding ---
  const [openFieldSource, setOpenFieldSource] = useState<{ field: 'to' | 'cc' | 'bcc'; source: 'manual' | 'lists' | 'contacts' } | null>(null);

  const toggleFieldSource = (field: 'to' | 'cc' | 'bcc', source: 'manual' | 'lists' | 'contacts') => {
    setActiveRecipientField(field);
    if (openFieldSource?.field === field && openFieldSource?.source === source) {
      setOpenFieldSource(null);
    } else {
      setOpenFieldSource({ field, source });
    }
  };

  // --- Recipient field component ---
  const RecipientField = ({ type, label }: { type: 'to' | 'cc' | 'bcc'; label: string }) => {
    const fieldRecipients = getRecipientsByType(type);
    const isOpen = openFieldSource?.field === type;
    const activeSource = openFieldSource?.source;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{label}</Label>
          <div className="flex gap-1">
            <Button
              variant={isOpen && activeSource === 'manual' ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => toggleFieldSource(type, 'manual')}
            >
              <Mail className="h-3 w-3 mr-1" />
              Manuell
            </Button>
            <Button
              variant={isOpen && activeSource === 'lists' ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => toggleFieldSource(type, 'lists')}
            >
              <Users className="h-3 w-3 mr-1" />
              Verteiler
            </Button>
            <Button
              variant={isOpen && activeSource === 'contacts' ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => toggleFieldSource(type, 'contacts')}
            >
              <UserCircle className="h-3 w-3 mr-1" />
              Kontakte
            </Button>
          </div>
        </div>
        {fieldRecipients.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fieldRecipients.map((r) => (
              <Badge key={r.id} variant="secondary" className="gap-1 text-xs">
                {r.source === 'distribution_list' ? <Users className="h-3 w-3" /> : null}
                {r.label}
                <button onClick={() => removeRecipient(r.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {fieldRecipients.length === 0 && !isOpen && (
          <p className="text-xs text-muted-foreground">Keine Empfänger</p>
        )}

        {/* Inline input area */}
        {isOpen && activeSource === 'manual' && (
          <div className="flex gap-2 mt-1">
            <Input
              value={manualEmailInput}
              onChange={(e) => setManualEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManualRecipient()}
              placeholder="E-Mail-Adresse eingeben"
              className="text-sm"
              autoFocus
            />
            <Button onClick={addManualRecipient} size="sm">Hinzufügen</Button>
          </div>
        )}
        {isOpen && activeSource === 'lists' && (
          <ScrollArea className="h-[180px] mt-1 border rounded-md p-1">
            <div className="space-y-1">
              {distributionLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => addDistributionListRecipient(list)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{list.name}</p>
                    <p className="text-xs text-muted-foreground">{list.memberCount} Mitglieder</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">+ {type.toUpperCase()}</Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        {isOpen && activeSource === 'contacts' && (
          <div className="mt-1 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kontakte durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
                autoFocus
              />
            </div>
            <ScrollArea className="h-[180px] border rounded-md p-1">
              <div className="space-y-1">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => addContactRecipient(contact)}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0">+ {type.toUpperCase()}</Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-Mail verfassen</h2>
          <p className="text-sm text-muted-foreground">
            {getTotalRecipients()} Empfänger ausgewählt
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Vorschau
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || getTotalRecipients() === 0}
            className="gap-2"
          >
            {isScheduled ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {loading ? "Wird gesendet..." : isScheduled ? "Planen" : "Senden"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left Column (60%): Email Content */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>E-Mail-Inhalt</span>
                <div className="flex gap-2">
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Template wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Als Template
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sender */}
              <div>
                <Label htmlFor="sender">Absender *</Label>
                <Select value={selectedSender} onValueChange={setSelectedSender}>
                  <SelectTrigger id="sender">
                    <SelectValue placeholder="Absender wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {senderInfos.map((sender) => (
                      <SelectItem key={sender.id} value={sender.id}>
                        {sender.name} ({sender.landtag_email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reply-To */}
              <div>
                <Label htmlFor="replyTo">Antwort an (Reply-To)</Label>
                <Input
                  id="replyTo"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="antwort@example.com (optional)"
                />
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="subject">Betreff *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E-Mail-Betreff eingeben..."
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="body">Nachricht *</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Variablen <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => insertVariable("name")}>
                        {"{{name}}"} - Name
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => insertVariable("email")}>
                        {"{{email}}"} - E-Mail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => insertVariable("organization")}>
                        {"{{organization}}"} - Organisation
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => insertVariable("phone")}>
                        {"{{phone}}"} - Telefon
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <SimpleRichTextEditor
                  initialContent={bodyHtml}
                  onChange={setBodyHtml}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Dialog */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Vorschau</span>
                  <Select 
                    value={previewContact?.id || ""} 
                    onValueChange={(id) => {
                      const contact = contacts.find(c => c.id === id);
                      setPreviewContact(contact || null);
                    }}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Beispiel-Kontakt wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.slice(0, 10).map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
                <div className="text-sm text-muted-foreground">
                  <strong>Von:</strong> {senderInfos.find(s => s.id === selectedSender)?.landtag_email || "Kein Absender"}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>An:</strong> {previewContact?.email || "Beispiel Empfänger"}
                </div>
                <div className="font-bold mt-4">{replaceVariables(subject, previewContact) || "(Kein Betreff)"}</div>
                <div 
                  className="mt-2 text-sm"
                  dangerouslySetInnerHTML={{ 
                    __html: replaceVariables(bodyHtml, previewContact)
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right Column (40%): Recipients + Documents + Scheduled */}
        <div className="space-y-4">
          {/* An/CC/BCC Fields */}
          <Card>
            <CardHeader>
              <CardTitle>Empfänger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* BCC-only warning */}
              {onlyBccRecipients && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">
                    Nur BCC-Empfänger vorhanden. Ihre Absender-Adresse wird automatisch als „An" verwendet.
                  </p>
                </div>
              )}

              <RecipientField type="to" label="An" />
              <RecipientField type="cc" label="CC" />
              <RecipientField type="bcc" label="BCC" />



            </CardContent>
          </Card>

          {/* Document attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <FileText className="h-4 w-4 inline mr-2" />
                Dokumente anhängen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDocuments([...selectedDocuments, doc.id]);
                          } else {
                            setSelectedDocuments(selectedDocuments.filter((id) => id !== doc.id));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Scheduled Sending */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
                  <div>
                    <Label className="text-sm font-medium">Geplanter Versand</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatisch später versenden
                    </p>
                  </div>
                </div>
              </div>
              {isScheduled && (
                <div className="mt-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 w-full">
                        <CalendarIcon className="h-4 w-4" />
                        {scheduledFor 
                          ? format(scheduledFor, "dd.MM.yyyy HH:mm", { locale: de })
                          : "Zeitpunkt wählen"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-4 space-y-4">
                        <Calendar
                          mode="single"
                          selected={scheduledFor}
                          onSelect={(date) => {
                            if (date) {
                              const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                              newDate.setFullYear(date.getFullYear());
                              newDate.setMonth(date.getMonth());
                              newDate.setDate(date.getDate());
                              setScheduledFor(new Date(newDate));
                            }
                          }}
                          disabled={(date) => date < new Date()}
                          className="pointer-events-auto"
                          locale={de}
                        />
                        <div className="space-y-2">
                          <Label>Uhrzeit</Label>
                          <Input
                            type="time"
                            value={scheduledFor ? format(scheduledFor, "HH:mm") : ""}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(":");
                              const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                              newDate.setHours(parseInt(hours));
                              newDate.setMinutes(parseInt(minutes));
                              setScheduledFor(new Date(newDate));
                            }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
