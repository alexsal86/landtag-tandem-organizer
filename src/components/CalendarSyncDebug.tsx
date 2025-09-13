import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function CalendarSyncDebug() {
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const calendarId = '3d6e2d5b-fe74-4e94-ab69-6a5b91f72803'; // MdL Salomon Calendar

  const validateCalendar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ics-validation', {
        body: { calendar_id: calendarId }
      });

      if (error) throw error;

      setValidationResult(data);
      toast.success('Kalender-Validierung abgeschlossen');
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Fehler bei der Validierung: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const forceResync = async () => {
    setSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-resync-calendar', {
        body: { 
          calendar_id: calendarId,
          clear_existing: true 
        }
      });

      if (error) throw error;

      toast.success('Kalender-Neuaufbau erfolgreich gestartet');
      
      // Re-validate after sync
      setTimeout(() => {
        validateCalendar();
      }, 2000);
    } catch (error) {
      console.error('Force resync error:', error);
      toast.error('Fehler beim Neuaufbau: ' + (error as Error).message);
    } finally {
      setSyncLoading(false);
    }
  };

  const getStatusIcon = (count: number, threshold: number = 0) => {
    if (count === 0) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (count <= threshold) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const getStatusColor = (count: number, threshold: number = 0) => {
    if (count === 0) return 'bg-green-100 text-green-800 border-green-200';
    if (count <= threshold) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
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
          <div className="flex gap-2">
            <Button 
              onClick={validateCalendar}
              disabled={loading}
              variant="outline"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ICS Validierung starten
            </Button>
            
            <Button 
              onClick={forceResync}
              disabled={syncLoading}
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
                  <div className="text-2xl font-bold text-blue-600">
                    {validationResult.icsEventCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Events in ICS
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {validationResult.dbEventCount}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Events in DB
                  </div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${validationResult.missingInDb > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {validationResult.missingInDb}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Fehlend in DB
                  </div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${validationResult.extraInDb > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
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
                  {validationResult.recommendations.map((rec, index) => (
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
                  {validationResult.sampleComparison.icsEvents.map((event, index) => (
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
                  {validationResult.sampleComparison.dbEvents.map((event, index) => (
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