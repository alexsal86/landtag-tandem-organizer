import { useEffect, useRef, useState } from "react";
import { addWeeks, format } from "date-fns";
import { Briefcase, Check, ChevronLeft, ChevronRight, Mail, MessageSquare, Phone, UserRound } from "lucide-react";
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
import { LinkedValueChip } from "@/components/my-work/LinkedValueChip";

interface CaseItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
  createCaseItem: ReturnType<typeof useCaseItems>["createCaseItem"];
  assignees: Array<{ id: string; name: string }>;
  defaultAssigneeId: string | null;
  categoryOptions: readonly string[];
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

const priorityOptions = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
  { value: "urgent", label: "Dringend" },
] as const;

const STEPS = [
  { label: "Kanal & Kontakt" },
  { label: "Inhalt" },
  { label: "Einordnung" },
  { label: "Übersicht" },
] as const;

function WizardStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-2 pb-4">
      {STEPS.map((step, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mx-2 mt-[-12px] ${isDone ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CaseItemCreateDialog({ open, onOpenChange, onCreated, createCaseItem, assignees, defaultAssigneeId, categoryOptions }: CaseItemCreateDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [step, setStep] = useState(1);
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
      setStep(1);
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
      setSubmitError(null);
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

  const canAdvance = (s: number): boolean => {
    if (s === 2) return subject.trim().length > 0;
    if (s === 3) return category.length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 4 && canAdvance(step)) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
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
    onOpenChange(false);
  };

  const channelLabel = sourceChannelOptions.find(o => o.value === sourceChannel)?.label ?? sourceChannel;
  const priorityLabel = priorityOptions.find(o => o.value === priority)?.label ?? priority;
  const clearSelectedContact = () => {
    setSelectedContactId(null);
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,640px)] max-w-[min(96vw,640px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neuer Vorgang</DialogTitle>
        </DialogHeader>

        <WizardStepper currentStep={step} />

        {!hasContext && (
          <p className="text-sm text-destructive">
            Kein aktiver Mandanten-/Sitzungskontext vorhanden. Bitte neu anmelden oder Mandant auswählen.
          </p>
        )}

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        {/* Step 1: Kanal & Kontakt */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">Kanal</Label>
              <RadioGroup value={sourceChannel} onValueChange={(value) => setSourceChannel(value as CaseItemFormData["source_channel"])} className="flex flex-wrap gap-2">
                {sourceChannelOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = sourceChannel === option.value;
                  const id = `source-channel-${option.value}`;
                  return (
                    <label
                      key={option.value}
                      htmlFor={id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <RadioGroupItem id={id} value={option.value} aria-label={`Kanal ${option.label}`} />
                      <Icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-item-contact-name" className="font-bold">Von / Gesprächspartner</Label>

              <div className="space-y-2">
                {selectedContactId ? (
                  <LinkedValueChip
                    label="Verknüpfter Kontakt"
                    value={contactName}
                    onRemove={clearSelectedContact}
                    className="w-full justify-between"
                  />
                ) : (
                  <>
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
                            clearSelectedContact();
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
                    <p className="text-xs text-muted-foreground">Ab 2 Zeichen wird in den Kontakten gesucht.</p>
                  </>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="case-item-contact-email" className="text-xs font-semibold text-muted-foreground">E-Mail</Label>
                  {selectedContactId && contactEmail ? (
                    <LinkedValueChip label="E-Mail" value={contactEmail} onRemove={() => setContactEmail("")} className="w-full justify-between" />
                  ) : (
                    <Input
                      id="case-item-contact-email"
                      placeholder="E-Mail-Adresse"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="case-item-contact-phone" className="text-xs font-semibold text-muted-foreground">Telefon</Label>
                  {selectedContactId && contactPhone ? (
                    <LinkedValueChip label="Telefon" value={contactPhone} onRemove={() => setContactPhone("")} className="w-full justify-between" />
                  ) : (
                    <Input
                      id="case-item-contact-phone"
                      placeholder="Telefonnummer"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="case-item-visible-to-all" className="font-bold">Öffentlich</Label>
                <p className="text-xs text-muted-foreground">Alle Mitglieder des Mandanten dürfen den Vorgang lesen.</p>
              </div>
              <Switch id="case-item-visible-to-all" checked={visibleToAll} onCheckedChange={setVisibleToAll} />
            </div>
          </div>
        )}

        {/* Step 2: Inhalt */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="case-item-subject" className="font-bold">Betreff *</Label>
              <Input
                id="case-item-subject"
                placeholder="Kurzer Betreff"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                autoFocus
              />
              {!subject.trim() && (
                <p className="text-xs text-muted-foreground">Pflichtfeld – bitte Betreff eingeben.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-item-description" className="font-bold">Beschreibung</Label>
              <Textarea
                id="case-item-description"
                placeholder="Beschreibung"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
              />
            </div>
          </div>
        )}

        {/* Step 3: Einordnung & Zuweisung */}
        {step === 3 && (
          <div className="space-y-4 py-2">
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
              {!category && (
                <p className="text-xs text-muted-foreground">Pflichtfeld – bitte Kategorie wählen.</p>
              )}
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
          </div>
        )}

        {/* Step 4: Termine & Übersicht */}
        {step === 4 && (
          <div className="space-y-4 py-2">
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

            {/* Summary card */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Zusammenfassung</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Kanal</span>
                <span>{channelLabel}</span>
                {contactName.trim() && (
                  <>
                    <span className="text-muted-foreground">Kontakt</span>
                    <span>{contactName}{selectedContactId ? " ✓" : ""}</span>
                  </>
                )}
                <span className="text-muted-foreground">Betreff</span>
                <span className="font-medium">{subject}</span>
                {description.trim() && (
                  <>
                    <span className="text-muted-foreground">Beschreibung</span>
                    <span className="truncate">{description.length > 60 ? `${description.slice(0, 60)}…` : description}</span>
                  </>
                )}
                <span className="text-muted-foreground">Kategorie</span>
                <span>{category}</span>
                <span className="text-muted-foreground">Priorität</span>
                <span>{priorityLabel}</span>
                {selectedAssigneeIds.length > 0 && (
                  <>
                    <span className="text-muted-foreground">Bearbeiter</span>
                    <span>{assignees.filter(a => selectedAssigneeIds.includes(a.id)).map(a => a.name).join(", ")}</span>
                  </>
                )}
                <span className="text-muted-foreground">Sichtbarkeit</span>
                <span>{visibleToAll ? "Öffentlich" : "Privat"}</span>
                <span className="text-muted-foreground">Eingang</span>
                <span>{sourceReceivedDate}</span>
                {dueDate && (
                  <>
                    <span className="text-muted-foreground">Frist</span>
                    <span>{dueDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleBack} disabled={submitting}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Abbrechen
            </Button>
            {step < 4 ? (
              <Button onClick={handleNext} disabled={!canAdvance(step)}>
                Weiter
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !subject.trim() || !sourceReceivedDate || !category || !hasContext}>
                {submitting ? "Erstelle…" : "Vorgang erstellen"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
