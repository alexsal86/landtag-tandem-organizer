import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Edit3, Trash2, Plus, Save, X, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { StructuredHeaderEditor } from '@/components/letters/StructuredHeaderEditor';
import { LayoutSettingsEditor } from '@/components/letters/LayoutSettingsEditor';
import { CanvasToolbar } from '@/components/letters/CanvasToolbar';
import { LetterLayoutCanvasDesigner } from '@/components/letters/LetterLayoutCanvasDesigner';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';
import { SenderInformationManager } from '@/components/administration/SenderInformationManager';
import { BlockLineEditor, type BlockLine, type BlockLineData, isLineMode } from '@/components/letters/BlockLineEditor';
import { LetterTemplateSettings } from '@/components/letters/LetterTemplateSettings';
import { parseFooterLinesForEditor, toFooterLineData } from '@/components/letters/footerBlockUtils';

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
  const enforceDIN5008Metrics = (settings: LetterLayoutSettings): LetterLayoutSettings => ({
    ...settings,
    footer: {
      ...settings.footer,
      top: 272,
      height: settings.footer?.height ?? DEFAULT_DIN5008_LAYOUT.footer.height,
    },
    subject: {
      ...settings.subject,
      top: 98.46,
    },
    content: {
      ...settings.content,
      top: 98.46,
      maxHeight: 165,
    },
    pagination: {
      enabled: settings.pagination?.enabled ?? true,
      top: 263.77,
      align: settings.pagination?.align || 'right',
      fontSize: settings.pagination?.fontSize ?? 8,
    },
    foldHoleMarks: {
      enabled: settings.foldHoleMarks?.enabled ?? true,
      left: settings.foldHoleMarks?.left ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.left ?? 3,
      strokeWidthPt: settings.foldHoleMarks?.strokeWidthPt ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.strokeWidthPt ?? 1,
      foldMarkWidth: settings.foldHoleMarks?.foldMarkWidth ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.foldMarkWidth ?? 5,
      holeMarkWidth: settings.foldHoleMarks?.holeMarkWidth ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.holeMarkWidth ?? 8,
      topMarkY: settings.foldHoleMarks?.topMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.topMarkY ?? 105,
      holeMarkY: settings.foldHoleMarks?.holeMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.holeMarkY ?? 148.5,
      bottomMarkY: settings.foldHoleMarks?.bottomMarkY ?? DEFAULT_DIN5008_LAYOUT.foldHoleMarks?.bottomMarkY ?? 210,
    },
  });

  const blockContent = ((layoutSettings as any).blockContent || {}) as Record<string, any[]>;
  const normalizedContent = Object.fromEntries(
    Object.entries(blockContent).map(([key, items]) => {
      if (!Array.isArray(items)) return [key, items];
      return [key, items.map(normalizeImageItem)];
    })
  );

  // Also normalize header_text_elements and footer_blocks if present in layout_settings
  const normalizedLayout = enforceDIN5008Metrics(layoutSettings);

  return {
    ...normalizedLayout,
    blockContent: normalizedContent,
  } as LetterLayoutSettings;
};


const DEFAULT_ATTACHMENT_PREVIEW_LINES = ['- Antrag_2026-02-15.pdf', '- Stellungnahme_Verkehrsausschuss.docx', '- Anlagenverzeichnis.xlsx'];
const createDefaultAttachmentElements = () => ([{
  id: `attachments-default-${Date.now()}`,
  type: 'text',
  x: 0,
  y: 0,
  content: '{{anlagen_liste}}',
  isVariable: true,
  variablePreviewText: DEFAULT_ATTACHMENT_PREVIEW_LINES.join('\n'),
  fontSize: 10,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  color: '#000000',
  textLineHeight: 1.2,
}] as any[]);

