import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import {
  DEFAULT_SPECIAL_DAYS,
  isValidSpecialDayDate,
  parseSpecialDaysSetting,
  type SpecialDay
} from '@/utils/dashboard/specialDays';

const SETTINGS_KEY = 'dashboard_special_day_hints';

const emptyEntry = (): SpecialDay => ({ month: 1, day: 1, name: '', hint: '' });

export const DashboardHintSettings = () => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [entries, setEntries] = useState<SpecialDay[]>(DEFAULT_SPECIAL_DAYS);
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
        setEntries(parsedDays || DEFAULT_SPECIAL_DAYS);
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

  const validation = useMemo(() => {
    const errors: string[] = [];

    if (entries.length === 0) {
      errors.push('Mindestens ein Hinweis ist erforderlich.');
    }

    entries.forEach((entry, index) => {
      if (!isValidSpecialDayDate(entry.month, entry.day)) {
        errors.push(`Zeile ${index + 1}: Datum ist ungültig.`);
      }
      if (!entry.name.trim()) {
        errors.push(`Zeile ${index + 1}: Name darf nicht leer sein.`);
      }
      if (!entry.hint.trim()) {
        errors.push(`Zeile ${index + 1}: Hinweistext darf nicht leer sein.`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [entries]);

  const handleChange = <K extends keyof SpecialDay>(index: number, field: K, value: SpecialDay[K]) => {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const handleResetDefaults = () => {
    setEntries(DEFAULT_SPECIAL_DAYS);
  };

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, emptyEntry()]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      toast({
        title: 'Ungültige Eingaben',
        description: validation.errors[0] || 'Bitte prüfen Sie die Eingaben.',
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

      const normalizedEntries = entries.map((entry) => ({
        month: Number(entry.month),
        day: Number(entry.day),
        name: entry.name.trim(),
        hint: entry.hint.trim()
      }));

      const settingValue = JSON.stringify(normalizedEntries);

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
          Pflege Hinweise ohne JSON direkt als Liste. Der nächste passende Hinweis wird im Dashboard angezeigt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="grid grid-cols-[88px_88px_1fr_1.5fr_48px] gap-2 text-xs font-medium text-muted-foreground">
            <span>Monat</span>
            <span>Tag</span>
            <span>Name</span>
            <span>Hinweistext</span>
            <span className="text-right">&nbsp;</span>
          </div>

          {entries.map((entry, index) => (
            <div key={`${index}-${entry.month}-${entry.day}-${entry.name}`} className="grid grid-cols-[88px_88px_1fr_1.5fr_48px] gap-2">
              <Input
                type="number"
                min={1}
                max={12}
                value={entry.month}
                onChange={(event) => handleChange(index, 'month', Number(event.target.value || 0))}
              />
              <Input
                type="number"
                min={1}
                max={31}
                value={entry.day}
                onChange={(event) => handleChange(index, 'day', Number(event.target.value || 0))}
              />
              <Input
                value={entry.name}
                placeholder="z. B. Internationaler Frauentag"
                onChange={(event) => handleChange(index, 'name', event.target.value)}
              />
              <Input
                value={entry.hint}
                placeholder="Kurztext für den Hinweis im Dashboard"
                onChange={(event) => handleChange(index, 'hint', event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveEntry(index)}
                disabled={entries.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" type="button" onClick={handleAddEntry}>
            <Plus className="mr-2 h-4 w-4" />
            Hinweis hinzufügen
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dashboard-hints-json">JSON-Vorschau (read-only)</Label>
          <Textarea id="dashboard-hints-json" readOnly className="min-h-[120px] font-mono text-xs" value={JSON.stringify(entries, null, 2)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleResetDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Standard wiederherstellen
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !validation.isValid}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Speichern
          </Button>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
          {validation.isValid
            ? `${entries.length} Hinweise sind gültig und speicherbar.`
            : validation.errors.map((error, index) => <p key={index}>• {error}</p>)}
        </div>
      </CardContent>
    </Card>
  );
};
