import { useState, useCallback, useEffect, useRef, useMemo, type KeyboardEvent } from "react";
import { debugConsole } from "@/utils/debugConsole";
import { CardTitle } from "@/components/ui/card";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CalendarIcon, CarIcon, ChevronDownIcon, ChevronRightIcon,
  ClockIcon, MapIcon, MessageSquareIcon, TagIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AppointmentPreparation, AppointmentConversationPartner, getConversationPartnersFromPreparationData } from "@/hooks/useAppointmentPreparation";
import { debounce } from "@/utils/debounce";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { compressImageForAvatar } from "@/utils/imageCompression";
import {
  getPreparationDataWithDefaults,
  VISIT_REASON_OPTIONS,
} from "./appointment-preparation-data/constants";
import { getContactDetails } from "./appointment-preparation-data/utils";
import { getStatusBadge } from "./appointment-preparation-data/StatusBadge";
import { ConversationPartnersCard } from "./appointment-preparation-data/ConversationPartnersCard";
import { CompanionsCard } from "./appointment-preparation-data/CompanionsCard";
import { ProgramCard } from "./appointment-preparation-data/ProgramCard";
import { PreparationDataCards } from "./appointment-preparation-data/PreparationDataCards";
import type {
  AppointmentPreparationDataTabProps,
  Companion,
  ContactOption,
  ConversationPartner,
  ExpandedSections,
  ExtendedAppointmentPreparation,
  ProgramRow,
  QAPair,
  TalkingPointItem,
  TopicItem,
} from "./appointment-preparation-data/types";

