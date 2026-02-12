import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_DIN5008_LAYOUT, LetterLayoutSettings } from '@/types/letterLayout';

type BlockKey = 'addressField' | 'infoBlock' | 'subject' | 'content' | 'footer' | 'attachments';
type EditorTab = 'header-designer' | 'footer-designer' | 'layout-settings' | 'general';
type CanvasTool = 'header-text' | 'footer-block';

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

interface HeaderElement {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  imageUrl?: string;
}

interface FooterBlock {
  id: string;
  title?: string;
  content?: string;
  order?: number;
  widthPercent?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  x?: number;
  y?: number;
}

interface Props {
  layoutSettings: LetterLayoutSettings;
  onLayoutChange: (settings: LetterLayoutSettings) => void;
  onJumpToTab?: (tab: EditorTab) => void;
  headerElements?: HeaderElement[];
  onHeaderElementsChange?: (elements: HeaderElement[]) => void;
  footerBlocks?: FooterBlock[];
  onFooterBlocksChange?: (blocks: FooterBlock[]) => void;
}

const BLOCKS: BlockConfig[] = [
  { key: 'addressField', label: 'Adressfeld', color: 'bg-blue-500/20 border-blue-600 text-blue-900', canMoveX: true, canResize: true, jumpTo: 'general' },
  { key: 'infoBlock', label: 'Info-Block', color: 'bg-purple-500/20 border-purple-600 text-purple-900', canMoveX: true, canResize: true, jumpTo: 'general' },
  { key: 'subject', label: 'Betreffbereich', color: 'bg-green-500/20 border-green-600 text-green-900', jumpTo: 'layout-settings' },
  { key: 'content', label: 'Inhaltsbereich', color: 'bg-orange-500/20 border-orange-600 text-orange-900', canResize: true, jumpTo: 'layout-settings' },
  { key: 'attachments', label: 'Anlagen', color: 'bg-amber-500/20 border-amber-600 text-amber-900', jumpTo: 'general' },
  { key: 'footer', label: 'Footer', color: 'bg-pink-500/20 border-pink-600 text-pink-900', jumpTo: 'footer-designer' },
];

const SCALE = 2.2;
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
const snapMm = (val: number) => Math.round(val);

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

const getDisabled = (layout: LetterLayoutSettings): BlockKey[] => ((layout as any).disabledBlocks || []) as BlockKey[];
const setDisabled = (layout: LetterLayoutSettings, disabledBlocks: BlockKey[]) => ({ ...cloneLayout(layout), disabledBlocks } as LetterLayoutSettings);

