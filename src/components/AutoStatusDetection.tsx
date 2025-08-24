import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useUserStatus } from '@/hooks/useUserStatus';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Activity, Clock, Settings2, Zap } from 'lucide-react';

export const AutoStatusDetection: React.FC = () => {
  const { user } = useAuth();
  const { currentStatus, updateStatus } = useUserStatus();
  const [settings, setSettings] = useState({
    auto_away_enabled: true,
    away_timeout_minutes: 10,
    auto_back_enabled: true,
    meeting_detection_enabled: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentStatus) {
      setSettings(prev => ({
        ...prev,
        auto_away_enabled: currentStatus.auto_away_enabled
      }));
      setLoading(false);
    }
  }, [user, currentStatus]);

  const updateSettings = async (newSettings: Partial<typeof settings>) => {
    if (!user) return;

    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Update user_status table
      const { error } = await supabase
        .from('user_status')
        .upsert({
          user_id: user.id,
          auto_away_enabled: updatedSettings.auto_away_enabled
        }, { onConflict: 'user_id' });

      if (error) throw error;

      toast.success('Einstellungen gespeichert');
    } catch (error) {
      console.error('Error updating auto status settings:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    }
  };

  const detectMeetingFromCalendar = async () => {
    try {
      // Check if user has a meeting in the next 5 minutes
      const now = new Date();
      const soon = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user?.id)
        .eq('category', 'meeting')
        .gte('start_time', now.toISOString())
        .lte('start_time', soon.toISOString())
        .eq('status', 'planned');

      if (error) throw error;

      if (appointments && appointments.length > 0) {
        await updateStatus('meeting');
        toast.success('Status automatisch auf "In Besprechung" gesetzt');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error detecting meeting:', error);
      return false;
    }
  };

  const forceAwayStatus = async () => {
    await updateStatus('away');
    toast.success('Status auf "Abwesend" gesetzt');
  };

  const forceOnlineStatus = async () => {
    await updateStatus('online');
    toast.success('Status auf "Online" gesetzt');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Automatische Status-Erkennung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Automatische Status-Erkennung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Aktueller Status
            </Badge>
          </div>
          <Badge variant="secondary">
            {currentStatus?.status_type || 'Offline'}
          </Badge>
        </div>

        {/* Auto Away Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Automatisch "Abwesend" setzen
              </Label>
              <p className="text-sm text-muted-foreground">
                Status wird nach Inaktivität automatisch geändert
              </p>
            </div>
            <Switch
              checked={settings.auto_away_enabled}
              onCheckedChange={(checked) => updateSettings({ auto_away_enabled: checked })}
            />
          </div>

          {settings.auto_away_enabled && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <Label className="text-sm">
                Timeout: {settings.away_timeout_minutes} Minuten
              </Label>
              <Slider
                value={[settings.away_timeout_minutes]}
                onValueChange={([value]) => updateSettings({ away_timeout_minutes: value })}
                min={5}
                max={60}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 Min</span>
                <span>60 Min</span>
              </div>
            </div>
          )}
        </div>

        {/* Auto Back Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Automatisch zurück zu "Online"
              </Label>
              <p className="text-sm text-muted-foreground">
                Status wird bei Aktivität automatisch zurückgesetzt
              </p>
            </div>
            <Switch
              checked={settings.auto_back_enabled}
              onCheckedChange={(checked) => updateSettings({ auto_back_enabled: checked })}
            />
          </div>
        </div>

        {/* Meeting Detection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Meeting-Erkennung
              </Label>
              <p className="text-sm text-muted-foreground">
                Status wird automatisch vor Terminen geändert
              </p>
            </div>
            <Switch
              checked={settings.meeting_detection_enabled}
              onCheckedChange={(checked) => updateSettings({ meeting_detection_enabled: checked })}
            />
          </div>

          {settings.meeting_detection_enabled && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <Button
                variant="outline"
                size="sm"
                onClick={detectMeetingFromCalendar}
                className="w-full"
              >
                Jetzt prüfen
              </Button>
              <p className="text-xs text-muted-foreground">
                Prüft, ob in den nächsten 5 Minuten ein Meeting ansteht
              </p>
            </div>
          )}
        </div>

        {/* Manual Controls */}
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-sm font-medium">Manuell setzen</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={forceOnlineStatus}
              className="flex-1"
            >
              Online
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={forceAwayStatus}
              className="flex-1"
            >
              Abwesend
            </Button>
          </div>
        </div>

        {/* Activity Info */}
        <div className="p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm">Aktivitätserkennung</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Das System erkennt Mausbewegungen, Klicks, Tastatureingaben und Scrollen. 
            Bei Inaktivität wird der Status automatisch geändert.
          </p>
          {currentStatus?.last_activity && (
            <p className="text-xs text-muted-foreground mt-1">
              Letzte Aktivität: {new Date(currentStatus.last_activity).toLocaleString('de-DE')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};