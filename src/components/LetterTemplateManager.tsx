import React, { useState, useEffect } from 'react';
import { Edit3, Trash2, Plus, Save, X, Eye, EyeOff, Upload, GripVertical, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { StructuredHeaderEditor } from '@/components/letters/StructuredHeaderEditor';
import { StructuredFooterEditor } from '@/components/letters/StructuredFooterEditor';
import { LayoutSettingsEditor } from '@/components/letters/LayoutSettingsEditor';
import { LetterLayoutCanvasDesigner } from '@/components/letters/LetterLayoutCanvasDesigner';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';
import { SenderInformationManager } from '@/components/administration/SenderInformationManager';
import { InformationBlockManager } from '@/components/administration/InformationBlockManager';

interface LetterTemplate {
  id: string;
  name: string;
  letterhead_html: string;
  letterhead_css: string;
  response_time_days: number;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  default_sender_id?: string | null;
  default_info_blocks?: any;
  header_layout_type?: any;
  header_text_elements?: any;
  layout_settings?: any;
}

interface SenderInformation {
  id: string;
  name: string;
  organization: string;
  is_default: boolean;
}

interface InformationBlock {
  id: string;
  name: string;
  label: string;
  is_default: boolean;
}

const LetterTemplateManager: React.FC = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [senderInfos, setSenderInfos] = useState<SenderInformation[]>([]);
  const [infoBlocks, setInfoBlocks] = useState<InformationBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createActiveTab, setCreateActiveTab] = useState('canvas-designer');
  const [editActiveTab, setEditActiveTab] = useState('canvas-designer');
  const [selectedBlockItem, setSelectedBlockItem] = useState<Record<string, string | null>>({});
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [systemImages, setSystemImages] = useState<{ name: string; url: string }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    letterhead_html: '',
    letterhead_css: '',
    response_time_days: 21,
    default_sender_id: '',
    default_info_blocks: [] as string[],
    header_elements: [] as any[],
    footer_blocks: [] as any[],
    layout_settings: DEFAULT_DIN5008_LAYOUT as LetterLayoutSettings
  });

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
      loadSystemImages();
    }
  }, [currentTenant]);

  const loadSystemImages = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data, error } = await supabase.storage
        .from('letter-assets')
        .list(`${currentTenant.id}/_system/briefvorlagen-bilder`);
      if (error) return;
      if (data) {
        const images = data
          .filter((f) => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name))
          .map((f) => {
            const path = `${currentTenant.id}/_system/briefvorlagen-bilder/${f.name}`;
            const { data: urlData } = supabase.storage.from('letter-assets').getPublicUrl(path);
            return { name: f.name, url: urlData.publicUrl };
          });
        setSystemImages(images);
      }
    } catch (error) {
      console.error('Error loading system images:', error);
    }
  };

  const handleSubjectImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !currentTenant?.id) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/_system/briefvorlagen-bilder/${fileName}`;
      const { error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) {
        toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
        return;
      }
      await loadSystemImages();
      toast({ title: 'Bild hochgeladen' });
    };
    input.click();
  };

  const fetchTemplates = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letter_templates')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({ title: "Fehler", description: "Templates konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSenderInfos = async () => {
    if (!currentTenant) return;
    try {
      const { data, error } = await supabase.from('sender_information').select('id, name, organization, is_default').eq('tenant_id', currentTenant.id).eq('is_active', true).order('is_default', { ascending: false });
      if (error) throw error;
      setSenderInfos(data || []);
    } catch (error) { console.error('Error fetching sender infos:', error); }
  };

  const fetchInformationBlocks = async () => {
    if (!currentTenant) return;
    try {
      const { data, error } = await supabase.from('information_blocks').select('id, name, label, is_default').eq('tenant_id', currentTenant.id).eq('is_active', true).order('is_default', { ascending: false });
      if (error) throw error;
      setInfoBlocks(data || []);
    } catch (error) { console.error('Error fetching info blocks:', error); }
  };

  const handleCreateTemplate = async () => {
    if (!currentTenant || !user || !formData.name.trim()) return;
    try {
      const { error } = await supabase.from('letter_templates').insert({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, tenant_id: currentTenant.id, created_by: user.id,
        is_default: false, is_active: true, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: formData.header_elements.length > 0 ? 'structured' : 'html',
        header_text_elements: formData.header_elements.length > 0 ? formData.header_elements : null,
        footer_blocks: formData.footer_blocks.length > 0 ? formData.footer_blocks : null,
        layout_settings: formData.layout_settings as any
      });
      if (error) throw error;
      toast({ title: "Template erstellt", description: "Das neue Template wurde erfolgreich erstellt." });
      setShowCreateDialog(false); setCreateActiveTab('canvas-designer'); resetForm(); fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const { error } = await supabase.from('letter_templates').update({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: formData.header_elements.length > 0 ? 'structured' : 'html',
        header_text_elements: formData.header_elements.length > 0 ? formData.header_elements : null,
        footer_blocks: formData.footer_blocks.length > 0 ? formData.footer_blocks : null,
        layout_settings: formData.layout_settings as any, updated_at: new Date().toISOString()
      }).eq('id', editingTemplate.id);
      if (error) throw error;
      toast({ title: "Template aktualisiert", description: "Das Template wurde erfolgreich aktualisiert." });
      setEditingTemplate(null); resetForm(); fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht aktualisiert werden.", variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async (template: LetterTemplate) => {
    if (!confirm(`Möchten Sie das Template "${template.name}" wirklich löschen?`)) return;
    try {
      const { error } = await supabase.from('letter_templates').update({ is_active: false }).eq('id', template.id);
      if (error) throw error;
      toast({ title: "Template gelöscht", description: "Das Template wurde erfolgreich gelöscht." });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', letterhead_html: '', letterhead_css: '', response_time_days: 21, default_sender_id: '', default_info_blocks: [], header_elements: [], footer_blocks: [], layout_settings: DEFAULT_DIN5008_LAYOUT });
  };

  const startEditing = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setEditActiveTab('canvas-designer');
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') { try { headerElements = JSON.parse(template.header_text_elements); } catch { headerElements = []; } }
      else if (Array.isArray(template.header_text_elements)) { headerElements = template.header_text_elements; }
    }
    let footerBlocks: any[] = [];
    if ((template as any).footer_blocks) {
      if (typeof (template as any).footer_blocks === 'string') { try { footerBlocks = JSON.parse((template as any).footer_blocks); } catch { footerBlocks = []; } }
      else if (Array.isArray((template as any).footer_blocks)) { footerBlocks = (template as any).footer_blocks; }
    }
    setFormData({
      name: template.name, letterhead_html: template.letterhead_html, letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days, default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || [], header_elements: headerElements,
      footer_blocks: footerBlocks, layout_settings: template.layout_settings || DEFAULT_DIN5008_LAYOUT
    });
  };

  const cancelEditing = () => { setEditingTemplate(null); setEditActiveTab('canvas-designer'); resetForm(); };

  const updateLayoutSettings = (updater: (layout: LetterLayoutSettings) => LetterLayoutSettings) => {
    setFormData((prev) => ({ ...prev, layout_settings: updater(prev.layout_settings) }));
  };

  const getBlockItems = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject') => {
    const content = ((formData.layout_settings as any).blockContent || {}) as Record<string, any[]>;
    return content[blockKey] || [];
  };

  const setBlockItems = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject', items: any[]) => {
    updateLayoutSettings((layout) => {
      const current = ((layout as any).blockContent || {}) as Record<string, any[]>;
      return { ...layout, blockContent: { ...current, [blockKey]: items } } as LetterLayoutSettings;
    });
  };

  const renderBlockCanvas = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject', title: string, rect: { top: number; left: number; width: number; height: number }) => {
    const items = getBlockItems(blockKey);
    const scale = 2.4;
    const selectedId = selectedBlockItem[blockKey] || items[0]?.id || null;
    const selected = items.find((item) => item.id === selectedId) || null;

    const addText = (content = 'Neuer Text') => {
      const id = Date.now().toString();
      setBlockItems(blockKey, [...items, { id, type: 'text', x: 5, y: 5, width: 60, content, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }]);
      setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
    };

    const addImageItem = (imageUrl: string) => {
      const id = Date.now().toString();
      setBlockItems(blockKey, [...items, { id, type: 'image', x: 5, y: 5, width: 30, height: 15, imageUrl }]);
      setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
    };

    const updateItem = (id: string, updates: any) => setBlockItems(blockKey, items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    const removeItem = (id: string) => {
      setBlockItems(blockKey, items.filter((item) => item.id !== id));
      if (selectedId === id) setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: null }));
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-3 border rounded-lg p-3">
            <Button type="button" variant="outline" size="sm" onClick={() => addText()}>Text hinzufügen</Button>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className={`p-2 border rounded cursor-pointer text-sm flex items-center justify-between ${selectedId === item.id ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: item.id }))}>
                  <span className="truncate">{item.type === 'image' ? '🖼 Bild' : (item.content || 'Textblock').toString().slice(0, 35)}</span>
                  <Button variant="ghost" size="sm" className="h-5 px-1 shrink-0" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {selected && selected.type !== 'image' && (
              <>
                <Label>Textinhalt</Label>
                <Textarea value={selected.content || ''} onChange={(e) => updateItem(selected.id, { content: e.target.value })} rows={4} />
                <Label>Schriftart</Label>
                <Select value={selected.fontFamily || 'Arial'} onValueChange={(value) => updateItem(selected.id, { fontFamily: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Calibri">Calibri</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-3 gap-2">
                  <Button type="button" size="sm" variant={selected.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })}>Fett</Button>
                  <Button type="button" size="sm" variant={selected.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}>Kursiv</Button>
                  <Button type="button" size="sm" variant={selected.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { textDecoration: selected.textDecoration === 'underline' ? 'none' : 'underline' })}>Unterstr.</Button>
                </div>
              </>
            )}
            {selected && selected.type === 'image' && (
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Breite</Label><Input type="number" value={selected.width || 30} onChange={(e) => updateItem(selected.id, { width: parseFloat(e.target.value) || 30 })} /></div>
                <div><Label className="text-xs">Höhe</Label><Input type="number" value={selected.height || 15} onChange={(e) => updateItem(selected.id, { height: parseFloat(e.target.value) || 15 })} /></div>
              </div>
            )}
          </div>
          <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
            <div
              className="relative bg-white border"
              style={{ width: rect.width * scale, height: Math.max(rect.height, 25) * scale }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const variable = e.dataTransfer.getData('text/plain');
                const imageUrl = e.dataTransfer.getData('application/x-subject-image');
                if (imageUrl) {
                  addImageItem(imageUrl);
                } else if (variable && variable.startsWith('{{')) {
                  addText(variable);
                }
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={() => setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: item.id }))}
                  className={`absolute border px-2 py-1 text-xs ${selectedId === item.id ? 'border-primary bg-primary/15' : 'border-primary/50 bg-primary/10'}`}
                  style={{ left: (item.x || 0) * scale, top: (item.y || 0) * scale, width: (item.width || 50) * scale, fontFamily: item.fontFamily || 'Arial', fontWeight: item.fontWeight || 'normal', fontStyle: item.fontStyle || 'normal', textDecoration: item.textDecoration || 'none' }}
                >
                  {item.type === 'image' && item.imageUrl ? (
                    <img src={item.imageUrl} alt="Bild" className="w-full h-full object-contain" style={{ height: (item.height || 15) * scale }} />
                  ) : (
                    item.content || 'Text'
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview = (template: LetterTemplate) => {
    let previewHtml = '';
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') { try { headerElements = JSON.parse(template.header_text_elements); } catch { headerElements = []; } }
      else if (Array.isArray(template.header_text_elements)) { headerElements = template.header_text_elements; }
    }
    if (template.header_layout_type === 'structured' && headerElements.length > 0) {
      const structuredElements = headerElements.map((element: any) => {
        if (element.type === 'text') {
          return `<div style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${(element.width / 595) * 100}%; font-size: ${element.fontSize || 16}px; font-family: ${element.fontFamily || 'Arial'}, sans-serif; font-weight: ${element.fontWeight || 'normal'}; color: ${element.color || '#000000'}; line-height: 1.2;">${element.content || ''}</div>`;
        } else if (element.type === 'image' && element.imageUrl) {
          return `<img src="${element.imageUrl}" style="position: absolute; left: ${(element.x / 595) * 100}%; top: ${(element.y / 200) * 100}%; width: ${(element.width / 595) * 100}%; height: ${(element.height / 200) * 100}%; object-fit: contain;" alt="Header Image" />`;
        }
        return '';
      }).join('');
      previewHtml = `<div style="position: relative; width: 100%; height: 200px; background: white; border: 1px solid #e0e0e0; margin-bottom: 20px;">${structuredElements}</div><div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc;"><p><em>Hier würde der Briefinhalt stehen...</em></p></div>`;
    } else if (template.letterhead_html) {
      previewHtml = `<style>${template.letterhead_css || ''}</style>${template.letterhead_html}<div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc;"><p><em>Hier würde der Briefinhalt stehen...</em></p></div>`;
    } else {
      previewHtml = `<div style="padding: 20px; text-align: center; color: #666;"><p>Kein Header definiert</p></div>`;
    }
    return (
      <Dialog open={showPreview === template.id} onOpenChange={(open) => !open && setShowPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vorschau: {template.name}</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </DialogContent>
      </Dialog>
    );
  };

  const renderTabsList = () => (
    <TabsList className="grid w-full grid-cols-10">
      <TabsTrigger value="canvas-designer">Canvas</TabsTrigger>
      <TabsTrigger value="header-designer">Header</TabsTrigger>
      <TabsTrigger value="footer-designer">Footer</TabsTrigger>
      <TabsTrigger value="layout-settings">Layout</TabsTrigger>
      <TabsTrigger value="general">Allgemein</TabsTrigger>
      <TabsTrigger value="block-address">Adressfeld</TabsTrigger>
      <TabsTrigger value="block-return-address">Rücksende</TabsTrigger>
      <TabsTrigger value="block-info">Info-Block</TabsTrigger>
      <TabsTrigger value="block-subject">Betreff</TabsTrigger>
      <TabsTrigger value="block-attachments">Anlagen</TabsTrigger>
    </TabsList>
  );

  const renderSubjectTab = () => (
    <TabsContent value="block-subject" className="space-y-4">
      {renderBlockCanvas('subject', 'Betreffbereich', {
        top: formData.layout_settings.subject.top,
        left: formData.layout_settings.margins.left,
        width: formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
        height: Math.max(8, formData.layout_settings.subject.marginBottom + 4),
      })}
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Variablen-Platzhalter</h3>
        <p className="text-sm text-muted-foreground mb-3">Ziehen Sie Platzhalter per Drag-and-Drop auf den Canvas oben.</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Betreff', variable: '{{betreff}}' },
            { label: 'Datum', variable: '{{datum}}' },
            { label: 'Empfänger', variable: '{{empfaenger_name}}' },
            { label: 'Absender', variable: '{{absender_name}}' },
          ].map((v) => (
            <div
              key={v.variable}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', v.variable); e.dataTransfer.effectAllowed = 'copy'; }}
              className="px-3 py-1.5 rounded-full border bg-muted text-sm cursor-grab active:cursor-grabbing select-none"
            >
              {v.label} <span className="text-muted-foreground text-xs ml-1">{v.variable}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Bilder</h3>
        <p className="text-sm text-muted-foreground mb-3">Ziehen Sie Bilder auf den Canvas oder laden Sie neue hoch.</p>
        <Button variant="outline" size="sm" onClick={handleSubjectImageUpload} className="mb-3">
          <Upload className="h-4 w-4 mr-2" /> Bild hochladen
        </Button>
        {systemImages.length > 0 && (
          <div className="grid grid-cols-6 gap-2">
            {systemImages.map((img) => (
              <div
                key={img.name}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/x-subject-image', img.url); e.dataTransfer.effectAllowed = 'copy'; }}
                className="border rounded overflow-hidden cursor-grab active:cursor-grabbing aspect-square bg-muted/30"
                title={img.name}
              >
                <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
        )}
      </div>
    </TabsContent>
  );

  const renderCommonTabsContent = (tabSetter: (tab: string) => void) => (
    <>
      <TabsContent value="canvas-designer" className="space-y-4">
        <LetterLayoutCanvasDesigner
          layoutSettings={formData.layout_settings}
          onLayoutChange={(settings) => setFormData(prev => ({ ...prev, layout_settings: settings }))}
          onJumpToTab={tabSetter as any}
          headerElements={formData.header_elements}
        />
      </TabsContent>

      <TabsContent value="header-designer" className="space-y-4">
        <StructuredHeaderEditor
          initialElements={formData.header_elements}
          onElementsChange={(elements) => setFormData(prev => ({ ...prev, header_elements: elements }))}
        />
      </TabsContent>

      <TabsContent value="footer-designer" className="space-y-4">
        <StructuredFooterEditor
          initialBlocks={formData.footer_blocks}
          onBlocksChange={(blocks) => setFormData(prev => ({ ...prev, footer_blocks: blocks }))}
        />
      </TabsContent>

      <TabsContent value="layout-settings" className="space-y-4">
        <LayoutSettingsEditor
          layoutSettings={formData.layout_settings}
          onLayoutChange={(settings) => setFormData(prev => ({ ...prev, layout_settings: settings }))}
          letterheadHtml={formData.letterhead_html}
          letterheadCss={formData.letterhead_css}
          onLetterheadHtmlChange={(v) => setFormData(prev => ({ ...prev, letterhead_html: v }))}
          onLetterheadCssChange={(v) => setFormData(prev => ({ ...prev, letterhead_css: v }))}
        />
      </TabsContent>

      <TabsContent value="general" className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Template-Name eingeben..." />
        </div>
        <div>
          <Label>Antwortzeit (Tage)</Label>
          <Input type="number" value={formData.response_time_days} onChange={(e) => setFormData(prev => ({ ...prev, response_time_days: parseInt(e.target.value) || 21 }))} min="1" max="365" />
        </div>
        <div>
          <Label>Standard-Absenderinformation</Label>
          <Select value={formData.default_sender_id || "none"} onValueChange={(value) => setFormData(prev => ({ ...prev, default_sender_id: value === "none" ? "" : value }))}>
            <SelectTrigger><SelectValue placeholder="Absenderinformation auswählen..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Auswahl</SelectItem>
              {senderInfos.map((sender) => (
                <SelectItem key={sender.id} value={sender.id}>{sender.name} - {sender.organization}{sender.is_default && " (Standard)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Standard-Informationsblöcke</Label>
          <div className="space-y-2">
            {infoBlocks.map((block) => (
              <div key={block.id} className="flex items-center space-x-2">
                <Checkbox id={`block-${block.id}`} checked={formData.default_info_blocks.includes(block.id)} onCheckedChange={(checked) => {
                  if (checked) { setFormData(prev => ({ ...prev, default_info_blocks: [...prev.default_info_blocks, block.id] })); }
                  else { setFormData(prev => ({ ...prev, default_info_blocks: prev.default_info_blocks.filter(id => id !== block.id) })); }
                }} />
                <Label htmlFor={`block-${block.id}`} className="text-sm">{block.label} {block.is_default && "(Standard)"}</Label>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="block-address" className="space-y-4">
        {renderBlockCanvas('addressField', 'Adressfeld', {
          top: formData.layout_settings.addressField.top, left: formData.layout_settings.addressField.left,
          width: formData.layout_settings.addressField.width, height: formData.layout_settings.addressField.height,
        })}
      </TabsContent>

      <TabsContent value="block-return-address" className="space-y-4">
        {renderBlockCanvas('returnAddress', 'Rücksendeangaben', {
          top: formData.layout_settings.returnAddress.top, left: formData.layout_settings.returnAddress.left,
          width: formData.layout_settings.returnAddress.width, height: formData.layout_settings.returnAddress.height,
        })}
        <div className="border-t pt-4"><SenderInformationManager /></div>
      </TabsContent>

      <TabsContent value="block-info" className="space-y-4">
        {renderBlockCanvas('infoBlock', 'Info-Block', {
          top: formData.layout_settings.infoBlock.top, left: formData.layout_settings.infoBlock.left,
          width: formData.layout_settings.infoBlock.width, height: formData.layout_settings.infoBlock.height,
        })}
        <div className="border-t pt-4"><InformationBlockManager /></div>
      </TabsContent>

      {renderSubjectTab()}

      <TabsContent value="block-attachments" className="space-y-4">
        <h3 className="text-lg font-semibold">Anlagenbereich</h3>
        <div><Label>Top (mm)</Label><Input type="number" value={formData.layout_settings.attachments.top} onChange={(e) => updateLayoutSettings((l) => ({ ...l, attachments: { ...l.attachments, top: parseFloat(e.target.value) || 0 } }))} /></div>
      </TabsContent>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">Briefvorlagen</h2></div>
        {!showCreateDialog && !editingTemplate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Template
          </Button>
        )}
      </div>

      {showCreateDialog && (
        <Card>
          <CardHeader><CardTitle>Neues Brief-Template erstellen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={createActiveTab} onValueChange={setCreateActiveTab} className="w-full">
              {renderTabsList()}
              {renderCommonTabsContent(setCreateActiveTab)}
            </Tabs>
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setCreateActiveTab('canvas-designer'); resetForm(); }}>Abbrechen</Button>
              <Button onClick={handleCreateTemplate}>Template erstellen</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!showCreateDialog && !editingTemplate && (loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Templates werden geladen...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              {renderPreview(template)}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowPreview(template.id)} title="Vorschau"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => startEditing(template)} title="Template bearbeiten"><Edit3 className="h-4 w-4" /></Button>
                    {!template.is_default && (<Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template)}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">{template.response_time_days} Tage</Badge>
                  {template.is_default && (<Badge variant="default" className="text-xs">Standard</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {/* Edit Dialog */}
      {editingTemplate && (
        <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && cancelEditing()}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Template bearbeiten: {editingTemplate.name}</DialogTitle></DialogHeader>
            <Tabs value={editActiveTab} onValueChange={setEditActiveTab} className="w-full">
              {renderTabsList()}
              {renderCommonTabsContent(setEditActiveTab)}
            </Tabs>
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
              <Button onClick={handleUpdateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {templates.length === 0 && !loading && !showCreateDialog && !editingTemplate && (
        <div className="text-center py-8 text-muted-foreground">
          <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine Templates vorhanden.</p>
          <p className="text-sm">Erstellen Sie Ihr erstes Template.</p>
        </div>
      )}
    </div>
  );
};

export default LetterTemplateManager;
