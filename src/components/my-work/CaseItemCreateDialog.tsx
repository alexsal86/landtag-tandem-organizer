import { useEffect, useRef, useState } from "react";
import { addWeeks, format } from "date-fns";
import { Briefcase, Mail, MessageSquare, Phone, UserRound } from "lucide-react";
import { debugConsole } from '@/utils/debugConsole';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { CaseItemFormData, useCaseItems } from "@/features/cases/items/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface CaseItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  createCaseItem: ReturnType<typeof useCaseItems>["createCaseItem"];
  assignees: Array<{ id: string; name: string }>;
  defaultAssigneeId: string | null;
}

interface ContactSearchResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
}

const sourceChannelOptions = [
  { value: "email", label: "E-Mail", icon: Mail },
  { value: "phone", label: "Telefon", icon: Phone },
  { value: "social", label: "Social Media", icon: MessageSquare },
  { value: "in_person", label: "Persönlich", icon: UserRound },
  { value: "other", label: "Sonstiges", icon: Briefcase },
] as const;

const categoryOptions = ["Allgemein", "Bürgeranliegen", "Anfrage", "Beschwerde", "Termin", "Sonstiges"] as const;

const priorityOptions = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
  { value: "urgent", label: "Dringend" },
] as const;

export function CaseItemCreateDialog({ open, onOpenChange, onCreated, createCaseItem, assignees, defaultAssigneeId }: CaseItemCreateDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ContactSearchResult[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [sourceChannel, setSourceChannel] = useState<CaseItemFormData["source_channel"]>("email");
  const [priority, setPriority] = useState<NonNullable<CaseItemFormData["priority"]>>("medium");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(defaultAssigneeId ? [defaultAssigneeId] : []);
  const [category, setCategory] = useState("");
  const [visibleToAll, setVisibleToAll] = useState(false);
  const [sourceReceivedDate, setSourceReceivedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasContext = Boolean(user && currentTenant);
  const contactSearchRequestId = useRef(0);

  const setDefaultDates = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setSourceReceivedDate(today);
    setDueDate(format(addWeeks(new Date(`${today}T12:00:00`), 4), "yyyy-MM-dd"));
  };

  useEffect(() => {
    if (open) {
      setSubject("");
      setDescription("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setSelectedContactId(null);
      setSearchResults([]);
      setShowSearchResults(false);
      setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
      setVisibleToAll(false);
      setDefaultDates();
    }
  }, [defaultAssigneeId, open]);

  useEffect(() => {
    if (!open || !currentTenant) return;

    const query = contactName.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchingContacts(false);
      return;
    }

    const timer = setTimeout(async () => {
      const requestId = ++contactSearchRequestId.current;
      setSearchingContacts(true);

      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email, phone, organization")
        .eq("tenant_id", currentTenant.id)
        .neq("contact_type", "archive")
        .ilike("name", `%${query}%`)
        .order("is_favorite", { ascending: false })
        .order("name")
        .limit(8);

      if (requestId !== contactSearchRequestId.current) return;

      if (error) {
        debugConsole.error("Error searching contacts:", error);
        setSearchResults([]);
      } else {
        setSearchResults((data ?? []) as ContactSearchResult[]);
      }

      setSearchingContacts(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [contactName, currentTenant, open]);

  const getReporterContact = () => {
    if (sourceChannel === "email") return contactEmail.trim() || contactPhone.trim() || null;
    if (sourceChannel === "phone") return contactPhone.trim() || contactEmail.trim() || null;
    return [contactEmail.trim(), contactPhone.trim()].filter(Boolean).join(" · ") || null;
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !sourceReceivedDate || !category || !hasContext) return;

    setSubmitError(null);
    setSubmitting(true);

    const newItem = await createCaseItem({
      source_channel: sourceChannel,
      priority,
      status: "neu",
      due_at: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      source_received_at: new Date(`${sourceReceivedDate}T12:00:00`).toISOString(),
      owner_user_id: selectedAssigneeIds[0] || null,
      contact_id: selectedContactId,
      reporter_name: contactName.trim() || null,
      reporter_contact: getReporterContact(),
      visible_to_all: visibleToAll,
      intake_payload: {
        category,
        assignee_ids: selectedAssigneeIds,
        contact_name: contactName.trim() || null,
        contact_detail: getReporterContact(),
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        matched_contact_id: selectedContactId,
      },
      subject: subject.trim(),
      summary: description.trim() || subject.trim(),
      resolution_summary: description.trim() || subject.trim(),
    });

    setSubmitting(false);

    if (!newItem) {
      setSubmitError("Vorgang konnte nicht erstellt werden. Details siehe Benachrichtigung.");
      return;
    }

    onCreated(newItem.id);
    setSubject("");
    setDescription("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setSelectedContactId(null);
    setSearchResults([]);
    setShowSearchResults(false);
    setSourceChannel("email");
    setPriority("medium");
    setSelectedAssigneeIds(defaultAssigneeId ? [defaultAssigneeId] : []);
    setCategory("");
    setVisibleToAll(false);
    setDefaultDates();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,1200px)] max-w-[min(96vw,1200px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuer Vorgang</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!hasContext && (
            <p className="text-sm text-destructive">
              Kein aktiver Mandanten-/Sitzungskontext vorhanden. Bitte neu anmelden oder Mandant auswählen.
            </p>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="case-item-visible-to-all" className="font-bold">Öffentlich</Label>
              <p className="text-xs text-muted-foreground">Alle Mitglieder des Mandanten dürfen den Vorgang lesen.</p>
            </div>
            <Switch id="case-item-visible-to-all" checked={visibleToAll} onCheckedChange={setVisibleToAll} />
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Kanal</Label>
            <RadioGroup value={sourceChannel} onValueChange={(value) => setSourceChannel(value as CaseItemFormData["source_channel"])} className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
              {sourceChannelOptions.map((option) => {
                const Icon = option.icon;
                const selected = sourceChannel === option.value;
                const id = `source-channel-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className={`flex min-w-44 cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option.value} aria-label={`Kanal ${option.label}`} />
                    <Icon className="h-3.5 w-3.5" />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case-item-contact-name" className="font-bold">Von / Gesprächspartner</Label>

              <div className="space-y-2">
                <Label htmlFor="case-item-contact-name" className="text-xs font-semibold text-muted-foreground">Name</Label>
                <div className="relative">
                  <Input
                    id="case-item-contact-name"
                    placeholder="Name des Bürgers"
                    value={contactName}
                    onFocus={() => setShowSearchResults(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSearchResults(false), 120);
                    }}
                    onChange={(event) => {
                      setContactName(event.target.value);
                      if (selectedContactId) {
                        setSelectedContactId(null);
                        setContactEmail("");
                        setContactPhone("");
                      }
                    }}
                  />

                  {showSearchResults && (searchingContacts || searchResults.length > 0) && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-md">
                      {searchingContacts ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">Suche Kontakte…</p>
                      ) : (
                        searchResults.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            className="flex w-full flex-col rounded-sm px-2 py-1 text-left hover:bg-muted"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setSelectedContactId(contact.id);
                              setContactName(contact.name);
                              setContactEmail(contact.email || "");
                              setContactPhone(contact.phone || "");
                              setShowSearchResults(false);
                            }}
                          >
                            <span className="text-sm font-medium">{contact.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[contact.organization, contact.email, contact.phone].filter(Boolean).join(" · ") || "Kontakt ohne E-Mail/Telefon"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {selectedContactId ? (
                  <p className="text-xs text-primary">Kontakt verknüpft.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Ab 2 Zeichen wird in den Kontakten gesucht.</p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="case-item-contact-email" className="text-xs font-semibold text-muted-foreground">E-Mail</Label>
                  <Input
                    id="case-item-contact-email"
                    placeholder="E-Mail-Adresse"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="case-item-contact-phone" className="text-xs font-semibold text-muted-foreground">Telefon</Label>
                  <Input
                    id="case-item-contact-phone"
                    placeholder="Telefonnummer"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-item-subject" className="font-bold">Betreff</Label>
              <Input
                id="case-item-subject"
                placeholder="Kurzer Betreff"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="case-item-description" className="font-bold">Beschreibung</Label>
            <Textarea
              id="case-item-description"
              placeholder="Beschreibung"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Kategorie *</Label>
            <RadioGroup value={category} onValueChange={setCategory} className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => {
                const selected = category === option;
                const id = `category-${option}`;
                return (
                  <label
                    key={option}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option} aria-label={`Kategorie ${option}`} />
                    <span>{option}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Bearbeiter (mehrfach)</Label>
            <div className="flex flex-wrap gap-2">
              {assignees.map((assignee) => {
                const selected = selectedAssigneeIds.includes(assignee.id);
                return (
                  <Button
                    key={assignee.id}
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => {
                      setSelectedAssigneeIds((prev) => selected ? prev.filter((id) => id !== assignee.id) : [...prev, assignee.id]);
                    }}
                  >
                    {assignee.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-bold">Priorität</Label>
            <RadioGroup value={priority} onValueChange={(value) => setPriority(value as NonNullable<CaseItemFormData["priority"]>)} className="flex flex-wrap gap-2">
              {priorityOptions.map((option) => {
                const selected = priority === option.value;
                const id = `priority-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <RadioGroupItem id={id} value={option.value} aria-label={`Priorität ${option.label}`} />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="case-item-received" className="font-bold">Eingangsdatum</Label>
              <Input
                id="case-item-received"
                type="date"
                value={sourceReceivedDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setSourceReceivedDate(value);
                  if (value) {
                    setDueDate(format(addWeeks(new Date(`${value}T12:00:00`), 4), "yyyy-MM-dd"));
                  } else {
                    setDueDate("");
                  }
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-item-due" className="font-bold">Frist</Label>
              <Input
                id="case-item-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !subject.trim() || !sourceReceivedDate || !category || !hasContext}>
            Vorgang erstellen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
