import React, { useState, useMemo, useRef } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Bell, CheckCheck, Calendar, MessageSquare, FileText, Users,
  BookOpen, Clock, BarChart3, MapPin, StickyNote, Settings,
  Search, Filter, X, DollarSign, Volume2, VolumeX, Play,
  Monitor, ArrowUpRight, ArrowDownRight, ArrowUp, Upload, Trash2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useNotifications, type Notification } from '@/contexts/NotificationContext';
import { NotificationSettings } from '@/components/NotificationSettings';
import { useNotificationDisplayPreferences } from '@/hooks/useNotificationDisplayPreferences';
import { NOTIFICATION_SOUNDS, playNotificationSound, type SoundName, hasCustomSound, saveCustomSound, removeCustomSound } from '@/utils/notificationSounds';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_created': case 'task_due': case 'task_assigned': case 'task_updated': return CheckCheck;
    case 'appointment_reminder': return Calendar;
    case 'message_received': return MessageSquare;
    case 'budget_exceeded': return DollarSign;
    case 'system_update': case 'team_announcement_created': return Settings;
    case 'employee_meeting_overdue': case 'employee_meeting_due_soon': case 'employee_meeting_due':
    case 'employee_meeting_reminder': case 'employee_meeting_request_overdue':
    case 'employee_meeting_requested': case 'employee_meeting_request_declined':
    case 'employee_meeting_action_item_overdue': case 'employee_meeting_scheduled': return Users;
    case 'task_decision_request': case 'task_decision_completed': case 'task_decision_complete':
    case 'task_decision_comment_received': case 'task_decision_creator_response': return MessageSquare;
    case 'document_created': case 'document_mention': case 'letter_review_requested':
    case 'letter_review_completed': case 'letter_sent': return FileText;
    case 'knowledge_document_created': return BookOpen;
    case 'meeting_created': return Calendar;
    case 'note_follow_up': return StickyNote;
    case 'poll_auto_cancelled': case 'poll_auto_completed': case 'poll_restored': return BarChart3;
    case 'vacation_request_pending': case 'sick_leave_request_pending':
    case 'leave_request_approved': case 'leave_request_rejected': return Clock;
    case 'planning_collaborator_added': return MapPin;
    default: return Bell;
  }
};

