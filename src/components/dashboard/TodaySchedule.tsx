import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  is_all_day: boolean;
}

interface TodayScheduleProps {
  onCountChange?: (count: number) => void;
}

export const TodaySchedule = ({ onCountChange }: TodayScheduleProps) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
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
        
        // Extended time windows for all-day events (UTC issues)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayAfterTomorrow = new Date(today);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        
        // Normal appointments
        const { data: normalAppointments } = await supabase
          .from('appointments')
          .select('id, title, start_time, location, is_all_day')
          .eq('tenant_id', currentTenant.id)
          .eq('is_all_day', false)
          .gte('start_time', today.toISOString())
          .lt('start_time', tomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        // All-day appointments (larger time window for UTC)
        const { data: allDayAppointments } = await supabase
          .from('appointments')
          .select('id, title, start_time, location, is_all_day')
          .eq('tenant_id', currentTenant.id)
          .eq('is_all_day', true)
          .gte('start_time', yesterday.toISOString())
          .lt('start_time', dayAfterTomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        // External calendar events (type-safe cast to avoid deep instantiation)
        const externalEventsResult = await (supabase as any)
          .from('external_events')
          .select('id, title, start_time, location, all_day')
          .eq('tenant_id', currentTenant.id)
          .gte('start_time', yesterday.toISOString())
          .lt('start_time', dayAfterTomorrow.toISOString())
          .order('start_time', { ascending: true });
        
        // Map external events to Appointment type
        const externalEventsFormatted: Appointment[] = (externalEventsResult.data || []).map((e: any) => ({
          id: e.id as string,
          title: e.title as string,
          start_time: e.start_time as string,
          location: (e.location as string | null) ?? null,
          is_all_day: (e.all_day as boolean) ?? false
        }));
        
        // Combine all events
        const allEvents: Appointment[] = [
          ...(normalAppointments || []),
          ...(allDayAppointments || []),
          ...externalEventsFormatted
        ];
        
        // Filter for local time (German time = UTC+1/+2)
        const filteredEvents = allEvents.filter(event => {
          const eventDate = new Date(event.start_time);
          const localDate = new Date(eventDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
          return localDate.toDateString() === today.toDateString();
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        
        setAppointments(filteredEvents);
        if (onCountChange) {
          onCountChange(filteredEvents.length);
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTodayAppointments();
  }, [user, currentTenant, onCountChange]);
  
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
            {appointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
