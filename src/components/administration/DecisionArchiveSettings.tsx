import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Loader2, Archive, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ArchiveSettings {
  id?: string;
  user_id: string;
  tenant_id: string;
  auto_archive_on_completion: boolean;
  auto_archive_days: number | null;
  auto_delete_after_days: number | null;
  created_at?: string;
  updated_at?: string;
}

export const DecisionArchiveSettings = () => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [autoArchiveOnCompletion, setAutoArchiveOnCompletion] = useState(true);
  const [autoArchiveDays, setAutoArchiveDays] = useState<string>('');
  const [autoDeleteDays, setAutoDeleteDays] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, [currentTenant]);

  const loadSettings = async () => {
    if (!currentTenant) return;
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('decision_archive_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const settings = data as unknown as ArchiveSettings;
        setAutoArchiveOnCompletion(settings.auto_archive_on_completion ?? true);
        setAutoArchiveDays(settings.auto_archive_days?.toString() ?? '');
        setAutoDeleteDays(settings.auto_delete_after_days?.toString() ?? '');
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht geladen werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTenant) return;
    
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settings = {
        user_id: user.id,
        tenant_id: currentTenant.id,
        auto_archive_on_completion: autoArchiveOnCompletion,
        auto_archive_days: autoArchiveDays ? parseInt(autoArchiveDays) : null,
        auto_delete_after_days: autoDeleteDays ? parseInt(autoDeleteDays) : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('decision_archive_settings' as any)
        .upsert(settings, {
          onConflict: 'user_id,tenant_id'
        });

      if (error) throw error;

      toast({
        title: 'Gespeichert',
        description: 'Archivierungseinstellungen wurden erfolgreich gespeichert.'
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Fehler',
        description: 'Einstellungen konnten nicht gespeichert werden.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Diese Einstellungen gelten für alle Ihre Entscheidungsanfragen. Archivierte Entscheidungen
          werden aus der aktiven Liste entfernt, bleiben aber im Archiv einsehbar.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Automatische Archivierung bei Vollständigkeit
          </CardTitle>
          <CardDescription>
            Entscheidungsanfragen automatisch archivieren, sobald alle Teilnehmer geantwortet haben
            und keine offenen Rückfragen mehr existieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-archive-completion">
                Sofortige Archivierung aktivieren
              </Label>
              <p className="text-sm text-muted-foreground">
                Archiviert Entscheidungen automatisch, wenn alle Teilnehmer geantwortet haben
              </p>
            </div>
            <Switch
              id="auto-archive-completion"
              checked={autoArchiveOnCompletion}
              onCheckedChange={setAutoArchiveOnCompletion}
            />
          </div>

          {autoArchiveOnCompletion && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Entscheidungsanfragen werden automatisch archiviert, sobald alle Teilnehmer geantwortet haben.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Verzögerte Archivierung
          </CardTitle>
          <CardDescription>
            Vollständig beantwortete Entscheidungsanfragen nach einer bestimmten Zeit archivieren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-archive-days">
              Archiviere nach X Tagen (optional)
            </Label>
            <Input
              id="auto-archive-days"
              type="number"
              min="1"
              placeholder="z.B. 30"
              value={autoArchiveDays}
              onChange={(e) => setAutoArchiveDays(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Entscheidungen werden X Tage nach der letzten Antwort archiviert (nur wenn vollständig beantwortet).
              Leer lassen für keine verzögerte Archivierung.
            </p>
          </div>

          {autoArchiveDays && parseInt(autoArchiveDays) > 0 && (
            <Alert>
              <Archive className="h-4 w-4 text-blue-500" />
              <AlertDescription>
                Vollständig beantwortete Entscheidungen werden nach {autoArchiveDays} Tagen automatisch archiviert.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Automatische Löschung
          </CardTitle>
          <CardDescription>
            Archivierte Entscheidungsanfragen nach einer bestimmten Zeit endgültig löschen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-delete-days">
              Lösche archivierte Entscheidungen nach X Tagen (optional)
            </Label>
            <Input
              id="auto-delete-days"
              type="number"
              min="1"
              placeholder="z.B. 90"
              value={autoDeleteDays}
              onChange={(e) => setAutoDeleteDays(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Archivierte Entscheidungen werden nach X Tagen endgültig gelöscht.
              Leer lassen für keine automatische Löschung.
            </p>
          </div>

          {autoDeleteDays && parseInt(autoDeleteDays) > 0 && (
            <Alert variant="destructive">
              <Trash2 className="h-4 w-4" />
              <AlertDescription>
                ⚠️ Archivierte Entscheidungen werden nach {autoDeleteDays} Tagen endgültig gelöscht 
                und können nicht wiederhergestellt werden!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Einstellungen speichern
        </Button>
      </div>
    </div>
  );
};
