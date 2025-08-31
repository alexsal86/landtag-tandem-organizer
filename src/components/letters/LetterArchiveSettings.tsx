import React, { useState, useEffect } from 'react';
import { Settings, Calendar, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

interface ArchiveSettings {
  auto_archive_days: number;
  show_sent_letters: boolean;
}

interface LetterArchiveSettingsProps {
  onSettingsChange?: (settings: ArchiveSettings) => void;
}

export const LetterArchiveSettings: React.FC<LetterArchiveSettingsProps> = ({
  onSettingsChange
}) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ArchiveSettings>({
    auto_archive_days: 30,
    show_sent_letters: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user && currentTenant) {
      fetchSettings();
    }
  }, [isOpen, user, currentTenant]);

  const fetchSettings = async () => {
    if (!user || !currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('letter_archive_settings')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }

      if (data) {
        const newSettings = {
          auto_archive_days: data.auto_archive_days || 30,
          show_sent_letters: data.show_sent_letters ?? true
        };
        setSettings(newSettings);
        onSettingsChange?.(newSettings);
      }
    } catch (error) {
      console.error('Error fetching archive settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!user || !currentTenant) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('letter_archive_settings')
        .upsert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          auto_archive_days: settings.auto_archive_days,
          show_sent_letters: settings.show_sent_letters
        });

      if (error) throw error;

      toast({
        title: "Einstellungen gespeichert",
        description: "Ihre Archivierungseinstellungen wurden aktualisiert.",
      });

      onSettingsChange?.(settings);
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving archive settings:', error);
      toast({
        title: "Fehler",
        description: "Einstellungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Archiv-Einstellungen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Brief-Archivierung Einstellungen
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Auto-Archivierung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="archive-days">
                  Versendete Briefe nach X Tagen aus der Hauptansicht entfernen
                </Label>
                <Input
                  id="archive-days"
                  type="number"
                  min="1"
                  max="365"
                  value={settings.auto_archive_days}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    auto_archive_days: parseInt(e.target.value) || 30
                  }))}
                />
                <p className="text-sm text-muted-foreground">
                  Nach dieser Zeit erscheinen versendete Briefe nur noch im Archiv-Bereich.
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-1">
                  <Label htmlFor="show-sent">Versendete Briefe anzeigen</Label>
                  <p className="text-sm text-muted-foreground">
                    Versendete Briefe in der Hauptübersicht anzeigen
                  </p>
                </div>
                <Switch
                  id="show-sent"
                  checked={settings.show_sent_letters}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    show_sent_letters: checked
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">📁 Automatische Archivierung</h4>
            <p className="text-sm text-muted-foreground">
              Versendete Briefe werden automatisch als PDF mit allen Anlagen im Dokumentenbereich archiviert. 
              Der vollständige Workflow-Verlauf wird dabei gespeichert.
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveSettings} disabled={loading}>
              {loading ? "Speichern..." : "Einstellungen speichern"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};