// Visual position preview box
function PositionPreviewBox({ position, size }: { position: string; size: string }) {
  const isLarge = size === 'large';

  const getToastPosition = () => {
    switch (position) {
      case 'top-right': return 'top-1 right-1';
      case 'top-center': return 'top-1 left-1/2 -translate-x-1/2';
      case 'bottom-right': return 'bottom-1 right-1';
      default: return 'bottom-1 right-1';
    }
  };

  return (
    <div className="relative w-40 h-24 border-2 border-border rounded-lg bg-muted/30 mx-auto">
      {/* Mini screen label */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-muted rounded-t-md" />
      {/* Toast indicator */}
      <div
        className={cn(
          "absolute rounded-sm bg-primary/80 transition-all duration-300",
          getToastPosition(),
          isLarge ? "w-12 h-4" : "w-8 h-3"
        )}
      />
    </div>
  );
}

// Display settings component
function NotificationDisplaySettings() {
  const { preferences, setPreferences } = useNotificationDisplayPreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customSoundLoaded, setCustomSoundLoaded] = useState(hasCustomSound());

  const handlePreview = () => {
    // Dismiss existing toasts first so new position/size is visible
    toast.dismiss();
    setTimeout(() => {
      toast('Beispiel-Benachrichtigung', {
        description: preferences.persist
          ? 'So werden Ihre Benachrichtigungen angezeigt. Schließen Sie diese mit dem X-Button.'
          : 'So werden Ihre Benachrichtigungen angezeigt.',
        duration: preferences.persist ? Infinity : preferences.duration,
        position: preferences.position,
        closeButton: true,
      });
      if (preferences.soundEnabled) {
        playNotificationSound(preferences.soundName as SoundName, preferences.soundVolume);
      }
    }, 150);
  };

  const handleCustomSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error('Datei zu groß', { description: 'Maximale Größe: 500 KB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveCustomSound(dataUrl);
      setCustomSoundLoaded(true);
      setPreferences({ soundName: 'custom' });
      toast.success('Eigener Ton gespeichert');
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveCustomSound = () => {
    removeCustomSound();
    setCustomSoundLoaded(false);
    if (preferences.soundName === 'custom') {
      setPreferences({ soundName: 'ping' });
    }
    toast.success('Eigener Ton entfernt');
  };

  return (
    <div className="space-y-6">
      {/* Position & Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-5 w-5" />
            Darstellung
          </CardTitle>
          <CardDescription>Position und Größe der Benachrichtigungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Visual preview */}
          <PositionPreviewBox position={preferences.position} size={preferences.size} />

          <div className="space-y-3">
            <Label>Position</Label>
            <RadioGroup
              value={preferences.position}
              onValueChange={(v) => setPreferences({ position: v as any })}
              className="grid grid-cols-3 gap-3"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="top-right" id="pos-top-right" />
                <Label htmlFor="pos-top-right" className="flex items-center gap-1.5 cursor-pointer font-normal text-sm">
                  <ArrowUpRight className="h-4 w-4" />
                  Oben rechts
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="top-center" id="pos-top-center" />
                <Label htmlFor="pos-top-center" className="flex items-center gap-1.5 cursor-pointer font-normal text-sm">
                  <ArrowUp className="h-4 w-4" />
                  Oben Mitte
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="bottom-right" id="pos-bottom-right" />
                <Label htmlFor="pos-bottom-right" className="flex items-center gap-1.5 cursor-pointer font-normal text-sm">
                  <ArrowDownRight className="h-4 w-4" />
                  Unten rechts
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Größe</Label>
            <RadioGroup
              value={preferences.size}
              onValueChange={(v) => setPreferences({ size: v as any })}
              className="grid grid-cols-2 gap-3"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="normal" id="size-normal" />
                <Label htmlFor="size-normal" className="cursor-pointer font-normal">Normal</Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="large" id="size-large" />
                <Label htmlFor="size-large" className="cursor-pointer font-normal">Groß</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Anzeigedauer</Label>
            <div className="flex items-center gap-3">
              <Select
                value={preferences.persist ? 'persist' : String(preferences.duration)}
                onValueChange={(v) => {
                  if (v === 'persist') {
                    setPreferences({ persist: true });
                  } else {
                    setPreferences({ persist: false, duration: Number(v) });
                  }
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3000">3 Sekunden</SelectItem>
                  <SelectItem value="5000">5 Sekunden</SelectItem>
                  <SelectItem value="8000">8 Sekunden</SelectItem>
                  <SelectItem value="10000">10 Sekunden</SelectItem>
                  <SelectItem value="persist">Nicht ausblenden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preferences.persist && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Benachrichtigungen bleiben sichtbar, bis Sie diese manuell mit dem X-Button schließen.
              </p>
            )}
          </div>

          <Button variant="outline" onClick={handlePreview} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Vorschau anzeigen
          </Button>
        </CardContent>
      </Card>

      {/* Sound */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {preferences.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            Töne
          </CardTitle>
          <CardDescription>Benachrichtigungstöne konfigurieren</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>Ton aktiviert</Label>
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => setPreferences({ soundEnabled: checked })}
            />
          </div>

          {preferences.soundEnabled && (
            <>
              <div className="space-y-3">
                <Label>Ton auswählen</Label>
                <div className="space-y-2">
                  {NOTIFICATION_SOUNDS.map((sound) => {
                    // Hide custom option if no custom sound uploaded
                    if (sound.value === 'custom' && !customSoundLoaded) return null;

                    return (
                      <div
                        key={sound.value}
                        className={cn(
                          "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors",
                          preferences.soundName === sound.value
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => setPreferences({ soundName: sound.value })}
                      >
                        <span className="text-sm">{sound.label}</span>
                        <div className="flex items-center gap-1">
                          {sound.value === 'custom' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCustomSound();
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              playNotificationSound(sound.value, preferences.soundVolume);
                            }}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom sound upload */}
                <div className="pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
                    className="hidden"
                    onChange={handleCustomSoundUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {customSoundLoaded ? 'Eigenen Ton ersetzen' : 'Eigenen Ton hochladen'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    MP3, WAV oder OGG · max. 500 KB
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Lautstärke</Label>
                <div className="flex items-center gap-3">
                  <VolumeX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Slider
                    value={[preferences.soundVolume * 100]}
                    onValueChange={([v]) => setPreferences({ soundVolume: v / 100 })}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Volume2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'all' | 'settings'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotifications = useMemo(() => {
    let filtered = notifications;
    if (filterStatus === 'unread') filtered = filtered.filter(n => !n.is_read);
    if (filterStatus === 'read') filtered = filtered.filter(n => n.is_read);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [notifications, filterStatus, searchQuery]);

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Benachrichtigungen</h1>
          <p className="text-muted-foreground">
            Alle Benachrichtigungen und Einstellungen
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all" className="gap-2">
              <Bell className="h-4 w-4" />
              Alle Benachrichtigungen
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs ml-1">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Einstellungen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Benachrichtigungen durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="unread">Ungelesen</SelectItem>
                  <SelectItem value="read">Gelesen</SelectItem>
                </SelectContent>
              </Select>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Alle lesen
                </Button>
              )}
            </div>

            {/* Notification list */}
            <Card>
              <CardContent className="p-0">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bell className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'Keine Benachrichtigungen gefunden' : 'Keine Benachrichtigungen vorhanden'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredNotifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.notification_types?.name || 'default');
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            "flex items-start gap-3 p-4 hover:bg-accent cursor-pointer transition-colors group",
                            !notification.is_read && "bg-accent/5"
                          )}
                          onClick={() => {
                            if (!notification.is_read) markAsRead(notification.id);
                          }}
                        >
                          <div className={cn(
                            "p-2 rounded-full flex-shrink-0 mt-0.5",
                            notification.is_read ? "bg-muted" : "bg-primary/10"
                          )}>
                            <Icon className={cn("h-4 w-4", notification.is_read ? "text-muted-foreground" : "text-primary")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={cn("text-sm leading-tight", !notification.is_read && "font-medium")}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!notification.is_read && <div className="h-2 w-2 bg-primary rounded-full" />}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                            <span className="text-xs text-muted-foreground mt-2 block">
                              {format(new Date(notification.created_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                              {' · '}
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: de })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <NotificationDisplaySettings />
              <NotificationSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default NotificationsPage;