export function LetterLayoutCanvasDesigner({
  layoutSettings,
  onLayoutChange,
  onJumpToTab,
  headerElements = [],
  onHeaderElementsChange,
  footerBlocks = [],
  onFooterBlocksChange,
}: Props) {
  const [selected, setSelected] = useState<BlockKey>('addressField');
  const [dragging, setDragging] = useState<{ key: BlockKey; startX: number; startY: number; orig: Rect; mode: 'move' | 'resize' } | null>(null);
  const [dragHeader, setDragHeader] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [dragFooter, setDragFooter] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [localLayout, setLocalLayout] = useState<LetterLayoutSettings>(() => cloneLayout(layoutSettings));
  const [selectedHeaderElementId, setSelectedHeaderElementId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalLayout(cloneLayout(layoutSettings));
  }, [layoutSettings]);

  const disabledBlocks = useMemo(() => new Set(getDisabled(localLayout)), [localLayout]);
  const pagePx = { w: localLayout.pageWidth * SCALE, h: localLayout.pageHeight * SCALE };
  const contentWidth = localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right;

  const getRect = (key: BlockKey): Rect => {
    switch (key) {
      case 'addressField':
        return { x: localLayout.addressField.left, y: localLayout.addressField.top, w: localLayout.addressField.width, h: localLayout.addressField.height };
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

  const commitLayoutToParent = (nextLayout?: LetterLayoutSettings) => {
    onLayoutChange(cloneLayout(nextLayout || localLayout));
  };

  const selectedRect = useMemo(() => getRect(selected), [selected, localLayout]);

  const startDrag = (event: React.MouseEvent, key: BlockKey, mode: 'move' | 'resize') => {
    if (disabledBlocks.has(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = getRect(key);
    setSelected(key);
    setDragging({ key, mode, startX: event.clientX, startY: event.clientY, orig: rect });
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (dragging) {
      const dxMm = (event.clientX - dragging.startX) / SCALE;
      const dyMm = (event.clientY - dragging.startY) / SCALE;
      const cfg = BLOCKS.find((b) => b.key === dragging.key)!;
      const next: Rect = { ...dragging.orig };

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
      return;
    }

    if (dragHeader) {
      const dxMm = (event.clientX - dragHeader.startX) / SCALE;
      const dyMm = (event.clientY - dragHeader.startY) / SCALE;
      onHeaderElementsChange?.(
        headerElements.map((el) =>
          el.id === dragHeader.id
            ? {
                ...el,
                x: snapMm(clamp(dragHeader.origX + dxMm, 0, localLayout.pageWidth - (el.width || 50))),
                y: snapMm(clamp(dragHeader.origY + dyMm, 0, localLayout.header.height - (el.height || 10))),
              }
            : el,
        ),
      );
      return;
    }

    if (dragFooter) {
      const dxMm = (event.clientX - dragFooter.startX) / SCALE;
      const dyMm = (event.clientY - dragFooter.startY) / SCALE;
      const footerTop = localLayout.footer.top;
      onFooterBlocksChange?.(
        footerBlocks.map((block) =>
          block.id === dragFooter.id
            ? {
                ...block,
                x: snapMm(clamp(dragFooter.origX + dxMm, localLayout.margins.left, localLayout.pageWidth - localLayout.margins.right - 20)),
                y: snapMm(clamp(dragFooter.origY + dyMm, footerTop - 6, footerTop + 14)),
              }
            : block,
        ),
      );
    }
  };

  const onMouseUp = () => {
    if (dragging) {
      setDragging(null);
      commitLayoutToParent();
    }
    setDragHeader(null);
    setDragFooter(null);
  };

  const toggleBlock = (key: BlockKey, enabled: boolean) => {
    setLocalLayout((prev) => {
      const current = new Set(getDisabled(prev));
      if (enabled) {
        current.delete(key);
      } else {
        current.add(key);
      }
      const next = setDisabled(prev, Array.from(current));
      onLayoutChange(next);
      return next;
    });
  };

  const addHeaderText = (x = 25, y = 10) => {
    const text: HeaderElement = {
      id: Date.now().toString(),
      type: 'text',
      x,
      y,
      content: 'Neuer Header-Text',
      fontSize: 11,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      width: 70,
      height: 8,
    };
    onHeaderElementsChange?.([...headerElements, text]);
  };

  const selectedHeaderElement = headerElements.find((element) => element.id === selectedHeaderElementId) || null;

  const updateHeaderElement = (id: string, updates: Partial<HeaderElement>) => {
    onHeaderElementsChange?.(headerElements.map((element) => (element.id === id ? { ...element, ...updates } : element)));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const image: HeaderElement = {
      id: Date.now().toString(),
      type: 'image',
      x: 130,
      y: 6,
      width: 40,
      height: 20,
      imageUrl: objectUrl,
    };
    onHeaderElementsChange?.([...headerElements, image]);
  };

  const addFooterBlock = (x = localLayout.margins.left, y = localLayout.footer.top + 1) => {
    const block: FooterBlock = {
      id: Date.now().toString(),
      title: 'Canvas Block',
      content: 'Neuer Footer-Text',
      order: footerBlocks.length,
      widthPercent: 25,
      fontSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      x,
      y,
    };
    onFooterBlocksChange?.([...footerBlocks, block]);
  };

  const onToolDragStart = (event: React.DragEvent, tool: CanvasTool) => {
    event.dataTransfer.setData('application/x-canvas-tool', tool);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tool = event.dataTransfer.getData('application/x-canvas-tool') as CanvasTool;
    if (!tool) return;

    const canvasRect = event.currentTarget.getBoundingClientRect();
    const xMm = snapMm((event.clientX - canvasRect.left) / SCALE);
    const yMm = snapMm((event.clientY - canvasRect.top) / SCALE);

    if (tool === 'header-text') {
      addHeaderText(clamp(xMm, 0, 180), clamp(yMm, 0, localLayout.header.height - 8));
    } else if (tool === 'footer-block') {
      addFooterBlock(clamp(xMm, localLayout.margins.left, localLayout.pageWidth - localLayout.margins.right - 20), clamp(yMm, localLayout.footer.top - 6, localLayout.footer.top + 14));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Canvas-Designer</h3>
          <p className="text-sm text-muted-foreground">Werkzeuge links per Drag & Drop auf die Seite ziehen. Doppelklick auf Layout-Blöcke öffnet den passenden Tab.</p>
        </div>
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

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-4">
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Elemente</Label>
            <div className="grid grid-cols-1 gap-2">
              {BLOCKS.map((block) => (
                <div key={block.key} className="flex items-center justify-between gap-2">
                  <Button type="button" variant={selected === block.key ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setSelected(block.key)}>
                    {block.label}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${block.key}`} className="text-xs">
                      Aktiv
                    </Label>
                    <Checkbox id={`toggle-${block.key}`} checked={!disabledBlocks.has(block.key)} onCheckedChange={(checked) => toggleBlock(block.key, !!checked)} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Canvas-Werkzeugkasten</Label>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div draggable onDragStart={(e) => onToolDragStart(e, 'header-text')} className="rounded border bg-background px-3 py-2 cursor-grab active:cursor-grabbing">
                Header-Text ziehen
              </div>
              <div draggable onDragStart={(e) => onToolDragStart(e, 'footer-block')} className="rounded border bg-background px-3 py-2 cursor-grab active:cursor-grabbing">
                Footer-Block ziehen
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                Bild hochladen (Header)
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </div>


          {selectedHeaderElement && (
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Header-Element bearbeiten</Label>
              {selectedHeaderElement.type === 'text' && (
                <>
                  <Input value={selectedHeaderElement.content || ''} onChange={(e) => updateHeaderElement(selectedHeaderElement.id, { content: e.target.value })} placeholder="Text" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" value={selectedHeaderElement.fontSize || 11} onChange={(e) => updateHeaderElement(selectedHeaderElement.id, { fontSize: parseFloat(e.target.value) || 11 })} placeholder="Schriftgröße" />
                    <Input type="color" value={selectedHeaderElement.color || '#000000'} onChange={(e) => updateHeaderElement(selectedHeaderElement.id, { color: e.target.value })} />
                  </div>
                </>
              )}
              {selectedHeaderElement.type === 'image' && (
                <div className="text-xs text-muted-foreground">Bild kann per Drag verschoben werden. Neues Bild über "Bild hochladen".</div>
              )}
            </div>
          )}
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Ausgewählt: {BLOCKS.find((b) => b.key === selected)?.label}</Label>
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
        </div>

        <div className="border rounded-lg p-4 bg-muted/20 overflow-auto" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          <div
            className="mx-auto bg-white shadow-xl relative select-none"
            style={{ width: pagePx.w, height: pagePx.h }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            <div
              className="absolute border border-dashed border-gray-400 pointer-events-none"
              style={{
                left: localLayout.margins.left * SCALE,
                top: localLayout.margins.top * SCALE,
                width: (localLayout.pageWidth - localLayout.margins.left - localLayout.margins.right) * SCALE,
                height: (localLayout.pageHeight - localLayout.margins.top - localLayout.margins.bottom) * SCALE,
              }}
            />

            <div
              className="absolute border border-cyan-600/60 bg-cyan-100/30 text-cyan-900 text-[11px] px-2 py-1 cursor-pointer"
              style={{ left: 0, top: 0, width: localLayout.pageWidth * SCALE, height: localLayout.header.height * SCALE }}
              onClick={() => onJumpToTab?.('header-designer')}
              title="Header klicken: Header-Designer öffnen"
            >
              Headerbereich
            </div>

            {headerElements.map((element) => (
              <div
                key={element.id}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setSelectedHeaderElementId(element.id);
                  setDragHeader({ id: element.id, startX: event.clientX, startY: event.clientY, origX: element.x, origY: element.y });
                }}
                className={`absolute border bg-emerald-100/70 px-2 py-1 cursor-move ${selectedHeaderElementId === element.id ? 'border-primary ring-2 ring-primary/50' : 'border-emerald-500'}`}
                style={{ left: element.x * SCALE, top: element.y * SCALE, width: (element.width || 60) * SCALE, minHeight: (element.height || 8) * SCALE }}
              >
                {element.type === 'image' ? (
                  <img src={element.imageUrl} alt="Header" className="h-full w-full object-contain" />
                ) : (
                  <span style={{ fontSize: `${element.fontSize || 11}px`, color: element.color || '#000000', fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal' }}>{element.content || 'Text'}</span>
                )}
              </div>
            ))}

            {footerBlocks.map((block, index) => {
              const widthMm = ((block.widthPercent || 25) / 100) * contentWidth;
              const defaultX = localLayout.margins.left + index * (contentWidth / 4);
              const x = block.x ?? defaultX;
              const y = block.y ?? localLayout.footer.top + 1;
              return (
                <div
                  key={block.id}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setDragFooter({ id: block.id, startX: event.clientX, startY: event.clientY, origX: x, origY: y });
                  }}
                  className="absolute border border-fuchsia-500 bg-fuchsia-100/70 text-[10px] px-2 py-1 cursor-move"
                  style={{ left: x * SCALE, top: y * SCALE, width: widthMm * SCALE }}
                >
                  <div className="font-semibold">{block.title || 'Footer'}</div>
                  <div className="line-clamp-2">{block.content || 'Inhalt'}</div>
                </div>
              );
            })}

            {BLOCKS.map((block) => {
              const rect = getRect(block.key);
              const isSelected = selected === block.key;
              const isDisabled = disabledBlocks.has(block.key);
              return (
                <div
                  key={block.key}
                  onMouseDown={(e) => startDrag(e, block.key, 'move')}
                  onDoubleClick={() => onJumpToTab?.(block.jumpTo)}
                  className={`absolute border text-[11px] font-medium px-2 py-1 ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-100 border-dashed text-gray-500' : `cursor-move ${block.color}`} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                  style={{ left: rect.x * SCALE, top: rect.y * SCALE, width: rect.w * SCALE, height: rect.h * SCALE }}
                >
                  <div className="flex items-center justify-between">
                    <span>{block.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(rect.y)}mm
                    </Badge>
                  </div>
                  {block.canResize && !isDisabled && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-nwse-resize" onMouseDown={(e) => startDrag(e, block.key, 'resize')} />
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
