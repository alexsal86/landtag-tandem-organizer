import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';

type BlockKey = 'header' | 'addressField' | 'returnAddress' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments';
type EditorTab = 'header-designer' | 'footer-designer' | 'layout-settings' | 'general' | 'block-address' | 'block-return-address' | 'block-info' | 'block-subject' | 'block-content' | 'block-attachments';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BlockConfig {
  key: BlockKey;
  label: string;
  color: string;
  canMoveX?: boolean;
  canResize?: boolean;
  jumpTo: EditorTab;
}

interface Props {
  layoutSettings: LetterLayoutSettings;
  onLayoutChange: (settings: LetterLayoutSettings) => void;
  onJumpToTab?: (tab: EditorTab) => void;
  headerElements?: Array<{ id: string; type: 'text' | 'image'; x: number; y: number; width?: number; height?: number; content?: string }>;
}

const BLOCKS: BlockConfig[] = [
  { key: 'header', label: 'Header', color: 'bg-cyan-500/20 border-cyan-600 text-cyan-900', jumpTo: 'header-designer' },
  { key: 'addressField', label: 'Adressfeld', color: 'bg-blue-500/20 border-blue-600 text-blue-900', canMoveX: true, canResize: true, jumpTo: 'block-address' },
  { key: 'returnAddress', label: 'Rücksendeangaben', color: 'bg-indigo-500/20 border-indigo-600 text-indigo-900', canMoveX: true, canResize: true, jumpTo: 'block-return-address' },
  { key: 'infoBlock', label: 'Info-Block', color: 'bg-purple-500/20 border-purple-600 text-purple-900', canMoveX: true, canResize: true, jumpTo: 'block-info' },
  { key: 'subject', label: 'Betreffbereich', color: 'bg-green-500/20 border-green-600 text-green-900', jumpTo: 'block-subject' },
  { key: 'content', label: 'Inhaltsbereich', color: 'bg-orange-500/20 border-orange-600 text-orange-900', canResize: true, jumpTo: 'block-content' },
  { key: 'attachments', label: 'Anlagen', color: 'bg-amber-500/20 border-amber-600 text-amber-900', jumpTo: 'block-attachments' },
  { key: 'footer', label: 'Footer', color: 'bg-pink-500/20 border-pink-600 text-pink-900', jumpTo: 'footer-designer' },
];

const SCALE = 2.2;
const snapMm = (val: number) => Math.round(val);
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

const cloneLayout = (layout: LetterLayoutSettings): LetterLayoutSettings => ({
  ...layout,
  margins: { ...layout.margins },
  header: { ...layout.header },
  addressField: { ...layout.addressField },
  returnAddress: { ...layout.returnAddress },
  infoBlock: { ...layout.infoBlock },
  subject: { ...layout.subject },
  content: { ...layout.content },
  footer: { ...layout.footer },
  attachments: { ...layout.attachments },
  blockContent: { ...(layout.blockContent || {}) },
  disabledBlocks: [...(layout.disabledBlocks || [])],
});

const getDisabled = (layout: LetterLayoutSettings): BlockKey[] => (layout.disabledBlocks || []) as BlockKey[];

