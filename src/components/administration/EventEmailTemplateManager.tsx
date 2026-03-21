import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { debugConsole } from '@/utils/debugConsole';
import { Save, RotateCcw, Mail } from 'lucide-react';

const DEFAULTS = {
  invitation: {
    subject: '',
    body: `Hallo {name},

Sie sind herzlich zur Veranstaltung "{eventTitle}" eingeladen.

Bitte teilen Sie uns mit, ob Sie teilnehmen können.

Mit freundlichen Grüßen`,
  },
  reminder: {
    subject: '',
    body: `Hallo {name},

wir möchten Sie freundlich an die Veranstaltung "{eventTitle}" erinnern.

Bitte teilen Sie uns mit, ob Sie teilnehmen können.

Mit freundlichen Grüßen`,
  },
  note: {
    subject: '',
    body: '',
  },
} as const;

type TemplateType = 'invitation' | 'reminder' | 'note';

interface TemplateState {
  id: string | null;
  subject: string;
  body: string;
}

const TEMPLATE_LABELS: Record<TemplateType, { title: string; description: string }> = {
  invitation: {
    title: 'Einladungs-E-Mail',
    description: 'Vorlage für die erste Einladung an Gäste.',
  },
  reminder: {
    title: 'Erinnerungs-E-Mail',
    description: 'Vorlage für Erinnerungen an noch nicht antwortende Gäste.',
  },
  note: {
    title: 'Hinweis-E-Mail',
    description: 'Vorlage für Hinweise an Gäste. Der Text dient als Ausgangspunkt und kann vor dem Versenden angepasst werden.',
  },
};

const TEMPLATE_TYPES: TemplateType[] = ['invitation', 'reminder', 'note'];

export const EventEmailTemplateManager: React.FC = () => {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<TemplateType, boolean>>({
    invitation: false,
    reminder: false,
    note: false,
  });
  const [templates, setTemplates] = useState<Record<TemplateType, TemplateState>>({
    invitation: { id: null, ...DEFAULTS.invitation },
    reminder: { id: null, ...DEFAULTS.reminder },
    note: { id: null, ...DEFAULTS.note },
  });

  useEffect(() => {
    loadTemplates();
  }, [currentTenant?.id]);

  const loadTemplates = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_email_templates')
        .select('id, type, subject, body')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(prev => {
          const next = { ...prev };
          for (const row of data) {
            const type = row.type as TemplateType;
            if (TEMPLATE_TYPES.includes(type)) {
              next[type] = { id: row.id, subject: row.subject ?? '', body: row.body ?? '' };
            }
          }
          return next;
        });
      }
    } catch (error) {
      debugConsole.error('Error loading event email templates:', error);
      toast.error('Fehler beim Laden der Vorlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (type: TemplateType) => {
    if (!currentTenant?.id) return;
    setSaving(prev => ({ ...prev, [type]: true }));
    try {
      const { subject, body } = templates[type];
      const { data, error } = await supabase
        .from('event_email_templates')
        .upsert(
          { tenant_id: currentTenant.id, type, subject, body },
          { onConflict: 'tenant_id,type' }
        )
        .select('id, type, subject, body')
        .single();

      if (error) throw error;
      if (data) {
        setTemplates(prev => ({
          ...prev,
          [type]: { id: data.id, subject: data.subject ?? '', body: data.body ?? '' },
        }));
      }
      toast.success('Vorlage erfolgreich gespeichert');
    } catch (error) {
      debugConsole.error('Error saving event email template:', error);
      toast.error('Fehler beim Speichern der Vorlage');
    } finally {
      setSaving(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleReset = (type: TemplateType) => {
    setTemplates(prev => ({
      ...prev,
      [type]: { ...prev[type], subject: DEFAULTS[type].subject, body: DEFAULTS[type].body },
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {TEMPLATE_TYPES.map(type => {
        const { title, description } = TEMPLATE_LABELS[type];
        const tmpl = templates[type];
        const isSaving = saving[type];

        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Betreff (optional)</Label>
                <Input
                  value={tmpl.subject}
                  onChange={e => setTemplates(prev => ({
                    ...prev,
                    [type]: { ...prev[type], subject: e.target.value },
                  }))}
                  placeholder="Betreff der E-Mail"
                />
              </div>
              <div className="space-y-2">
                <Label>Text</Label>
                <Textarea
                  value={tmpl.body}
                  onChange={e => setTemplates(prev => ({
                    ...prev,
                    [type]: { ...prev[type], body: e.target.value },
                  }))}
                  rows={8}
                  placeholder="E-Mail-Text..."
                />
                <p className="text-xs text-muted-foreground">
                  Platzhalter: <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{eventTitle}'}</code>
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => handleSave(type)} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Wird gespeichert...' : 'Speichern'}
                </Button>
                <Button variant="outline" onClick={() => handleReset(type)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
