import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

const SETTINGS_KEY = 'press_templates_v1';

type PressTemplate = {
  id: string;
  name: string;
  description?: string;
  default_title?: string;
  default_excerpt?: string;
  default_content_html?: string;
  default_tags?: string;
  is_default?: boolean;
  is_active?: boolean;
};

const makeId = () => crypto.randomUUID();

export function PressTemplateManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PressTemplate | null>(null);

  const hasTemplates = useMemo(() => templates.length > 0, [templates.length]);

  useEffect(() => {
    if (!currentTenant) return;
    void loadTemplates();
  }, [currentTenant?.id]);

  const loadTemplates = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('tenant_id', currentTenant.id)
      .eq('setting_key', SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    try {
      const parsed = data?.setting_value ? JSON.parse(data.setting_value) : [];
      setTemplates(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTemplates([]);
    }
    setLoading(false);
  };

  const persistTemplates = async (nextTemplates: PressTemplate[]) => {
    if (!currentTenant) return false;
    const serialized = JSON.stringify(nextTemplates);

    const { data: existing, error: findError } = await supabase
      .from('app_settings')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('setting_key', SETTINGS_KEY)
      .maybeSingle();

    if (findError) {
      toast({ title: 'Fehler', description: findError.message, variant: 'destructive' });
      return false;
    }

    if (existing) {
      const { error } = await supabase.from('app_settings').update({ setting_value: serialized }).eq('id', existing.id);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    } else {
      const { error } = await supabase
        .from('app_settings')
        .insert({ tenant_id: currentTenant.id, setting_key: SETTINGS_KEY, setting_value: serialized });
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return false;
      }
    }

    setTemplates(nextTemplates);
    return true;
  };

  const startCreate = () => {
    setEditing({ id: makeId(), name: '', description: '', default_title: '', default_excerpt: '', default_content_html: '', default_tags: '', is_default: !hasTemplates, is_active: true });
  };

  const saveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    const normalized = {
      ...editing,
      name: editing.name.trim(),
      is_active: editing.is_active ?? true,
      is_default: editing.is_default ?? false,
    };

    const base = templates.filter((t) => t.id !== normalized.id);
    const next = normalized.is_default
      ? [{ ...normalized, is_default: true }, ...base.map((t) => ({ ...t, is_default: false }))]
      : [...base, normalized];

    const ok = await persistTemplates(next);
    if (ok) {
      toast({ title: 'Pressevorlage gespeichert' });
      setEditing(null);
    }
  };

  const removeTemplate = async (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    const ok = await persistTemplates(next);
    if (ok) toast({ title: 'Pressevorlage gelöscht' });
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Pressevorlagen...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pressevorlagen</h3>
          <p className="text-sm text-muted-foreground">Grundlagen wie bei Briefvorlagen für den Presse-Wizard.</p>
        </div>
        <Button size="sm" onClick={startCreate}><Plus className="h-4 w-4 mr-1" />Neue Vorlage</Button>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{templates.some((t) => t.id === editing.id) ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={editing.name} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, name: e.target.value }) : prev)} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, description: e.target.value }) : prev)} />
            </div>
            <div>
              <Label>Standardtitel</Label>
              <Input value={editing.default_title || ''} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, default_title: e.target.value }) : prev)} />
            </div>
            <div>
              <Label>Teaser (Excerpt)</Label>
              <Textarea rows={2} value={editing.default_excerpt || ''} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, default_excerpt: e.target.value }) : prev)} />
            </div>
            <div>
              <Label>Standardinhalt (HTML)</Label>
              <Textarea rows={4} value={editing.default_content_html || ''} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, default_content_html: e.target.value }) : prev)} />
            </div>
            <div>
              <Label>Standard-Tags (kommagetrennt)</Label>
              <Input value={editing.default_tags || ''} onChange={(e) => setEditing((prev) => prev ? ({ ...prev, default_tags: e.target.value }) : prev)} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!editing.is_default} onCheckedChange={(v) => setEditing((prev) => prev ? ({ ...prev, is_default: !!v }) : prev)} /> Als Standard</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!editing.is_active} onCheckedChange={(v) => setEditing((prev) => prev ? ({ ...prev, is_active: !!v }) : prev)} /> Aktiv</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-1" />Abbrechen</Button>
              <Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" />Speichern</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="pt-4 flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{template.name}</span>
                  {template.is_default && <Badge>Standard</Badge>}
                  {!template.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                </div>
                {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(template)}>Bearbeiten</Button>
                <Button size="sm" variant="ghost" onClick={() => removeTemplate(template.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Pressevorlagen vorhanden.</p>}
      </div>
    </div>
  );
}
