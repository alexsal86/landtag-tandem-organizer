import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface TodayScheduleProps {
  onCountChange?: (count: number) => void;
}

export const TodaySchedule = ({ onCountChange }: TodayScheduleProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTodayAppointments = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        const { data, error } = await supabase
          .from('appointments')
          .select('id, title, start_time, location')
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`)
          .order('start_time', { ascending: true });
        
        if (!error && data) {
          setAppointments(data);
          if (onCountChange) {
            onCountChange(data.length);
          }
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTodayAppointments();
  }, []);
  
  if (loading) {
    return null;
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
                    {format(new Date(apt.start_time), 'HH:mm', { locale: de })} Uhr
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
