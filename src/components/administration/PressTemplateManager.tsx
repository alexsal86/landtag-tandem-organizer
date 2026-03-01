import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Save, Trash2, X, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_DIN5008_LAYOUT, type LetterLayoutSettings } from '@/types/letterLayout';
import { LetterLayoutCanvasDesigner } from '@/components/letters/LetterLayoutCanvasDesigner';
import { StructuredHeaderEditor } from '@/components/letters/StructuredHeaderEditor';
import { LayoutSettingsEditor } from '@/components/letters/LayoutSettingsEditor';
import { loadPressTemplates, persistPressTemplates, type PressTemplateConfig } from '@/components/press/pressTemplateConfig';

type EditorTab = 'canvas-designer' | 'header-designer' | 'footer-designer' | 'block-address' | 'block-info' | 'block-subject' | 'layout-settings' | 'general';
type BlockKey = 'addressField' | 'infoBlock' | 'subject';
type CanvasElement = any;

type PressTemplate = PressTemplateConfig;

const makeId = () => crypto.randomUUID();

const cloneLayout = (layout?: LetterLayoutSettings): LetterLayoutSettings => ({
  ...DEFAULT_DIN5008_LAYOUT,
  ...(layout || {}),
  margins: { ...DEFAULT_DIN5008_LAYOUT.margins, ...(layout?.margins || {}) },
  header: { ...DEFAULT_DIN5008_LAYOUT.header, ...(layout?.header || {}) },
  addressField: { ...DEFAULT_DIN5008_LAYOUT.addressField, ...(layout?.addressField || {}) },
  infoBlock: { ...DEFAULT_DIN5008_LAYOUT.infoBlock, ...(layout?.infoBlock || {}) },
  returnAddress: { ...DEFAULT_DIN5008_LAYOUT.returnAddress, ...(layout?.returnAddress || {}) },
  subject: { ...DEFAULT_DIN5008_LAYOUT.subject, ...(layout?.subject || {}) },
  content: { ...DEFAULT_DIN5008_LAYOUT.content, ...(layout?.content || {}) },
  footer: { ...DEFAULT_DIN5008_LAYOUT.footer, ...(layout?.footer || {}) },
  attachments: { ...DEFAULT_DIN5008_LAYOUT.attachments, ...(layout?.attachments || {}) },
  pagination: { ...(DEFAULT_DIN5008_LAYOUT.pagination || {}), ...(layout?.pagination || {}) },
  blockContent: { ...((layout?.blockContent as Record<string, any[]>) || {}) },
});

const getBlockItems = (layout: LetterLayoutSettings, blockKey: BlockKey) => {
  const content = ((layout as any).blockContent || {}) as Record<string, any[]>;
  return content[blockKey] || [];
};

