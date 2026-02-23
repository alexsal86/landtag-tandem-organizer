import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, FolderOpen, Square, Circle, Minus, Flower2, LayoutGrid, Ruler, Crosshair, Undo2, Redo2, Keyboard, Copy, ClipboardPaste, CopyPlus, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { BlockElement, HeaderElement, ImageElement, ResizeHandle, ShapeElement, ShapeType, TextElement } from '@/components/canvas-engine/types';
import { getElementDimensions } from '@/components/canvas-engine/utils/geometry';
import { alignElements, distributeElements, type AlignAxis, type DistributeAxis } from '@/components/canvas-engine/utils/align';
import { useCanvasHistory } from '@/components/canvas-engine/hooks/useCanvasHistory';
import { useCanvasSelection } from '@/components/canvas-engine/hooks/useCanvasSelection';
import { useCanvasViewport } from '@/components/canvas-engine/hooks/useCanvasViewport';
import { getElementIconFromRegistry, getElementLabelFromRegistry } from '@/components/letters/elements/registry';
import { ImageCanvasElement, TextCanvasElement } from '@/components/letters/elements/canvasElements';

interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
  actionButtons?: React.ReactNode;
}

const createElementId = () => crypto.randomUUID();

const getShapeFillColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.fillColor ?? element.color ?? fallback) : fallback;

const getShapeStrokeColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.strokeColor ?? element.color ?? fallback) : fallback;

