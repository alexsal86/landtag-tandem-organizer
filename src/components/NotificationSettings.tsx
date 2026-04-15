import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ChangeEvent, JSX } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Clock, Mail, Smartphone, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationType } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface NotificationTypeSettings {
  id: string;
  notification_type_id: string;
  is_enabled: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  type: NotificationType & { category?: string | null };
}

interface UserNotificationSettingsRow {
  id: string;
  notification_type_id: string;
  is_enabled: boolean | null;
  push_enabled: boolean | null;
  email_enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

type NotificationSettingField = 'is_enabled' | 'push_enabled' | 'email_enabled';

const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '08:00';

const CATEGORY_META: Record<string, { label: string; icon: string; order: number }> = {
  tasks: { label: 'Aufgaben', icon: '✅', order: 1 },
  decisions: { label: 'Entscheidungen', icon: '🗳️', order: 2 },
  cases: { label: 'Vorgänge', icon: '📋', order: 3 },
  calendar: { label: 'Termine & Kalender', icon: '📅', order: 4 },
  messages: { label: 'Nachrichten', icon: '💬', order: 5 },
  documents: { label: 'Dokumente & Briefe', icon: '📄', order: 6 },
  knowledge: { label: 'Wissen', icon: '📚', order: 7 },
  meetings: { label: 'Jour fixe', icon: '🤝', order: 8 },
  employee: { label: 'Mitarbeiter', icon: '👥', order: 9 },
  time: { label: 'Zeiterfassung', icon: '⏰', order: 10 },
  notes: { label: 'Notizen', icon: '📝', order: 11 },
  polls: { label: 'Abstimmungen', icon: '📊', order: 12 },
  planning: { label: 'Veranstaltungsplanung', icon: '🎪', order: 13 },
  system: { label: 'System', icon: '⚙️', order: 14 },
};

interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  order: number;
  settings: NotificationTypeSettings[];
}

interface CategorySectionProps {
  group: CategoryGroup;
  loading: boolean;
  pushPermission: NotificationPermission;
  onToggleCategory: (category: string, field: NotificationSettingField, value: boolean) => void;
  onToggleSingle: (typeId: string, field: NotificationSettingField, value: boolean) => void;
}

const getCategoryKey = (setting: NotificationTypeSettings): string => setting.type.category ?? 'system';
const getQuietHoursStart = (value?: string | null): string => value ?? DEFAULT_QUIET_HOURS_START;
const getQuietHoursEnd = (value?: string | null): string => value ?? DEFAULT_QUIET_HOURS_END;

