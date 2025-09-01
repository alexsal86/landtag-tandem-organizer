import React, { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, X, Move, Type, Image as ImageIcon, Eye, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface HeaderElement {
  id: string;
  type: 'image' | 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  imageUrl?: string;
}

interface LetterHeaderEditorProps {
  template: any;
  onSave: (headerData: any) => void;
  onCancel: () => void;
}

export const LetterHeaderEditor: React.FC<LetterHeaderEditorProps> = ({
  template,
  onSave,
  onCancel
}) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [headerElements, setHeaderElements] = useState<HeaderElement[]>(() => {
    if (template?.header_text_elements) {
      return template.header_text_elements;
    }
    return [];
  });
  
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [htmlCode, setHtmlCode] = useState(template?.letterhead_html || '');
  const [cssCode, setCssCode] = useState(template?.letterhead_css || '');

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
    if (!file) return;

    const imageUrl = await uploadImage(file);
    if (!imageUrl) return;

    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'image',
      x: 50,
      y: 50,
      width: 200,
      height: 100,
      imageUrl
    };

    setHeaderElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const addTextElement = () => {
    const newElement: HeaderElement = {
      id: Date.now().toString(),
      type: 'text',
      x: 50,
      y: 50,
      content: 'Text eingeben',
      fontSize: 16,
      fontWeight: 'normal',
      color: '#000000'
    };

    setHeaderElements(prev => [...prev, newElement]);
    setSelectedElement(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<HeaderElement>) => {
    setHeaderElements(prev => prev.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  };

  const removeElement = (id: string) => {
    setHeaderElements(prev => prev.filter(el => el.id !== id));
    setSelectedElement(null);
  };

  const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
    setSelectedElement(elementId);
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedElement || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    updateElement(selectedElement, { x, y });
  }, [isDragging, selectedElement]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    const headerData = {
      header_layout_type: mode === 'visual' ? 'structured' : 'html',
      header_text_elements: mode === 'visual' ? headerElements : [],
      letterhead_html: htmlCode,
      letterhead_css: cssCode
    };
    
    onSave(headerData);
  };

  const selectedElementData = headerElements.find(el => el.id === selectedElement);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Header Editor</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as 'visual' | 'code')}>
        <TabsList>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Eye size={16} />
            Visuell
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code size={16} />
            HTML/CSS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          <div className="flex gap-4">
            {/* Toolbar */}
            <Card className="w-64">
              <CardHeader>
                <CardTitle className="text-sm">Elemente hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline" 
                  className="w-full flex items-center gap-2"
                >
                  <ImageIcon size={16} />
                  Bild hinzufügen
                </Button>
                <Button 
                  onClick={addTextElement}
                  variant="outline" 
                  className="w-full flex items-center gap-2"
                >
                  <Type size={16} />
                  Text hinzufügen
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {selectedElementData && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="font-medium">Element bearbeiten</h4>
                    
                    {selectedElementData.type === 'text' && (
                      <>
                        <div>
                          <Label htmlFor="content">Text</Label>
                          <Input
                            id="content"
                            value={selectedElementData.content || ''}
                            onChange={(e) => updateElement(selectedElement!, { content: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="fontSize">Schriftgröße</Label>
                          <Input
                            id="fontSize"
                            type="number"
                            value={selectedElementData.fontSize || 16}
                            onChange={(e) => updateElement(selectedElement!, { fontSize: parseInt(e.target.value) })}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="fontWeight">Schriftstärke</Label>
                          <Select
                            value={selectedElementData.fontWeight || 'normal'}
                            onValueChange={(value) => updateElement(selectedElement!, { fontWeight: value })}
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
                          <Label htmlFor="color">Farbe</Label>
                          <Input
                            id="color"
                            type="color"
                            value={selectedElementData.color || '#000000'}
                            onChange={(e) => updateElement(selectedElement!, { color: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {selectedElementData.type === 'image' && (
                      <>
                        <div>
                          <Label htmlFor="width">Breite</Label>
                          <Input
                            id="width"
                            type="number"
                            value={selectedElementData.width || 200}
                            onChange={(e) => updateElement(selectedElement!, { width: parseInt(e.target.value) })}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="height">Höhe</Label>
                          <Input
                            id="height"
                            type="number"
                            value={selectedElementData.height || 100}
                            onChange={(e) => updateElement(selectedElement!, { height: parseInt(e.target.value) })}
                          />
                        </div>
                      </>
                    )}

                    <Button 
                      onClick={() => removeElement(selectedElement!)}
                      variant="destructive"
                      size="sm"
                      className="w-full"
                    >
                      <X size={16} className="mr-2" />
                      Element löschen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Canvas */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="text-sm">Header Vorschau (DIN A4)</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="relative border bg-white"
                  style={{ width: '595px', height: '200px' }}
                >
                  <canvas
                    ref={canvasRef}
                    width={595}
                    height={200}
                    className="absolute inset-0 cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  />
                  
                  {headerElements.map((element) => (
                    <div
                      key={element.id}
                      className={`absolute border cursor-move ${
                        selectedElement === element.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                      }`}
                      style={{
                        left: element.x,
                        top: element.y,
                        width: element.width,
                        height: element.height || 'auto'
                      }}
                      onMouseDown={(e) => handleMouseDown(e, element.id)}
                    >
                      {element.type === 'image' && element.imageUrl && (
                        <img 
                          src={element.imageUrl} 
                          alt="Header" 
                          className="w-full h-full object-contain"
                        />
                      )}
                      
                      {element.type === 'text' && (
                        <div 
                          className="p-1 select-none"
                          style={{
                            fontSize: element.fontSize,
                            fontWeight: element.fontWeight,
                            color: element.color
                          }}
                        >
                          {element.content}
                        </div>
                      )}
                      
                      {selectedElement === element.id && (
                        <Badge className="absolute -top-6 -left-1 text-xs">
                          <Move size={12} className="mr-1" />
                          {element.type}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">HTML</CardTitle>
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
                <CardTitle className="text-sm">CSS</CardTitle>
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
              <CardTitle className="text-sm">HTML Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border bg-white p-4"
                style={{ width: '595px', height: '200px', overflow: 'hidden' }}
              >
                <div 
                  dangerouslySetInnerHTML={{ __html: htmlCode }}
                  style={{ style: cssCode } as any}
                />
                <style>{cssCode}</style>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};