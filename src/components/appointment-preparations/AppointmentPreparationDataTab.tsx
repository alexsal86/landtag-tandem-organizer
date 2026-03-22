import { useState, useCallback, useEffect, useRef } from "react";
import { debugConsole } from "@/utils/debugConsole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarIcon, ClockIcon, MapPinIcon, UsersIcon, PlusIcon, EditIcon, SaveIcon, XIcon,
  ExternalLinkIcon, FileTextIcon, ChevronDownIcon, ChevronRightIcon, FolderIcon,
  MessageSquareIcon, SettingsIcon, CheckCircleIcon, CarIcon, MapIcon, ClipboardListIcon,
  TagIcon, TrashIcon
} from "lucide-react";
import { AppointmentPreparation, AppointmentConversationPartner, getConversationPartnersFromPreparationData } from "@/hooks/useAppointmentPreparation";
import { debounce } from "@/utils/debounce";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AppointmentDetailsSidebar } from "@/components/calendar/AppointmentDetailsSidebar";

type ConversationPartner = AppointmentConversationPartner;
type Companion = NonNullable<AppointmentPreparation['preparation_data']['companions']>[number];
type ProgramRow = NonNullable<AppointmentPreparation['preparation_data']['program']>[number];

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  category?: string;
  priority?: string;
  status?: string;
  meeting_link?: string;
  meeting_details?: string;
}

interface ExtendedAppointmentPreparation extends AppointmentPreparation {
  contact_name?: string;
  contact_info?: string;
  contact_id?: string;
}

