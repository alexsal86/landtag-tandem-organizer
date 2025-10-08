import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmailRichTextEditor from "./EmailRichTextEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
}

export function EmailComposer() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");

  // Neue States
  const [senderInfos, setSenderInfos] = useState<SenderInfo[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("");
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewContact, setPreviewContact] = useState<Contact | null>(null);

  // Recipients
  const [distributionLists, setDistributionLists] = useState<DistributionList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const [selectedDistributionLists, setSelectedDistributionLists] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      fetchDistributionLists();
      fetchContacts();
      fetchDocuments();
      fetchSenderInfos();
      fetchEmailTemplates();
    }
  }, [currentTenant]);

  const fetchSenderInfos = async () => {
    try {
      const { data, error } = await supabase
        .from("sender_information")
        .select("id, name, landtag_email")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true);
      
      if (error) throw error;
      setSenderInfos(data || []);
      
      // Set default sender
      const defaultSender = data?.find((s: any) => s.is_default);
      if (defaultSender) setSelectedSender(defaultSender.id);
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

      // Get member counts
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

  const handleAddManualEmail = () => {
    const email = manualEmailInput.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setManualEmails([...manualEmails, email]);
      setManualEmailInput("");
    } else {
      toast({
        title: "Ungültige E-Mail",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveManualEmail = (email: string) => {
    setManualEmails(manualEmails.filter(e => e !== email));
  };

  const getTotalRecipients = () => {
    const listMembers = selectedDistributionLists.reduce((sum, listId) => {
      const list = distributionLists.find(l => l.id === listId);
      return sum + (list?.memberCount || 0);
    }, 0);
    
    return listMembers + selectedContacts.length + manualEmails.length;
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Betreff ein.",
        variant: "destructive",
      });
      return;
    }

    if (!bodyHtml.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Nachricht ein.",
        variant: "destructive",
      });
      return;
    }

    if (getTotalRecipients() === 0) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie mindestens einen Empfänger aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-document-email", {
        body: {
          subject,
          body_html: bodyHtml,
          recipients: manualEmails,
          cc: cc.split(",").map(e => e.trim()).filter(e => e),
          bcc: bcc.split(",").map(e => e.trim()).filter(e => e),
          distribution_list_ids: selectedDistributionLists,
          contact_ids: selectedContacts,
          document_ids: selectedDocuments,
          tenant_id: currentTenant!.id,
          user_id: user!.id,
          sender_id: selectedSender,
        },
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

      // Reset form
      setSubject("");
      setBodyHtml("");
      setManualEmails([]);
      setCc("");
      setBcc("");
      setSelectedDistributionLists([]);
      setSelectedContacts([]);
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
            <Send className="h-4 w-4" />
            {loading ? "Wird gesendet..." : "Senden"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Email Content */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>E-Mail-Inhalt</span>
                <div className="flex gap-2">
                  {/* Template Dropdown */}
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
                  
                  {/* Save as Template */}
                  <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                    <Save className="h-4 w-4 mr-2" />
                    Als Template
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sender Selection */}
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

              <div>
                <Label htmlFor="subject">Betreff *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E-Mail-Betreff eingeben..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="body">Nachricht *</Label>
                  
                  {/* Variables Dropdown */}
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
                
                <EmailRichTextEditor
                  initialContent={bodyHtml}
                  onChange={setBodyHtml}
                />
              </div>

              <div>
                <Label htmlFor="cc">CC (optional)</Label>
                <Input
                  id="cc"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>

              <div>
                <Label htmlFor="bcc">BCC (optional)</Label>
                <Input
                  id="bcc"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Vorschau</CardTitle>
                  
                  {/* Preview Contact Selector */}
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
                </div>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Recipients */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empfänger auswählen</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="manual">
                    <Mail className="h-4 w-4 mr-2" />
                    Manuell
                  </TabsTrigger>
                  <TabsTrigger value="lists">
                    <Users className="h-4 w-4 mr-2" />
                    Verteiler
                  </TabsTrigger>
                  <TabsTrigger value="contacts">
                    <UserCircle className="h-4 w-4 mr-2" />
                    Kontakte
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={manualEmailInput}
                      onChange={(e) => setManualEmailInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddManualEmail()}
                      placeholder="E-Mail-Adresse eingeben"
                    />
                    <Button onClick={handleAddManualEmail}>
                      Hinzufügen
                    </Button>
                  </div>
                  
                  {manualEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {manualEmails.map((email) => (
                        <Badge key={email} variant="secondary" className="gap-1">
                          {email}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 ml-1"
                            onClick={() => handleRemoveManualEmail(email)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="lists" className="space-y-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {distributionLists.map((list) => (
                        <div
                          key={list.id}
                          className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedDistributionLists.includes(list.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDistributionLists([
                                  ...selectedDistributionLists,
                                  list.id,
                                ]);
                              } else {
                                setSelectedDistributionLists(
                                  selectedDistributionLists.filter((id) => id !== list.id)
                                );
                              }
                            }}
                          />
                          <div className="flex-1">
                            <p className="font-medium">{list.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {list.memberCount} Mitglied{list.memberCount !== 1 ? "er" : ""}
                              {list.topic && ` • ${list.topic}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="contacts" className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Kontakte durchsuchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedContacts([...selectedContacts, contact.id]);
                              } else {
                                setSelectedContacts(
                                  selectedContacts.filter((id) => id !== contact.id)
                                );
                              }
                            }}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.avatar_url} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{contact.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Document attachments */}
          <Card>
            <CardHeader>
              <CardTitle>
                <FileText className="h-5 w-5 inline mr-2" />
                Dokumente anhängen (optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDocuments([...selectedDocuments, doc.id]);
                          } else {
                            setSelectedDocuments(
                              selectedDocuments.filter((id) => id !== doc.id)
                            );
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
