import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save, X, Megaphone, Building2, Users, FileText, Handshake, Vote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const OCCASION_KEY = 'press_occasions_v1';
const TEMPLATE_KEY = 'press_templates_v1';

interface PressOccasion {
  id: string;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  default_template_id: string | null;
  template_match_patterns: string[];
  is_active: boolean;
}

interface PressTemplate {
  id: string;
  name: string;
  is_active?: boolean;
}

const ICON_OPTIONS = [
  { value: 'Megaphone', label: 'Presse' },
  { value: 'Users', label: 'Personen' },
  { value: 'Building2', label: 'Institution' },
  { value: 'Handshake', label: 'Kooperation' },
  { value: 'Vote', label: 'Politik' },
  { value: 'FileText', label: 'Dokument' },
];

const COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: 'Blau' },
  { value: 'bg-purple-500', label: 'Lila' },
  { value: 'bg-amber-500', label: 'Amber' },
  { value: 'bg-rose-500', label: 'Rose' },
  { value: 'bg-teal-500', label: 'Teal' },
  { value: 'bg-indigo-500', label: 'Indigo' },
  { value: 'bg-green-500', label: 'Grün' },
  { value: 'bg-orange-500', label: 'Orange' },
  { value: 'bg-muted-foreground', label: 'Grau' },
];

const DEFAULT_OCCASIONS = [
  { key: 'statement', label: 'Stellungnahme', description: 'Politische Einordnung zu aktuellen Themen', icon: 'Megaphone', color: 'bg-blue-500', patterns: ['stellungnahme', 'einordnung', 'kommentar'] },
  { key: 'event', label: 'Veranstaltung', description: 'Ankündigungen und Rückblicke', icon: 'Users', color: 'bg-amber-500', patterns: ['veranstaltung', 'termin', 'einladung'] },
  { key: 'institution', label: 'Institutionell', description: 'Mitteilungen zu Fraktion, Landtag und Kreisverband', icon: 'Building2', color: 'bg-purple-500', patterns: ['fraktion', 'landtag', 'kreisverband'] },
  { key: 'coalition', label: 'Kooperation', description: 'Gemeinsame Pressemitteilungen mit Partnern', icon: 'Handshake', color: 'bg-teal-500', patterns: ['kooperation', 'gemeinsam', 'partner'] },
  { key: 'election', label: 'Wahlkreis & Abstimmung', description: 'Wahlkreisarbeit und parlamentarische Abstimmungen', icon: 'Vote', color: 'bg-indigo-500', patterns: ['wahlkreis', 'abstimmung', 'plenum'] },
  { key: 'sonstiges', label: 'Sonstiges', description: 'Freier Presseanlass', icon: 'FileText', color: 'bg-muted-foreground', patterns: [] },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Megaphone,
  Users,
  Building2,
  Handshake,
  Vote,
  FileText,
};

const makeId = () => crypto.randomUUID();

