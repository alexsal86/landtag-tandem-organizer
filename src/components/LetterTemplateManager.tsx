import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Edit3, Trash2, Plus, Save, X, Eye } from 'lucide-react';
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
import { CanvasToolbar } from '@/components/letters/CanvasToolbar';
import { LetterLayoutCanvasDesigner } from '@/components/letters/LetterLayoutCanvasDesigner';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';
import { SenderInformationManager } from '@/components/administration/SenderInformationManager';
import { BlockLineEditor, type BlockLine, type BlockLineData, isLineMode } from '@/components/letters/BlockLineEditor';


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

type MarginKey = 'top' | 'right' | 'bottom' | 'left';

type TabRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}


const STORAGE_PATH_PREFIXES = [
  '/storage/v1/object/public/letter-assets/',
  '/storage/v1/object/sign/letter-assets/',
  '/storage/v1/object/authenticated/letter-assets/',
];

const extractStoragePathFromUrl = (value?: string | null): string | null => {
  if (!value) return null;

  // Already a relative storage path
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }

  try {
    const parsed = new URL(value);
    const matchedPrefix = STORAGE_PATH_PREFIXES.find((prefix) => parsed.pathname.includes(prefix));
    if (!matchedPrefix) return null;
    const [, rawPath = ''] = parsed.pathname.split(matchedPrefix);
    if (!rawPath) return null;
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
};

const normalizeImageItem = (item: any): any => {
  if (!item || item.type !== 'image') return item;

  const storagePath = item.storagePath || extractStoragePathFromUrl(item.imageUrl);
  if (!storagePath) return item;

  const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
  return {
    ...item,
    storagePath,
    imageUrl: publicUrl,
  };
};

