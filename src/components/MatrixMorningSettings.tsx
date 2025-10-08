import React, { useState, useEffect } from 'react';
import { Sun, Clock, CloudSun, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MorningSettings {
  id?: string;
  enabled: boolean;
  send_time: string;
  include_greeting: boolean;
  include_weather: boolean;
  include_appointments: boolean;
}

export const MatrixMorningSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<MorningSettings>({
    enabled: false,
    send_time: '07:00',
    include_greeting: true,
    include_weather: true,
    include_appointments: true,
  });
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('matrix_morning_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading morning settings:', error);
          return;
        }

        if (data) {
          setSettings({
            id: data.id,
            enabled: data.enabled,
            send_time: data.send_time.substring(0, 5), // HH:MM format
            include_greeting: data.include_greeting,
            include_weather: data.include_weather,
            include_appointments: data.include_appointments,
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('matrix_morning_settings')
        .upsert({
          user_id: user.id,
          enabled: settings.enabled,
          send_time: settings.send_time + ':00', // Add seconds
          include_greeting: settings.include_greeting,
          include_weather: settings.include_weather,
          include_appointments: settings.include_appointments,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving settings:', error);
        toast({
          title: 'Fehler',
          description: 'Morgengruß-Einstellungen konnten nicht gespeichert werden.',
          variant: 'destructive',
        });
        return;
      }

      setHasChanges(false);
      toast({
        title: 'Gespeichert',
        description: 'Morgengruß-Einstellungen wurden erfolgreich gespeichert.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Fehler',
        description: 'Ein unerwarteter Fehler ist aufgetreten.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof MorningSettings>(
    key: K,
    value: MorningSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5" />
          Morgengruß-Einstellungen
        </CardTitle>
        <CardDescription>
          Erhalten Sie jeden Morgen eine personalisierte Begrüßung via Matrix
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Morgengruß aktivieren</Label>
            <p className="text-sm text-muted-foreground">
              Erhalten Sie täglich eine motivierende Nachricht
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
            disabled={loading}
          />
        </div>

        {/* Time picker */}
        <div className="space-y-2">
          <Label htmlFor="send-time" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Versandzeit
          </Label>
          <Input
            id="send-time"
            type="time"
            value={settings.send_time}
            onChange={(e) => updateSetting('send_time', e.target.value)}
            disabled={loading || !settings.enabled}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            Wählen Sie die Uhrzeit für Ihren täglichen Morgengruß
          </p>
        </div>

        {/* Content options */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Inhalte</h4>
          
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Sun className="h-4 w-4" />
              Motivierende Begrüßung
            </Label>
            <Switch
              checked={settings.include_greeting}
              onCheckedChange={(checked) => updateSetting('include_greeting', checked)}
              disabled={loading || !settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 cursor-pointer">
              <CloudSun className="h-4 w-4" />
              Wetter (Karlsruhe & Stuttgart)
            </Label>
            <Switch
              checked={settings.include_weather}
              onCheckedChange={(checked) => updateSetting('include_weather', checked)}
              disabled={loading || !settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 cursor-pointer">
              <Calendar className="h-4 w-4" />
              Heutige Termine
            </Label>
            <Switch
              checked={settings.include_appointments}
              onCheckedChange={(checked) => updateSetting('include_appointments', checked)}
              disabled={loading || !settings.enabled}
            />
          </div>
        </div>

        {/* Preview */}
        {settings.enabled && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Vorschau</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>📅 Täglich um {settings.send_time} Uhr</p>
              {settings.include_greeting && <p>✅ Motivierende Begrüßung</p>}
              {settings.include_weather && <p>☀️ Wetterbericht für Karlsruhe & Stuttgart</p>}
              {settings.include_appointments && <p>📆 Übersicht über heutige Termine</p>}
            </div>
          </div>
        )}

        {/* Save button */}
        <Button 
          onClick={handleSave} 
          disabled={loading || !hasChanges}
          className="w-full"
        >
          {loading ? 'Speichern...' : 'Einstellungen speichern'}
        </Button>
      </CardContent>
    </Card>
  );
};
