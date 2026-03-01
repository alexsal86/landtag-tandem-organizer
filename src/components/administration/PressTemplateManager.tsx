import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Save, Trash2, X, Sparkles, Eye, LayoutTemplate, FileCode2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import EnhancedLexicalEditor from '@/components/EnhancedLexicalEditor';
import { loadPressTemplates, persistPressTemplates, type PressTemplateConfig } from '@/components/press/pressTemplateConfig';

type PressTemplate = PressTemplateConfig;

const makeId = () => crypto.randomUUID();

const getCanvasPreviewHtml = (html?: string) => {
  if (!html?.trim()) {
    return '<p class="text-muted-foreground">Noch kein Startinhalt definiert.</p>';
  }

  return html;
};

export function PressTemplateManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState('canvas');
  const [form, setForm] = useState<Required<Omit<PressTemplate, 'id'>> & { id?: string }>({
    name: '',
    description: '',
    default_title: '',
    default_excerpt: '',
    default_content_html: '',
    default_tags: '',
    is_default: false,
    is_active: true,
  });

  useEffect(() => {
    if (!currentTenant) return;
    void loadTemplates();
  }, [currentTenant?.id]);

  const loadTemplates = async () => {
    if (!currentTenant) return;
    setLoading(true);

    try {
      const loadedTemplates = await loadPressTemplates(currentTenant.id);
      setTemplates(loadedTemplates);
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplates = async (nextTemplates: PressTemplate[]) => {
    if (!currentTenant) return false;

    try {
      await persistPressTemplates(currentTenant.id, nextTemplates);
      setTemplates(nextTemplates);
      return true;
    } catch (error: any) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const resetForm = (template?: PressTemplate) => {
    setActiveEditorTab('canvas');

    if (template) {
      setForm({
        id: template.id,
        name: template.name || '',
        description: template.description || '',
        default_title: template.default_title || '',
        default_excerpt: template.default_excerpt || '',
        default_content_html: template.default_content_html || '',
        default_tags: template.default_tags || '',
        is_default: !!template.is_default,
        is_active: template.is_active !== false,
      });
      return;
    }

    setForm({
      name: '',
      description: '',
      default_title: '',
      default_excerpt: '',
      default_content_html: '',
      default_tags: '',
      is_default: templates.length === 0,
      is_active: true,
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const payload: PressTemplate = {
      id: editingId || makeId(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      default_title: form.default_title.trim() || undefined,
      default_excerpt: form.default_excerpt.trim() || undefined,
      default_content_html: form.default_content_html.trim() || undefined,
      default_tags: form.default_tags.trim() || undefined,
      is_default: form.is_default,
      is_active: form.is_active,
    };

    const base = editingId
      ? templates.map((t) => (t.id === editingId ? payload : t))
      : [...templates, payload];

    const nextTemplates = payload.is_default
      ? base.map((t) => ({ ...t, is_default: t.id === payload.id }))
      : base;

    const ok = await saveTemplates(nextTemplates);
    if (!ok) return;

    toast({ title: editingId ? 'Pressevorlage aktualisiert' : 'Pressevorlage erstellt' });
    setEditingId(null);
    setShowCreate(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const next = templates.filter((t) => t.id !== deletingId);
    const hadDeletedDefault = templates.find((t) => t.id === deletingId)?.is_default;
    const adjusted = hadDeletedDefault && next.length > 0
      ? next.map((t, index) => ({ ...t, is_default: index === 0 }))
      : next;

    const ok = await saveTemplates(adjusted);
    if (ok) toast({ title: 'Pressevorlage gelöscht' });

    setDeletingId(null);
  };

  const isEditing = editingId || showCreate;
  const canvasPreviewHtml = useMemo(() => getCanvasPreviewHtml(form.default_content_html), [form.default_content_html]);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pressevorlagen</h3>
          <p className="text-sm text-muted-foreground">Verwalten Sie Vorlagen für Presse-Wizard und Editor mit tab-basiertem Template-Studio (inkl. Content-Canvas).</p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); resetForm(); }}>
          <Plus className="h-4 w-4 mr-1" /> Neue Vorlage
        </Button>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeEditorTab} onValueChange={setActiveEditorTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basis"><Type className="h-4 w-4 mr-1" /> Basis</TabsTrigger>
                <TabsTrigger value="wizard"><Sparkles className="h-4 w-4 mr-1" /> Wizard</TabsTrigger>
                <TabsTrigger value="canvas"><LayoutTemplate className="h-4 w-4 mr-1" /> Canvas</TabsTrigger>
                <TabsTrigger value="html"><FileCode2 className="h-4 w-4 mr-1" /> HTML</TabsTrigger>
              </TabsList>

              <TabsContent value="basis" className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="z.B. Standard-Pressemitteilung"
                    />
                  </div>
                  <div>
                    <Label>Beschreibung</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Kurzbeschreibung für den Anwendungsfall"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.is_default} onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_default: !!v }))} />
                    Als Standardvorlage
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: !!v }))} />
                    Aktiv
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="wizard" className="pt-4 space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4" /> Wizard-Standardwerte</h4>
                <div>
                  <Label>Standardtitel</Label>
                  <Input
                    value={form.default_title}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_title: e.target.value }))}
                    placeholder="Titel-Vorschlag im Wizard"
                  />
                </div>
                <div>
                  <Label>Standard-Teaser (Excerpt)</Label>
                  <Textarea
                    rows={2}
                    value={form.default_excerpt}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_excerpt: e.target.value }))}
                    placeholder="Kurztext für Presseverteiler"
                  />
                </div>
                <div>
                  <Label>Standard-Tags (kommagetrennt)</Label>
                  <Input
                    value={form.default_tags}
                    onChange={(e) => setForm((prev) => ({ ...prev, default_tags: e.target.value }))}
                    placeholder="Pressemitteilung, Landtag, ..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="canvas" className="pt-4 space-y-3">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-3">Editor-Canvas für den Startinhalt der Pressevorlage.</p>
                  <EnhancedLexicalEditor
                    content={form.default_content_html || ''}
                    onChange={(_, __, contentHtml) => {
                      setForm((prev) => ({ ...prev, default_content_html: contentHtml || '' }));
                    }}
                    placeholder="Erstellen Sie hier den Startinhalt für neue Pressemitteilungen ..."
                    matchLetterPreview
                  />
                </div>

                <div className="rounded-lg border p-4 bg-background">
                  <div className="flex items-center gap-2 text-sm font-medium mb-3"><Eye className="h-4 w-4" /> Canvas-Vorschau</div>
                  <div className="mx-auto w-full max-w-[794px] min-h-[320px] border bg-white p-8 shadow-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: canvasPreviewHtml }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="html" className="pt-4">
                <Label>Standardinhalt (HTML)</Label>
                <Textarea
                  rows={12}
                  value={form.default_content_html}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_content_html: e.target.value }))}
                  placeholder="Optionales HTML-Startgerüst für den Presse-Editor"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Tipp: Hier können Sie ein Redaktions-Skelett hinterlegen (Zwischenüberschriften, Boilerplate, Kontaktblock).</p>
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="flex gap-2">
              <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
              <Button variant="outline" onClick={() => { setEditingId(null); setShowCreate(false); }}><X className="h-4 w-4 mr-1" /> Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates.map((template) => (
          <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{template.name}</span>
                {template.is_default && <Badge>Standard</Badge>}
                {template.is_active === false && <Badge variant="outline" className="text-xs">Inaktiv</Badge>}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-2 items-center">
                {template.description && <span>{template.description}</span>}
                {template.default_title && <Badge variant="secondary" className="text-xs">Titel vorbelegt</Badge>}
                {template.default_excerpt && <Badge variant="secondary" className="text-xs">Teaser vorbelegt</Badge>}
                {template.default_content_html && <Badge variant="secondary" className="text-xs">Canvas-Inhalt</Badge>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditingId(template.id); resetForm(template); setShowCreate(false); }}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeletingId(template.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}

        {templates.length === 0 && !isEditing && (
          <p className="text-sm text-muted-foreground text-center py-8">Noch keine Pressevorlagen vorhanden. Legen Sie eine neue Vorlage an.</p>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Pressevorlage wird unwiderruflich gelöscht.</AlertDialogDescription>
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
