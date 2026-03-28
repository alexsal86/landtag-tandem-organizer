import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debugConsole } from "@/utils/debugConsole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarIcon, ClockIcon, UsersIcon, PlusIcon,
  ExternalLinkIcon, FileTextIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon,
  MessageSquareIcon, SettingsIcon, CheckCircleIcon, CarIcon, MapIcon, ClipboardListIcon,
  TagIcon, TrashIcon, CameraIcon, LinkIcon, UnlinkIcon
} from "lucide-react";
import { AppointmentPreparation, AppointmentConversationPartner, getConversationPartnersFromPreparationData } from "@/hooks/useAppointmentPreparation";
import { debounce } from "@/utils/debounce";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { compressImageForAvatar } from "@/utils/imageCompression";
import type { EventPayloadStatus } from "@/components/event-planning/types";

type ConversationPartner = AppointmentConversationPartner;
type Companion = NonNullable<AppointmentPreparation['preparation_data']['companions']>[number];
type ProgramRow = NonNullable<AppointmentPreparation['preparation_data']['program']>[number];
type QAPair = { id: string; question: string; answer: string };
type TopicItem = { id: string; topic: string; background: string };
type TalkingPointItem = { id: string; point: string; background: string };
type ContactOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  position: string | null;
  organization: string | null;
  notes: string | null;
  avatar_url: string | null;
};

interface ExtendedAppointmentPreparation extends AppointmentPreparation {
  contact_name?: string;
  contact_info?: string;
  contact_id?: string;
}

interface AppointmentPreparationTabAppointmentDetails {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
}

interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  appointmentDetails: AppointmentPreparationTabAppointmentDetails | null;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
  onOpenAppointmentDetails?: () => void;
}

const VISIT_REASON_OPTIONS = [
  { value: 'einladung', label: 'Einladung der Person/Einrichtung' },
  { value: 'eigeninitiative', label: 'Eigeninitiative' },
  { value: 'fraktionsarbeit', label: 'Fraktionsarbeit' },
  { value: 'pressetermin', label: 'Pressetermin' },
] as const;

const COMPANION_TYPE_OPTIONS = [
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'fraktion', label: 'Fraktion' },
  { value: 'partei', label: 'Partei' },
  { value: 'presse', label: 'Presse' },
  { value: 'sonstige', label: 'Sonstige' },
] as const;

const getPreparationDataWithDefaults = (
  preparationData: AppointmentPreparation['preparation_data']
) => ({
  ...preparationData,
  social_media_planned: preparationData.social_media_planned ?? false,
  press_planned: preparationData.press_planned ?? false,
});

