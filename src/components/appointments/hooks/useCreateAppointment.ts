import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/components/ui/use-toast';
import { useDistrictDetection } from '@/hooks/useDistrictDetection';
import { saveAppointmentTopics } from '@/hooks/useAppointmentTopics';

const getDefaultStartTime = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  const rounded = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes);
  if (roundedMinutes >= 60) { rounded.setHours(rounded.getHours() + 1); rounded.setMinutes(0); }
  return rounded;
};

const formatDateForInput = (date: Date) => format(date, 'yyyy-MM-dd');
const formatTimeForInput = (date: Date) => format(date, 'HH:mm');

const appointmentSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich"),
  description: z.string().optional(),
  start_date: z.string().min(1, "Startdatum ist erforderlich"),
  start_time: z.string().optional(),
  end_date: z.string().optional(),
  end_time: z.string().optional(),
  location: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1, "Kategorie ist erforderlich"),
  status: z.string().min(1, "Status ist erforderlich"),
  reminder_minutes: z.number().min(0),
  is_all_day: z.boolean().default(false),
}).refine((data) => {
  if (data.is_all_day) { return new Date(data.end_date || data.start_date) >= new Date(data.start_date); }
  return new Date(`${data.end_date || data.start_date}T${data.end_time || '00:00'}`) > new Date(`${data.start_date}T${data.start_time || '00:00'}`);
}, { message: "Endzeit muss nach der Startzeit liegen", path: ["end_time"] });

