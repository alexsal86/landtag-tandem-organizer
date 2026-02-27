import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ZoomIn, ZoomOut, Trash2, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';
import { CSS_PX_PER_MM } from '@/lib/units';
import { SunflowerSVG, LionSVG, WappenSVG } from '@/components/letters/elements/shapeSVGs';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

type BlockKey = 'header' | 'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments' | 'pagination';
type EditorTab = 'header-designer' | 'footer-designer' | 'layout-settings' | 'general' | 'block-address' | 'block-info' | 'block-subject' | 'block-content' | 'block-attachments';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'block';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  blockContent?: string;
  imageUrl?: string;
  blobUrl?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textLineHeight?: number;
  shapeType?: 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

interface BlockConfig {
  key: BlockKey;
  label: string;
  color: string;
  canMoveX?: boolean;
  canResize?: boolean;
  jumpTo: EditorTab;
  isCustom?: boolean;
}

interface Props {
  layoutSettings: LetterLayoutSettings;
  onLayoutChange: (settings: LetterLayoutSettings) => void;
  onJumpToTab?: (tab: EditorTab) => void;
  headerElements?: CanvasElement[];
  actionButtons?: React.ReactNode;
}

const DEFAULT_BLOCKS: BlockConfig[] = [
  { key: 'header', label: 'Header', color: 'bg-cyan-500/20 border-cyan-600 text-cyan-900', jumpTo: 'header-designer' },
  { key: 'addressField', label: 'Adressfeld', color: 'bg-blue-500/20 border-blue-600 text-blue-900', canMoveX: true, canResize: true, jumpTo: 'block-address' },
  { key: 'infoBlock', label: 'Info-Block', color: 'bg-purple-500/20 border-purple-600 text-purple-900', canMoveX: true, canResize: true, jumpTo: 'block-info' },
  { key: 'content', label: 'Inhaltsbereich', color: 'bg-orange-500/20 border-orange-600 text-orange-900', canResize: true, jumpTo: 'layout-settings' },
  { key: 'attachments', label: 'Anlagen', color: 'bg-amber-500/20 border-amber-600 text-amber-900', jumpTo: 'block-attachments' },
  { key: 'pagination', label: 'Paginierung', color: 'bg-rose-500/20 border-rose-600 text-rose-900', jumpTo: 'layout-settings' },
  { key: 'footer', label: 'Footer', color: 'bg-pink-500/20 border-pink-600 text-pink-900', jumpTo: 'footer-designer' },
];

const COLOR_PRESETS = [
  { value: 'bg-cyan-500/20 border-cyan-600 text-cyan-900', label: 'Cyan' },
  { value: 'bg-blue-500/20 border-blue-600 text-blue-900', label: 'Blau' },
  { value: 'bg-indigo-500/20 border-indigo-600 text-indigo-900', label: 'Indigo' },
  { value: 'bg-purple-500/20 border-purple-600 text-purple-900', label: 'Lila' },
  { value: 'bg-green-500/20 border-green-600 text-green-900', label: 'Grün' },
  { value: 'bg-orange-500/20 border-orange-600 text-orange-900', label: 'Orange' },
  { value: 'bg-amber-500/20 border-amber-600 text-amber-900', label: 'Amber' },
  { value: 'bg-pink-500/20 border-pink-600 text-pink-900', label: 'Pink' },
  { value: 'bg-red-500/20 border-red-600 text-red-900', label: 'Rot' },
  { value: 'bg-teal-500/20 border-teal-600 text-teal-900', label: 'Teal' },
];

const BASE_SCALE = CSS_PX_PER_MM;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PAGINATION_PREVIEW_WIDTH_MM = 18;
const snapMm = (val: number) => Math.round(val);
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

