import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useToast } from '@/hooks/use-toast';
import { Canvas as FabricCanvas, Textbox } from 'fabric';
import { Plus, Type, Move, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface FooterBlock {
  id: string;
  type: 'landtag_address' | 'wahlkreis_address' | 'communication' | 'general';
  title: string;
  content: string;
  order: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  isEditable: boolean;
}

interface SenderInfo {
  name: string;
  organization: string;
  phone?: string;
  fax?: string;
  website?: string;
  instagram_profile?: string;
  facebook_profile?: string;
  landtag_street?: string;
  landtag_house_number?: string;
  landtag_postal_code?: string;
  landtag_city?: string;
  landtag_email?: string;
  wahlkreis_street?: string;
  wahlkreis_house_number?: string;
  wahlkreis_postal_code?: string;
  wahlkreis_city?: string;
  wahlkreis_email?: string;
}

interface FabricFooterEditorProps {
  template: any;
  onSave: (footerData: any) => void;
  onCancel: () => void;
}

export const FabricFooterEditor: React.FC<FabricFooterEditorProps> = ({
  template,
  onSave,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [footerBlocks, setFooterBlocks] = useState<FooterBlock[]>([]);
  const [senderInfo, setSenderInfo] = useState<SenderInfo | null>(null);
  const [footerHtml, setFooterHtml] = useState('');
  const [footerCss, setFooterCss] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<FooterBlock | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const { currentTenant } = useTenant();
  const { toast } = useToast();

  useEffect(() => {
    if (currentTenant) {
      fetchSenderInfo();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 800,
        height: 200,
        backgroundColor: '#ffffff',
      });

      setFabricCanvas(canvas);

      canvas.on('selection:created', (e) => {
        const activeObject = e.selected[0];
        if (activeObject && (activeObject as any).blockId) {
          const block = footerBlocks.find(b => b.id === (activeObject as any).blockId);
          if (block) {
            setSelectedBlock(block);
            setEditingContent(block.content);
          }
        }
      });

      canvas.on('selection:cleared', () => {
        setSelectedBlock(null);
        setEditingContent('');
      });

      return () => {
        canvas.dispose();
      };
    }
  }, [canvasRef.current]);

  useEffect(() => {
    if (senderInfo) {
      initializeFooterBlocks();
    }
  }, [senderInfo]);

  useEffect(() => {
    if (fabricCanvas && footerBlocks.length > 0) {
      renderFooterBlocks();
    }
  }, [fabricCanvas, footerBlocks]);

  const fetchSenderInfo = async () => {
    if (!currentTenant) return;

    try {
      const { data, error } = await supabase
        .from('sender_information')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) setSenderInfo(data);
    } catch (error) {
      console.error('Error fetching sender info:', error);
    }
  };

  const initializeFooterBlocks = () => {
    if (!senderInfo) return;

    const blocks: FooterBlock[] = [
      {
        id: 'landtag',
        type: 'landtag_address',
        title: 'Landtagsadresse',
        content: generateLandtagAddress(),
        order: 0,
        x: 0,
        y: 0,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        isEditable: true
      },
      {
        id: 'wahlkreis',
        type: 'wahlkreis_address',
        title: 'Wahlkreisadresse',
        content: generateWahlkreisAddress(),
        order: 1,
        x: 200,
        y: 0,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        isEditable: true
      },
      {
        id: 'communication',
        type: 'communication',
        title: 'Kommunikation',
        content: generateCommunication(),
        order: 2,
        x: 400,
        y: 0,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        isEditable: true
      },
      {
        id: 'general',
        type: 'general',
        title: 'Allgemein',
        content: generateGeneral(),
        order: 3,
        x: 600,
        y: 0,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        isEditable: true
      }
    ];

    setFooterBlocks(blocks);
  };

  const generateLandtagAddress = (): string => {
    if (!senderInfo) return '';
    const parts = [];
    if (senderInfo.landtag_street && senderInfo.landtag_house_number) {
      parts.push(`${senderInfo.landtag_street} ${senderInfo.landtag_house_number}`);
    }
    if (senderInfo.landtag_postal_code && senderInfo.landtag_city) {
      parts.push(`${senderInfo.landtag_postal_code} ${senderInfo.landtag_city}`);
    }
    if (senderInfo.landtag_email) {
      parts.push(senderInfo.landtag_email.replace('@', '@\n'));
    }
    return parts.join('\n');
  };

  const generateWahlkreisAddress = (): string => {
    if (!senderInfo) return '';
    const parts = [];
    if (senderInfo.wahlkreis_street && senderInfo.wahlkreis_house_number) {
      parts.push(`${senderInfo.wahlkreis_street} ${senderInfo.wahlkreis_house_number}`);
    }
    if (senderInfo.wahlkreis_postal_code && senderInfo.wahlkreis_city) {
      parts.push(`${senderInfo.wahlkreis_postal_code} ${senderInfo.wahlkreis_city}`);
    }
    if (senderInfo.wahlkreis_email) {
      parts.push(senderInfo.wahlkreis_email.replace('@', '@\n'));
    }
    return parts.join('\n');
  };

  const generateCommunication = (): string => {
    if (!senderInfo) return '';
    const parts = [];
    // Remove "Tel: " prefix from phone numbers
    if (senderInfo.phone) parts.push(senderInfo.phone);
    if (senderInfo.fax) parts.push(`Fax: ${senderInfo.fax}`);
    // Remove "https://www." from website but keep it clickable
    if (senderInfo.website) {
      const cleanWebsite = senderInfo.website.replace(/^https?:\/\/(www\.)?/, '');
      parts.push(cleanWebsite);
    }
    // Use simple @ symbol for Instagram
    if (senderInfo.instagram_profile) parts.push(`@ ${senderInfo.instagram_profile}`);
    // Use simple @ symbol for Facebook
    if (senderInfo.facebook_profile) parts.push(`@ ${senderInfo.facebook_profile}`);
    return parts.join('\n');
  };

  const generateGeneral = (): string => {
    if (!senderInfo) return '';
    const parts = [];
    if (senderInfo.name) parts.push(senderInfo.name);
    if (senderInfo.organization) parts.push(senderInfo.organization);
    return parts.join('\n');
  };

  const renderFooterBlocks = () => {
    if (!fabricCanvas) return;

    fabricCanvas.clear();

    footerBlocks.forEach((block) => {
      const textbox = new Textbox(block.content, {
        left: block.x || 0,
        top: block.y || 0,
        width: block.width || 150,
        height: block.height || 80,
        fontSize: block.fontSize || 10,
        fontFamily: block.fontFamily || 'Arial',
        fontWeight: block.fontWeight || 'normal',
        fill: block.color || '#000000'
      }) as any;

      textbox.blockId = block.id;
      fabricCanvas.add(textbox);
    });

    fabricCanvas.renderAll();
  };

  const updateBlockContent = () => {
    if (!selectedBlock) return;

    const updatedBlocks = footerBlocks.map(block =>
      block.id === selectedBlock.id
        ? { ...block, content: editingContent }
        : block
    );

    setFooterBlocks(updatedBlocks);

    // Update canvas object
    if (fabricCanvas) {
      const activeObject = fabricCanvas.getActiveObject() as any;
      if (activeObject && activeObject.blockId === selectedBlock.id) {
        activeObject.set('text', editingContent);
        fabricCanvas.renderAll();
      }
    }
  };

  const moveBlockUp = (blockId: string) => {
    const blockIndex = footerBlocks.findIndex(b => b.id === blockId);
    if (blockIndex > 0) {
      const newBlocks = [...footerBlocks];
      [newBlocks[blockIndex - 1], newBlocks[blockIndex]] = [newBlocks[blockIndex], newBlocks[blockIndex - 1]];
      
      // Update order values
      newBlocks.forEach((block, index) => {
        block.order = index;
      });
      
      setFooterBlocks(newBlocks);
    }
  };

  const moveBlockDown = (blockId: string) => {
    const blockIndex = footerBlocks.findIndex(b => b.id === blockId);
    if (blockIndex < footerBlocks.length - 1) {
      const newBlocks = [...footerBlocks];
      [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [newBlocks[blockIndex + 1], newBlocks[blockIndex]];
      
      // Update order values
      newBlocks.forEach((block, index) => {
        block.order = index;
      });
      
      setFooterBlocks(newBlocks);
    }
  };

  const generateFooterHtml = () => {
    const sortedBlocks = [...footerBlocks].sort((a, b) => a.order - b.order);
    const html = `
      <div class="letter-footer">
        ${sortedBlocks.map(block => `
          <div class="footer-block footer-${block.type}" style="
            position: absolute;
            left: ${block.x || 0}px;
            top: ${block.y || 0}px;
            font-size: ${block.fontSize || 10}px;
            font-family: ${block.fontFamily || 'Arial'};
            font-weight: ${block.fontWeight || 'normal'};
            color: ${block.color || '#000000'};
          ">
            ${block.content.replace(/\n/g, '<br/>')}
          </div>
        `).join('')}
      </div>
    `;
    return html;
  };

  const generateFooterCss = () => {
    return `
      .letter-footer {
        position: relative;
        width: 100%;
        height: 200px;
        border-top: 1px solid #ccc;
        padding-top: 10px;
      }
      
      .footer-block {
        white-space: pre-line;
      }
    `;
  };

  const handleSave = () => {
    const html = generateFooterHtml();
    const css = generateFooterCss();
    
    onSave({
      footer_html: html,
      footer_css: css,
      footer_blocks: footerBlocks
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Footer-Designer</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </div>
      </div>

      <Tabs defaultValue="visual" className="w-full">
        <TabsList>
          <TabsTrigger value="visual">Visuell</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Footer Blocks List */}
            <Card>
              <CardHeader>
                <CardTitle>Footer-Blöcke</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {footerBlocks.map((block, index) => (
                  <div key={block.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <Badge variant="outline" className="text-xs">
                        {block.title}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {block.content.split('\n')[0]}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveBlockUp(block.id)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveBlockDown(block.id)}
                        disabled={index === footerBlocks.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Canvas */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Footer-Vorschau</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded p-4 bg-white">
                  <canvas ref={canvasRef} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Block Editor */}
          {selectedBlock && (
            <Card>
              <CardHeader>
                <CardTitle>Block bearbeiten: {selectedBlock.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="block-content">Inhalt</Label>
                  <Textarea
                    id="block-content"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={4}
                  />
                  <Button 
                    onClick={updateBlockContent}
                    className="mt-2"
                    size="sm"
                  >
                    Inhalt aktualisieren
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Footer HTML</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={footerHtml}
                  onChange={(e) => setFooterHtml(e.target.value)}
                  rows={10}
                  className="font-mono"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Footer CSS</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={footerCss}
                  onChange={(e) => setFooterCss(e.target.value)}
                  rows={10}
                  className="font-mono"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vorschau</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded p-4 bg-white">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: `<style>${footerCss}</style>${footerHtml}` 
                  }} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};