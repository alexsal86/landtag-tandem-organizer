import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X, Megaphone, Building2, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';

const OCCASION_KEY = 'press_occasions_v1';
const TEMPLATE_KEY = 'press_templates_v1';

const DEFAULT_OCCASIONS = [
  { key: 'statement', label: 'Stellungnahme', description: 'Politische Einordnung zu aktuellem Thema', icon: 'Megaphone', color: 'bg-blue-500', template_match_patterns: ['stellungnahme', 'einordnung'] },
  { key: 'event', label: 'Veranstaltung', description: 'Ankündigungen und Nachberichte', icon: 'Users', color: 'bg-amber-500', template_match_patterns: ['veranstaltung', 'termin'] },
  { key: 'institution', label: 'Institutionell', description: 'Mitteilungen zu Fraktion, Landtag, Kreisverband', icon: 'Building2', color: 'bg-purple-500', template_match_patterns: ['fraktion', 'landtag', 'kreisverband'] },
];

type PressOccasion = {
  id: string;
  key: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  default_template_id?: string;
  template_match_patterns?: string[];
  is_active?: boolean;
  sort_order?: number;
};

type PressTemplate = { id: string; name: string; is_active?: boolean };

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Megaphone,
  Building2,
  Users,
  FileText,
};

const ICON_OPTIONS = ['Megaphone', 'Building2', 'Users', 'FileText'];
const COLOR_OPTIONS = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500', 'bg-rose-500', 'bg-muted-foreground'];

const makeId = () => crypto.randomUUID();

export function PressOccasionManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [occasions, setOccasions] = useState<PressOccasion[]>([]);
  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PressOccasion | null>(null);

  const hasOccasions = useMemo(() => occasions.length > 0, [occasions.length]);

  useEffect(() => {
    if (!currentTenant) return;
    void loadAll();
  }, [currentTenant?.id]);

  const loadAll = async () => {
    if (!currentTenant) return;
    setLoading(true);

    const { data: occData } = await supabase.from('app_settings').select('setting_value').eq('tenant_id', currentTenant.id).eq('setting_key', OCCASION_KEY).maybeSingle();
    const { data: tplData } = await supabase.from('app_settings').select('setting_value').eq('tenant_id', currentTenant.id).eq('setting_key', TEMPLATE_KEY).maybeSingle();

    try {
      const parsedOcc = occData?.setting_value ? JSON.parse(occData.setting_value) : [];
      setOccasions(Array.isArray(parsedOcc) ? parsedOcc.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : []);
    } catch {
      setOccasions([]);
    }

    try {
      const parsedTpl = tplData?.setting_value ? JSON.parse(tplData.setting_value) : [];
      setTemplates(Array.isArray(parsedTpl) ? parsedTpl : []);
    } catch {
      setTemplates([]);
    }

    setLoading(false);
  };

  const persistOccasions = async (nextOccasions: PressOccasion[]) => {
    if (!currentTenant) return false;
    const serialized = JSON.stringify(nextOccasions);
    const { data: existing } = await supabase.from('app_settings').select('id').eq('tenant_id', currentTenant.id).eq('setting_key', OCCASION_KEY).maybeSingle();

    const query = existing
      ? supabase.from('app_settings').update({ setting_value: serialized }).eq('id', existing.id)
      : supabase.from('app_settings').insert({ tenant_id: currentTenant.id, setting_key: OCCASION_KEY, setting_value: serialized });

    const { error } = await query;
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }

    setOccasions(nextOccasions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    return true;
  };

  const seedDefaults = async () => {
    const seeded = DEFAULT_OCCASIONS.map((occ, index) => ({ ...occ, id: makeId(), is_active: true, sort_order: index }));
    const ok = await persistOccasions(seeded);
    if (ok) toast({ title: 'Standard-Anlässe erstellt' });
  };

  const saveEdit = async () => {
    if (!editing || !editing.label?.trim()) return;
    const normalized: PressOccasion = {
      ...editing,
      key: editing.key?.trim() || editing.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: editing.label.trim(),
      sort_order: editing.sort_order ?? occasions.length,
      is_active: editing.is_active ?? true,
      template_match_patterns: editing.template_match_patterns || [],
    };
    const next = [...occasions.filter((o) => o.id !== normalized.id), normalized];
    const ok = await persistOccasions(next);
    if (ok) {
      toast({ title: 'Presseanlass gespeichert' });
      setEditing(null);
    }
  };

  const removeOccasion = async (id: string) => {
    const ok = await persistOccasions(occasions.filter((o) => o.id !== id));
    if (ok) toast({ title: 'Presseanlass gelöscht' });
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Presseanlässe...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Presse-Anlässe</h3>
          <p className="text-sm text-muted-foreground">Anlasslogik analog zu Brief-Anlässen für den Presse-Wizard.</p>
        </div>
        <div className="flex gap-2">
          {!hasOccasions && <Button variant="outline" size="sm" onClick={seedDefaults}>Standard-Anlässe</Button>}
          <Button size="sm" onClick={() => setEditing({ id: makeId(), key: '', label: '', description: '', icon: 'Megaphone', color: 'bg-blue-500', is_active: true, sort_order: occasions.length, default_template_id: '', template_match_patterns: [] })}><Plus className="h-4 w-4 mr-1" />Neuer Anlass</Button>
        </div>
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle className="text-base">Anlass bearbeiten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Label *</Label><Input value={editing.label} onChange={(e) => setEditing((p) => p ? ({ ...p, label: e.target.value }) : p)} /></div>
              <div><Label>Key</Label><Input value={editing.key} onChange={(e) => setEditing((p) => p ? ({ ...p, key: e.target.value }) : p)} /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={editing.description || ''} onChange={(e) => setEditing((p) => p ? ({ ...p, description: e.target.value }) : p)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Icon</Label><Select value={editing.icon || 'Megaphone'} onValueChange={(value) => setEditing((p) => p ? ({ ...p, icon: value }) : p)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ICON_OPTIONS.map((icon) => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Farbe</Label><Select value={editing.color || 'bg-blue-500'} onValueChange={(value) => setEditing((p) => p ? ({ ...p, color: value }) : p)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COLOR_OPTIONS.map((color) => <SelectItem key={color} value={color}>{color}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Standardvorlage</Label><Select value={editing.default_template_id || 'none'} onValueChange={(value) => setEditing((p) => p ? ({ ...p, default_template_id: value === 'none' ? '' : value }) : p)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Keine</SelectItem>{templates.filter((t) => t.is_active !== false).map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div>
              <Label>Matching-Begriffe (kommagetrennt)</Label>
              <Input value={(editing.template_match_patterns || []).join(', ')} onChange={(e) => setEditing((p) => p ? ({ ...p, template_match_patterns: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }) : p)} />
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!editing.is_active} onCheckedChange={(v) => setEditing((p) => p ? ({ ...p, is_active: !!v }) : p)} /> Aktiv</label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-1" />Abbrechen</Button><Button onClick={saveEdit}><Save className="h-4 w-4 mr-1" />Speichern</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {occasions.map((occasion) => {
          const Icon = ICON_MAP[occasion.icon || 'FileText'] || FileText;
          return (
            <Card key={occasion.id}>
              <CardContent className="pt-4 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="font-medium">{occasion.label}</span>{!occasion.is_active && <Badge variant="secondary">Inaktiv</Badge>}</div>
                  {occasion.description && <p className="text-sm text-muted-foreground">{occasion.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(occasion)}>Bearbeiten</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeOccasion(occasion.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {occasions.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Presse-Anlässe vorhanden.</p>}
      </div>
    </div>
  );
}
