import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, FolderOpen } from 'lucide-react';
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

interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
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
  const lastReportedRef = useRef<string>(JSON.stringify(initialElements));

  // Image gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Blocks state
  const [blocks, setBlocks] = useState<HeaderBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const previewWidth = 780;
  const previewHeight = 300;

  const SNAP_MM = 1.5;

  // Load gallery images with blob URLs
  const loadGalleryImages = useCallback(async () => {
    if (!currentTenant?.id) return;
    setGalleryLoading(true);
    try {
      const folderPath = `${currentTenant.id}/header-images`;
      const { data: files, error } = await supabase.storage
        .from('letter-assets')
        .list(folderPath);

      if (error) {
        console.error('Error listing gallery images:', error);
        setGalleryLoading(false);
        return;
      }

      const imageFiles = (files || []).filter(f => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name));
      
      // Revoke old blob URLs
      galleryImages.forEach(img => URL.revokeObjectURL(img.blobUrl));
      
      const loaded: GalleryImage[] = [];
      for (const file of imageFiles) {
        const filePath = `${folderPath}/${file.name}`;
        try {
          const { data: blob, error: dlError } = await supabase.storage
            .from('letter-assets')
            .download(filePath);
          if (dlError || !blob) continue;
          const blobUrl = URL.createObjectURL(blob);
          loaded.push({ name: file.name, path: filePath, blobUrl });
        } catch (e) {
          console.error('Error downloading', file.name, e);
        }
      }
      setGalleryImages(loaded);
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setGalleryLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadGalleryImages();
    return () => {
      // Cleanup blob URLs on unmount
      galleryImages.forEach(img => URL.revokeObjectURL(img.blobUrl));
    };
  }, [currentTenant?.id]);

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

  useEffect(() => {
    const key = JSON.stringify(elements);
    if (key !== lastReportedRef.current) {
      lastReportedRef.current = key;
      onElementsChange(elements);
    }
  }, [elements]);

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!currentTenant?.id) {
        toast({ title: 'Fehler', description: 'Kein Mandant gefunden', variant: 'destructive' });
        return null;
      }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;
      const { data, error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      // Reload gallery after upload
      await loadGalleryImages();
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
    }
  };

  const handleGalleryUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
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
      id: Date.now().toString(),
      type: 'image',
      x: 20,
      y: 10,
      width: 40,
      height: 20,
      imageUrl: publicUrl,
      preserveAspectRatio: true,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const deleteGalleryImage = async (galleryImg: GalleryImage) => {
    try {
      const { error } = await supabase.storage.from('letter-assets').remove([galleryImg.path]);
      if (error) throw error;
      URL.revokeObjectURL(galleryImg.blobUrl);
      setGalleryImages(prev => prev.filter(i => i.path !== galleryImg.path));
      toast({ title: 'Bild gelöscht' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht gelöscht werden', variant: 'destructive' });
    }
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'text',
      x,
      y,
      content,
      fontSize: 12,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      width: 70,
      height: 8,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const imageUrl = await uploadImage(file);
      if (!imageUrl) return;
      const newElement: HeaderElement = {
        id: Date.now().toString(),
        type: 'image',
        x: 20,
        y: 10,
        width: 40,
        height: 20,
        imageUrl,
        preserveAspectRatio: true,
      };
      setElements((prev) => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    };
    input.click();
  };

  // Block management
  const addBlock = () => {
    const newBlock: HeaderBlock = {
      id: Date.now().toString(),
      type: 'custom',
      title: `Block ${blocks.length + 1}`,
      content: '',
      order: blocks.length,
      widthPercent: 25,
      fontSize: 9,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<HeaderBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const onToolDragStart = (event: React.DragEvent, tool: 'text') => {
    event.dataTransfer.setData('application/x-header-tool', tool);
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeElement(selectedElement.id);
      return;
    }
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

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-4 overflow-y-auto max-h-[75vh]">
        {/* Tools */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            <Button onClick={addImageElement} className="w-full justify-start" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              Bild hochladen & einfügen
            </Button>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium text-xs">Text-Block ziehen</div>
                <div className="text-xs text-muted-foreground">Auf Canvas ziehen</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setShowRuler((v) => !v)}>
                Lineal
              </Button>
              <Button variant={showCenterGuides ? 'default' : 'outline'} size="sm" className="flex-1 text-xs" onClick={() => setShowCenterGuides((v) => !v)}>
                Achsen
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1">
                <FolderOpen className="h-3.5 w-3.5" />
                Bilder-Galerie
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleGalleryUpload} className="h-7 px-2">
                <Upload className="h-3 w-3 mr-1" /> Hochladen
              </Button>
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
                    <img
                      src={img.blobUrl}
                      alt={img.name}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => addImageFromGallery(img)}
                      title={`${img.name} — Klicken zum Einfügen`}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteGalleryImage(img); }}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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
          <CardContent className="px-4 pb-4 space-y-2">
            {blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Blöcke. Erstellen Sie einen neuen Block.</p>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  className={`p-2 border rounded cursor-pointer text-xs ${selectedBlockId === block.id ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{block.title}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground line-clamp-1">{block.content || 'Kein Inhalt'}</p>
                </div>
              ))
            )}
            {selectedBlock && (
              <div className="border-t pt-2 mt-2 space-y-2">
                <div>
                  <Label className="text-xs">Titel</Label>
                  <Input value={selectedBlock.title} onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Inhalt</Label>
                  <Input value={selectedBlock.content} onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })} className="h-7 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Breite (%)</Label>
                    <Input type="number" value={selectedBlock.widthPercent} onChange={(e) => updateBlock(selectedBlock.id, { widthPercent: parseInt(e.target.value) || 25 })} className="h-7 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Schriftgröße</Label>
                    <Input type="number" value={selectedBlock.fontSize} onChange={(e) => updateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value) || 9 })} className="h-7 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Farbe</Label>
                  <Input type="color" value={selectedBlock.color} onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })} className="h-7" />
                </div>
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
                  className={`p-2 border rounded cursor-pointer transition-colors text-xs ${selectedElementId === element.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setSelectedElementId(element.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {element.type === 'text' ? <Type className="h-3.5 w-3.5 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="font-medium truncate">{element.type === 'text' ? (element.content || 'Text').slice(0, 25) : 'Bild'}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>

                  {selectedElementId === element.id && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">X (mm)</Label>
                          <Input type="number" value={element.x} onChange={(e) => updateElement(element.id, { x: validatePosition(parseFloat(e.target.value) || 0, headerMaxWidth) })} className="h-7 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Y (mm)</Label>
                          <Input type="number" value={element.y} onChange={(e) => updateElement(element.id, { y: validatePosition(parseFloat(e.target.value) || 0, headerMaxHeight) })} className="h-7 text-xs" />
                        </div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Input value={element.content || ''} onChange={(e) => updateElement(element.id, { content: e.target.value })} placeholder="Text" className="h-7 text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" value={element.fontSize || 12} onChange={(e) => updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} className="h-7 text-xs" />
                            <Input type="color" value={element.color || '#000000'} onChange={(e) => updateElement(element.id, { color: e.target.value })} className="h-7" />
                          </div>
                          <Select value={element.fontFamily || 'Arial'} onValueChange={(value) => updateElement(element.id, { fontFamily: value })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Calibri">Calibri</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as any).fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontStyle: (element as any).fontStyle === 'italic' ? 'normal' : 'italic' } as any)}>I</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as any).textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textDecoration: (element as any).textDecoration === 'underline' ? 'none' : 'underline' } as any)}>U</Button>
                          </div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Breite (mm)</Label>
                              <Input type="number" value={element.width || 50} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 50 })} className="h-7 text-xs" />
                            </div>
                            <div>
                              <Label className="text-xs">Höhe (mm)</Label>
                              <Input type="number" value={element.height || 30} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 30 })} className="h-7 text-xs" />
                            </div>
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

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Vorschau</CardTitle>
          <p className="text-xs text-muted-foreground">DIN A4 Header (210mm × 45mm). Delete/Backspace löscht Element.</p>
        </CardHeader>
        <CardContent>
          <div className="relative pl-8 pt-8">
            {showRuler && (
              <>
                <div className="absolute top-0 left-8 right-0 h-7 border rounded bg-muted/40 text-[10px] text-muted-foreground pointer-events-none">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span key={i} className="absolute" style={{ left: `${(i * previewWidth) / 21}px` }}>{i * 10}</span>
                  ))}
                </div>
                <div className="absolute top-8 left-0 bottom-0 w-7 border rounded bg-muted/40 text-[10px] text-muted-foreground pointer-events-none">
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
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}
            >
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}

              {/* Render blocks at bottom of header */}
              {blocks.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: '40%' }}>
                  {blocks.map((block) => (
                    <div
                      key={block.id}
                      className={`border-t border-r last:border-r-0 p-1 overflow-hidden ${selectedBlockId === block.id ? 'bg-primary/5 border-primary' : 'border-gray-200'}`}
                      style={{ width: `${block.widthPercent}%`, fontSize: `${block.fontSize * (previewWidth / headerMaxWidth) * 0.3}px`, fontFamily: block.fontFamily, fontWeight: block.fontWeight, color: block.color }}
                      onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); }}
                    >
                      <div className="font-bold text-[10px]">{block.title}</div>
                      <div className="line-clamp-3">{block.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {elements.map((element) => {
                const scaleX = previewWidth / headerMaxWidth;
                const scaleY = previewHeight / headerMaxHeight;
                if (element.type === 'text') {
                  return (
                    <div
                      key={element.id}
                      className={`absolute cursor-move border ${selectedElementId === element.id ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, fontSize: `${(element.fontSize || 12) * Math.min(scaleX, scaleY) * 0.7}px`, fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal', fontStyle: (element as any).fontStyle || 'normal', textDecoration: (element as any).textDecoration || 'none', color: element.color || '#000000', lineHeight: '1.2' }}
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
                      alt="Header Image"
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
