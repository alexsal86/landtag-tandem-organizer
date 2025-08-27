import { useState, useEffect } from "react";
import { Plus, Trash2, RefreshCw, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface ExternalCalendar {
  id: string;
  name: string;
  ics_url: string;
  calendar_type: string;
  sync_enabled: boolean;
  last_sync: string | null;
  sync_interval: number;
  color: string;
  is_active: boolean;
  user_id?: string;
  profiles?: {
    display_name: string | null;
  } | null;
}

const CALENDAR_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

export function ExternalCalendarSettings() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [syncingCalendars, setSyncingCalendars] = useState<Set<string>>(new Set());
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ics_url: '',
    calendar_type: 'google',
    color: '#3b82f6',
    sync_interval: 60,
  });

  const fetchCalendars = async () => {
    if (!user || !currentTenant) return;
    
    setIsLoading(true);
    try {
      // Fetch all calendars in the tenant (visible to all office users)
      const { data, error } = await supabase
        .from('external_calendars')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalendars((data as unknown) as ExternalCalendar[] || []);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      toast.error('Fehler beim Laden der externen Kalender');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, [user, currentTenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentTenant) return;

    try {
      // Validate ICS URL
      if (!formData.ics_url.includes('.ics') && !formData.ics_url.includes('calendar')) {
        toast.error('Bitte geben Sie eine gültige ICS-URL ein');
        return;
      }

      const { error } = await supabase
        .from('external_calendars')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          name: formData.name,
          ics_url: formData.ics_url,
          calendar_type: formData.calendar_type,
          color: formData.color,
          sync_interval: formData.sync_interval,
        });

      if (error) throw error;

      toast.success('Kalender erfolgreich hinzugefügt');
      setIsDialogOpen(false);
      setFormData({
        name: '',
        ics_url: '',
        calendar_type: 'google',
        color: '#3b82f6',
        sync_interval: 60,
      });
      fetchCalendars();
    } catch (error) {
      console.error('Error adding calendar:', error);
      toast.error('Fehler beim Hinzufügen des Kalenders');
    }
  };

  const handleSync = async (calendarId: string) => {
    setSyncingCalendars(prev => new Set(prev).add(calendarId));
    
    try {
      const { error } = await supabase.functions.invoke('sync-external-calendar', {
        body: { calendar_id: calendarId }
      });

      if (error) throw error;
      
      toast.success('Kalender erfolgreich synchronisiert');
      fetchCalendars(); // Refresh to update last_sync time
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Fehler bei der Synchronisation');
    } finally {
      setSyncingCalendars(prev => {
        const newSet = new Set(prev);
        newSet.delete(calendarId);
        return newSet;
      });
    }
  };

  const handleDelete = async (calendarId: string) => {
    if (!confirm('Möchten Sie diesen Kalender wirklich entfernen?')) return;

    try {
      const { error } = await supabase
        .from('external_calendars')
        .delete()
        .eq('id', calendarId);

      if (error) throw error;
      
      toast.success('Kalender erfolgreich entfernt');
      fetchCalendars();
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast.error('Fehler beim Entfernen des Kalenders');
    }
  };

  const toggleSync = async (calendarId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('external_calendars')
        .update({ sync_enabled: enabled })
        .eq('id', calendarId);

      if (error) throw error;
      
      toast.success(enabled ? 'Synchronisation aktiviert' : 'Synchronisation deaktiviert');
      fetchCalendars();
    } catch (error) {
      console.error('Error toggling sync:', error);
      toast.error('Fehler beim Ändern der Synchronisation');
    }
  };

  const formatLastSync = (lastSync: string | null) => {
    if (!lastSync) return 'Noch nie synchronisiert';
    
    const date = new Date(lastSync);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Externe Kalender</h2>
          <p className="text-muted-foreground">
            Integrieren Sie Google Calendar, Outlook oder andere ICS-Kalender
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Kalender hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Neuen Kalender hinzufügen</DialogTitle>
                <DialogDescription>
                  Fügen Sie einen externen Kalender über eine ICS-URL hinzu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Mein Google Kalender"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ics_url">ICS-URL</Label>
                  <Input
                    id="ics_url"
                    type="url"
                    value={formData.ics_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, ics_url: e.target.value }))}
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calendar_type">Typ</Label>
                    <Select value={formData.calendar_type} onValueChange={(value) => setFormData(prev => ({ ...prev, calendar_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google Calendar</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                        <SelectItem value="generic">Andere ICS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Farbe</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {CALENDAR_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded border-2 ${formData.color === color ? 'border-primary' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Hinzufügen</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {calendars.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Noch keine externen Kalender konfiguriert.
                  <br />
                  Fügen Sie Ihren ersten Kalender hinzu, um zu beginnen.
                </p>
              </CardContent>
            </Card>
          ) : (
            calendars.map((calendar) => (
              <Card key={calendar.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: calendar.color }}
                      />
                      <div>
                        <CardTitle className="text-lg">{calendar.name}</CardTitle>
                        <CardDescription>
                          {calendar.calendar_type === 'google' && 'Google Calendar'}
                          {calendar.calendar_type === 'outlook' && 'Outlook'}
                          {calendar.calendar_type === 'generic' && 'ICS Kalender'}
                          {calendar.profiles?.display_name && (
                            <span className="ml-2 text-xs">• von {calendar.profiles.display_name}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={calendar.sync_enabled ? 'default' : 'secondary'}>
                        {calendar.sync_enabled ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                      {!calendar.sync_enabled && (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <p><strong>Letzte Synchronisation:</strong> {formatLastSync(calendar.last_sync)}</p>
                      <p><strong>Intervall:</strong> Alle {calendar.sync_interval} Minuten</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(calendar.id)}
                          disabled={syncingCalendars.has(calendar.id)}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncingCalendars.has(calendar.id) ? 'animate-spin' : ''}`} />
                          Synchronisieren
                        </Button>
                        {calendar.user_id === user?.id && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSync(calendar.id, !calendar.sync_enabled)}
                            >
                              {calendar.sync_enabled ? 'Deaktivieren' : 'Aktivieren'}
                            </Button>
                          </>
                        )}
                      </div>
                      {calendar.user_id === user?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(calendar.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Entfernen
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}