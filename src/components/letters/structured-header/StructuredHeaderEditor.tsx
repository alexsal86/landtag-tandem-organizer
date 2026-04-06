import React, { useRef, useState, useEffect, useCallback } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, FolderOpen, Square, Circle, Minus, LayoutGrid, Keyboard, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { BlockElement, HeaderElement, ImageElement, ShapeElement, ShapeType, TextElement } from '@/components/canvas-engine/types';
import { getElementDimensions } from '@/components/canvas-engine/utils/geometry';
import { useCanvasHistory } from '@/components/canvas-engine/hooks/useCanvasHistory';
import { useCanvasSelection } from '@/components/canvas-engine/hooks/useCanvasSelection';
import { getElementIconFromRegistry, getElementLabelFromRegistry } from '@/components/letters/elements/registry';
import { ImageCanvasElement, TextCanvasElement } from '@/components/letters/elements/canvasElements';
import { CSS_PX_PER_MM } from '@/lib/units';
import { CanvasToolbar } from '@/components/letters/CanvasToolbar';
import type { LetterLayoutSettings } from '@/types/letterLayout';
import { SunflowerSVG, LionSVG, WappenSVG } from '@/components/letters/elements/shapeSVGs';

import { BLOCK_VARIABLES, createElementId, getShapeFillColor, getShapeStrokeColor, ZOOM_STEPS } from './structured-header/constants';
import { useCanvasGallery } from './structured-header/useCanvasGallery';
import { useCanvasInteractions } from './structured-header/useCanvasInteractions';

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
  actionButtons?: React.ReactNode;
  layoutSettings?: LetterLayoutSettings;
  canvasWidthMm?: number;
  canvasHeightMm?: number;
  blockKey?: string;
}

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({ initialElements = [], onElementsChange, actionButtons, layoutSettings, canvasWidthMm, canvasHeightMm, blockKey }) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const {
    elements, setElements, applyElements, pushHistorySnapshot, undo, redo, canUndo, canRedo,
  } = useCanvasHistory<HeaderElement>(initialElements);
  const {
    selectedElementId, setSelectedElementId, selectedElementIds, setSelectedElementIds,
    selectOne, setSelection, toggleSelect, clearSelection,
  } = useCanvasSelection();

  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [showMargins, setShowMargins] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const lastReportedRef = useRef<HeaderElement[]>(initialElements);

  const canvasMaxWidth = canvasWidthMm ?? 210;
  const canvasMaxHeight = canvasHeightMm ?? 45;
  const previewWidth = canvasMaxWidth * CSS_PX_PER_MM;
  const previewHeight = canvasMaxHeight * CSS_PX_PER_MM;
  const previewScaleX = CSS_PX_PER_MM;
  const previewScaleY = CSS_PX_PER_MM;

  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomIn = useCallback(() => { setZoomLevel((z) => { const idx = ZOOM_STEPS.indexOf(z); return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z; }); }, []);
  const zoomOut = useCallback(() => { setZoomLevel((z) => { const idx = ZOOM_STEPS.indexOf(z); return idx > 0 ? ZOOM_STEPS[idx - 1] : z; }); }, []);
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);

  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const container = el;
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + container.scrollLeft;
      const cursorY = e.clientY - rect.top + container.scrollTop;
      const currentScale = previewScaleX * zoomLevelRef.current;
      const mmX = (cursorX - 28) / currentScale;
      const mmY = (cursorY - 28) / currentScale;
      const currentIdx = ZOOM_STEPS.indexOf(zoomLevelRef.current);
      const nextZoom = e.deltaY < 0
        ? (currentIdx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[currentIdx + 1] : zoomLevelRef.current)
        : (currentIdx > 0 ? ZOOM_STEPS[currentIdx - 1] : zoomLevelRef.current);
      if (nextZoom === zoomLevelRef.current) return;
      setZoomLevel(nextZoom);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newScale = previewScaleX * nextZoom;
          const newCursorX = mmX * newScale + 28;
          const newCursorY = mmY * newScale + 28;
          container.scrollLeft = newCursorX - (e.clientX - rect.left);
          container.scrollTop = newCursorY - (e.clientY - rect.top);
        });
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const canvasPixelWidth = previewWidth * zoomLevel;
  const canvasPixelHeight = previewHeight * zoomLevel;
  const effectiveScaleX = previewScaleX * zoomLevel;
  const effectiveScaleY = previewScaleY * zoomLevel;

  const isFullPageCanvas = !blockKey || blockKey === 'header';
  const marginGuides = isFullPageCanvas ? [
    { key: 'left', orientation: 'vertical' as const, pos: (layoutSettings?.margins.left ?? 25) * effectiveScaleX, label: 'Links', color: '#2563eb' },
    { key: 'right', orientation: 'vertical' as const, pos: (canvasMaxWidth - (layoutSettings?.margins.right ?? 20)) * effectiveScaleX, label: 'Rechts', color: '#2563eb' },
    { key: 'top', orientation: 'horizontal' as const, pos: (layoutSettings?.margins.top ?? 45) * effectiveScaleY, label: 'Oben', color: '#16a34a' },
    { key: 'bottom', orientation: 'horizontal' as const, pos: (canvasMaxHeight - (layoutSettings?.margins.bottom ?? 25)) * effectiveScaleY, label: 'Unten', color: '#16a34a' },
  ].filter((guide) => {
    if (guide.orientation === 'vertical') return guide.pos >= 0 && guide.pos <= canvasPixelWidth;
    return guide.pos >= 0 && guide.pos <= canvasPixelHeight;
  }) : [];

  // Gallery
  const gallery = useCanvasGallery();

  // Interactions
  const interactions = useCanvasInteractions({
    elements, setElements, applyElements, pushHistorySnapshot,
    selectedElementId, selectedElementIds, setSelectedElementId, setSelectedElementIds,
    selectOne, setSelection, toggleSelect, clearSelection,
    canvasMaxWidth, canvasMaxHeight, effectiveScaleX, effectiveScaleY,
    canvasPixelWidth, canvasPixelHeight, previewRef,
    editingTextId, editingBlockId,
  });

  // Resolve blob URLs on mount
  useEffect(() => {
    const resolveAll = async () => {
      const updated = await Promise.all(elements.map(async (el) => {
        if (el.type !== 'image' || !el.storagePath || el.blobUrl) return el;
        const blobUrl = await gallery.resolveBlobUrl(el.storagePath);
        if (!blobUrl) return el;
        return { ...el, blobUrl };
      }));
      const changed = updated.some((el, idx) => el !== elements[idx]);
      if (changed) setElements(updated);
    };
    resolveAll();
  }, []);

  // Ruler rendering
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
    for (let i = 0; i <= canvasMaxWidth; i += 1) {
      const x = (i * canvasPixelWidth) / canvasMaxWidth;
      const tickHeight = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      hCtx.beginPath(); hCtx.moveTo(x, hCanvas.height); hCtx.lineTo(x, hCanvas.height - tickHeight); hCtx.stroke();
    }

    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);
    vCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    for (let i = 0; i <= canvasMaxHeight; i += 1) {
      const y = (i * canvasPixelHeight) / canvasMaxHeight;
      const tickWidth = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      vCtx.beginPath(); vCtx.moveTo(vCanvas.width, y); vCtx.lineTo(vCanvas.width - tickWidth, y); vCtx.stroke();
    }
  }, [canvasPixelWidth, canvasPixelHeight, showRuler]);

  // Report changes
  useEffect(() => {
    if (elements !== lastReportedRef.current) {
      lastReportedRef.current = elements;
      onElementsChange(elements);
    }
  }, [elements, onElementsChange]);

  // Aria announcements
  useEffect(() => {
    if (!selectedElementId) { setAriaAnnouncement('Keine Auswahl'); return; }
    const selected = elements.find((el) => el.id === selectedElementId);
    if (!selected) return;
    setAriaAnnouncement(`Ausgewählt: ${getElementAriaLabel(selected)}`);
  }, [elements, selectedElementId]);

  // Element creation helpers
  const addImageFromGallery = (galleryImg: { path: string; blobUrl: string }) => {
    const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(galleryImg.path);
    const newElement: HeaderElement = {
      id: createElementId(), type: 'image', x: 20, y: 10, width: 40, height: 20,
      imageUrl: publicUrl, blobUrl: galleryImg.blobUrl, storagePath: galleryImg.path, preserveAspectRatio: true,
    };
    applyElements(prev => [...prev, newElement]);
    selectOne(newElement.id);
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const el: HeaderElement = { id: createElementId(), type: 'text', x, y, content, fontSize: 12, fontFamily: 'Arial', fontWeight: 'normal', color: '#000000', textLineHeight: 1.2 };
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const result = await gallery.uploadImage(file);
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
      lion: { width: 30, height: 12, fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0 },
      wappen: { width: 18, height: 10, fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0 },
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
      blockContent: '', blockFontSize: 9, blockFontFamily: 'Calibri', blockFontWeight: 'normal', blockColor: '#000000', blockLineHeight: 1,
    };
    return el;
  };

  const addBlockElement = () => {
    const el = createBlockElement();
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  // Editing helpers
  const startEditingText = (element: TextElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.content || '' }));
    setEditingTextId(element.id);
  };

  const startEditingBlock = (element: BlockElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.blockContent || '' }));
    setEditingBlockId(element.id);
  };

  const cancelEditing = (id: string) => {
    setEditorDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (editingTextId === id) setEditingTextId(null);
    if (editingBlockId === id) setEditingBlockId(null);
  };

  const commitTextEditing = (id: string) => {
    interactions.updateElement(id, { content: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const commitBlockEditing = (id: string) => {
    interactions.updateElement(id, { blockContent: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const updateImageSize = (element: ImageElement, next: { width?: number; height?: number }) => {
    const baseW = Math.max(1, element.width || 1);
    const baseH = Math.max(1, element.height || 1);
    if (!element.preserveAspectRatio) { interactions.updateElement(element.id, next); return; }
    if (next.width != null) { interactions.updateElement(element.id, { width: next.width, height: Math.max(1, Math.round(next.width * (baseH / baseW))) }); return; }
    if (next.height != null) { interactions.updateElement(element.id, { height: next.height, width: Math.max(1, Math.round(next.height * (baseW / baseH))) }); }
  };

  const getElementLabel = (el: HeaderElement) => getElementLabelFromRegistry(el);
  const getElementAriaLabel = (el: HeaderElement) => `${getElementLabel(el)} bei x ${el.x} Millimeter, y ${el.y} Millimeter`;
  const getElementIcon = (el: HeaderElement) => getElementIconFromRegistry(el);

  const renderColorInput = (label: string, value: string, onChange: (color: string) => void) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2">
        <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-10 border-0 bg-transparent p-0 shadow-none" />
        <span className="text-[11px] font-mono text-muted-foreground">{value.toUpperCase()}</span>
      </div>
    </div>
  );

  const renderResizeHandles = (element: HeaderElement) => {
    if (!interactions.isElementSelected(element.id)) return null;
    const handles: Array<{ key: import('@/components/canvas-engine/types').ResizeHandle; className: string; style: React.CSSProperties }> = [
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
      <div key={`${element.id}-${handle.key}`} className={`absolute w-3 h-3 bg-primary border border-primary-foreground z-10 ${handle.className}`} style={handle.style} onMouseDown={(event) => interactions.onResizeMouseDown(event, element, handle.key)} />
    ));
  };

  const renderShapeCanvas = (element: ShapeElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 20) * scaleX;
    const h = (element.height || 20) * scaleY;
    const isSelected = interactions.isElementSelected(element.id);
    const rotation = element.rotation || 0;
    const wrapperStyle: React.CSSProperties = { position: 'absolute', left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${w}px`, height: `${h}px`, transform: rotation ? `rotate(${rotation}deg)` : undefined, cursor: 'move' };

    if (element.shapeType === 'sunflower') return (<div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => interactions.onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}><SunflowerSVG width={w} height={h} />{renderResizeHandles(element)}</div>);
    if (element.shapeType === 'lion') return (<div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => interactions.onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}><LionSVG width={w} height={h} />{renderResizeHandles(element)}</div>);
    if (element.shapeType === 'wappen') return (<div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => interactions.onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}><WappenSVG width={w} height={h} />{renderResizeHandles(element)}</div>);

    return (
      <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => interactions.onElementMouseDown(e, element)} className={`${isSelected ? 'ring-2 ring-primary ring-dashed' : ''}`}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {element.shapeType === 'line' && <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={getShapeStrokeColor(element, '#000000')} strokeWidth={element.strokeWidth ?? 2} />}
          {element.shapeType === 'circle' && <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - (element.strokeWidth ?? 1)} ry={h / 2 - (element.strokeWidth ?? 1)} fill={getShapeFillColor(element, '#22c55e')} stroke={getShapeStrokeColor(element, '#15803d')} strokeWidth={element.strokeWidth ?? 1} />}
          {element.shapeType === 'rectangle' && <rect x={(element.strokeWidth ?? 1) / 2} y={(element.strokeWidth ?? 1) / 2} width={w - (element.strokeWidth ?? 1)} height={h - (element.strokeWidth ?? 1)} rx={element.borderRadius ?? 0} fill={getShapeFillColor(element, '#3b82f6')} stroke={getShapeStrokeColor(element, '#1e40af')} strokeWidth={element.strokeWidth ?? 1} />}
        </svg>
        {renderResizeHandles(element)}
      </div>
    );
  };

  const renderBlockCanvas = (element: BlockElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 45) * scaleX;
    const h = (element.height || 18) * scaleY;
    const isSelected = interactions.isElementSelected(element.id);
    const fontSize = (element.blockFontSize || 9) * (96 / 72);
    const hasContent = Boolean((element.blockContent || '').trim());
    const isEditing = editingBlockId === element.id;
    return (
      <div key={element.id} aria-label={getElementAriaLabel(element)} className={`absolute cursor-move border overflow-hidden ${isSelected ? 'border-primary border-dashed border-2 bg-primary/5' : 'border-gray-300 bg-gray-50/50'}`}
        style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${w}px`, height: `${h}px`, fontSize: `${fontSize}px`, fontFamily: element.blockFontFamily || 'Calibri', fontWeight: element.blockFontWeight || 'normal', color: element.blockColor || '#000', lineHeight: `${element.blockLineHeight || 1}` }}
        onMouseDown={(e) => interactions.onElementMouseDown(e, element)} onDoubleClick={(e) => { e.stopPropagation(); startEditingBlock(element); }}>
        {!hasContent && <div className="font-bold text-[10px] px-1 pt-0.5 opacity-70">{element.blockTitle || 'Block'}</div>}
        {isEditing ? (
          <textarea className="px-1 h-full w-full resize-none border-0 bg-transparent outline-none" value={editorDrafts[element.id] || ''} autoFocus
            onChange={(e) => setEditorDrafts((prev) => ({ ...prev, [element.id]: e.target.value }))}
            onBlur={() => commitBlockEditing(element.id)} onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancelEditing(element.id); } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); commitBlockEditing(element.id); } }} />
        ) : (<div className="px-1 whitespace-pre-line h-full">{element.blockContent || ''}</div>)}
        {renderResizeHandles(element)}
      </div>
    );
  };

  // Drag handlers for toolbox
  const onToolDragStart = (event: React.DragEvent, tool: string) => {
    event.dataTransfer.setData('application/x-header-tool', tool);
    event.dataTransfer.effectAllowed = 'copy';
    const dragPreview = document.createElement('div');
    dragPreview.style.cssText = 'position:absolute;top:-9999px;left:-9999px;padding:8px 10px;border:1px solid #16a34a;border-radius:6px;background:#ffffff;font-family:Arial,sans-serif;font-size:13px;color:#111827;max-width:240px;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:pre-line';
    dragPreview.textContent = tool === 'text' ? 'Lorem ipsum dolor sit amet' : 'Block\nDirekt auf der Canvas bearbeiten';
    document.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(dragPreview, 12, 12);
    requestAnimationFrame(() => dragPreview.remove());
  };

  const onGalleryDragStart = (event: React.DragEvent, galleryImg: { path: string; blobUrl: string }) => {
    event.dataTransfer.setData('application/x-gallery-image', JSON.stringify({ path: galleryImg.path, blobUrl: galleryImg.blobUrl }));
    event.dataTransfer.effectAllowed = 'copy';
    const imgEl = event.target as HTMLImageElement;
    if (imgEl) event.dataTransfer.setDragImage(imgEl, imgEl.width / 2, imgEl.height / 2);
  };

  const onPreviewDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvasMaxWidth, (event.clientX - rect.left) / effectiveScaleX));
    const y = Math.max(0, Math.min(canvasMaxHeight, (event.clientY - rect.top) / effectiveScaleY));

    const tool = event.dataTransfer.getData('application/x-header-tool');
    if (tool === 'text') { addTextElement(Math.round(x), Math.round(y)); return; }
    if (tool === 'block') {
      const el = createBlockElement(Math.round(x), Math.round(y));
      applyElements(prev => [...prev, el]); setSelectedElementId(el.id); return;
    }

    const variableData = event.dataTransfer.getData('application/x-variable');
    if (variableData) {
      const allVars = Object.values(BLOCK_VARIABLES).flat();
      const varDef = allVars.find(v => v.value === variableData);
      const el: HeaderElement = { id: createElementId(), type: 'text', x: Math.round(x), y: Math.round(y), content: variableData, fontSize: 10, fontFamily: 'Arial', isVariable: true, variablePreviewText: varDef?.previewText };
      applyElements(prev => [...prev, el]); setSelectedElementId(el.id); setSelectedElementIds([el.id]); return;
    }

    const plainText = event.dataTransfer.getData('text/plain');
    if (plainText && /^\{\{.+\}\}$/.test(plainText.trim())) {
      const allVars = Object.values(BLOCK_VARIABLES).flat();
      const varDef = allVars.find(v => v.value === plainText.trim());
      const el: HeaderElement = { id: createElementId(), type: 'text', x: Math.round(x), y: Math.round(y), content: plainText.trim(), fontSize: 10, fontFamily: 'Arial', isVariable: true, variablePreviewText: varDef?.previewText };
      applyElements(prev => [...prev, el]); setSelectedElementId(el.id); setSelectedElementIds([el.id]); return;
    }

    const galleryData = event.dataTransfer.getData('application/x-gallery-image');
    if (galleryData) {
      try {
        const { path, blobUrl } = JSON.parse(galleryData);
        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(path);
        const el: HeaderElement = { id: createElementId(), type: 'image', x: Math.round(x), y: Math.round(y), width: 40, height: 20, imageUrl: publicUrl, blobUrl, storagePath: path, preserveAspectRatio: true };
        applyElements(prev => [...prev, el]); setSelectedElementId(el.id); setSelectedElementIds([el.id]);
      } catch (e) { debugConsole.error('Error parsing gallery drop data:', e); }
    }
  };

  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target?.isContentEditable || editingTextId || editingBlockId) return;

    const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    if (isUndo) { event.preventDefault(); undo(); return; }
    if (isRedo) { event.preventDefault(); redo(); return; }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '?') { event.preventDefault(); setShowShortcutsHelp((p) => !p); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); interactions.copySelectedElement(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); interactions.pasteClipboardElement(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); interactions.duplicateSelectedElement(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key === ']') { if (interactions.selectedElement) { event.preventDefault(); interactions.moveElementLayer(interactions.selectedElement.id, 1); } return; }
    if ((event.metaKey || event.ctrlKey) && event.key === '[') { if (interactions.selectedElement) { event.preventDefault(); interactions.moveElementLayer(interactions.selectedElement.id, -1); } return; }
    if (event.key === 'Tab') { event.preventDefault(); interactions.cycleSelection(event.shiftKey ? -1 : 1); return; }
    if (!interactions.selectedElement) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); interactions.removeSelectedElements(); return; }
    let dx = 0, dy = 0;
    if (event.key === 'ArrowLeft') dx = -1;
    if (event.key === 'ArrowRight') dx = 1;
    if (event.key === 'ArrowUp') dy = -1;
    if (event.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    event.preventDefault();
    applyElements((prev) => prev.map((el) => {
      if (!selectedElementIds.includes(el.id)) return el;
      return { ...el, x: Math.max(0, Math.min(canvasMaxWidth, el.x + dx)), y: Math.max(0, Math.min(canvasMaxHeight, el.y + dy)) };
    }));
  };

  return (
    <div className="space-y-4">
      <CanvasToolbar
        canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
        showRuler={showRuler} onToggleRuler={() => setShowRuler((v) => !v)}
        showAxes={showCenterGuides} onToggleAxes={() => setShowCenterGuides((v) => !v)}
        showMargins={showMargins} onToggleMargins={() => setShowMargins((v) => !v)}
        canCopy={!!interactions.selectedElement} onCopy={interactions.copySelectedElement}
        canPaste={interactions.canPasteFromClipboard} onPaste={interactions.pasteClipboardElement}
        canDuplicate={!!interactions.selectedElement} onDuplicate={interactions.duplicateSelectedElement}
        trailingContent={
          <>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.selectedElement && interactions.moveElementLayer(interactions.selectedElement.id, -1)} disabled={!interactions.canMoveLayerBackward}><ArrowDown className="h-3.5 w-3.5 mr-1" />Ebene runter</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.selectedElement && interactions.moveElementLayer(interactions.selectedElement.id, 1)} disabled={!interactions.canMoveLayerForward}><ArrowUp className="h-3.5 w-3.5 mr-1" />Ebene hoch</Button>
            <Button variant={showShortcutsHelp ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowShortcutsHelp((v) => !v)}><Keyboard className="h-3.5 w-3.5 mr-1" />Shortcuts</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={zoomOut} disabled={zoomLevel <= ZOOM_STEPS[0]}>−</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoomLevel(1)}>{Math.round(zoomLevel * 100)}%</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={zoomIn} disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</Button>
            <div className="h-7 px-2 text-xs rounded border bg-background/90 flex items-center text-muted-foreground">
              Auswahl: <span className="ml-1 font-semibold text-foreground">{interactions.selectedCount}</span>
            </div>
          </>
        }
      />

      {interactions.canAlignSelection && (
        <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('left')}>Links</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('center')}>Zentrum</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('right')}>Rechts</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('top')}>Oben</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('middle')}>Mitte</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.alignSelection('bottom')}>Unten</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.distributeSelection('horizontal')} disabled={!interactions.canDistributeSelection}>Horizontal verteilen</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => interactions.distributeSelection('vertical')} disabled={!interactions.canDistributeSelection}>Vertikal verteilen</Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-3">
        <div className="xl:col-start-1 xl:row-start-1 flex flex-col gap-4">
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Elemente hinzufügen</CardTitle></CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            <Button onClick={addImageElement} className="w-full justify-start" size="sm"><ImageIcon className="h-4 w-4 mr-2" />Bild hochladen & einfügen</Button>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs">Text-Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'block')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Formen</p>
            <div className="grid grid-cols-4 gap-1">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('line')} title="Linie"><Minus className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('circle')} title="Kreis"><Circle className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('rectangle')} title="Rechteck"><Square className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('sunflower')} title="Sonnenblume"><SunflowerSVG width={14} height={14} /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('lion')} title="Löwe">
                <svg width="28" height="12" viewBox="0 0 151.80499 62.099997" xmlns="http://www.w3.org/2000/svg"><path fill="#000000" d="m 150,48.200003 c -1.4,-1.4 -3,-2.6 -4.5,-3.5 -2.5,-1.5 -4.6,-2.4 -4.6,-2.4 C 140.7,39.6 139.4,35.3 137.7,31.3 c -1,-2.3 -2.2,-4.5 -3.5,-6.1 l 0.3,0.3 c 4.1,-1 7.1,-5.3 6.8,-10.2 -0.4,-6.1 -6.1,-12.5 -19.7,-9.8000004 -5,1 -9,2.4 -12.9,4.0000004 -4,1.7 -7.9,3.5 -12.499996,5.1 C 91.500004,16.2 87.6,17 84.5,16.7 81.7,16.5 79.6,15.4 78.4,13.6 76.7,11.1 79.2,8.4999996 80.2,7.7999996 82.1,6.5999996 83.8,4.5 82.8,1 c -1.8,0.3 -5,1.4 -7.6,3.4 -2.1,1.5999996 -3.8,3.8999996 -3.8,7 0.1,4.2 3,7.5 7.8,8.6 3.2,0.7 5.8,1 8.8,0.6 4.300004,-0.6 9.700004,-2.5 19.3,-6.1 9,-3.4 14,-4.9 17.9,-5.1 2.5,-0.1 4.4,0.2 6.6,1 1.4,0.5 2.3,1.3 3,2.1 0.8,1 1,2.2 1,3.3 -0.2,2.1 -1.7,4.1 -4,4.6 h -1.7 c -0.7,-0.1 -1.5,-0.2 -2.4,-0.4 -2.6,-0.5 -6.1,-1.1 -11.6,-0.5 -3.3,0.3 -7.3,1.1 -12.2,2.7 C 93.700004,25.5 86,26.8 80.1,27 71.7,27.3 66.8,25.4 63,23.9 62.6,20.2 61.8,17.2 60.7,14.8 59,10.9 56.7,8.3999996 55.2,7.0999996 c 0,0 0.9,-0.5 1.3,-3.4999996 -2.2,-0.4 -5.2,0.8 -5.2,0.8 0,0 -5.6,-3.6 -13.2,-2.3 C 35.2,2.6 33.8,3.4 33,4.7 26.9,6.8999996 26.4,7.2999996 24.9,8.1999996 24,8.8999996 24,9.4 24,9.9 c 0,0.5 0.3,0.8 0.4,0.9 0.2,0.2 0.3,0.4 0.3,0.7 0.1,1.7 0.1,2.3 0.6,3.7 0.2,0.6 0.8,0.5 1.4,0.3 4,-1.5 5.7,0.4 5.7,2.1 0,1.5 -0.8,2.9 -3.7,3.1 h -1.3 c -0.4,0 -0.7,0 -0.7,0.6 0,0.4 0.9,2.7 1,3.1 0.4,1.2 0.7,1.4 1.7,1.4 1.9,0 4.4,-0.5 5.2,-0.7 0,0 -0.1,2.5 0.7,5.8 -6.7,-2.5 -11.8,-3.2 -17.5,-3 -5.6,0.2 -9.4,1.4 -11.9,2.8 -4.5,2.5 -4.9,5.7 -4.9,5.7 0,0 6.5,1.5 9.2,0.8 1.8,-0.6 3,-2.3 3,-2.3 0,0 4.3,0.9 9.9,3.9 2.8,1.5 6,3.500003 9.2,6.300003 0.1,0 7.5,-2.9 7.8,-3 0.2,-0.1 0.4,-0.1 0.6,0.2 0.2,0.2 0.1,0.5 -0.1,0.6 -0.7,0.6 -5.2,3.6 -9.8,6.3 -3,1.8 -6.2,3.7 -9,5.4 -2.2,-0.3 -3.2,-0.3 -5.2,-0.3 -4.4,0.1 -7.3,3.9 -7.3,6.7 h 17 c 0.7,-0.2 7.8,-1.7 15,-3.1 5.2,-1 10.4,-2 13.3,-2.6 1.3,-0.2 1.9,-0.4 2.2,-0.4 0.5,-0.1 0.9,-0.2 1.4,-0.6 0.2,-0.2 0.4,-0.5 0.6,-1 0.1,-0.4 0.7,-2.1 0.7,-2.1 l 3.7,-0.4 c 4.9,-0.4 9.3,-1.4 13.3,-2.7 5.1,-1.6 9.5,-3.7 13.3,-5.5 C 94.500004,40.4 98.400004,38.5 101.7,38.4 c -0.5,3.300003 0.3,5.900003 0.8,8.400003 0.5,2.4 0.8,4.8 -0.5,7.7 -9.899996,0 -8.799996,6.6 -8.799996,6.6 H 110.3 c 0,0 1.2,-3.8 4,-8.2 1.4,-2.1 3.2,-4.4 5.4,-6.4 0.4,-0.4 0.3,-0.8 0.1,-1.1 -1.9,-2.4 -2.9,-6.900003 -3.1,-7.800003 v -0.2 c 0,-0.2 0,-0.5 0.3,-0.5 0.3,-0.1 0.5,0 0.5,0.2 0.1,0.1 0.1,0.2 0.1,0.3 0,0.2 0.2,0.4 0.2,0.6 0.1,0.4 0.4,1 0.8,1.7 0.8,1.400003 1.9,3.000003 3.6,4.600003 2.2,2.1 5,3.7 7.7,5 3.3,1.5 6.6,2.6 9,3.3 2.8,0.8 3.1,1.7 3.1,2 h -1.2 c -1.4,0.2 -3,0.3 -4.9,2.1 -1.9,1.8 -1.5,4.3 -1.5,4.3 h 11.8 c 1.5,0 2.1,-0.9 2.6,-2.6 0.3,-1.1 1.7,-6.7 1.8,-7.1 0.5,-1.7 0,-2.6 -0.6,-3.1 z M 34.4,6.7999996 c 1.2,-0.8 2.9,-1 4.2,-0.8 -0.1,2.5 -3.5,3.1000004 -4.2,0.8 z"/></svg>
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('wappen')} title="Landeswappen BW">
                <img src="/assets/wappen-bw.svg" width={20} height={12} alt="Wappen" style={{ objectFit: 'contain' }} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> Bilder-Galerie</CardTitle>
              <Button variant="ghost" size="sm" onClick={gallery.handleGalleryUpload} className="h-7 px-2"><Upload className="h-3 w-3 mr-1" /> Hochladen</Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {gallery.galleryLoading ? (
              <p className="text-xs text-muted-foreground">Lade Bilder...</p>
            ) : gallery.galleryImages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Bilder hochgeladen.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {gallery.galleryImages.map((img) => (
                    <div key={img.path} className={`relative group border rounded overflow-hidden aspect-square bg-muted/30 cursor-pointer ${gallery.selectedGalleryImage?.path === img.path ? 'ring-2 ring-primary' : ''}`} onClick={() => gallery.setSelectedGalleryImage(img)}>
                      <img src={img.blobUrl} alt={img.name} className="w-full h-full object-contain" draggable onDragStart={(e) => onGalleryDragStart(e, img)} title={`${img.name} — Klicken zum Auswählen oder ziehen`} />
                      <button onClick={(e) => { e.stopPropagation(); gallery.deleteGalleryImage(img); if (gallery.selectedGalleryImage?.path === img.path) gallery.setSelectedGalleryImage(null); }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
                {gallery.selectedGalleryImage && (
                  <div className="space-y-2">
                    <div className="border border-dashed border-muted-foreground/30 rounded-md p-2 flex items-center justify-center bg-muted/10 min-h-[80px]">
                      <img src={gallery.selectedGalleryImage.blobUrl} alt={gallery.selectedGalleryImage.name} className="max-h-[80px] max-w-full object-contain" />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{gallery.selectedGalleryImage.name}</p>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={() => { addImageFromGallery(gallery.selectedGalleryImage!); gallery.setSelectedGalleryImage(null); }}>
                      <ImageIcon className="h-3 w-3 mr-1" /> In Canvas einfügen
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="xl:col-start-1 xl:row-start-2 flex flex-col gap-6">
          {actionButtons && (
            <Card className="self-start">
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Bearbeitung</CardTitle></CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-2">{actionButtons}</CardContent>
            </Card>
          )}

        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Elemente bearbeiten ({elements.length})</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              elements.map((element) => (
                <div key={element.id} role="button" tabIndex={0} aria-pressed={interactions.isElementSelected(element.id)}
                  aria-label={`Element auswählen: ${getElementLabel(element)}`}
                  className={`group p-2 border rounded cursor-pointer transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${interactions.isElementSelected(element.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={(event) => { if (interactions.isToggleModifierPressed(event)) { toggleSelect(element.id); return; } selectOne(element.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOne(element.id); } }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">{getElementIcon(element)}<span className="font-medium truncate">{getElementLabel(element)}</span></div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => { e.stopPropagation(); interactions.removeElement(element.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                  <p className="text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>

                  {interactions.isElementSelected(element.id) && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">X (mm)</Label><Input type="number" value={element.x} onChange={(e) => interactions.updateElement(element.id, { x: interactions.validatePosition(parseFloat(e.target.value) || 0, canvasMaxWidth) })} className="h-7 text-xs" /></div>
                        <div><Label className="text-xs">Y (mm)</Label><Input type="number" value={element.y} onChange={(e) => interactions.updateElement(element.id, { y: interactions.validatePosition(parseFloat(e.target.value) || 0, canvasMaxHeight) })} className="h-7 text-xs" /></div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Label className="text-xs">Text</Label>
                          <Input value={element.content || ''} onChange={(e) => interactions.updateElement(element.id, { content: e.target.value })} placeholder="Text" className="h-7 text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.fontSize || 12} onChange={(e) => interactions.updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.color || '#000000', (color) => interactions.updateElement(element.id, { color }))}
                          </div>
                          <div><Label className="text-xs">Schriftart</Label>
                          <Select value={element.fontFamily || 'Arial'} onValueChange={(value) => interactions.updateElement(element.id, { fontFamily: value })}>
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
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })}>U</Button>
                          </div>
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.textLineHeight || 1.2} onChange={(e) => interactions.updateElement(element.id, { textLineHeight: parseFloat(e.target.value) || 1.2 })} className="h-7 text-xs" /></div>
                          <div><Label className="text-xs">Ausrichtung</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'left' || !(element as TextElement).textAlign ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { textAlign: 'left' })}>L</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'center' ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { textAlign: 'center' })}>M</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'right' ? 'default' : 'outline'} onClick={() => interactions.updateElement(element.id, { textAlign: 'right' })}>R</Button>
                          </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={element.width ?? ''} placeholder="Auto" onChange={(e) => interactions.updateElement(element.id, { width: e.target.value ? parseFloat(e.target.value) || undefined : undefined })} className="h-7 text-xs flex-1" />
                                {element.width != null && <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => interactions.updateElement(element.id, { width: undefined })}>Auto</Button>}
                              </div>
                            </div>
                            <div><Label className="text-xs">Höhe (mm)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={element.height ?? ''} placeholder="Auto" onChange={(e) => interactions.updateElement(element.id, { height: e.target.value ? parseFloat(e.target.value) || undefined : undefined })} className="h-7 text-xs flex-1" />
                                {element.height != null && <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => interactions.updateElement(element.id, { height: undefined })}>Auto</Button>}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 50} onChange={(e) => updateImageSize(element, { width: parseFloat(e.target.value) || 50 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 30} onChange={(e) => updateImageSize(element, { height: parseFloat(e.target.value) || 30 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`preserve-${element.id}`} checked={element.preserveAspectRatio || false} onCheckedChange={(checked) => interactions.updateElement(element.id, { preserveAspectRatio: checked as boolean })} />
                            <Label htmlFor={`preserve-${element.id}`} className="text-xs">Seitenverhältnis</Label>
                          </div>
                        </>
                      )}
                      {element.type === 'shape' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 20} onChange={(e) => interactions.updateElement(element.id, { width: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 20} onChange={(e) => interactions.updateElement(element.id, { height: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                          </div>
                          {element.shapeType !== 'sunflower' && element.shapeType !== 'lion' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {renderColorInput('Füllfarbe', getShapeFillColor(element), (fillColor) => interactions.updateElement(element.id, { fillColor }))}
                                {renderColorInput('Randfarbe', getShapeStrokeColor(element), (strokeColor) => interactions.updateElement(element.id, { strokeColor }))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div><Label className="text-xs">Strichstärke</Label><Input type="number" value={element.strokeWidth || 1} onChange={(e) => interactions.updateElement(element.id, { strokeWidth: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" min={0} max={10} /></div>
                                {element.shapeType === 'rectangle' && (<div><Label className="text-xs">Rundung</Label><Input type="number" value={element.borderRadius || 0} onChange={(e) => interactions.updateElement(element.id, { borderRadius: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" min={0} /></div>)}
                              </div>
                            </>
                          )}
                          <div><Label className="text-xs">Rotation (°)</Label><Input type="number" value={element.rotation || 0} onChange={(e) => interactions.updateElement(element.id, { rotation: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                      {element.type === 'block' && (
                        <>
                          <div><Label className="text-xs">Titel</Label><Input value={element.blockTitle || ''} onChange={(e) => interactions.updateElement(element.id, { blockTitle: e.target.value })} className="h-7 text-xs" /></div>
                          <div><Label className="text-xs">Inhalt</Label>
                            <Textarea value={element.blockContent || ''} onChange={(e) => interactions.updateElement(element.id, { blockContent: e.target.value })} className="min-h-[84px] text-xs leading-tight" placeholder={"Eine Zeile pro Information, z. B.\n{{datum}}\n{{aktenzeichen}}\n{{telefon}}"} />
                            <p className="mt-1 text-[10px] text-muted-foreground">Zeilenumbrüche werden in der Vorschau und im Export übernommen.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 45} onChange={(e) => interactions.updateElement(element.id, { width: parseFloat(e.target.value) || 45 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 18} onChange={(e) => interactions.updateElement(element.id, { height: parseFloat(e.target.value) || 18 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.blockFontSize || 9} onChange={(e) => interactions.updateElement(element.id, { blockFontSize: parseInt(e.target.value) || 9 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.blockColor || '#000000', (blockColor) => interactions.updateElement(element.id, { blockColor }))}
                          </div>
                          <div><Label className="text-xs">Schriftart</Label>
                            <Select value={element.blockFontFamily || 'Calibri'} onValueChange={(value) => interactions.updateElement(element.id, { blockFontFamily: value })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Calibri">Calibri</SelectItem><SelectItem value="Cambria">Cambria</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.blockLineHeight || 1} onChange={(e) => interactions.updateElement(element.id, { blockLineHeight: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" /></div>
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

        {(() => {
          const variables = BLOCK_VARIABLES[blockKey || 'header'] || [];
          if (variables.length === 0) return null;
          return (
            <div className="xl:col-start-1 xl:row-start-3">
              <Card>
                <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">⚡ Variablen</CardTitle></CardHeader>
                <CardContent className="p-3 pt-0 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">Auf Canvas ziehen zum Einfügen</p>
                  {variables.map((v) => (
                    <div key={v.value} draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-variable', v.value); e.dataTransfer.setData('text/plain', v.value); e.dataTransfer.effectAllowed = 'copy'; }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs cursor-grab hover:bg-amber-100 transition-colors">
                      <span>⚡</span><span className="font-medium">{v.label}</span><span className="text-amber-500 ml-auto text-[10px]">{v.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        })()}

        <CardContent className="xl:col-start-2 xl:row-start-1 xl:row-span-4 min-w-0 space-y-2 p-3 pt-4">
            <h3 className="text-sm font-semibold">Header-Vorschau</h3>
            <p className="text-xs text-muted-foreground">Doppelklick auf Text/Block zum Bearbeiten. Mit Mausrad + Strg/Cmd zoomen.</p>
            <div ref={previewContainerRef} className="border rounded-lg p-4 bg-muted/20 overflow-auto outline-none" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="relative mx-auto" style={{ paddingLeft: 28, paddingTop: 28, width: canvasPixelWidth + 28, height: canvasPixelHeight + 28 }}>
              <div className={`absolute top-0 left-7 h-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`} style={{ width: canvasPixelWidth }}>
                  <canvas ref={horizontalRulerRef} width={Math.round(canvasPixelWidth)} height={28} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: Math.floor(canvasMaxWidth / 10) + 1 }).map((_, i) => (<span key={`label-x-${i}`} className="absolute top-0" style={{ left: `${(i * 10 * canvasPixelWidth) / canvasMaxWidth}px` }}>{i * 10}</span>))}
                </div>
                <div className={`absolute top-7 left-0 w-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`} style={{ height: canvasPixelHeight }}>
                  <canvas ref={verticalRulerRef} width={28} height={Math.round(canvasPixelHeight)} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: Math.floor(canvasMaxHeight / 10) + 1 }).map((_, i) => (<span key={`label-y-${i}`} className="absolute left-0" style={{ top: `${(i * 10 * canvasPixelHeight) / canvasMaxHeight}px` }}>{i * 10}</span>))}
                </div>

            <div ref={previewRef} tabIndex={0} role="application"
              aria-label="Header-Vorschau. Mit Shift- oder Cmd/Ctrl-Klick mehrfach auswählen, leere Fläche ziehen erstellt Auswahlrechteck, Alt beim Ziehen wählt nur vollständig enthaltene Elemente, mit Tab durch Elemente wechseln, mit Pfeiltasten Auswahl bewegen, Entf löscht, Strg+Z rückgängig, Strg+C/V kopiert und fügt ein, Strg+] bzw. Strg+[ ändert die Ebene, Strg+Shift+? öffnet die Shortcut-Hilfe."
              onKeyDown={onPreviewKeyDown} onDragOver={(e) => e.preventDefault()} onMouseDown={interactions.onPreviewMouseDown}
              onDrop={onPreviewDrop} onMouseMove={interactions.onPreviewMouseMove} onMouseUp={interactions.onPreviewMouseUp}
              onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
              className="border border-gray-300 bg-white relative outline-none" style={{ width: `${canvasPixelWidth}px`, height: `${canvasPixelHeight}px` }}>
              <span className="sr-only" aria-live="polite">{ariaAnnouncement}</span>
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: `${10 * effectiveScaleX}px ${10 * effectiveScaleY}px` }}>
              {showCenterGuides && (<><div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" /><div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" /></>)}
              {showMargins && marginGuides.map((guide) => (
                <React.Fragment key={guide.key}>
                  {guide.orientation === 'vertical' ? (<><div className="absolute top-0 bottom-0 border-l border-dashed pointer-events-none z-10" style={{ left: `${guide.pos}px`, borderColor: guide.color }} /><div className="absolute top-1 rounded bg-background/90 px-1 py-0 text-[10px] text-muted-foreground pointer-events-none z-10" style={{ left: `${Math.min(Math.max(guide.pos + 2, 2), Math.max(canvasPixelWidth - 42, 2))}px` }}>{guide.label}</div></>) : (<><div className="absolute left-0 right-0 border-t border-dashed pointer-events-none z-10" style={{ top: `${guide.pos}px`, borderColor: guide.color }} /><div className="absolute left-1 rounded bg-background/90 px-1 py-0 text-[10px] text-muted-foreground pointer-events-none z-10" style={{ top: `${Math.min(Math.max(guide.pos + 2, 2), Math.max(canvasPixelHeight - 18, 2))}px` }}>{guide.label}</div></>)}
                </React.Fragment>
              ))}

              {interactions.snapLines.x != null && (<><div className="absolute top-0 bottom-0 border-l-2 border-emerald-500/90 pointer-events-none animate-pulse" style={{ left: `${interactions.snapLines.x * effectiveScaleX}px` }} /><div className="absolute top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ left: `${interactions.snapLines.x * effectiveScaleX + 2}px` }}>{Math.round(interactions.snapLines.x)}mm</div></>)}
              {interactions.snapLines.y != null && (<><div className="absolute left-0 right-0 border-t-2 border-emerald-500/90 pointer-events-none animate-pulse" style={{ top: `${interactions.snapLines.y * effectiveScaleY}px` }} /><div className="absolute left-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ top: `${interactions.snapLines.y * effectiveScaleY + 2}px` }}>{Math.round(interactions.snapLines.y)}mm</div></>)}

              {(interactions.smartGuideDistance.horizontal != null || interactions.smartGuideDistance.vertical != null) && (
                <div className="absolute bottom-2 left-2 z-10 rounded bg-emerald-600/90 px-2 py-1 text-[10px] text-white pointer-events-none">
                  {interactions.smartGuideDistance.horizontal != null && <span>ΔX {interactions.smartGuideDistance.horizontal}mm </span>}
                  {interactions.smartGuideDistance.vertical != null && <span>ΔY {interactions.smartGuideDistance.vertical}mm</span>}
                </div>
              )}

              {elements.map((element) => {
                const scaleX = effectiveScaleX;
                const scaleY = effectiveScaleY;
                if (element.type === 'text') return (<TextCanvasElement key={element.id} element={element} scaleX={scaleX} scaleY={scaleY} isSelected={interactions.isElementSelected(element.id)} isEditing={editingTextId === element.id} draftValue={editorDrafts[element.id] || ''} onMouseDown={interactions.onElementMouseDown} onDoubleClick={(event, item) => { event.stopPropagation(); startEditingText(item); }} onDraftChange={(id, value) => setEditorDrafts((prev) => ({ ...prev, [id]: value }))} onCommitEdit={commitTextEditing} onCancelEdit={cancelEditing} ariaLabel={getElementAriaLabel(element)} renderResizeHandles={renderResizeHandles} />);
                if (element.type === 'image') return (<ImageCanvasElement key={element.id} element={element} scaleX={scaleX} scaleY={scaleY} isSelected={interactions.isElementSelected(element.id)} ariaLabel={getElementAriaLabel(element)} onMouseDown={interactions.onElementMouseDown} renderResizeHandles={renderResizeHandles} />);
                if (element.type === 'shape') return renderShapeCanvas(element, scaleX, scaleY);
                if (element.type === 'block') return renderBlockCanvas(element, scaleX, scaleY);
                return null;
              })}
              </div>

              {interactions.selectionBox && (
                <div className="absolute border border-primary/80 bg-primary/10 pointer-events-none" style={{
                  left: `${Math.min(interactions.selectionBox.startX, interactions.selectionBox.currentX)}px`,
                  top: `${Math.min(interactions.selectionBox.startY, interactions.selectionBox.currentY)}px`,
                  width: `${Math.abs(interactions.selectionBox.currentX - interactions.selectionBox.startX)}px`,
                  height: `${Math.abs(interactions.selectionBox.currentY - interactions.selectionBox.startY)}px`,
                }} />
              )}

              {showShortcutsHelp && (
                <div className="absolute right-3 top-3 z-20 w-72 rounded-md border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
                  <div className="mb-2 font-semibold">Tastatur-Shortcuts</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><span className="font-medium text-foreground">Shift/Cmd/Ctrl + Klick</span> Mehrfachauswahl</li>
                    <li><span className="font-medium text-foreground">Leere Fläche ziehen</span> Auswahlrechteck</li>
                    <li><span className="font-medium text-foreground">Alt + Ziehen</span> Nur vollständig enthaltene Elemente</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + Mausrad</span> Zoom</li>
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
            </div>
          </div>
          </div>
        </CardContent>
    </div>
    </div>
  );
};
