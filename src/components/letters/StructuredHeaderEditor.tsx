import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Type, Image as ImageIcon, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface HeaderElement {
  id: string;
  type: 'text' | 'image';
  x: number; // Position in mm from left
  y: number; // Position in mm from top
  width?: number; // Width in mm
  height?: number; // Height in mm
  content?: string; // For text elements
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  imageUrl?: string; // For image elements
  preserveAspectRatio?: boolean;
}

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
}

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({
  initialElements = [],
  onElementsChange
}) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [elements, setElements] = useState<HeaderElement[]>(initialElements);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const headerMaxWidth = 210; // A4 width in mm
  const headerMaxHeight = 45; // Header height in mm

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onElementsChange(elements);
  }, [elements]);

  const addTextElement = () => {
    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'text',
      x: 20,
      y: 15,
      content: 'Neuer Text',
      fontSize: 12,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000'
    };
    setElements([...elements, newElement]);
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
        y: 15,
        width: 50,
        height: 30,
        imageUrl,
        preserveAspectRatio: true
      };
      setElements([...elements, newElement]);
      setSelectedElementId(newElement.id);
    };
    input.click();
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      if (!currentTenant?.id) {
        toast({ title: "Fehler", description: "Kein Mandant gefunden", variant: "destructive" });
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;

      const { data, error } = await supabase.storage
        .from('letter-assets')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('letter-assets')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Fehler", description: "Bild konnte nicht hochgeladen werden", variant: "destructive" });
      return null;
    }
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
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
    const scaleX = 300 / headerMaxWidth;
    const scaleY = 220 / headerMaxHeight;
    const x = Math.max(0, Math.min(headerMaxWidth, (event.clientX - rect.left) / scaleX));
    const y = Math.max(0, Math.min(headerMaxHeight, (event.clientY - rect.top) / scaleY));
    if (tool === 'text') {
      const newElement: HeaderElement = {
        id: Date.now().toString(),
        type: 'text',
        x: Math.round(x),
        y: Math.round(y),
        content: 'Neuer Text',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000'
      };
      setElements((prev) => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  const validatePosition = (value: number, max: number) => {
    return Math.max(0, Math.min(value, max));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Element List & Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elemente hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={addTextElement} className="w-full justify-start">
              <Type className="h-4 w-4 mr-2" />
              Text hinzufügen
            </Button>
            <Button onClick={addImageElement} className="w-full justify-start">
              <ImageIcon className="h-4 w-4 mr-2" />
              Bild hinzufügen
            </Button>
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing">
              Text-Block in Header ziehen
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elemente ({elements.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {elements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              <div className="space-y-2">
                {elements.map((element) => (
                  <div
                    key={element.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedElementId === element.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedElementId(element.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {element.type === 'text' ? 
                            <Type className="h-4 w-4" /> : 
                            <ImageIcon className="h-4 w-4" />
                          }
                          <span className="font-medium text-sm">
                            {element.type === 'text' ? element.content : 'Bild'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          x: {element.x}mm, y: {element.y}mm
                        </p>
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Properties Panel */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedElement ? 'Element-Eigenschaften' : 'Element auswählen'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedElement ? (
              <div className="space-y-4">
                {/* Position */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>X-Position (mm)</Label>
                    <Input
                      type="number"
                      value={selectedElement.x}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        x: validatePosition(parseFloat(e.target.value) || 0, headerMaxWidth) 
                      })}
                      min={0}
                      max={headerMaxWidth}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <Label>Y-Position (mm)</Label>
                    <Input
                      type="number"
                      value={selectedElement.y}
                      onChange={(e) => updateElement(selectedElement.id, { 
                        y: validatePosition(parseFloat(e.target.value) || 0, headerMaxHeight) 
                      })}
                      min={0}
                      max={headerMaxHeight}
                      step={0.5}
                    />
                  </div>
                </div>

                {selectedElement.type === 'text' && (
                  <>
                    <Separator />
                    <div>
                      <Label>Text</Label>
                      <Input
                        value={selectedElement.content || ''}
                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                        placeholder="Text eingeben..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Schriftgröße</Label>
                        <Input
                          type="number"
                          value={selectedElement.fontSize || 12}
                          onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 12 })}
                          min={6}
                          max={72}
                        />
                      </div>
                      <div>
                        <Label>Schriftart</Label>
                        <Select
                          value={selectedElement.fontFamily || 'Arial'}
                          onValueChange={(value) => updateElement(selectedElement.id, { fontFamily: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Times">Times</SelectItem>
                            <SelectItem value="Courier">Courier</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Schriftstärke</Label>
                        <Select
                          value={selectedElement.fontWeight || 'normal'}
                          onValueChange={(value) => updateElement(selectedElement.id, { fontWeight: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="bold">Fett</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Textfarbe</Label>
                        <Input
                          type="color"
                          value={selectedElement.color || '#000000'}
                          onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedElement.type === 'image' && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Breite (mm)</Label>
                        <Input
                          type="number"
                          value={selectedElement.width || 50}
                          onChange={(e) => {
                            const width = parseFloat(e.target.value) || 50;
                            const updates: Partial<HeaderElement> = { width };
                            
                            if (selectedElement.preserveAspectRatio && selectedElement.height) {
                              const aspectRatio = selectedElement.width! / selectedElement.height;
                              updates.height = width / aspectRatio;
                            }
                            
                            updateElement(selectedElement.id, updates);
                          }}
                          min={1}
                          max={headerMaxWidth}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <Label>Höhe (mm)</Label>
                        <Input
                          type="number"
                          value={selectedElement.height || 30}
                          onChange={(e) => {
                            const height = parseFloat(e.target.value) || 30;
                            const updates: Partial<HeaderElement> = { height };
                            
                            if (selectedElement.preserveAspectRatio && selectedElement.width) {
                              const aspectRatio = selectedElement.width / selectedElement.height!;
                              updates.width = height * aspectRatio;
                            }
                            
                            updateElement(selectedElement.id, updates);
                          }}
                          min={1}
                          max={headerMaxHeight}
                          step={0.5}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="preserve-aspect-ratio"
                        checked={selectedElement.preserveAspectRatio || false}
                        onCheckedChange={(checked) => updateElement(selectedElement.id, { preserveAspectRatio: checked as boolean })}
                      />
                      <Label htmlFor="preserve-aspect-ratio">Seitenverhältnis beibehalten</Label>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Wählen Sie ein Element aus der Liste aus, um seine Eigenschaften zu bearbeiten.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Preview */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vorschau</CardTitle>
            <p className="text-sm text-muted-foreground">
              DIN A4 Header (210mm × 45mm)
            </p>
          </CardHeader>
          <CardContent>
            <div 
              ref={previewRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onPreviewDrop}
              className="border border-gray-300 bg-white relative overflow-hidden"
              style={{
                width: '100%',
                height: '220px', // Scaled down for display
                backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
                backgroundSize: '10px 10px'
              }}
            >
              {elements.map((element) => {
                const scaleX = 300 / headerMaxWidth; // Scale factor for display
                const scaleY = 220 / headerMaxHeight;
                
                if (element.type === 'text') {
                  return (
                    <div
                      key={element.id}
                      className={`absolute cursor-pointer border border-transparent ${
                        selectedElementId === element.id ? 'border-primary border-dashed' : ''
                      }`}
                      style={{
                        left: `${element.x * scaleX}px`,
                        top: `${element.y * scaleY}px`,
                        fontSize: `${(element.fontSize || 12) * Math.min(scaleX, scaleY) * 0.8}px`,
                        fontFamily: element.fontFamily || 'Arial',
                        fontWeight: element.fontWeight || 'normal',
                        color: element.color || '#000000',
                        lineHeight: '1.2'
                      }}
                      onClick={() => setSelectedElementId(element.id)}
                    >
                      {element.content || 'Text'}
                    </div>
                  );
                } else if (element.type === 'image' && element.imageUrl) {
                  return (
                    <img
                      key={element.id}
                      src={element.imageUrl}
                      alt="Header Image"
                      className={`absolute cursor-pointer border border-transparent object-contain ${
                        selectedElementId === element.id ? 'border-primary border-dashed border-2' : ''
                      }`}
                      style={{
                        left: `${element.x * scaleX}px`,
                        top: `${element.y * scaleY}px`,
                        width: `${(element.width || 50) * scaleX}px`,
                        height: `${(element.height || 30) * scaleY}px`
                      }}
                      onClick={() => setSelectedElementId(element.id)}
                    />
                  );
                }
                return null;
              })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Klicken Sie auf Elemente zur Auswahl • Skaliert für Anzeige
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};