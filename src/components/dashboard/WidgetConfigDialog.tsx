import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardWidget } from '@/hooks/useDashboardLayout';
import { Palette, Clock, Bell, Eye, Zap } from 'lucide-react';

interface WidgetConfigDialogProps {
  widget: DashboardWidget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: DashboardWidget['configuration']) => void;
}

const THEMES = [
  { id: 'default', name: 'Standard', color: 'hsl(var(--primary))' },
  { id: 'blue', name: 'Blau', color: 'hsl(221, 83%, 35%)' },
  { id: 'green', name: 'Grün', color: 'hsl(142, 76%, 36%)' },
  { id: 'purple', name: 'Lila', color: 'hsl(262, 83%, 58%)' },
  { id: 'orange', name: 'Orange', color: 'hsl(25, 95%, 53%)' },
  { id: 'red', name: 'Rot', color: 'hsl(0, 84%, 60%)' }
];

const REFRESH_INTERVALS = [
  { value: 0, label: 'Nie' },
  { value: 30, label: '30 Sekunden' },
  { value: 60, label: '1 Minute' },
  { value: 300, label: '5 Minuten' },
  { value: 900, label: '15 Minuten' },
  { value: 1800, label: '30 Minuten' },
  { value: 3600, label: '1 Stunde' }
];

export function WidgetConfigDialog({ widget, open, onOpenChange, onSave }: WidgetConfigDialogProps) {
  const [config, setConfig] = useState(widget.configuration || {});

  const handleSave = () => {
    onSave(config);
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Widget konfigurieren: {widget.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance">Aussehen</TabsTrigger>
            <TabsTrigger value="behavior">Verhalten</TabsTrigger>
            <TabsTrigger value="data">Daten</TabsTrigger>
            <TabsTrigger value="advanced">Erweitert</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Design & Layout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Theme Selection */}
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => updateConfig('theme', theme.id)}
                        className={`
                          p-3 rounded-lg border-2 transition-all flex items-center gap-2
                          ${config.theme === theme.id ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}
                        `}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: theme.color }}
                        />
                        <span className="text-sm">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Header Settings */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-header">Header anzeigen</Label>
                  <Switch
                    id="show-header"
                    checked={config.showHeader !== false}
                    onCheckedChange={(checked) => updateConfig('showHeader', checked)}
                  />
                </div>

                {/* Compact Mode */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="compact">Kompakte Ansicht</Label>
                  <Switch
                    id="compact"
                    checked={config.compact === true}
                    onCheckedChange={(checked) => updateConfig('compact', checked)}
                  />
                </div>

                {/* Custom Title */}
                <div className="space-y-2">
                  <Label htmlFor="custom-title">Benutzerdefinierter Titel</Label>
                  <Input
                    id="custom-title"
                    value={config.customTitle || ''}
                    onChange={(e) => updateConfig('customTitle', e.target.value)}
                    placeholder={widget.title}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Funktionalität
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Auto-Save */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save">Automatisch speichern</Label>
                  <Switch
                    id="auto-save"
                    checked={config.autoSave !== false}
                    onCheckedChange={(checked) => updateConfig('autoSave', checked)}
                  />
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">Benachrichtigungen</Label>
                  <Switch
                    id="notifications"
                    checked={config.notifications === true}
                    onCheckedChange={(checked) => updateConfig('notifications', checked)}
                  />
                </div>

                {/* Interactive */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="interactive">Interaktiv</Label>
                  <Switch
                    id="interactive"
                    checked={config.interactive !== false}
                    onCheckedChange={(checked) => updateConfig('interactive', checked)}
                  />
                </div>

                {/* Animation Speed */}
                <div className="space-y-2">
                  <Label>Animationsgeschwindigkeit</Label>
                  <Slider
                    value={[config.animationSpeed || 1]}
                    onValueChange={([value]) => updateConfig('animationSpeed', value)}
                    max={3}
                    min={0.1}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    {config.animationSpeed || 1}x
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Datenmanagement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Refresh Interval */}
                <div className="space-y-2">
                  <Label>Aktualisierungsintervall</Label>
                  <Select
                    value={String(config.refreshInterval || 0)}
                    onValueChange={(value) => updateConfig('refreshInterval', Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REFRESH_INTERVALS.map((interval) => (
                        <SelectItem key={interval.value} value={String(interval.value)}>
                          {interval.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cache Duration */}
                <div className="space-y-2">
                  <Label>Cache-Dauer (Minuten)</Label>
                  <Input
                    type="number"
                    value={config.cacheDuration || 5}
                    onChange={(e) => updateConfig('cacheDuration', Number(e.target.value))}
                    min={0}
                    max={1440}
                  />
                </div>

                {/* Max Items */}
                <div className="space-y-2">
                  <Label>Maximale Anzahl Einträge</Label>
                  <Input
                    type="number"
                    value={config.maxItems || 10}
                    onChange={(e) => updateConfig('maxItems', Number(e.target.value))}
                    min={1}
                    max={100}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Erweiterte Einstellungen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Custom CSS */}
                <div className="space-y-2">
                  <Label htmlFor="custom-css">Benutzerdefinierte CSS-Klassen</Label>
                  <Input
                    id="custom-css"
                    value={config.customCSS || ''}
                    onChange={(e) => updateConfig('customCSS', e.target.value)}
                    placeholder="custom-class-1 custom-class-2"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label>Priorität (für Auto-Layout)</Label>
                  <Slider
                    value={[config.priority || 5]}
                    onValueChange={([value]) => updateConfig('priority', value)}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    Priorität: {config.priority || 5}/10
                  </div>
                </div>

                {/* Widget-specific settings */}
                {widget.type === 'quicknotes' && (
                  <div className="space-y-2">
                    <Label>Standard-Notizfarbe</Label>
                    <Select
                      value={config.defaultNoteColor || 'yellow'}
                      onValueChange={(value) => updateConfig('defaultNoteColor', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yellow">Gelb</SelectItem>
                        <SelectItem value="blue">Blau</SelectItem>
                        <SelectItem value="green">Grün</SelectItem>
                        <SelectItem value="pink">Rosa</SelectItem>
                        <SelectItem value="purple">Lila</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {widget.type === 'pomodoro' && (
                  <>
                    <div className="space-y-2">
                      <Label>Arbeitszeit (Minuten)</Label>
                      <Input
                        type="number"
                        value={config.workDuration || 25}
                        onChange={(e) => updateConfig('workDuration', Number(e.target.value))}
                        min={1}
                        max={60}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Pausenzeit (Minuten)</Label>
                      <Input
                        type="number"
                        value={config.breakDuration || 5}
                        onChange={(e) => updateConfig('breakDuration', Number(e.target.value))}
                        min={1}
                        max={30}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}