import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';

type BlockKey = 'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments';

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
}

interface Props {
  layoutSettings: LetterLayoutSettings;
  onLayoutChange: (settings: LetterLayoutSettings) => void;
}

const BLOCKS: BlockConfig[] = [
  { key: 'addressField', label: 'Adressfeld', color: 'bg-blue-500/20 border-blue-600 text-blue-900', canMoveX: true, canResize: true },
  { key: 'infoBlock', label: 'Info-Block', color: 'bg-purple-500/20 border-purple-600 text-purple-900', canMoveX: true, canResize: true },
  { key: 'subject', label: 'Betreffbereich', color: 'bg-green-500/20 border-green-600 text-green-900' },
  { key: 'content', label: 'Inhaltsbereich', color: 'bg-orange-500/20 border-orange-600 text-orange-900', canResize: true },
  { key: 'attachments', label: 'Anlagen', color: 'bg-amber-500/20 border-amber-600 text-amber-900' },
  { key: 'footer', label: 'Footer', color: 'bg-pink-500/20 border-pink-600 text-pink-900' },
];

const SCALE = 2.2; // px per mm

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
const snapMm = (val: number) => Math.round(val); // 1mm grid

const cloneLayout = (layout: LetterLayoutSettings): LetterLayoutSettings => ({
  ...layout,
  margins: { ...layout.margins },
  header: { ...layout.header },
  addressField: { ...layout.addressField },
  infoBlock: { ...layout.infoBlock },
  subject: { ...layout.subject },
  content: { ...layout.content },
  footer: { ...layout.footer },
  attachments: { ...layout.attachments },
});

const layoutHash = (layout: LetterLayoutSettings) => JSON.stringify(layout);

