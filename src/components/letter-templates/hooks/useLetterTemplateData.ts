import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import { handleAppError } from '@/utils/errorHandler';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_DIN5008_LAYOUT,
  type BlockContentEntry,
  type BlockEditorKey,
  type LetterCanvasElement,
  type LetterLayoutSettings,
  type TemplateFormData,
  isLetterCanvasElementArray,
  isLineModeBlockData,
} from '@/types/letterLayout';
import { parseFooterLinesForEditor, toFooterLineData } from '@/components/letters/footerBlockUtils';
import {
  LetterTemplate, SenderInformation, InformationBlock, GalleryImage,
  normalizeImageItem, normalizeLayoutBlockContentImages, createDefaultAttachmentElements,
  MarginKey, TabRect,
} from '../types';

export function useLetterTemplateData() {
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
  const [showSettings, setShowSettings] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const galleryBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    letterhead_html: '',
    letterhead_css: '',
    response_time_days: 21,
    default_sender_id: '',
    default_info_blocks: [] as string[],
    header_elements: [],
    footer_blocks: [],
    layout_settings: DEFAULT_DIN5008_LAYOUT,
  });

  useEffect(() => {
    if (currentTenant) {
      fetchTemplates();
      fetchSenderInfos();
      fetchInformationBlocks();
    }
  }, [currentTenant]);

  const fetchTemplates = async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('letter_templates').select('id, name, letterhead_html, letterhead_css, response_time_days, is_default, is_active, tenant_id, created_by, default_sender_id, default_info_blocks, header_layout_type, header_text_elements, footer_blocks, layout_settings, created_at, updated_at').eq('tenant_id', currentTenant.id)
        .eq('is_active', true).order('is_default', { ascending: false }).order('name');
      if (error) throw error;
      setTemplates((data || []) as unknown as LetterTemplate[]);
    } catch (error) {
      handleAppError(error, { context: 'fetchTemplates', toast: { fn: toast, title: 'Fehler', description: 'Templates konnten nicht geladen werden.' } });
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
    } catch (error) { handleAppError(error, { context: 'fetchSenderInfos' }); }
  };

  const fetchInformationBlocks = async () => {
    if (!currentTenant) return;
    try {
      const { data, error } = await supabase.from('information_blocks').select('id, name, label, is_default').eq('tenant_id', currentTenant.id).eq('is_active', true).order('is_default', { ascending: false });
      if (error) throw error;
      setInfoBlocks(data || []);
    } catch (error) { handleAppError(error, { context: 'fetchInformationBlocks' }); }
  };

  const stripBlobUrls = (elements: unknown): unknown => {
    if (Array.isArray(elements)) return elements.map(({ blobUrl, ...rest }: Record<string, unknown>) => rest);
    if (elements && typeof elements === 'object') {
      const obj = elements as Record<string, unknown>;
      if (obj.mode === 'lines' && Array.isArray(obj.lines)) {
        return { ...obj, lines: (obj.lines as Record<string, unknown>[]).map(({ blobUrl, ...rest }) => rest) };
      }
      if (Array.isArray(obj.blocks)) {
        return {
          ...obj,
          blocks: (obj.blocks as Record<string, unknown>[]).map((block) => ({
            ...block, lines: Array.isArray((block as Record<string, unknown>)?.lines) ? ((block as Record<string, unknown>).lines as Record<string, unknown>[]).map(({ blobUrl, ...rest }) => rest) : [],
          })),
        };
      }
    }
    return elements;
  };

  const stripBlobUrlsFromLayoutSettings = (settings: LetterLayoutSettings): LetterLayoutSettings => {
    if (!settings || typeof settings !== 'object') return settings;
    const cleaned = { ...settings };
    const bc = (cleaned as unknown as Record<string, unknown>).blockContent;
    if (bc && typeof bc === 'object') {
      const cleanedBlocks: Record<string, unknown> = {};
      for (const [key, items] of Object.entries(bc as Record<string, unknown>)) {
        if (key === 'header') continue;
        cleanedBlocks[key] = Array.isArray(items) ? stripBlobUrls(items) : items;
      }
      (cleaned as unknown as Record<string, unknown>).blockContent = cleanedBlocks;
    }
    return cleaned;
  };

  const handleCreateTemplate = async () => {
    if (!currentTenant || !user || !formData.name.trim()) return;
    const cleanedHeaderElements = stripBlobUrls(formData.header_elements) as LetterCanvasElement[];
    const cleanedFooterBlocks = stripBlobUrls(formData.footer_blocks);
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(normalizeLayoutBlockContentImages(formData.layout_settings));
    try {
      // Supabase JSON columns require flexible types - cast at DB boundary
      const insertData: Record<string, unknown> = {
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, tenant_id: currentTenant.id, created_by: user.id,
        is_default: false, is_active: true, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: Array.isArray(cleanedHeaderElements) && cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: Array.isArray(cleanedHeaderElements) && cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: Array.isArray(cleanedFooterBlocks) ? (cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null) : cleanedFooterBlocks,
        layout_settings: cleanedLayoutSettings,
      };
      const { error } = await supabase.from('letter_templates').insert(insertData as typeof insertData & { name: string; letterhead_html: string; letterhead_css: string; response_time_days: number; tenant_id: string; created_by: string });
      if (error) throw error;
      toast({ title: "Template erstellt" });
      setShowCreateDialog(false);
      setActiveTab('canvas-designer');
      resetForm();
      fetchTemplates();
    } catch (error) {
      handleAppError(error, { context: 'handleCreateTemplate', toast: { fn: toast, title: 'Fehler', description: 'Template konnte nicht erstellt werden.' } });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const cleanedHeaderElements = stripBlobUrls(formData.header_elements) as LetterCanvasElement[];
    const cleanedFooterBlocks = stripBlobUrls(formData.footer_blocks);
    const cleanedLayoutSettings = stripBlobUrlsFromLayoutSettings(normalizeLayoutBlockContentImages(formData.layout_settings));
    try {
      const updateData: Record<string, unknown> = {
        name: formData.name.trim(), letterhead_html: formData.letterhead_html, letterhead_css: formData.letterhead_css,
        response_time_days: formData.response_time_days, default_sender_id: formData.default_sender_id || null,
        default_info_blocks: formData.default_info_blocks.length > 0 ? formData.default_info_blocks : null,
        header_layout_type: cleanedHeaderElements.length > 0 ? 'structured' : 'html',
        header_text_elements: cleanedHeaderElements.length > 0 ? cleanedHeaderElements : null,
        footer_blocks: Array.isArray(cleanedFooterBlocks) ? (cleanedFooterBlocks.length > 0 ? cleanedFooterBlocks : null) : cleanedFooterBlocks,
        layout_settings: cleanedLayoutSettings, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('letter_templates').update(updateData as typeof updateData & { name: string }).eq('id', editingTemplate.id);
      if (error) throw error;
      toast({ title: "Template aktualisiert" });
      setEditingTemplate(null); resetForm(); fetchTemplates();
    } catch (error) {
      handleAppError(error, { context: 'handleUpdateTemplate', toast: { fn: toast, title: 'Fehler', description: 'Template konnte nicht aktualisiert werden.' } });
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
      handleAppError(error, { context: 'handleDeleteTemplate', toast: { fn: toast, title: 'Fehler', description: 'Template konnte nicht gelöscht werden.' } });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', letterhead_html: '', letterhead_css: '', response_time_days: 21,
      default_sender_id: '', default_info_blocks: [], header_elements: [], footer_blocks: [],
      layout_settings: {
        ...DEFAULT_DIN5008_LAYOUT,
        blockContent: { ...(DEFAULT_DIN5008_LAYOUT.blockContent || {}), attachments: createDefaultAttachmentElements() },
      },
    });
  };

  const startEditing = (template: LetterTemplate) => {
    setEditingTemplate(template);
    setActiveTab('canvas-designer');
    let headerElements: LetterCanvasElement[] = [];
    if (template.header_text_elements) {
      if (typeof template.header_text_elements === 'string') {
        try {
          const parsed = JSON.parse(template.header_text_elements) as unknown;
          headerElements = isLetterCanvasElementArray(parsed) ? parsed : [];
        } catch {
          headerElements = [];
        }
      } else if (isLetterCanvasElementArray(template.header_text_elements)) {
        headerElements = template.header_text_elements;
      }
    }
    let rawFooterBlocks: unknown = [];
    if (template.footer_blocks) {
      if (typeof template.footer_blocks === 'string') { try { rawFooterBlocks = JSON.parse(template.footer_blocks); } catch { rawFooterBlocks = []; } }
      else { rawFooterBlocks = template.footer_blocks; }
    }
    const footerLines = parseFooterLinesForEditor(rawFooterBlocks);
    const normalizedLayoutSettings = normalizeLayoutBlockContentImages(template.layout_settings || DEFAULT_DIN5008_LAYOUT);
    const bc = normalizedLayoutSettings.blockContent || {};
    const legacyHeaderElements = bc.header;
    const headerSource = headerElements.length > 0 ? headerElements : (isLetterCanvasElementArray(legacyHeaderElements) ? legacyHeaderElements : []);
    const normalizedHeader = headerSource.map(normalizeImageItem);
    const normalizedFooter = footerLines.map(normalizeImageItem);
    const cleanedBlockContent = { ...bc };
    delete cleanedBlockContent.header;
    if (!Array.isArray(cleanedBlockContent.attachments) || cleanedBlockContent.attachments.length === 0) {
      cleanedBlockContent.attachments = createDefaultAttachmentElements();
    }
    const footerData = toFooterLineData(normalizedFooter);
    setFormData({
      name: template.name, letterhead_html: template.letterhead_html, letterhead_css: template.letterhead_css,
      response_time_days: template.response_time_days, default_sender_id: template.default_sender_id || '',
      default_info_blocks: template.default_info_blocks || [],
      header_elements: normalizedHeader,
      footer_blocks: footerData,
      layout_settings: { ...normalizedLayoutSettings, blockContent: { ...cleanedBlockContent, footer: footerData } },
    });
  };

  const cancelEditing = () => { setEditingTemplate(null); setActiveTab('canvas-designer'); resetForm(); };

  const updateLayoutSettings = (updater: (layout: LetterLayoutSettings) => LetterLayoutSettings) => {
    setFormData((prev) => ({ ...prev, layout_settings: updater(prev.layout_settings) }));
  };

  const getBlockItems = (blockKey: BlockEditorKey): unknown => {
    const content = formData.layout_settings.blockContent || {};
    return content[blockKey] || [];
  };

  const setBlockItems = (blockKey: BlockEditorKey, items: unknown) => {
    updateLayoutSettings((layout) => {
      const current = layout.blockContent || {};
      const normalizedItems: BlockContentEntry =
        isLineModeBlockData(items)
          ? items
          : isLetterCanvasElementArray(items)
            ? items
            : [];
      return { ...layout, blockContent: { ...current, [blockKey]: normalizedItems } };
    });
  };

  return {
    templates, senderInfos, infoBlocks, loading,
    editingTemplate, setEditingTemplate,
    showCreateDialog, setShowCreateDialog,
    activeTab, setActiveTab,
    selectedBlockItem, setSelectedBlockItem,
    showBlockRuler, setShowBlockRuler,
    showPreview, setShowPreview,
    selectedGalleryImage, setSelectedGalleryImage,
    showSettings, setShowSettings,
    galleryImages, setGalleryImages,
    galleryLoading, setGalleryLoading,
    galleryBlobUrlsRef,
    formData, setFormData,
    currentTenant, user, toast,
    fetchTemplates,
    handleCreateTemplate, handleUpdateTemplate, handleDeleteTemplate,
    resetForm, startEditing, cancelEditing,
    updateLayoutSettings, getBlockItems, setBlockItems,
    stripBlobUrls,
  };
}