export function PressOccasionManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [occasions, setOccasions] = useState<PressOccasion[]>([]);
  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const seedingRef = React.useRef(false);
  const [form, setForm] = useState({
    key: '', label: '', description: '', icon: 'Megaphone', color: 'bg-blue-500',
    default_template_id: '', template_match_patterns: '', is_active: true, sort_order: 0,
  });

  useEffect(() => {
    if (currentTenant) {
      void loadOccasions();
      void loadTemplates();
    }
  }, [currentTenant]);

  const loadOccasions = async () => {
    if (!currentTenant) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('tenant_id', currentTenant.id)
      .eq('setting_key', OCCASION_KEY)
      .maybeSingle();

    if (error) {
      console.error('Error loading press occasions:', error);
      setLoading(false);
      return;
    }

    try {
      const parsed = data?.setting_value ? JSON.parse(data.setting_value) : [];
      const sorted = Array.isArray(parsed) ? parsed.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
      if (sorted.length === 0) {
        if (!seedingRef.current) {
          seedingRef.current = true;
          await seedDefaults();
        } else {
          setLoading(false);
        }
        return;
      }
      setOccasions(sorted);
    } catch {
      setOccasions([]);
    }

    setLoading(false);
  };

  const loadTemplates = async () => {
    if (!currentTenant) return;

    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('tenant_id', currentTenant.id)
      .eq('setting_key', TEMPLATE_KEY)
      .maybeSingle();

    try {
      const parsed = data?.setting_value ? JSON.parse(data.setting_value) : [];
      setTemplates(Array.isArray(parsed) ? parsed.filter((t) => t.is_active !== false) : []);
    } catch {
      setTemplates([]);
    }
  };

  const persistOccasions = async (nextOccasions: PressOccasion[]) => {
    if (!currentTenant) return false;

    const sorted = [...nextOccasions].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const serialized = JSON.stringify(sorted);

    const { data: existing, error: existingError } = await supabase
      .from('app_settings')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('setting_key', OCCASION_KEY)
      .maybeSingle();

    if (existingError) {
      toast({ title: 'Fehler', description: existingError.message, variant: 'destructive' });
      return false;
    }

    const query = existing
      ? supabase.from('app_settings').update({ setting_value: serialized }).eq('id', existing.id)
      : supabase.from('app_settings').insert({ tenant_id: currentTenant.id, setting_key: OCCASION_KEY, setting_value: serialized });

    const { error } = await query;
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }

    setOccasions(sorted);
    return true;
  };

  const seedDefaults = async () => {
    if (!currentTenant) return;
    const seeded: PressOccasion[] = DEFAULT_OCCASIONS.map((o, index) => ({
      id: makeId(),
      key: o.key,
      label: o.label,
      description: o.description,
      icon: o.icon,
      color: o.color,
      sort_order: index,
      default_template_id: null,
      template_match_patterns: o.patterns,
      is_active: true,
    }));
    const ok = await persistOccasions(seeded);
    if (ok) {
      toast({ title: 'Standard-Anlässe erstellt' });
      setLoading(false);
    }
  };

  const resetForm = (occasion?: PressOccasion) => {
    if (occasion) {
      setForm({
        key: occasion.key,
        label: occasion.label,
        description: occasion.description || '',
        icon: occasion.icon || 'Megaphone',
        color: occasion.color || 'bg-blue-500',
        default_template_id: occasion.default_template_id || '',
        template_match_patterns: (occasion.template_match_patterns || []).join(', '),
        is_active: occasion.is_active,
        sort_order: occasion.sort_order,
      });
      return;
    }

    setForm({
      key: '',
      label: '',
      description: '',
      icon: 'Megaphone',
      color: 'bg-blue-500',
      default_template_id: '',
      template_match_patterns: '',
      is_active: true,
      sort_order: occasions.length,
    });
  };

  const handleSave = async () => {
    if (!currentTenant || !form.label.trim()) return;

    const payload: PressOccasion = {
      id: editingId || makeId(),
      key: form.key || form.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: form.label.trim(),
      description: form.description || null,
      icon: form.icon,
      color: form.color,
      default_template_id: form.default_template_id || null,
      template_match_patterns: form.template_match_patterns
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    const next = editingId
      ? occasions.map((item) => (item.id === editingId ? payload : item))
      : [...occasions, payload];

    const ok = await persistOccasions(next);
    if (!ok) return;

    toast({ title: editingId ? 'Anlass aktualisiert' : 'Anlass erstellt' });
    setEditingId(null);
    setShowCreate(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const ok = await persistOccasions(occasions.filter((o) => o.id !== deletingId));
    if (ok) toast({ title: 'Anlass gelöscht' });
    setDeletingId(null);
  };

  const getIconComponent = (iconName?: string | null) => {
    if (!iconName) return FileText;
    return ICON_MAP[iconName] || FileText;
  };

  const selectedIconOption = ICON_OPTIONS.find((option) => option.value === form.icon);
  const SelectedFormIcon = getIconComponent(form.icon);
  const isEditing = editingId || showCreate;

  if (loading) return <div className="text-sm text-muted-foreground p-4">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Presse-Anlässe</h3>
          <p className="text-sm text-muted-foreground">Verwalten Sie die Anlässe im Presse-Assistenten und deren Vorlagen-Zuordnung.</p>
        </div>
        <div className="flex gap-2">
          {occasions.length === 0 && (
            <Button variant="outline" size="sm" onClick={seedDefaults}>
              Standard-Anlässe erstellen
            </Button>
          )}
          <Button size="sm" onClick={() => { setShowCreate(true); resetForm(); }}>
            <Plus className="h-4 w-4 mr-1" /> Neuer Anlass
          </Button>
        </div>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Anlass bearbeiten' : 'Neuer Anlass'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bezeichnung *</Label>
                <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="z.B. Stellungnahme" />
              </div>
              <div>
                <Label>Schlüssel</Label>
                <Input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="auto-generiert" />
              </div>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Icon</Label>
                <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <SelectedFormIcon className="h-4 w-4" />
                      <span>{selectedIconOption?.label || 'Icon wählen'}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((o) => {
                      const OptionIcon = getIconComponent(o.value);
                      return (
                        <SelectItem key={o.value} value={o.value}>
                          <div className="flex items-center gap-2">
                            <OptionIcon className="h-4 w-4" />
                            <span>{o.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Farbe</Label>
                <Select value={form.color} onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${o.value}`} />
                          {o.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reihenfolge</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Standard-Pressevorlage</Label>
              <Select value={form.default_template_id || '_none'} onValueChange={(v) => setForm((f) => ({ ...f, default_template_id: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Keine Vorlage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Keine Vorlage</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vorlagen-Suchmuster (kommagetrennt)</Label>
              <Input
                value={form.template_match_patterns}
                onChange={(e) => setForm((f) => ({ ...f, template_match_patterns: e.target.value }))}
                placeholder="z.B. stellungnahme, einordnung, kommentar"
              />
              <p className="text-xs text-muted-foreground mt-1">Falls keine Standard-Vorlage gesetzt ist, wird anhand dieser Muster eine passende Vorlage vorgeschlagen.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_active} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: !!c }))} id="press-occasion-active" />
              <Label htmlFor="press-occasion-active">Aktiv</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
              <Button variant="outline" onClick={() => { setEditingId(null); setShowCreate(false); }}><X className="h-4 w-4 mr-1" /> Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {occasions.map((occasion) => {
          const template = templates.find((t) => t.id === occasion.default_template_id);
          const OccasionIcon = getIconComponent(occasion.icon);
          return (
            <div key={occasion.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white ${occasion.color || 'bg-muted-foreground'}`}>
                  <OccasionIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{occasion.label}</span>
                    {!occasion.is_active && <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    {occasion.description && <span>{occasion.description}</span>}
                    {template && <Badge variant="secondary" className="text-xs">Vorlage: {template.name}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditingId(occasion.id); resetForm(occasion); setShowCreate(false); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeletingId(occasion.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
        {occasions.length === 0 && !isEditing && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Noch keine Anlässe konfiguriert. Klicken Sie auf "Standard-Anlässe erstellen" oder fügen Sie einen neuen Anlass hinzu.
          </p>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anlass löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dieser Anlass wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
