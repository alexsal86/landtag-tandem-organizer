import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Calendar, Clock, MapPin, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays, startOfDay, endOfDay, isSameWeek, addWeeks } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

export interface FocusModeUpcomingAppointmentsHandle {
  getAppointmentsCount: () => number;
  toggleStarAtIndex: (index: number) => void;
}

interface FocusModeUpcomingAppointmentsProps {
  meetingDate: Date | string;
  meetingId?: string;
  className?: string;
  focusedIndex?: number;
  onAppointmentsLoaded?: (count: number) => void;
}

export const FocusModeUpcomingAppointments = forwardRef<
  FocusModeUpcomingAppointmentsHandle,
  FocusModeUpcomingAppointmentsProps
>(({
  meetingDate,
  meetingId,
  className = '',
  focusedIndex = -1,
  onAppointmentsLoaded
}, ref) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const baseDate = typeof meetingDate === 'string' ? new Date(meetingDate) : meetingDate;

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getAppointmentsCount: () => appointments.length,
    toggleStarAtIndex: (index: number) => {
      if (index >= 0 && index < appointments.length) {
        toggleStar(appointments[index]);
      }
    }
  }));

  useEffect(() => {
    if (currentTenant?.id) {
      loadAppointments();
      if (meetingId) {
        loadStarredAppointments();
      }
    }
  }, [currentTenant?.id, meetingDate, meetingId]);

  // Notify parent when appointments are loaded
  useEffect(() => {
    onAppointmentsLoaded?.(appointments.length);
  }, [appointments.length, onAppointmentsLoaded]);

  const loadAppointments = async () => {
    if (!currentTenant?.id) return;

    setLoading(true);
    try {
      const startDate = startOfDay(baseDate);
      const endDate = endOfDay(addDays(baseDate, 14));

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

      setAppointments(allAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStarredAppointments = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('starred_appointments')
        .select('id, appointment_id, external_event_id')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id);

      if (error) throw error;

      const ids = new Set<string>();
      data?.forEach(item => {
        if (item.appointment_id) ids.add(item.appointment_id);
        if (item.external_event_id) ids.add(item.external_event_id);
      });
      setStarredIds(ids);
    } catch (error) {
      console.error('Error loading starred appointments:', error);
    }
  };

  const toggleStar = async (apt: Appointment) => {
    if (!meetingId || !user?.id || !currentTenant?.id) return;

    const isCurrentlyStarred = starredIds.has(apt.id);

    // Optimistic update
    setStarredIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyStarred) {
        newSet.delete(apt.id);
      } else {
        newSet.add(apt.id);
      }
      return newSet;
    });

    try {
      if (isCurrentlyStarred) {
        // Remove star
        await supabase
          .from('starred_appointments')
          .delete()
          .eq('meeting_id', meetingId)
          .eq('user_id', user.id)
          .or(`appointment_id.eq.${apt.id},external_event_id.eq.${apt.id}`);
      } else {
        // Add star
        const insertData: any = {
          meeting_id: meetingId,
          user_id: user.id,
          tenant_id: currentTenant.id
        };
        
        if (apt.isExternal) {
          insertData.external_event_id = apt.id;
        } else {
          insertData.appointment_id = apt.id;
        }

        await supabase.from('starred_appointments').insert(insertData);
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      // Rollback on error
      setStarredIds(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyStarred) {
          newSet.add(apt.id);
        } else {
          newSet.delete(apt.id);
        }
        return newSet;
      });
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

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'meeting': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'internal': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'external': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'parliamentary': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Calculate the global index for an appointment
  const getGlobalIndex = (apt: Appointment) => {
    return appointments.findIndex(a => a.id === apt.id);
  };

  const renderAppointment = (apt: Appointment) => {
    const isStarred = starredIds.has(apt.id);
    const globalIdx = getGlobalIndex(apt);
    const isFocused = globalIdx === focusedIndex;
    
    return (
      <div 
        key={apt.id} 
        className={cn(
          "flex items-start gap-3 py-2 px-3 rounded-md transition-all",
          isStarred ? "bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/50",
          isFocused && "ring-2 ring-primary bg-primary/10 scale-[1.02]"
        )}
        style={apt.isExternal && apt.calendarColor ? { borderLeft: `3px solid ${apt.calendarColor}` } : undefined}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            toggleStar(apt);
          }}
        >
          <Star 
            className={cn(
              "h-4 w-4 transition-colors",
              isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            )} 
          />
        </Button>
        <div className="flex flex-col items-center min-w-[50px] text-xs text-muted-foreground">
          <span className="font-medium">{format(new Date(apt.start_time), 'EEE', { locale: de })}</span>
          <span className="text-lg font-bold text-foreground">{format(new Date(apt.start_time), 'd')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-medium text-sm truncate", 
            isStarred && "text-amber-700 dark:text-amber-300",
            isFocused && "text-primary font-semibold"
          )}>
            {apt.title}
          </div>
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
  };

  const renderWeekSection = (title: string, weekAppointments: Appointment[]) => {
    if (weekAppointments.length === 0) return null;
    
    const sortedAppointments = [...weekAppointments].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    return (
      <div className="space-y-1">
        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1">
          {title}
        </h5>
        <div className="space-y-0.5">
          {sortedAppointments.map(renderAppointment)}
        </div>
      </div>
    );
  };

  const starredCount = appointments.filter(apt => starredIds.has(apt.id)).length;

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
        <div className="ml-auto flex items-center gap-2">
          {focusedIndex >= 0 && focusedIndex < appointments.length && (
            <Badge variant="outline" className="text-xs bg-primary/10 border-primary text-primary">
              {focusedIndex + 1}/{appointments.length}
            </Badge>
          )}
          {starredCount > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
              <Star className="h-3 w-3 mr-1 fill-amber-400" />
              {starredCount}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {appointments.length}
          </Badge>
        </div>
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
            
            {/* Keyboard hint */}
            {focusedIndex >= 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded">
                <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">n</kbd>
                <span>Nächster</span>
                <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">p</kbd>
                <span>Vorheriger</span>
                <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px]">s</kbd>
                <span>Stern setzen</span>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
});

FocusModeUpcomingAppointments.displayName = 'FocusModeUpcomingAppointments';