interface AppointmentPreparationDataTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
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
  onUpdate
}: AppointmentPreparationDataTabProps) {
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

  const [isEditing, setIsEditing] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showCustomContact, setShowCustomContact] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<CalendarEvent | null>(null);
  const [showAppointmentSidebar, setShowAppointmentSidebar] = useState(false);
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (preparation.appointment_id) {
      fetchAppointmentDetails();
      fetchContacts();

      if (extendedPreparation.contact_name && extendedPreparation.contact_info) {
        setShowCustomContact(true);
      } else if (extendedPreparation.contact_id) {
        setSelectedContactId(extendedPreparation.contact_id);
      }
    }
  }, [preparation.appointment_id, currentTenant]);

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

      if (nextPreparationData.contact_name && nextPreparationData.contact_info) {
        setShowCustomContact(true);
      } else if (nextPreparationData.contact_id) {
        setSelectedContactId(nextPreparationData.contact_id);
      }
    }
  }, [preparation]);

  const fetchAppointmentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', preparation.appointment_id ?? '')
        .single();

      if (error) throw error;

      if (data) {
        setAppointmentDetails({
          id: data.id,
          title: data.title,
          start: data.start_time,
          end: data.end_time,
          description: data.description ?? undefined,
          location: data.location ?? undefined,
          category: data.category ?? undefined,
          priority: data.priority ?? undefined,
          status: data.status ?? undefined,
          meeting_link: data.meeting_link ?? undefined,
          meeting_details: data.meeting_details ?? undefined
        });
      }
    } catch (error) {
      debugConsole.error("Error fetching appointment details:", error);
    }
  };

  const fetchContacts = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, organization, role')
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
  });

  const handleSave = async () => {
    try {
      setSaving(true);

      const updatedPreparationData = buildPreparationData({
        ...editData,
        contact_name: showCustomContact
          ? editData.contact_name
          : (selectedContactId ? contacts.find(c => c.id === selectedContactId)?.name : undefined),
        contact_info: showCustomContact
          ? editData.contact_info
          : (selectedContactId
            ? `${contacts.find(c => c.id === selectedContactId)?.email || ""}${contacts.find(c => c.id === selectedContactId)?.phone ? ` | ${contacts.find(c => c.id === selectedContactId)?.phone}` : ""}`.trim().replace(/^\|/, '').trim() || undefined
            : undefined),
        contact_id: showCustomContact ? undefined : selectedContactId || undefined,
        contact_person: conversationPartners.length > 0 ? undefined : editData.contact_person
      } as any);

      await onUpdate({
        preparation_data: updatedPreparationData,
        notes: editData.briefing_notes || "",
      });
      setIsEditing(false);

      toast({
        title: "Gespeichert",
        description: "Terminvorbereitung wurde erfolgreich gespeichert.",
      });
    } catch (error) {
      debugConsole.error("Error saving preparation:", error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Terminvorbereitung.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const nextPreparationData = getPreparationDataWithDefaults(preparation.preparation_data);
    setEditData({
      ...nextPreparationData,
      contact_name: nextPreparationData.contact_name || "",
      contact_info: nextPreparationData.contact_info || "",
      briefing_notes: nextPreparationData.briefing_notes || preparation.notes || ""
    } as Record<string, any>);
    setCompanions(nextPreparationData.companions ?? []);
    setHasParking(nextPreparationData.has_parking ?? false);
    setProgramRows(nextPreparationData.program ?? []);
    setVisitReason(nextPreparationData.visit_reason ?? '');
    setIsEditing(false);
    setShowCustomContact(!!(nextPreparationData.contact_name && nextPreparationData.contact_info));
    setSelectedContactId(nextPreparationData.contact_id || "");
  };

  const handleContactSelect = (contactId: string) => {
    if (contactId === "custom") {
      setShowCustomContact(true);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else if (contactId === "none") {
      setShowCustomContact(false);
      setSelectedContactId("");
      setEditData(prev => ({ ...prev, contact_name: "", contact_info: "" }));
    } else {
      setShowCustomContact(false);
      setSelectedContactId(contactId);
      const selectedContact = contacts.find(c => c.id === contactId);
      if (selectedContact) {
        setEditData(prev => ({
          ...prev,
          contact_name: selectedContact.name,
          contact_info: `${selectedContact.email || ""}${selectedContact.phone ? ` | ${selectedContact.phone}` : ""}`.trim().replace(/^\|/, '').trim()
        }));
      }
    }
  };

  const getStatusBadge = (status: string) => {
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
    if (appointmentDetails) {
      setShowAppointmentSidebar(true);
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

  const fieldSections = {
    basics: {
      title: "Grundlagen",
      icon: FileTextIcon,
      fields: [
        { key: "objectives", label: "Ziele", placeholder: "Welche Ziele sollen erreicht werden?", multiline: true },
        { key: "key_topics", label: "Wichtige Themen", placeholder: "Ein Thema pro Zeile oder als Liste", multiline: true },
        { key: "talking_points", label: "Ergänzende Gesprächspunkte", placeholder: "Optionale Ergänzungen, ebenfalls gern zeilenweise", multiline: true },
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

  return (
    <div className="space-y-4">
      {/* Preparation Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileTextIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-xl">
                  Vorbereitung: {appointmentDetails?.title || "Termin"}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
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

            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <XIcon className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <SaveIcon className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <EditIcon className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Appointment Details Section */}
          {appointmentDetails && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Termindetails
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Datum:</span>
                  <span>
                    {format(new Date(appointmentDetails.start), 'dd.MM.yyyy', { locale: de })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Zeit:</span>
                  <span>
                    {format(new Date(appointmentDetails.start), 'HH:mm', { locale: de })} - {format(new Date(appointmentDetails.end), 'HH:mm', { locale: de })}
                  </span>
                </div>

                {appointmentDetails.location && (
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Ort:</span>
                    <span>{appointmentDetails.location}</span>
                  </div>
                )}

                {appointmentDetails.description && (
                  <div className="flex items-start gap-2 md:col-span-2">
                    <FileTextIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">Beschreibung:</span>
                      <p className="text-muted-foreground mt-1">{appointmentDetails.description}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAppointment}
                className="flex items-center gap-2"
              >
                <ExternalLinkIcon className="h-4 w-4" />
                Termindetails öffnen
              </Button>
            </div>
          )}

          <Separator />

          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Kontaktinformationen
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Kontakt</label>
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
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Kontaktname</label>
                      <Input
                        value={editData.contact_name}
                        onChange={(e) => setEditData(prev => ({ ...prev, contact_name: e.target.value }))}
                        placeholder="Name des Kontakts"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Kontaktinformationen</label>
                      <Textarea
                        value={editData.contact_info}
                        onChange={(e) => setEditData(prev => ({ ...prev, contact_info: e.target.value }))}
                        placeholder="E-Mail, Telefon, weitere Informationen..."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {preparation.preparation_data.contact_name ? (
                  <div className="space-y-2">
                    <div className="font-medium">{preparation.preparation_data.contact_name}</div>
                    {preparation.preparation_data.contact_info && (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {preparation.preparation_data.contact_info}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Kein Kontakt zugeordnet
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Weitere Notizen</h3>

            {isEditing ? (
              <Textarea
                value={editData.briefing_notes}
                onChange={(e) => handleFieldChange('briefing_notes', e.target.value)}
                placeholder="Zusätzliche Briefing-Notizen, die separat im Briefing erscheinen sollen..."
                rows={4}
              />
            ) : (
              <div>
                {(preparation.preparation_data.briefing_notes || preparation.notes) ? (
                  <div className="text-muted-foreground whitespace-pre-wrap">
                    {preparation.preparation_data.briefing_notes || preparation.notes}
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Keine weiteren Notizen vorhanden
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── NEW SECTIONS ─── */}

      {/* 1. Anlass des Besuchs */}
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
              <div className="flex flex-wrap gap-3 px-1">
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
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 2. Gesprächspartner */}
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
              {conversationPartners.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">Noch keine Gesprächspartner hinzugefügt.</p>
              )}
              {conversationPartners.map((partner, idx) => (
                <div key={partner.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2 items-start p-3 border rounded-lg bg-muted/20">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={partner.name}
                      onChange={(e) => updateConversationPartner(idx, 'name', e.target.value)}
                      placeholder="Name des Gesprächspartners"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Rolle</label>
                    <Input
                      value={partner.role ?? ''}
                      onChange={(e) => updateConversationPartner(idx, 'role', e.target.value)}
                      placeholder="z.B. Geschäftsführung"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Organisation</label>
                    <Input
                      value={partner.organization ?? ''}
                      onChange={(e) => updateConversationPartner(idx, 'organization', e.target.value)}
                      placeholder="z.B. Verband / Unternehmen"
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
              ))}
              <Button variant="outline" size="sm" onClick={addConversationPartner} className="mt-2">
                <PlusIcon className="h-4 w-4 mr-2" />
                Gesprächspartner hinzufügen
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* 2. Begleitpersonen */}
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
                <div key={companion.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-start p-3 border rounded-lg bg-muted/20">
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

      {/* ─── EXISTING PREPARATION DATA SECTIONS ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Vorbereitungsdaten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(fieldSections).map(([sectionKey, section]) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[sectionKey as keyof typeof expandedSections];
            const filledCount = getFilledFieldsCount(sectionKey);

            return (
              <Collapsible
                key={sectionKey}
                open={isExpanded}
                onOpenChange={() => toggleSection(sectionKey as keyof typeof expandedSections)}
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
          })}

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

      {/* Appointment Details Sidebar */}
      {appointmentDetails && (
        <AppointmentDetailsSidebar
          appointment={{
            id: appointmentDetails.id,
            title: appointmentDetails.title,
            description: appointmentDetails.description,
            time: format(new Date(appointmentDetails.start), 'HH:mm', { locale: de }),
            duration: Math.round((new Date(appointmentDetails.end).getTime() - new Date(appointmentDetails.start).getTime()) / (1000 * 60)).toString(),
            date: new Date(appointmentDetails.start),
            endTime: new Date(appointmentDetails.end),
            location: appointmentDetails.location,
            attendees: 0,
            type: (appointmentDetails.category || 'meeting') as 'deadline' | 'birthday' | 'vacation' | 'meeting' | 'appointment' | 'session' | 'blocked' | 'veranstaltung' | 'vacation_request',
            priority: (appointmentDetails.priority as 'high' | 'low' | 'medium') || 'medium',
            category: { color: '#3b82f6' }
          }}
          open={showAppointmentSidebar}
          onClose={() => setShowAppointmentSidebar(false)}
          onUpdate={() => fetchAppointmentDetails()}
        />
      )}
    </div>
  );
}