// Sunflower SVG inline component
const SunflowerSVG: React.FC<{ width: number; height: number; className?: string }> = ({ width, height, className }) => (
  <svg width={width} height={height} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g fill="#22c55e" stroke="#15803d" strokeWidth="0.5">
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={`o${i}`} cx="32" cy="12" rx="4" ry="8" transform={`rotate(${i * 30} 32 32)`} />
      ))}
    </g>
    <g fill="#34d399" stroke="#15803d" strokeWidth="0.3">
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse key={`i${i}`} cx="32" cy="16" rx="3" ry="6" transform={`rotate(${15 + i * 30} 32 32)`} />
      ))}
    </g>
    <circle cx="32" cy="32" r="10" fill="#16a34a" stroke="#15803d" strokeWidth="1" />
    <g fill="#0f5132">
      <circle cx="32" cy="32" r="1" />
      <circle cx="29" cy="29" r="0.8" /><circle cx="35" cy="29" r="0.8" />
      <circle cx="29" cy="35" r="0.8" /><circle cx="35" cy="35" r="0.8" />
      <circle cx="26" cy="32" r="0.6" /><circle cx="38" cy="32" r="0.6" />
      <circle cx="32" cy="26" r="0.6" /><circle cx="32" cy="38" r="0.6" />
    </g>
  </svg>
);

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({ initialElements = [], onElementsChange, actionButtons }) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const {
    elements,
    setElements,
    applyElements,
    pushHistorySnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasHistory<HeaderElement>(initialElements);
  const {
    selectedElementId,
    setSelectedElementId,
    selectedElementIds,
    setSelectedElementIds,
    selectOne,
    setSelection,
    toggleSelect,
    clearSelection,
  } = useCanvasSelection();
  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const [smartGuideDistance, setSmartGuideDistance] = useState<{ horizontal?: number; vertical?: number }>({});
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [clipboardElement, setClipboardElement] = useState<HeaderElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const dragInitialElementsRef = useRef<HeaderElement[] | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const snapLinesTimeoutRef = useRef<number | null>(null);
  const lastReportedRef = useRef<HeaderElement[]>(initialElements);
  const selectionInitialIdsRef = useRef<string[]>([]);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Resize state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    ow: number;
    oh: number;
    handle: ResizeHandle;
    group?: {
      baseWidth: number;
      baseHeight: number;
      left: number;
      top: number;
      right: number;
      bottom: number;
      items: Record<string, { x: number; y: number; width: number; height: number }>;
    };
  } | null>(null);
  const resizeInitialElementsRef = useRef<HeaderElement[] | null>(null);

  // Image gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Blob URL mapping
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const [previewWidth, setPreviewWidth] = useState(780);
  const previewHeight = Math.round((previewWidth * headerMaxHeight) / headerMaxWidth);
  const previewScaleX = previewWidth / headerMaxWidth;
  const previewScaleY = previewHeight / headerMaxHeight;
  const SNAP_MM = 1.5;

  const {
    zoom,
    setZoom,
    pan,
    setPan,
    getCanvasPoint,
    getViewportPoint,
    zoomAtPoint,
  } = useCanvasViewport({ previewWidth, previewHeight });

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updatePreviewSize = () => {
      if (!previewContainerRef.current) return;
      const rulerOffset = showRuler ? 28 : 0;
      const nextWidth = Math.min(780, Math.max(360, Math.floor(previewContainerRef.current.clientWidth - 16 - rulerOffset)));
      setPreviewWidth(nextWidth);
    };

    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [showRuler]);

  useEffect(() => {
    if (!showRuler) return;

    const hCanvas = horizontalRulerRef.current;
    const vCanvas = verticalRulerRef.current;
    if (!hCanvas || !vCanvas) return;

    const hCtx = hCanvas.getContext('2d');
    const vCtx = vCanvas.getContext('2d');
    if (!hCtx || !vCtx) return;

    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    hCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    for (let i = 0; i <= 210; i += 1) {
      const x = (i * previewWidth) / 210;
      const tickHeight = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      hCtx.beginPath();
      hCtx.moveTo(x, hCanvas.height);
      hCtx.lineTo(x, hCanvas.height - tickHeight);
      hCtx.stroke();
    }

    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);
    vCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    for (let i = 0; i <= 45; i += 1) {
      const y = (i * previewHeight) / 45;
      const tickWidth = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      vCtx.beginPath();
      vCtx.moveTo(vCanvas.width, y);
      vCtx.lineTo(vCanvas.width - tickWidth, y);
      vCtx.stroke();
    }
  }, [previewHeight, previewWidth, showRuler]);

  // Resolve blob URL
  const resolveBlobUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const cached = blobUrlMapRef.current.get(storagePath);
    if (cached) return cached;
    try {
      const { data } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
      if (!data?.publicUrl) return null;
      blobUrlMapRef.current.set(storagePath, data.publicUrl);
      return data.publicUrl;
    } catch { return null; }
  }, []);

  useEffect(() => {
    const resolveAll = async () => {
      const updated = await Promise.all(elements.map(async (el) => {
        if (el.type !== 'image' || !el.storagePath || el.blobUrl) return el;
        const blobUrl = await resolveBlobUrl(el.storagePath);
        if (!blobUrl) return el;
        return { ...el, blobUrl };
      }));
      const changed = updated.some((el, idx) => el !== elements[idx]);
      if (changed) setElements(updated);
    };
    resolveAll();
  }, []);

  const loadGalleryImages = useCallback(async () => {
    if (!currentTenant?.id) return;
    setGalleryLoading(true);
    try {
      const folderPath = `${currentTenant.id}/header-images`;
      const { data: files, error } = await supabase.storage.from('letter-assets').list(folderPath);
      if (error) return;
      const imageFiles = (files || []).filter(f => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name));
      const loaded: GalleryImage[] = [];
      for (const file of imageFiles) {
        const filePath = `${folderPath}/${file.name}`;
        try {
          const { data: urlData } = supabase.storage.from('letter-assets').getPublicUrl(filePath);
          if (!urlData?.publicUrl) continue;
          blobUrlMapRef.current.set(filePath, urlData.publicUrl);
          loaded.push({ name: file.name, path: filePath, blobUrl: urlData.publicUrl });
        } catch (e) { console.error('Error downloading', file.name, e); }
      }
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return loaded;
      });
    } catch (error) { console.error('Error loading gallery:', error); }
    finally { setGalleryLoading(false); }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadGalleryImages();
    return () => {
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return [];
      });
      blobUrlMapRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlMapRef.current.clear();
    };
  }, [currentTenant?.id, loadGalleryImages]);

  const snapToOtherElements = (id: string, x: number, y: number, allElements: HeaderElement[]) => {
    const current = allElements.find((el) => el.id === id);
    if (!current) return { x, y, guides: {} as { x?: number; y?: number } };
    let sx = x, sy = y;
    const w = current.width || 50, h = current.height || 10;
    const guides: { x?: number; y?: number } = {};
    const edgeTargets = allElements.filter((el) => el.id !== id).flatMap((el) => {
      const tw = el.width || 50, th = el.height || 10;
      return [{ x: el.x, y: el.y }, { x: el.x + tw, y: el.y + th }, { x: el.x + tw / 2, y: el.y + th / 2 }];
    });
    for (const t of edgeTargets) {
      if (Math.abs(sx - t.x) <= SNAP_MM) { sx = t.x; guides.x = t.x; }
      if (Math.abs(sx + w - t.x) <= SNAP_MM) { sx = t.x - w; guides.x = t.x; }
      if (Math.abs(sx + w / 2 - t.x) <= SNAP_MM) { sx = t.x - w / 2; guides.x = t.x; }
      if (Math.abs(sy - t.y) <= SNAP_MM) { sy = t.y; guides.y = t.y; }
      if (Math.abs(sy + h - t.y) <= SNAP_MM) { sy = t.y - h; guides.y = t.y; }
      if (Math.abs(sy + h / 2 - t.y) <= SNAP_MM) { sy = t.y - h / 2; guides.y = t.y; }
    }
    const centerX = headerMaxWidth / 2;
    const centerY = headerMaxHeight / 2;
    const axisTargetsX = [0, centerX, headerMaxWidth];
    const axisTargetsY = [0, centerY, headerMaxHeight];
    for (const tx of axisTargetsX) {
      if (Math.abs(sx - tx) <= SNAP_MM) { sx = tx; guides.x = tx; }
      if (Math.abs(sx + w - tx) <= SNAP_MM) { sx = tx - w; guides.x = tx; }
      if (Math.abs(sx + w / 2 - tx) <= SNAP_MM) { sx = tx - w / 2; guides.x = tx; }
    }
    for (const ty of axisTargetsY) {
      if (Math.abs(sy - ty) <= SNAP_MM) { sy = ty; guides.y = ty; }
      if (Math.abs(sy + h - ty) <= SNAP_MM) { sy = ty - h; guides.y = ty; }
      if (Math.abs(sy + h / 2 - ty) <= SNAP_MM) { sy = ty - h / 2; guides.y = ty; }
    }
    return { x: Math.round(sx), y: Math.round(sy), guides };
  };

  useEffect(() => {
    return () => {
      if (snapLinesTimeoutRef.current) {
        window.clearTimeout(snapLinesTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (elements !== lastReportedRef.current) {
      lastReportedRef.current = elements;
      onElementsChange(elements);
    }
  }, [elements, onElementsChange]);

  const uploadImage = async (file: File): Promise<{ publicUrl: string; storagePath: string; blobUrl: string } | null> => {
    try {
      if (!currentTenant?.id) { toast({ title: 'Fehler', description: 'Kein Mandant gefunden', variant: 'destructive' }); return null; }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;
      const { data, error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      const blobUrl = URL.createObjectURL(file);
      blobUrlMapRef.current.set(filePath, blobUrl);
      await loadGalleryImages();
      return { publicUrl, storagePath: filePath, blobUrl };
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
    }
  };

  const handleGalleryUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadImage(file);
      toast({ title: 'Bild hochgeladen' });
    };
    input.click();
  };

  const addImageFromGallery = (galleryImg: GalleryImage) => {
    const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(galleryImg.path);
    const newElement: HeaderElement = {
      id: createElementId(), type: 'image', x: 20, y: 10, width: 40, height: 20,
      imageUrl: publicUrl, blobUrl: galleryImg.blobUrl, storagePath: galleryImg.path, preserveAspectRatio: true,
    };
    applyElements(prev => [...prev, newElement]);
    selectOne(newElement.id);
  };

  const deleteGalleryImage = async (galleryImg: GalleryImage) => {
    try {
      const { error } = await supabase.storage.from('letter-assets').remove([galleryImg.path]);
      if (error) { toast({ title: 'Fehler', description: `Löschen fehlgeschlagen: ${error.message}`, variant: 'destructive' }); return; }
      URL.revokeObjectURL(galleryImg.blobUrl);
      blobUrlMapRef.current.delete(galleryImg.path);
      await loadGalleryImages();
      toast({ title: 'Bild gelöscht' });
    } catch (error: any) {
      toast({ title: 'Fehler', description: `Bild konnte nicht gelöscht werden: ${error?.message || 'Unbekannter Fehler'}`, variant: 'destructive' });
    }
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const el: HeaderElement = { id: createElementId(), type: 'text', x, y, content, fontSize: 12, fontFamily: 'Arial', fontWeight: 'normal', color: '#000000', textLineHeight: 1.2, width: 70, height: 8 };
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const result = await uploadImage(file);
      if (!result) return;
      const el: HeaderElement = { id: createElementId(), type: 'image', x: 20, y: 10, width: 40, height: 20, imageUrl: result.publicUrl, blobUrl: result.blobUrl, storagePath: result.storagePath, preserveAspectRatio: true };
      applyElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
      setSelectedElementIds([el.id]);
    };
    input.click();
  };

  const addShapeElement = (shapeType: ShapeType) => {
    const defaultsByType: Record<ShapeType, Partial<ShapeElement>> = {
      line: { width: 50, height: 1, fillColor: 'transparent', strokeColor: '#000000', strokeWidth: 2 },
      circle: { width: 20, height: 20, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 1 },
      rectangle: { width: 40, height: 20, fillColor: '#3b82f6', strokeColor: '#1e40af', strokeWidth: 1, borderRadius: 0 },
      sunflower: { width: 25, height: 25, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 0 },
    };
    const defaults = defaultsByType[shapeType];
    const el: HeaderElement = { id: createElementId(), type: 'shape', shapeType, x: 20, y: 10, rotation: 0, ...defaults };
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const createBlockElement = (x = 10, y = 25) => {
    const blockNumber = elements.filter((el) => el.type === 'block').length + 1;
    const el: HeaderElement = {
      id: createElementId(), type: 'block', x, y, width: 45, height: 18,
      blockTitle: `Block ${blockNumber}`,
      blockContent: '', blockFontSize: 9, blockFontFamily: 'Arial', blockFontWeight: 'normal', blockColor: '#000000', blockLineHeight: 1,
    };
    return el;
  };

  const addBlockElement = () => {
    const el = createBlockElement();
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>, options?: { recordHistory?: boolean }) => {
    applyElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el), options);
  };

  const removeElement = (id: string) => {
    applyElements(prev => prev.filter(el => el.id !== id));
    setSelectedElementIds((previous) => previous.filter((selectedId) => selectedId !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const removeSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    applyElements((prev) => prev.filter((el) => !selectedElementIds.includes(el.id)));
    clearSelection();
  };

  const onToolDragStart = (event: React.DragEvent, tool: string) => {
    event.dataTransfer.setData('application/x-header-tool', tool);
    event.dataTransfer.effectAllowed = 'copy';
    const dragPreview = document.createElement('div');
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-9999px';
    dragPreview.style.left = '-9999px';
    dragPreview.style.padding = '8px 10px';
    dragPreview.style.border = '1px solid #16a34a';
    dragPreview.style.borderRadius = '6px';
    dragPreview.style.background = '#ffffff';
    dragPreview.style.fontFamily = 'Arial, sans-serif';
    dragPreview.style.fontSize = '13px';
    dragPreview.style.color = '#111827';
    dragPreview.style.maxWidth = '240px';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dragPreview.textContent = tool === 'text' ? 'Lorem ipsum dolor sit amet' : 'Block\nDirekt auf der Canvas bearbeiten';
    dragPreview.style.whiteSpace = 'pre-line';
    document.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(dragPreview, 12, 12);
    requestAnimationFrame(() => dragPreview.remove());
  };

  const onGalleryDragStart = (event: React.DragEvent, galleryImg: GalleryImage) => {
    event.dataTransfer.setData('application/x-gallery-image', JSON.stringify({ path: galleryImg.path, blobUrl: galleryImg.blobUrl }));
    event.dataTransfer.effectAllowed = 'copy';
    const imgEl = event.target as HTMLImageElement;
    if (imgEl) event.dataTransfer.setDragImage(imgEl, imgEl.width / 2, imgEl.height / 2);
  };

  const onPreviewDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!previewRef.current) return;
    const point = getCanvasPoint(previewRef.current, event.clientX, event.clientY);
    const x = Math.max(0, Math.min(headerMaxWidth, point.x / previewScaleX));
    const y = Math.max(0, Math.min(headerMaxHeight, point.y / previewScaleY));

    const tool = event.dataTransfer.getData('application/x-header-tool');
    if (tool === 'text') { addTextElement(Math.round(x), Math.round(y)); return; }
    if (tool === 'block') {
      const el = createBlockElement(Math.round(x), Math.round(y));
      applyElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
      return;
    }

    const galleryData = event.dataTransfer.getData('application/x-gallery-image');
    if (galleryData) {
      try {
        const { path, blobUrl } = JSON.parse(galleryData);
        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(path);
        const el: HeaderElement = { id: createElementId(), type: 'image', x: Math.round(x), y: Math.round(y), width: 40, height: 20, imageUrl: publicUrl, blobUrl, storagePath: path, preserveAspectRatio: true };
        applyElements(prev => [...prev, el]);
        setSelectedElementId(el.id);
        setSelectedElementIds([el.id]);
      } catch (e) { console.error('Error parsing gallery drop data:', e); }
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);
  const isElementSelected = (id: string) => selectedElementIds.includes(id);
  const selectedCount = selectedElementIds.length;
  const isToggleModifierPressed = (event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => Boolean(event.shiftKey || event.metaKey || event.ctrlKey);

  const onElementMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    if (editingTextId === element.id || editingBlockId === element.id) {
      return;
    }
    event.stopPropagation();

    if (isToggleModifierPressed(event)) {
      toggleSelect(element.id);
      return;
    }

    const activeSelection = selectedElementIds.includes(element.id)
      ? selectedElementIds
      : [element.id];
    const origins = activeSelection.reduce<Record<string, { x: number; y: number }>>((acc, id) => {
      const current = elements.find((el) => el.id === id);
      if (current) acc[id] = { x: current.x, y: current.y };
      return acc;
    }, {});

    setSelection(activeSelection);
    setDragId(element.id);
    dragInitialElementsRef.current = elements;
    setDragStart({ x: event.clientX, y: event.clientY, origins });
  };

  const onResizeMouseDown = (event: React.MouseEvent, element: HeaderElement, handle: ResizeHandle = 'se') => {
    event.stopPropagation(); event.preventDefault();
    setResizingId(element.id);
    resizeInitialElementsRef.current = elements;

    const activeIds = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
    if (activeIds.length > 1) {
      const selected = elements
        .filter((el) => activeIds.includes(el.id))
        .map((el) => {
          const { width, height } = getElementDimensions(el);
          return { ...el, width, height };
        });
      const left = Math.min(...selected.map((el) => el.x));
      const top = Math.min(...selected.map((el) => el.y));
      const right = Math.max(...selected.map((el) => el.x + el.width));
      const bottom = Math.max(...selected.map((el) => el.y + el.height));
      const items = selected.reduce<Record<string, { x: number; y: number; width: number; height: number }>>((acc, item) => {
        acc[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
        return acc;
      }, {});

      setResizeStart({
        x: event.clientX,
        y: event.clientY,
        ow: element.width || 50,
        oh: element.height || 30,
        handle,
        group: {
          baseWidth: Math.max(1, right - left),
          baseHeight: Math.max(1, bottom - top),
          left,
          top,
          right,
          bottom,
          items,
        },
      });
      return;
    }

    setResizeStart({ x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30, handle });
  };

  useEffect(() => {
    if (!dragId && !resizingId) return;
    const handler = () => onPreviewMouseUp();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragId, resizingId]);

  const onPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;

    if (event.button === 1 || (event.button === 0 && isSpacePressed)) {
      event.preventDefault();
      setIsPanning(true);
      panStartRef.current = { clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    const startPoint = getViewportPoint(previewRef.current, event.clientX, event.clientY);
    const startX = startPoint.x;
    const startY = startPoint.y;

    const appendSelection = isToggleModifierPressed(event);
    selectionInitialIdsRef.current = appendSelection ? selectedElementIds : [];
    if (!appendSelection) {
      setSelectedElementId(null);
      setSelectedElementIds([]);
    }
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
  };

  const onPreviewMouseMove = (event: React.MouseEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = event.clientX - panStartRef.current.clientX;
      const dy = event.clientY - panStartRef.current.clientY;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
      return;
    }

    if (selectionBox && previewRef.current) {
      const currentPoint = getViewportPoint(previewRef.current, event.clientX, event.clientY);
      const currentX = currentPoint.x;
      const currentY = currentPoint.y;
      const nextSelection = { ...selectionBox, currentX, currentY };
      setSelectionBox(nextSelection);

      const leftPx = Math.min(nextSelection.startX, nextSelection.currentX);
      const rightPx = Math.max(nextSelection.startX, nextSelection.currentX);
      const topPx = Math.min(nextSelection.startY, nextSelection.currentY);
      const bottomPx = Math.max(nextSelection.startY, nextSelection.currentY);

      const left = Math.max(0, Math.min(headerMaxWidth, ((leftPx - pan.x) / zoom) / previewScaleX));
      const right = Math.max(0, Math.min(headerMaxWidth, ((rightPx - pan.x) / zoom) / previewScaleX));
      const top = Math.max(0, Math.min(headerMaxHeight, ((topPx - pan.y) / zoom) / previewScaleY));
      const bottom = Math.max(0, Math.min(headerMaxHeight, ((bottomPx - pan.y) / zoom) / previewScaleY));

      const hits = elements
        .filter((element) => {
          const { width, height } = getElementDimensions(element);
          const elementLeft = element.x;
          const elementRight = element.x + width;
          const elementTop = element.y;
          const elementBottom = element.y + height;
          if (event.altKey) {
            return elementLeft >= left && elementRight <= right && elementTop >= top && elementBottom <= bottom;
          }
          return !(elementRight < left || elementLeft > right || elementBottom < top || elementTop > bottom);
        })
        .map((element) => element.id);

      const mergedSelection = Array.from(new Set([...selectionInitialIdsRef.current, ...hits]));
      setSelection(mergedSelection);
      return;
    }

    if (resizingId && resizeStart) {
      const resizingElement = elements.find((el) => el.id === resizingId);
      const dx = (event.clientX - resizeStart.x) / (previewScaleX * zoom);
      const dy = (event.clientY - resizeStart.y) / (previewScaleY * zoom);
      let newW = Math.max(5, resizeStart.ow + dx);
      let newH = Math.max(5, resizeStart.oh + dy);
      let shiftX = 0;
      let shiftY = 0;

      if (resizeStart.handle.includes('w')) {
        newW = Math.max(5, resizeStart.ow - dx);
        shiftX = resizeStart.ow - newW;
      }
      if (resizeStart.handle.includes('n')) {
        newH = Math.max(5, resizeStart.oh - dy);
        shiftY = resizeStart.oh - newH;
      }
      if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
        newW = resizeStart.ow;
      }
      if (resizeStart.handle === 'e' || resizeStart.handle === 'w') {
        newH = resizeStart.oh;
      }

      const preserveAspect = Boolean(event.ctrlKey || (resizingElement?.type === 'image' && resizingElement.preserveAspectRatio));
      if (preserveAspect && resizeStart.ow > 0 && resizeStart.oh > 0) {
        const ratio = resizeStart.ow / resizeStart.oh;
        if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
          newW = newH * ratio;
        } else {
          newH = newW / ratio;
        }
      }

      if (resizeStart.group) {
        const nextLeft = resizeStart.handle.includes('w') ? resizeStart.group.left + dx : resizeStart.group.left;
        const nextTop = resizeStart.handle.includes('n') ? resizeStart.group.top + dy : resizeStart.group.top;
        const nextRight = resizeStart.handle.includes('e') ? resizeStart.group.right + dx : resizeStart.group.right;
        const nextBottom = resizeStart.handle.includes('s') ? resizeStart.group.bottom + dy : resizeStart.group.bottom;

        let groupWidth = Math.max(5, nextRight - nextLeft);
        let groupHeight = Math.max(5, nextBottom - nextTop);
        if (preserveAspect) {
          const groupRatio = resizeStart.group.baseWidth / resizeStart.group.baseHeight;
          if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
            groupWidth = groupHeight * groupRatio;
          } else {
            groupHeight = groupWidth / groupRatio;
          }
        }

        const scaleX = groupWidth / resizeStart.group.baseWidth;
        const scaleY = groupHeight / resizeStart.group.baseHeight;
        const originX = resizeStart.handle.includes('w') ? resizeStart.group.right - groupWidth : resizeStart.group.left;
        const originY = resizeStart.handle.includes('n') ? resizeStart.group.bottom - groupHeight : resizeStart.group.top;

        applyElements((prev) => prev.map((el) => {
          const source = resizeStart.group?.items[el.id];
          if (!source) return el;
          const relativeX = source.x - resizeStart.group!.left;
          const relativeY = source.y - resizeStart.group!.top;
          return {
            ...el,
            x: Math.max(0, Math.min(headerMaxWidth, Math.round(originX + relativeX * scaleX))),
            y: Math.max(0, Math.min(headerMaxHeight, Math.round(originY + relativeY * scaleY))),
            width: Math.max(5, Math.round(source.width * scaleX)),
            height: Math.max(5, Math.round(source.height * scaleY)),
          };
        }), { recordHistory: false });
        return;
      }

      updateElement(resizingId, {
        x: resizingElement ? Math.max(0, Math.min(headerMaxWidth, Math.round(resizingElement.x + shiftX))) : undefined,
        y: resizingElement ? Math.max(0, Math.min(headerMaxHeight, Math.round(resizingElement.y + shiftY))) : undefined,
        width: Math.round(newW),
        height: Math.round(newH),
      }, { recordHistory: false });
      return;
    }
    if (!dragId || !dragStart) return;
    const dx = (event.clientX - dragStart.x) / (previewScaleX * zoom);
    const dy = (event.clientY - dragStart.y) / (previewScaleY * zoom);
    const origin = dragStart.origins[dragId];
    if (!origin) return;
    const nx = Math.max(0, Math.min(headerMaxWidth, origin.x + dx));
    const ny = Math.max(0, Math.min(headerMaxHeight, origin.y + dy));
    const snapped = snapToOtherElements(dragId, nx, ny, elements);
    flashSnapLines(snapped.guides);
    calculateSmartGuideDistances(dragId, snapped.x, snapped.y, elements);
    const offsetX = snapped.x - origin.x;
    const offsetY = snapped.y - origin.y;

    applyElements((prev) => prev.map((el) => {
      const selectedOrigin = dragStart.origins[el.id];
      if (!selectedOrigin) return el;
      return {
        ...el,
        x: Math.max(0, Math.min(headerMaxWidth, Math.round(selectedOrigin.x + offsetX))),
        y: Math.max(0, Math.min(headerMaxHeight, Math.round(selectedOrigin.y + offsetY))),
      };
    }), { recordHistory: false });
  };

  const onPreviewMouseUp = () => {
    const dragInitialSnapshot = dragInitialElementsRef.current;
    const resizeInitialSnapshot = resizeInitialElementsRef.current;

    if (dragInitialSnapshot) {
      setElements((current) => {
        if (dragInitialSnapshot !== current) {
          pushHistorySnapshot(dragInitialSnapshot);
        }
        return current;
      });
    }

    if (resizeInitialSnapshot) {
      setElements((current) => {
        if (resizeInitialSnapshot !== current) {
          pushHistorySnapshot(resizeInitialSnapshot);
        }
        return current;
      });
    }

    dragInitialElementsRef.current = null;
    resizeInitialElementsRef.current = null;
    setDragId(null);
    setDragStart(null);
    setResizingId(null);
    setResizeStart(null);
    setSnapLines({});
    setSmartGuideDistance({});
    setSelectionBox(null);
    setIsPanning(false);
    panStartRef.current = null;
  };

  const cycleSelection = (direction: 1 | -1) => {
    if (elements.length === 0) return;
    const currentIndex = elements.findIndex((el) => el.id === selectedElementId);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (startIndex + direction + elements.length) % elements.length;
    selectOne(elements[nextIndex].id);
  };

  const moveElementLayer = (id: string, direction: 1 | -1) => {
    applyElements((prev) => {
      const index = prev.findIndex((el) => el.id === id);
      if (index < 0) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const copySelectedElement = () => {
    if (!selectedElement) return;
    setClipboardElement({ ...selectedElement });
  };

  const pasteClipboardElement = () => {
    if (!clipboardElement) return;
    const source = clipboardElement;
    const nextX = Math.max(0, Math.min(headerMaxWidth, source.x + 10));
    const nextY = Math.max(0, Math.min(headerMaxHeight, source.y + 10));
    const pasted: HeaderElement = { ...source, id: createElementId(), x: nextX, y: nextY };
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
    setClipboardElement(pasted);
  };

  const duplicateSelectedElement = () => {
    if (!selectedElement) return;
    const source = selectedElement;
    const pasted: HeaderElement = {
      ...source,
      id: createElementId(),
      x: Math.max(0, Math.min(headerMaxWidth, source.x + 10)),
      y: Math.max(0, Math.min(headerMaxHeight, source.y + 10)),
    };
    setClipboardElement({ ...source });
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
  };

  const canPasteFromClipboard = Boolean(clipboardElement);
  const selectedIndex = selectedElement ? elements.findIndex((el) => el.id === selectedElement.id) : -1;
  const canMoveLayerBackward = selectedIndex > 0;
  const canMoveLayerForward = selectedIndex >= 0 && selectedIndex < elements.length - 1;
  const canAlignSelection = selectedElementIds.length > 1;
  const canDistributeSelection = selectedElementIds.length > 2;

  const flashSnapLines = (guides: { x?: number; y?: number }) => {
    if (!guides.x && !guides.y) {
      return;
    }
    setSnapLines(guides);
    if (snapLinesTimeoutRef.current) {
      window.clearTimeout(snapLinesTimeoutRef.current);
    }
    snapLinesTimeoutRef.current = window.setTimeout(() => {
      setSnapLines({});
      snapLinesTimeoutRef.current = null;
    }, 600);
  };
  const calculateSmartGuideDistances = (movingId: string, x: number, y: number, allElements: HeaderElement[]) => {
    const moving = allElements.find((el) => el.id === movingId);
    if (!moving) {
      setSmartGuideDistance({});
      return;
    }
    const { width, height } = getElementDimensions(moving);
    const movingCenterX = x + width / 2;
    const movingCenterY = y + height / 2;

    let nearestHorizontal: number | undefined;
    let nearestVertical: number | undefined;

    allElements.forEach((el) => {
      if (el.id === movingId) return;
      const { width: w, height: h } = getElementDimensions(el);
      const centerX = el.x + w / 2;
      const centerY = el.y + h / 2;
      const dx = Math.abs(movingCenterX - centerX);
      const dy = Math.abs(movingCenterY - centerY);
      if (nearestHorizontal == null || dx < nearestHorizontal) nearestHorizontal = dx;
      if (nearestVertical == null || dy < nearestVertical) nearestVertical = dy;
    });

    setSmartGuideDistance({
      horizontal: nearestHorizontal != null ? Math.round(nearestHorizontal) : undefined,
      vertical: nearestVertical != null ? Math.round(nearestVertical) : undefined,
    });
  };



  const alignSelection = (axis: AlignAxis) => {
    applyElements((prev) => alignElements(prev, axis, {
      selectedElementIds,
      headerMaxWidth,
      headerMaxHeight,
    }));
  };

  const distributeSelection = (axis: DistributeAxis) => {
    applyElements((prev) => distributeElements(prev, axis, {
      selectedElementIds,
      headerMaxWidth,
      headerMaxHeight,
    }));
  };


  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target?.isContentEditable || editingTextId || editingBlockId) {
      return;
    }

    const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    if (isUndo) {
      event.preventDefault();
      undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      redo();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '?') {
      event.preventDefault();
      setShowShortcutsHelp((previous) => !previous);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelectedElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      pasteClipboardElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelectedElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === ']') {
      if (selectedElement) {
        event.preventDefault();
        moveElementLayer(selectedElement.id, 1);
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === '[') {
      if (selectedElement) {
        event.preventDefault();
        moveElementLayer(selectedElement.id, -1);
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      cycleSelection(event.shiftKey ? -1 : 1);
      return;
    }

    if (!selectedElement) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelectedElements(); return; }
    let dx = 0, dy = 0;
    if (event.key === 'ArrowLeft') dx = -1;
    if (event.key === 'ArrowRight') dx = 1;
    if (event.key === 'ArrowUp') dy = -1;
    if (event.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    event.preventDefault();

    applyElements((prev) => prev.map((el) => {
      if (!selectedElementIds.includes(el.id)) return el;
      return {
        ...el,
        x: Math.max(0, Math.min(headerMaxWidth, el.x + dx)),
        y: Math.max(0, Math.min(headerMaxHeight, el.y + dy)),
      };
    }));
  };

  const onPreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    zoomAtPoint(previewRef.current, event.clientX, event.clientY, zoom + delta);
  };

  const validatePosition = (value: number, max: number) => Math.max(0, Math.min(value, max));

  const startEditingText = (element: TextElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.content || '' }));
    setEditingTextId(element.id);
  };

  const startEditingBlock = (element: BlockElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.blockContent || '' }));
    setEditingBlockId(element.id);
  };

  const cancelEditing = (id: string) => {
    setEditorDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingTextId === id) setEditingTextId(null);
    if (editingBlockId === id) setEditingBlockId(null);
  };

  const commitTextEditing = (id: string) => {
    updateElement(id, { content: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const commitBlockEditing = (id: string) => {
    updateElement(id, { blockContent: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const renderColorInput = (label: string, value: string, onChange: (color: string) => void) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-10 border-0 bg-transparent p-0 shadow-none"
        />
        <span className="text-[11px] font-mono text-muted-foreground">{value.toUpperCase()}</span>
      </div>
    </div>
  );

  const updateImageSize = (element: ImageElement, next: { width?: number; height?: number }) => {
    const baseW = Math.max(1, element.width || 1);
    const baseH = Math.max(1, element.height || 1);
    if (!element.preserveAspectRatio) {
      updateElement(element.id, next);
      return;
    }
    if (next.width != null) {
      updateElement(element.id, { width: next.width, height: Math.max(1, Math.round(next.width * (baseH / baseW))) });
      return;
    }
    if (next.height != null) {
      updateElement(element.id, { height: next.height, width: Math.max(1, Math.round(next.height * (baseW / baseH))) });
    }
  };

  const getElementLabel = (el: HeaderElement) => getElementLabelFromRegistry(el);

  const getElementAriaLabel = (el: HeaderElement) => `${getElementLabel(el)} bei x ${el.x} Millimeter, y ${el.y} Millimeter`;

  useEffect(() => {
    if (!selectedElementId) {
      setAriaAnnouncement('Keine Auswahl');
      return;
    }
    const selected = elements.find((el) => el.id === selectedElementId);
    if (!selected) return;
    setAriaAnnouncement(`Ausgewählt: ${getElementAriaLabel(selected)}`);
  }, [elements, selectedElementId]);

  const getElementIcon = (el: HeaderElement) => getElementIconFromRegistry(el);


  const renderResizeHandles = (element: HeaderElement) => {
    if (!isElementSelected(element.id)) return null;
    const handles: Array<{ key: ResizeHandle; className: string; style: React.CSSProperties }> = [
      { key: 'nw', className: 'cursor-nwse-resize', style: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
      { key: 'n', className: 'cursor-ns-resize', style: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' } },
      { key: 'ne', className: 'cursor-nesw-resize', style: { right: 0, top: 0, transform: 'translate(50%, -50%)' } },
      { key: 'e', className: 'cursor-ew-resize', style: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
      { key: 'se', className: 'cursor-nwse-resize', style: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' } },
      { key: 's', className: 'cursor-ns-resize', style: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' } },
      { key: 'sw', className: 'cursor-nesw-resize', style: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' } },
      { key: 'w', className: 'cursor-ew-resize', style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
    ];

    return handles.map((handle) => (
      <div
        key={`${element.id}-${handle.key}`}
        className={`absolute w-3 h-3 bg-primary border border-primary-foreground z-10 ${handle.className}`}
        style={handle.style}
        onMouseDown={(event) => onResizeMouseDown(event, element, handle.key)}
      />
    ));
  };

  // Render shape on canvas
  const renderShapeCanvas = (element: ShapeElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 20) * scaleX;
    const h = (element.height || 20) * scaleY;
    const isSelected = isElementSelected(element.id);
    const rotation = element.rotation || 0;

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${element.x * scaleX}px`,
      top: `${element.y * scaleY}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: rotation ? `rotate(${rotation}deg)` : undefined,
      cursor: 'move',
    };

    if (element.shapeType === 'sunflower') {
      return (
        <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}>
          <SunflowerSVG width={w} height={h} />
          {renderResizeHandles(element)}
        </div>
      );
    }

    return (
      <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`${isSelected ? 'ring-2 ring-primary ring-dashed' : ''}`}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {element.shapeType === 'line' && (
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={getShapeStrokeColor(element, '#000000')} strokeWidth={element.strokeWidth ?? 2} />
          )}
          {element.shapeType === 'circle' && (
            <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - (element.strokeWidth ?? 1)} ry={h / 2 - (element.strokeWidth ?? 1)} fill={getShapeFillColor(element, '#22c55e')} stroke={getShapeStrokeColor(element, '#15803d')} strokeWidth={element.strokeWidth ?? 1} />
          )}
          {element.shapeType === 'rectangle' && (
            <rect x={(element.strokeWidth ?? 1) / 2} y={(element.strokeWidth ?? 1) / 2} width={w - (element.strokeWidth ?? 1)} height={h - (element.strokeWidth ?? 1)} rx={element.borderRadius ?? 0} fill={getShapeFillColor(element, '#3b82f6')} stroke={getShapeStrokeColor(element, '#1e40af')} strokeWidth={element.strokeWidth ?? 1} />
          )}
        </svg>
        {renderResizeHandles(element)}
      </div>
    );
  };

  // Render block element on canvas
  const renderBlockCanvas = (element: BlockElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 45) * scaleX;
    const h = (element.height || 18) * scaleY;
    const isSelected = isElementSelected(element.id);
    const fontSize = (element.blockFontSize || 9) * (96 / 72);
    const hasContent = Boolean((element.blockContent || '').trim());
    const isEditing = editingBlockId === element.id;

    return (
      <div
        key={element.id}
        aria-label={getElementAriaLabel(element)}
        className={`absolute cursor-move border overflow-hidden ${isSelected ? 'border-primary border-dashed border-2 bg-primary/5' : 'border-gray-300 bg-gray-50/50'}`}
        style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${w}px`, height: `${h}px`, fontSize: `${fontSize}px`, fontFamily: element.blockFontFamily || 'Arial', fontWeight: element.blockFontWeight || 'normal', color: element.blockColor || '#000', lineHeight: `${element.blockLineHeight || 1}` }}
        onMouseDown={(e) => onElementMouseDown(e, element)}
        onDoubleClick={(e) => { e.stopPropagation(); startEditingBlock(element); }}
      >
        {!hasContent && <div className="font-bold text-[10px] px-1 pt-0.5 opacity-70">{element.blockTitle || 'Block'}</div>}
        {isEditing ? (
          <textarea
            className="px-1 h-full w-full resize-none border-0 bg-transparent outline-none"
            value={editorDrafts[element.id] || ''}
            autoFocus
            onChange={(e) => setEditorDrafts((prev) => ({ ...prev, [element.id]: e.target.value }))}
            onBlur={() => commitBlockEditing(element.id)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditing(element.id);
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                commitBlockEditing(element.id);
              }
            }}
          />
        ) : (
          <div className="px-1 whitespace-pre-line h-full">{element.blockContent || ''}</div>
        )}
        {renderResizeHandles(element)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5 mr-1" />Undo</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5 mr-1" />Redo</Button>
        <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowRuler(v => !v)}><Ruler className="h-3.5 w-3.5 mr-1" />Lineal</Button>
        <Button variant={showCenterGuides ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowCenterGuides(v => !v)}><Crosshair className="h-3.5 w-3.5 mr-1" />Achsen</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={copySelectedElement} disabled={!selectedElement}><Copy className="h-3.5 w-3.5 mr-1" />Kopieren</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={pasteClipboardElement} disabled={!canPasteFromClipboard}><ClipboardPaste className="h-3.5 w-3.5 mr-1" />Einfügen</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={duplicateSelectedElement} disabled={!selectedElement}><CopyPlus className="h-3.5 w-3.5 mr-1" />Duplizieren</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, -1)} disabled={!canMoveLayerBackward}><ArrowDown className="h-3.5 w-3.5 mr-1" />Ebene runter</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, 1)} disabled={!canMoveLayerForward}><ArrowUp className="h-3.5 w-3.5 mr-1" />Ebene hoch</Button>
        <Button variant={showShortcutsHelp ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowShortcutsHelp((value) => !value)}><Keyboard className="h-3.5 w-3.5 mr-1" />Shortcuts</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}>−</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>100%</Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom((value) => Math.min(3, value + 0.1))}>+</Button>
        <div className="h-7 px-2 text-xs rounded border bg-background/90 flex items-center text-muted-foreground">
          Auswahl: <span className="ml-1 font-semibold text-foreground">{selectedCount}</span>
        </div>
      </div>

      {canAlignSelection && (
        <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('left')}>Links</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('center')}>Zentrum</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('right')}>Rechts</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('top')}>Oben</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('middle')}>Mitte</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('bottom')}>Unten</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => distributeSelection('horizontal')} disabled={!canDistributeSelection}>Horizontal verteilen</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => distributeSelection('vertical')} disabled={!canDistributeSelection}>Vertikal verteilen</Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_300px] gap-6">
        {actionButtons && (
          <Card className="self-start xl:col-start-3 xl:row-start-1">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Bearbeitung</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-1 space-y-2">
              {actionButtons}
            </CardContent>
          </Card>
        )}

        {/* Tools */}
        <Card className="xl:col-start-1 xl:row-start-1">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            <Button onClick={addImageElement} className="w-full justify-start" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />Bild hochladen & einfügen
            </Button>
            {/* Draggable Text */}
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs">Text-Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            {/* Draggable Block */}
            <div draggable onDragStart={(e) => onToolDragStart(e, 'block')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            {/* Shapes */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Formen</p>
            <div className="grid grid-cols-4 gap-1">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('line')} title="Linie"><Minus className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('circle')} title="Kreis"><Circle className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('rectangle')} title="Rechteck"><Square className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('sunflower')} title="Sonnenblume"><Flower2 className="h-3.5 w-3.5" /></Button>
            </div>

          </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card className="xl:col-start-1 xl:row-start-2">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> Bilder-Galerie</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleGalleryUpload} className="h-7 px-2"><Upload className="h-3 w-3 mr-1" /> Hochladen</Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {galleryLoading ? (
              <p className="text-xs text-muted-foreground">Lade Bilder...</p>
            ) : galleryImages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Bilder hochgeladen.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.map((img) => (
                  <div key={img.path} className="relative group border rounded overflow-hidden aspect-square bg-muted/30">
                    <img src={img.blobUrl} alt={img.name} className="w-full h-full object-contain cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => onGalleryDragStart(e, img)} onClick={() => addImageFromGallery(img)} title={`${img.name} — Klicken oder ziehen`} />
                    <button onClick={(e) => { e.stopPropagation(); deleteGalleryImage(img); }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Elements list */}
        <Card className="xl:col-start-3 xl:row-start-2 xl:row-span-2">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente ({elements.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              elements.map((element) => (
                <div
                  key={element.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isElementSelected(element.id)}
                  aria-label={`Element auswählen: ${getElementLabel(element)}`}
                  className={`group p-2 border rounded cursor-pointer transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isElementSelected(element.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={(event) => {
                    if (isToggleModifierPressed(event)) {
                      toggleSelect(element.id);
                      return;
                    }
                    selectOne(element.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectOne(element.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getElementIcon(element)}
                      <span className="font-medium truncate">{getElementLabel(element)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                  <p className="text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>

                  {isElementSelected(element.id) && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">X (mm)</Label><Input type="number" value={element.x} onChange={(e) => updateElement(element.id, { x: validatePosition(parseFloat(e.target.value) || 0, headerMaxWidth) })} className="h-7 text-xs" /></div>
                        <div><Label className="text-xs">Y (mm)</Label><Input type="number" value={element.y} onChange={(e) => updateElement(element.id, { y: validatePosition(parseFloat(e.target.value) || 0, headerMaxHeight) })} className="h-7 text-xs" /></div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Label className="text-xs">Text</Label>
                          <Input value={element.content || ''} onChange={(e) => updateElement(element.id, { content: e.target.value })} placeholder="Text" className="h-7 text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.fontSize || 12} onChange={(e) => updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.color || '#000000', (color) => updateElement(element.id, { color }))}
                          </div>
                          <div><Label className="text-xs">Schriftart</Label>
                          <Select value={element.fontFamily || 'Arial'} onValueChange={(value) => updateElement(element.id, { fontFamily: value })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Calibri">Calibri</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                          </div>
                          <div><Label className="text-xs">Formatierung</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })}>U</Button>
                          </div>
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.textLineHeight || 1.2} onChange={(e) => updateElement(element.id, { textLineHeight: parseFloat(e.target.value) || 1.2 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 50} onChange={(e) => updateImageSize(element, { width: parseFloat(e.target.value) || 50 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 30} onChange={(e) => updateImageSize(element, { height: parseFloat(e.target.value) || 30 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`preserve-${element.id}`} checked={element.preserveAspectRatio || false} onCheckedChange={(checked) => updateElement(element.id, { preserveAspectRatio: checked as boolean })} />
                            <Label htmlFor={`preserve-${element.id}`} className="text-xs">Seitenverhältnis</Label>
                          </div>
                        </>
                      )}
                      {element.type === 'shape' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 20} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 20} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                          </div>
                          {element.shapeType !== 'sunflower' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {renderColorInput('Füllfarbe', getShapeFillColor(element), (fillColor) => updateElement(element.id, { fillColor }))}
                                {renderColorInput('Randfarbe', getShapeStrokeColor(element), (strokeColor) => updateElement(element.id, { strokeColor }))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div><Label className="text-xs">Strichstärke</Label><Input type="number" value={element.strokeWidth || 1} onChange={(e) => updateElement(element.id, { strokeWidth: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" min={0} max={10} /></div>
                                {element.shapeType === 'rectangle' && (
                                  <div><Label className="text-xs">Rundung</Label><Input type="number" value={element.borderRadius || 0} onChange={(e) => updateElement(element.id, { borderRadius: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" min={0} /></div>
                                )}
                              </div>
                            </>
                          )}
                          <div><Label className="text-xs">Rotation (°)</Label><Input type="number" value={element.rotation || 0} onChange={(e) => updateElement(element.id, { rotation: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                      {element.type === 'block' && (
                        <>
                          <div><Label className="text-xs">Titel</Label><Input value={element.blockTitle || ''} onChange={(e) => updateElement(element.id, { blockTitle: e.target.value })} className="h-7 text-xs" /></div>
                          <div><Label className="text-xs">Inhalt</Label><Input value={element.blockContent || ''} onChange={(e) => updateElement(element.id, { blockContent: e.target.value })} className="h-7 text-xs" /></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 45} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 45 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 18} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 18 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.blockFontSize || 9} onChange={(e) => updateElement(element.id, { blockFontSize: parseInt(e.target.value) || 9 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.blockColor || '#000000', (blockColor) => updateElement(element.id, { blockColor }))}
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.blockLineHeight || 1} onChange={(e) => updateElement(element.id, { blockLineHeight: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-start-2 xl:row-start-1 xl:row-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Header-Vorschau</CardTitle>
            <p className="text-xs text-muted-foreground">Doppelklick auf Text/Block zum Bearbeiten. Mit Mausrad + Strg/Cmd zoomen.</p>
          </CardHeader>
          <CardContent className="p-6">
            <div ref={previewContainerRef} className="flex items-start justify-center min-h-[340px] w-full">
          <div className="relative" style={{ paddingLeft: showRuler ? 28 : 0, paddingTop: showRuler ? 28 : 0 }}>
            {showRuler && (
              <>
                <div className="absolute top-0 left-7 right-0 h-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  <canvas ref={horizontalRulerRef} width={previewWidth} height={28} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 22 }).map((_, i) => (<span key={`label-x-${i}`} className="absolute top-0" style={{ left: `${(i * previewWidth) / 21}px` }}>{i * 10}</span>))}
                </div>
                <div className="absolute top-7 left-0 bottom-0 w-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  <canvas ref={verticalRulerRef} width={28} height={previewHeight} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 5 }).map((_, i) => (<span key={`label-y-${i}`} className="absolute left-0" style={{ top: `${(i * previewHeight) / 4}px` }}>{i * 10}</span>))}
                </div>
              </>
            )}

            <div
              ref={previewRef}
              tabIndex={0}
              role="application"
              aria-label="Header-Vorschau. Mit Shift- oder Cmd/Ctrl-Klick mehrfach auswählen, leere Fläche ziehen erstellt Auswahlrechteck, Alt beim Ziehen wählt nur vollständig enthaltene Elemente, mit Tab durch Elemente wechseln, mit Pfeiltasten Auswahl bewegen, Entf löscht, Strg+Z rückgängig, Strg+C/V kopiert und fügt ein, Strg+] bzw. Strg+[ ändert die Ebene, Strg+Shift+? öffnet die Shortcut-Hilfe."
              onKeyDown={onPreviewKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onMouseDown={onPreviewMouseDown}
              onWheel={onPreviewWheel}
              onDrop={onPreviewDrop}
              onMouseMove={onPreviewMouseMove}
              onMouseUp={onPreviewMouseUp}
              onClick={(e) => { if (e.target === e.currentTarget) { clearSelection(); } }}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, cursor: isPanning || isSpacePressed ? 'grab' : undefined, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
              <span className="sr-only" aria-live="polite">{ariaAnnouncement}</span>
              <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}

              {snapLines.x != null && (
                <>
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-emerald-500/90 pointer-events-none animate-pulse"
                    style={{ left: `${snapLines.x * previewScaleX}px` }}
                  />
                  <div className="absolute top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ left: `${snapLines.x * previewScaleX + 2}px` }}>
                    {Math.round(snapLines.x)}mm
                  </div>
                </>
              )}
              {snapLines.y != null && (
                <>
                  <div
                    className="absolute left-0 right-0 border-t-2 border-emerald-500/90 pointer-events-none animate-pulse"
                    style={{ top: `${snapLines.y * previewScaleY}px` }}
                  />
                  <div className="absolute left-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ top: `${snapLines.y * previewScaleY + 2}px` }}>
                    {Math.round(snapLines.y)}mm
                  </div>
                </>
              )}

              {(smartGuideDistance.horizontal != null || smartGuideDistance.vertical != null) && (
                <div className="absolute bottom-2 left-2 z-10 rounded bg-emerald-600/90 px-2 py-1 text-[10px] text-white pointer-events-none">
                  {smartGuideDistance.horizontal != null && <span>ΔX {smartGuideDistance.horizontal}mm </span>}
                  {smartGuideDistance.vertical != null && <span>ΔY {smartGuideDistance.vertical}mm</span>}
                </div>
              )}

              </div>

              {selectionBox && (
                <div
                  className="absolute border border-primary/80 bg-primary/10 pointer-events-none"
                  style={{
                    left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                    top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                    width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                    height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                  }}
                />
              )}

              {showShortcutsHelp && (
                <div className="absolute right-3 top-3 z-20 w-72 rounded-md border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
                  <div className="mb-2 font-semibold">Tastatur-Shortcuts</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><span className="font-medium text-foreground">Shift/Cmd/Ctrl + Klick</span> Mehrfachauswahl</li>
                    <li><span className="font-medium text-foreground">Leere Fläche ziehen</span> Auswahlrechteck</li>
                    <li><span className="font-medium text-foreground">Alt + Ziehen</span> Nur vollständig enthaltene Elemente</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + Mausrad</span> Zoom auf Cursor</li>
                    <li><span className="font-medium text-foreground">Leertaste + Drag / Mittlere Maustaste</span> Canvas verschieben</li>
                    <li><span className="font-medium text-foreground">Ausrichten-Leiste</span> Bei Mehrfachauswahl sichtbar</li>
                    <li><span className="font-medium text-foreground">Verteilen</span> Ab 3 selektierten Elementen</li>
                    <li><span className="font-medium text-foreground">Snap-Linien</span> Blitzen beim Einrasten kurz auf</li>
                    <li><span className="font-medium text-foreground">Smart-Guide ΔX/ΔY</span> Zeigt nächste Abstände beim Drag</li>
                    <li><span className="font-medium text-foreground">Tab / Shift+Tab</span> Auswahl wechseln</li>
                    <li><span className="font-medium text-foreground">Pfeiltasten</span> Auswahl bewegen</li>
                    <li><span className="font-medium text-foreground">Resize-Handle</span> Skaliert bei Mehrfachauswahl die Gruppe</li>
                    <li><span className="font-medium text-foreground">Entf / Backspace</span> Element löschen</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + C / V</span> Kopieren / Einfügen</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + D</span> Duplizieren</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + ] / [</span> Ebene vor / zurück</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + Shift + ?</span> Hilfe ein/aus</li>
                  </ul>
                </div>
              )}

              {elements.map((element) => {
                const scaleX = previewScaleX;
                const scaleY = previewScaleY;

                if (element.type === 'text') {
                  return (
                    <TextCanvasElement
                      key={element.id}
                      element={element}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      isSelected={isElementSelected(element.id)}
                      isEditing={editingTextId === element.id}
                      draftValue={editorDrafts[element.id] || ''}
                      onMouseDown={onElementMouseDown}
                      onDoubleClick={(event, item) => {
                        event.stopPropagation();
                        startEditingText(item);
                      }}
                      onDraftChange={(id, value) => setEditorDrafts((prev) => ({ ...prev, [id]: value }))}
                      onCommitEdit={commitTextEditing}
                      onCancelEdit={cancelEditing}
                      ariaLabel={getElementAriaLabel(element)}
                    />
                  );
                }

                if (element.type === 'image') {
                  return (
                    <ImageCanvasElement
                      key={element.id}
                      element={element}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      isSelected={isElementSelected(element.id)}
                      ariaLabel={getElementAriaLabel(element)}
                      onMouseDown={onElementMouseDown}
                      renderResizeHandles={renderResizeHandles}
                    />
                  );
                }

                if (element.type === 'shape') {
                  return renderShapeCanvas(element, scaleX, scaleY);
                }

                if (element.type === 'block') {
                  return renderBlockCanvas(element, scaleX, scaleY);
                }

                return null;
              })}            </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
};
