import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell, Clock, Mail, Smartphone, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PushNotificationTest } from './PushNotificationTest';
import { VapidKeyTest } from './VapidKeyTest';
import { DirectPushTest } from './DirectPushTest';
import { cn } from '@/lib/utils';

interface NotificationType {
  id: string;
  name: string;
  label: string;
  description?: string;
  category?: string;
}

interface NotificationTypeSettings {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  type: NotificationType;
}

// Category metadata with German labels and icons
const CATEGORY_META: Record<string, { label: string; icon: string; order: number }> = {
  tasks: { label: 'Aufgaben', icon: '✅', order: 1 },
  decisions: { label: 'Entscheidungen', icon: '🗳️', order: 2 },
  calendar: { label: 'Termine & Kalender', icon: '📅', order: 3 },
  messages: { label: 'Nachrichten', icon: '💬', order: 4 },
  documents: { label: 'Dokumente & Briefe', icon: '📄', order: 5 },
  knowledge: { label: 'Wissen', icon: '📚', order: 6 },
  meetings: { label: 'Jour fixe', icon: '🤝', order: 7 },
  employee: { label: 'Mitarbeiter', icon: '👥', order: 8 },
  time: { label: 'Zeiterfassung', icon: '⏰', order: 9 },
  notes: { label: 'Notizen', icon: '📝', order: 10 },
  polls: { label: 'Abstimmungen', icon: '📊', order: 11 },
  planning: { label: 'Veranstaltungsplanung', icon: '🎪', order: 12 },
  system: { label: 'System', icon: '⚙️', order: 13 },
};

interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  order: number;
  settings: NotificationTypeSettings[];
}

