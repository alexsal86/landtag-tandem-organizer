import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { debugConsole } from '@/utils/debugConsole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppointmentBriefingView } from '@/components/appointment-preparations/AppointmentBriefingView';
import { generateBriefingPdf } from '@/components/appointment-preparations/briefingPdfGenerator';
import type { AppointmentPreparation } from '@/hooks/useAppointmentPreparation';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  location: string | null;
  is_all_day: boolean;
}

interface PreparationData {
  id: string;
  appointment_id: string;
  title: string;
  preparation_data: AppointmentPreparation['preparation_data'];
  checklist_items: AppointmentPreparation['checklist_items'];
  status: string;
  notes: string | null;
  tenant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at: string | null;
  template_id: string | null;
}

interface TodayScheduleProps {
  onCountChange?: (count: number) => void;
}

export const TodaySchedule = ({ onCountChange }: TodayScheduleProps) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [preparations, setPreparations] = useState<Map<string, PreparationData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchTodayAppointments = async () => {
      if (!user?.id || !currentTenant?.id) {
        setLoading(false);
        return;
      }

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        
        const { data: normalAppointments } = await supabase
          .from('appointments')
          .select('id, title, start_time, end_time, location, is_all_day')
          .eq('tenant_id', currentTenant.id)
          .eq('is_all_day', false)
          .gte('start_time', today.toISOString())
          .lt('start_time', tomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        const { data: allDayAppointments } = await supabase
          .from('appointments')
          .select('id, title, start_time, end_time, location, is_all_day')
          .eq('tenant_id', currentTenant.id)
          .eq('is_all_day', true)
          .gte('start_time', yesterday.toISOString())
          .lt('start_time', dayAfterTomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        const externalEventsResult = await supabase
          .from('external_events')
          .select(`
            id,
            title,
            start_time,
            location,
            all_day,
            external_calendars!inner(tenant_id)
          `)
          .eq('external_calendars.tenant_id', currentTenant.id)
          .gte('start_time', yesterday.toISOString())
          .lt('start_time', dayAfterTomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        type ExternalEventRow = { id: string; title: string; start_time: string; location: string | null; all_day: boolean | null };
        const externalEventsFormatted: Appointment[] = ((externalEventsResult.data ?? []) as ExternalEventRow[]).map((e) => ({
          id: e.id,
          title: e.title,
          start_time: e.start_time,
          location: e.location ?? null,
          is_all_day: e.all_day ?? false
        }));
        
        const allEvents: Appointment[] = [
          ...(normalAppointments || []),
          ...(allDayAppointments || []),
          ...externalEventsFormatted
        ];
        
        const filteredEvents = allEvents.filter(event => {
          const eventDate = new Date(event.start_time);
          const localDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
          return localDate.toDateString() === today.toDateString();
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        setAppointments(filteredEvents);
        if (onCountChange) {
          onCountChange(filteredEvents.length);
        }

        // Fetch preparations for today's internal appointments
        const internalIds = [
          ...(normalAppointments || []),
          ...(allDayAppointments || [])
        ].map(a => a.id);

        if (internalIds.length > 0) {
          const { data: preps } = await supabase
            .from('appointment_preparations')
            .select('*')
            .in('appointment_id', internalIds)
            .eq('is_archived', false);

          if (preps && preps.length > 0) {
            const prepMap = new Map<string, PreparationData>();
            for (const p of preps) {
              prepMap.set(p.appointment_id, {
                id: p.id,
                appointment_id: p.appointment_id,
                title: p.title,
                preparation_data: (p.preparation_data ?? {}) as AppointmentPreparation['preparation_data'],
                checklist_items: (p.checklist_items ?? []) as AppointmentPreparation['checklist_items'],
                status: p.status,
                notes: p.notes,
                tenant_id: p.tenant_id,
                created_by: p.created_by,
                created_at: p.created_at,
                updated_at: p.updated_at,
                is_archived: p.is_archived,
                archived_at: p.archived_at,
                template_id: p.template_id,
              });
            }
            setPreparations(prepMap);
          }
        }
      } catch (error) {
        debugConsole.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTodayAppointments();
  }, [user, currentTenant, onCountChange]);

  const handleDownloadPdf = async (apt: Appointment) => {
    const prep = preparations.get(apt.id);
    if (!prep) {
      toast.error('Für diesen Termin liegt kein Briefing vor.');
      return;
    }

    try {
      setGeneratingPdfId(apt.id);
      await generateBriefingPdf({
        preparation: prep as unknown as AppointmentPreparation,
        appointmentTitle: apt.title,
        appointmentLocation: apt.location ?? undefined,
        appointmentStartTime: apt.start_time,
        appointmentEndTime: apt.end_time ?? apt.start_time,
      });
    } catch (error) {
      debugConsole.error('Error generating briefing PDF:', error);
      toast.error('Das Briefing-PDF konnte nicht erstellt werden.');
    } finally {
      setGeneratingPdfId((currentId) => currentId === apt.id ? null : currentId);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Heutige Termine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Heutige Termine
          <Badge variant="secondary">{appointments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Termine heute</p>
        ) : (
          <div className="space-y-3">
            {appointments.slice(0, 3).map((apt) => {
              const hasPrep = preparations.has(apt.id);
              const isExpanded = expandedId === apt.id;
              const prep = preparations.get(apt.id);

              return (
                <div key={apt.id}>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{apt.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {apt.is_all_day 
                          ? 'Ganztägig' 
                          : `${format(new Date(apt.start_time), 'HH:mm', { locale: de })} Uhr`
                        }
                      </div>
                      {apt.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {apt.location}
                        </div>
                      )}
                    </div>
                    {hasPrep && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Briefing-PDF herunterladen"
                          onClick={() => void handleDownloadPdf(apt)}
                          disabled={generatingPdfId === apt.id}
                        >
                          <FileText className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Briefing anzeigen"
                          onClick={() => toggleExpand(apt.id)}
                        >
                          {isExpanded 
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </Button>
                      </div>
                    )}
                  </div>
                  {isExpanded && prep && (
                    <div className="mt-2 ml-2">
                      <AppointmentBriefingView
                        preparation={prep as unknown as AppointmentPreparation}
                        appointmentInfo={{
                          title: apt.title,
                          start_time: apt.start_time,
                          end_time: apt.end_time || apt.start_time,
                          location: apt.location,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
