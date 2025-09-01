import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, Textbox, FabricImage, Rect } from 'fabric';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Upload, Type, Image as ImageIcon, Square, Circle, Undo, Redo, Trash2, Save, Eye, Code, Grid, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface FabricHeaderEditorProps {
  template: any;
  onSave: (headerData: any) => void;
  onCancel: () => void;
}

export const FabricHeaderEditor: React.FC<FabricHeaderEditorProps> = ({
  template,
  onSave,
  onCancel
}) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  
  // Object properties
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontWeight, setFontWeight] = useState('normal');
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  
  // Code mode
  const [htmlCode, setHtmlCode] = useState(template?.letterhead_html || '');
  const [cssCode, setCssCode] = useState(template?.letterhead_css || '');

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 595, // A4 width in points
      height: 200, // Header height
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    // Add grid
    if (showGrid) {
      addGrid(canvas);
    }

    // Load existing header elements
    if (template?.header_text_elements) {
      loadHeaderElements(canvas, template.header_text_elements);
    }

    // Event listeners
    canvas.on('selection:created', (e) => {
      setSelectedObject(e.selected?.[0] || null);
      updatePropertiesFromObject(e.selected?.[0]);
    });

    canvas.on('selection:updated', (e) => {
      setSelectedObject(e.selected?.[0] || null);
      updatePropertiesFromObject(e.selected?.[0]);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
    });

    canvas.on('object:modified', () => {
      canvas.renderAll();
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update grid visibility
  useEffect(() => {
    if (!fabricCanvas) return;
    
    if (showGrid) {
      addGrid(fabricCanvas);
    } else {
      removeGrid(fabricCanvas);
    }
    fabricCanvas.renderAll();
  }, [showGrid, fabricCanvas]);

  // Update zoom
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.setZoom(zoom);
    fabricCanvas.renderAll();
  }, [zoom, fabricCanvas]);

  const addGrid = (canvas: FabricCanvas) => {
    const grid = 20;
    const width = canvas.getWidth();
    const height = canvas.getHeight();

    // Remove existing grid
    removeGrid(canvas);

    // Add vertical lines
    for (let i = 0; i < width / grid; i++) {
      const line = new Rect({
        left: i * grid,
        top: 0,
        width: 1,
        height: height,
        fill: '#e0e0e0',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true,
      } as any);
      canvas.add(line);
    }

    // Add horizontal lines
    for (let i = 0; i < height / grid; i++) {
      const line = new Rect({
        left: 0,
        top: i * grid,
        width: width,
        height: 1,
        fill: '#e0e0e0',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGrid: true,
      } as any);
      canvas.add(line);
    }
  };

  const removeGrid = (canvas: FabricCanvas) => {
    const objects = canvas.getObjects();
    const gridObjects = objects.filter((obj: any) => obj.isGrid);
    gridObjects.forEach(obj => canvas.remove(obj));
  };

  const loadHeaderElements = async (canvas: FabricCanvas, elements: any[]) => {
    for (const element of elements) {
      try {
        if (element.type === 'text') {
          const textObj = new Textbox(element.content || 'Text', {
            left: element.x || 50,
            top: element.y || 50,
            fontSize: element.fontSize || 16,
            fontFamily: 'Arial',
            fontWeight: element.fontWeight || 'normal',
            fill: element.color || '#000000',
            width: element.width || 200,
          });
          canvas.add(textObj);
        } else if (element.type === 'image' && element.imageUrl) {
          FabricImage.fromURL(element.imageUrl).then((img) => {
            img.set({
              left: element.x || 50,
              top: element.y || 50,
              scaleX: (element.width || 200) / (img.width || 1),
              scaleY: (element.height || 100) / (img.height || 1),
            });
            canvas.add(img);
          });
        }
      } catch (error) {
        console.error('Error loading element:', error);
      }
    }
    canvas.renderAll();
  };

  const updatePropertiesFromObject = (obj: any) => {
    if (!obj) return;

    if (obj.type === 'textbox') {
      setFontSize(obj.fontSize || 16);
      setFontFamily(obj.fontFamily || 'Arial');
      setFontWeight(obj.fontWeight || 'normal');
      setTextColor(obj.fill || '#000000');
    }
  };

  const uploadImage = async (file: File) => {
    try {
      if (!currentTenant?.id) {
        toast({ title: "Fehler", description: "Kein Mandant gefunden", variant: "destructive" });
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentTenant.id}/${fileName}`;

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const imageUrl = await uploadImage(file);
    if (!imageUrl) return;

    FabricImage.fromURL(imageUrl).then((img) => {
      img.set({
        left: 50,
        top: 50,
        scaleX: 0.5,
        scaleY: 0.5,
      });
      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      fabricCanvas.renderAll();
    });
  };

  const addText = () => {
    if (!fabricCanvas) return;

    const textObj = new Textbox('Neuer Text', {
      left: 50,
      top: 50,
      fontSize: 16,
      fontFamily: 'Arial',
      fill: '#000000',
      width: 200,
    });

    fabricCanvas.add(textObj);
    fabricCanvas.setActiveObject(textObj);
    fabricCanvas.renderAll();
  };

  const addRectangle = () => {
    if (!fabricCanvas) return;

    const rect = new Rect({
      left: 50,
      top: 50,
      width: 100,
      height: 60,
      fill: '#3b82f6',
      stroke: '#1e40af',
      strokeWidth: 2,
    });

    fabricCanvas.add(rect);
    fabricCanvas.setActiveObject(rect);
    fabricCanvas.renderAll();
  };

  const updateSelectedObject = (property: string, value: any) => {
    if (!selectedObject || !fabricCanvas) return;

    selectedObject.set(property, value);
    fabricCanvas.renderAll();
  };

  const deleteSelected = () => {
    if (!selectedObject || !fabricCanvas) return;
    
    fabricCanvas.remove(selectedObject);
    fabricCanvas.renderAll();
  };

  const exportData = () => {
    if (!fabricCanvas) return null;

    // Remove grid objects before export
    const objects = fabricCanvas.getObjects();
    const nonGridObjects = objects.filter((obj: any) => !obj.isGrid);

    const headerElements = nonGridObjects.map((obj: any) => ({
      id: obj.id || Math.random().toString(),
      type: obj.type === 'textbox' ? 'text' : obj.type === 'image' ? 'image' : 'shape',
      x: obj.left || 0,
      y: obj.top || 0,
      width: obj.type === 'textbox' ? obj.width : obj.getScaledWidth(),
      height: obj.type === 'textbox' ? obj.height : obj.getScaledHeight(),
      content: obj.type === 'textbox' ? obj.text : undefined,
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      fontWeight: obj.fontWeight,
      color: obj.fill,
      imageUrl: obj.type === 'image' ? obj.getSrc() : undefined,
    }));

    return {
      header_layout_type: mode === 'visual' ? 'structured' : 'html',
      header_text_elements: mode === 'visual' ? headerElements : [],
      letterhead_html: htmlCode,
      letterhead_css: cssCode,
    };
  };

  const handleSave = () => {
    const headerData = exportData();
    if (headerData) {
      onSave(headerData);
    }
  };

  const handleUndo = () => {
    // Fabric.js doesn't have built-in undo/redo, would need to implement history
    toast({ title: "Info", description: "Rückgängig-Funktion in Entwicklung" });
  };

  const handleRedo = () => {
    toast({ title: "Info", description: "Wiederholen-Funktion in Entwicklung" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Erweiterte Header Editor</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Speichern
          </Button>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as 'visual' | 'code')}>
        <TabsList>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Eye size={16} />
            Visueller Editor
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code size={16} />
            HTML/CSS Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          <div className="flex gap-4">
            {/* Toolbar */}
            <Card className="w-80">
              <CardHeader>
                <CardTitle className="text-sm">Werkzeuge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Elements */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Elemente hinzufügen</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <ImageIcon size={14} />
                      Bild
                    </Button>
                    <Button 
                      onClick={addText}
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Type size={14} />
                      Text
                    </Button>
                    <Button 
                      onClick={addRectangle}
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Square size={14} />
                      Rechteck
                    </Button>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                <Separator />

                {/* Canvas Controls */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Canvas</Label>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGrid(!showGrid)}
                      className={showGrid ? 'bg-blue-50' : ''}
                    >
                      <Grid size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                    >
                      <ZoomOut size={14} />
                    </Button>
                    <span className="text-xs">{Math.round(zoom * 100)}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                    >
                      <ZoomIn size={14} />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleUndo}>
                      <Undo size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRedo}>
                      <Redo size={14} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={deleteSelected} disabled={!selectedObject}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Object Properties */}
                {selectedObject && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Eigenschaften</Label>
                    
                    {selectedObject.type === 'textbox' && (
                      <>
                        <div>
                          <Label htmlFor="fontSize" className="text-xs">Schriftgröße</Label>
                          <Slider
                            value={[fontSize]}
                            onValueChange={([value]) => {
                              setFontSize(value);
                              updateSelectedObject('fontSize', value);
                            }}
                            max={72}
                            min={8}
                            step={1}
                            className="mt-2"
                          />
                          <span className="text-xs text-muted-foreground">{fontSize}px</span>
                        </div>

                        <div>
                          <Label htmlFor="fontFamily" className="text-xs">Schriftart</Label>
                          <Select value={fontFamily} onValueChange={(value) => {
                            setFontFamily(value);
                            updateSelectedObject('fontFamily', value);
                          }}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Helvetica">Helvetica</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Georgia">Georgia</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="fontWeight" className="text-xs">Schriftstärke</Label>
                          <Select value={fontWeight} onValueChange={(value) => {
                            setFontWeight(value);
                            updateSelectedObject('fontWeight', value);
                          }}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="bold">Fett</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="textColor" className="text-xs">Textfarbe</Label>
                          <Input
                            type="color"
                            value={textColor}
                            onChange={(e) => {
                              setTextColor(e.target.value);
                              updateSelectedObject('fill', e.target.value);
                            }}
                            className="h-8 w-full"
                          />
                        </div>
                      </>
                    )}

                    {selectedObject.type !== 'textbox' && (
                      <div>
                        <Label htmlFor="backgroundColor" className="text-xs">Füllfarbe</Label>
                        <Input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => {
                            setBackgroundColor(e.target.value);
                            updateSelectedObject('fill', e.target.value);
                          }}
                          className="h-8 w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Canvas */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-sm">Header Vorschau (DIN A4 - {Math.round(zoom * 100)}%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border bg-white overflow-auto" style={{ maxHeight: '500px' }}>
                  <canvas ref={canvasRef} className="border" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">HTML Code</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  className="w-full h-64 p-3 border rounded font-mono text-sm"
                  placeholder="HTML für den Header eingeben..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CSS Code</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={cssCode}
                  onChange={(e) => setCssCode(e.target.value)}
                  className="w-full h-64 p-3 border rounded font-mono text-sm"
                  placeholder="CSS Styling eingeben..."
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border bg-white p-4"
                style={{ width: '595px', height: '200px', overflow: 'hidden' }}
              >
                <div dangerouslySetInnerHTML={{ __html: htmlCode }} />
                <style>{cssCode}</style>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};