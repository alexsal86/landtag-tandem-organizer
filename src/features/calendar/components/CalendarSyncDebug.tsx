import { useTenant } from "@/hooks/useTenant";
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import { notify } from "@/lib/notify";

interface ValidationResult {
  icsEventCount: number;
  dbEventCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  missingInDb: number;
  extraInDb: number;
  sampleComparison: {
    icsEvents: Array<{uid: string, summary: string, dtstart: string}>;
    dbEvents: Array<{external_uid: string, title: string, start_time: string}>;
  };
  recommendations: string[];
}

interface SyncSuccessResponse {
  status: 'success';
  message?: string;
  started?: boolean;
}

interface SyncPartialResponse {
  status: 'partial';
  message?: string;
  warnings?: string[];
}

interface SyncErrorResponse {
  status: 'error';
  message: string;
  details?: string;
}

type ForceResyncResponse = SyncSuccessResponse | SyncPartialResponse | SyncErrorResponse;

export function CalendarSyncDebug() {
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const { currentTenant } = useTenant();
  const [calendarId, setCalendarId] = useState('');
  const [calendars, setCalendars] = useState<Array<{id: string; name: string}>>([]);
  useEffect(() => {
    let cancelled = false;
    setCalendarId(''); setValidationResult(null); setCalendars([]);
    if (currentTenant?.id) {
      void supabase.from('external_calendars').select('id, name').eq('tenant_id', currentTenant.id).then(({ data, error }) => {
        if (cancelled) return;
        if (error) { notify.error('Kalender konnten nicht geladen werden'); return; }
        setCalendars(data ?? []);
      });
    }
    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  const validateCalendar = async () => {
    if (!calendarId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ics-validation', {
        body: { calendar_id: calendarId }
      });

      if (error) throw error;

      setValidationResult(data);
      notify.success('Kalender-Validierung abgeschlossen');
    } catch (error) {
      debugConsole.error('Validation error:', error);
      notify.error('Fehler bei der Validierung: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const forceResync = async () => {
    if (!calendarId || !confirm('Die importierten Termine dieses Kalenders werden gelöscht und neu geladen. Fortfahren?')) return;
    setSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-resync-calendar', {
        body: { 
          calendar_id: calendarId,
          clear_existing: true 
        }
      });

      if (error) throw error;

      if (!data || data.status === 'error') {
        notify.error(data?.message ?? 'Fehler beim Neuaufbau');
        return;
      }

      const method = data.status === 'partial' ? notify.warning : notify.success;
      method(data.message ?? 'Kalender-Neuaufbau erfolgreich gestartet');
      
      await validateCalendar();
    } catch (error) {
      debugConsole.error('Force resync error:', error);
      notify.error('Fehler beim Neuaufbau: ' + (error as Error).message);
    } finally {
      setSyncLoading(false);
    }
  };

  const getStatusIcon = (count: number, threshold: number = 0) => {
    if (count === 0) return <CheckCircle className="w-4 h-4 text-palette-green" />;
    if (count <= threshold) return <AlertTriangle className="w-4 h-4 text-palette-yellow" />;
    return <XCircle className="w-4 h-4 text-palette-red" />;
  };

  const getStatusColor = (count: number, threshold: number = 0) => {
    if (count === 0) return 'bg-palette-green/20 text-palette-green border-palette-green/30';
    if (count <= threshold) return 'bg-palette-yellow/20 text-palette-yellow border-palette-yellow/30';
    return 'bg-palette-red/20 text-palette-red border-palette-red/30';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Kalender-Synchronisation Debug Tools
          </CardTitle>
          <CardDescription>
            Validierung und Debugging der externen Kalender-Synchronisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm">Kalender des aktuellen Büros
            <select className="mt-2 block w-full rounded border bg-background p-2" value={calendarId} disabled={loading || syncLoading} onChange={event => { setCalendarId(event.target.value); setValidationResult(null); }}>
              <option value="">Kalender auswählen</option>
              {calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <Button 
              onClick={validateCalendar}
              disabled={loading || syncLoading || !calendarId}
              variant="outline"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ICS Validierung starten
            </Button>
            
            <Button 
              onClick={forceResync}
              disabled={loading || syncLoading || !calendarId}
              variant="destructive"
            >
              {syncLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vollständigen Neuaufbau erzwingen
            </Button>
          </div>

          {validationResult && (
            <div className="space-y-4">
              <Separator />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-palette-blue">
                    {validationResult.icsEventCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Events in ICS
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-palette-green">
                    {validationResult.dbEventCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Events in DB
                  </div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${validationResult.missingInDb > 0 ? 'text-palette-red' : 'text-palette-green'}`}>
                    {validationResult.missingInDb}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Fehlend in DB
                  </div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${validationResult.extraInDb > 0 ? 'text-palette-yellow' : 'text-palette-green'}`}>
                    {validationResult.extraInDb}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Extra in DB
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Sync Status</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(validationResult.missingInDb)}
                  >
                    {getStatusIcon(validationResult.missingInDb)}
                    <span className="ml-1">{validationResult.missingInDb} fehlende Events</span>
                  </Badge>
                  
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(validationResult.extraInDb, 5)}
                  >
                    {getStatusIcon(validationResult.extraInDb, 5)}
                    <span className="ml-1">{validationResult.extraInDb} zusätzliche Events</span>
                  </Badge>
                </div>
              </div>

              {validationResult.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Empfehlungen</h4>
                  {validationResult.recommendations.map((rec: string, index: number) => (
                    <Alert key={index}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium">Stichprobe ICS Events</h4>
                <div className="text-sm space-y-1">
                  {validationResult.sampleComparison.icsEvents.map((event: { uid: string; summary: string; dtstart: string }, index: number) => (
                    <div key={index} className="p-2 bg-muted rounded text-xs">
                      <strong>{event.summary}</strong><br />
                      UID: {event.uid}<br />
                      Start: {event.dtstart}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Stichprobe DB Events</h4>
                <div className="text-sm space-y-1">
                  {validationResult.sampleComparison.dbEvents.map((event: { external_uid: string; title: string; start_time: string }, index: number) => (
                    <div key={index} className="p-2 bg-muted rounded text-xs">
                      <strong>{event.title}</strong><br />
                      UID: {event.external_uid}<br />
                      Start: {new Date(event.start_time).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Validierungsbereich: {new Date(validationResult.dateRangeStart).toLocaleDateString()} - {new Date(validationResult.dateRangeEnd).toLocaleDateString()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
