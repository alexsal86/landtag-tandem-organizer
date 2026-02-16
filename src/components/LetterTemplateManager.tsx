import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Edit3, Trash2, Plus, Save, X, Eye, Upload, ImageIcon } from 'lucide-react';
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


interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
  publicUrl: string;
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

const normalizeLayoutBlockContentImages = (layoutSettings: LetterLayoutSettings) => {
  const blockContent = ((layoutSettings as any).blockContent || {}) as Record<string, any[]>;
  const normalizedContent = Object.fromEntries(
    Object.entries(blockContent).map(([key, items]) => {
      if (!Array.isArray(items)) return [key, items];

      const normalizedItems = items.map((item: any) => {
        if (!item || item.type !== 'image') return item;

        const storagePath = item.storagePath || extractStoragePathFromUrl(item.imageUrl);
        if (!storagePath) return item;

        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
        return {
          ...item,
          storagePath,
          imageUrl: publicUrl,
        };
      });

      return [key, normalizedItems];
    })
  );

  return {
    ...layoutSettings,
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

  const loadGalleryImages = useCallback(async () => {
    if (!currentTenant?.id) return;
    setGalleryLoading(true);
    try {
      const folderPath = `${currentTenant.id}/header-images`;
      const { data: files, error } = await supabase.storage.from('letter-assets').list(folderPath);
      if (error) return;

      const imageFiles = (files || []).filter((file) => file.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file.name));
      const loaded: GalleryImage[] = [];
      const nextMap = new Map<string, string>();

      for (const file of imageFiles) {
        const filePath = `${folderPath}/${file.name}`;
        const cached = galleryBlobUrlsRef.current.get(filePath);
        if (cached) {
          nextMap.set(filePath, cached);
          const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(filePath);
          loaded.push({ name: file.name, path: filePath, blobUrl: cached, publicUrl });
          continue;
        }

        try {
          const { data: blob, error: dlError } = await supabase.storage.from('letter-assets').download(filePath);
          if (dlError || !blob) continue;
          const blobUrl = URL.createObjectURL(blob);
          nextMap.set(filePath, blobUrl);
          const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(filePath);
          loaded.push({ name: file.name, path: filePath, blobUrl, publicUrl });
        } catch (error) {
          console.error('Error downloading gallery image:', error);
        }
      }

      galleryBlobUrlsRef.current.forEach((blobUrl, path) => {
        if (!nextMap.has(path)) URL.revokeObjectURL(blobUrl);
      });
      galleryBlobUrlsRef.current = nextMap;
      setGalleryImages(loaded);
    } catch (error) {
      console.error('Error loading gallery images:', error);
    } finally {
      setGalleryLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
      loadGalleryImages();
    }
  }, [currentTenant, loadGalleryImages]);

  useEffect(() => {
    return () => {
      galleryBlobUrlsRef.current.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      galleryBlobUrlsRef.current.clear();
    };
  }, []);

  const handleSubjectImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !currentTenant?.id) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;
      const { error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) {
        toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
        return;
      }
      await loadGalleryImages();
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

  // Strip blobUrl from elements before persisting - blobUrls are runtime-only
  const stripBlobUrls = (elements: any[]): any[] =>
    elements.map(({ blobUrl, ...rest }) => rest);

  const stripBlobUrlsFromLayoutSettings = (settings: any): any => {
    if (!settings || typeof settings !== 'object') return settings;
    const cleaned = { ...settings };
    if (cleaned.blockContent && typeof cleaned.blockContent === 'object') {
      const cleanedBlocks: any = {};
      for (const [key, items] of Object.entries(cleaned.blockContent)) {
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
    setFormData({
      name: template.name, letterhead_html: template.letterhead_html, letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days, default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || [], header_elements: headerElements,
      footer_blocks: footerBlocks,
      layout_settings: normalizeLayoutBlockContentImages(template.layout_settings || DEFAULT_DIN5008_LAYOUT)
    });
  };

  const cancelEditing = () => { setEditingTemplate(null); setActiveTab('canvas-designer'); resetForm(); };

  const updateLayoutSettings = (updater: (layout: LetterLayoutSettings) => LetterLayoutSettings) => {
    setFormData((prev) => ({ ...prev, layout_settings: updater(prev.layout_settings) }));
  };

  const getBlockItems = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'attachments') => {
    const content = ((formData.layout_settings as any).blockContent || {}) as Record<string, any[]>;
    return content[blockKey] || [];
  };

  const setBlockItems = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'attachments', items: any[]) => {
    updateLayoutSettings((layout) => {
      const current = ((layout as any).blockContent || {}) as Record<string, any[]>;
      return { ...layout, blockContent: { ...current, [blockKey]: items } } as LetterLayoutSettings;
    });
  };

  // Block canvas drag state
  const [blockDrag, setBlockDrag] = useState<{ blockKey: string; itemId: string; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [blockResize, setBlockResize] = useState<{ blockKey: string; itemId: string; startX: number; startY: number; ow: number; oh: number } | null>(null);

  const onBlockCanvasMouseMove = (e: React.MouseEvent, blockKey: string, scale: number) => {
    if (blockResize && blockResize.blockKey === blockKey) {
      const dx = (e.clientX - blockResize.startX) / scale;
      const dy = (e.clientY - blockResize.startY) / scale;
      const newW = Math.max(5, blockResize.ow + dx);
      const newH = Math.max(5, blockResize.oh + dy);
      const items = getBlockItems(blockKey as any);
      setBlockItems(blockKey as any, items.map((item: any) => item.id === blockResize.itemId ? { ...item, width: Math.round(newW), height: Math.round(newH) } : item));
      return;
    }
    if (blockDrag && blockDrag.blockKey === blockKey) {
      const dx = (e.clientX - blockDrag.startX) / scale;
      const dy = (e.clientY - blockDrag.startY) / scale;
      const newX = Math.max(0, Math.round(blockDrag.ox + dx));
      const newY = Math.max(0, Math.round(blockDrag.oy + dy));
      const items = getBlockItems(blockKey as any);
      setBlockItems(blockKey as any, items.map((item: any) => item.id === blockDrag.itemId ? { ...item, x: newX, y: newY } : item));
    }
  };

  const onBlockCanvasMouseUp = () => { setBlockDrag(null); setBlockResize(null); };

  const addImageItemToBlock = (
    blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'attachments',
    imageUrl: string,
    rect: { width: number; height: number },
    storagePath?: string
  ) => {
    const items = getBlockItems(blockKey);
    const id = Date.now().toString();
    const defaultW = Math.min(40, Math.max(20, rect.width * 0.35));
    const defaultH = Math.min(18, Math.max(10, rect.height * 0.7));
    const x = Math.max(0, Math.round((rect.width - defaultW) / 2));
    const y = Math.max(0, Math.round((Math.max(rect.height, 25) - defaultH) / 2));
    setBlockItems(blockKey, [...items, { id, type: 'image', x, y, width: defaultW, height: defaultH, imageUrl, storagePath }]);
    setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
  };

  const renderBlockCanvas = (blockKey: 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'attachments', title: string, rect: { top: number; left: number; width: number; height: number }) => {
    const items = getBlockItems(blockKey);
    const scale = 2.4;
    const selectedId = selectedBlockItem[blockKey] || items[0]?.id || null;
    const selected = items.find((item: any) => item.id === selectedId) || null;
    const ruler = !!showBlockRuler[blockKey];
    const showAxes = !!showBlockRuler[`${blockKey}_axes`];

    const updateItem = (id: string, updates: any) => setBlockItems(blockKey, items.map((item: any) => (item.id === id ? { ...item, ...updates } : item)));

    const deleteItem = (id: string) => {
      setBlockItems(blockKey, items.filter((item: any) => item.id !== id));
      if (selectedId === id) setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: null }));
    };

    const canvasW = rect.width * scale;
    const canvasH = Math.max(rect.height, 25) * scale;

    const variablePlaceholders = [
      { label: 'Betreff', variable: '{{betreff}}' },
      { label: 'Datum', variable: '{{datum}}' },
      { label: 'Empfänger', variable: '{{empfaenger_name}}' },
      { label: 'Absender', variable: '{{absender_name}}' },
      { label: 'Adresse', variable: '{{empfaenger_adresse}}' },
      { label: 'PLZ/Ort', variable: '{{empfaenger_plz_ort}}' },
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-3 border rounded-lg p-3 overflow-y-auto max-h-[70vh]">
            {/* Draggable text tool */}
            <div draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-block-tool', 'text'); e.dataTransfer.effectAllowed = 'copy'; }} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <span className="text-muted-foreground mt-0.5">⠿</span>
              <div><div className="font-medium text-xs">Text-Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            {/* Variablen-Platzhalter */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Variablen</Label>
              <div className="flex flex-wrap gap-1">
                {variablePlaceholders.map((v) => (
                  <div
                    key={v.variable}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', v.variable); e.dataTransfer.setData('application/x-block-tool', 'variable'); e.dataTransfer.effectAllowed = 'copy'; }}
                    className="px-2 py-1 rounded-full border bg-amber-50 text-amber-800 border-amber-300 text-[11px] cursor-grab active:cursor-grabbing select-none"
                  >
                    {v.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Bilder-Galerie */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Bilder</Label>
              <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={handleSubjectImageUpload}>
                <Upload className="h-3 w-3 mr-1" /> Bild hochladen
              </Button>
              {galleryLoading ? (
                <p className="text-xs text-muted-foreground">Lade Bilder...</p>
              ) : galleryImages.length > 0 && (
                <div className="grid grid-cols-4 gap-1">
                  {galleryImages.map((img) => (
                    <div
                      key={img.name}
                      draggable
                      onClick={() => setSelectedGalleryImage((prev) => ({ ...prev, [blockKey]: img }))}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-block-tool', 'image');
                        e.dataTransfer.setData('application/x-block-image-url', img.publicUrl);
                        e.dataTransfer.setData('application/x-block-image-path', img.path);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className={`border rounded overflow-hidden cursor-grab active:cursor-grabbing aspect-square bg-muted/30 ${selectedGalleryImage[blockKey]?.path === img.path ? 'ring-2 ring-primary' : ''}`}
                      title={img.name}
                    >
                      <img src={img.blobUrl} alt={img.name} className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>
              )}
              {selectedGalleryImage[blockKey] && (
                <div className="space-y-2 rounded-md border p-2 bg-muted/30">
                  <Label className="text-xs uppercase text-muted-foreground">Canvas-Vorschau</Label>
                  <div className="rounded border bg-white p-2">
                    <div className="relative h-20 w-full overflow-hidden rounded border border-dashed border-muted-foreground/40 bg-[radial-gradient(circle,_#e5e7eb_1px,_transparent_1px)] bg-[length:10px_10px]">
                      <img
                        src={selectedGalleryImage[blockKey]?.blobUrl}
                        alt={selectedGalleryImage[blockKey]?.name}
                        className="absolute left-1/2 top-1/2 h-14 w-24 -translate-x-1/2 -translate-y-1/2 object-contain"
                      />
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{selectedGalleryImage[blockKey]?.name}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => addImageItemToBlock(blockKey, selectedGalleryImage[blockKey]!.publicUrl, rect, selectedGalleryImage[blockKey]!.path)}
                  >
                    <ImageIcon className="h-3 w-3 mr-1" /> In Canvas einfügen
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant={ruler ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setShowBlockRuler((prev) => ({ ...prev, [blockKey]: !prev[blockKey] }))}>Lineal</Button>
              <Button type="button" variant={showAxes ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setShowBlockRuler((prev) => ({ ...prev, [`${blockKey}_axes`]: !prev[`${blockKey}_axes`] }))}>Achsen</Button>
            </div>
            {/* Element list */}
            <div className="space-y-2 max-h-40 overflow-auto">
              {items.map((item: any) => (
                <div key={item.id} className={`p-2 border rounded cursor-pointer flex items-center justify-between ${selectedId === item.id ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: item.id }))}>
                  <div className="flex items-center gap-1 min-w-0">
                    {item.isVariable && <span className="text-amber-600 text-[10px]">⚡</span>}
                    <span className="text-sm truncate">{(item.content || item.type || 'Element').toString().slice(0, 30)}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="h-6 w-6 p-0 shrink-0">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            {/* Selected element properties */}
            {selected && (
              <div className="space-y-2 border-t pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">X (mm)</Label><Input type="number" value={selected.x || 0} onChange={(e) => updateItem(selected.id, { x: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></div>
                  <div><Label className="text-xs">Y (mm)</Label><Input type="number" value={selected.y || 0} onChange={(e) => updateItem(selected.id, { y: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={selected.width || 50} onChange={(e) => updateItem(selected.id, { width: parseFloat(e.target.value) || 50 })} className="h-7 text-xs" /></div>
                  {selected.height != null && <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={selected.height || 10} onChange={(e) => updateItem(selected.id, { height: parseFloat(e.target.value) || 10 })} className="h-7 text-xs" /></div>}
                </div>
                {(selected.type === 'text' || !selected.type) && (
                  <>
                    <Label className="text-xs">Textinhalt</Label>
                    <Textarea value={selected.content || ''} onChange={(e) => updateItem(selected.id, { content: e.target.value })} rows={3} className="text-xs" />
                    <Label className="text-xs">Schriftart</Label>
                    <Select value={selected.fontFamily || 'Arial'} onValueChange={(value) => updateItem(selected.id, { fontFamily: value })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Calibri">Calibri</SelectItem>
                        <SelectItem value="Verdana">Verdana</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-1">
                      <Button type="button" size="sm" className="h-6 text-xs" variant={selected.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })}>Fett</Button>
                      <Button type="button" size="sm" className="h-6 text-xs" variant={selected.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}>Kursiv</Button>
                      <Button type="button" size="sm" className="h-6 text-xs" variant={selected.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateItem(selected.id, { textDecoration: selected.textDecoration === 'underline' ? 'none' : 'underline' })}>U</Button>
                    </div>
                  </>
                )}
                {selected.type === 'image' && (
                  <p className="text-xs text-muted-foreground">Bild-Element. Position und Größe oben anpassen.</p>
                )}
              </div>
            )}
          </div>
          {/* Canvas area - centered */}
          <div className="border rounded-lg p-6 bg-muted/30 overflow-auto flex items-center justify-center min-h-[200px]"
            onMouseMove={(e) => onBlockCanvasMouseMove(e, blockKey, scale)}
            onMouseUp={onBlockCanvasMouseUp}
            onMouseLeave={onBlockCanvasMouseUp}
          >
            <div className="relative" style={{ width: canvasW + 24, height: canvasH + 24 }}>
              {ruler && (
                <>
                  <div className="absolute top-0 left-6 right-0 h-6 border rounded bg-white/90 text-[9px] text-muted-foreground pointer-events-none">{Array.from({ length: Math.floor(rect.width / 10) + 1 }).map((_, i) => <span key={`bx-${i}`} className="absolute" style={{ left: i * 10 * scale }}>{i * 10}</span>)}</div>
                  <div className="absolute top-6 left-0 bottom-0 w-6 border rounded bg-white/90 text-[9px] text-muted-foreground pointer-events-none">{Array.from({ length: Math.floor(Math.max(rect.height, 25) / 10) + 1 }).map((_, i) => <span key={`by-${i}`} className="absolute" style={{ top: i * 10 * scale }}>{i * 10}</span>)}</div>
                </>
              )}
              <div className="absolute left-6 top-6 relative bg-white border select-none"
                style={{ width: canvasW, height: canvasH, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '8px 8px' }}
                onKeyDown={(e) => {
                  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteItem(selectedId); return; }
                  if (!selectedId) return;
                  let dx = 0, dy = 0;
                  if (e.key === 'ArrowLeft') dx = -1;
                  if (e.key === 'ArrowRight') dx = 1;
                  if (e.key === 'ArrowUp') dy = -1;
                  if (e.key === 'ArrowDown') dy = 1;
                  if (dx || dy) {
                    e.preventDefault();
                    const item = items.find((i: any) => i.id === selectedId);
                    if (item) updateItem(selectedId, { x: Math.max(0, (item.x || 0) + dx), y: Math.max(0, (item.y || 0) + dy) });
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const domRect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round((e.clientX - domRect.left) / scale);
                  const y = Math.round((e.clientY - domRect.top) / scale);
                  const tool = e.dataTransfer.getData('application/x-block-tool');
                  // Handle text drop
                  if (tool === 'text') {
                    const id = Date.now().toString();
                    setBlockItems(blockKey, [...items, { id, type: 'text', x, y, width: 60, content: 'Neuer Text', fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }]);
                    setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
                    return;
                  }
                  // Handle variable drop
                  if (tool === 'variable') {
                    const varText = e.dataTransfer.getData('text/plain');
                    if (varText && varText.startsWith('{{')) {
                      const id = Date.now().toString();
                      setBlockItems(blockKey, [...items, { id, type: 'text', x, y, width: 60, content: varText, isVariable: true, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }]);
                      setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
                      return;
                    }
                  }
                  // Handle image drop
                  if (tool === 'image') {
                    const imgUrl = e.dataTransfer.getData('application/x-block-image-url');
                    const imgPath = e.dataTransfer.getData('application/x-block-image-path');
                    if (imgUrl) {
                      const id = Date.now().toString();
                      setBlockItems(blockKey, [...items, { id, type: 'image', x, y, width: 30, height: 15, imageUrl: imgUrl, storagePath: imgPath || null }]);
                      setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
                      return;
                    }
                  }
                  // Fallback: check text/plain for variables
                  const textData = e.dataTransfer.getData('text/plain');
                  if (textData && textData.startsWith('{{')) {
                    const id = Date.now().toString();
                    setBlockItems(blockKey, [...items, { id, type: 'text', x, y, width: 60, content: textData, isVariable: true, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' }]);
                    setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: id }));
                  }
                }}
                tabIndex={0}
              >
                {/* Center guides */}
                {showAxes && (
                  <>
                    <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none z-10" />
                    <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none z-10" />
                  </>
                )}
                {items.map((item: any) => {
                  const isSelected = selectedId === item.id;
                  // Image element
                  if (item.type === 'image' && item.imageUrl) {
                    return (
                      <div
                        key={item.id}
                        className={`absolute cursor-move border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}
                        style={{ left: (item.x || 0) * scale, top: (item.y || 0) * scale, width: (item.width || 30) * scale, height: (item.height || 15) * scale }}
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: item.id })); setBlockDrag({ blockKey, itemId: item.id, startX: e.clientX, startY: e.clientY, ox: item.x || 0, oy: item.y || 0 }); }}
                      >
                        <img src={item.imageUrl} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                        {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => { e.stopPropagation(); setBlockResize({ blockKey, itemId: item.id, startX: e.clientX, startY: e.clientY, ow: item.width || 30, oh: item.height || 15 }); }} />}
                      </div>
                    );
                  }
                  // Text element (default)
                  return (
                    <div
                      key={item.id}
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedBlockItem((prev) => ({ ...prev, [blockKey]: item.id })); setBlockDrag({ blockKey, itemId: item.id, startX: e.clientX, startY: e.clientY, ox: item.x || 0, oy: item.y || 0 }); }}
                      data-block-item
                      className={`absolute border px-2 py-1 text-xs cursor-move ${isSelected ? 'border-primary bg-primary/15' : 'border-primary/50 bg-primary/10'} ${item.isVariable ? 'bg-amber-50 border-amber-400 text-amber-900' : ''}`}
                      style={{ left: (item.x || 0) * scale, top: (item.y || 0) * scale, width: (item.width || 50) * scale, fontFamily: item.fontFamily || 'Arial', fontWeight: item.fontWeight || 'normal', fontStyle: item.fontStyle || 'normal', textDecoration: item.textDecoration || 'none' }}
                    >
                      {item.isVariable && <span className="text-[9px] text-amber-600 mr-1">⚡</span>}
                      {item.content || 'Text'}
                      {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => { e.stopPropagation(); setBlockResize({ blockKey, itemId: item.id, startX: e.clientX, startY: e.clientY, ow: item.width || 50, oh: item.height || 10 }); }} />}
                    </div>
                  );
                })}
              </div>
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

  // Consolidated tab list - used by both create and edit
  // Order: Canvas, Header, Footer, Adressfeld, Rücksende, Info-Block, Betreff, Anlagen, Inhalt, Layout, Allgemein
  const renderTabsList = () => (
    <TabsList className="grid w-full grid-cols-11">
      <TabsTrigger value="canvas-designer">Canvas</TabsTrigger>
      <TabsTrigger value="header-designer">Header</TabsTrigger>
      <TabsTrigger value="footer-designer">Footer</TabsTrigger>
      <TabsTrigger value="block-address">Adressfeld</TabsTrigger>
      <TabsTrigger value="block-return-address">Rücksende</TabsTrigger>
      <TabsTrigger value="block-info">Info-Block</TabsTrigger>
      <TabsTrigger value="block-subject">Betreff</TabsTrigger>
      <TabsTrigger value="block-attachments">Anlagen</TabsTrigger>
      <TabsTrigger value="block-content">Inhalt</TabsTrigger>
      <TabsTrigger value="layout-settings">Layout</TabsTrigger>
      <TabsTrigger value="general">Allgemein</TabsTrigger>
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

      <TabsContent value="block-subject" className="space-y-4">
        {renderBlockCanvas('subject', 'Betreffbereich', {
          top: formData.layout_settings.subject.top,
          left: formData.layout_settings.margins.left,
          width: formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          height: Math.max(8, formData.layout_settings.subject.marginBottom + 4),
        })}
      </TabsContent>

      <TabsContent value="block-content" className="space-y-4">
        <h3 className="text-lg font-semibold">Inhaltsbereich</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Top (mm)</Label><Input type="number" value={formData.layout_settings.content.top} onChange={(e) => updateLayoutSettings((l) => ({ ...l, content: { ...l.content, top: parseFloat(e.target.value) || 0 } }))} /></div>
          <div><Label>Max. Höhe (mm)</Label><Input type="number" value={formData.layout_settings.content.maxHeight} onChange={(e) => updateLayoutSettings((l) => ({ ...l, content: { ...l.content, maxHeight: parseFloat(e.target.value) || 0 } }))} /></div>
        </div>
      </TabsContent>

      <TabsContent value="block-attachments" className="space-y-4">
        {renderBlockCanvas('attachments', 'Anlagenbereich', {
          top: formData.layout_settings.attachments.top,
          left: formData.layout_settings.margins.left,
          width: formData.layout_settings.pageWidth - formData.layout_settings.margins.left - formData.layout_settings.margins.right,
          height: 20,
        })}
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
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setActiveTab('canvas-designer'); resetForm(); }}>Abbrechen</Button>
              <Button onClick={handleCreateTemplate}>Template erstellen</Button>
            </div>
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Template bearbeiten: {editingTemplate.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelEditing}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {renderTabsList()}
              {renderCommonTabsContent()}
            </Tabs>
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button variant="outline" onClick={cancelEditing}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
              <Button onClick={handleUpdateTemplate}><Save className="h-4 w-4 mr-2" />Speichern</Button>
            </div>
          </CardContent>
        </Card>
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