const renderCanvasElementPreview = (element: CanvasElement, left: number, top: number, scale: number, plainPreview = false) => {
  const width = (element.width || (element.type === 'image' ? 30 : 50)) * scale;
  const height = (element.height || (element.type === 'text' ? 8 : element.type === 'block' ? 18 : 10)) * scale;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: left + element.x * scale,
    top: top + element.y * scale,
    width,
    height,
    pointerEvents: 'none',
    overflow: 'hidden',
  };

  if (element.type === 'image') {
    const src = element.imageUrl || element.blobUrl;
    if (!src) return null;
    return <img key={element.id} src={src} alt="Bild" style={style} className="object-contain" />;
  }

  if (element.type === 'shape') {
    const strokeWidth = element.strokeWidth ?? 1;

    if (element.shapeType === 'sunflower') {
      return (
        <div key={element.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SunflowerSVG width={width} height={height} />
        </div>
      );
    }

    if (element.shapeType === 'lion') {
      return (
        <div key={element.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LionSVG width={width} height={height} />
        </div>
      );
    }

    if (element.shapeType === 'wappen') {
      return <img key={element.id} src="/assets/wappen-bw.svg" alt="Wappen" style={style} className="object-contain" />;
    }
    if (element.shapeType === 'line') {
      return (
        <svg key={element.id} style={style} viewBox={`0 0 ${width} ${height}`}>
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={element.strokeColor || element.color || '#111827'} strokeWidth={strokeWidth} />
        </svg>
      );
    }
    if (element.shapeType === 'circle') {
      return (
        <svg key={element.id} style={style} viewBox={`0 0 ${width} ${height}`}>
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={Math.max(1, width / 2 - strokeWidth)}
            ry={Math.max(1, height / 2 - strokeWidth)}
            fill={element.fillColor || '#dcfce7'}
            stroke={element.strokeColor || element.color || '#166534'}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    }
    return (
      <svg key={element.id} style={style} viewBox={`0 0 ${width} ${height}`}>
        <rect
          x={strokeWidth / 2}
          y={strokeWidth / 2}
          width={Math.max(1, width - strokeWidth)}
          height={Math.max(1, height - strokeWidth)}
          rx={element.borderRadius || 0}
          fill={element.fillColor || '#dbeafe'}
          stroke={element.strokeColor || element.color || '#1d4ed8'}
          strokeWidth={strokeWidth}
        />
      </svg>
    );
  }

  if (element.type === 'block') {
    return (
      <div
        key={element.id}
        style={{ ...style, fontSize: `${Math.max(9, 10 * scale)}px`, lineHeight: `${1.2}` }}
        className={`px-1 py-0.5 text-gray-700 whitespace-pre-wrap ${plainPreview ? '' : 'border border-gray-400/70 bg-gray-100/50'}`}
      >
        {element.blockContent || element.content}
      </div>
    );
  }

  const isVariable = (element as any).isVariable === true;
  const displayText = isVariable && (element as any).variablePreviewText
    ? (element as any).variablePreviewText
    : element.content;

  return (
    <div
      key={element.id}
      style={{
        ...style,
        fontSize: `${(element.fontSize || 11) * (25.4 / 72) * scale}px`,
        fontFamily: element.fontFamily || 'Arial',
        fontWeight: element.fontWeight || 'normal',
        fontStyle: element.fontStyle || 'normal',
        textDecoration: element.textDecoration || 'none',
        color: plainPreview ? (element.color || '#111827') : (isVariable ? '#b45309' : (element.color || '#111827')),
        lineHeight: `${element.textLineHeight || 1.2}`,
        textAlign: (element as any).textAlign || 'left',
        whiteSpace: 'pre-wrap',
        backgroundColor: !plainPreview && isVariable ? 'rgba(251, 191, 36, 0.15)' : undefined,
        borderRadius: !plainPreview && isVariable ? '4px' : undefined,
        padding: !plainPreview && isVariable ? '1px 4px' : undefined,
      }}
      className="text-gray-800"
    >
      {!plainPreview && isVariable && <span className="mr-0.5">⚡</span>}
      {displayText}
    </div>
  );
};

const cloneLayout = (layout: LetterLayoutSettings): LetterLayoutSettings => ({
  ...layout,
  margins: { ...layout.margins },
  header: { ...layout.header },
  addressField: { ...layout.addressField },
  infoBlock: { ...layout.infoBlock },
  subject: { ...layout.subject },
  content: { ...layout.content },
  footer: { ...layout.footer, height: layout.footer?.height ?? DEFAULT_DIN5008_LAYOUT.footer.height },
  attachments: { ...layout.attachments },
  pagination: layout.pagination ? { ...layout.pagination } : { enabled: true, top: 263.77, align: 'right', fontSize: 8 },
  closing: layout.closing ? { ...layout.closing } : undefined,
  blockContent: { ...(layout.blockContent || {}) },
  disabledBlocks: [...(layout.disabledBlocks || [])],
  lockedBlocks: [...(layout.lockedBlocks || [])],
});

const getDisabled = (layout: LetterLayoutSettings): BlockKey[] => (layout.disabledBlocks || []) as BlockKey[];
const getLocked = (layout: LetterLayoutSettings): BlockKey[] => (layout.lockedBlocks || []) as BlockKey[];

export function LetterLayoutCanvasDesigner({ layoutSettings, onLayoutChange, onJumpToTab, headerElements = [], actionButtons }: Props) {
  const { currentTenant } = useTenant();
  const [blocks, setBlocks] = useState<BlockConfig[]>(() => [...DEFAULT_BLOCKS]);
  const [selected, setSelected] = useState<BlockKey>('addressField');
  const [dragging, setDragging] = useState<{ key: BlockKey; startX: number; startY: number; orig: Rect; mode: 'move' | 'resize' } | null>(null);
  const [localLayout, setLocalLayout] = useState<LetterLayoutSettings>(() => cloneLayout(layoutSettings));
  const [templateDefaults, setTemplateDefaults] = useState<Record<string, string>>({});
  const [showRuler, setShowRuler] = useState(false);
  const [plainPreview, setPlainPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedLabel, setSelectedLabel] = useState('');
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const RULER_SIZE = 24;

  const SCALE = BASE_SCALE * zoomLevel;

  useEffect(() => setLocalLayout(cloneLayout(layoutSettings)), [layoutSettings]);

  useEffect(() => {
    const fetchTemplateDefaults = async () => {
      if (!currentTenant?.id) {
        setTemplateDefaults({});
        return;
      }

      const { data } = await supabase
        .from('letter_template_settings' as any)
        .select('variable_defaults')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      setTemplateDefaults(((data as any)?.variable_defaults || {}) as Record<string, string>);
    };

    fetchTemplateDefaults();
  }, [currentTenant?.id]);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_STEPS.indexOf(z);
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_STEPS.indexOf(z);
      return idx > 0 ? ZOOM_STEPS[idx - 1] : z;
    });
  }, []);

  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const container = el;
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + container.scrollLeft;
      const cursorY = e.clientY - rect.top + container.scrollTop;

      const currentScale = BASE_SCALE * zoomLevelRef.current;
      const mmX = (cursorX - RULER_SIZE) / currentScale;
      const mmY = (cursorY - RULER_SIZE) / currentScale;

      const currentIdx = ZOOM_STEPS.indexOf(zoomLevelRef.current);
      const nextZoom = e.deltaY < 0
        ? (currentIdx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[currentIdx + 1] : zoomLevelRef.current)
        : (currentIdx > 0 ? ZOOM_STEPS[currentIdx - 1] : zoomLevelRef.current);

      if (nextZoom === zoomLevelRef.current) return;
      setZoomLevel(nextZoom);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newScale = BASE_SCALE * nextZoom;
          const newCursorX = mmX * newScale + RULER_SIZE;
          const newCursorY = mmY * newScale + RULER_SIZE;
          container.scrollLeft = newCursorX - (e.clientX - rect.left);
          container.scrollTop = newCursorY - (e.clientY - rect.top);
        });
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const disabledBlocks = useMemo(() => new Set(getDisabled(localLayout)), [localLayout]);
  const lockedBlocks = useMemo(() => new Set(getLocked(localLayout)), [localLayout]);
  const contentWidth = localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right;
  const pagePx = { w: localLayout.pageWidth * SCALE, h: localLayout.pageHeight * SCALE };
  const blockContent = localLayout.blockContent || {};

  const getRect = (key: BlockKey): Rect => {
    const pag = localLayout.pagination || { enabled: true, top: 263.77, align: 'right', fontSize: 8 };
    switch (key) {
      case 'header':
        return { x: 0, y: 0, w: localLayout.pageWidth, h: localLayout.header.height };
      case 'addressField':
        return { x: localLayout.addressField.left, y: localLayout.addressField.top, w: localLayout.addressField.width, h: localLayout.addressField.height };
      case 'infoBlock':
        return { x: localLayout.infoBlock.left, y: localLayout.infoBlock.top, w: localLayout.infoBlock.width, h: localLayout.infoBlock.height };
      case 'subject':
        return { x: localLayout.margins.left, y: localLayout.subject.top, w: contentWidth, h: Math.max(8, localLayout.subject.marginBottom + 4) };
      case 'content':
        return { x: localLayout.margins.left, y: localLayout.content.top, w: contentWidth, h: localLayout.content.maxHeight };
      case 'footer':
        return { x: localLayout.margins.left, y: localLayout.footer.top, w: contentWidth, h: localLayout.footer.height };
      case 'attachments':
        return { x: localLayout.margins.left, y: localLayout.attachments.top, w: contentWidth, h: 8 };
      case 'pagination': {
        const x = pag.align === 'left'
          ? localLayout.margins.left
          : localLayout.pageWidth - localLayout.margins.right - PAGINATION_PREVIEW_WIDTH_MM;
        return { x, y: pag.top, w: PAGINATION_PREVIEW_WIDTH_MM, h: 4 };
      }
    }
  };

  const updateByRect = (key: BlockKey, rect: Rect) => {
    setLocalLayout((prev) => {
      const next = cloneLayout(prev);
      if (key === 'header') next.header.height = clamp(snapMm(rect.h), 20, 70);
      else if (key === 'addressField') Object.assign(next.addressField, { left: snapMm(rect.x), top: snapMm(rect.y), width: snapMm(rect.w), height: snapMm(rect.h) });
      else if (key === 'infoBlock') Object.assign(next.infoBlock, { left: snapMm(rect.x), top: snapMm(rect.y), width: snapMm(rect.w), height: snapMm(rect.h) });
      else if (key === 'subject') {
        next.subject.top = snapMm(rect.y);
        next.subject.marginBottom = clamp(snapMm(rect.h - 4), 2, 40);
      } else if (key === 'content') {
        next.content.top = snapMm(rect.y);
        next.content.maxHeight = clamp(snapMm(rect.h), 20, 500);
      } else if (key === 'footer') Object.assign(next.footer, { top: snapMm(rect.y), height: clamp(snapMm(rect.h), 8, 80) });
      else if (key === 'attachments') next.attachments.top = snapMm(rect.y);
      else if (key === 'pagination') {
        next.pagination = { ...(next.pagination || { enabled: true, align: 'right', fontSize: 8, top: 263.77 }), top: snapMm(rect.y) };
      }
      return next;
    });
  };

  const startDrag = (event: React.MouseEvent, key: BlockKey, mode: 'move' | 'resize') => {
    if (plainPreview || disabledBlocks.has(key) || lockedBlocks.has(key)) return;
    event.preventDefault();
    event.stopPropagation();
    canvasWrapRef.current?.focus();
    const rect = getRect(key);
    setSelected(key);
    setDragging({ key, mode, startX: event.clientX, startY: event.clientY, orig: rect });
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!dragging) return;
    const dxMm = (event.clientX - dragging.startX) / SCALE;
    const dyMm = (event.clientY - dragging.startY) / SCALE;
    const cfg = blocks.find((b) => b.key === dragging.key)!;
    const next: Rect = { ...dragging.orig };
    if (dragging.mode === 'move') {
      next.y = clamp(dragging.orig.y + dyMm, 0, localLayout.pageHeight - dragging.orig.h);
      if (cfg.canMoveX) next.x = clamp(dragging.orig.x + dxMm, 0, localLayout.pageWidth - dragging.orig.w);
    } else {
      next.h = clamp(dragging.orig.h + dyMm, 4, localLayout.pageHeight - dragging.orig.y);
      if (cfg.canMoveX && cfg.canResize) next.w = clamp(dragging.orig.w + dxMm, 10, localLayout.pageWidth - dragging.orig.x);
    }
    updateByRect(dragging.key, next);
  };

  const commitToParent = (next?: LetterLayoutSettings) => onLayoutChange(cloneLayout(next || localLayout));
  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(null);
    commitToParent();
  };

  const toggleBlock = (key: BlockKey, enabled: boolean) => {
    setLocalLayout((prev) => {
      const disabled = new Set(getDisabled(prev));
      if (enabled) disabled.delete(key);
      else disabled.add(key);
      const next = { ...cloneLayout(prev), disabledBlocks: Array.from(disabled) } as LetterLayoutSettings;
      onLayoutChange(next);
      return next;
    });
  };

  const toggleLock = (key: BlockKey) => {
    setLocalLayout((prev) => {
      const locked = new Set(getLocked(prev));
      if (locked.has(key)) locked.delete(key);
      else locked.add(key);
      const next = { ...cloneLayout(prev), lockedBlocks: Array.from(locked) } as LetterLayoutSettings;
      onLayoutChange(next);
      return next;
    });
  };

  const updateBlockLabel = (key: string, newLabel: string) => {
    setBlocks(prev => prev.map(b => b.key === key ? { ...b, label: newLabel } : b));
  };

  useEffect(() => {
    const label = blocks.find((block) => block.key === selected)?.label || '';
    setSelectedLabel(label);
  }, [blocks, selected]);

  const updateBlockColor = (key: string, newColor: string) => {
    setBlocks(prev => prev.map(b => b.key === key ? { ...b, color: newColor } : b));
  };

  const removeCustomBlock = (key: string) => {
    setBlocks(prev => prev.filter(b => b.key !== key));
    if (selected === key) setSelected('addressField');
  };

  const moveSelectedByKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Delete custom blocks
    if ((e.key === 'Delete' || e.key === 'Backspace') && blocks.find(b => b.key === selected)?.isCustom) {
      e.preventDefault();
      removeCustomBlock(selected);
      return;
    }
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -1;
    if (e.key === 'ArrowRight') dx = 1;
    if (e.key === 'ArrowUp') dy = -1;
    if (e.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    e.preventDefault();
    if (plainPreview || lockedBlocks.has(selected) || disabledBlocks.has(selected)) return;
    const rect = getRect(selected);
    updateByRect(selected, { ...rect, x: rect.x + dx, y: rect.y + dy });
    requestAnimationFrame(() => commitToParent());
  };

  const selectedRect = useMemo(() => getRect(selected), [selected, localLayout]);
  const selectedBlockConfig = blocks.find(b => b.key === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Canvas-Designer</h3>
          <p className="text-sm text-muted-foreground">Doppelklick auf Block → passender Tab. Pfeiltasten bewegen um 1mm.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 border rounded-md px-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomOut} disabled={zoomLevel <= ZOOM_STEPS[0]}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-medium w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={zoomIn} disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant={showRuler ? 'default' : 'outline'} size="sm" onClick={() => setShowRuler((v) => !v)}>Lineal {showRuler ? 'aus' : 'ein'}</Button>
          <Button variant={plainPreview ? 'default' : 'outline'} size="sm" onClick={() => setPlainPreview((v) => !v)}>
            {plainPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            Vorschau ohne Rahmen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Only reset positions, preserve content
              const defaults = DEFAULT_DIN5008_LAYOUT;
              const next = cloneLayout(localLayout);
              next.margins = { ...defaults.margins };
              next.header = { ...defaults.header };
              next.addressField = { ...defaults.addressField };
              next.infoBlock = { ...defaults.infoBlock };
              next.returnAddress = { ...defaults.returnAddress };
              next.subject = { ...next.subject, top: defaults.subject.top, marginBottom: defaults.subject.marginBottom };
              next.content = { ...next.content, top: defaults.content.top, maxHeight: defaults.content.maxHeight, lineHeight: defaults.content.lineHeight };
              next.footer = { ...next.footer, top: defaults.footer.top, height: defaults.footer.height };
              next.attachments = { ...next.attachments, top: defaults.attachments.top };
              if (next.pagination) {
                next.pagination = { ...next.pagination, top: defaults.pagination?.top || 263.77 };
              }
              setLocalLayout(next);
              onLayoutChange(next);
            }}
          >
            DIN 5008 zurücksetzen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 mt-6">
        <div className="space-y-4">
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Elemente hinzufügen</Label>
            <div className="grid grid-cols-1 gap-2">
              {blocks.map((block) => (
                <div key={block.key} className="flex items-center gap-2 min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => toggleBlock(block.key, disabledBlocks.has(block.key))}
                    title={disabledBlocks.has(block.key) ? 'Einblenden' : 'Ausblenden'}
                  >
                    {disabledBlocks.has(block.key) ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-foreground" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => toggleLock(block.key)}
                    title={lockedBlocks.has(block.key) ? 'Sperre lösen' : 'Element sperren'}
                  >
                    {lockedBlocks.has(block.key) ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className={`h-9 flex-1 min-w-0 justify-start px-3 overflow-hidden ${selected === block.key ? 'ring-2 ring-primary' : ''} ${block.color}`} onClick={() => { setSelected(block.key); canvasWrapRef.current?.focus(); }}>
                    <span className="block w-full truncate text-left">{block.label}</span>
                  </Button>
                  {block.isCustom ? (
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => removeCustomBlock(block.key)} title="Löschen">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Elemente bearbeiten</Label>
            <Label className="text-xs uppercase text-muted-foreground">Ausgewählt: {selectedBlockConfig?.label}</Label>
            {selectedBlockConfig && (
              <div>
                <Label>Name</Label>
                <Input
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  onBlur={() => updateBlockLabel(selected, selectedLabel.trim() || selectedBlockConfig.label)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateBlockLabel(selected, selectedLabel.trim() || selectedBlockConfig.label);
                    }
                  }}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><Label>X (mm)</Label><Input value={selectedRect.x.toFixed(1)} readOnly /></div>
              <div><Label>Y (mm)</Label><Input value={selectedRect.y.toFixed(1)} readOnly /></div>
              <div><Label>Breite</Label><Input value={selectedRect.w.toFixed(1)} readOnly /></div>
              <div><Label>Höhe</Label><Input value={selectedRect.h.toFixed(1)} readOnly /></div>
            </div>
            {selectedBlockConfig && (
              <div>
                <Label className="text-xs">Farbe</Label>
                <Select value={selectedBlockConfig.color} onValueChange={(v) => updateBlockColor(selected, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_PRESETS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${c.value.split(' ')[0]}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {actionButtons && (
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Bearbeitung</Label>
              <div className="grid grid-cols-1 gap-2">{actionButtons}</div>
            </div>
          )}

        </div>

        <div ref={canvasWrapRef} tabIndex={0} onKeyDown={moveSelectedByKey} className="border rounded-lg p-4 bg-muted/20 overflow-auto outline-none" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          <div className="relative mx-auto" style={{ width: pagePx.w + RULER_SIZE, height: pagePx.h + RULER_SIZE }}>
            <>
              <div className={`absolute top-0 left-6 right-0 h-6 border bg-white/90 text-[9px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`}>{Array.from({ length: Math.floor(localLayout.pageWidth / 10) + 1 }).map((_, i) => <span key={`rx-${i}`} className="absolute" style={{ left: i * 10 * SCALE }}>{i * 10}</span>)}</div>
              <div className={`absolute top-6 left-0 bottom-0 w-6 border bg-white/90 text-[9px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`}>{Array.from({ length: Math.floor(localLayout.pageHeight / 10) + 1 }).map((_, i) => <span key={`ry-${i}`} className="absolute" style={{ top: i * 10 * SCALE }}>{i * 10}</span>)}</div>
            </>

            <div className="absolute bg-white shadow-xl relative select-none" style={{ left: RULER_SIZE, top: RULER_SIZE, width: pagePx.w, height: pagePx.h }}>
              {!plainPreview && <div className="absolute border border-dashed border-gray-400 pointer-events-none" style={{ left: localLayout.margins.left * SCALE, top: localLayout.margins.top * SCALE, width: (localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right) * SCALE, height: (localLayout.pageHeight - localLayout.margins.top - localLayout.margins.bottom) * SCALE }} />}


              {blocks.map((block) => {
              const rect = getRect(block.key);
              const isSelected = selected === block.key;
              const isDisabled = disabledBlocks.has(block.key);
              const isLocked = lockedBlocks.has(block.key);
              const isPaginationVisible = block.key !== 'pagination' || (localLayout.pagination?.enabled ?? true);
              if (!isPaginationVisible) return null;
              const rawContent = blockContent[block.key];
              const isLineModeBlock = rawContent && typeof rawContent === 'object' && !Array.isArray(rawContent) && (rawContent as any).mode === 'lines';
              const lineData = isLineModeBlock ? ((rawContent as any).lines || []) as { id: string; type: string; label?: string; value?: string; isVariable?: boolean; labelBold?: boolean; valueBold?: boolean; fontSize?: number; spacerHeight?: number }[] : [];
              
              // For addressField, also get returnAddress line data
              const returnAddressRaw = block.key === 'addressField' ? blockContent['returnAddress'] : null;
              const isReturnLineMode = returnAddressRaw && typeof returnAddressRaw === 'object' && !Array.isArray(returnAddressRaw) && (returnAddressRaw as any).mode === 'lines';
              const returnLineData = isReturnLineMode ? ((returnAddressRaw as any).lines || []) as typeof lineData : [];
              const hasReturnData = returnLineData.length > 0;
              const hasAddressData = isLineModeBlock && lineData.length > 0;
              
              const blockElements = block.key === 'header'
                ? headerElements
                : (Array.isArray(rawContent) ? rawContent : []) as CanvasElement[];
              const previewText =
                block.key === 'header'
                  ? ''
                  : (blockElements.length > 0 || isLineModeBlock || hasReturnData) ? '' : (blockContent[block.key] || [])[0]?.content;
              const LINE_VARS: Record<string, string> = {
                '{{bearbeiter}}': 'Max Mustermann', '{{telefon}}': '040 1234-5678', '{{email}}': 'max@beispiel.de',
                '{{datum}}': '25. Februar 2026', '{{aktenzeichen}}': 'AZ-2026-001', '{{unser_zeichen}}': 'MM/abc',
                '{{empfaenger_name}}': 'Erika Mustermann', '{{empfaenger_strasse}}': 'Musterstraße 1',
                '{{empfaenger_plz}}': '20095', '{{empfaenger_ort}}': 'Hamburg', '{{empfaenger_land}}': 'Deutschland',
                '{{absender_name}}': 'Alexander Salomon', '{{absender_organisation}}': 'Fraktion GRÜNE',
                '{{absender_strasse}}': 'Konrad-Adenauer-Str. 3', '{{absender_plz_ort}}': '70173 Stuttgart',
              };
              const subjectTemplate = (() => {
                const sl = localLayout.blockContent?.subjectLine;
                if (sl && Array.isArray(sl) && sl.length > 0 && (sl[0] as any).content) {
                  return (sl[0] as any).content as string;
                }
                return '{{betreff}}';
              })();
              const subjectPreview = subjectTemplate.replaceAll('{{betreff}}', templateDefaults['{{betreff}}'] || 'Betreff').trim() || 'Betreff';
              const contentPreview = (templateDefaults['default_content'] || 'Inhalt...').trim() || 'Inhalt...';
              const resolveLineValue = (val: string | undefined) => {
                if (!val) return '';
                let text = val;
                for (const [k, v] of Object.entries(LINE_VARS)) { text = text.split(k).join(v); }
                return text;
              };
              const hasVariablePlaceholder = (val: string | undefined) => val ? /\{\{.*?\}\}/.test(val) : false;
              
              const renderLineItems = (lines: typeof lineData, options?: { underlineLastContentLine?: boolean }) => {
                const lastContentIndex = options?.underlineLastContentLine
                  ? [...lines].map((line, index) => ({ line, index })).reverse().find((entry) => entry.line.type !== 'spacer')?.index ?? -1
                  : -1;

                return lines.map((line, index) => {
                  const fontSizePx = (line.fontSize || 9) * (25.4 / 72) * SCALE;
                  if (line.type === 'spacer') return <div key={line.id} style={{ height: (line.spacerHeight || 2) * SCALE }} />;
                  const resolvedValue = resolveLineValue(line.value);
                  const isVar = hasVariablePlaceholder(line.value || '');
                  const underlineThisLine = index === lastContentIndex;
                  return (
                    <div key={line.id} style={{ fontSize: fontSizePx, lineHeight: '1.3' }}>
                      <span className="inline-flex items-center gap-0.5" style={underlineThisLine ? { borderBottom: '1px solid #000' } : undefined}>
                        {line.label && <span className={line.labelBold !== false ? 'font-semibold' : ''}>{line.label}</span>}
                        <span className={line.valueBold ? 'font-semibold' : ''}>{resolvedValue}</span>
                        {!plainPreview && isVar && <span className="inline-flex items-center text-amber-600" style={{ fontSize: fontSizePx * 0.75 }}>⚡</span>}
                      </span>
                    </div>
                  );
                });
              };
              
              // Render address field with two zones
              const returnAddressHeightMm = localLayout.addressField.returnAddressHeight || 17.7;
              
              return (
                <div key={block.key} onMouseDown={(e) => startDrag(e, block.key, 'move')} onDoubleClick={() => onJumpToTab?.(block.jumpTo)} className={`absolute text-[11px] font-medium px-1 py-0.5 ${plainPreview ? '' : 'border'} ${isDisabled ? `opacity-40 cursor-not-allowed ${plainPreview ? '' : 'bg-gray-100 border-dashed'} text-gray-500` : `${plainPreview ? 'cursor-default' : `cursor-move ${block.color}`}`} ${isLocked ? (plainPreview ? 'cursor-not-allowed' : 'cursor-not-allowed border-amber-500') : ''} ${isSelected && !plainPreview ? 'ring-2 ring-primary' : ''}`} style={{ left: rect.x * SCALE, top: rect.y * SCALE, width: rect.w * SCALE, height: rect.h * SCALE, overflow: 'hidden' }}>
                  {block.key === 'addressField' && (hasReturnData || hasAddressData) ? (
                    <>
                      {/* Vermerkzone (return address) */}
                      <div style={{ height: returnAddressHeightMm * SCALE, borderBottom: plainPreview ? undefined : '1px dashed rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
                        {hasReturnData ? renderLineItems(returnLineData, { underlineLastContentLine: true }) : <span className="text-[9px] text-muted-foreground italic">Rücksendezeile</span>}
                      </div>
                      {/* Anschriftzone (recipient address) */}
                      <div style={{ paddingTop: 2 }}>
                        {hasAddressData ? renderLineItems(lineData) : <span className="text-[9px] text-muted-foreground italic">Anschrift</span>}
                      </div>
                    </>
                  ) : block.key === 'content' ? (
                    <>
                      {/* Betreff + Anrede preview inside content block */}
                      {!(localLayout.subject?.integrated || localLayout.salutation?.template || localLayout.closing?.formula) && (
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground">{block.label}</span>
                          <Badge variant="outline" className="text-[10px]">{Math.round(rect.y)}mm</Badge>
                        </div>
                      )}
                      <div style={{ marginTop: 2 * SCALE, fontSize: Math.max(8, 10 * SCALE) }}>
                        {localLayout.subject?.prefixShape && localLayout.subject.prefixShape !== 'none' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 3, verticalAlign: 'middle' }}>
                            {localLayout.subject.prefixShape === 'line' && <span style={{ display: 'inline-block', width: 5 * SCALE, height: 0.5 * SCALE, backgroundColor: '#333', verticalAlign: 'middle' }} />}
                            {localLayout.subject.prefixShape === 'circle' && <span style={{ display: 'inline-block', width: 3 * SCALE, height: 3 * SCALE, borderRadius: '50%', border: '1px solid #333', verticalAlign: 'middle' }} />}
                            {localLayout.subject.prefixShape === 'rectangle' && <span style={{ display: 'inline-block', width: 3 * SCALE, height: 3 * SCALE, border: '1px solid #333', verticalAlign: 'middle' }} />}
                            {localLayout.subject.prefixShape === 'sunflower' && <SunflowerSVG width={3.5 * SCALE} height={3.5 * SCALE} />}
                            {localLayout.subject.prefixShape === 'lion' && <LionSVG width={5 * SCALE} height={2.5 * SCALE} />}
                            {localLayout.subject.prefixShape === 'wappen' && <img src="/assets/wappen-bw.svg" alt="Wappen" style={{ width: 3.5 * SCALE, height: 3.5 * SCALE, objectFit: 'contain' }} />}
                          </span>
                        )}
                        <span className="font-bold" style={{ fontSize: `${(localLayout.subject?.fontSize || 11) * (25.4 / 72) * SCALE}px`, color: '#000' }}>{subjectPreview}</span>
                      </div>
                      <div style={{ height: (localLayout.subject?.marginBottom || 9) * SCALE }} />
                      <div style={{ fontSize: `${(localLayout.salutation?.fontSize || 11) * (25.4 / 72) * SCALE}px`, color: '#000' }}>
                        {localLayout.salutation?.template || 'Sehr geehrte Damen und Herren,'}
                      </div>
                      <div style={{ height: (localLayout.content?.lineHeight || 4.5) * SCALE }} />
                      <div style={{ fontSize: `${(localLayout.salutation?.fontSize || 11) * (25.4 / 72) * SCALE}px`, color: '#666' }}>{contentPreview}</div>
                      {/* Abschlussformel preview */}
                      {localLayout.closing?.formula && (
                         <>
                          <div style={{ height: (localLayout.content?.lineHeight || 4.5) * 2 * SCALE }} />
                          <div style={{ fontSize: `${(localLayout.closing?.fontSize || 11) * (25.4 / 72) * SCALE}px`, color: '#000' }}>
                            {localLayout.closing.formula}
                          </div>
                          {localLayout.closing.signatureName && (
                            <>
                              <div style={{ height: (localLayout.content?.lineHeight || 4.5) * (localLayout.closing.signatureImagePath ? 3 : 1) * SCALE }} />
                              <div className="text-gray-600" style={{ fontSize: `${(localLayout.closing?.fontSize || 11) * (25.4 / 72) * SCALE}px` }}>
                                {localLayout.closing.signatureName}
                              </div>
                              {localLayout.closing.signatureTitle && (
                                <div className="text-gray-400" style={{ fontSize: `${(localLayout.closing?.fontSize || 11) * (25.4 / 72) * SCALE * 0.9}px` }}>
                                  {localLayout.closing.signatureTitle}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                      {isLineModeBlock && renderLineItems(lineData)}
                      {blockElements.map((element) => renderCanvasElementPreview(element, 0, 0, SCALE))}
                    </>
                  ) : block.key === 'pagination' ? (
                    <div className="flex items-center h-full">
                      <span className="text-[9px] text-gray-500 italic w-full" style={{ textAlign: (localLayout.pagination?.align || 'right') }}>Seite 1 von 1</span>
                    </div>
                  ) : block.key === 'footer' && isLineModeBlock ? (
                    (() => {
                      const columns: { label: string; widthValue: number; widthUnit: string; items: typeof lineData }[] = [];
                      let cur: typeof columns[0] | null = null;
                      lineData.forEach((line) => {
                        if (line.type === 'block-start') {
                          if (cur) columns.push(cur);
                          cur = { label: (line as any).label || '', widthValue: (line as any).widthValue || 25, widthUnit: (line as any).widthUnit || 'percent', items: [] };
                        } else if (line.type === 'block-end') {
                          if (cur) { columns.push(cur); cur = null; }
                        } else if (cur) {
                          cur.items.push(line);
                        }
                      });
                      if (cur) columns.push(cur);
                      if (columns.length === 0) return <>{renderLineItems(lineData)}</>;
                      return (
                        <div className="flex h-full" style={{ gap: 2 * SCALE }}>
                          {columns.map((col, ci) => (
                            <div key={ci} style={{ width: `${col.widthValue}%` }}>
                              {col.items.map((line) => {
                                const fPx = ((line.fontSize || 8) * (25.4 / 72) * SCALE);
                                if (line.type === 'spacer') return <div key={line.id} style={{ height: (line.spacerHeight || 2) * SCALE }} />;
                                const rv = resolveLineValue(line.value);
                                return (
                                  <div key={line.id} className="truncate" style={{ fontSize: fPx, lineHeight: '1.3', fontWeight: line.valueBold ? 'bold' : 'normal', color: (line as any).color || undefined }}>
                                    {line.type === 'label-value' ? `${line.label || ''} ${rv}`.trim() : (rv || '\u00A0')}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <>
                      {!previewText && blockElements.length === 0 && !isLineModeBlock && !plainPreview && <div className="flex items-center justify-between"><span>{block.label}</span><div className="flex items-center gap-1">{isLocked && <Lock className="h-3 w-3 text-amber-700" />}<Badge variant="outline" className="text-[10px]">{Math.round(rect.y)}mm</Badge></div></div>}
                      {previewText && <div className="mt-1 text-[10px] line-clamp-2">{previewText}</div>}
                      {isLineModeBlock && renderLineItems(lineData)}
                      {blockElements.map((element) => renderCanvasElementPreview(element, 0, 0, SCALE, plainPreview))}
                    </>
                  )}
                  {block.canResize && !isDisabled && !isLocked && !plainPreview && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize" onMouseDown={(e) => startDrag(e, block.key, 'resize')} />}
                </div>
              );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