const normalizeLayoutBlockContentImages = (layoutSettings: LetterLayoutSettings) => {
  const blockContent = ((layoutSettings as any).blockContent || {}) as Record<string, any[]>;
  const normalizedContent = Object.fromEntries(
    Object.entries(blockContent).map(([key, items]) => {
      if (!Array.isArray(items)) return [key, items];
      return [key, items.map(normalizeImageItem)];
    })
  );

  // Also normalize header_text_elements and footer_blocks if present in layout_settings
  return {
    ...layoutSettings,
    footer: {
      ...layoutSettings.footer,
      height: layoutSettings.footer?.height ?? DEFAULT_DIN5008_LAYOUT.footer.height,
    },
    blockContent: normalizedContent,
  } as LetterLayoutSettings;
};

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
  const [activeTab, setActiveTab] = useState('canvas-designer');
  const [selectedBlockItem, setSelectedBlockItem] = useState<Record<string, string | null>>({});
  const [showBlockRuler, setShowBlockRuler] = useState<Record<string, boolean>>({});
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<Record<string, GalleryImage | null>>({});
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const galleryBlobUrlsRef = useRef<Map<string, string>>(new Map());
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
    }
  }, [currentTenant]);

  const getMarginsForRect = useCallback((rect: TabRect): MarginKey[] => {
    const { pageWidth, pageHeight, margins } = formData.layout_settings;
    const leftEdge = rect.x;
    const rightEdge = rect.x + rect.width;
    const topEdge = rect.y;
    const bottomEdge = rect.y + rect.height;

    return [
      ...(leftEdge < margins.left ? (['left'] as MarginKey[]) : []),
      ...(rightEdge > pageWidth - margins.right ? (['right'] as MarginKey[]) : []),
      ...(topEdge < margins.top ? (['top'] as MarginKey[]) : []),
      ...(bottomEdge > pageHeight - margins.bottom ? (['bottom'] as MarginKey[]) : []),
    ];
  }, [formData.layout_settings]);

  const tabMarginMap: Record<string, MarginKey[]> = {
    'canvas-designer': ['left', 'right', 'top', 'bottom'],
    'header-designer': getMarginsForRect({
      x: 0,
      y: 0,
      width: formData.layout_settings.pageWidth,
      height: formData.layout_settings.header.height,
    }),
    'footer-designer': getMarginsForRect({
      x: 0,
      y: formData.layout_settings.footer.top,
      width: formData.layout_settings.pageWidth,
      height: formData.layout_settings.footer.height,
    }),
    'block-address': getMarginsForRect({ x: formData.layout_settings.addressField.left, y: formData.layout_settings.addressField.top, width: formData.layout_settings.addressField.width, height: formData.layout_settings.addressField.height }),
    'block-return-address': getMarginsForRect({ x: formData.layout_settings.returnAddress.left, y: formData.layout_settings.returnAddress.top, width: formData.layout_settings.returnAddress.width, height: formData.layout_settings.returnAddress.height }),
    'block-info': getMarginsForRect({ x: formData.layout_settings.infoBlock.left, y: formData.layout_settings.infoBlock.top, width: formData.layout_settings.infoBlock.width, height: formData.layout_settings.infoBlock.height }),
    'block-subject': getMarginsForRect({
      x: 0,
      y: formData.layout_settings.subject.top,
      width: formData.layout_settings.pageWidth,
      height: formData.layout_settings.subject.marginBottom,
    }),
    'block-attachments': getMarginsForRect({
      x: 0,
      y: formData.layout_settings.attachments.top,
      width: formData.layout_settings.pageWidth,
      height: Math.max(0, formData.layout_settings.pageHeight - formData.layout_settings.attachments.top),
    }),
    'layout-settings': ['left', 'right', 'top', 'bottom'],
    'general': [],
  };

  const marginLabelMap: Record<MarginKey, string> = {
    top: 'O',
    right: 'R',
    bottom: 'U',
    left: 'L',
  };

  const renderTabTrigger = (value: string, label: string) => {
    const margins = tabMarginMap[value] || [];

    return (
      <TabsTrigger className="shrink-0" value={value}>
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          {margins.length > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border px-1 py-0.5 text-[10px] leading-none text-muted-foreground" title={`Betroffene Seitenränder: ${margins.join(', ')}`}>
              {margins.map((margin) => marginLabelMap[margin]).join('·')}
            </span>
          )}
        </span>
      </TabsTrigger>
    );
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

  // Strip blobUrl from elements before persisting - blobUrls are runtime-only
  const stripBlobUrls = (elements: any[]): any[] =>
    elements.map(({ blobUrl, ...rest }) => rest);

  const stripBlobUrlsFromLayoutSettings = (settings: any): any => {
    if (!settings || typeof settings !== 'object') return settings;
    const cleaned = { ...settings };
    if (cleaned.blockContent && typeof cleaned.blockContent === 'object') {
      const cleanedBlocks: any = {};
      for (const [key, items] of Object.entries(cleaned.blockContent)) {
        if (key === 'header') continue;
        if (Array.isArray(items)) {
          cleanedBlocks[key] = stripBlobUrls(items);
        } else {
          cleanedBlocks[key] = items;
        }
      }
      cleaned.blockContent = cleanedBlocks;
    }
    return cleaned;
  };

  const handleCreateTemplate = async () => {
    if (!currentTenant || !user || !formData.name.trim()) return;
    const cleanedHeaderElements = stripBlobUrls(formData.header_elements);
    const cleanedFooterBlocks = stripBlobUrls(formData.footer_blocks);
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(formData.layout_settings);
    try {
      const { error } = await supabase.from('letter_templates').insert({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, tenant_id: currentTenant.id, created_by: user.id,
        is_default: false, is_active: true, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null,
        layout_settings: cleanedLayoutSettings as any
      });
      if (error) throw error;
      toast({ title: "Template erstellt" });
      setShowCreateDialog(false);
      setActiveTab('canvas-designer');
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({ title: "Fehler", description: "Template konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const cleanedHeaderElements = stripBlobUrls(formData.header_elements);
    const cleanedFooterBlocks = stripBlobUrls(formData.footer_blocks);
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(formData.layout_settings);
    try {
      const { error } = await supabase.from('letter_templates').update({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null,
        layout_settings: cleanedLayoutSettings as any, updated_at: new Date().toISOString()
      }).eq('id', editingTemplate.id);
      if (error) throw error;
      toast({ title: "Template aktualisiert" });
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
      toast({ title: "Template gelöscht" });
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
    setActiveTab('canvas-designer');
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
    const normalizedLayoutSettings = normalizeLayoutBlockContentImages(template.layout_settings || DEFAULT_DIN5008_LAYOUT);
    const legacyHeaderElements = (((normalizedLayoutSettings as any).blockContent || {}).header || []) as any[];

    // Migrate legacy header elements that were stored in layout_settings.blockContent.header
    const headerSource = headerElements.length > 0
      ? headerElements
      : (Array.isArray(legacyHeaderElements) ? legacyHeaderElements : []);

    // Normalize images in header/footer elements too
    const normalizedHeader = headerSource.map(normalizeImageItem);
    const normalizedFooter = footerBlocks.map(normalizeImageItem);
    const cleanedBlockContent = { ...(((normalizedLayoutSettings as any).blockContent || {}) as Record<string, any[]>) };
    delete cleanedBlockContent.header;
    
    setFormData({
      name: template.name, letterhead_html: template.letterhead_html, letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days, default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || [], header_elements: normalizedHeader,
      footer_blocks: normalizedFooter,
      layout_settings: {
        ...normalizedLayoutSettings,
        blockContent: cleanedBlockContent,
      }
    });
  };

  const cancelEditing = () => { setEditingTemplate(null); setActiveTab('canvas-designer'); resetForm(); };

  const updateLayoutSettings = (updater: (layout: LetterLayoutSettings) => LetterLayoutSettings) => {
    setFormData((prev) => ({ ...prev, layout_settings: updater(prev.layout_settings) }));
  };

  type BlockEditorKey = 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'attachments' | 'footer';

  const getBlockItems = (blockKey: BlockEditorKey) => {
    const content = ((formData.layout_settings as any).blockContent || {}) as Record<string, any[]>;
    return content[blockKey] || [];
  };

  const setBlockItems = (blockKey: BlockEditorKey, items: any[]) => {
    updateLayoutSettings((layout) => {
      const current = ((layout as any).blockContent || {}) as Record<string, any[]>;
      return { ...layout, blockContent: { ...current, [blockKey]: items } } as LetterLayoutSettings;
    });
  };

  const renderSharedElementsEditor = (blockKey: BlockEditorKey, canvasWidthMm: number, canvasHeightMm: number) => (
    <StructuredHeaderEditor
      initialElements={getBlockItems(blockKey) as any}
      onElementsChange={(elements) => setBlockItems(blockKey, elements as any[])}
      layoutSettings={formData.layout_settings}
      canvasWidthMm={canvasWidthMm}
      canvasHeightMm={Math.max(8, canvasHeightMm)}
      blockKey={blockKey}
    />
  );

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

  // Consolidated tab list - used by both create and edit
  // Order: Canvas, Header, Footer, Adressfeld, Rücksende, Info-Block, Betreff, Anlagen, Layout, Allgemein
  const renderTabsList = () => (
    <TabsList className="flex w-full justify-start gap-1 overflow-x-auto whitespace-nowrap">
      {renderTabTrigger('canvas-designer', 'Canvas')}
      {renderTabTrigger('header-designer', 'Header')}
      {renderTabTrigger('footer-designer', 'Footer')}
      {renderTabTrigger('block-address', 'Adressfeld')}
      {renderTabTrigger('block-return-address', 'Rücksende')}
      {renderTabTrigger('block-info', 'Info-Block')}
      {renderTabTrigger('block-subject', 'Betreff')}
      {renderTabTrigger('block-attachments', 'Anlagen')}
      {renderTabTrigger('layout-settings', 'Layout')}
      {renderTabTrigger('general', 'Allgemein')}
    </TabsList>
  );

  // Consolidated tab content - used by both create and edit
  const renderCommonTabsContent = () => (
    <>
      <TabsContent value="canvas-designer" className="space-y-4">
        <LetterLayoutCanvasDesigner
          layoutSettings={formData.layout_settings}
          onLayoutChange={(settings) => setFormData(prev => ({ ...prev, layout_settings: settings }))}
          onJumpToTab={setActiveTab as any}
          headerElements={formData.header_elements}
          actionButtons={editingTemplate ? undefined : (
            <>
              <Button onClick={handleCreateTemplate}>
                <Save className="h-4 w-4 mr-2" />Speichern
              </Button>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>
                <X className="h-4 w-4 mr-2" />Abbrechen
              </Button>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="header-designer" className="space-y-4 min-w-0">
        <StructuredHeaderEditor
          initialElements={formData.header_elements}
          onElementsChange={(elements) => setFormData(prev => ({ ...prev, header_elements: elements }))}
          layoutSettings={formData.layout_settings}
          actionButtons={editingTemplate ? undefined : (
            <div className="flex flex-col gap-2">
              <Button onClick={handleCreateTemplate}>
                <Save className="h-4 w-4 mr-2" />Speichern
              </Button>
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>
                <X className="h-4 w-4 mr-2" />Abbrechen
              </Button>
            </div>
          )}
        />
      </TabsContent>

      <TabsContent value="footer-designer" className="space-y-4">
        {renderSharedElementsEditor('footer',
          formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          formData.layout_settings.footer.height
        )}
        <StructuredFooterEditor
          initialBlocks={formData.footer_blocks}
          onBlocksChange={(blocks) => setFormData(prev => ({ ...prev, footer_blocks: blocks }))}
          footerHeight={formData.layout_settings.footer.height}
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
        {/* Erweiterte HTML/CSS Bearbeitung - integriert */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-lg font-semibold">Erweiterte HTML/CSS Bearbeitung</h3>
          <p className="text-sm text-muted-foreground">Für erfahrene Benutzer: Bearbeiten Sie den Briefkopf direkt mit HTML und CSS.</p>
          <div>
            <Label>Briefkopf HTML</Label>
            <Textarea value={formData.letterhead_html} onChange={(e) => setFormData(prev => ({ ...prev, letterhead_html: e.target.value }))} placeholder="HTML für den Briefkopf..." rows={8} />
          </div>
          <div>
            <Label>Briefkopf CSS</Label>
            <Textarea value={formData.letterhead_css} onChange={(e) => setFormData(prev => ({ ...prev, letterhead_css: e.target.value }))} placeholder="CSS-Stile für den Briefkopf..." rows={8} />
          </div>
        </div>
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
          <div className="space-y-2 max-h-40 overflow-y-auto">
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

      <TabsContent value="block-address">
        <BlockLineEditor
          blockType="addressField"
          lines={(() => {
            const raw = getBlockItems('addressField');
            if (raw && typeof raw === 'object' && (raw as any).mode === 'lines') return (raw as any).lines || [];
            return Array.isArray(raw) && raw.length > 0 && raw[0]?.type === 'label-value' || raw[0]?.type === 'spacer' || raw[0]?.type === 'text-only' ? raw as BlockLine[] : [];
          })()}
          onChange={(newLines) => setBlockItems('addressField', { mode: 'lines', lines: newLines } as any)}
        />
      </TabsContent>

      <TabsContent value="block-return-address" className="space-y-4">
        {renderSharedElementsEditor('returnAddress', formData.layout_settings.returnAddress.width, formData.layout_settings.returnAddress.height)}
        <div className="border-t pt-4"><SenderInformationManager /></div>
      </TabsContent>

      <TabsContent value="block-info">
        <BlockLineEditor
          blockType="infoBlock"
          lines={(() => {
            const raw = getBlockItems('infoBlock');
            if (raw && typeof raw === 'object' && (raw as any).mode === 'lines') return (raw as any).lines || [];
            return Array.isArray(raw) && raw.length > 0 && (raw[0]?.type === 'label-value' || raw[0]?.type === 'spacer' || raw[0]?.type === 'text-only') ? raw as BlockLine[] : [];
          })()}
          onChange={(newLines) => setBlockItems('infoBlock', { mode: 'lines', lines: newLines } as any)}
        />
      </TabsContent>

      <TabsContent value="block-subject" className="space-y-4">
        {renderSharedElementsEditor('subject',
          formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          Math.max(8, formData.layout_settings.subject.marginBottom + 4)
        )}
      </TabsContent>

      <TabsContent value="block-attachments" className="space-y-4">
        {renderSharedElementsEditor('attachments',
          formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          20
        )}
      </TabsContent>

    </>
  );

  const isFormOpen = showCreateDialog || !!editingTemplate;

  return (
    <div className="space-y-6">
      {!editingTemplate && (
        <div className="flex justify-end">
          <Button onClick={() => { if (showCreateDialog) { setShowCreateDialog(false); resetForm(); } else { setShowCreateDialog(true); resetForm(); setActiveTab('canvas-designer'); } }}>
            <Plus className="h-4 w-4 mr-2" />
            {showCreateDialog ? 'Erstellung schließen' : 'Neues Template'}
          </Button>
        </div>
      )}

      {/* Create Template - inline card */}
      {showCreateDialog && !editingTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Neues Brief-Template erstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {renderTabsList()}
              {renderCommonTabsContent()}
            </Tabs>
            {activeTab !== 'canvas-designer' && activeTab !== 'header-designer' && (
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>Abbrechen</Button>
                <Button onClick={handleCreateTemplate}>Template erstellen</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template list */}
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

      {/* Edit Template - inline card (same as create) */}
      {editingTemplate && !showCreateDialog && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Template bearbeiten: {editingTemplate.name}</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
              <Button onClick={handleUpdateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {renderTabsList()}
            {renderCommonTabsContent()}
          </Tabs>
        </div>
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
