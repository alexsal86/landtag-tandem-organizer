import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { format, addDays, startOfDay, endOfDay, isWithinInterval, isSameWeek, addWeeks } from 'date-fns';
import { de } from 'date-fns/locale';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  category?: string;
  status?: string;
  isExternal?: boolean;
  calendarName?: string;
  calendarColor?: string;
}

interface UpcomingAppointmentsSectionProps {
  meetingDate: Date | string;
  className?: string;
  defaultCollapsed?: boolean;
}

export const UpcomingAppointmentsSection: React.FC<UpcomingAppointmentsSectionProps> = ({
  meetingDate,
  className = '',
  defaultCollapsed = false
}) => {
  const { currentTenant } = useTenant();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  const baseDate = typeof meetingDate === 'string' ? new Date(meetingDate) : meetingDate;

  useEffect(() => {
    console.log('📅 UpcomingAppointmentsSection useEffect triggered');
    console.log('- currentTenant:', currentTenant);
    console.log('- currentTenant?.id:', currentTenant?.id);
    console.log('- meetingDate:', meetingDate);
    console.log('- baseDate:', baseDate);
    
    if (currentTenant?.id) {
      console.log('✅ Tenant ID found, loading appointments...');
      loadAppointments();
    } else {
      console.log('❌ No tenant ID, skipping appointment load');
    }
  }, [currentTenant?.id, meetingDate]);

  const loadAppointments = async () => {
    console.log('📅 loadAppointments called');
    console.log('- currentTenant?.id:', currentTenant?.id);
    
    if (!currentTenant?.id) {
      console.log('❌ No tenant ID in loadAppointments, returning');
      return;
    }

    setLoading(true);
    try {
      const startDate = startOfDay(baseDate);
      const endDate = endOfDay(addDays(baseDate, 14));

      console.log('📅 Query parameters:');
      console.log('- tenant_id:', currentTenant.id);
      console.log('- startDate:', startDate.toISOString());
      console.log('- endDate:', endDate.toISOString());

      // Load internal appointments
      const { data: internalData, error: internalError } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, location, category, status')
        .eq('tenant_id', currentTenant.id)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true });

      if (internalError) throw internalError;

      // Load external calendar events
      const { data: externalData, error: externalError } = await supabase
        .from('external_events')
        .select(`
          id, 
          title, 
          start_time, 
          end_time, 
          location,
          external_calendars!inner(
            id,
            name,
            color,
            tenant_id
          )
        `)
        .eq('external_calendars.tenant_id', currentTenant.id)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString());

      console.log('📅 Internal appointments:', internalData?.length || 0);
      console.log('📅 External events:', externalData?.length || 0);

      if (externalError) {
        console.error('Error loading external events:', externalError);
      }

      // Merge and format appointments
      const internalAppointments: Appointment[] = (internalData || []).map(apt => ({
        ...apt,
        isExternal: false
      }));

      const externalAppointments: Appointment[] = (externalData || []).map((event: any) => ({
        id: event.id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
        category: 'external',
        isExternal: true,
        calendarName: event.external_calendars?.name,
        calendarColor: event.external_calendars?.color
      }));

      // Combine and sort by start_time
      const allAppointments = [...internalAppointments, ...externalAppointments]
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      console.log('📅 Total combined appointments:', allAppointments.length);
      setAppointments(allAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group appointments by week
  const thisWeekAppointments = appointments.filter(apt => 
    isSameWeek(new Date(apt.start_time), baseDate, { locale: de, weekStartsOn: 1 })
  );
  
  const nextWeekAppointments = appointments.filter(apt => 
    isSameWeek(new Date(apt.start_time), addWeeks(baseDate, 1), { locale: de, weekStartsOn: 1 })
  );

  const formatAppointmentTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  const formatAppointmentDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'EEEE, d. MMM', { locale: de });
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'meeting': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'internal': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'external': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'parliamentary': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderAppointment = (apt: Appointment) => (
    <div 
      key={apt.id} 
      className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
      style={apt.isExternal && apt.calendarColor ? { borderLeft: `3px solid ${apt.calendarColor}` } : undefined}
    >
      <div className="flex flex-col items-center min-w-[50px] text-xs text-muted-foreground">
        <span className="font-medium">{format(new Date(apt.start_time), 'EEE', { locale: de })}</span>
        <span className="text-lg font-bold text-foreground">{format(new Date(apt.start_time), 'd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{apt.title}</div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatAppointmentTime(apt.start_time, apt.end_time)}
          </span>
          {apt.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              {apt.location}
            </span>
          )}
        </div>
        {apt.isExternal && apt.calendarName && (
          <div className="text-xs text-muted-foreground mt-0.5 italic">
            📅 {apt.calendarName}
          </div>
        )}
      </div>
      {apt.category && (
        <Badge variant="secondary" className={`text-xs shrink-0 ${getCategoryColor(apt.category)}`}>
          {apt.isExternal ? 'Extern' : apt.category}
        </Badge>
      )}
    </div>
  );

  const renderWeekSection = (title: string, weekAppointments: Appointment[]) => {
    if (weekAppointments.length === 0) return null;
    
    return (
      <div className="space-y-1">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1">
          {title}
        </h5>
        <div className="space-y-0.5">
          {weekAppointments.map(renderAppointment)}
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-md transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Calendar className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium">
          Kommende Termine (nächste 2 Wochen)
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          {appointments.length}
        </Badge>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Keine Termine in den nächsten 2 Wochen
          </div>
        ) : (
          <div className="space-y-4 ml-6 border-l-2 border-muted pl-4">
            {renderWeekSection('Diese Woche', thisWeekAppointments)}
            {renderWeekSection('Nächste Woche', nextWeekAppointments)}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
