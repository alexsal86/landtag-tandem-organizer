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

type ElementType = 'text' | 'image' | 'shape' | 'block';
type ShapeType = 'line' | 'circle' | 'rectangle' | 'sunflower';

interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface TextElement extends BaseElement {
  type: 'text';
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textLineHeight?: number;
}

interface ImageElement extends BaseElement {
  type: 'image';
  imageUrl?: string;
  blobUrl?: string;
  storagePath?: string;
  preserveAspectRatio?: boolean;
}

interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
  rotation?: number;
  color?: string;
}

interface BlockElement extends BaseElement {
  type: 'block';
  blockId?: string;
  blockTitle?: string;
  blockContent?: string;
  blockFontSize?: number;
  blockFontFamily?: string;
  blockFontWeight?: string;
  blockColor?: string;
  blockLineHeight?: number;
}

type HeaderElement = TextElement | ImageElement | ShapeElement | BlockElement;

interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
}

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

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({ initialElements = [], onElementsChange }) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [elements, setElements] = useState<HeaderElement[]>(initialElements);
  const historyPastRef = useRef<HeaderElement[][]>([]);
  const historyFutureRef = useRef<HeaderElement[][]>([]);
  const [, setHistoryVersion] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [clipboardElement, setClipboardElement] = useState<HeaderElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const dragInitialElementsRef = useRef<HeaderElement[] | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const snapLinesTimeoutRef = useRef<number | null>(null);
  const lastReportedRef = useRef<HeaderElement[]>(initialElements);
  const selectionInitialIdsRef = useRef<string[]>([]);

  // Resize state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; ow: number; oh: number } | null>(null);
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

  const createElementId = () => crypto.randomUUID();

  const bumpHistoryVersion = () => setHistoryVersion((version) => version + 1);

  const pushHistorySnapshot = (snapshot: HeaderElement[]) => {
    historyPastRef.current.push(snapshot);
    if (historyPastRef.current.length > 100) historyPastRef.current.shift();
    historyFutureRef.current = [];
    bumpHistoryVersion();
  };

  const applyElements = (
    updater: (prev: HeaderElement[]) => HeaderElement[],
    options: { recordHistory?: boolean } = {},
  ) => {
    const { recordHistory = true } = options;
    setElements((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      if (recordHistory) {
        pushHistorySnapshot(prev);
      }
      return next;
    });
  };

  const undo = () => {
    setElements((prev) => {
      const previous = historyPastRef.current.pop();
      if (!previous) return prev;
      historyFutureRef.current.unshift(prev);
      bumpHistoryVersion();
      return previous;
    });
  };

  const redo = () => {
    setElements((prev) => {
      const next = historyFutureRef.current.shift();
      if (!next) return prev;
      historyPastRef.current.push(prev);
      bumpHistoryVersion();
      return next;
    });
  };

  const canUndo = historyPastRef.current.length > 0;
  const canRedo = historyFutureRef.current.length > 0;

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const updatePreviewSize = () => {
      if (!previewContainerRef.current) return;
      const nextWidth = Math.min(780, Math.max(360, Math.floor(previewContainerRef.current.clientWidth - 16)));
      setPreviewWidth(nextWidth);
    };

    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

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
    setSelectedElementId(newElement.id);
    setSelectedElementIds([newElement.id]);
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
    setSelectedElementId(el.id);
    setSelectedElementIds([el.id]);
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
    setSelectedElementId(el.id);
    setSelectedElementIds([el.id]);
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
    setSelectedElementId(el.id);
    setSelectedElementIds([el.id]);
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
    setSelectedElementId(null);
    setSelectedElementIds([]);
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
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(headerMaxWidth, (event.clientX - rect.left) / previewScaleX));
    const y = Math.max(0, Math.min(headerMaxHeight, (event.clientY - rect.top) / previewScaleY));

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
      setSelectedElementId(element.id);
      setSelectedElementIds((previous) => previous.includes(element.id)
        ? previous.filter((id) => id !== element.id)
        : [...previous, element.id]);
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

    setSelectedElementId(element.id);
    setSelectedElementIds(activeSelection);
    setDragId(element.id);
    dragInitialElementsRef.current = elements;
    setDragStart({ x: event.clientX, y: event.clientY, origins });
  };

  const onResizeMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    event.stopPropagation(); event.preventDefault();
    setResizingId(element.id);
    resizeInitialElementsRef.current = elements;
    setResizeStart({ x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30 });
  };

  useEffect(() => {
    if (!dragId && !resizingId) return;
    const handler = () => onPreviewMouseUp();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragId, resizingId]);

  const onPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (!previewRef.current) return;
    if (event.target !== event.currentTarget) return;

    const rect = previewRef.current.getBoundingClientRect();
    const startX = Math.max(0, Math.min(previewWidth, event.clientX - rect.left));
    const startY = Math.max(0, Math.min(previewHeight, event.clientY - rect.top));

    const appendSelection = isToggleModifierPressed(event);
    selectionInitialIdsRef.current = appendSelection ? selectedElementIds : [];
    if (!appendSelection) {
      setSelectedElementId(null);
      setSelectedElementIds([]);
    }
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
  };

  const onPreviewMouseMove = (event: React.MouseEvent) => {
    if (selectionBox && previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(previewWidth, event.clientX - rect.left));
      const currentY = Math.max(0, Math.min(previewHeight, event.clientY - rect.top));
      const nextSelection = { ...selectionBox, currentX, currentY };
      setSelectionBox(nextSelection);

      const left = Math.min(nextSelection.startX, nextSelection.currentX) / previewScaleX;
      const right = Math.max(nextSelection.startX, nextSelection.currentX) / previewScaleX;
      const top = Math.min(nextSelection.startY, nextSelection.currentY) / previewScaleY;
      const bottom = Math.max(nextSelection.startY, nextSelection.currentY) / previewScaleY;

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
      setSelectedElementIds(mergedSelection);
      setSelectedElementId(mergedSelection.length ? mergedSelection[mergedSelection.length - 1] : null);
      return;
    }

    if (resizingId && resizeStart) {
      const resizingElement = elements.find((el) => el.id === resizingId);
      const dx = (event.clientX - resizeStart.x) / previewScaleX;
      const dy = (event.clientY - resizeStart.y) / previewScaleY;
      let newW = Math.max(5, resizeStart.ow + dx);
      let newH = Math.max(5, resizeStart.oh + dy);
      const preserveAspect = Boolean(event.ctrlKey || (resizingElement?.type === 'image' && resizingElement.preserveAspectRatio));
      if (preserveAspect && resizeStart.ow > 0 && resizeStart.oh > 0) {
        newH = newW / (resizeStart.ow / resizeStart.oh);
      }
      updateElement(resizingId, { width: Math.round(newW), height: Math.round(newH) }, { recordHistory: false });
      return;
    }
    if (!dragId || !dragStart) return;
    const dx = (event.clientX - dragStart.x) / previewScaleX;
    const dy = (event.clientY - dragStart.y) / previewScaleY;
    const origin = dragStart.origins[dragId];
    if (!origin) return;
    const nx = Math.max(0, Math.min(headerMaxWidth, origin.x + dx));
    const ny = Math.max(0, Math.min(headerMaxHeight, origin.y + dy));
    const snapped = snapToOtherElements(dragId, nx, ny, elements);
    flashSnapLines(snapped.guides);
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
    setSelectionBox(null);
  };

  const cycleSelection = (direction: 1 | -1) => {
    if (elements.length === 0) return;
    const currentIndex = elements.findIndex((el) => el.id === selectedElementId);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (startIndex + direction + elements.length) % elements.length;
    setSelectedElementId(elements[nextIndex].id);
    setSelectedElementIds([elements[nextIndex].id]);
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
    setSelectedElementId(pasted.id);
    setSelectedElementIds([pasted.id]);
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
    setSelectedElementId(pasted.id);
    setSelectedElementIds([pasted.id]);
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

  const getElementDimensions = (element: HeaderElement) => ({
    width: Math.max(1, element.width || (element.type === 'text' ? 70 : element.type === 'block' ? 45 : 50)),
    height: Math.max(1, element.height || (element.type === 'text' ? 8 : element.type === 'block' ? 18 : 10)),
  });

  const alignSelection = (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length < 2) return;

    const bounds = selected.reduce((acc, element) => {
      const { width, height } = getElementDimensions(element);
      return {
        left: Math.min(acc.left, element.x),
        top: Math.min(acc.top, element.y),
        right: Math.max(acc.right, element.x + width),
        bottom: Math.max(acc.bottom, element.y + height),
      };
    }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });

    const centerX = (bounds.left + bounds.right) / 2;
    const middleY = (bounds.top + bounds.bottom) / 2;

    applyElements((prev) => prev.map((element) => {
      if (!selectedElementIds.includes(element.id)) return element;
      const { width, height } = getElementDimensions(element);
      let x = element.x;
      let y = element.y;

      if (axis === 'left') x = bounds.left;
      if (axis === 'center') x = centerX - width / 2;
      if (axis === 'right') x = bounds.right - width;
      if (axis === 'top') y = bounds.top;
      if (axis === 'middle') y = middleY - height / 2;
      if (axis === 'bottom') y = bounds.bottom - height;

      return {
        ...element,
        x: Math.max(0, Math.min(headerMaxWidth, Math.round(x))),
        y: Math.max(0, Math.min(headerMaxHeight, Math.round(y))),
      };
    }));
  };

  const distributeSelection = (axis: 'horizontal' | 'vertical') => {
    if (selectedElementIds.length < 3) return;
    const selected = elements
      .filter((el) => selectedElementIds.includes(el.id))
      .map((element) => ({ ...element, ...getElementDimensions(element) }));
    if (selected.length < 3) return;

    const sorted = [...selected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startPos = axis === 'horizontal' ? first.x : first.y;
    const endPos = axis === 'horizontal' ? last.x + last.width : last.y + last.height;
    const totalSize = sorted.reduce((sum, item) => sum + (axis === 'horizontal' ? item.width : item.height), 0);
    const totalGap = endPos - startPos - totalSize;
    if (totalGap <= 0) return;

    const gap = totalGap / (sorted.length - 1);
    let cursor = startPos;
    const positions = new Map<string, number>();

    sorted.forEach((item) => {
      positions.set(item.id, cursor);
      cursor += (axis === 'horizontal' ? item.width : item.height) + gap;
    });

    applyElements((prev) => prev.map((element) => {
      const nextPos = positions.get(element.id);
      if (nextPos == null) return element;
      return {
        ...element,
        x: axis === 'horizontal' ? Math.max(0, Math.min(headerMaxWidth, Math.round(nextPos))) : element.x,
        y: axis === 'vertical' ? Math.max(0, Math.min(headerMaxHeight, Math.round(nextPos))) : element.y,
      };
    }));
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

  const getElementDimensions = (element: HeaderElement) => ({
    width: Math.max(1, element.width || (element.type === 'text' ? 70 : element.type === 'block' ? 45 : 50)),
    height: Math.max(1, element.height || (element.type === 'text' ? 8 : element.type === 'block' ? 18 : 10)),
  });

  const alignSelection = (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    if (selected.length < 2) return;

    const bounds = selected.reduce((acc, element) => {
      const { width, height } = getElementDimensions(element);
      return {
        left: Math.min(acc.left, element.x),
        top: Math.min(acc.top, element.y),
        right: Math.max(acc.right, element.x + width),
        bottom: Math.max(acc.bottom, element.y + height),
      };
    }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });

    const centerX = (bounds.left + bounds.right) / 2;
    const middleY = (bounds.top + bounds.bottom) / 2;

    applyElements((prev) => prev.map((element) => {
      if (!selectedElementIds.includes(element.id)) return element;
      const { width, height } = getElementDimensions(element);
      let x = element.x;
      let y = element.y;

      if (axis === 'left') x = bounds.left;
      if (axis === 'center') x = centerX - width / 2;
      if (axis === 'right') x = bounds.right - width;
      if (axis === 'top') y = bounds.top;
      if (axis === 'middle') y = middleY - height / 2;
      if (axis === 'bottom') y = bounds.bottom - height;

      return {
        ...element,
        x: Math.max(0, Math.min(headerMaxWidth, Math.round(x))),
        y: Math.max(0, Math.min(headerMaxHeight, Math.round(y))),
      };
    }));
  };

  const distributeSelection = (axis: 'horizontal' | 'vertical') => {
    if (selectedElementIds.length < 3) return;
    const selected = elements
      .filter((el) => selectedElementIds.includes(el.id))
      .map((element) => ({ ...element, ...getElementDimensions(element) }));
    if (selected.length < 3) return;

    const sorted = [...selected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const startPos = axis === 'horizontal' ? first.x : first.y;
    const endPos = axis === 'horizontal' ? last.x + last.width : last.y + last.height;
    const totalSize = sorted.reduce((sum, item) => sum + (axis === 'horizontal' ? item.width : item.height), 0);
    const totalGap = endPos - startPos - totalSize;
    if (totalGap <= 0) return;

    const gap = totalGap / (sorted.length - 1);
    let cursor = startPos;
    const positions = new Map<string, number>();

    sorted.forEach((item) => {
      positions.set(item.id, cursor);
      cursor += (axis === 'horizontal' ? item.width : item.height) + gap;
    });

    applyElements((prev) => prev.map((element) => {
      const nextPos = positions.get(element.id);
      if (nextPos == null) return element;
      return {
        ...element,
        x: axis === 'horizontal' ? Math.max(0, Math.min(headerMaxWidth, Math.round(nextPos))) : element.x,
        y: axis === 'vertical' ? Math.max(0, Math.min(headerMaxHeight, Math.round(nextPos))) : element.y,
      };
    }));
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
    setSelectedElementId(pasted.id);
    setSelectedElementIds([pasted.id]);
  };

  const canPasteFromClipboard = Boolean(clipboardElement);
  const selectedIndex = selectedElement ? elements.findIndex((el) => el.id === selectedElement.id) : -1;
  const canMoveLayerBackward = selectedIndex > 0;
  const canMoveLayerForward = selectedIndex >= 0 && selectedIndex < elements.length - 1;

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
        <span className="h-4 w-4 shrink-0 rounded border" style={{ backgroundColor: value }} />
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

  const getElementLabel = (el: HeaderElement) => {
    if (el.type === 'text') return (el.content || 'Text').slice(0, 25);
    if (el.type === 'image') return 'Bild';
    if (el.type === 'block') return `Block: ${el.blockTitle || 'Block'}`;
    if (el.type === 'shape') return `Form: ${el.shapeType || 'shape'}`;
    return 'Element';
  };

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

  const getElementIcon = (el: HeaderElement) => {
    if (el.type === 'text') return <Type className="h-3.5 w-3.5 shrink-0" />;
    if (el.type === 'image') return <ImageIcon className="h-3.5 w-3.5 shrink-0" />;
    if (el.type === 'block') return <LayoutGrid className="h-3.5 w-3.5 shrink-0" />;
    if (el.type === 'shape') {
      if (el.shapeType === 'circle') return <Circle className="h-3.5 w-3.5 shrink-0" />;
      if (el.shapeType === 'line') return <Minus className="h-3.5 w-3.5 shrink-0" />;
      if (el.shapeType === 'sunflower') return <Flower2 className="h-3.5 w-3.5 shrink-0" />;
      return <Square className="h-3.5 w-3.5 shrink-0" />;
    }
    return <Square className="h-3.5 w-3.5 shrink-0" />;
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
          {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} />}
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
        {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} />}
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
        {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} />}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-4">
        {/* Tools */}
        <Card>
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
        <Card>
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
        <Card>
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
                      setSelectedElementIds((previous) => previous.includes(element.id) ? previous.filter((id) => id !== element.id) : [...previous, element.id]);
                      setSelectedElementId(element.id);
                      return;
                    }
                    setSelectedElementId(element.id);
                    setSelectedElementIds([element.id]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedElementId(element.id);
                      setSelectedElementIds([element.id]);
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
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Vorschau</CardTitle>
          <p className="text-xs text-muted-foreground">DIN A4 Header (210mm × 45mm). Delete/Backspace löscht. Resize + Ctrl = Seitenverhältnis.</p>
        </CardHeader>
        <CardContent className="p-6">
          <div ref={previewContainerRef} className="flex items-center justify-center min-h-[340px] w-full">
          <div className="relative pl-12 pt-12">
            {showRuler && (
              <>
                <div className="absolute top-2 left-12 right-0 h-7 border rounded bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  <canvas ref={horizontalRulerRef} width={previewWidth} height={28} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 22 }).map((_, i) => (<span key={`label-x-${i}`} className="absolute top-0" style={{ left: `${(i * previewWidth) / 21}px` }}>{i * 10}</span>))}
                </div>
                <div className="absolute top-12 left-2 bottom-0 w-7 border rounded bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  <canvas ref={verticalRulerRef} width={28} height={previewHeight} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 5 }).map((_, i) => (<span key={`label-y-${i}`} className="absolute left-0" style={{ top: `${(i * previewHeight) / 4}px` }}>{i * 10}</span>))}
                </div>
              </>
            )}

            <div className="absolute top-2 right-2 z-20 flex flex-wrap justify-end gap-2 max-w-[calc(100%-1rem)]">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={undo} disabled={!canUndo}>
                <Undo2 className="h-3.5 w-3.5 mr-1" />Undo
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={redo} disabled={!canRedo}>
                <Redo2 className="h-3.5 w-3.5 mr-1" />Redo
              </Button>
              <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowRuler(v => !v)}>
                <Ruler className="h-3.5 w-3.5 mr-1" />Lineal
              </Button>
              <Button variant={showCenterGuides ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowCenterGuides(v => !v)}>
                <Crosshair className="h-3.5 w-3.5 mr-1" />Achsen
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={copySelectedElement} disabled={!selectedElement}>
                <Copy className="h-3.5 w-3.5 mr-1" />Kopieren
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={pasteClipboardElement} disabled={!canPasteFromClipboard}>
                <ClipboardPaste className="h-3.5 w-3.5 mr-1" />Einfügen
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={duplicateSelectedElement} disabled={!selectedElement}>
                <CopyPlus className="h-3.5 w-3.5 mr-1" />Duplizieren
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, -1)} disabled={!canMoveLayerBackward}>
                <ArrowDown className="h-3.5 w-3.5 mr-1" />Ebene runter
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, 1)} disabled={!canMoveLayerForward}>
                <ArrowUp className="h-3.5 w-3.5 mr-1" />Ebene hoch
              </Button>
              <Button variant={showShortcutsHelp ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowShortcutsHelp((value) => !value)}>
                <Keyboard className="h-3.5 w-3.5 mr-1" />Shortcuts
              </Button>
              <div className="h-7 px-2 text-xs rounded border bg-background/90 flex items-center text-muted-foreground">
                Auswahl: <span className="ml-1 font-semibold text-foreground">{selectedCount}</span>
              </div>
            </div>

            {canAlignSelection && (
              <div className="absolute top-12 right-2 z-20 flex flex-wrap justify-end gap-1 max-w-[calc(100%-1rem)] rounded-md border bg-background/95 p-1">
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

            <div
              ref={previewRef}
              tabIndex={0}
              role="application"
              aria-label="Header-Vorschau. Mit Shift- oder Cmd/Ctrl-Klick mehrfach auswählen, leere Fläche ziehen erstellt Auswahlrechteck, Alt beim Ziehen wählt nur vollständig enthaltene Elemente, mit Tab durch Elemente wechseln, mit Pfeiltasten Auswahl bewegen, Entf löscht, Strg+Z rückgängig, Strg+C/V kopiert und fügt ein, Strg+] bzw. Strg+[ ändert die Ebene, Strg+Shift+? öffnet die Shortcut-Hilfe."
              onKeyDown={onPreviewKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onMouseDown={onPreviewMouseDown}
              onDrop={onPreviewDrop}
              onMouseMove={onPreviewMouseMove}
              onMouseUp={onPreviewMouseUp}
              onClick={(e) => { if (e.target === e.currentTarget) { setSelectedElementId(null); setSelectedElementIds([]); } }}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, marginLeft: '8px', marginTop: '8px', backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
              <span className="sr-only" aria-live="polite">{ariaAnnouncement}</span>
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}

              {snapLines.x != null && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-emerald-500/90 pointer-events-none animate-pulse"
                  style={{ left: `${snapLines.x * previewScaleX}px` }}
                />
              )}
              {snapLines.y != null && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-emerald-500/90 pointer-events-none animate-pulse"
                  style={{ top: `${snapLines.y * previewScaleY}px` }}
                />
              )}

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
                    <li><span className="font-medium text-foreground">Ausrichten-Leiste</span> Bei Mehrfachauswahl sichtbar</li>
                    <li><span className="font-medium text-foreground">Verteilen</span> Ab 3 selektierten Elementen</li>
                    <li><span className="font-medium text-foreground">Snap-Linien</span> Blitzen beim Einrasten kurz auf</li>
                    <li><span className="font-medium text-foreground">Tab / Shift+Tab</span> Auswahl wechseln</li>
                    <li><span className="font-medium text-foreground">Pfeiltasten</span> Auswahl bewegen</li>
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
                  const isEditing = editingTextId === element.id;
                  return (
                    <div
                      key={element.id}
                      aria-label={getElementAriaLabel(element)}
                      className={`absolute border ${isElementSelected(element.id) ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'} ${isEditing ? 'cursor-text' : 'cursor-move'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, fontSize: `${(element.fontSize || 12) * (96 / 72)}px`, fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal', fontStyle: element.fontStyle || 'normal', textDecoration: element.textDecoration || 'none', color: element.color || '#000000', lineHeight: `${element.textLineHeight || 1.2}` }}
                      onMouseDown={(e) => {
                        if (isEditing) {
                          e.stopPropagation();
                          return;
                        }
                        onElementMouseDown(e, element);
                      }}
                      onDoubleClick={(e) => { e.stopPropagation(); startEditingText(element); }}>
                      {isEditing ? (
                        <textarea
                          className="w-full min-w-[120px] resize-none border-0 bg-transparent p-0 outline-none"
                          value={editorDrafts[element.id] || ''}
                          autoFocus
                          onChange={(e) => setEditorDrafts((prev) => ({ ...prev, [element.id]: e.target.value }))}
                          onBlur={() => commitTextEditing(element.id)}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEditing(element.id);
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                              e.preventDefault();
                              commitTextEditing(element.id);
                            }
                          }}
                        />
                      ) : (element.content || 'Text')}
                    </div>
                  );
                }
                if (element.type === 'image') {
                  const imgSrc = element.imageUrl || element.blobUrl;
                  if (!imgSrc) return null;
                  const elW = (element.width || 50) * scaleX;
                  const elH = (element.height || 30) * scaleY;
                  return (
                    <div key={element.id} className="absolute" aria-label={getElementAriaLabel(element)} style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${elW}px`, height: `${elH}px` }}>
                      <img src={imgSrc} alt="Header Image" className={`w-full h-full object-contain cursor-move border ${isElementSelected(element.id) ? 'border-primary border-dashed border-2' : 'border-transparent'}`} onMouseDown={(e) => onElementMouseDown(e, element)} draggable={false} />
                      {isElementSelected(element.id) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} title="Ziehen zum Skalieren (fixes Seitenverhältnis aktiv, Ctrl ebenfalls möglich)" />}
                    </div>
                  );
                }
                if (element.type === 'shape') {
                  return renderShapeCanvas(element, scaleX, scaleY);
                }
                if (element.type === 'block') {
                  return renderBlockCanvas(element, scaleX, scaleY);
                }
                return null;
              })}
            </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
