import { useNavigate } from "react-router-dom";
import { CameraIcon, ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, LinkIcon, PlusIcon, TrashIcon, UnlinkIcon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppointmentPreparationTabAppointmentDetails, ContactOption, ConversationPartner, ExpandedSections } from "./types";
import { getPartnerInitials, getPartnerSearchResults } from "./utils";

interface ConversationPartnersCardProps {
  conversationPartners: ConversationPartner[];
  contacts: ContactOption[];
  selectedContactId: string;
  showCustomContact: boolean;
  partnerSearchTexts: Record<string, string>;
  editData: Record<string, unknown>;
  expandedSection: boolean;
  appointmentDetails: AppointmentPreparationTabAppointmentDetails | null;
  onOpenAppointmentDetails?: () => void;
  onToggleSection: () => void;
  onContactSelect: (contactId: string) => void;
  onAddPartner: () => void;
  onSelectContactForPartner: (idx: number, contactId: string) => void;
  onUnlinkContactFromPartner: (idx: number) => void;
  onUpdatePartner: (idx: number, field: keyof ConversationPartner, value: string) => void;
  onRemovePartner: (idx: number) => void;
  onPhotoUpload: (idx: number, file: File | null) => void;
  onPartnerSearchChange: (partnerId: string, value: string) => void;
  onFieldChange: (field: string, value: string) => void;
}

export function ConversationPartnersCard({
  conversationPartners,
  contacts,
  selectedContactId,
  showCustomContact,
  partnerSearchTexts,
  editData,
  expandedSection,
  appointmentDetails,
  onOpenAppointmentDetails,
  onToggleSection,
  onContactSelect,
  onAddPartner,
  onSelectContactForPartner,
  onUnlinkContactFromPartner,
  onUpdatePartner,
  onRemovePartner,
  onPhotoUpload,
  onPartnerSearchChange,
  onFieldChange,
}: ConversationPartnersCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="pt-6">
        <Collapsible
          open={expandedSection}
          onOpenChange={onToggleSection}
        >
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Gesprächspartner</h3>
              {conversationPartners.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {conversationPartners.length}
                </span>
              )}
            </div>
            {expandedSection ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="font-medium">Kontaktinformationen</h4>
                  <p className="text-sm text-muted-foreground">
                    Ansprechpartner und direkte Kontaktdaten für diesen Termin.
                  </p>
                </div>
                {appointmentDetails && onOpenAppointmentDetails && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenAppointmentDetails}
                    className="flex items-center gap-2"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                    Termindetails öffnen
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">Kontakt</label>
                  <Select
                    value={selectedContactId || (showCustomContact ? "custom" : "none")}
                    onValueChange={onContactSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kontakt auswählen oder manuell eingeben" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Kontakt</SelectItem>
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <PlusIcon className="h-4 w-4" />
                          Kontakt manuell eingeben
                        </div>
                      </SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          <div>
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {contact.organization && `${contact.organization} • `}
                              {contact.role}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showCustomContact && (
                  <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Kontaktname</label>
                      <Input
                        value={editData.contact_name as string ?? ""}
                        onChange={(e) => onFieldChange("contact_name", e.target.value)}
                        placeholder="Name des Kontakts"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">Kontaktinformationen</label>
                      <Textarea
                        value={editData.contact_info as string ?? ""}
                        onChange={(e) => onFieldChange("contact_info", e.target.value)}
                        placeholder="E-Mail, Telefon, weitere Informationen..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {conversationPartners.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">Noch keine Gesprächspartner hinzugefügt.</p>
            )}

            {conversationPartners.map((partner, idx) => {
              const isLinked = !!partner.contact_id;
              const searchText = partnerSearchTexts[partner.id] || '';
              const searchResults = getPartnerSearchResults(contacts, partnerSearchTexts, partner.id);

              return (
                <div key={partner.id} className="grid grid-cols-1 gap-3 items-start rounded-lg border bg-muted/20 p-3 md:grid-cols-[auto_1.2fr_1fr_1fr_1fr_auto]">
                  {/* Avatar with hover upload overlay */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground sr-only">Foto</label>
                    <div className="relative group cursor-pointer" onClick={() => document.getElementById(`partner-photo-${partner.id}`)?.click()}>
                      <Avatar className="h-14 w-14 border">
                        <AvatarImage src={partner.avatar_url || undefined} alt={partner.name || "Gesprächspartner"} />
                        <AvatarFallback>{getPartnerInitials(partner.name)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <CameraIcon className="h-5 w-5 text-white" />
                      </div>
                      <Input
                        id={`partner-photo-${partner.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          void onPhotoUpload(idx, e.target.files?.[0] ?? null);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>

                  {/* Name field with autocomplete */}
                  <div className="space-y-1 relative">
                    <label className="text-xs text-muted-foreground">Name</label>
                    {isLinked ? (
                      <div className="flex items-center gap-2">
                        <Input value={partner.name} disabled className="bg-muted/50" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Kontakt öffnen"
                          onClick={() => navigate(`/contacts/${partner.contact_id}`)}
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          title="Kontakt-Verknüpfung lösen"
                          onClick={() => onUnlinkContactFromPartner(idx)}
                        >
                          <UnlinkIcon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          value={searchText || partner.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            onPartnerSearchChange(partner.id, val);
                            onUpdatePartner(idx, 'name', val);
                          }}
                          onFocus={() => {
                            if (!searchText && partner.name) {
                              onPartnerSearchChange(partner.id, partner.name);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              onPartnerSearchChange(partner.id, '');
                            }, 200);
                          }}
                          placeholder="Name eingeben oder Kontakt suchen..."
                        />
                        {searchResults.length > 0 && searchText.length >= 2 && (
                          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
                            {searchResults.map((contact) => (
                              <button
                                key={contact.id}
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onSelectContactForPartner(idx, contact.id);
                                }}
                              >
                                <Avatar className="h-6 w-6 border">
                                  <AvatarImage src={contact.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">{getPartnerInitials(contact.name)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{contact.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {[contact.organization, contact.role || contact.position].filter(Boolean).join(' • ')}
                                  </div>
                                </div>
                                <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Rolle</label>
                    <Input
                      value={partner.role ?? ''}
                      onChange={(e) => onUpdatePartner(idx, 'role', e.target.value)}
                      placeholder="z.B. Geschäftsführung"
                      disabled={isLinked}
                      className={isLinked ? "bg-muted/50" : ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Organisation</label>
                    <Input
                      value={partner.organization ?? ''}
                      onChange={(e) => onUpdatePartner(idx, 'organization', e.target.value)}
                      placeholder="z.B. Verband / Unternehmen"
                      disabled={isLinked}
                      className={isLinked ? "bg-muted/50" : ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hinweis</label>
                    <Input
                      value={partner.note ?? ''}
                      onChange={(e) => onUpdatePartner(idx, 'note', e.target.value)}
                      placeholder="Zusätzlicher Kontext"
                    />
                  </div>
                  <div className="pt-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemovePartner(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={onAddPartner} className="mt-2">
              <PlusIcon className="h-4 w-4 mr-2" />
              Gesprächspartner hinzufügen
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