const CategorySection = ({
  group,
  loading,
  pushPermission,
  onToggleCategory,
  onToggleSingle,
}: CategorySectionProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const allEnabled = group.settings.every((setting: NotificationTypeSettings): boolean => setting.is_enabled);
  const someEnabled = group.settings.some((setting: NotificationTypeSettings): boolean => setting.is_enabled);
  const allPush = group.settings.every((setting: NotificationTypeSettings): boolean => setting.push_enabled);
  const allEmail = group.settings.every((setting: NotificationTypeSettings): boolean => setting.email_enabled);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between bg-muted/30 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-lg shrink-0">{group.icon}</span>
          <div className="min-w-0">
            <h4 className="text-sm font-medium">{group.label}</h4>
            <p className="truncate text-xs text-muted-foreground">
              {group.settings.map((setting: NotificationTypeSettings): string => setting.type.label).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {someEnabled && (
            <>
              <div className="flex items-center gap-1.5" title="Push für alle">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={allPush}
                  onCheckedChange={(checked: boolean): void => onToggleCategory(group.category, 'push_enabled', checked)}
                  disabled={loading || pushPermission !== 'granted'}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center gap-1.5" title="E-Mail für alle">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <Switch
                  checked={allEmail}
                  onCheckedChange={(checked: boolean): void => onToggleCategory(group.category, 'email_enabled', checked)}
                  disabled={loading}
                  className="scale-75"
                />
              </div>
            </>
          )}
          <Switch
            checked={allEnabled}
            onCheckedChange={(checked: boolean): void => onToggleCategory(group.category, 'is_enabled', checked)}
            disabled={loading}
          />
        </div>
      </div>

      {someEnabled && group.settings.length > 1 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1 px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Einzelne Typen anpassen
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y border-t">
              {group.settings.map((setting: NotificationTypeSettings) => (
                <div key={setting.notification_type_id} className="flex items-center justify-between px-4 py-3">
                  <div className="mr-3 min-w-0">
                    <p className="text-sm">{setting.type.label}</p>
                    {setting.type.description && (
                      <p className="truncate text-xs text-muted-foreground">{setting.type.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {setting.is_enabled && (
                      <>
                        <Switch
                          checked={setting.push_enabled}
                          onCheckedChange={(checked: boolean): void => onToggleSingle(setting.notification_type_id, 'push_enabled', checked)}
                          disabled={loading || pushPermission !== 'granted'}
                          className="scale-75"
                        />
                        <Switch
                          checked={setting.email_enabled}
                          onCheckedChange={(checked: boolean): void => onToggleSingle(setting.notification_type_id, 'email_enabled', checked)}
                          disabled={loading}
                          className="scale-75"
                        />
                      </>
                    )}
                    <Switch
                      checked={setting.is_enabled}
                      onCheckedChange={(checked: boolean): void => onToggleSingle(setting.notification_type_id, 'is_enabled', checked)}
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

export const NotificationSettings = (): JSX.Element => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { pushSupported, pushPermission, requestPushPermission, subscribeToPush } = useNotifications();

  const [settings, setSettings] = useState<NotificationTypeSettings[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [quietHoursStart, setQuietHoursStart] = useState<string>(DEFAULT_QUIET_HOURS_START);
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>(DEFAULT_QUIET_HOURS_END);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);

  const checkActiveSubscription = useCallback(async (): Promise<void> => {
    if (!user) {
      setHasActiveSubscription(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        throw error;
      }

      setHasActiveSubscription(Boolean(data && data.length > 0));
    } catch (error: unknown) {
      debugConsole.error('Error checking active subscription:', error);
      setHasActiveSubscription(false);
    }
  }, [user]);

  useEffect(() => {
    if (pushPermission === 'granted') {
      void checkActiveSubscription();
    }
  }, [checkActiveSubscription, pushPermission]);

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      if (!user) {
        setSettings([]);
        return;
      }

      try {
        const { data: types, error: typesError } = await supabase
          .from('notification_types')
          .select('*')
          .eq('is_active', true);

        if (typesError) {
          throw typesError;
        }

        const { data: userSettings, error: settingsError } = await supabase
          .from('user_notification_settings')
          .select('*')
          .eq('user_id', user.id);

        if (settingsError) {
          throw settingsError;
        }

        const typedTypes = ((types as Array<NotificationType & { category?: string | null }> | null) ?? []);
        const typedUserSettings = (userSettings as UserNotificationSettingsRow[] | null) ?? [];

        const combined = typedTypes.map((type): NotificationTypeSettings => {
          const setting = typedUserSettings.find(
            (candidate: UserNotificationSettingsRow): boolean => candidate.notification_type_id === type.id,
          );

          return {
            id: setting?.id ?? '',
            notification_type_id: type.id,
            is_enabled: setting?.is_enabled ?? true,
            push_enabled: setting?.push_enabled ?? false,
            email_enabled: setting?.email_enabled ?? false,
            quiet_hours_start: setting?.quiet_hours_start ?? DEFAULT_QUIET_HOURS_START,
            quiet_hours_end: setting?.quiet_hours_end ?? DEFAULT_QUIET_HOURS_END,
            type,
          };
        });

        setSettings(combined);

        if (combined.length > 0) {
          setQuietHoursStart(getQuietHoursStart(combined[0].quiet_hours_start));
          setQuietHoursEnd(getQuietHoursEnd(combined[0].quiet_hours_end));
        }
      } catch (error: unknown) {
        debugConsole.error('Error loading notification settings:', error);
        toast({
          title: 'Fehler',
          description: 'Benachrichtigungseinstellungen konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    };

    void loadSettings();
  }, [toast, user]);

  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Record<string, NotificationTypeSettings[]> = {};

    settings.forEach((setting: NotificationTypeSettings): void => {
      const category = getCategoryKey(setting);
      groups[category] ??= [];
      groups[category].push(setting);
    });

    return Object.entries(groups)
      .map(([category, items]): CategoryGroup => {
        const meta = CATEGORY_META[category] ?? { label: category, icon: '📌', order: 99 };
        return {
          category,
          label: meta.label,
          icon: meta.icon,
          order: meta.order,
          settings: items,
        };
      })
      .sort((left: CategoryGroup, right: CategoryGroup): number => left.order - right.order);
  }, [settings]);

  const updateSetting = useCallback(async (
    typeId: string,
    field: NotificationSettingField,
    value: boolean,
  ): Promise<void> => {
    if (!user) {
      return;
    }

    const previousSettings = settings;
    const currentSetting = previousSettings.find(
      (setting: NotificationTypeSettings): boolean => setting.notification_type_id === typeId,
    );

    setSettings((prev: NotificationTypeSettings[]): NotificationTypeSettings[] =>
      prev.map((setting: NotificationTypeSettings): NotificationTypeSettings =>
        setting.notification_type_id === typeId ? { ...setting, [field]: value } : setting,
      ),
    );

    try {
      const { error, data } = await supabase
        .from('user_notification_settings')
        .upsert(
          {
            user_id: user.id,
            notification_type_id: typeId,
            is_enabled: field === 'is_enabled' ? value : currentSetting?.is_enabled ?? true,
            push_enabled: field === 'push_enabled' ? value : currentSetting?.push_enabled ?? false,
            email_enabled: field === 'email_enabled' ? value : currentSetting?.email_enabled ?? false,
            quiet_hours_start: getQuietHoursStart(currentSetting?.quiet_hours_start),
            quiet_hours_end: getQuietHoursEnd(currentSetting?.quiet_hours_end),
          },
          { onConflict: 'user_id,notification_type_id' },
        )
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      setSettings((prev: NotificationTypeSettings[]): NotificationTypeSettings[] =>
        prev.map((setting: NotificationTypeSettings): NotificationTypeSettings =>
          setting.notification_type_id === typeId ? { ...setting, id: data.id, [field]: value } : setting,
        ),
      );
    } catch (error: unknown) {
      setSettings(previousSettings);
      debugConsole.error('Error updating setting:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellung konnte nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  }, [settings, toast, user]);

  const toggleCategory = useCallback(async (
    category: string,
    field: NotificationSettingField,
    value: boolean,
  ): Promise<void> => {
    if (!user) {
      return;
    }

    const categorySettings = settings.filter(
      (setting: NotificationTypeSettings): boolean => getCategoryKey(setting) === category,
    );
    const previousSettings = settings;

    setSettings((prev: NotificationTypeSettings[]): NotificationTypeSettings[] =>
      prev.map((setting: NotificationTypeSettings): NotificationTypeSettings =>
        getCategoryKey(setting) === category ? { ...setting, [field]: value } : setting,
      ),
    );

    try {
      const updates = categorySettings.map((setting: NotificationTypeSettings) => ({
        user_id: user.id,
        notification_type_id: setting.notification_type_id,
        is_enabled: field === 'is_enabled' ? value : setting.is_enabled,
        push_enabled: field === 'push_enabled' ? value : setting.push_enabled,
        email_enabled: field === 'email_enabled' ? value : setting.email_enabled,
        quiet_hours_start: getQuietHoursStart(setting.quiet_hours_start),
        quiet_hours_end: getQuietHoursEnd(setting.quiet_hours_end),
      }));

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert(updates, { onConflict: 'user_id,notification_type_id' });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      setSettings(previousSettings);
      debugConsole.error('Error updating category settings:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    }
  }, [settings, toast, user]);

  const updateQuietHours = useCallback(async (): Promise<void> => {
    if (!user) {
      return;
    }

    setLoading(true);
    try {
      const updates = settings.map((setting: NotificationTypeSettings) => ({
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

      if (error) {
        throw error;
      }

      setSettings((prev: NotificationTypeSettings[]): NotificationTypeSettings[] =>
        prev.map((setting: NotificationTypeSettings): NotificationTypeSettings => ({
          ...setting,
          quiet_hours_start: quietHoursStart,
          quiet_hours_end: quietHoursEnd,
        })),
      );

      toast({
        title: 'Gespeichert',
        description: 'Ruhezeiten wurden erfolgreich gespeichert.',
      });
    } catch (error: unknown) {
      debugConsole.error('Error updating quiet hours:', error);
      toast({
        title: 'Fehler',
        description: 'Ruhezeiten konnten nicht gespeichert werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [quietHoursEnd, quietHoursStart, settings, toast, user]);

  const enablePushNotifications = useCallback(async (): Promise<void> => {
    const success = await requestPushPermission();
    if (success) {
      // requestPushPermission already calls subscribeToPush on success
      await checkActiveSubscription();
    }
  }, [checkActiveSubscription, requestPushPermission]);

  const renewPushSubscription = useCallback(async (): Promise<void> => {
    try {
      await subscribeToPush();
      await checkActiveSubscription();
    } catch (error: unknown) {
      debugConsole.error('Error renewing push subscription:', error);
    }
  }, [checkActiveSubscription, subscribeToPush]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push-Benachrichtigungen
          </CardTitle>
          <CardDescription>Erhalten Sie sofortige Benachrichtigungen in Ihrem Browser</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported && (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
              Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
            </div>
          )}

          {pushSupported && (
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Browser-Benachrichtigungen</Label>
                <p className="text-sm text-muted-foreground">
                  Status:{' '}
                  {pushPermission === 'granted'
                    ? (hasActiveSubscription === false ? 'Berechtigung erteilt, aber Verbindung abgelaufen' : 'Aktiviert')
                    : pushPermission === 'denied'
                      ? 'Blockiert'
                      : 'Nicht aktiviert'}
                </p>
              </div>

              {pushPermission !== 'granted' && (
                <Button onClick={(): void => void enablePushNotifications()} disabled={pushPermission === 'denied'}>
                  Aktivieren
                </Button>
              )}

              {pushPermission === 'granted' && hasActiveSubscription === false && (
                <Button onClick={(): void => void renewPushSubscription()} variant="outline">
                  Push erneuern
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ruhezeiten
          </CardTitle>
          <CardDescription>Keine Benachrichtigungen während dieser Zeiten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quiet-start">Von</Label>
              <Input
                id="quiet-start"
                type="time"
                value={quietHoursStart}
                onChange={(event: ChangeEvent<HTMLInputElement>): void => setQuietHoursStart(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quiet-end">Bis</Label>
              <Input
                id="quiet-end"
                type="time"
                value={quietHoursEnd}
                onChange={(event: ChangeEvent<HTMLInputElement>): void => setQuietHoursEnd(event.target.value)}
              />
            </div>
          </div>
          <Button onClick={(): void => void updateQuietHours()} disabled={loading}>
            Ruhezeiten speichern
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benachrichtigungstypen</CardTitle>
          <CardDescription>Legen Sie fest, welche Benachrichtigungen Sie erhalten möchten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoryGroups.map((group: CategoryGroup) => (
            <CategorySection
              key={group.category}
              group={group}
              loading={loading}
              pushPermission={pushPermission}
              onToggleCategory={(category: string, field: NotificationSettingField, value: boolean): void => {
                void toggleCategory(category, field, value);
              }}
              onToggleSingle={(typeId: string, field: NotificationSettingField, value: boolean): void => {
                void updateSetting(typeId, field, value);
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
