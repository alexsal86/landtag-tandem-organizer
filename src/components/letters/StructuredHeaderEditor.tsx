import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical } from 'lucide-react';
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
  color?: string;
  imageUrl?: string;
  preserveAspectRatio?: boolean;
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const headerMaxWidth = 210;
  const headerMaxHeight = 45;
  const previewWidth = 780;
  const previewHeight = 300;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onElementsChange(elements);
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
      const {
        data: { publicUrl },
      } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
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
    updateElement(dragId, {
      x: Math.max(0, Math.min(headerMaxWidth, Math.round(dragStart.ox + dx))),
      y: Math.max(0, Math.min(headerMaxHeight, Math.round(dragStart.oy + dy))),
    });
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
    <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elemente hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={() => addTextElement()} className="w-full justify-start">
              <Type className="h-4 w-4 mr-2" />
              Text hinzufügen
            </Button>
            <Button onClick={addImageElement} className="w-full justify-start">
              <ImageIcon className="h-4 w-4 mr-2" />
              Bild hinzufügen
            </Button>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-medium">Text-Block ziehen</div>
                <div className="text-xs text-muted-foreground">Lorem ipsum dolor sit amet</div>
              </div>
            </div>
            <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setShowRuler((v) => !v)}>
              Außenlineal {showRuler ? 'ausblenden' : 'einblenden'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elemente ({elements.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {elements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              elements.map((element) => (
                <div
                  key={element.id}
                  className={`p-3 border rounded cursor-pointer transition-colors ${selectedElementId === element.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setSelectedElementId(element.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {element.type === 'text' ? <Type className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                        <span className="font-medium text-sm">{element.type === 'text' ? element.content : 'Bild'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeElement(element.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {selectedElementId === element.id && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <Label className="text-xs uppercase text-muted-foreground">Element-Eigenschaften</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>X (mm)</Label>
                          <Input type="number" value={element.x} onChange={(e) => updateElement(element.id, { x: validatePosition(parseFloat(e.target.value) || 0, headerMaxWidth) })} />
                        </div>
                        <div>
                          <Label>Y (mm)</Label>
                          <Input type="number" value={element.y} onChange={(e) => updateElement(element.id, { y: validatePosition(parseFloat(e.target.value) || 0, headerMaxHeight) })} />
                        </div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Label>Text</Label>
                          <Input value={element.content || ''} onChange={(e) => updateElement(element.id, { content: e.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="number" value={element.fontSize || 12} onChange={(e) => updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} />
                            <Input type="color" value={element.color || '#000000'} onChange={(e) => updateElement(element.id, { color: e.target.value })} />
                          </div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Breite (mm)</Label>
                              <Input type="number" value={element.width || 50} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 50 })} />
                            </div>
                            <div>
                              <Label>Höhe (mm)</Label>
                              <Input type="number" value={element.height || 30} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 30 })} />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`preserve-${element.id}`} checked={element.preserveAspectRatio || false} onCheckedChange={(checked) => updateElement(element.id, { preserveAspectRatio: checked as boolean })} />
                            <Label htmlFor={`preserve-${element.id}`}>Seitenverhältnis beibehalten</Label>
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
        <CardHeader>
          <CardTitle className="text-lg">Vorschau</CardTitle>
          <p className="text-sm text-muted-foreground">DIN A4 Header (210mm × 45mm), Blöcke per Maus/Pfeiltasten bewegbar</p>
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
              className="border border-gray-300 bg-white relative overflow-hidden outline-none"
              style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '10px 10px' }}
            >
              {elements.map((element) => {
                const scaleX = previewWidth / headerMaxWidth;
                const scaleY = previewHeight / headerMaxHeight;
                if (element.type === 'text') {
                  return (
                    <div
                      key={element.id}
                      className={`absolute cursor-move border ${selectedElementId === element.id ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'}`}
                      style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, fontSize: `${(element.fontSize || 12) * Math.min(scaleX, scaleY) * 0.7}px`, fontFamily: element.fontFamily || 'Arial', fontWeight: element.fontWeight || 'normal', color: element.color || '#000000', lineHeight: '1.2' }}
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
