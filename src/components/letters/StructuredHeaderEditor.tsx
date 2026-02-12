import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

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
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  imageUrl?: string;
  preserveAspectRatio?: boolean;
  blockId?: string;
}

interface HeaderBlock {
  id: string;
  type: 'custom';
  title: string;
  content: string;
  order: number;
  widthPercent: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  lineHeight?: number;
  titleHighlight?: boolean;
  titleFontSize?: number;
  titleFontWeight?: string;
  titleColor?: string;
}

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
}

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({ initialElements = [], onElementsChange }) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [elements, setElements] = useState<HeaderElement[]>(initialElements);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [systemImages, setSystemImages] = useState<{ name: string; url: string }[]>([]);
  const [blocks, setBlocks] = useState<HeaderBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const lastReportedRef = useRef<string>('');

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const previewWidth = 580;
  const previewHeight = 220;
  const headerAvailableWidth = 165; // 210mm - 25mm left - 20mm right

  const SNAP_MM = 1.5;

  const snapToOtherElements = (id: string, x: number, y: number) => {
    const current = elements.find((el) => el.id === id);
    if (!current) return { x, y };
    let sx = x;
    let sy = y;
    const w = current.width || 50;
    const h = current.height || 10;
    const edgeTargets = elements.filter((el) => el.id !== id).flatMap((el) => {
      const tw = el.width || 50;
      const th = el.height || 10;
      return [
        { x: el.x, y: el.y },
        { x: el.x + tw, y: el.y + th },
        { x: el.x + tw / 2, y: el.y + th / 2 },
      ];
    });

    for (const t of edgeTargets) {
      if (Math.abs(sx - t.x) <= SNAP_MM) sx = t.x;
      if (Math.abs(sx + w - t.x) <= SNAP_MM) sx = t.x - w;
      if (Math.abs(sx + w / 2 - t.x) <= SNAP_MM) sx = t.x - w / 2;
      if (Math.abs(sy - t.y) <= SNAP_MM) sy = t.y;
      if (Math.abs(sy + h - t.y) <= SNAP_MM) sy = t.y - h;
      if (Math.abs(sy + h / 2 - t.y) <= SNAP_MM) sy = t.y - h / 2;
    }

    return { x: Math.round(sx), y: Math.round(sy) };
  };

  // Report element changes to parent - guarded against duplicate calls
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = JSON.stringify(elements);
    if (key !== lastReportedRef.current) {
      lastReportedRef.current = key;
      onElementsChange(elements);
    }
  }, [elements]);

  // Load system images
  useEffect(() => {
    if (currentTenant?.id) {
      loadSystemImages();
    }
  }, [currentTenant?.id]);

  const loadSystemImages = async () => {
    if (!currentTenant?.id) return;
    try {
      const { data, error } = await supabase.storage
        .from('letter-assets')
        .list(`${currentTenant.id}/_system/briefvorlagen-bilder`);
      if (error) throw error;
      if (data) {
        const images = await Promise.all(
          data
            .filter((f) => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name))
            .map(async (f) => {
              const path = `${currentTenant.id}/_system/briefvorlagen-bilder/${f.name}`;
              // Try public URL first, fall back to signed URL
              const { data: urlData } = supabase.storage.from('letter-assets').getPublicUrl(path);
              let url = urlData.publicUrl;
              // Verify the URL works by trying signed URL as fallback
              try {
                const { data: signedData } = await supabase.storage.from('letter-assets').createSignedUrl(path, 3600);
                if (signedData?.signedUrl) url = signedData.signedUrl;
              } catch {
                // Public URL should work if bucket is public
              }
              return { name: f.name, url };
            })
        );
        setSystemImages(images);
      }
    } catch (error) {
      console.error('Error loading system images:', error);
    }
  };

  // Delete key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElementId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        removeElement(selectedElementId);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId]);

  const uploadImageToSystem = async (file: File): Promise<string | null> => {
    try {
      if (!currentTenant?.id) {
        toast({ title: 'Fehler', description: 'Kein Mandant gefunden', variant: 'destructive' });
        return null;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/_system/briefvorlagen-bilder/${fileName}`;
      const { data, error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      await loadSystemImages();
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
    }
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadImageToSystem(file);
      toast({ title: 'Bild hochgeladen', description: 'Das Bild wurde im Systemordner gespeichert.' });
    };
    input.click();
  };

  const addImageElementFromUrl = (imageUrl: string, x = 20, y = 10) => {
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newElement: HeaderElement = {
      id, type: 'image', x, y,
      width: 40, height: 20, imageUrl, preserveAspectRatio: true,
    };
    setElements((prev) => {
      if (prev.some((el) => el.id === id)) return prev;
      return [...prev, newElement];
    });
    setSelectedElementId(id);
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const id = `txt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newElement: HeaderElement = {
      id, type: 'text', x, y, content,
      fontSize: 12, fontFamily: 'Arial', fontWeight: 'normal',
      fontStyle: 'normal', textDecoration: 'none', color: '#000000',
      width: 70, height: 8,
    };
    setElements((prev) => {
      if (prev.some((el) => el.id === id)) return prev;
      return [...prev, newElement];
    });
    setSelectedElementId(id);
  };

  const addBlock = () => {
    const newBlock: HeaderBlock = {
      id: Date.now().toString(),
      type: 'custom',
      title: `Block ${blocks.length + 1}`,
      content: 'Neuer Inhalt',
      order: blocks.length,
      widthPercent: 25,
      fontSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      lineHeight: 0.8,
      titleHighlight: false,
      titleFontSize: 13,
      titleFontWeight: 'bold',
      titleColor: '#107030',
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<HeaderBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlockUp = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      next.forEach((b, i) => (b.order = i));
      return next;
    });
  };

  const moveBlockDown = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      next.forEach((b, i) => (b.order = i));
      return next;
    });
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const onToolDragStart = (event: React.DragEvent, tool: 'text' | 'image' | 'block', imageUrl?: string) => {
    event.dataTransfer.setData('application/x-header-tool', tool);
    if (imageUrl) event.dataTransfer.setData('application/x-image-url', imageUrl);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const onPreviewDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tool = event.dataTransfer.getData('application/x-header-tool');
    if (!tool || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const scaleX = previewWidth / headerMaxWidth;
    const scaleY = previewHeight / headerMaxHeight;
    const x = Math.max(0, Math.min(headerMaxWidth, (event.clientX - rect.left) / scaleX));
    const y = Math.max(0, Math.min(headerMaxHeight, (event.clientY - rect.top) / scaleY));
    if (tool === 'text') addTextElement(Math.round(x), Math.round(y));
    if (tool === 'image') {
      const imageUrl = event.dataTransfer.getData('application/x-image-url');
      if (imageUrl) addImageElementFromUrl(imageUrl, Math.round(x), Math.round(y));
    }
    if (tool === 'block') addBlock();
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId);
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  const onElementMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    event.stopPropagation();
    setSelectedElementId(element.id);
    setDragId(element.id);
    setDragStart({ x: event.clientX, y: event.clientY, ox: element.x, oy: element.y });
  };

  const onPreviewMouseMove = (event: React.MouseEvent) => {
    if (!dragId || !dragStart) return;
    const scaleX = previewWidth / headerMaxWidth;
    const scaleY = previewHeight / headerMaxHeight;
    const dx = (event.clientX - dragStart.x) / scaleX;
    const dy = (event.clientY - dragStart.y) / scaleY;
    const nx = Math.max(0, Math.min(headerMaxWidth, dragStart.ox + dx));
    const ny = Math.max(0, Math.min(headerMaxHeight, dragStart.oy + dy));
    const snapped = snapToOtherElements(dragId, nx, ny);
    updateElement(dragId, { x: snapped.x, y: snapped.y });
  };

  const onPreviewMouseUp = () => {
    setDragId(null);
    setDragStart(null);
  };

  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedElement) return;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -1;
    if (event.key === 'ArrowRight') dx = 1;
    if (event.key === 'ArrowUp') dy = -1;
    if (event.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    event.preventDefault();
    updateElement(selectedElement.id, {
      x: Math.max(0, Math.min(headerMaxWidth, selectedElement.x + dx)),
      y: Math.max(0, Math.min(headerMaxHeight, selectedElement.y + dy)),
    });
  };

  const validatePosition = (value: number, max: number) => Math.max(0, Math.min(value, max));

  const calculateActualWidth = (widthPercent: number) => (headerAvailableWidth * widthPercent) / 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Sidebar */}
      <div className="space-y-4">
        {/* Tools */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Werkzeuge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium flex items-center gap-1"><Type className="h-3 w-3" /> Text-Block</div>
                <div className="text-xs text-muted-foreground">Ziehen auf Canvas</div>
              </div>
            </div>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'block')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium flex items-center gap-1"><Layers className="h-3 w-3" /> Block</div>
                <div className="text-xs text-muted-foreground">Ziehen auf Canvas</div>
              </div>
            </div>
            <Separator />
            <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setShowRuler((v) => !v)}>
              Lineal {showRuler ? 'aus' : 'ein'}
            </Button>
            <Button variant={showCenterGuides ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setShowCenterGuides((v) => !v)}>
              Mittelachsen {showCenterGuides ? 'aus' : 'ein'}
            </Button>
          </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Bilder</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleImageUpload} className="h-7 px-2">
                <Upload className="h-3 w-3 mr-1" /> Hochladen
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {systemImages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Bilder vorhanden. Laden Sie ein Bild hoch.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {systemImages.map((img) => (
                  <div
                    key={img.name}
                    draggable
                    onDragStart={(e) => onToolDragStart(e, 'image', img.url)}
                    className="border rounded overflow-hidden cursor-grab active:cursor-grabbing aspect-square bg-muted/30"
                    title={img.name}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocks */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Blöcke ({blocks.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={addBlock} className="h-7 px-2">
                <Plus className="h-3 w-3 mr-1" /> Neu
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Blöcke. Ziehen Sie einen Block auf den Canvas.</p>
            ) : (
              blocks.sort((a, b) => a.order - b.order).map((block, index) => (
                <div
                  key={block.id}
                  className={`p-2 border rounded cursor-pointer text-sm transition-colors ${selectedBlockId === block.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => { setSelectedBlockId(block.id); setSelectedElementId(null); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      <span className="font-medium truncate">{block.title}</span>
                    </div>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="sm" className="h-5 px-0.5" onClick={(e) => { e.stopPropagation(); moveBlockUp(block.id); }} disabled={index === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 px-0.5" onClick={(e) => { e.stopPropagation(); moveBlockDown(block.id); }} disabled={index === blocks.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 px-0.5" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{block.widthPercent}% ({calculateActualWidth(block.widthPercent).toFixed(1)}mm)</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Block Properties */}
        {selectedBlock && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Block-Eigenschaften</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-3">
              <div>
                <Label className="text-xs">Titel</Label>
                <Input value={selectedBlock.title} onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Inhalt</Label>
                <Textarea value={selectedBlock.content} onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })} rows={3} />
              </div>
              <div>
                <Label className="text-xs">Breite (%)</Label>
                <Input type="number" value={selectedBlock.widthPercent} onChange={(e) => updateBlock(selectedBlock.id, { widthPercent: Math.max(1, Math.min(100, parseInt(e.target.value) || 25)) })} min={1} max={100} />
                <p className="text-xs text-muted-foreground">= {calculateActualWidth(selectedBlock.widthPercent).toFixed(1)}mm</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Schriftgröße</Label>
                  <Input type="number" value={selectedBlock.fontSize} onChange={(e) => updateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value) || 10 })} min={6} max={24} />
                </div>
                <div>
                  <Label className="text-xs">Zeilenhöhe</Label>
                  <Input type="number" value={selectedBlock.lineHeight || 1} onChange={(e) => updateBlock(selectedBlock.id, { lineHeight: parseFloat(e.target.value) || 1 })} step="0.1" min={0.5} max={3} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Schriftart</Label>
                <Select value={selectedBlock.fontFamily} onValueChange={(v) => updateBlock(selectedBlock.id, { fontFamily: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Calibri">Calibri</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Schriftstärke</Label>
                  <Select value={selectedBlock.fontWeight} onValueChange={(v) => updateBlock(selectedBlock.id, { fontWeight: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Fett</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Farbe</Label>
                  <Input type="color" value={selectedBlock.color} onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })} className="h-9" />
                </div>
              </div>
              <Separator />
              <div className="flex items-center space-x-2">
                <Checkbox id={`highlight-${selectedBlock.id}`} checked={selectedBlock.titleHighlight || false} onCheckedChange={(checked) => updateBlock(selectedBlock.id, { titleHighlight: checked as boolean, titleFontSize: checked ? (selectedBlock.titleFontSize || 13) : selectedBlock.titleFontSize, titleFontWeight: checked ? (selectedBlock.titleFontWeight || 'bold') : selectedBlock.titleFontWeight, titleColor: checked ? (selectedBlock.titleColor || '#107030') : selectedBlock.titleColor })} />
                <Label htmlFor={`highlight-${selectedBlock.id}`} className="text-xs">Titel hervorheben</Label>
              </div>
              {selectedBlock.titleHighlight && (
                <div className="space-y-2 border-l-2 border-primary/20 pl-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Titel-Größe</Label><Input type="number" value={selectedBlock.titleFontSize || 13} onChange={(e) => updateBlock(selectedBlock.id, { titleFontSize: parseInt(e.target.value) || 13 })} min={8} max={24} /></div>
                    <div><Label className="text-xs">Titel-Farbe</Label><Input type="color" value={selectedBlock.titleColor || '#107030'} onChange={(e) => updateBlock(selectedBlock.id, { titleColor: e.target.value })} className="h-9" /></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Elements list */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente ({elements.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-3">
            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              elements.map((element) => (
                <div
                  key={element.id}
                  className={`p-2 border rounded cursor-pointer transition-colors text-sm ${selectedElementId === element.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => { setSelectedElementId(element.id); setSelectedBlockId(null); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        {element.type === 'text' ? <Type className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
                        <span className="font-medium truncate">{element.type === 'text' ? (element.content || 'Text').slice(0, 30) : 'Bild'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">x:{element.x} y:{element.y}mm</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-1 shrink-0" onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  {selectedElementId === element.id && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-1">
                        <div><Label className="text-xs">X (mm)</Label><Input type="number" value={element.x} onChange={(e) => updateElement(element.id, { x: validatePosition(parseFloat(e.target.value) || 0, headerMaxWidth) })} /></div>
                        <div><Label className="text-xs">Y (mm)</Label><Input type="number" value={element.y} onChange={(e) => updateElement(element.id, { y: validatePosition(parseFloat(e.target.value) || 0, headerMaxHeight) })} /></div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Input value={element.content || ''} onChange={(e) => updateElement(element.id, { content: e.target.value })} placeholder="Text eingeben..." />
                          <div className="grid grid-cols-2 gap-1">
                            <Input type="number" value={element.fontSize || 12} onChange={(e) => updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} />
                            <Input type="color" value={element.color || '#000000'} onChange={(e) => updateElement(element.id, { color: e.target.value })} className="h-9" />
                          </div>
                          <Select value={element.fontFamily || 'Arial'} onValueChange={(value) => updateElement(element.id, { fontFamily: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Calibri">Calibri</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" variant={element.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                            <Button type="button" size="sm" variant={element.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Button>
                            <Button type="button" size="sm" variant={element.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })}>U</Button>
                          </div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <div className="grid grid-cols-2 gap-1">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 50} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 50 })} /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 30} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 30 })} /></div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`preserve-${element.id}`} checked={element.preserveAspectRatio || false} onCheckedChange={(checked) => updateElement(element.id, { preserveAspectRatio: checked as boolean })} />
                            <Label htmlFor={`preserve-${element.id}`} className="text-xs">Seitenverhältnis</Label>
                          </div>
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

      {/* Canvas */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Vorschau</CardTitle>
          <p className="text-xs text-muted-foreground">210mm × 45mm – Maus/Pfeiltasten zum Bewegen, Entf zum Löschen</p>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="relative pl-7 pt-7">
            {showRuler && (
              <>
                <div className="absolute top-0 left-7 right-0 h-6 border rounded bg-muted/40 text-[9px] text-muted-foreground pointer-events-none">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span key={i} className="absolute" style={{ left: `${(i * previewWidth) / 21}px` }}>{i * 10}</span>
                  ))}
                </div>
                <div className="absolute top-7 left-0 bottom-0 w-6 border rounded bg-muted/40 text-[9px] text-muted-foreground pointer-events-none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="absolute" style={{ top: `${(i * previewHeight) / 5}px` }}>{i * 10}</span>
                  ))}
                </div>
              </>
            )}

            <div
              ref={previewRef}
              tabIndex={0}
              onKeyDown={onPreviewKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onPreviewDrop}
              onMouseMove={onPreviewMouseMove}
              onMouseUp={onPreviewMouseUp}
              onMouseLeave={onPreviewMouseUp}
              onClick={(e) => { if (e.target === e.currentTarget) { setSelectedElementId(null); setSelectedBlockId(null); } }}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}
            >
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}
              {/* Render blocks horizontally like footer */}
              {blocks.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: '40%' }}>
                  {blocks.sort((a, b) => a.order - b.order).map((block) => (
                    <div
                      key={`block-${block.id}`}
                      className={`border-t border-r border-dashed cursor-pointer ${selectedBlockId === block.id ? 'border-blue-500 bg-blue-500/10' : 'border-blue-300/50 bg-blue-50/30'}`}
                      style={{ width: `${block.widthPercent}%`, fontFamily: block.fontFamily, fontSize: `${block.fontSize * 0.8}px`, color: block.color, lineHeight: block.lineHeight || 1, padding: '4px' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); setSelectedElementId(null); }}
                    >
                      {block.titleHighlight ? (
                        <div style={{ fontSize: `${(block.titleFontSize || 13) * 0.8}px`, fontWeight: block.titleFontWeight || 'bold', color: block.titleColor || '#107030' }}>{block.title}</div>
                      ) : (
                        <div className="font-medium text-[9px]">{block.title}</div>
                      )}
                      <div className="whitespace-pre-line text-[8px] mt-0.5 opacity-80">{block.content.split('\n').slice(0, 3).join('\n')}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Render elements */}
              {elements.map((element) => {
                const scaleX = previewWidth / headerMaxWidth;
                const scaleY = previewHeight / headerMaxHeight;
                if (element.type === 'text') {
                  return (
                    <div
                      key={element.id}
                      className={`absolute cursor-move border ${selectedElementId === element.id ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, fontSize: `${(element.fontSize || 12) * Math.min(scaleX, scaleY) * 0.7}px`, fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal', fontStyle: element.fontStyle || 'normal', textDecoration: element.textDecoration || 'none', color: element.color || '#000000', lineHeight: '1.2' }}
                      onMouseDown={(e) => onElementMouseDown(e, element)}
                    >
                      {element.content || 'Text'}
                    </div>
                  );
                }
                if (element.type === 'image' && element.imageUrl) {
                  return (
                    <img
                      key={element.id}
                      src={element.imageUrl}
                      alt="Header"
                      className={`absolute cursor-move object-contain border ${selectedElementId === element.id ? 'border-primary border-dashed border-2' : 'border-transparent'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${(element.width || 50) * scaleX}px`, height: `${(element.height || 30) * scaleY}px` }}
                      onMouseDown={(e) => onElementMouseDown(e, element)}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
