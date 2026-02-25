import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Type, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface FooterBlock {
  id: string;
  type: 'landtag_address' | 'wahlkreis_address' | 'communication' | 'general' | 'custom';
  title: string;
  content: string;
  order: number;
  widthPercent: number; // Width as percentage of available footer space (165mm)
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  lineHeight?: number; // Line height multiplier (default: 1)
  titleHighlight?: boolean; // Whether to highlight the title
  titleFontSize?: number; // Font size for highlighted title (default: 13)
  titleFontWeight?: string; // Font weight for highlighted title (default: bold)
  titleColor?: string; // Color for highlighted title (default: RGB 16,112,48)
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

interface StructuredFooterEditorProps {
  initialBlocks?: FooterBlock[];
  onBlocksChange: (blocks: FooterBlock[]) => void;
  footerHeight?: number;
}

export const StructuredFooterEditor: React.FC<StructuredFooterEditorProps> = ({
  initialBlocks = [],
  onBlocksChange,
  footerHeight = 18
}) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const [blocks, setBlocks] = useState<FooterBlock[]>(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [senderInfo, setSenderInfo] = useState<SenderInfo | null>(null);
  const [showRuler, setShowRuler] = useState(false);

  const footerAvailableWidth = 165; // 210mm - 25mm left - 20mm right

  useEffect(() => {
    if (currentTenant) {
      fetchSenderInfo();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (senderInfo && blocks.length === 0) {
      initializeDefaultBlocks();
    }
  }, [senderInfo]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onBlocksChange(blocks);
  }, [blocks]);

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

  const initializeDefaultBlocks = () => {
    if (!senderInfo) return;

    const defaultBlocks: FooterBlock[] = [
      {
        id: 'landtag',
        type: 'landtag_address',
        title: 'Landtagsadresse',
        content: generateLandtagAddress(),
        order: 0,
        widthPercent: 25,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        lineHeight: 0.8,
        titleHighlight: false,
        titleFontSize: 13,
        titleFontWeight: 'bold',
        titleColor: '#107030'
      },
      {
        id: 'wahlkreis',
        type: 'wahlkreis_address',
        title: 'Wahlkreisadresse',
        content: generateWahlkreisAddress(),
        order: 1,
        widthPercent: 25,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        lineHeight: 0.8,
        titleHighlight: false,
        titleFontSize: 13,
        titleFontWeight: 'bold',
        titleColor: '#107030'
      },
      {
        id: 'communication',
        type: 'communication',
        title: 'Kommunikation',
        content: generateCommunication(),
        order: 2,
        widthPercent: 25,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        lineHeight: 0.8,
        titleHighlight: false,
        titleFontSize: 13,
        titleFontWeight: 'bold',
        titleColor: '#107030'
      },
      {
        id: 'general',
        type: 'general',
        title: 'Allgemein',
        content: generateGeneral(),
        order: 3,
        widthPercent: 25,
        fontSize: 10,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        color: '#000000',
        lineHeight: 0.8,
        titleHighlight: false,
        titleFontSize: 13,
        titleFontWeight: 'bold',
        titleColor: '#107030'
      }
    ];

    setBlocks(defaultBlocks);
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

  const addCustomBlock = () => {
    const newBlock: FooterBlock = {
      id: Date.now().toString(),
      type: 'custom',
      title: 'Neuer Block',
      content: 'Neuer Inhalt',
      order: blocks.length,
      widthPercent: 20,
      fontSize: 10,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      color: '#000000',
      lineHeight: 0.8,
      titleHighlight: false,
      titleFontSize: 13,
      titleFontWeight: 'bold',
      titleColor: '#107030'
    };
    setBlocks([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (id: string, updates: Partial<FooterBlock>) => {
    setBlocks(blocks.map(block => block.id === id ? { ...block, ...updates } : block));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(block => block.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  const moveBlockUp = (id: string) => {
    const blockIndex = blocks.findIndex(b => b.id === id);
    if (blockIndex > 0) {
      const newBlocks = [...blocks];
      [newBlocks[blockIndex - 1], newBlocks[blockIndex]] = [newBlocks[blockIndex], newBlocks[blockIndex - 1]];
      
      // Update order values
      newBlocks.forEach((block, index) => {
        block.order = index;
      });
      
      setBlocks(newBlocks);
    }
  };

  const moveBlockDown = (id: string) => {
    const blockIndex = blocks.findIndex(b => b.id === id);
    if (blockIndex < blocks.length - 1) {
      const newBlocks = [...blocks];
      [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [newBlocks[blockIndex + 1], newBlocks[blockIndex]];
      
      // Update order values
      newBlocks.forEach((block, index) => {
        block.order = index;
      });
      
      setBlocks(newBlocks);
    }
  };

  const selectedBlock = blocks.find(block => block.id === selectedBlockId);
  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);

  const calculateActualWidth = (widthPercent: number) => {
    return (footerAvailableWidth * widthPercent) / 100;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6">
      {/* Block List & Controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blöcke hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={addCustomBlock} className="w-full justify-start">
              <Type className="h-4 w-4 mr-2" />
              Neuen Block hinzufügen
            </Button>
            <Button variant={showRuler ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setShowRuler(v => !v)}>
              Lineal {showRuler ? 'ausblenden' : 'einblenden'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Footer-Blöcke ({blocks.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              Verfügbare Breite: {footerAvailableWidth}mm
            </p>
          </CardHeader>
          <CardContent>
            {blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Blöcke vorhanden</p>
            ) : (
              <div className="space-y-2">
                {sortedBlocks.map((block, index) => (
                  <div
                    key={block.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedBlockId === block.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedBlockId(block.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: block.color }} />
                          <Type className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {block.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {block.widthPercent}% ({calculateActualWidth(block.widthPercent).toFixed(1)}mm)
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {block.content.split('\n')[0]}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlockUp(block.id);
                          }}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveBlockDown(block.id);
                          }}
                          disabled={index === blocks.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        {block.type === 'custom' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBlock(block.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Properties Panel (legacy, replaced by inline editor) */}
      <div className="hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedBlock ? 'Block-Eigenschaften' : 'Block auswählen'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedBlock ? (
              <div className="space-y-4">
                {/* Block Title */}
                <div>
                  <Label>Block-Titel</Label>
                  <Input
                    value={selectedBlock.title}
                    onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })}
                    placeholder="Block-Titel..."
                  />
                </div>

                {/* Content */}
                <div>
                  <Label>Inhalt</Label>
                  <Textarea
                    value={selectedBlock.content}
                    onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                    placeholder="Block-Inhalt..."
                    rows={4}
                  />
                </div>

                <Separator />

                {/* Width */}
                <div>
                  <Label>Breite (%)</Label>
                  <Input
                    type="number"
                    value={selectedBlock.widthPercent}
                    onChange={(e) => updateBlock(selectedBlock.id, { widthPercent: Math.max(1, Math.min(100, parseInt(e.target.value) || 20)) })}
                    min={1}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    = {calculateActualWidth(selectedBlock.widthPercent).toFixed(1)}mm von {footerAvailableWidth}mm
                  </p>
                </div>

                <Separator />

                {/* Title Highlighting */}
                <div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`highlight-${selectedBlock.id}`}
                      checked={selectedBlock.titleHighlight || false}
                      onCheckedChange={(checked) => {
                        updateBlock(selectedBlock.id, { 
                          titleHighlight: checked as boolean,
                          // Set default values when enabling highlighting
                          titleFontSize: checked ? (selectedBlock.titleFontSize || 13) : selectedBlock.titleFontSize,
                          titleFontWeight: checked ? (selectedBlock.titleFontWeight || 'bold') : selectedBlock.titleFontWeight,
                          titleColor: checked ? (selectedBlock.titleColor || '#107030') : selectedBlock.titleColor
                        });
                      }}
                    />
                    <Label htmlFor={`highlight-${selectedBlock.id}`}>Titel hervorheben</Label>
                  </div>
                </div>

                {/* Title styling options - only show when highlighting is enabled */}
                {selectedBlock.titleHighlight && (
                  <div className="space-y-4 border-l-4 border-primary/20 pl-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Titel-Schriftgröße</Label>
                        <Input
                          type="number"
                          value={selectedBlock.titleFontSize || 13}
                          onChange={(e) => updateBlock(selectedBlock.id, { titleFontSize: parseInt(e.target.value) || 13 })}
                          min={8}
                          max={24}
                        />
                      </div>
                      <div>
                        <Label>Titel-Schriftstärke</Label>
                        <Select
                          value={selectedBlock.titleFontWeight || 'bold'}
                          onValueChange={(value) => updateBlock(selectedBlock.id, { titleFontWeight: value })}
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
                    </div>
                    <div>
                      <Label>Titel-Textfarbe</Label>
                      <Input
                        type="color"
                        value={selectedBlock.titleColor || '#107030'}
                        onChange={(e) => updateBlock(selectedBlock.id, { titleColor: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Typography */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Schriftgröße</Label>
                    <Input
                      type="number"
                      value={selectedBlock.fontSize}
                      onChange={(e) => updateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value) || 10 })}
                      min={6}
                      max={24}
                    />
                  </div>
                  <div>
                    <Label>Schriftart</Label>
                    <Select
                      value={selectedBlock.fontFamily}
                      onValueChange={(value) => updateBlock(selectedBlock.id, { fontFamily: value })}
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
                      value={selectedBlock.fontWeight}
                      onValueChange={(value) => updateBlock(selectedBlock.id, { fontWeight: value })}
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
                      value={selectedBlock.color}
                      onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                {/* Line Height */}
                <div>
                  <Label>Zeilenabstand</Label>
                  <Select
                    value={selectedBlock.lineHeight?.toString() || '1'}
                    onValueChange={(value) => updateBlock(selectedBlock.id, { lineHeight: parseFloat(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.8">Eng (0.8)</SelectItem>
                      <SelectItem value="1">Normal (1.0)</SelectItem>
                      <SelectItem value="1.2">Weit (1.2)</SelectItem>
                      <SelectItem value="1.5">Sehr weit (1.5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Wählen Sie einen Block aus der Liste aus, um seine Eigenschaften zu bearbeiten.
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
              Footer ({footerAvailableWidth}mm × {footerHeight}mm)
            </p>
          </CardHeader>
          <CardContent>
            <div className="relative pl-8 pt-8">
              {(() => {
                const canvasWidth = 330;
                const canvasHeight = canvasWidth / footerAvailableWidth * footerHeight;
                return (
                  <>
              {showRuler && (
                <>
                  <div className="absolute top-0 left-8 h-7 border rounded bg-muted/40 text-[10px] text-muted-foreground pointer-events-none" style={{ width: `${canvasWidth}px` }}>
                    {Array.from({ length: Math.floor(footerAvailableWidth / 10) + 1 }).map((_, i) => (
                      <span key={`fx-${i}`} className="absolute" style={{ left: `${(i * canvasWidth) / (footerAvailableWidth / 10)}px` }}>{i * 10}</span>
                    ))}
                  </div>
                  <div className="absolute top-8 left-0 w-7 border rounded bg-muted/40 text-[10px] text-muted-foreground pointer-events-none" style={{ height: `${canvasHeight}px` }}>
                    {Array.from({ length: Math.floor(footerHeight / 10) + 1 }).map((_, i) => {
                      return <span key={`fy-${i}`} className="absolute" style={{ top: `${(i * canvasHeight) / (footerHeight / 10)}px` }}>{i * 10}</span>;
                    })}
                  </div>
                </>
              )}
            {(() => {
              const canvasScaleY = canvasHeight;
              const scaleX = canvasWidth / footerAvailableWidth;
              const scaleY = canvasScaleY / footerHeight;
              return (
                <div 
                  className="border border-gray-300 bg-white relative overflow-hidden"
                  style={{
                    width: `${canvasWidth}px`,
                    height: `${canvasScaleY}px`,
                    backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
                    backgroundSize: '8px 8px'
                  }}
                >
                  {sortedBlocks.map((block, index) => {
                    let leftPosition = 0;
                    for (let i = 0; i < index; i++) {
                      leftPosition += (sortedBlocks[i].widthPercent / 100) * canvasWidth;
                    }
                    const blockWidth = (block.widthPercent / 100) * canvasWidth;
                    
                    return (
                      <div
                        key={block.id}
                        className={`absolute cursor-pointer border border-transparent p-1 ${
                          selectedBlockId === block.id ? 'border-primary border-dashed bg-primary/5' : ''
                        }`}
                        style={{
                          left: `${leftPosition}px`,
                          top: '0px',
                          width: `${blockWidth}px`,
                          height: `${canvasScaleY}px`,
                          fontSize: `${block.fontSize * Math.min(scaleX, scaleY) * 0.8}px`,
                          fontFamily: block.fontFamily,
                          fontWeight: block.fontWeight,
                          color: block.color,
                          lineHeight: '1.2',
                          whiteSpace: 'pre-line',
                          overflow: 'hidden'
                        }}
                        onClick={() => setSelectedBlockId(block.id)}
                      >
                        <div className="text-xs font-semibold mb-1 opacity-60">
                          {block.title}
                        </div>
                        <div className="text-overflow-ellipsis">
                          {block.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