export function PressTemplateManager() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<PressTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('canvas-designer');

  const [form, setForm] = useState({
    name: '',
    description: '',
    default_title: '',
    default_excerpt: '',
    default_tags: '',
    default_content_html: '',
    is_default: false,
    is_active: true,
    layout_settings: cloneLayout(DEFAULT_DIN5008_LAYOUT),
    header_elements: [] as CanvasElement[],
    footer_elements: [] as CanvasElement[],
  });

  useEffect(() => {
    if (!currentTenant) return;
    void loadTemplatesForTenant();
  }, [currentTenant?.id]);

  const loadTemplatesForTenant = async () => {
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
    setActiveTab('canvas-designer');

    if (template) {
      const layout = cloneLayout((template.layout_settings as LetterLayoutSettings | undefined));
      setForm({
        name: template.name || '',
        description: template.description || '',
        default_title: template.default_title || '',
        default_excerpt: template.default_excerpt || '',
        default_tags: template.default_tags || '',
        default_content_html: template.default_content_html || '',
        is_default: !!template.is_default,
        is_active: template.is_active !== false,
        layout_settings: layout,
        header_elements: Array.isArray(template.header_elements) ? template.header_elements : [],
        footer_elements: Array.isArray(template.footer_elements) ? template.footer_elements : [],
      });
      return;
    }

    setForm({
      name: '',
      description: '',
      default_title: '',
      default_excerpt: '',
      default_tags: '',
      default_content_html: '',
      is_default: templates.length === 0,
      is_active: true,
      layout_settings: cloneLayout(DEFAULT_DIN5008_LAYOUT),
      header_elements: [],
      footer_elements: [],
    });
  };

  const updateLayoutSettings = (updater: (prev: LetterLayoutSettings) => LetterLayoutSettings) => {
    setForm((prev) => ({
      ...prev,
      layout_settings: updater(prev.layout_settings),
    }));
  };

  const setBlockItems = (blockKey: BlockKey, items: any[]) => {
    updateLayoutSettings((layout) => {
      const current = ((layout as any).blockContent || {}) as Record<string, any[]>;
      return { ...layout, blockContent: { ...current, [blockKey]: items } } as LetterLayoutSettings;
    });
  };

  const renderBlockEditor = (blockKey: BlockKey, canvasWidthMm: number, canvasHeightMm: number) => (
    <StructuredHeaderEditor
      initialElements={getBlockItems(form.layout_settings, blockKey) as any}
      onElementsChange={(elements) => setBlockItems(blockKey, elements as any[])}
      layoutSettings={form.layout_settings}
      canvasWidthMm={canvasWidthMm}
      canvasHeightMm={canvasHeightMm}
      blockKey={blockKey}
    />
  );

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const payload: PressTemplate = {
      id: editingId || makeId(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      default_title: form.default_title.trim() || undefined,
      default_excerpt: form.default_excerpt.trim() || undefined,
      default_tags: form.default_tags.trim() || undefined,
      default_content_html: form.default_content_html.trim() || undefined,
      is_default: form.is_default,
      is_active: form.is_active,
      layout_settings: form.layout_settings,
      header_elements: form.header_elements,
      footer_elements: form.footer_elements,
    };

    const base = editingId
      ? templates.map((template) => (template.id === editingId ? payload : template))
      : [...templates, payload];

    const nextTemplates = payload.is_default
      ? base.map((template) => ({ ...template, is_default: template.id === payload.id }))
      : base;

    const ok = await saveTemplates(nextTemplates);
    if (!ok) return;

    toast({ title: editingId ? 'Pressevorlage aktualisiert' : 'Pressevorlage erstellt' });
    setEditingId(null);
    setShowCreate(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const next = templates.filter((template) => template.id !== deletingId);
    const hadDeletedDefault = templates.find((template) => template.id === deletingId)?.is_default;
    const adjusted = hadDeletedDefault && next.length > 0
      ? next.map((template, index) => ({ ...template, is_default: index === 0 }))
      : next;

    const ok = await saveTemplates(adjusted);
    if (ok) toast({ title: 'Pressevorlage gelöscht' });

    setDeletingId(null);
  };

  const isEditing = editingId || showCreate;

  const tabDefinitions: ReadonlyArray<{ value: EditorTab; label: string }> = useMemo(() => [
    { value: 'canvas-designer', label: 'Canvas' },
    { value: 'header-designer', label: 'Header' },
    { value: 'footer-designer', label: 'Footer' },
    { value: 'block-address', label: 'Adressfeld' },
    { value: 'block-info', label: 'Info-Block' },
    { value: 'block-subject', label: 'Betreff' },
    { value: 'layout-settings', label: 'Layout' },
    { value: 'general', label: 'Allgemein' },
  ], []);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Laden...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pressevorlagen</h3>
          <p className="text-sm text-muted-foreground">Template bearbeiten wie bei Briefvorlagen: Canvas, Header-Canvas, Blöcke und Variablen.</p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); resetForm(); }}>
          <Plus className="h-4 w-4 mr-1" /> Neue Vorlage
        </Button>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? `Template bearbeiten: ${form.name || 'Pressevorlage'}` : 'Neue Pressevorlage'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EditorTab)}>
              <TabsList className="w-full h-auto flex flex-wrap gap-1 justify-start">
                {tabDefinitions.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="canvas-designer" className="space-y-4 pt-4">
                <LetterLayoutCanvasDesigner
                  layoutSettings={form.layout_settings}
                  onLayoutChange={(settings) => setForm((prev) => ({ ...prev, layout_settings: settings }))}
                  onJumpToTab={(tab) => setActiveTab(tab as EditorTab)}
                  headerElements={form.header_elements}
                  actionButtons={
                    <div className="flex gap-2">
                      <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
                      <Button variant="outline" onClick={() => { setEditingId(null); setShowCreate(false); resetForm(); }}><X className="h-4 w-4 mr-1" /> Abbrechen</Button>
                    </div>
                  }
                />
              </TabsContent>

              <TabsContent value="header-designer" className="space-y-4 pt-4">
                <StructuredHeaderEditor
                  initialElements={form.header_elements as any}
                  onElementsChange={(elements) => setForm((prev) => ({ ...prev, header_elements: elements as any[] }))}
                  layoutSettings={form.layout_settings}
                  canvasWidthMm={form.layout_settings.pageWidth}
                  canvasHeightMm={form.layout_settings.header.height}
                  blockKey="header"
                />
              </TabsContent>

              <TabsContent value="footer-designer" className="space-y-4 pt-4">
                <StructuredHeaderEditor
                  initialElements={form.footer_elements as any}
                  onElementsChange={(elements) => setForm((prev) => ({ ...prev, footer_elements: elements as any[] }))}
                  layoutSettings={form.layout_settings}
                  canvasWidthMm={form.layout_settings.pageWidth}
                  canvasHeightMm={form.layout_settings.footer.height}
                  blockKey="footer"
                />
              </TabsContent>

              <TabsContent value="block-address" className="space-y-4 pt-4">
                {renderBlockEditor('addressField', form.layout_settings.addressField.width, form.layout_settings.addressField.height)}
              </TabsContent>

              <TabsContent value="block-info" className="space-y-4 pt-4">
                {renderBlockEditor('infoBlock', form.layout_settings.infoBlock.width, form.layout_settings.infoBlock.height)}
              </TabsContent>

              <TabsContent value="block-subject" className="space-y-4 pt-4">
                {renderBlockEditor('subject', form.layout_settings.pageWidth - form.layout_settings.margins.left - form.layout_settings.margins.right, 35)}
              </TabsContent>

              <TabsContent value="layout-settings" className="space-y-4 pt-4">
                <LayoutSettingsEditor
                  layoutSettings={form.layout_settings}
                  onLayoutChange={(settings) => setForm((prev) => ({ ...prev, layout_settings: settings }))}
                />
              </TabsContent>

              <TabsContent value="general" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Beschreibung</Label>
                    <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Standardtitel</Label>
                    <Input value={form.default_title} onChange={(e) => setForm((prev) => ({ ...prev, default_title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Standard-Teaser</Label>
                    <Textarea rows={2} value={form.default_excerpt} onChange={(e) => setForm((prev) => ({ ...prev, default_excerpt: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Standard-Tags (kommagetrennt)</Label>
                    <Input value={form.default_tags} onChange={(e) => setForm((prev) => ({ ...prev, default_tags: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Legacy Startinhalt (HTML)</Label>
                    <Textarea rows={6} value={form.default_content_html} onChange={(e) => setForm((prev) => ({ ...prev, default_content_html: e.target.value }))} />
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

                <div className="flex gap-2">
                  <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
                  <Button variant="outline" onClick={() => { setEditingId(null); setShowCreate(false); resetForm(); }}><X className="h-4 w-4 mr-1" /> Abbrechen</Button>
                </div>
              </TabsContent>
            </Tabs>
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
                {(template.header_elements || template.layout_settings) && <Badge variant="secondary" className="text-xs"><LayoutTemplate className="h-3 w-3 mr-1" /> Canvas</Badge>}
                {template.default_content_html && <Badge variant="secondary" className="text-xs">Legacy HTML</Badge>}
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