export function AppointmentPreparationDataTab({
  preparation,
  appointmentDetails,
  onUpdate,
  onOpenAppointmentDetails
}: AppointmentPreparationDataTabProps) {
  const navigate = useNavigate();
  const extendedPreparation = preparation as ExtendedAppointmentPreparation;
  const preparationDataWithDefaults = getPreparationDataWithDefaults(preparation.preparation_data);

  const [editData, setEditData] = useState<Record<string, any>>({
    ...preparationDataWithDefaults,
    contact_name: (extendedPreparation.contact_name || ""),
    contact_info: (extendedPreparation.contact_info || ""),
    briefing_notes: (preparationDataWithDefaults.briefing_notes || preparation.notes || "")
  });
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    anlass: true,
    gespraechspartner: true,
    begleitpersonen: true,
    logistik: true,
    programm: true,
    basics: false,
    people: false,
    materials: false,
    communication: false,
    framework: false
  });

  // Local state for complex fields
  const [conversationPartners, setConversationPartners] = useState<ConversationPartner[]>(
    getConversationPartnersFromPreparationData(preparationDataWithDefaults)
  );
  const [companions, setCompanions] = useState<Companion[]>(
    preparationDataWithDefaults.companions ?? []
  );
  const [hasParking, setHasParking] = useState<boolean>(
    preparationDataWithDefaults.has_parking ?? false
  );
  const [programRows, setProgramRows] = useState<ProgramRow[]>(
    preparationDataWithDefaults.program ?? []
  );
  const [visitReason, setVisitReason] = useState<string>(
    preparationDataWithDefaults.visit_reason ?? ''
  );
  const [qaPairs, setQaPairs] = useState<QAPair[]>(
    preparationDataWithDefaults.qa_pairs ?? []
  );
  const [keyTopicItems, setKeyTopicItems] = useState<TopicItem[]>(
    preparationDataWithDefaults.key_topic_items ?? []
  );
  const [talkingPointItems, setTalkingPointItems] = useState<TalkingPointItem[]>(
    preparationDataWithDefaults.talking_point_items ?? []
  );
  const [partnerSearchTexts, setPartnerSearchTexts] = useState<Record<string, string>>({});

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedPartnerContactId, setSelectedPartnerContactId] = useState<string>("");
  const [showCustomContact, setShowCustomContact] = useState(false);
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const contactsById = useMemo(
    () => new Map(contacts.map(contact => [contact.id, contact])),
    [contacts]
  );

  useEffect(() => {
    void fetchContacts();

    if (extendedPreparation.contact_name && extendedPreparation.contact_info) {
      setShowCustomContact(true);
    } else if (extendedPreparation.contact_id) {
      setSelectedContactId(extendedPreparation.contact_id);
    }
  }, [preparation.appointment_id, currentTenant, extendedPreparation.contact_id, extendedPreparation.contact_info, extendedPreparation.contact_name]);

  // Only sync from props on initial load or when the preparation ID changes
  // (not after our own optimistic saves)
  const lastSyncedId = useRef(preparation.id);
  useEffect(() => {
    if (preparation.id !== lastSyncedId.current) {
      lastSyncedId.current = preparation.id;
      const nextPreparationData = getPreparationDataWithDefaults(preparation.preparation_data);
      setEditData({
        ...nextPreparationData,
        contact_name: nextPreparationData.contact_name || "",
        contact_info: nextPreparationData.contact_info || "",
        briefing_notes: nextPreparationData.briefing_notes || preparation.notes || ""
      } as Record<string, any>);
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

  // Build full preparation_data for saving
  const buildPreparationData = (
    base: Record<string, any>,
    overrides?: Partial<AppointmentPreparation['preparation_data']>
  ): AppointmentPreparation['preparation_data'] => ({
    ...base,
    social_media_planned: overrides?.social_media_planned ?? base.social_media_planned ?? false,
    press_planned: overrides?.press_planned ?? base.press_planned ?? false,
    visit_reason: (overrides?.visit_reason ?? visitReason) as any,
    conversation_partners: overrides?.conversation_partners ?? conversationPartners,
    companions: overrides?.companions ?? companions,
    has_parking: overrides?.has_parking ?? hasParking,
    program: overrides?.program ?? programRows,
    qa_pairs: overrides?.qa_pairs ?? qaPairs,
    key_topic_items: overrides?.key_topic_items ?? keyTopicItems,
    talking_point_items: overrides?.talking_point_items ?? talkingPointItems,
  });


  const getContactDetails = (contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }) => {
    if (!contact) {
      return {
        contact_name: undefined,
        contact_info: undefined,
      };
    }

    const contactInfo = `${contact.email || ""}${contact.phone ? ` | ${contact.phone}` : ""}`
      .trim()
      .replace(/^\|/, '')
      .trim();

    return {
      contact_name: contact.name || undefined,
      contact_info: contactInfo || undefined,
    };
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
        const newData = {
          ...editData,
          contact_name: contact_name || "",
          contact_info: contact_info || "",
          contact_id: contactId
        };
        setEditData(newData);
        debouncedSave(buildPreparationData(newData));
      }
    }
  };

  const getStatusBadge = (status: EventPayloadStatus | string) => {
    if (status === "draft") {
      return null;
    }

    const statusColors = {
      draft: "secondary",
      in_progress: "default",
      completed: "default"
    } as const;

    const statusLabels = {
      draft: "Entwurf",
      in_progress: "In Bearbeitung",
      completed: "Abgeschlossen"
    } as const;

    return (
      <Badge variant={statusColors[status as keyof typeof statusColors] || "secondary"}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </Badge>
    );
  };

  const handleOpenAppointment = () => {
    if (appointmentDetails && onOpenAppointmentDetails) {
      onOpenAppointmentDetails();
    }
  };

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
    [onUpdate]
  );

  const handleFieldChange = (field: string, value: string) => {
    const newData = { ...editData, [field]: value };
    setEditData(newData);
    debouncedSave(buildPreparationData(newData));
  };

  const handleBooleanFieldChange = (
    field: 'social_media_planned' | 'press_planned',
    checked: boolean
  ) => {
    const newData = { ...editData, [field]: checked };
    setEditData(newData);
    debouncedSave(buildPreparationData(newData, { [field]: checked }));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // --- Visit Reason handlers ---
  const handleVisitReasonChange = (value: string) => {
    const newReason = visitReason === value ? '' : value;
    setVisitReason(newReason);
    debouncedSave(buildPreparationData(editData, { visit_reason: newReason as any }));
  };

  // --- Conversation partner handlers ---
  const addConversationPartner = () => {
    const newPartner: ConversationPartner = {
      id: crypto.randomUUID(),
      name: '',
      avatar_url: '',
      role: '',
      organization: '',
      note: ''
    };
    const updated = [...conversationPartners, newPartner];
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, {
      conversation_partners: updated,
      contact_person: undefined
    }));
  };

  const selectContactForPartner = (idx: number, contactId: string) => {
    const contact = contactsById.get(contactId);
    if (!contact) return;
    const updated = conversationPartners.map((partner, i) =>
      i === idx ? {
        ...partner,
        name: contact.name,
        avatar_url: contact.avatar_url || '',
        role: contact.role || contact.position || '',
        organization: contact.organization || '',
        note: contact.notes || partner.note || '',
        contact_id: contactId,
      } : partner
    );
    setConversationPartners(updated);
    setPartnerSearchTexts(prev => ({ ...prev, [conversationPartners[idx].id]: '' }));
    debouncedSave(buildPreparationData(editData, {
      conversation_partners: updated,
      contact_person: undefined
    }));
  };

  const unlinkContactFromPartner = (idx: number) => {
    const updated = conversationPartners.map((partner, i) =>
      i === idx ? { ...partner, contact_id: undefined } : partner
    );
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, {
      conversation_partners: updated,
      contact_person: undefined
    }));
  };

  const getPartnerSearchResults = (partnerId: string) => {
    const searchText = partnerSearchTexts[partnerId] || '';
    if (searchText.length < 2) return [];
    const lower = searchText.toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(lower)).slice(0, 8);
  };

  const updateConversationPartner = (idx: number, field: keyof ConversationPartner, value: string) => {
    const updated = conversationPartners.map((partner, i) => i === idx ? { ...partner, [field]: value } : partner);
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, {
      conversation_partners: updated,
      contact_person: undefined
    }));
  };

  const removeConversationPartner = (idx: number) => {
    const updated = conversationPartners.filter((_, i) => i !== idx);
    setConversationPartners(updated);
    debouncedSave(buildPreparationData(editData, {
      conversation_partners: updated,
      contact_person: undefined
    }));
  };

  const getPartnerInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || '?';

  const handleConversationPartnerPhotoUpload = async (idx: number, file: File | null) => {
    if (!file || !user) return;

    try {
      setSaving(true);
      const partner = conversationPartners[idx];

      // Compress image before upload (max 400×400, WebP ~80%)
      const compressedBlob = await compressImageForAvatar(file);
      const extension = compressedBlob.type === 'image/webp' ? 'webp' : 'jpg';
      const filePath = `${user.id}/appointment-partners/${preparation.id}/${partner.id}_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: compressedBlob.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      const updated = conversationPartners.map((entry, entryIdx) =>
        entryIdx === idx ? { ...entry, avatar_url: avatarUrl } : entry
      );

      setConversationPartners(updated);
      await onUpdate({
        preparation_data: buildPreparationData(editData, {
          conversation_partners: updated,
          contact_person: undefined,
        }),
      });

      toast({
        title: "Foto hochgeladen",
        description: "Das Foto wurde dem Gesprächspartner zugeordnet.",
      });
    } catch (error) {
      debugConsole.error("Error uploading conversation partner photo:", error);
      toast({
        title: "Fehler",
        description: "Das Foto konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Companion handlers ---
  const addCompanion = () => {
    const newCompanion: Companion = { id: crypto.randomUUID(), name: '', type: 'mitarbeiter', note: '' };
    const updated = [...companions, newCompanion];
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
    const newRow: ProgramRow = { id: crypto.randomUUID(), time: '', item: '', notes: '' };
    const updated = [...programRows, newRow];
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

  // --- Q&A pair handlers ---
  const addQaPair = () => {
    const newPair: QAPair = { id: crypto.randomUUID(), question: '', answer: '' };
    const updated = [...qaPairs, newPair];
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

  // --- Key topic item handlers ---
  const addKeyTopicItem = () => {
    const newItem: TopicItem = { id: crypto.randomUUID(), topic: '', background: '' };
    const updated = [...keyTopicItems, newItem];
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
  const handleKeyTopicKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addKeyTopicItem();
    }
  };

  // --- Talking point item handlers ---
  const addTalkingPointItem = () => {
    const newItem: TalkingPointItem = { id: crypto.randomUUID(), point: '', background: '' };
    const updated = [...talkingPointItems, newItem];
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
  const handleTalkingPointKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addTalkingPointItem();
    }
  };

  const fieldSections = {
    basics: {
      title: "Grundlagen",
      icon: FileTextIcon,
      fields: [
        { key: "last_meeting_date", label: "Letztes Treffen", placeholder: "Datum des letzten Treffens", type: "date" },
        { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?", multiline: true },
      ]
    },
    people: {
      title: "Personen",
      icon: UsersIcon,
      fields: [
        { key: "audience", label: "Zielgruppe", placeholder: "An wen richtet sich der Termin?" },
      ]
    },
    materials: {
      title: "Materialien & Unterlagen",
      icon: FolderIcon,
      fields: [
        { key: "materials_needed", label: "Benötigte Materialien", placeholder: "Welche Materialien werden benötigt?" },
        { key: "facts_figures", label: "Fakten & Zahlen", placeholder: "Wichtige Daten und Statistiken", multiline: true },
        { key: "position_statements", label: "Positionspapiere", placeholder: "Offizielle Positionen und Standpunkte", multiline: true },
      ]
    },
    communication: {
      title: "Kommunikation",
      icon: MessageSquareIcon,
      fields: [
        { key: "questions_answers", label: "Fragen & Antworten", placeholder: "Mögliche Fragen und vorbereitete Antworten", multiline: true },
        { key: "briefing_notes", label: "Weitere Notizen", placeholder: "Optionale ergänzende Briefing-Notizen", multiline: true },
      ]
    },
    framework: {
      title: "Rahmenbedingungen",
      icon: SettingsIcon,
      fields: [
        { key: "technology_setup", label: "Technik-Setup", placeholder: "Technische Voraussetzungen" },
        { key: "dress_code", label: "Kleiderordnung", placeholder: "Angemessene Kleidung für den Anlass", type: "select" },
        { key: "event_type", label: "Veranstaltungstyp", placeholder: "Art der Veranstaltung" },
      ]
    }
  };

  const dressCodeOptions = [
    { value: "casual", label: "Casual" },
    { value: "business_casual", label: "Business Casual" },
    { value: "business_formal", label: "Business Formal" },
    { value: "festlich", label: "Festlich" },
    { value: "uniform", label: "Uniformpflicht" },
    { value: "custom", label: "Benutzerdefiniert" }
  ];

  const getFilledFieldsCount = (sectionKey: string) => {
    const section = fieldSections[sectionKey as keyof typeof fieldSections];
    const filledCount = section.fields.filter(field => editData[field.key]?.trim()).length;
    return `${filledCount}/${section.fields.length}`;
  };

  const renderPreparationSection = (sectionKey: keyof typeof fieldSections) => {
    const section = fieldSections[sectionKey];
    const SectionIcon = section.icon;
    const isExpanded = expandedSections[sectionKey];
    const filledCount = getFilledFieldsCount(sectionKey);

    return (
      <Collapsible
        key={sectionKey}
        open={isExpanded}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <SectionIcon className="h-5 w-5 text-primary" />
            <h3 className="font-medium">{section.title}</h3>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {filledCount}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium">{field.label}</label>

                {(field as any).type === "select" ? (
                  <div className="space-y-2">
                    <Select
                      value={editData[field.key] || ""}
                      onValueChange={(value) => handleFieldChange(field.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {dressCodeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {editData[field.key] === "custom" && (
                      <Input
                        value={editData[`${field.key}_custom`] || ""}
                        onChange={(e) => handleFieldChange(`${field.key}_custom`, e.target.value)}
                        placeholder="Benutzerdefinierte Kleiderordnung eingeben..."
                      />
                    )}
                  </div>
                ) : (field as any).type === "date" ? (
                  <Input
                    type="date"
                    value={editData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  />
                ) : (field as any).multiline ? (
                  <Textarea
                    value={editData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="resize-none"
                  />
                ) : (
                  <Input
                    value={editData[field.key] || ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}

                {editData[field.key] && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircleIcon className="h-3 w-3" />
                    Ausgefüllt
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
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

      {/* ─── NEW SECTIONS ─── */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* 1. Gesprächspartner (moved to top) */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible
            open={expandedSections.gespraechspartner}
            onOpenChange={() => toggleSection('gespraechspartner')}
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
              {expandedSections.gespraechspartner ? (
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
                      onClick={handleOpenAppointment}
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
                      onValueChange={handleContactSelect}
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
                          value={editData.contact_name}
                          onChange={(e) => handleFieldChange("contact_name", e.target.value)}
                          placeholder="Name des Kontakts"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium">Kontaktinformationen</label>
                        <Textarea
                          value={editData.contact_info}
                          onChange={(e) => handleFieldChange("contact_info", e.target.value)}
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
                const searchResults = getPartnerSearchResults(partner.id);
                const searchText = partnerSearchTexts[partner.id] || '';

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
                            void handleConversationPartnerPhotoUpload(idx, e.target.files?.[0] ?? null);
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
                          <Input
                            value={partner.name}
                            disabled
                            className="bg-muted/50"
                          />
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
                            onClick={() => unlinkContactFromPartner(idx)}
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
                              setPartnerSearchTexts(prev => ({ ...prev, [partner.id]: val }));
                              updateConversationPartner(idx, 'name', val);
                            }}
                            onFocus={() => {
                              if (!searchText && partner.name) {
                                setPartnerSearchTexts(prev => ({ ...prev, [partner.id]: partner.name }));
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow click on dropdown
                              setTimeout(() => {
                                setPartnerSearchTexts(prev => ({ ...prev, [partner.id]: '' }));
                              }, 200);
                            }}
                            placeholder="Name eingeben oder Kontakt suchen..."
                          />
                          {searchResults.length > 0 && searchText.length >= 2 && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-48 overflow-auto">
                              {searchResults.map(contact => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectContactForPartner(idx, contact.id);
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
                        onChange={(e) => updateConversationPartner(idx, 'role', e.target.value)}
                        placeholder="z.B. Geschäftsführung"
                        disabled={isLinked}
                        className={isLinked ? "bg-muted/50" : ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Organisation</label>
                      <Input
                        value={partner.organization ?? ''}
                        onChange={(e) => updateConversationPartner(idx, 'organization', e.target.value)}
                        placeholder="z.B. Verband / Unternehmen"
                        disabled={isLinked}
                        className={isLinked ? "bg-muted/50" : ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Hinweis</label>
                      <Input
                        value={partner.note ?? ''}
                        onChange={(e) => updateConversationPartner(idx, 'note', e.target.value)}
                        placeholder="Zusätzlicher Kontext"
                      />
                    </div>
                    <div className="pt-6">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeConversationPartner(idx)}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={addConversationPartner} className="mt-2">
                <PlusIcon className="h-4 w-4 mr-2" />
                Gesprächspartner hinzufügen
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 2. Anlass des Besuchs */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible
            open={expandedSections.anlass}
            onOpenChange={() => toggleSection('anlass')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <TagIcon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Anlass des Besuchs</h3>
                {visitReason && (
                  <Badge variant="secondary" className="text-xs">
                    {VISIT_REASON_OPTIONS.find(o => o.value === visitReason)?.label ?? visitReason}
                  </Badge>
                )}
              </div>
              {expandedSections.anlass ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-4 px-1">
                <div className="flex flex-wrap gap-3">
                  {VISIT_REASON_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleVisitReasonChange(option.value)}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                        visitReason === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Freifeld zum Anlass</label>
                  <Textarea
                    value={editData.visit_reason_details ?? ''}
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

      {/* Begleitpersonen */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible
            open={expandedSections.begleitpersonen}
            onOpenChange={() => toggleSection('begleitpersonen')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <UsersIcon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Begleitpersonen</h3>
                {companions.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {companions.length}
                  </span>
                )}
              </div>
              {expandedSections.begleitpersonen ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-3">
              {companions.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">Noch keine Begleitpersonen hinzugefügt.</p>
              )}
              {companions.map((companion, idx) => (
                <div key={companion.id} className="grid grid-cols-1 gap-2 items-start rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={companion.name}
                      onChange={(e) => updateCompanion(idx, 'name', e.target.value)}
                      placeholder="Name der Begleitperson"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Typ</label>
                    <Select
                      value={companion.type}
                      onValueChange={(v) => updateCompanion(idx, 'type', v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANION_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hinweis (optional)</label>
                    <Input
                      value={companion.note ?? ''}
                      onChange={(e) => updateCompanion(idx, 'note', e.target.value)}
                      placeholder="z.B. Rolle, Funktion..."
                    />
                  </div>
                  <div className="pt-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompanion(idx)}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCompanion} className="mt-2">
                <PlusIcon className="h-4 w-4 mr-2" />
                Begleitperson hinzufügen
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 3. Logistik */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible
            open={expandedSections.logistik}
            onOpenChange={() => toggleSection('logistik')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <CarIcon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Logistik & Anreise</h3>
              </div>
              {expandedSections.logistik ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-1">
                {/* Fahrtzeit */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    Fahrtzeit
                  </label>
                  <Input
                    value={editData.travel_time ?? ''}
                    onChange={(e) => handleFieldChange('travel_time', e.target.value)}
                    placeholder="z.B. 45 Minuten"
                  />
                </div>

                {/* PKW-Stellplatz */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-muted-foreground" />
                    PKW-Stellplatz
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    <Switch
                      id="has-parking"
                      checked={hasParking}
                      onCheckedChange={handleParkingChange}
                    />
                    <Label htmlFor="has-parking" className="text-sm">
                      {hasParking ? 'Parkplatz vorhanden' : 'Kein Parkplatz'}
                    </Label>
                  </div>
                </div>

                {/* Folgetermin / Rückfahrt */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    Folgetermin / Rückfahrt
                  </label>
                  <Textarea
                    value={editData.follow_up ?? ''}
                    onChange={(e) => handleFieldChange('follow_up', e.target.value)}
                    placeholder="Was passiert nach dem Termin? Rückfahrt, nächster Termin, Nachbereitung..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquareIcon className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">Öffentlichkeitsarbeit</h3>
                <p className="text-sm text-muted-foreground">
                  Planung für Social Media und Presse rund um den Termin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="social-media-planned" className="text-sm font-medium">
                    Social Media geplant
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Markiert, ob Beiträge oder Begleitung auf Social Media vorgesehen sind.
                  </p>
                </div>
                <Switch
                  id="social-media-planned"
                  checked={editData.social_media_planned ?? false}
                  onCheckedChange={(checked) => handleBooleanFieldChange('social_media_planned', checked)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="press-planned" className="text-sm font-medium">
                    Presse geplant
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Markiert, ob Pressearbeit oder Pressebegleitung eingeplant ist.
                  </p>
                </div>
                <Switch
                  id="press-planned"
                  checked={editData.press_planned ?? false}
                  onCheckedChange={(checked) => handleBooleanFieldChange('press_planned', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Programm / Ablaufplan */}
      <Card>
        <CardContent className="pt-6">
          <Collapsible
            open={expandedSections.programm}
            onOpenChange={() => toggleSection('programm')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <ClipboardListIcon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">Programm / Ablaufplan</h3>
                {programRows.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {programRows.length} {programRows.length === 1 ? 'Punkt' : 'Punkte'}
                  </span>
                )}
              </div>
              {expandedSections.programm ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              {programRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Zeit</TableHead>
                      <TableHead>Programmpunkt</TableHead>
                      <TableHead>Hinweise</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {programRows.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell className="py-2">
                          <Input
                            value={row.time}
                            onChange={(e) => updateProgramRow(idx, 'time', e.target.value)}
                            placeholder="10:00"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={row.item}
                            onChange={(e) => updateProgramRow(idx, 'item', e.target.value)}
                            placeholder="Programmpunkt"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={row.notes}
                            onChange={(e) => updateProgramRow(idx, 'notes', e.target.value)}
                            placeholder="Hinweise"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProgramRow(idx)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground px-1 mb-3">Noch keine Programmpunkte eingetragen.</p>
              )}
              <Button variant="outline" size="sm" onClick={addProgramRow} className="mt-3">
                <PlusIcon className="h-4 w-4 mr-2" />
                Programmpunkt hinzufügen
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Vorbereitungsdaten links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten · Inhalte & Kommunikation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["basics", "communication"] as const).map(renderPreparationSection)}
        </CardContent>
      </Card>

      {/* Vorbereitungsdaten rechts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten · Personen, Unterlagen & Rahmen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["people", "materials", "framework"] as const).map(renderPreparationSection)}
          {Object.values(fieldSections).every(section =>
            section.fields.every(field => !editData[field.key])
          ) && (
            <div className="text-center py-8 text-muted-foreground">
              <FileTextIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Vorbereitungsdaten vorhanden.</p>
              <p className="text-sm">Klappen Sie die Bereiche auf, um Daten hinzuzufügen.</p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