export function LetterLayoutCanvasDesigner({ layoutSettings, onLayoutChange, onJumpToTab, headerElements = [] }: Props) {
  const [selected, setSelected] = useState<BlockKey>('addressField');
  const [dragging, setDragging] = useState<{ key: BlockKey; startX: number; startY: number; orig: Rect; mode: 'move' | 'resize' } | null>(null);
  const [localLayout, setLocalLayout] = useState<LetterLayoutSettings>(() => cloneLayout(layoutSettings));
  const [showRuler, setShowRuler] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setLocalLayout(cloneLayout(layoutSettings)), [layoutSettings]);

  const disabledBlocks = useMemo(() => new Set(getDisabled(localLayout)), [localLayout]);
  const contentWidth = localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right;
  const pagePx = { w: localLayout.pageWidth * SCALE, h: localLayout.pageHeight * SCALE };
  const blockContent = localLayout.blockContent || {};

  const getRect = (key: BlockKey): Rect => {
    switch (key) {
      case 'header':
        return { x: 0, y: 0, w: localLayout.pageWidth, h: localLayout.header.height };
      case 'addressField':
        return { x: localLayout.addressField.left, y: localLayout.addressField.top, w: localLayout.addressField.width, h: localLayout.addressField.height };
      case 'returnAddress':
        return { x: localLayout.returnAddress.left, y: localLayout.returnAddress.top, w: localLayout.returnAddress.width, h: localLayout.returnAddress.height };
      case 'infoBlock':
        return { x: localLayout.infoBlock.left, y: localLayout.infoBlock.top, w: localLayout.infoBlock.width, h: localLayout.infoBlock.height };
      case 'subject':
        return { x: localLayout.margins.left, y: localLayout.subject.top, w: contentWidth, h: Math.max(8, localLayout.subject.marginBottom + 4) };
      case 'content':
        return { x: localLayout.margins.left, y: localLayout.content.top, w: contentWidth, h: localLayout.content.maxHeight };
      case 'footer':
        return { x: localLayout.margins.left, y: localLayout.footer.top, w: contentWidth, h: 18 };
      case 'attachments':
        return { x: localLayout.margins.left, y: localLayout.attachments.top, w: contentWidth, h: 8 };
    }
  };

  const updateByRect = (key: BlockKey, rect: Rect) => {
    setLocalLayout((prev) => {
      const next = cloneLayout(prev);
      if (key === 'header') next.header.height = clamp(snapMm(rect.h), 20, 70);
      else if (key === 'addressField') Object.assign(next.addressField, { left: snapMm(rect.x), top: snapMm(rect.y), width: snapMm(rect.w), height: snapMm(rect.h) });
      else if (key === 'returnAddress') Object.assign(next.returnAddress, { left: snapMm(rect.x), top: snapMm(rect.y), width: snapMm(rect.w), height: snapMm(rect.h) });
      else if (key === 'infoBlock') Object.assign(next.infoBlock, { left: snapMm(rect.x), top: snapMm(rect.y), width: snapMm(rect.w), height: snapMm(rect.h) });
      else if (key === 'subject') {
        next.subject.top = snapMm(rect.y);
        next.subject.marginBottom = clamp(snapMm(rect.h - 4), 2, 40);
      } else if (key === 'content') {
        next.content.top = snapMm(rect.y);
        next.content.maxHeight = clamp(snapMm(rect.h), 20, 220);
      } else if (key === 'footer') next.footer.top = snapMm(rect.y);
      else if (key === 'attachments') next.attachments.top = snapMm(rect.y);
      return next;
    });
  };

  const startDrag = (event: React.MouseEvent, key: BlockKey, mode: 'move' | 'resize') => {
    if (disabledBlocks.has(key)) return;
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
    const cfg = BLOCKS.find((b) => b.key === dragging.key)!;
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

  const moveSelectedByKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -1;
    if (e.key === 'ArrowRight') dx = 1;
    if (e.key === 'ArrowUp') dy = -1;
    if (e.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    e.preventDefault();
    const rect = getRect(selected);
    updateByRect(selected, { ...rect, x: rect.x + dx, y: rect.y + dy });
    requestAnimationFrame(() => commitToParent());
  };

  const selectedRect = useMemo(() => getRect(selected), [selected, localLayout]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Canvas-Designer</h3>
          <p className="text-sm text-muted-foreground">Doppelklick auf Block → passender Tab. Pfeiltasten bewegen ausgewählten Block um 1mm.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={showRuler ? 'default' : 'outline'} size="sm" onClick={() => setShowRuler((v) => !v)}>Lineal {showRuler ? 'aus' : 'ein'}</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = cloneLayout(DEFAULT_DIN5008_LAYOUT);
              setLocalLayout(next);
              onLayoutChange(next);
            }}
          >
            DIN 5008 zurücksetzen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-4">
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Elemente</Label>
            <div className="grid grid-cols-1 gap-2">
              {BLOCKS.map((block) => (
                <div key={block.key} className="flex items-center justify-between gap-2">
                  <Button type="button" variant={selected === block.key ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => { setSelected(block.key); canvasWrapRef.current?.focus(); }}>
                    {block.label}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${block.key}`} className="text-xs">Aktiv</Label>
                    <Checkbox id={`toggle-${block.key}`} checked={!disabledBlocks.has(block.key)} onCheckedChange={(checked) => toggleBlock(block.key, !!checked)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Ausgewählt: {BLOCKS.find((b) => b.key === selected)?.label}</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><Label>X (mm)</Label><Input value={selectedRect.x.toFixed(1)} readOnly /></div>
              <div><Label>Y (mm)</Label><Input value={selectedRect.y.toFixed(1)} readOnly /></div>
              <div><Label>Breite</Label><Input value={selectedRect.w.toFixed(1)} readOnly /></div>
              <div><Label>Höhe</Label><Input value={selectedRect.h.toFixed(1)} readOnly /></div>
            </div>
          </div>
        </div>

        <div ref={canvasWrapRef} tabIndex={0} onKeyDown={moveSelectedByKey} className="border rounded-lg p-4 bg-muted/20 overflow-auto outline-none" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          <div className="mx-auto bg-white shadow-xl relative select-none" style={{ width: pagePx.w, height: pagePx.h }}>
            {showRuler && (
              <>
                <div className="absolute top-0 left-0 right-0 h-5 border-b bg-white/90 text-[9px] text-muted-foreground pointer-events-none">{Array.from({ length: Math.floor(localLayout.pageWidth / 10) + 1 }).map((_, i) => <span key={`rx-${i}`} className="absolute" style={{ left: i * 10 * SCALE }}>{i * 10}</span>)}</div>
                <div className="absolute top-0 bottom-0 left-0 w-5 border-r bg-white/90 text-[9px] text-muted-foreground pointer-events-none">{Array.from({ length: Math.floor(localLayout.pageHeight / 10) + 1 }).map((_, i) => <span key={`ry-${i}`} className="absolute" style={{ top: i * 10 * SCALE }}>{i * 10}</span>)}</div>
              </>
            )}

            <div className="absolute border border-dashed border-gray-400 pointer-events-none" style={{ left: localLayout.margins.left * SCALE, top: localLayout.margins.top * SCALE, width: (localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right) * SCALE, height: (localLayout.pageHeight - localLayout.margins.top - localLayout.margins.bottom) * SCALE }} />

            {BLOCKS.map((block) => {
              const rect = getRect(block.key);
              const isSelected = selected === block.key;
              const isDisabled = disabledBlocks.has(block.key);
              const previewText =
                block.key === 'header'
                  ? headerElements.filter((e) => e.type === 'text').map((e) => e.content).filter(Boolean).join(' · ')
                  : (blockContent[block.key] || [])[0]?.content;
              return (
                <div key={block.key} onMouseDown={(e) => startDrag(e, block.key, 'move')} onDoubleClick={() => onJumpToTab?.(block.jumpTo)} className={`absolute border text-[11px] font-medium px-2 py-1 ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border-dashed text-gray-500' : `cursor-move ${block.color}`} ${isSelected ? 'ring-2 ring-primary' : ''}`} style={{ left: rect.x * SCALE, top: rect.y * SCALE, width: rect.w * SCALE, height: rect.h * SCALE }}>
                  <div className="flex items-center justify-between"><span>{block.label}</span><Badge variant="outline" className="text-[10px]">{Math.round(rect.y)}mm</Badge></div>
                  {previewText && <div className="mt-1 text-[10px] line-clamp-2">{previewText}</div>}
                  {block.canResize && !isDisabled && <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize" onMouseDown={(e) => startDrag(e, block.key, 'resize')} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
