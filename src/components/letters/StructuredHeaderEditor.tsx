import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, Layers } from 'lucide-react';
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
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const previewWidth = 580;
  const previewHeight = 220;

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onElementsChange(elements);
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
        const images = data
          .filter((f) => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name))
          .map((f) => {
            const { data: urlData } = supabase.storage
              .from('letter-assets')
              .getPublicUrl(`${currentTenant.id}/_system/briefvorlagen-bilder/${f.name}`);
            return { name: f.name, url: urlData.publicUrl };
          });
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
    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'image',
      x, y,
      width: 40,
      height: 20,
      imageUrl,
      preserveAspectRatio: true,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'text',
      x, y,
      content,
      fontSize: 12,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#000000',
      width: 70,
      height: 8,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const addBlock = () => {
    const newBlock: HeaderBlock = {
      id: Date.now().toString(),
      name: `Block ${blocks.length + 1}`,
      x: 10, y: 5,
      width: 60, height: 20,
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const onToolDragStart = (event: React.DragEvent, tool: 'text' | 'image', imageUrl?: string) => {
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
  };

  const selectedElement = elements.find((el) => el.id === selectedElementId);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_580px] gap-4">
      {/* Sidebar - scrollable */}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
            <Button onClick={addBlock} variant="outline" size="sm" className="w-full justify-start">
              <Layers className="h-4 w-4 mr-2" />
              Block hinzufügen
            </Button>
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
        {blocks.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Blöcke ({blocks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-3">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className={`p-2 border rounded cursor-pointer text-sm transition-colors ${selectedBlockId === block.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      <span className="font-medium">{block.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={(e) => { e.stopPropagation(); setBlocks((prev) => prev.filter((b) => b.id !== block.id)); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  {selectedBlockId === block.id && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <Input value={block.name} onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, name: e.target.value } : b))} placeholder="Blockname" />
                      <div className="grid grid-cols-2 gap-1">
                        <div><Label className="text-xs">X</Label><Input type="number" value={block.x} onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, x: parseFloat(e.target.value) || 0 } : b))} /></div>
                        <div><Label className="text-xs">Y</Label><Input type="number" value={block.y} onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, y: parseFloat(e.target.value) || 0 } : b))} /></div>
                        <div><Label className="text-xs">Breite</Label><Input type="number" value={block.width} onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, width: parseFloat(e.target.value) || 0 } : b))} /></div>
                        <div><Label className="text-xs">Höhe</Label><Input type="number" value={block.height} onChange={(e) => setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, height: parseFloat(e.target.value) || 0 } : b))} /></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
                  onClick={() => setSelectedElementId(element.id)}
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
              onClick={() => setSelectedElementId(null)}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}
            >
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}
              {/* Render blocks */}
              {blocks.map((block) => {
                const scaleX = previewWidth / headerMaxWidth;
                const scaleY = previewHeight / headerMaxHeight;
                return (
                  <div
                    key={`block-${block.id}`}
                    className={`absolute border-2 border-dashed pointer-events-none ${selectedBlockId === block.id ? 'border-blue-500 bg-blue-500/5' : 'border-blue-300/50 bg-blue-100/10'}`}
                    style={{ left: `${block.x * scaleX}px`, top: `${block.y * scaleY}px`, width: `${block.width * scaleX}px`, height: `${block.height * scaleY}px` }}
                  >
                    <span className="absolute -top-4 left-0 text-[9px] text-blue-500 bg-white px-1">{block.name}</span>
                  </div>
                );
              })}
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
