import React, { useState, useEffect } from 'react';
import { Bell, Clock, Mail, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface NotificationTypeSettings {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  type: {
    id: string;
    name: string;
    label: string;
    description?: string;
  };
}

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    pushSupported, 
    pushPermission, 
    requestPushPermission, 
    subscribeToPush 
  } = useNotifications();
  
  const [settings, setSettings] = useState<NotificationTypeSettings[]>([]);
  const [loading, setLoading] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        // Get all notification types
        const { data: types, error: typesError } = await supabase
          .from('notification_types')
          .select('*')
          .eq('is_active', true);

        if (typesError) throw typesError;

        // Get user settings
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user.id);

        if (settingsError) throw settingsError;

        // Combine types with settings
        const combined = types?.map(type => {
          const setting = userSettings?.find(s => s.notification_type_id === type.id);
          return {
            id: setting?.id || '',
            notification_type_id: type.id,
            is_enabled: setting?.is_enabled ?? true,
            push_enabled: setting?.push_enabled ?? false,
            email_enabled: setting?.email_enabled ?? false,
            quiet_hours_start: setting?.quiet_hours_start || '22:00',
            quiet_hours_end: setting?.quiet_hours_end || '08:00',
            type,
          };
        }) || [];

        setSettings(combined);
        
        // Set global quiet hours from first setting
        if (combined.length > 0) {
          setQuietHoursStart(combined[0].quiet_hours_start || '22:00');
          setQuietHoursEnd(combined[0].quiet_hours_end || '08:00');
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
        toast({
          title: 'Fehler',
          description: 'Benachrichtigungseinstellungen konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    };

    loadSettings();
  }, [user, toast]);

  // Update setting
  const updateSetting = async (
    typeId: string, 
    field: keyof Omit<NotificationTypeSettings, 'id' | 'notification_type_id' | 'type'>,
    value: boolean | string
  ) => {
    if (!user) return;

    setLoading(true);
    try {
      const setting = settings.find(s => s.notification_type_id === typeId);
      
      const updateData = {
        user_id: user.id,
        notification_type_id: typeId,
        is_enabled: setting?.is_enabled ?? true,
        push_enabled: setting?.push_enabled ?? false,
        email_enabled: setting?.email_enabled ?? false,
        quiet_hours_start: setting?.quiet_hours_start || '22:00',
        quiet_hours_end: setting?.quiet_hours_end || '08:00',
        [field]: value,
      };

      const { error, data } = await supabase
        .from('user_notification_settings')
        .upsert(updateData, {
          onConflict: 'user_id,notification_type_id'
        })
        .select()
        .single();
      
      if (error) throw error;

      // Update local state with the returned data
      setSettings(prev => prev.map(s => 
        s.notification_type_id === typeId 
          ? { 
              ...s, 
              id: data.id,
              [field]: value 
            }
          : s
      ));

      toast({
        title: 'Gespeichert',
        description: 'Einstellungen wurden erfolgreich gespeichert.',
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Update quiet hours for all settings
  const updateQuietHours = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create upsert data for all notification types
      const updates = settings.map(setting => ({
        user_id: user.id,
        notification_type_id: setting.notification_type_id,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        is_enabled: setting.is_enabled,
        push_enabled: setting.push_enabled,
        email_enabled: setting.email_enabled,
      }));

      const { error, data } = await supabase
        .from('user_notification_settings')
        .upsert(updates, {
          onConflict: 'user_id,notification_type_id'
        })
        .select();

      if (error) throw error;

      // Update local state with returned data
      setSettings(prev => prev.map(setting => {
        const updatedSetting = data?.find(d => d.notification_type_id === setting.notification_type_id);
        return updatedSetting ? {
          ...setting,
          id: updatedSetting.id,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
        } : {
          ...setting,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
        };
      }));

      toast({
        title: 'Gespeichert',
        description: 'Ruhezeiten wurden erfolgreich gespeichert.',
      });
    } catch (error) {
      console.error('Error updating quiet hours:', error);
      toast({
        title: 'Fehler',
        description: 'Ruhezeiten konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Enable push notifications
  const enablePushNotifications = async () => {
    const success = await requestPushPermission();
    if (success) {
      await subscribeToPush();
    }
  };

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push-Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Erhalten Sie sofortige Benachrichtigungen in Ihrem Browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
            </div>
          )}
          
          {pushSupported && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Browser-Benachrichtigungen</Label>
                <p className="text-sm text-muted-foreground">
                  Status: {
                    pushPermission === 'granted' ? 'Aktiviert' :
                    pushPermission === 'denied' ? 'Blockiert' : 'Nicht aktiviert'
                  }
                </p>
              </div>
              
              {pushPermission !== 'granted' && (
                <Button 
                  onClick={enablePushNotifications}
                  disabled={pushPermission === 'denied'}
                >
                  Aktivieren
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ruhezeiten
          </CardTitle>
          <CardDescription>
            Keine Benachrichtigungen während dieser Zeiten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quiet-start">Von</Label>
              <Input
                id="quiet-start"
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quiet-end">Bis</Label>
              <Input
                id="quiet-end"
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={updateQuietHours} disabled={loading}>
            Ruhezeiten speichern
          </Button>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungstypen
          </CardTitle>
          <CardDescription>
            Wählen Sie, für welche Ereignisse Sie benachrichtigt werden möchten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {settings.map((setting) => (
              <div key={setting.notification_type_id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{setting.type.label}</h4>
                    {setting.type.description && (
                      <p className="text-sm text-muted-foreground">
                        {setting.type.description}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={setting.is_enabled}
                    onCheckedChange={(checked) => 
                      updateSetting(setting.notification_type_id, 'is_enabled', checked)
                    }
                    disabled={loading}
                  />
                </div>
                
                {setting.is_enabled && (
                  <div className="ml-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Push-Benachrichtigung
                      </Label>
                      <Switch
                        checked={setting.push_enabled}
                        onCheckedChange={(checked) => 
                          updateSetting(setting.notification_type_id, 'push_enabled', checked)
                        }
                        disabled={loading || pushPermission !== 'granted'}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        E-Mail-Benachrichtigung
                      </Label>
                      <Switch
                        checked={setting.email_enabled}
                        onCheckedChange={(checked) => 
                          updateSetting(setting.notification_type_id, 'email_enabled', checked)
                        }
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};