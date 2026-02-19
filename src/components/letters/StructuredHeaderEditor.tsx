import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, FolderOpen, Square, Circle, Minus, Flower2, LayoutGrid, Ruler, Crosshair } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

type ElementType = 'text' | 'image' | 'shape' | 'block';
type ShapeType = 'line' | 'circle' | 'rectangle' | 'sunflower';

interface HeaderElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textLineHeight?: number;
  imageUrl?: string;
  blobUrl?: string;
  storagePath?: string;
  preserveAspectRatio?: boolean;
  blockId?: string;
  // Shape properties
  shapeType?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
  rotation?: number;
  // Block properties (when type === 'block')
  blockTitle?: string;
  blockContent?: string;
  blockFontSize?: number;
  blockFontFamily?: string;
  blockFontWeight?: string;
  blockColor?: string;
  blockLineHeight?: number;
}

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
  element.fillColor ?? element.color ?? fallback;

const getShapeStrokeColor = (element: HeaderElement, fallback = '#000000') =>
  element.strokeColor ?? element.color ?? fallback;

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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lastReportedRef = useRef<string>(JSON.stringify(initialElements));

  // Resize state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; ow: number; oh: number } | null>(null);

  // Image gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Blob URL mapping
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const previewWidth = 780;
  const previewHeight = 300;
  const previewScaleX = previewWidth / headerMaxWidth;
  const previewScaleY = previewHeight / headerMaxHeight;
  const SNAP_MM = 1.5;

  const createElementId = () => crypto.randomUUID();

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
      galleryImages.forEach(img => URL.revokeObjectURL(img.blobUrl));
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
      setGalleryImages(loaded);
    } catch (error) { console.error('Error loading gallery:', error); }
    finally { setGalleryLoading(false); }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadGalleryImages();
    return () => {
      galleryImages.forEach(img => URL.revokeObjectURL(img.blobUrl));
      blobUrlMapRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlMapRef.current.clear();
    };
  }, [currentTenant?.id]);

  const snapToOtherElements = (id: string, x: number, y: number, allElements: HeaderElement[]) => {
    const current = allElements.find((el) => el.id === id);
    if (!current) return { x, y };
    let sx = x, sy = y;
    const w = current.width || 50, h = current.height || 10;
    const edgeTargets = allElements.filter((el) => el.id !== id).flatMap((el) => {
      const tw = el.width || 50, th = el.height || 10;
      return [{ x: el.x, y: el.y }, { x: el.x + tw, y: el.y + th }, { x: el.x + tw / 2, y: el.y + th / 2 }];
    });
    for (const t of edgeTargets) {
      if (Math.abs(sx - t.x) <= SNAP_MM) sx = t.x;
      if (Math.abs(sx + w - t.x) <= SNAP_MM) sx = t.x - w;
      if (Math.abs(sx + w / 2 - t.x) <= SNAP_MM) sx = t.x - w / 2;
      if (Math.abs(sy - t.y) <= SNAP_MM) sy = t.y;
      if (Math.abs(sy + h - t.y) <= SNAP_MM) sy = t.y - h;
      if (Math.abs(sy + h / 2 - t.y) <= SNAP_MM) sy = t.y - h / 2;
    }
    const centerX = headerMaxWidth / 2;
    const centerY = headerMaxHeight / 2;
    const axisTargetsX = [0, centerX, headerMaxWidth];
    const axisTargetsY = [0, centerY, headerMaxHeight];
    for (const tx of axisTargetsX) {
      if (Math.abs(sx - tx) <= SNAP_MM) sx = tx;
      if (Math.abs(sx + w - tx) <= SNAP_MM) sx = tx - w;
      if (Math.abs(sx + w / 2 - tx) <= SNAP_MM) sx = tx - w / 2;
    }
    for (const ty of axisTargetsY) {
      if (Math.abs(sy - ty) <= SNAP_MM) sy = ty;
      if (Math.abs(sy + h - ty) <= SNAP_MM) sy = ty - h;
      if (Math.abs(sy + h / 2 - ty) <= SNAP_MM) sy = ty - h / 2;
    }
    return { x: Math.round(sx), y: Math.round(sy) };
  };

  useEffect(() => {
    const key = JSON.stringify(elements);
    if (key !== lastReportedRef.current) { lastReportedRef.current = key; onElementsChange(elements); }
  }, [elements]);

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
    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
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
    setElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
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
      setElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
    };
    input.click();
  };

  const addShapeElement = (shapeType: ShapeType) => {
    const defaults: Partial<HeaderElement> = {
      line: { width: 50, height: 1, fillColor: 'transparent', strokeColor: '#000000', strokeWidth: 2 },
      circle: { width: 20, height: 20, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 1 },
      rectangle: { width: 40, height: 20, fillColor: '#3b82f6', strokeColor: '#1e40af', strokeWidth: 1, borderRadius: 0 },
      sunflower: { width: 25, height: 25, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 0 },
    }[shapeType];
    const el: HeaderElement = { id: createElementId(), type: 'shape', shapeType, x: 20, y: 10, rotation: 0, ...defaults };
    setElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
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
    setElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
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
      setElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
      return;
    }

    const galleryData = event.dataTransfer.getData('application/x-gallery-image');
    if (galleryData) {
      try {
        const { path, blobUrl } = JSON.parse(galleryData);
        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(path);
        const el: HeaderElement = { id: createElementId(), type: 'image', x: Math.round(x), y: Math.round(y), width: 40, height: 20, imageUrl: publicUrl, blobUrl, storagePath: path, preserveAspectRatio: true };
        setElements(prev => [...prev, el]);
        setSelectedElementId(el.id);
      } catch (e) { console.error('Error parsing gallery drop data:', e); }
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const onElementMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    if (editingTextId === element.id || editingBlockId === element.id) {
      return;
    }
    event.stopPropagation();
    setSelectedElementId(element.id);
    setDragId(element.id);
    setDragStart({ x: event.clientX, y: event.clientY, ox: element.x, oy: element.y });
  };

  const onResizeMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    event.stopPropagation(); event.preventDefault();
    setResizingId(element.id);
    setResizeStart({ x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30 });
  };

  useEffect(() => {
    if (!dragId && !resizingId) return;
    const handler = () => onPreviewMouseUp();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragId, resizingId]);

  const onPreviewMouseMove = (event: React.MouseEvent) => {
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
      updateElement(resizingId, { width: Math.round(newW), height: Math.round(newH) });
      return;
    }
    if (!dragId || !dragStart) return;
    const dx = (event.clientX - dragStart.x) / previewScaleX;
    const dy = (event.clientY - dragStart.y) / previewScaleY;
    const nx = Math.max(0, Math.min(headerMaxWidth, dragStart.ox + dx));
    const ny = Math.max(0, Math.min(headerMaxHeight, dragStart.oy + dy));
    const snapped = snapToOtherElements(dragId, nx, ny, elements);
    updateElement(dragId, { x: snapped.x, y: snapped.y });
  };

  const onPreviewMouseUp = () => { setDragId(null); setDragStart(null); setResizingId(null); setResizeStart(null); };

  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target?.isContentEditable || editingTextId || editingBlockId) {
      return;
    }
    if (!selectedElement) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeElement(selectedElement.id); return; }
    let dx = 0, dy = 0;
    if (event.key === 'ArrowLeft') dx = -1;
    if (event.key === 'ArrowRight') dx = 1;
    if (event.key === 'ArrowUp') dy = -1;
    if (event.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    event.preventDefault();
    updateElement(selectedElement.id, { x: Math.max(0, Math.min(headerMaxWidth, selectedElement.x + dx)), y: Math.max(0, Math.min(headerMaxHeight, selectedElement.y + dy)) });
  };

  const validatePosition = (value: number, max: number) => Math.max(0, Math.min(value, max));

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

  const updateImageSize = (element: HeaderElement, next: { width?: number; height?: number }) => {
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
  const renderShapeCanvas = (element: HeaderElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 20) * scaleX;
    const h = (element.height || 20) * scaleY;
    const isSelected = selectedElementId === element.id;
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
        <div key={element.id} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}>
          <SunflowerSVG width={w} height={h} />
          {isSelected && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} />}
        </div>
      );
    }

    return (
      <div key={element.id} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`${isSelected ? 'ring-2 ring-primary ring-dashed' : ''}`}>
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
  const renderBlockCanvas = (element: HeaderElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 45) * scaleX;
    const h = (element.height || 18) * scaleY;
    const isSelected = selectedElementId === element.id;
    const fontSize = (element.blockFontSize || 9) * (96 / 72);
    const hasContent = Boolean((element.blockContent || '').trim());
    const isEditing = editingBlockId === element.id;

    return (
      <div
        key={element.id}
        className={`absolute cursor-move border overflow-hidden ${isSelected ? 'border-primary border-dashed border-2 bg-primary/5' : 'border-gray-300 bg-gray-50/50'}`}
        style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${w}px`, height: `${h}px`, fontSize: `${fontSize}px`, fontFamily: element.blockFontFamily || 'Arial', fontWeight: element.blockFontWeight || 'normal', color: element.blockColor || '#000', lineHeight: `${element.blockLineHeight || 1}` }}
        onMouseDown={(e) => onElementMouseDown(e, element)}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingBlockId(element.id); }}
      >
        {!hasContent && <div className="font-bold text-[10px] px-1 pt-0.5 opacity-70">{element.blockTitle || 'Block'}</div>}
        <div
          className="px-1 whitespace-pre-line h-full outline-none"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => {
            updateElement(element.id, { blockContent: e.currentTarget.textContent || '' });
            setEditingBlockId(null);
          }}
          onMouseDown={(e) => {
            if (isEditing) {
              e.stopPropagation();
            }
          }}
        >
          {element.blockContent || ''}
        </div>
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
                <div key={element.id} className={`group p-2 border rounded cursor-pointer transition-colors text-xs ${selectedElementId === element.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`} onClick={() => setSelectedElementId(element.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getElementIcon(element)}
                      <span className="font-medium truncate">{getElementLabel(element)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                  <p className="text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>

                  {selectedElementId === element.id && (
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
          <div className="flex items-center justify-center min-h-[340px]">
          <div className="relative pl-12 pt-12">
            {showRuler && (
              <>
                <div className="absolute top-2 left-12 right-0 h-7 border rounded bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  {Array.from({ length: 211 }).map((_, i) => {
                    const x = (i * previewWidth) / 210;
                    const tickHeight = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
                    return <div key={i} className="absolute bottom-0 border-l border-slate-500/70" style={{ left: `${x}px`, height: `${tickHeight}px` }} />;
                  })}
                  {Array.from({ length: 22 }).map((_, i) => (<span key={`label-x-${i}`} className="absolute top-0" style={{ left: `${(i * previewWidth) / 21}px` }}>{i * 10}</span>))}
                </div>
                <div className="absolute top-12 left-2 bottom-0 w-7 border rounded bg-slate-100 text-[10px] text-muted-foreground pointer-events-none">
                  {Array.from({ length: 46 }).map((_, i) => {
                    const y = (i * previewHeight) / 45;
                    const tickWidth = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
                    return <div key={`tick-y-${i}`} className="absolute right-0 border-t border-slate-500/70" style={{ top: `${y}px`, width: `${tickWidth}px` }} />;
                  })}
                  {Array.from({ length: 5 }).map((_, i) => (<span key={`label-y-${i}`} className="absolute left-0" style={{ top: `${(i * previewHeight) / 4}px` }}>{i * 10}</span>))}
                </div>
              </>
            )}

            <div className="absolute top-2 right-2 z-20 flex gap-2">
              <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowRuler(v => !v)}>
                <Ruler className="h-3.5 w-3.5 mr-1" />Lineal
              </Button>
              <Button variant={showCenterGuides ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowCenterGuides(v => !v)}>
                <Crosshair className="h-3.5 w-3.5 mr-1" />Achsen
              </Button>
            </div>

            <div ref={previewRef} tabIndex={0} onKeyDown={onPreviewKeyDown} onDragOver={(e) => e.preventDefault()} onDrop={onPreviewDrop} onMouseMove={onPreviewMouseMove} onMouseUp={onPreviewMouseUp} onClick={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, marginLeft: '8px', marginTop: '8px', backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}

              {elements.map((element) => {
                const scaleX = previewScaleX;
                const scaleY = previewScaleY;

                if (element.type === 'text') {
                  const isEditing = editingTextId === element.id;
                  return (
                    <div key={element.id} className={`absolute border ${selectedElementId === element.id ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'} ${isEditing ? 'cursor-text' : 'cursor-move'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, fontSize: `${(element.fontSize || 12) * (96 / 72)}px`, fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal', fontStyle: element.fontStyle || 'normal', textDecoration: element.textDecoration || 'none', color: element.color || '#000000', lineHeight: `${element.textLineHeight || 1.2}` }}
                      onMouseDown={(e) => {
                        if (isEditing) {
                          e.stopPropagation();
                          return;
                        }
                        onElementMouseDown(e, element);
                      }}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(element.id); }}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        updateElement(element.id, { content: e.currentTarget.textContent || '' });
                        setEditingTextId(null);
                      }}>
                      {element.content || 'Text'}
                    </div>
                  );
                }
                if (element.type === 'image') {
                  const imgSrc = element.imageUrl || element.blobUrl;
                  if (!imgSrc) return null;
                  const elW = (element.width || 50) * scaleX;
                  const elH = (element.height || 30) * scaleY;
                  return (
                    <div key={element.id} className="absolute" style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${elW}px`, height: `${elH}px` }}>
                      <img src={imgSrc} alt="Header Image" className={`w-full h-full object-contain cursor-move border ${selectedElementId === element.id ? 'border-primary border-dashed border-2' : 'border-transparent'}`} onMouseDown={(e) => onElementMouseDown(e, element)} draggable={false} />
                      {selectedElementId === element.id && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary border border-primary-foreground cursor-nwse-resize z-10" style={{ transform: 'translate(50%, 50%)' }} onMouseDown={(e) => onResizeMouseDown(e, element)} title="Ziehen zum Skalieren (fixes Seitenverhältnis aktiv, Ctrl ebenfalls möglich)" />}
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
