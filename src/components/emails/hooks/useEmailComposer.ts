import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { debugConsole } from '@/utils/debugConsole';
import {
  PRESS_EMAIL_TEMPLATE_BODY_DEFAULT,
  PRESS_EMAIL_TEMPLATE_SUBJECT_DEFAULT,
} from "@/lib/pressEmailTemplateDefaults";

// ── Types ────────────────────────────────────────────────────
export interface Contact {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  avatar_url?: string;
  phone?: string;
}

export interface DistributionList {
  id: string;
  name: string;
  topic?: string;
  memberCount?: number;
}

export interface EmailDocument {
  id: string;
  title: string;
  file_name: string;
}

export interface SenderInfo {
  id: string;
  name: string;
  landtag_email: string;
  is_default?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
}

export interface RecipientEntry {
  id: string;
  type: "to" | "cc" | "bcc";
  label: string;
  email?: string;
  source: "manual" | "contact" | "distribution_list";
  sourceId?: string;
}

// ── Hook ─────────────────────────────────────────────────────
export function useEmailComposer() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Form
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined);

  // Sender / templates
  const [senderInfos, setSenderInfos] = useState<SenderInfo[]>([]);
  const [selectedSender, setSelectedSender] = useState("");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);

  // Press release
  const [pressReleaseId, setPressReleaseId] = useState<string | null>(null);
  const [pendingPressComposeId, setPendingPressComposeId] = useState<string | null>(null);
  const initializedPressComposeRef = useRef<string | null>(null);

  // Data
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [distributionListsLoaded, setDistributionListsLoaded] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<EmailDocument[]>([]);

  // Recipients
  const [recipients, setRecipients] = useState<RecipientEntry[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // UI
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeRecipientField, setActiveRecipientField] = useState<"to" | "cc" | "bcc">("to");
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [openFieldSource, setOpenFieldSource] = useState<{ field: "to" | "cc" | "bcc"; source: "manual" | "lists" | "contacts" } | null>(null);
  const [senderInfosLoaded, setSenderInfosLoaded] = useState(false);

  // ── Data fetching ──────────────────────────────────────────
  useEffect(() => {
    if (currentTenant) {
      fetchDistributionLists();
      fetchContacts();
      fetchDocuments();
      fetchSenderInfos();
      fetchEmailTemplates();
    }
  }, [currentTenant]);

  useEffect(() => {
    const action = searchParams.get("action");
    const prId = searchParams.get("pressReleaseId");
    if (action === "compose-press" && prId && currentTenant) {
      setPressReleaseId(prId);
      setPendingPressComposeId(prId);
    }
  }, [searchParams, currentTenant]);

  useEffect(() => {
    if (!pendingPressComposeId) return;
    if (!distributionListsLoaded || !senderInfosLoaded) return;
    if (initializedPressComposeRef.current === pendingPressComposeId) return;

    initializedPressComposeRef.current = pendingPressComposeId;
    loadPressReleaseForEmail(pendingPressComposeId)
      .finally(() => {
        setPendingPressComposeId(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("action");
        nextParams.delete("pressReleaseId");
        setSearchParams(nextParams, { replace: true });
      });
  }, [
    pendingPressComposeId,
    distributionListsLoaded,
    senderInfosLoaded,
    distributionLists,
    senderInfos,
    selectedSender,
    searchParams,
    setSearchParams,
  ]);

  const loadPressReleaseForEmail = async (prId: string) => {
    try {
      const { data: pr, error: prError } = await supabase
        .from("press_releases")
        .select("id, title, excerpt, content, content_html, ghost_post_url, published_at")
        .eq("id", prId)
        .single();
      if (prError) throw prError;

      const { data: settings } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .eq("tenant_id", currentTenant!.id)
        .in("setting_key", ["press_email_template_subject", "press_email_template_body", "press_default_distribution_list_id"]);

      let templateSubject = PRESS_EMAIL_TEMPLATE_SUBJECT_DEFAULT;
      let templateBody = PRESS_EMAIL_TEMPLATE_BODY_DEFAULT;
      let defaultDistListId: string | null = null;

      (settings || []).forEach((s: Record<string, any>) => {
        if (s.setting_key === "press_email_template_subject" && s.setting_value) templateSubject = s.setting_value;
        if (s.setting_key === "press_email_template_body" && s.setting_value) templateBody = s.setting_value;
        if (s.setting_key === "press_default_distribution_list_id" && s.setting_value) defaultDistListId = s.setting_value;
      });

      const publishedDate = pr.published_at
        ? format(new Date(pr.published_at), "dd.MM.yyyy", { locale: de })
        : format(new Date(), "dd.MM.yyyy", { locale: de });

      const hasMeaningfulHtmlContent = (html: string | null | undefined) => {
        if (!html) return false;
        const plainText = html
          .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/gi, " ")
          .trim();
        return plainText.length > 0;
      };

      const pressContent = hasMeaningfulHtmlContent(pr.content_html)
        ? pr.content_html!
        : (pr.content || "").replace(/\n/g, "<br>");

      const replacePressVars = (text: string) =>
        text
          .replace(/\{\{titel\}\}/g, pr.title || "")
          .replace(/\{\{excerpt\}\}/g, pr.excerpt || "")
          .replace(/\{\{link\}\}/g, pr.ghost_post_url || "")
          .replace(/\{\{datum\}\}/g, publishedDate)
          .replace(/\{\{inhalt\}\}/g, pressContent);

      setSubject(replacePressVars(templateSubject));

      // Convert template body to proper HTML paragraphs for the Lexical editor
      const replacedBody = replacePressVars(templateBody);
      const htmlBody = replacedBody
        .split(/\n{2,}/)
        .map((block) => {
          const trimmed = block.trim();
          if (!trimmed) return "";
          // If the block already contains block-level HTML, use it as-is
          if (/^<(p|div|h[1-6]|ul|ol|blockquote|table)/i.test(trimmed)) return trimmed;
          // Otherwise wrap in <p>, converting single \n to <br>
          return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
        })
        .filter(Boolean)
        .join("");

      setBodyHtml(htmlBody);
      setEditorKey((k) => k + 1);

      if (defaultDistListId) {
        const list = distributionLists.find((l) => l.id === defaultDistListId);
        if (list) {
          setRecipients((prev) => {
            if (prev.some((r) => r.sourceId === list.id && r.source === "distribution_list" && r.type === "bcc")) return prev;
            return [...prev, { id: `list-${list.id}-bcc`, type: "bcc", label: `${list.name} (${list.memberCount} Mitglieder)`, source: "distribution_list", sourceId: list.id }];
          });
        }
      }

      const defaultSenderInfo = senderInfos.find((s) => s.id === selectedSender);
      if (defaultSenderInfo?.landtag_email) {
        setRecipients((prev) => {
          if (prev.some((r) => r.email === defaultSenderInfo.landtag_email && r.type === "to")) return prev;
          return [...prev, { id: `manual-${Date.now()}`, type: "to", label: defaultSenderInfo.landtag_email, email: defaultSenderInfo.landtag_email, source: "manual" }];
        });
      }

      toast({ title: "Presse-E-Mail vorbereitet", description: `Daten aus "${pr.title}" wurden geladen.` });
    } catch (error: unknown) {
      debugConsole.error("Error loading press release for email:", error);
      toast({ title: "Fehler", description: "Pressemitteilung konnte nicht geladen werden.", variant: "destructive" });
    }
  };

  const fetchSenderInfos = async () => {
    try {
      setSenderInfosLoaded(false);
      const { data, error } = await supabase
        .from("sender_information")
        .select("id, name, landtag_email, is_default")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true);
      if (error) throw error;
      setSenderInfos((data || []) as SenderInfo[]);
      const defaultSender = data?.find((s: { is_default?: boolean | null }) => s.is_default);
      if (defaultSender) setSelectedSender(defaultSender.id);
      else if (data && data.length > 0) setSelectedSender(data[0].id);
    } catch (error) {
      debugConsole.error("Error fetching sender infos:", error);
    } finally {
      setSenderInfosLoaded(true);
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
      debugConsole.error("Error fetching email templates:", error);
    }
  };

  const fetchDistributionLists = async () => {
    try {
      setDistributionListsLoaded(false);
      const { data: lists, error } = await supabase.from("distribution_lists").select("id, name, topic").eq("user_id", user!.id).order("name");
      if (error) throw error;
      const listsWithCounts = await Promise.all(
        (lists || []).map(async (list: Record<string, any>) => {
          const { count } = await supabase.from("distribution_list_members").select("*", { count: "exact", head: true }).eq("distribution_list_id", list.id);
          return { ...list, memberCount: count || 0 };
        })
      );
      setDistributionLists(listsWithCounts as DistributionList[]);
    } catch (error: unknown) {
      debugConsole.error("Error fetching distribution lists:", error);
    } finally {
      setDistributionListsLoaded(true);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.from("contacts").select("id, name, email, organization, avatar_url, phone").eq("tenant_id", currentTenant!.id).not("email", "is", null).order("name");
      if (error) throw error;
      setContacts((data || []) as Contact[]);
    } catch (error: unknown) {
      debugConsole.error("Error fetching contacts:", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase.from("documents").select("id, title, file_name").eq("tenant_id", currentTenant!.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: unknown) {
      debugConsole.error("Error fetching documents:", error);
    }
  };

  // ── Template helpers ───────────────────────────────────────
  const handleTemplateSelect = (templateId: string) => {
    const template = emailTemplates.find((t) => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
      setEditorKey((k) => k + 1);
      setSelectedTemplate(templateId);
      toast({ title: "Template geladen", description: `"${template.name}" wurde geladen` });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({ title: "Fehler", description: "Betreff und Nachricht müssen ausgefüllt sein", variant: "destructive" });
      return;
    }
    const templateName = prompt("Template-Name eingeben:");
    if (!templateName) return;
    try {
      const { error } = await supabase.from("email_templates").insert([{ tenant_id: currentTenant!.id, created_by: user!.id, name: templateName, subject, body_html: bodyHtml, is_active: true }]);
      if (error) throw error;
      toast({ title: "Template gespeichert", description: `"${templateName}" wurde erstellt` });
      fetchEmailTemplates();
    } catch (error: unknown) {
      toast({ title: "Fehler beim Speichern", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
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

  // ── Recipient management ───────────────────────────────────
  const addManualRecipient = () => {
    const email = manualEmailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Ungültige E-Mail", description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.", variant: "destructive" });
      return;
    }
    if (recipients.some((r) => r.email === email && r.type === activeRecipientField)) {
      toast({ title: "Bereits vorhanden", description: "Diese E-Mail ist bereits hinzugefügt.", variant: "destructive" });
      return;
    }
    setRecipients((prev) => [...prev, { id: `manual-${Date.now()}-${Math.random()}`, type: activeRecipientField, label: email, email, source: "manual" }]);
    setManualEmailInput("");
  };

  const addContactRecipient = (contact: Contact) => {
    if (!contact.email) return;
    if (recipients.some((r) => r.sourceId === contact.id && r.source === "contact" && r.type === activeRecipientField)) return;
    setRecipients((prev) => [...prev, { id: `contact-${contact.id}-${activeRecipientField}`, type: activeRecipientField, label: contact.name, email: contact.email, source: "contact", sourceId: contact.id }]);
  };

  const addDistributionListRecipient = (list: DistributionList, type?: "to" | "cc" | "bcc") => {
    const recipientType = type || activeRecipientField;
    if (recipients.some((r) => r.sourceId === list.id && r.source === "distribution_list" && r.type === recipientType)) return;
    setRecipients((prev) => [...prev, { id: `list-${list.id}-${recipientType}`, type: recipientType, label: `${list.name} (${list.memberCount} Mitglieder)`, source: "distribution_list", sourceId: list.id }]);
  };

  const removeRecipient = (id: string) => setRecipients((prev) => prev.filter((r) => r.id !== id));
  const getRecipientsByType = (type: "to" | "cc" | "bcc") => recipients.filter((r) => r.type === type);
  const getTotalRecipients = () => recipients.length;
  const onlyBccRecipients = recipients.length > 0 && getRecipientsByType("to").length === 0 && getRecipientsByType("bcc").length > 0;

  const toggleFieldSource = (field: "to" | "cc" | "bcc", source: "manual" | "lists" | "contacts") => {
    setActiveRecipientField(field);
    if (openFieldSource?.field === field && openFieldSource?.source === source) {
      setOpenFieldSource(null);
    } else {
      setOpenFieldSource({ field, source });
    }
  };

  // ── Send ───────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim()) { toast({ title: "Fehler", description: "Bitte geben Sie einen Betreff ein.", variant: "destructive" }); return; }
    if (!bodyHtml.trim()) { toast({ title: "Fehler", description: "Bitte geben Sie eine Nachricht ein.", variant: "destructive" }); return; }
    if (getTotalRecipients() === 0) { toast({ title: "Fehler", description: "Bitte wählen Sie mindestens einen Empfänger aus.", variant: "destructive" }); return; }
    if (isScheduled && !scheduledFor) { toast({ title: "Fehler", description: "Bitte wählen Sie einen Zeitpunkt für den geplanten Versand.", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const toR = getRecipientsByType("to");
      const ccR = getRecipientsByType("cc");
      const bccR = getRecipientsByType("bcc");

      const manualToEmails = toR.filter((r) => r.source === "manual").map((r) => r.email!);
      const manualCcEmails = ccR.filter((r) => r.source === "manual").map((r) => r.email!);
      const manualBccEmails = bccR.filter((r) => r.source === "manual").map((r) => r.email!);
      const contactToIds = toR.filter((r) => r.source === "contact").map((r) => r.sourceId!);
      const contactCcIds = ccR.filter((r) => r.source === "contact").map((r) => r.sourceId!);
      const contactBccIds = bccR.filter((r) => r.source === "contact").map((r) => r.sourceId!);
      const distListIds = [...new Set(recipients.filter((r) => r.source === "distribution_list").map((r) => r.sourceId!))];

      const senderInfo = senderInfos.find((s) => s.id === selectedSender);
      let finalToEmails = manualToEmails;
      if (onlyBccRecipients && senderInfo) finalToEmails = [senderInfo.landtag_email];

      const ccContactEmails: string[] = [];
      const bccContactEmails: string[] = [];
      for (const cId of contactCcIds) { const c = contacts.find((ct) => ct.id === cId); if (c?.email) ccContactEmails.push(c.email); }
      for (const cId of contactBccIds) { const c = contacts.find((ct) => ct.id === cId); if (c?.email) bccContactEmails.push(c.email); }

      const emailData = {
        subject, body_html: bodyHtml, reply_to: replyTo || undefined,
        recipients: finalToEmails, recipient_emails: [],
        cc: [...manualCcEmails, ...ccContactEmails], bcc: [...manualBccEmails, ...bccContactEmails],
        distribution_list_ids: distListIds, contact_ids: contactToIds,
        document_ids: selectedDocuments, tenant_id: currentTenant!.id, user_id: user!.id, sender_id: selectedSender,
      };

      if (isScheduled && scheduledFor) {
        const { error } = await supabase.from("scheduled_emails").insert([{ ...emailData, scheduled_for: scheduledFor.toISOString(), status: "scheduled" }]);
        if (error) throw error;
        toast({ title: "E-Mail geplant", description: `E-Mail wird am ${format(scheduledFor, "dd.MM.yyyy 'um' HH:mm", { locale: de })} versendet.` });
      } else {
        const { data, error } = await supabase.functions.invoke("send-document-email", { body: emailData });
        if (error) throw error;
        if (data.failed > 0) {
          toast({ title: "Teilweise versendet", description: `${data.sent} von ${data.total} E-Mails erfolgreich versendet. ${data.failed} fehlgeschlagen.`, variant: "destructive" });
        } else {
          toast({ title: "E-Mails versendet", description: `${data.sent} von ${data.total} E-Mails erfolgreich versendet.` });
        }
        if (pressReleaseId && user) {
          await supabase.from("press_releases").update({ email_sent_at: new Date().toISOString(), email_sent_by: user.id }).eq("id", pressReleaseId);
          setPressReleaseId(null);
        }
      }

      setSubject(""); setBodyHtml(""); setReplyTo(""); setIsScheduled(false); setScheduledFor(undefined); setRecipients([]); setSelectedDocuments([]);
    } catch (error: unknown) {
      debugConsole.error("Error sending emails:", error);
      toast({ title: "Fehler beim Versenden", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────
  const filteredContacts = contacts.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return {
    // Form state
    subject, setSubject, bodyHtml, setBodyHtml, replyTo, setReplyTo,
    isScheduled, setIsScheduled, scheduledFor, setScheduledFor,
    // Sender / templates
    senderInfos, selectedSender, setSelectedSender,
    emailTemplates, selectedTemplate, handleTemplateSelect, handleSaveAsTemplate,
    previewContact, setPreviewContact,
    // Recipients
    recipients, activeRecipientField, manualEmailInput, setManualEmailInput,
    openFieldSource, toggleFieldSource,
    addManualRecipient, addContactRecipient, addDistributionListRecipient, removeRecipient,
    getRecipientsByType, getTotalRecipients, onlyBccRecipients,
    // Data
    distributionLists, contacts, documents, filteredContacts,
    selectedDocuments, setSelectedDocuments,
    // UI
    searchQuery, setSearchQuery, loading, showPreview, setShowPreview,
    editorKey, getInitials,
    // Actions
    handleSend, insertVariable, replaceVariables,
  };
}
