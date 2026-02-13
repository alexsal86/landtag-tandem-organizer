import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save, X, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface LetterOccasion {
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

interface LetterTemplate {
  id: string;
  name: string;
}

const ICON_OPTIONS = [
  { value: 'Users', label: 'Personen' },
  { value: 'Building2', label: 'Gebäude' },
  { value: 'PartyPopper', label: 'Feier' },
  { value: 'Heart', label: 'Herz' },
  { value: 'FileQuestion', label: 'Anfrage' },
  { value: 'MessageSquare', label: 'Nachricht' },
  { value: 'FileText', label: 'Dokument' },
  { value: 'Mail', label: 'Brief' },
  { value: 'Gavel', label: 'Recht' },
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
  { key: 'buergeranliegen', label: 'Bürgeranliegen', description: 'Antwort auf Anfragen von Bürgern', icon: 'Users', color: 'bg-blue-500', patterns: ['bürger', 'anliegen', 'antwort', 'citizen'] },
  { key: 'ministerium', label: 'Ministerium', description: 'Formelle Korrespondenz mit Ministerien', icon: 'Building2', color: 'bg-purple-500', patterns: ['minister', 'formal', 'amt'] },
  { key: 'einladung', label: 'Einladung', description: 'Veranstaltungseinladungen', icon: 'PartyPopper', color: 'bg-amber-500', patterns: ['einladung', 'invitation', 'event'] },
  { key: 'gruss', label: 'Gruß & Dank', description: 'Glückwünsche, Beileid, Dankschreiben', icon: 'Heart', color: 'bg-rose-500', patterns: ['gruß', 'gruss', 'dank', 'beileid', 'glückwunsch'] },
  { key: 'parlamentarische_anfrage', label: 'Parlamentarische Anfrage', description: 'Anfragen an die Regierung', icon: 'FileQuestion', color: 'bg-teal-500', patterns: ['anfrage', 'parlament', 'regierung'] },
  { key: 'stellungnahme', label: 'Stellungnahme', description: 'Offizielle Positionierung', icon: 'MessageSquare', color: 'bg-indigo-500', patterns: ['stellungnahme', 'position', 'statement'] },
  { key: 'sonstiges', label: 'Sonstiges', description: 'Freie Briefform', icon: 'FileText', color: 'bg-muted-foreground', patterns: [] },
];

export function LetterOccasionManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [occasions, setOccasions] = useState<LetterOccasion[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const seedingRef = React.useRef(false);
  const [form, setForm] = useState({
    key: '', label: '', description: '', icon: 'FileText', color: 'bg-blue-500',
    default_template_id: '', template_match_patterns: '', is_active: true, sort_order: 0,
  });

  useEffect(() => {
    if (currentTenant) {
      loadOccasions();
      loadTemplates();
    }
  }, [currentTenant]);

  const loadOccasions = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('letter_occasions')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('sort_order');
    if (error) {
      console.error('Error loading occasions:', error);
      setLoading(false);
      return;
    }
    if (!data || data.length === 0) {
      if (!seedingRef.current) {
        seedingRef.current = true;
        await seedDefaults();
      } else {
        setLoading(false);
      }
      return;
    }
    setOccasions(data);
    setLoading(false);
  };

  const loadTemplates = async () => {
    if (!currentTenant) return;
    const { data } = await supabase
      .from('letter_templates')
      .select('id, name')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('name');
    setTemplates(data || []);
  };

  const seedDefaults = async () => {
    if (!currentTenant) return;
    const insertedOccasions: LetterOccasion[] = [];
    for (let i = 0; i < DEFAULT_OCCASIONS.length; i++) {
      const o = DEFAULT_OCCASIONS[i];
      const { data, error } = await supabase.from('letter_occasions').insert({
        tenant_id: currentTenant.id,
        key: o.key,
        label: o.label,
        description: o.description,
        icon: o.icon,
        color: o.color,
        sort_order: i,
        template_match_patterns: o.patterns,
        is_active: true,
      }).select().maybeSingle();
      if (data) insertedOccasions.push(data);
      if (error) console.error('Seed error for', o.key, error);
    }
    if (insertedOccasions.length > 0) {
      setOccasions(insertedOccasions);
      toast({ title: 'Standard-Anlässe erstellt' });
    } else {
      toast({ title: 'Hinweis', description: 'Anlässe konnten nicht erstellt werden. Prüfen Sie die Berechtigungen.', variant: 'destructive' });
    }
    setLoading(false);
  };

  const resetForm = (occasion?: LetterOccasion) => {
    if (occasion) {
      setForm({
        key: occasion.key,
        label: occasion.label,
        description: occasion.description || '',
        icon: occasion.icon || 'FileText',
        color: occasion.color || 'bg-blue-500',
        default_template_id: occasion.default_template_id || '',
        template_match_patterns: (occasion.template_match_patterns || []).join(', '),
        is_active: occasion.is_active,
        sort_order: occasion.sort_order,
      });
    } else {
      setForm({
        key: '', label: '', description: '', icon: 'FileText', color: 'bg-blue-500',
        default_template_id: '', template_match_patterns: '', is_active: true,
        sort_order: occasions.length,
      });
    }
  };

  const handleSave = async () => {
    if (!currentTenant || !form.label.trim()) return;
    const patterns = form.template_match_patterns
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const payload = {
      tenant_id: currentTenant.id,
      key: form.key || form.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      label: form.label.trim(),
      description: form.description || null,
      icon: form.icon,
      color: form.color,
      default_template_id: form.default_template_id || null,
      template_match_patterns: patterns,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (editingId) {
      const { error } = await supabase.from('letter_occasions').update(payload).eq('id', editingId);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Anlass aktualisiert' });
    } else {
      const { error } = await supabase.from('letter_occasions').insert(payload);
      if (error) {
        toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Anlass erstellt' });
    }
    setEditingId(null);
    setShowCreate(false);
    loadOccasions();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('letter_occasions').delete().eq('id', deletingId);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Anlass gelöscht' });
      loadOccasions();
    }
    setDeletingId(null);
  };

  const isEditing = editingId || showCreate;

  if (loading) return <div className="text-sm text-muted-foreground p-4">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Brief-Anlässe</h3>
          <p className="text-sm text-muted-foreground">Verwalten Sie die Anlässe im Brief-Assistenten und deren Vorlagen-Zuordnung.</p>
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
                <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="z.B. Bürgeranliegen" />
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Standard-Briefvorlage</Label>
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
                placeholder="z.B. bürger, anliegen, antwort"
              />
              <p className="text-xs text-muted-foreground mt-1">Falls keine Standard-Vorlage gesetzt ist, wird anhand dieser Muster eine passende Vorlage gesucht.</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.is_active} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: !!c }))} id="occasion-active" />
              <Label htmlFor="occasion-active">Aktiv</Label>
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
          return (
            <div key={occasion.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white ${occasion.color || 'bg-muted-foreground'}`}>
                  <GripVertical className="h-4 w-4" />
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