const LetterTemplateManager: React.FC = () => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
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
  const [showSettings, setShowSettings] = useState(false);
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

  const renderTabTrigger = (value: string, label: string, mobileLabel?: string) => {
    const margins = tabMarginMap[value] || [];

    return (
      <TabsTrigger className="shrink-0" value={value}>
        <span className="inline-flex items-center gap-1">
          <span>{isMobile && mobileLabel ? mobileLabel : label}</span>
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
  const stripBlobUrls = (elements: any): any => {
    if (Array.isArray(elements)) {
      return elements.map(({ blobUrl, ...rest }) => rest);
    }

    // Handle { mode: 'lines', lines: [...] } format
    if (elements && typeof elements === 'object' && (elements as any).mode === 'lines' && Array.isArray((elements as any).lines)) {
      return {
        ...elements,
        lines: (elements as any).lines.map(({ blobUrl, ...rest }: any) => rest),
      };
    }

    if (elements && typeof elements === 'object' && Array.isArray((elements as any).blocks)) {
      return {
        ...elements,
        blocks: (elements as any).blocks.map((block: any) => ({
          ...block,
          lines: Array.isArray(block?.lines) ? block.lines.map(({ blobUrl, ...rest }: any) => rest) : [],
        })),
      };
    }

    return elements;
  };

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
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(normalizeLayoutBlockContentImages(formData.layout_settings));
    try {
      const { error } = await supabase.from('letter_templates').insert({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, tenant_id: currentTenant.id, created_by: user.id,
        is_default: false, is_active: true, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: Array.isArray(cleanedFooterBlocks)
          ? (cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null)
          : cleanedFooterBlocks,
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
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(normalizeLayoutBlockContentImages(formData.layout_settings));
    try {
      const { error } = await supabase.from('letter_templates').update({
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: Array.isArray(cleanedFooterBlocks)
          ? (cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null)
          : cleanedFooterBlocks,
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
    setFormData({
      name: '',
      letterhead_html: '',
      letterhead_css: '',
      response_time_days: 21,
      default_sender_id: '',
      default_info_blocks: [],
      header_elements: [],
      footer_blocks: [],
      layout_settings: {
        ...DEFAULT_DIN5008_LAYOUT,
        blockContent: {
          ...((DEFAULT_DIN5008_LAYOUT as any).blockContent || {}),
          attachments: createDefaultAttachmentElements(),
        },
      } as any,
    });
  };

  const startEditing = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setActiveTab('canvas-designer');
    let headerElements: any[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') { try { headerElements = JSON.parse(template.header_text_elements); } catch { headerElements = []; } }
      else if (Array.isArray(template.header_text_elements)) { headerElements = template.header_text_elements; }
    }
    let rawFooterBlocks: any = [];
    if ((template as any).footer_blocks) {
      if (typeof (template as any).footer_blocks === 'string') { try { rawFooterBlocks = JSON.parse((template as any).footer_blocks); } catch { rawFooterBlocks = []; } }
      else { rawFooterBlocks = (template as any).footer_blocks; }
    }
    const footerLines = parseFooterLinesForEditor(rawFooterBlocks);
    const normalizedLayoutSettings = normalizeLayoutBlockContentImages(template.layout_settings || DEFAULT_DIN5008_LAYOUT);
    const legacyHeaderElements = (((normalizedLayoutSettings as any).blockContent || {}).header || []) as any[];

    // Migrate legacy header elements that were stored in layout_settings.blockContent.header
    const headerSource = headerElements.length > 0
      ? headerElements
      : (Array.isArray(legacyHeaderElements) ? legacyHeaderElements : []);

    // Normalize images in header/footer elements too
    const normalizedHeader = headerSource.map(normalizeImageItem);
    const normalizedFooter = footerLines.map(normalizeImageItem);
    const cleanedBlockContent = { ...(((normalizedLayoutSettings as any).blockContent || {}) as Record<string, any[]>) };
    delete cleanedBlockContent.header;
    if (!Array.isArray(cleanedBlockContent.attachments) || cleanedBlockContent.attachments.length === 0) {
      cleanedBlockContent.attachments = createDefaultAttachmentElements();
    }

    const footerData = toFooterLineData(normalizedFooter);
    setFormData({
      name: template.name, letterhead_html: template.letterhead_html, letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days, default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || [], header_elements: normalizedHeader,
      footer_blocks: footerData as any,
      layout_settings: {
        ...normalizedLayoutSettings,
        blockContent: { ...cleanedBlockContent, footer: footerData } as any,
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

  const previewAttachments = DEFAULT_ATTACHMENT_PREVIEW_LINES.map((line) => line.replace(/^-\s*/, ''));
  const previewContent = `<div style="margin-top: 20px; padding: 20px; border: 1px dashed #ccc; font-size: 11pt; line-height: 1.4;"><p><em>Hier würde der Briefinhalt stehen...</em></p><div style="height: 13.5mm;"></div><div style="font-weight: 700;">Anlagen</div>${previewAttachments.map((name) => `<div style=\"font-weight: 700; margin-top: 1mm;\">- ${name}</div>`).join('')}</div>`;

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
      previewHtml = `<div style="position: relative; width: 100%; height: 200px; background: white; border: 1px solid #e0e0e0; margin-bottom: 20px;">${structuredElements}</div>${previewContent}`;
    } else if (template.letterhead_html) {
      previewHtml = `<style>${template.letterhead_css || ''}</style>${template.letterhead_html}${previewContent}`;
    } else {
      previewHtml = `<div style="padding: 20px; text-align: center; color: #666;"><p>Kein Header definiert</p></div>${previewContent}`;
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

  const tabDefinitions = [
    { value: 'canvas-designer', label: 'Canvas' },
    { value: 'header-designer', label: 'Header' },
    { value: 'footer-designer', label: 'Footer' },
    { value: 'block-address', label: 'Adressfeld', mobileLabel: 'Adresse' },
    { value: 'block-info', label: 'Info-Block', mobileLabel: 'Info' },
    { value: 'block-subject', label: 'Betreff, Anrede & Abschluss', mobileLabel: 'Betreff' },
    { value: 'block-attachments', label: 'Anlagen' },
    { value: 'layout-settings', label: 'Layout' },
    { value: 'general', label: 'Allgemein' },
  ] as const;

  const activeTabDefinition = tabDefinitions.find((tab) => tab.value === activeTab);

  // Consolidated tab navigation - used by both create and edit
  const renderTabsNavigation = () => (
    <>
      <div className="sm:hidden">
        <Label htmlFor="letter-template-tab-select" className="mb-2 block text-sm font-medium">Bereich</Label>
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger id="letter-template-tab-select" className="w-full">
            <SelectValue>{activeTabDefinition ? (activeTabDefinition.mobileLabel ?? activeTabDefinition.label) : 'Bereich auswählen'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabDefinitions.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>{tab.mobileLabel ?? tab.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TabsList className="hidden w-full justify-start gap-1 overflow-x-auto whitespace-nowrap sm:flex">
        {tabDefinitions.map((tab) => renderTabTrigger(tab.value, tab.label, tab.mobileLabel))}
      </TabsList>
    </>
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
        <BlockLineEditor
          blockType="footer"
          lines={parseFooterLinesForEditor(formData.footer_blocks)}
          onChange={(newLines) => {
            const footerData = toFooterLineData(newLines);
            setFormData(prev => ({
              ...prev,
              footer_blocks: footerData as any,
              layout_settings: {
                ...prev.layout_settings,
                blockContent: { ...((prev.layout_settings as any).blockContent || {}), footer: footerData },
              } as LetterLayoutSettings
            }));
          }}
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

      <TabsContent value="block-address" className="space-y-6">
        {/* Rücksendezeile (Vermerkzone - 17.7mm) */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Rücksendezeile (Zusatz- und Vermerkzone – {formData.layout_settings.addressField.returnAddressHeight || 17.7}mm)</h4>
          <BlockLineEditor
            blockType="returnAddress"
            lines={(() => {
              const raw = getBlockItems('returnAddress');
              if (raw && typeof raw === 'object' && (raw as any).mode === 'lines') return (raw as any).lines || [];
              return Array.isArray(raw) && raw.length > 0 && (raw[0]?.type === 'label-value' || raw[0]?.type === 'spacer' || raw[0]?.type === 'text-only') ? raw as BlockLine[] : [];
            })()}
            onChange={(newLines) => setBlockItems('returnAddress', { mode: 'lines', lines: newLines } as any)}
          />
        </div>

        <div className="border-t" />

        {/* Anschrift (Anschriftzone - 27.3mm) */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Empfängeranschrift (Anschriftzone – {formData.layout_settings.addressField.addressZoneHeight || 27.3}mm)</h4>
          <BlockLineEditor
            blockType="addressField"
            lines={(() => {
              const raw = getBlockItems('addressField');
              if (raw && typeof raw === 'object' && (raw as any).mode === 'lines') return (raw as any).lines || [];
              return Array.isArray(raw) && raw.length > 0 && raw[0]?.type === 'label-value' || raw[0]?.type === 'spacer' || raw[0]?.type === 'text-only' ? raw as BlockLine[] : [];
            })()}
            onChange={(newLines) => setBlockItems('addressField', { mode: 'lines', lines: newLines } as any)}
          />
        </div>

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
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Betreff-Darstellung</h4>
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formData.layout_settings.subject?.integrated !== false}
                  onCheckedChange={(checked) => {
                    setFormData(prev => ({
                      ...prev,
                      layout_settings: {
                        ...prev.layout_settings,
                        subject: { ...prev.layout_settings.subject, integrated: !!checked }
                      }
                    }));
                  }}
                />
                Betreff in Inhaltsbereich integrieren (DIN 5008)
              </label>
            </div>

            <div className="mb-3">
              <Label className="text-xs mb-1 block">Betreffzeile</Label>
              <BlockLineEditor
                blockType="subject"
                lines={(() => {
                  const subjectLine = (formData.layout_settings as any)?.blockContent?.subjectLine;
                  const configuredShape = (formData.layout_settings as any)?.subject?.prefixShape || 'none';

                  if (subjectLine && typeof subjectLine === 'object' && (subjectLine as any).mode === 'lines') {
                    return ((subjectLine as any).lines || []).map((line: any) => ({
                      ...line,
                      prefixShape: line.prefixShape || configuredShape,
                    })) as BlockLine[];
                  }

                  if (Array.isArray(subjectLine) && subjectLine.length > 0) {
                    return [{
                      id: 'subject-1',
                      type: 'text-only',
                      value: (subjectLine[0] as any)?.content || '{{betreff}}',
                      isVariable: true,
                      prefixShape: configuredShape,
                    } as BlockLine];
                  }

                  return [{ id: 'subject-1', type: 'text-only', value: '{{betreff}}', isVariable: true, prefixShape: configuredShape } as BlockLine];
                })()}
                onChange={(newLines) => {
                  const firstShape = newLines.find((line) => line.type === 'text-only')?.prefixShape || 'none';
                  setFormData(prev => ({
                    ...prev,
                    layout_settings: {
                      ...prev.layout_settings,
                      subject: {
                        ...prev.layout_settings.subject,
                        prefixShape: firstShape,
                      },
                      blockContent: {
                        ...(prev.layout_settings.blockContent || {}),
                        subjectLine: { mode: 'lines', lines: newLines },
                      },
                    },
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">Verwenden Sie {'{{betreff}}'} als Variable für den dynamischen Betreff des Briefes. Formen können direkt pro Zeile gewählt werden.</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Anrede-Vorlage</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Die Variable {'{{anrede}}'} wird automatisch basierend auf dem Empfänger generiert (Herr/Frau/Damen und Herren).
            </p>
            <Select
              value={formData.layout_settings.salutation?.template || 'Sehr geehrte Damen und Herren,'}
              onValueChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  layout_settings: {
                    ...prev.layout_settings,
                    salutation: { ...(prev.layout_settings.salutation || { fontSize: 11 }), template: value }
                  }
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="{{anrede}}">Automatisch (basierend auf Empfänger)</SelectItem>
                <SelectItem value="Sehr geehrte Damen und Herren,">Sehr geehrte Damen und Herren,</SelectItem>
                <SelectItem value="Guten Tag,">Guten Tag,</SelectItem>
                <SelectItem value="Liebe Kolleginnen und Kollegen,">Liebe Kolleginnen und Kollegen,</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Abschlussformel und Unterschrift */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Abschlussformel & Unterschrift</h4>
            <div className="space-y-3">
              <div>
                <Label>Abschlussformel</Label>
                <Input
                  value={formData.layout_settings.closing?.formula || ''}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      layout_settings: {
                        ...prev.layout_settings,
                        closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), formula: e.target.value }
                      }
                    }));
                  }}
                  placeholder="z.B. Mit freundlichen Grüßen"
                />
              </div>
              <div>
                <Label>Unterschrift-Name</Label>
                <Input
                  value={formData.layout_settings.closing?.signatureName || ''}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      layout_settings: {
                        ...prev.layout_settings,
                        closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureName: e.target.value }
                      }
                    }));
                  }}
                  placeholder="z.B. Max Mustermann"
                />
              </div>
              <div>
                <Label>Unterschrift-Titel</Label>
                <Input
                  value={formData.layout_settings.closing?.signatureTitle || ''}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      layout_settings: {
                        ...prev.layout_settings,
                        closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureTitle: e.target.value }
                      }
                    }));
                  }}
                  placeholder="z.B. Referent"
                />
              </div>
              <div>
                <Label>Unterschriftsbild</Label>
                {formData.layout_settings.closing?.signatureImagePath && (
                  <div className="mb-2 p-2 border rounded-lg bg-muted/30">
                    <img
                      src={(() => {
                        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(formData.layout_settings.closing.signatureImagePath!);
                        return publicUrl;
                      })()}
                      alt="Unterschrift"
                      className="max-h-16 max-w-[200px] object-contain"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file || !currentTenant) return;
                        const filePath = `signatures/${currentTenant.id}/${Date.now()}-${file.name}`;
                        const { error } = await supabase.storage.from('letter-assets').upload(filePath, file);
                        if (error) {
                          toast({ title: 'Upload fehlgeschlagen', description: error.message, variant: 'destructive' });
                          return;
                        }
                        setFormData(prev => ({
                          ...prev,
                          layout_settings: {
                            ...prev.layout_settings,
                            closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureImagePath: filePath }
                          }
                        }));
                        toast({ title: 'Unterschriftsbild hochgeladen' });
                      };
                      input.click();
                    }}
                  >
                    Bild hochladen
                  </Button>
                  {formData.layout_settings.closing?.signatureImagePath && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          layout_settings: {
                            ...prev.layout_settings,
                            closing: { ...(prev.layout_settings.closing || { formula: '', signatureName: '' }), signatureImagePath: '' }
                          }
                        }));
                      }}
                    >
                      Entfernen
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Laden Sie ein Bild Ihrer Unterschrift hoch (PNG, JPG).</p>
              </div>
            </div>
          </div>

          {/* Canvas elements for subject (legacy/custom) */}
          {formData.layout_settings.subject?.integrated === false && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Betreff als Canvas-Element</h4>
              {renderSharedElementsEditor('subject',
                formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
                Math.max(8, formData.layout_settings.subject.marginBottom + 4)
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="block-attachments" className="space-y-4">
        {renderSharedElementsEditor('attachments',
          formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          20
        )}
      </TabsContent>

    </>
  );

  const isFormOpen = showCreateDialog || !!editingTemplate || showSettings;

  return (
    <div className="space-y-6">
      {!editingTemplate && !showSettings && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Einstellungen
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => { if (showCreateDialog) { setShowCreateDialog(false); resetForm(); } else { setShowCreateDialog(true); resetForm(); setActiveTab('canvas-designer'); } }}>
            <Plus className="h-4 w-4 mr-2" />
            {showCreateDialog ? 'Erstellung schließen' : 'Neues Template'}
          </Button>
        </div>
      )}

      {/* Settings Page */}
      {showSettings && (
        <LetterTemplateSettings onBack={() => setShowSettings(false)} />
      )}

      {/* Create Template - inline card */}
      {showCreateDialog && !editingTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Neues Brief-Template erstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {renderTabsNavigation()}
              {renderCommonTabsContent()}
            </Tabs>
            {activeTab !== 'canvas-designer' && activeTab !== 'header-designer' && (
              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                <Button className="w-full sm:w-auto" variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>Abbrechen</Button>
                <Button className="w-full sm:w-auto" onClick={handleCreateTemplate}>Template erstellen</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template list */}
      {!showCreateDialog && !editingTemplate && !showSettings && (loading ? (
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm break-words">{template.name}</CardTitle>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowPreview(template.id)} title="Vorschau"><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => startEditing(template)} title="Template bearbeiten"><Edit3 className="h-4 w-4" /></Button>
                    {!template.is_default && (<Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template)}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl break-words">Template bearbeiten: {editingTemplate.name}</h2>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button className="w-full sm:w-auto" variant="outline" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
              <Button className="w-full sm:w-auto" onClick={handleUpdateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {renderTabsNavigation()}
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
