import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  DEFAULT_SPECIAL_DAYS,
  parseSpecialDaysSetting,
  type SpecialDay
} from '@/utils/dashboard/specialDays';

const SETTINGS_KEY = 'dashboard_special_day_hints';

const formatDaysForEditor = (days: SpecialDay[]) => JSON.stringify(days, null, 2);

export const DashboardHintSettings = () => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [editorValue, setEditorValue] = useState(formatDaysForEditor(DEFAULT_SPECIAL_DAYS));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const query = supabase
          .from('app_settings')
          .select('id, setting_value')
          .eq('setting_key', SETTINGS_KEY)
          .limit(1);

        const { data, error } = currentTenant?.id
          ? await query.eq('tenant_id', currentTenant.id).maybeSingle()
          : await query.is('tenant_id', null).maybeSingle();

        if (error) throw error;

        const parsedDays = parseSpecialDaysSetting(data?.setting_value);
        setEditorValue(formatDaysForEditor(parsedDays || DEFAULT_SPECIAL_DAYS));
      } catch (error) {
        console.error('Error loading dashboard hint settings:', error);
        toast({
          title: 'Fehler',
          description: 'Dashboard-Hinweise konnten nicht geladen werden.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [currentTenant?.id, toast]);

  const parsedPreview = useMemo(() => parseSpecialDaysSetting(editorValue), [editorValue]);

  const handleResetDefaults = () => {
    setEditorValue(formatDaysForEditor(DEFAULT_SPECIAL_DAYS));
  };

  const handleSave = async () => {
    const parsedDays = parseSpecialDaysSetting(editorValue);
    if (!parsedDays) {
      toast({
        title: 'Ungültiges Format',
        description: 'Bitte gültiges JSON mit mindestens einem Hinweisobjekt speichern.',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);
    try {
      const tenantId = currentTenant?.id ?? null;
      const baseQuery = supabase
        .from('app_settings')
        .select('id')
        .eq('setting_key', SETTINGS_KEY)
        .limit(1);

      const { data: existing, error: existingError } = tenantId
        ? await baseQuery.eq('tenant_id', tenantId).maybeSingle()
        : await baseQuery.is('tenant_id', null).maybeSingle();

      if (existingError) throw existingError;

      const settingValue = JSON.stringify(parsedDays);

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('app_settings')
          .update({ setting_value: settingValue })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('app_settings')
          .insert({
            setting_key: SETTINGS_KEY,
            setting_value: settingValue,
            tenant_id: tenantId
          });

        if (insertError) throw insertError;
      }

      setEditorValue(formatDaysForEditor(parsedDays));
      toast({ title: 'Gespeichert', description: 'Dashboard-Hinweise wurden aktualisiert.' });
    } catch (error) {
      console.error('Error saving dashboard hint settings:', error);
      toast({
        title: 'Fehler',
        description: 'Dashboard-Hinweise konnten nicht gespeichert werden.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard-Hinweise</CardTitle>
          <CardDescription>Lädt Einstellungen…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard-Hinweise verwalten</CardTitle>
        <CardDescription>
          Diese Liste steuert den Hinweisblock im Dashboard unter „Meine Arbeit“ (z. B. Internationale Tage).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dashboard-hints-editor">Hinweise (JSON)</Label>
          <Textarea
            id="dashboard-hints-editor"
            className="min-h-[280px] font-mono text-xs"
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Format je Eintrag: {'{ "month": 3, "day": 8, "name": "Internationaler Frauentag", "hint": "…" }'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleResetDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Standard wiederherstellen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          {parsedPreview
            ? `${parsedPreview.length} Hinweise erkannt. Der nächste passende Hinweis wird im Dashboard automatisch angezeigt.`
            : 'Aktuell ungültiges JSON. Bitte korrigieren, bevor gespeichert wird.'}
        </div>
      </CardContent>
    </Card>
  );
};
