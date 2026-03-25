import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, UserCircle, X, Search, FileText, Eye, Mail, ChevronDown, Save, Calendar as CalendarIcon, Clock, AlertTriangle } from "lucide-react";
import { sanitizeRichHtml } from '@/utils/htmlSanitizer';
import { ScrollArea } from "@/components/ui/scroll-area";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useEmailComposer, type RecipientEntry } from "./hooks/useEmailComposer";

// ── Recipient Field sub-component ────────────────────────────
function RecipientField({
  type, label, hook,
}: {
  type: "to" | "cc" | "bcc";
  label: string;
  hook: ReturnType<typeof useEmailComposer>;
}) {
  const fieldRecipients = hook.getRecipientsByType(type);
  const isOpen = hook.openFieldSource?.field === type;
  const activeSource = hook.openFieldSource?.source;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex gap-1">
          {(["manual", "lists", "contacts"] as const).map((src) => (
            <Button
              key={src}
              variant={isOpen && activeSource === src ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => hook.toggleFieldSource(type, src)}
            >
              {src === "manual" && <><Mail className="h-3 w-3 mr-1" />Manuell</>}
              {src === "lists" && <><Users className="h-3 w-3 mr-1" />Verteiler</>}
              {src === "contacts" && <><UserCircle className="h-3 w-3 mr-1" />Kontakte</>}
            </Button>
          ))}
        </div>
      </div>

      {fieldRecipients.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {fieldRecipients.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-1 text-xs">
              {r.source === "distribution_list" && <Users className="h-3 w-3" />}
              {r.label}
              <button onClick={() => hook.removeRecipient(r.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      {fieldRecipients.length === 0 && !isOpen && <p className="text-xs text-muted-foreground">Keine Empfänger</p>}

      {isOpen && activeSource === "manual" && (
        <div className="flex gap-2 mt-1">
          <Input value={hook.manualEmailInput} onChange={(e) => hook.setManualEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && hook.addManualRecipient()} placeholder="E-Mail-Adresse eingeben" className="text-sm" autoFocus />
          <Button onClick={hook.addManualRecipient} size="sm">Hinzufügen</Button>
        </div>
      )}
      {isOpen && activeSource === "lists" && (
        <ScrollArea className="h-[180px] mt-1 border rounded-md p-1">
          <div className="space-y-1">
            {hook.distributionLists.map((list) => (
              <div key={list.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => hook.addDistributionListRecipient(list)}>
                <div className="flex-1 min-w-0"><p className="font-medium text-sm">{list.name}</p><p className="text-xs text-muted-foreground">{list.memberCount} Mitglieder</p></div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">+ {type.toUpperCase()}</Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      {isOpen && activeSource === "contacts" && (
        <div className="mt-1 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Kontakte durchsuchen..." value={hook.searchQuery} onChange={(e) => hook.setSearchQuery(e.target.value)} className="pl-10 text-sm" autoFocus />
          </div>
          <ScrollArea className="h-[180px] border rounded-md p-1">
            <div className="space-y-1">
              {hook.filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => hook.addContactRecipient(contact)}>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={contact.avatar_url} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{hook.getInitials(contact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{contact.name}</p><p className="text-xs text-muted-foreground truncate">{contact.email}</p></div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0">+ {type.toUpperCase()}</Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function EmailComposer() {
  const hook = useEmailComposer();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-Mail verfassen</h2>
          <p className="text-sm text-muted-foreground">{hook.getTotalRecipients()} Empfänger ausgewählt</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => hook.setShowPreview(!hook.showPreview)} className="gap-2"><Eye className="h-4 w-4" />Vorschau</Button>
          <Button onClick={hook.handleSend} disabled={hook.loading || hook.getTotalRecipients() === 0} className="gap-2">
            {hook.isScheduled ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {hook.loading ? "Wird gesendet..." : hook.isScheduled ? "Planen" : "Senden"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Left: Email Content */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>E-Mail-Inhalt</span>
                <div className="flex gap-2">
                  <Select value={hook.selectedTemplate} onValueChange={hook.handleTemplateSelect}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Template wählen" /></SelectTrigger>
                    <SelectContent>{hook.emailTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={hook.handleSaveAsTemplate}><Save className="h-4 w-4 mr-2" />Als Template</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sender">Absender *</Label>
                <Select value={hook.selectedSender} onValueChange={hook.setSelectedSender}>
                  <SelectTrigger id="sender"><SelectValue placeholder="Absender wählen" /></SelectTrigger>
                  <SelectContent>{hook.senderInfos.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.landtag_email})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="replyTo">Antwort an (Reply-To)</Label>
                <Input id="replyTo" type="email" value={hook.replyTo} onChange={(e) => hook.setReplyTo(e.target.value)} placeholder="antwort@example.com (optional)" />
              </div>
              <div>
                <Label htmlFor="subject">Betreff *</Label>
                <Input id="subject" value={hook.subject} onChange={(e) => hook.setSubject(e.target.value)} placeholder="E-Mail-Betreff eingeben..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="body">Nachricht *</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Variablen <ChevronDown className="h-4 w-4 ml-1" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {["name", "email", "organization", "phone"].map((v) => (
                        <DropdownMenuItem key={v} onClick={() => hook.insertVariable(v)}>{`{{${v}}}`} - {v === "name" ? "Name" : v === "email" ? "E-Mail" : v === "organization" ? "Organisation" : "Telefon"}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <SimpleRichTextEditor
                  initialContent={hook.bodyHtml}
                  contentVersion={hook.editorKey}
                  onChange={hook.setBodyHtml}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview Dialog */}
          <Dialog open={hook.showPreview} onOpenChange={hook.setShowPreview}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>Vorschau</span>
                  <Select value={hook.previewContact?.id || ""} onValueChange={(id) => hook.setPreviewContact(hook.contacts.find((c) => c.id === id) || null)}>
                    <SelectTrigger className="w-[250px]"><SelectValue placeholder="Beispiel-Kontakt wählen" /></SelectTrigger>
                    <SelectContent>{hook.contacts.slice(0, 10).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </DialogTitle>
              </DialogHeader>
              <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
                <div className="text-sm text-muted-foreground"><strong>Von:</strong> {hook.senderInfos.find((s) => s.id === hook.selectedSender)?.landtag_email || "Kein Absender"}</div>
                <div className="text-sm text-muted-foreground"><strong>An:</strong> {hook.previewContact?.email || "Beispiel Empfänger"}</div>
                <div className="font-bold mt-4">{hook.replaceVariables(hook.subject, hook.previewContact) || "(Kein Betreff)"}</div>
                <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(hook.replaceVariables(hook.bodyHtml, hook.previewContact)) }} />
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Right: Recipients + Documents + Schedule */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Empfänger</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {hook.onlyBccRecipients && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">Nur BCC-Empfänger vorhanden. Ihre Absender-Adresse wird automatisch als „An" verwendet.</p>
                </div>
              )}
              <RecipientField type="to" label="An" hook={hook} />
              <RecipientField type="cc" label="CC" hook={hook} />
              <RecipientField type="bcc" label="BCC" hook={hook} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base"><FileText className="h-4 w-4 inline mr-2" />Dokumente anhängen</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                  {hook.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-2 rounded-lg border hover:bg-muted/50">
                      <Checkbox checked={hook.selectedDocuments.includes(doc.id)} onCheckedChange={(checked) => hook.setSelectedDocuments(checked ? [...hook.selectedDocuments, doc.id] : hook.selectedDocuments.filter((id) => id !== doc.id))} />
                      <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{doc.title}</p><p className="text-xs text-muted-foreground truncate">{doc.file_name}</p></div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch checked={hook.isScheduled} onCheckedChange={hook.setIsScheduled} />
                  <div><Label className="text-sm font-medium">Geplanter Versand</Label><p className="text-xs text-muted-foreground">Automatisch später versenden</p></div>
                </div>
              </div>
              {hook.isScheduled && (
                <div className="mt-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="gap-2 w-full">
                        <CalendarIcon className="h-4 w-4" />
                        {hook.scheduledFor ? format(hook.scheduledFor, "dd.MM.yyyy HH:mm", { locale: de }) : "Zeitpunkt wählen"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <div className="p-4 space-y-4">
                        <Calendar
                          mode="single"
                          selected={hook.scheduledFor}
                          onSelect={(date) => {
                            if (date) {
                              const nd = hook.scheduledFor ? new Date(hook.scheduledFor) : new Date();
                              nd.setFullYear(date.getFullYear()); nd.setMonth(date.getMonth()); nd.setDate(date.getDate());
                              hook.setScheduledFor(new Date(nd));
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
                            value={hook.scheduledFor ? format(hook.scheduledFor, "HH:mm") : ""}
                            onChange={(e) => {
                              const [h, m] = e.target.value.split(":");
                              const nd = hook.scheduledFor ? new Date(hook.scheduledFor) : new Date();
                              nd.setHours(parseInt(h)); nd.setMinutes(parseInt(m));
                              hook.setScheduledFor(new Date(nd));
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