export function AppointmentPreparationDataTab({
  preparation,
  appointmentDetails,
  onUpdate,
  onOpenAppointmentDetails,
}: AppointmentPreparationDataTabProps) {
  const extendedPreparation = preparation as ExtendedAppointmentPreparation;
  const preparationDataWithDefaults = getPreparationDataWithDefaults(preparation.preparation_data);

  const [editData, setEditData] = useState<Record<string, unknown>>({
    ...preparationDataWithDefaults,
    contact_name: extendedPreparation.contact_name || "",
    contact_info: extendedPreparation.contact_info || "",
    briefing_notes: preparationDataWithDefaults.briefing_notes || preparation.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    anlass: true,
    gespraechspartner: true,
    begleitpersonen: true,
    logistik: true,
    programm: true,
    basics: false,
    people: false,
    materials: false,
    communication: false,
    framework: false,
  });

  const [conversationPartners, setConversationPartners] = useState<ConversationPartner[]>(
    getConversationPartnersFromPreparationData(preparationDataWithDefaults),
  );
  const [companions, setCompanions] = useState<Companion[]>(
    preparationDataWithDefaults.companions ?? [],
  );
  const [hasParking, setHasParking] = useState<boolean>(
    preparationDataWithDefaults.has_parking ?? false,
  );
  const [programRows, setProgramRows] = useState<ProgramRow[]>(
    preparationDataWithDefaults.program ?? [],
  );
  const [visitReason, setVisitReason] = useState<string>(
    preparationDataWithDefaults.visit_reason ?? '',
  );
  const [qaPairs, setQaPairs] = useState<QAPair[]>(
    preparationDataWithDefaults.qa_pairs ?? [],
  );
  const [keyTopicItems, setKeyTopicItems] = useState<TopicItem[]>(
    preparationDataWithDefaults.key_topic_items ?? [],
  );
  const [talkingPointItems, setTalkingPointItems] = useState<TalkingPointItem[]>(
    preparationDataWithDefaults.talking_point_items ?? [],
  );
  const [partnerSearchTexts, setPartnerSearchTexts] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showCustomContact, setShowCustomContact] = useState(false);

  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );

  useEffect(() => {
    void fetchContacts();

    if (extendedPreparation.contact_name && extendedPreparation.contact_info) {
      setShowCustomContact(true);
    } else if (extendedPreparation.contact_id) {
      setSelectedContactId(extendedPreparation.contact_id);
    }
  }, [preparation.appointment_id, currentTenant, extendedPreparation.contact_id, extendedPreparation.contact_info, extendedPreparation.contact_name]);

  const lastSyncedId = useRef(preparation.id);
  useEffect(() => {
    if (preparation.id !== lastSyncedId.current) {
      lastSyncedId.current = preparation.id;
      const nextPreparationData = getPreparationDataWithDefaults(preparation.preparation_data);
      setEditData({
        ...nextPreparationData,
        contact_name: nextPreparationData.contact_name || "",
        contact_info: nextPreparationData.contact_info || "",
        briefing_notes: nextPreparationData.briefing_notes || preparation.notes || "",
      } as Record<string, unknown>);
      setConversationPartners(getConversationPartnersFromPreparationData(nextPreparationData));
      setCompanions(nextPreparationData.companions ?? []);
      setHasParking(nextPreparationData.has_parking ?? false);
      setProgramRows(nextPreparationData.program ?? []);
      setVisitReason(nextPreparationData.visit_reason ?? '');
      setQaPairs(nextPreparationData.qa_pairs ?? []);
      setKeyTopicItems(nextPreparationData.key_topic_items ?? []);
      setTalkingPointItems(nextPreparationData.talking_point_items ?? []);

      if (nextPreparationData.contact_name && nextPreparationData.contact_info) {
        setShowCustomContact(true);
      } else if (nextPreparationData.contact_id) {
        setSelectedContactId(nextPreparationData.contact_id);
      }
    }
  }, [preparation]);

  const fetchContacts = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, role, position, organization, notes, avatar_url')
        .eq('tenant_id', currentTenant.id)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      debugConsole.error("Error fetching contacts:", error);
    }
  };

  const buildPreparationData = (
    base: Record<string, unknown>,
    overrides?: Partial<AppointmentPreparation['preparation_data']>,
  ): AppointmentPreparation['preparation_data'] => ({
    ...base,
    social_media_planned: overrides?.social_media_planned ?? (base.social_media_planned as boolean) ?? false,
    press_planned: overrides?.press_planned ?? (base.press_planned as boolean) ?? false,
    visit_reason: (overrides?.visit_reason ?? visitReason) as AppointmentPreparation['preparation_data']['visit_reason'],
    conversation_partners: overrides?.conversation_partners ?? conversationPartners,
    companions: overrides?.companions ?? companions,
    has_parking: overrides?.has_parking ?? hasParking,
    program: overrides?.program ?? programRows,
    qa_pairs: overrides?.qa_pairs ?? qaPairs,
    key_topic_items: overrides?.key_topic_items ?? keyTopicItems,
    talking_point_items: overrides?.talking_point_items ?? talkingPointItems,
  });

  const debouncedSave = useCallback(
    debounce(async (data: AppointmentPreparation['preparation_data']) => {
      try {
        setSaving(true);
        await onUpdate({ preparation_data: data });
      } catch (error) {
        debugConsole.error("Error saving preparation data:", error);
        toast({
          title: "Fehler",
          description: "Fehler beim Speichern der Änderungen.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    }, 2000),
    [onUpdate],
  );

  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...editData, [field]: value };
    setEditData(newData);
    debouncedSave(buildPreparationData(newData));
  };

  const handleBooleanFieldChange = (field: 'social_media_planned' | 'press_planned', checked: boolean) => {
    const newData = { ...editData, [field]: checked };
    setEditData(newData);
    debouncedSave(buildPreparationData(newData, { [field]: checked }));
  };

  const toggleSection = (section: keyof ExpandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleVisitReasonChange = (value: string) => {
    const newReason = visitReason === value ? '' : value;
    setVisitReason(newReason);
    debouncedSave(buildPreparationData(editData, { visit_reason: newReason as AppointmentPreparation['preparation_data']['visit_reason'] }));
  };

  // --- Conversation partner handlers ---
  const addConversationPartner = () => {
    const newPartner: ConversationPartner = { id: crypto.randomUUID(), name: '', avatar_url: '', role: '', organization: '', note: '' };
    const updated = [...conversationPartners, newPartner];
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }));
  };

  const selectContactForPartner = (idx: number, contactId: string) => {
    const contact = contactsById.get(contactId);
    if (!contact) return;
    const updated = conversationPartners.map((partner, i) =>
      i === idx ? { ...partner, name: contact.name, avatar_url: contact.avatar_url || '', role: contact.role || contact.position || '', organization: contact.organization || '', note: contact.notes || partner.note || '', contact_id: contactId } : partner,
    );
    setConversationPartners(updated);
    setPartnerSearchTexts((prev) => ({ ...prev, [conversationPartners[idx].id]: '' }));
    debouncedSave(buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }));
  };

  const unlinkContactFromPartner = (idx: number) => {
    const updated = conversationPartners.map((partner, i) => i === idx ? { ...partner, contact_id: undefined } : partner);
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }));
  };

  const updateConversationPartner = (idx: number, field: keyof ConversationPartner, value: string) => {
    const updated = conversationPartners.map((partner, i) => i === idx ? { ...partner, [field]: value } : partner);
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }));
  };

  const removeConversationPartner = (idx: number) => {
    const updated = conversationPartners.filter((_, i) => i !== idx);
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }));
  };

  const handleConversationPartnerPhotoUpload = async (idx: number, file: File | null) => {
    if (!file || !user) return;

    try {
      setSaving(true);
      const partner = conversationPartners[idx];
      const compressedBlob = await compressImageForAvatar(file);
      const extension = compressedBlob.type === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${user.id}/appointment-partners/${preparation.id}/${partner.id}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedBlob, { cacheControl: '3600', upsert: true, contentType: compressedBlob.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const updated = conversationPartners.map((entry, entryIdx) => entryIdx === idx ? { ...entry, avatar_url: avatarUrl } : entry);

      setConversationPartners(updated);
      await onUpdate({ preparation_data: buildPreparationData(editData, { conversation_partners: updated, contact_person: undefined }) });
      toast({ title: "Foto hochgeladen", description: "Das Foto wurde dem Gesprächspartner zugeordnet." });
    } catch (error) {
      debugConsole.error("Error uploading conversation partner photo:", error);
      toast({ title: "Fehler", description: "Das Foto konnte nicht hochgeladen werden.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleContactSelect = (contactId: string) => {
    if (contactId === "custom") {
      setShowCustomContact(true);
      setSelectedContactId("");
      const newData = { ...editData, contact_name: "", contact_info: "", contact_id: undefined };
      setEditData(newData);
      debouncedSave(buildPreparationData(newData));
    } else if (contactId === "none") {
      setShowCustomContact(false);
      setSelectedContactId("");
      const newData = { ...editData, contact_name: "", contact_info: "", contact_id: undefined };
      setEditData(newData);
      debouncedSave(buildPreparationData(newData));
    } else {
      setShowCustomContact(false);
      setSelectedContactId(contactId);
      const selectedContact = contactsById.get(contactId);
      if (selectedContact) {
        const { contact_name, contact_info } = getContactDetails(selectedContact);
        const newData = { ...editData, contact_name: contact_name || "", contact_info: contact_info || "", contact_id: contactId };
        setEditData(newData);
        debouncedSave(buildPreparationData(newData));
      }
    }
  };

  // --- Companion handlers ---
  const addCompanion = () => {
    const updated = [...companions, { id: crypto.randomUUID(), name: '', type: 'mitarbeiter', note: '' } as Companion];
    setCompanions(updated);
    debouncedSave(buildPreparationData(editData, { companions: updated }));
  };
  const updateCompanion = (idx: number, field: keyof Companion, value: string) => {
    const updated = companions.map((c, i) => i === idx ? { ...c, [field]: value } : c);
    setCompanions(updated);
    debouncedSave(buildPreparationData(editData, { companions: updated }));
  };
  const removeCompanion = (idx: number) => {
    const updated = companions.filter((_, i) => i !== idx);
    setCompanions(updated);
    debouncedSave(buildPreparationData(editData, { companions: updated }));
  };

  // --- Parking handler ---
  const handleParkingChange = (checked: boolean) => {
    setHasParking(checked);
    debouncedSave(buildPreparationData(editData, { has_parking: checked }));
  };

  // --- Program handlers ---
  const addProgramRow = () => {
    const updated = [...programRows, { id: crypto.randomUUID(), time: '', item: '', notes: '' } as ProgramRow];
    setProgramRows(updated);
    debouncedSave(buildPreparationData(editData, { program: updated }));
  };
  const updateProgramRow = (idx: number, field: keyof ProgramRow, value: string) => {
    const updated = programRows.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setProgramRows(updated);
    debouncedSave(buildPreparationData(editData, { program: updated }));
  };
  const removeProgramRow = (idx: number) => {
    const updated = programRows.filter((_, i) => i !== idx);
    setProgramRows(updated);
    debouncedSave(buildPreparationData(editData, { program: updated }));
  };

  // --- Q&A handlers ---
  const addQaPair = () => {
    const updated = [...qaPairs, { id: crypto.randomUUID(), question: '', answer: '' } as QAPair];
    setQaPairs(updated);
    debouncedSave(buildPreparationData(editData, { qa_pairs: updated }));
  };
  const updateQaPair = (idx: number, field: 'question' | 'answer', value: string) => {
    const updated = qaPairs.map((p, i) => i === idx ? { ...p, [field]: value } : p);
    setQaPairs(updated);
    debouncedSave(buildPreparationData(editData, { qa_pairs: updated }));
  };
  const removeQaPair = (idx: number) => {
    const updated = qaPairs.filter((_, i) => i !== idx);
    setQaPairs(updated);
    debouncedSave(buildPreparationData(editData, { qa_pairs: updated }));
  };

  // --- Key topic handlers ---
  const addKeyTopicItem = () => {
    const updated = [...keyTopicItems, { id: crypto.randomUUID(), topic: '', background: '' } as TopicItem];
    setKeyTopicItems(updated);
    debouncedSave(buildPreparationData(editData, { key_topic_items: updated }));
  };
  const updateKeyTopicItem = (idx: number, field: 'topic' | 'background', value: string) => {
    const updated = keyTopicItems.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setKeyTopicItems(updated);
    debouncedSave(buildPreparationData(editData, { key_topic_items: updated }));
  };
  const removeKeyTopicItem = (idx: number) => {
    const updated = keyTopicItems.filter((_, i) => i !== idx);
    setKeyTopicItems(updated);
    debouncedSave(buildPreparationData(editData, { key_topic_items: updated }));
  };
  const handleKeyTopicKeyDown = (e: KeyboardEvent<HTMLInputElement>, _idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addKeyTopicItem(); }
  };

  // --- Talking point handlers ---
  const addTalkingPointItem = () => {
    const updated = [...talkingPointItems, { id: crypto.randomUUID(), point: '', background: '' } as TalkingPointItem];
    setTalkingPointItems(updated);
    debouncedSave(buildPreparationData(editData, { talking_point_items: updated }));
  };
  const updateTalkingPointItem = (idx: number, field: 'point' | 'background', value: string) => {
    const updated = talkingPointItems.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setTalkingPointItems(updated);
    debouncedSave(buildPreparationData(editData, { talking_point_items: updated }));
  };
  const removeTalkingPointItem = (idx: number) => {
    const updated = talkingPointItems.filter((_, i) => i !== idx);
    setTalkingPointItems(updated);
    debouncedSave(buildPreparationData(editData, { talking_point_items: updated }));
  };
  const handleTalkingPointKeyDown = (e: KeyboardEvent<HTMLInputElement>, _idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTalkingPointItem(); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl">
            Vorbereitung: {appointmentDetails?.title || preparation.title || "Termin"}
          </CardTitle>
          <div className="mt-1 flex items-center gap-2">
            {getStatusBadge(preparation.status)}
            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
                Speichert...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. Gesprächspartner */}
        <ConversationPartnersCard
          conversationPartners={conversationPartners}
          contacts={contacts}
          selectedContactId={selectedContactId}
          showCustomContact={showCustomContact}
          partnerSearchTexts={partnerSearchTexts}
          editData={editData}
          expandedSection={expandedSections.gespraechspartner}
          appointmentDetails={appointmentDetails}
          onOpenAppointmentDetails={onOpenAppointmentDetails}
          onToggleSection={() => toggleSection('gespraechspartner')}
          onContactSelect={handleContactSelect}
          onAddPartner={addConversationPartner}
          onSelectContactForPartner={selectContactForPartner}
          onUnlinkContactFromPartner={unlinkContactFromPartner}
          onUpdatePartner={updateConversationPartner}
          onRemovePartner={removeConversationPartner}
          onPhotoUpload={handleConversationPartnerPhotoUpload}
          onPartnerSearchChange={(partnerId, value) => setPartnerSearchTexts((prev) => ({ ...prev, [partnerId]: value }))}
          onFieldChange={handleFieldChange}
        />

        {/* 2. Anlass des Besuchs */}
        <Card>
          <CardContent className="pt-6">
            <Collapsible open={expandedSections.anlass} onOpenChange={() => toggleSection('anlass')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <TagIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Anlass des Besuchs</h3>
                  {visitReason && (
                    <Badge variant="secondary" className="text-xs">
                      {VISIT_REASON_OPTIONS.find((o) => o.value === visitReason)?.label ?? visitReason}
                    </Badge>
                  )}
                </div>
                {expandedSections.anlass ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="space-y-4 px-1">
                  <div className="flex flex-wrap gap-3">
                    {VISIT_REASON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleVisitReasonChange(option.value)}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${visitReason === option.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Freifeld zum Anlass</label>
                    <Textarea
                      value={(editData.visit_reason_details as string) ?? ''}
                      onChange={(e) => handleFieldChange('visit_reason_details', e.target.value)}
                      placeholder="Weitere Details zum Anlass des Besuchs"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* 3. Begleitpersonen */}
        <CompanionsCard
          companions={companions}
          expandedSection={expandedSections.begleitpersonen}
          onToggleSection={() => toggleSection('begleitpersonen')}
          onAdd={addCompanion}
          onUpdate={updateCompanion}
          onRemove={removeCompanion}
        />

        {/* 4. Logistik */}
        <Card>
          <CardContent className="pt-6">
            <Collapsible open={expandedSections.logistik} onOpenChange={() => toggleSection('logistik')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <CarIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-medium">Logistik & Anreise</h3>
                </div>
                {expandedSections.logistik ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      Fahrtzeit
                    </label>
                    <Input value={(editData.travel_time as string) ?? ''} onChange={(e) => handleFieldChange('travel_time', e.target.value)} placeholder="z.B. 45 Minuten" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <MapIcon className="h-4 w-4 text-muted-foreground" />
                      PKW-Stellplatz
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <Switch id="has-parking" checked={hasParking} onCheckedChange={handleParkingChange} />
                      <Label htmlFor="has-parking" className="text-sm">{hasParking ? 'Parkplatz vorhanden' : 'Kein Parkplatz'}</Label>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      Folgetermin / Rückfahrt
                    </label>
                    <Textarea value={(editData.follow_up as string) ?? ''} onChange={(e) => handleFieldChange('follow_up', e.target.value)} placeholder="Was passiert nach dem Termin? Rückfahrt, nächster Termin, Nachbereitung..." rows={3} className="resize-none" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* 5. Öffentlichkeitsarbeit */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <MessageSquareIcon className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-medium">Öffentlichkeitsarbeit</h3>
                  <p className="text-sm text-muted-foreground">Planung für Social Media und Presse rund um den Termin.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="social-media-planned" className="text-sm font-medium">Social Media geplant</Label>
                    <p className="text-sm text-muted-foreground">Markiert, ob Beiträge oder Begleitung auf Social Media vorgesehen sind.</p>
                  </div>
                  <Switch id="social-media-planned" checked={(editData.social_media_planned as boolean) ?? false} onCheckedChange={(checked) => handleBooleanFieldChange('social_media_planned', checked)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="press-planned" className="text-sm font-medium">Presse geplant</Label>
                    <p className="text-sm text-muted-foreground">Markiert, ob Pressearbeit oder Pressebegleitung eingeplant ist.</p>
                  </div>
                  <Switch id="press-planned" checked={(editData.press_planned as boolean) ?? false} onCheckedChange={(checked) => handleBooleanFieldChange('press_planned', checked)} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Programm */}
        <ProgramCard
          programRows={programRows}
          expandedSection={expandedSections.programm}
          onToggleSection={() => toggleSection('programm')}
          onAdd={addProgramRow}
          onUpdate={updateProgramRow}
          onRemove={removeProgramRow}
        />

        {/* 7 & 8. Vorbereitungsdaten */}
        <PreparationDataCards
          qaPairs={qaPairs}
          keyTopicItems={keyTopicItems}
          talkingPointItems={talkingPointItems}
          editData={editData}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          onFieldChange={handleFieldChange}
          onAddQaPair={addQaPair}
          onUpdateQaPair={updateQaPair}
          onRemoveQaPair={removeQaPair}
          onAddKeyTopicItem={addKeyTopicItem}
          onUpdateKeyTopicItem={updateKeyTopicItem}
          onRemoveKeyTopicItem={removeKeyTopicItem}
          onKeyTopicKeyDown={handleKeyTopicKeyDown}
          onAddTalkingPointItem={addTalkingPointItem}
          onUpdateTalkingPointItem={updateTalkingPointItem}
          onRemoveTalkingPointItem={removeTalkingPointItem}
          onTalkingPointKeyDown={handleTalkingPointKeyDown}
        />
      </div>
    </div>
  );
}