export function useCreateAppointment(open: boolean, onOpenChange: (open: boolean) => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [appointmentCategories, setAppointmentCategories] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentStatuses, setAppointmentStatuses] = useState<Array<{ name: string; label: string }>>([]);
  const [appointmentLocations, setAppointmentLocations] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isAllDay, setIsAllDay] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [appointmentGuests, setAppointmentGuests] = useState<Array<{ name: string; email: string }>>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const { detectDistrict, clearResult } = useDistrictDetection();

  const defaultStart = getDefaultStartTime();
  const form = useForm({
    resolver: zodResolver(appointmentSchema) as any,
    mode: "onSubmit" as const,
    defaultValues: {
      title: "", description: "",
      start_date: formatDateForInput(defaultStart), start_time: formatTimeForInput(defaultStart),
      end_date: formatDateForInput(defaultStart), end_time: formatTimeForInput(addHours(defaultStart, 1)),
      location: "", priority: "medium" as const, category: "meeting", status: "planned", reminder_minutes: 15, is_all_day: false,
    },
  });

  useEffect(() => {
    if (open) {
      const urlParams = new URLSearchParams(location.search);
      const startParam = urlParams.get('start');
      const endParam = urlParams.get('end');
      if (startParam) { const d = new Date(startParam); form.setValue('start_date', formatDateForInput(d)); form.setValue('start_time', formatTimeForInput(d)); }
      if (endParam) { const d = new Date(endParam); form.setValue('end_date', formatDateForInput(d)); form.setValue('end_time', formatTimeForInput(d)); }
    }
  }, [open, location.search, form]);

  useEffect(() => {
    if (!open || !user) return;
    Promise.all([
      supabase.from('appointment_categories').select('name, label').eq('is_active', true).order('order_index'),
      supabase.from('appointment_statuses').select('name, label').eq('is_active', true).order('order_index'),
      supabase.from('appointment_locations').select('id, name, address').eq('is_active', true).order('order_index'),
    ]).then(([cats, stats, locs]) => {
      setAppointmentCategories(cats.data || []);
      setAppointmentStatuses(stats.data || []);
      setAppointmentLocations(locs.data || []);
      if (cats.data?.length) form.setValue('category', cats.data[0].name as any);
      if (stats.data?.length) form.setValue('status', stats.data[0].name as any);
    });
  }, [user, form, open]);

  const handleLocationDetection = async (loc: string) => {
    if (!loc || loc === "Digital" || !loc.trim()) { clearResult(); return; }
    await detectDistrict(loc);
  };

  const handleAllDayChange = (checked: boolean) => {
    setIsAllDay(checked);
    form.setValue("is_all_day", checked);
    if (checked) { if (!form.getValues("end_date") && form.getValues("start_date")) form.setValue("end_date", form.getValues("start_date")); }
    else {
      if (!form.getValues("start_time")) form.setValue("start_time", formatTimeForInput(getDefaultStartTime()));
      if (!form.getValues("end_time")) { const st = form.getValues("start_time"); form.setValue("end_time", formatTimeForInput(addHours(st ? new Date(`2000-01-01T${st}`) : getDefaultStartTime(), 1))); }
    }
  };

  const handleStartTimeChange = (timeValue: string) => {
    form.setValue("start_time", timeValue);
    if (!isAllDay && timeValue) form.setValue("end_time", formatTimeForInput(addHours(new Date(`2000-01-01T${timeValue}`), 1)));
  };

  const onSubmit = async (values: any) => {
    if (!user || !currentTenant) {
      if (!currentTenant) toast({ title: "Fehler", description: "Kein Tenant ausgewählt.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const startTime = values.is_all_day ? values.start_date + "T00:00:00" : values.start_date + "T" + (values.start_time || "09:00") + ":00";
      const endTime = values.is_all_day ? (values.end_date || values.start_date) + "T23:59:59" : (values.end_date || values.start_date) + "T" + (values.end_time || "10:00") + ":00";

      const { data: appointment, error } = await supabase.from('appointments').insert({
        title: values.title, description: values.description, start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(),
        location: values.location, priority: values.priority, category: values.category, status: values.status,
        reminder_minutes: values.reminder_minutes, user_id: user.id, tenant_id: currentTenant.id,
        is_all_day: values.is_all_day, has_external_guests: appointmentGuests.length > 0,
      }).select().single();
      if (error) throw error;

      if (selectedTopicIds.length > 0 && appointment) await saveAppointmentTopics(appointment.id, selectedTopicIds);
      if (selectedContacts.length > 0 && appointment) {
        await supabase.from('appointment_contacts').insert(selectedContacts.map(c => ({ appointment_id: appointment.id, contact_id: c.id, role: 'participant' })));
      }
      if (appointmentGuests.length > 0 && appointment) {
        await supabase.from('appointment_guests').insert(appointmentGuests.map(g => ({ appointment_id: appointment.id, tenant_id: currentTenant.id, name: g.name, email: g.email, status: 'invited' as const, invitation_token: crypto.randomUUID() + '-' + Date.now() })));
        try {
          const { error: invErr } = await supabase.functions.invoke('send-appointment-invitation', { body: { appointmentId: appointment.id, sendToAll: true } });
          if (invErr) toast({ title: "Warnung", description: "Einladungen konnten nicht versendet werden.", variant: "destructive" });
          else toast({ title: "Einladungen versendet", description: `Einladungen wurden an ${appointmentGuests.length} Gäste versendet.` });
        } catch { toast({ title: "Warnung", description: "Einladungen konnten nicht versendet werden.", variant: "destructive" }); }
      }
      toast({ title: "Termin erstellt", description: "Der Termin wurde erfolgreich gespeichert." });
      onOpenChange(false);
      navigate("/calendar");
    } catch (error: unknown) {
      toast({ title: "Fehler beim Erstellen", description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return {
    form, loading, isAllDay, showPollCreator, showAdvancedOptions,
    selectedContacts, appointmentCategories, appointmentStatuses, appointmentLocations,
    uploadedFiles, appointmentGuests, selectedTopicIds,
    setShowPollCreator, setShowAdvancedOptions, setUploadedFiles, setAppointmentGuests, setSelectedTopicIds,
    setSelectedContacts,
    handleAllDayChange, handleStartTimeChange, handleLocationDetection, onSubmit,
    addContact: (c: any) => { if (!selectedContacts.find(x => x.id === c.id)) setSelectedContacts([...selectedContacts, c]); },
    removeContact: (id: string) => setSelectedContacts(selectedContacts.filter(c => c.id !== id)),
    priorityLabels: { low: "Niedrig", medium: "Mittel", high: "Hoch", urgent: "Dringend" } as Record<string, string>,
  };
}