export function LetterLayoutCanvasDesigner({ layoutSettings, onLayoutChange }: Props) {
  const [selected, setSelected] = useState<BlockKey>('addressField');
  const [dragging, setDragging] = useState<{ key: BlockKey; startX: number; startY: number; orig: Rect; mode: 'move' | 'resize' } | null>(null);
  const [localLayout, setLocalLayout] = useState<LetterLayoutSettings>(() => cloneLayout(layoutSettings));

  useEffect(() => {
    setLocalLayout(cloneLayout(layoutSettings));
  }, [layoutHash(layoutSettings)]);

  const pagePx = {
    w: localLayout.pageWidth * SCALE,
    h: localLayout.pageHeight * SCALE,
  };

  const contentWidth = localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right;

  const getRect = (key: BlockKey): Rect => {
    switch (key) {
      case 'addressField':
        return {
          x: localLayout.addressField.left,
          y: localLayout.addressField.top,
          w: localLayout.addressField.width,
          h: localLayout.addressField.height,
        };
      case 'infoBlock':
        return {
          x: localLayout.infoBlock.left,
          y: localLayout.infoBlock.top,
          w: localLayout.infoBlock.width,
          h: localLayout.infoBlock.height,
        };
      case 'subject':
        return {
          x: localLayout.margins.left,
          y: localLayout.subject.top,
          w: contentWidth,
          h: Math.max(8, localLayout.subject.marginBottom + 4),
        };
      case 'content':
        return {
          x: localLayout.margins.left,
          y: localLayout.content.top,
          w: contentWidth,
          h: localLayout.content.maxHeight,
        };
      case 'footer':
        return {
          x: localLayout.margins.left,
          y: localLayout.footer.top,
          w: contentWidth,
          h: 18,
        };
      case 'attachments':
        return {
          x: localLayout.margins.left,
          y: localLayout.attachments.top,
          w: contentWidth,
          h: 8,
        };
    }
  };

  const updateByRect = (key: BlockKey, rect: Rect) => {
    setLocalLayout(prev => {
      const next = cloneLayout(prev);
      if (key === 'addressField') {
        next.addressField.left = snapMm(rect.x);
        next.addressField.top = snapMm(rect.y);
        next.addressField.width = snapMm(rect.w);
        next.addressField.height = snapMm(rect.h);
      } else if (key === 'infoBlock') {
        next.infoBlock.left = snapMm(rect.x);
        next.infoBlock.top = snapMm(rect.y);
        next.infoBlock.width = snapMm(rect.w);
        next.infoBlock.height = snapMm(rect.h);
      } else if (key === 'subject') {
        next.subject.top = snapMm(rect.y);
        next.subject.marginBottom = clamp(snapMm(rect.h - 4), 2, 40);
      } else if (key === 'content') {
        next.content.top = snapMm(rect.y);
        next.content.maxHeight = clamp(snapMm(rect.h), 20, 220);
      } else if (key === 'footer') {
        next.footer.top = snapMm(rect.y);
      } else if (key === 'attachments') {
        next.attachments.top = snapMm(rect.y);
      }
      return next;
    });
  };

  const commitToParent = () => {
    if (layoutHash(localLayout) !== layoutHash(layoutSettings)) {
      onLayoutChange(cloneLayout(localLayout));
    }
  };

  const selectedRect = useMemo(() => getRect(selected), [selected, localLayout]);

  const startDrag = (event: React.MouseEvent, key: BlockKey, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    const rect = getRect(key);
    setSelected(key);
    setDragging({ key, mode, startX: event.clientX, startY: event.clientY, orig: rect });
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!dragging) return;
    const dxMm = (event.clientX - dragging.startX) / SCALE;
    const dyMm = (event.clientY - dragging.startY) / SCALE;

    const cfg = BLOCKS.find(b => b.key === dragging.key)!;
    let next: Rect = { ...dragging.orig };

    if (dragging.mode === 'move') {
      next.y = clamp(dragging.orig.y + dyMm, 0, localLayout.pageHeight - dragging.orig.h);
      if (cfg.canMoveX) {
        next.x = clamp(dragging.orig.x + dxMm, 0, localLayout.pageWidth - dragging.orig.w);
      }
    } else {
      next.h = clamp(dragging.orig.h + dyMm, 4, localLayout.pageHeight - dragging.orig.y);
      if (cfg.canMoveX && cfg.canResize) {
        next.w = clamp(dragging.orig.w + dxMm, 10, localLayout.pageWidth - dragging.orig.x);
      }
    }

    updateByRect(dragging.key, next);
  };

  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(null);
    commitToParent();
  };

  const updateMargin = (key: 'left' | 'right' | 'top' | 'bottom', value: number) => {
    setLocalLayout(prev => {
      const next = cloneLayout(prev);
      next.margins[key] = value;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Canvas-Designer</h3>
          <p className="text-sm text-muted-foreground">Elemente per Drag & Drop positionieren. Raster: 1mm.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const next = cloneLayout(DEFAULT_DIN5008_LAYOUT);
          setLocalLayout(next);
          onLayoutChange(next);
        }}>
          DIN 5008 zurücksetzen
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-4">
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Elemente</Label>
            <div className="grid grid-cols-2 gap-2">
              {BLOCKS.map(block => (
                <Button key={block.key} type="button" variant={selected === block.key ? 'default' : 'outline'} size="sm" onClick={() => setSelected(block.key)}>
                  {block.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Ausgewählt: {BLOCKS.find(b => b.key === selected)?.label}</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <Label>X (mm)</Label>
                <Input value={selectedRect.x.toFixed(1)} readOnly />
              </div>
              <div>
                <Label>Y (mm)</Label>
                <Input value={selectedRect.y.toFixed(1)} readOnly />
              </div>
              <div>
                <Label>Breite</Label>
                <Input value={selectedRect.w.toFixed(1)} readOnly />
              </div>
              <div>
                <Label>Höhe</Label>
                <Input value={selectedRect.h.toFixed(1)} readOnly />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Seitenränder (mm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" value={localLayout.margins.left} onChange={(e) => updateMargin('left', parseFloat(e.target.value) || 0)} onBlur={commitToParent} placeholder="Links" />
              <Input type="number" value={localLayout.margins.right} onChange={(e) => updateMargin('right', parseFloat(e.target.value) || 0)} onBlur={commitToParent} placeholder="Rechts" />
              <Input type="number" value={localLayout.margins.top} onChange={(e) => updateMargin('top', parseFloat(e.target.value) || 0)} onBlur={commitToParent} placeholder="Oben" />
              <Input type="number" value={localLayout.margins.bottom} onChange={(e) => updateMargin('bottom', parseFloat(e.target.value) || 0)} onBlur={commitToParent} placeholder="Unten" />
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/20 overflow-auto" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          <div className="mx-auto bg-white shadow-xl relative select-none" style={{ width: pagePx.w, height: pagePx.h }}>
            <div className="absolute border border-dashed border-gray-400 pointer-events-none" style={{
              left: localLayout.margins.left * SCALE,
              top: localLayout.margins.top * SCALE,
              width: (localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right) * SCALE,
              height: (localLayout.pageHeight - localLayout.margins.top - localLayout.margins.bottom) * SCALE,
            }} />

            {BLOCKS.map((block) => {
              const rect = getRect(block.key);
              const isSelected = selected === block.key;
              const canResize = block.canResize;
              return (
                <div
                  key={block.key}
                  onMouseDown={(e) => startDrag(e, block.key, 'move')}
                  className={`absolute border text-[11px] font-medium px-2 py-1 cursor-move ${block.color} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  style={{
                    left: rect.x * SCALE,
                    top: rect.y * SCALE,
                    width: rect.w * SCALE,
                    height: rect.h * SCALE,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>{block.label}</span>
                    <Badge variant="outline" className="text-[10px]">{Math.round(rect.y)}mm</Badge>
                  </div>
                  {canResize && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize"
                      onMouseDown={(e) => startDrag(e, block.key, 'resize')}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
