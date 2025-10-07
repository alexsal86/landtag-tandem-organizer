import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Clock, Save } from "lucide-react";

export function CalendarSyncSettings() {
  const { currentTenant } = useTenant();
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState({
    sync_interval_hours: 24,
    sync_time: '06:00:00',
    is_enabled: true
  });

  useEffect(() => {
    loadSettings();
  }, [currentTenant]);

  const loadSettings = async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('calendar_sync_settings')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          sync_interval_hours: data.sync_interval_hours,
          sync_time: data.sync_time,
          is_enabled: data.is_enabled
        });
      } else {
        // Create default settings if none exist
        const { error: insertError } = await supabase
          .from('calendar_sync_settings')
          .insert({
            tenant_id: currentTenant.id,
            sync_interval_hours: 24,
            sync_time: '06:00:00',
            is_enabled: true
          });
        
        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error loading sync settings:', error);
      toast.error('Fehler beim Laden der Einstellungen');
    }
  };

  const handleSave = async () => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('calendar_sync_settings')
        .update({
          sync_interval_hours: settings.sync_interval_hours,
          sync_time: settings.sync_time,
          is_enabled: settings.is_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      toast.success('Einstellungen erfolgreich gespeichert');
    } catch (error) {
      console.error('Error saving sync settings:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Automatische Kalender-Synchronisation
        </CardTitle>
        <CardDescription>
          Konfigurieren Sie die automatische Synchronisation aller externen Kalender
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="is_enabled">Automatische Synchronisation aktivieren</Label>
            <p className="text-sm text-muted-foreground">
              Kalender werden automatisch im konfigurierten Intervall synchronisiert
            </p>
          </div>
          <Switch
            id="is_enabled"
            checked={settings.is_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_enabled: checked }))}
          />
        </div>

        {settings.is_enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="sync_interval">Synchronisations-Intervall</Label>
              <Select
                value={settings.sync_interval_hours.toString()}
                onValueChange={(value) => setSettings(prev => ({ ...prev, sync_interval_hours: parseInt(value) }))}
              >
                <SelectTrigger id="sync_interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Stündlich</SelectItem>
                  <SelectItem value="2">Alle 2 Stunden</SelectItem>
                  <SelectItem value="4">Alle 4 Stunden</SelectItem>
                  <SelectItem value="6">Alle 6 Stunden</SelectItem>
                  <SelectItem value="12">Alle 12 Stunden</SelectItem>
                  <SelectItem value="24">Täglich</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Wie oft sollen die Kalender automatisch synchronisiert werden?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync_time">Erste Synchronisation des Tages</Label>
              <Input
                id="sync_time"
                type="time"
                value={settings.sync_time}
                onChange={(e) => setSettings(prev => ({ ...prev, sync_time: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Uhrzeit für die erste tägliche Synchronisation (weitere Syncs folgen im konfigurierten Intervall)
              </p>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          Einstellungen speichern
        </Button>
      </CardContent>
    </Card>
  );
}