const CategorySection: React.FC<{
  group: CategoryGroup;
  loading: boolean;
  pushPermission: NotificationPermission;
  onToggleCategory: (category: string, field: 'is_enabled' | 'push_enabled' | 'email_enabled', value: boolean) => void;
  onToggleSingle: (typeId: string, field: 'is_enabled' | 'push_enabled' | 'email_enabled', value: boolean) => void;
}> = ({ group, loading, pushPermission, onToggleCategory, onToggleSingle }) => {
  const [isOpen, setIsOpen] = useState(false);

  const allEnabled = group.settings.every(s => s.is_enabled);
  const someEnabled = group.settings.some(s => s.is_enabled);
  const allPush = group.settings.every(s => s.push_enabled);
  const allEmail = group.settings.every(s => s.email_enabled);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-muted/30">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-lg flex-shrink-0">{group.icon}</span>
          <div className="min-w-0">
            <h4 className="font-medium text-sm">{group.label}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {group.settings.map(s => s.type.label).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {someEnabled && (
            <>
              <div className="flex items-center gap-1.5" title="Push für alle">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={allPush}
                  onCheckedChange={(checked) => onToggleCategory(group.category, 'push_enabled', checked)}
                  disabled={loading || pushPermission !== 'granted'}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center gap-1.5" title="E-Mail für alle">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={allEmail}
                  onCheckedChange={(checked) => onToggleCategory(group.category, 'email_enabled', checked)}
                  disabled={loading}
                  className="scale-75"
                />
              </div>
            </>
          )}
          <Switch
            checked={allEnabled}
            onCheckedChange={(checked) => onToggleCategory(group.category, 'is_enabled', checked)}
            disabled={loading}
          />
        </div>
      </div>

      {someEnabled && group.settings.length > 1 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Einzelne Typen anpassen
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y border-t">
              {group.settings.map((setting) => (
                <div key={setting.notification_type_id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 mr-3">
                    <p className="text-sm">{setting.type.label}</p>
                    {setting.type.description && (
                      <p className="text-xs text-muted-foreground truncate">{setting.type.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {setting.is_enabled && (
                      <>
                        <Switch
                          checked={setting.push_enabled}
                          onCheckedChange={(checked) => onToggleSingle(setting.notification_type_id, 'push_enabled', checked)}
                          disabled={loading || pushPermission !== 'granted'}
                          className="scale-75"
                        />
                        <Switch
                          checked={setting.email_enabled}
                          onCheckedChange={(checked) => onToggleSingle(setting.notification_type_id, 'email_enabled', checked)}
                          disabled={loading}
                          className="scale-75"
                        />
                      </>
                    )}
                    <Switch
                      checked={setting.is_enabled}
                      onCheckedChange={(checked) => onToggleSingle(setting.notification_type_id, 'is_enabled', checked)}
                      disabled={loading}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

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
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);

  // Check if user has an active push subscription in the DB
  const checkActiveSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      setHasActiveSubscription(!!data && data.length > 0);
    } catch (error) {
      console.error('Error checking active subscription:', error);
      setHasActiveSubscription(false);
    }
  }, [user]);

  useEffect(() => {
    if (pushPermission === 'granted') {
      checkActiveSubscription();
    }
  }, [pushPermission, checkActiveSubscription]);

  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        const { data: types, error: typesError } = await supabase
          .from('notification_types')
          .select('*')
          .eq('is_active', true);

        if (typesError) throw typesError;

        const { data: userSettings, error: settingsError } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user.id);

        if (settingsError) throw settingsError;

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
            type: type as NotificationType,
          };
        }) || [];

        setSettings(combined);

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

  // Group settings by category
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Record<string, NotificationTypeSettings[]> = {};

    settings.forEach(setting => {
      const category = setting.type.category || 'system';
      if (!groups[category]) groups[category] = [];
      groups[category].push(setting);
    });

    return Object.entries(groups)
      .map(([category, items]) => {
        const meta = CATEGORY_META[category] || { label: category, icon: '📌', order: 99 };
        return {
          category,
          label: meta.label,
          icon: meta.icon,
          order: meta.order,
          settings: items,
        };
      })
      .sort((a, b) => a.order - b.order);
  }, [settings]);

  // Update a single setting
  const updateSetting = async (
    typeId: string,
    field: 'is_enabled' | 'push_enabled' | 'email_enabled',
    value: boolean
  ) => {
    if (!user) return;

    // Optimistic update
    setSettings(prev => prev.map(s =>
      s.notification_type_id === typeId ? { ...s, [field]: value } : s
    ));

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
        .upsert(updateData, { onConflict: 'user_id,notification_type_id' })
        .select()
        .single();

      if (error) throw error;

      setSettings(prev => prev.map(s =>
        s.notification_type_id === typeId ? { ...s, id: data.id, [field]: value } : s
      ));
    } catch (error) {
      // Revert optimistic update
      setSettings(prev => prev.map(s =>
        s.notification_type_id === typeId ? { ...s, [field]: !value } : s
      ));
      console.error('Error updating setting:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  // Toggle all settings in a category
  const toggleCategory = async (
    category: string,
    field: 'is_enabled' | 'push_enabled' | 'email_enabled',
    value: boolean
  ) => {
    if (!user) return;

    const categorySettings = settings.filter(s => (s.type.category || 'system') === category);

    // Optimistic update
    setSettings(prev => prev.map(s =>
      (s.type.category || 'system') === category ? { ...s, [field]: value } : s
    ));

    try {
      const updates = categorySettings.map(setting => ({
        user_id: user.id,
        notification_type_id: setting.notification_type_id,
        is_enabled: field === 'is_enabled' ? value : setting.is_enabled,
        push_enabled: field === 'push_enabled' ? value : setting.push_enabled,
        email_enabled: field === 'email_enabled' ? value : setting.email_enabled,
        quiet_hours_start: setting.quiet_hours_start || '22:00',
        quiet_hours_end: setting.quiet_hours_end || '08:00',
      }));

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(updates, { onConflict: 'user_id,notification_type_id' });

      if (error) throw error;
    } catch (error) {
      // Revert
      setSettings(prev => prev.map(s =>
        (s.type.category || 'system') === category ? { ...s, [field]: !value } : s
      ));
      console.error('Error updating category settings:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  };

  // Update quiet hours
  const updateQuietHours = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const updates = settings.map(setting => ({
        user_id: user.id,
        notification_type_id: setting.notification_type_id,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
        is_enabled: setting.is_enabled,
        push_enabled: setting.push_enabled,
        email_enabled: setting.email_enabled,
      }));

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(updates, { onConflict: 'user_id,notification_type_id' });

      if (error) throw error;

      setSettings(prev => prev.map(s => ({
        ...s,
        quiet_hours_start: quietHoursStart,
        quiet_hours_end: quietHoursEnd,
      })));

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

  const enablePushNotifications = async () => {
    const success = await requestPushPermission();
    if (success) {
      await subscribeToPush();
      await checkActiveSubscription();
    }
  };

  const renewPushSubscription = async () => {
    try {
      await subscribeToPush();
      await checkActiveSubscription();
    } catch (error) {
      console.error('Error renewing push subscription:', error);
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
                    pushPermission === 'granted'
                      ? (hasActiveSubscription === false ? 'Berechtigung erteilt, aber Verbindung abgelaufen' : 'Aktiviert')
                      : pushPermission === 'denied' ? 'Blockiert' : 'Nicht aktiviert'
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

              {pushPermission === 'granted' && hasActiveSubscription === false && (
                <Button onClick={renewPushSubscription} variant="outline">
                  Push erneuern
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

      {/* Grouped Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Benachrichtigungstypen
          </CardTitle>
          <CardDescription>
            Wählen Sie pro Bereich, wie Sie benachrichtigt werden möchten.
            Die Spalten zeigen: <Smartphone className="h-3 w-3 inline" /> Push · <Mail className="h-3 w-3 inline" /> E-Mail · Hauptschalter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryGroups.map((group) => (
              <CategorySection
                key={group.category}
                group={group}
                loading={loading}
                pushPermission={pushPermission}
                onToggleCategory={toggleCategory}
                onToggleSingle={updateSetting}
              />
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-medium mb-4">Push-System Tests</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <VapidKeyTest />
              <PushNotificationTest />
              <DirectPushTest />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
