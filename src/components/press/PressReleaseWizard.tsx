import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { parsePressTemplates, type PressTemplateConfig } from '@/components/press/pressTemplateConfig';

type PressTemplate = PressTemplateConfig;

interface PressOccasion {
  id: string;
  key: string;
  label: string;
  description?: string;
  default_template_id?: string;
  is_active?: boolean;
}

export interface PressWizardResult {
  occasionKey?: string;
  occasionLabel?: string;
  templateId?: string;
  templateName?: string;
  title?: string;
  excerpt?: string;
  contentHtml?: string;
  tags?: string;
}

interface PressReleaseWizardProps {
  onComplete: (config: PressWizardResult) => void;
  onCancel: () => void;
}

export function PressReleaseWizard({ onComplete, onCancel }: PressReleaseWizardProps) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [occasions, setOccasions] = useState<PressOccasion[]>([]);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');

  useEffect(() => {
    if (!currentTenant) return;
    void loadSettings();
  }, [currentTenant?.id]);

  const selectedOccasion = useMemo(() => occasions.find((o) => o.id === selectedOccasionId), [occasions, selectedOccasionId]);
  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId]);

  useEffect(() => {
    if (!selectedOccasion) return;
    const nextTemplateId = selectedOccasion.default_template_id || templates.find((t) => t.is_default)?.id || '';
    setSelectedTemplateId(nextTemplateId);
  }, [selectedOccasionId, selectedOccasion?.default_template_id, templates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    if (!title) setTitle(selectedTemplate.default_title || '');
    if (!excerpt) setExcerpt(selectedTemplate.default_excerpt || '');
  }, [selectedTemplateId]);

  const loadSettings = async () => {
    if (!currentTenant) return;
    setLoading(true);

    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', currentTenant.id)
      .in('setting_key', ['press_templates_v1', 'press_occasions_v1']);

    let loadedTemplates: PressTemplate[] = [];
    let loadedOccasions: PressOccasion[] = [];

    for (const setting of data || []) {
      if (setting.setting_key === 'press_templates_v1') loadedTemplates = parsePressTemplates(setting.setting_value);
      if (setting.setting_key === 'press_occasions_v1' && setting.setting_value) {
        try { loadedOccasions = JSON.parse(setting.setting_value); } catch { loadedOccasions = []; }
      }
    }

    loadedTemplates = (loadedTemplates || []).filter((t) => t.is_active !== false);
    loadedOccasions = (loadedOccasions || []).filter((o) => o.is_active !== false);

    setTemplates(loadedTemplates);
    setOccasions(loadedOccasions);

    if (loadedOccasions.length > 0) {
      setSelectedOccasionId(loadedOccasions[0].id);
    }

    if (loadedTemplates.length > 0) {
      const defaultTemplate = loadedTemplates.find((t) => t.is_default) || loadedTemplates[0];
      setSelectedTemplateId(defaultTemplate.id);
    }

    setLoading(false);
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade Presse-Wizard...</div>;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="font-semibold text-lg">Pressemitteilung erstellen</h3>
          <p className="text-sm text-muted-foreground">Wählen Sie Anlass und Vorlage, danach öffnet sich der Editor.</p>
        </div>

        <div className="space-y-2">
          <Label>Anlass</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {occasions.map((occasion) => (
              <button
                key={occasion.id}
                className={`rounded-md border px-3 py-2 text-left ${selectedOccasionId === occasion.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedOccasionId(occasion.id)}
              >
                <div className="font-medium">{occasion.label}</div>
                {occasion.description && <p className="text-xs text-muted-foreground">{occasion.description}</p>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vorlage</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`rounded-md border px-3 py-2 text-left ${selectedTemplateId === template.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{template.name}</span>
                  {template.is_default && <Badge variant="outline">Standard</Badge>}
                </div>
                {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Titel</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Teaser</Label>
            <Textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button
            onClick={() => onComplete({
              occasionKey: selectedOccasion?.key,
              occasionLabel: selectedOccasion?.label,
              templateId: selectedTemplate?.id,
              templateName: selectedTemplate?.name,
              title,
              excerpt,
              contentHtml: selectedTemplate?.default_content_html,
              tags: selectedTemplate?.default_tags,
            })}
          >
            Weiter zum Editor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
