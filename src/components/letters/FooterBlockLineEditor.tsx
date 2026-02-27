import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { BlockLineEditor } from '@/components/letters/BlockLineEditor';
import { FooterLineBlock, resolveBlockWidthMm } from '@/components/letters/footerBlockUtils';

interface FooterBlockLineEditorProps {
  blocks: FooterLineBlock[];
  onChange: (blocks: FooterLineBlock[]) => void;
  availableWidthMm: number;
}

let nextFooterId = 1;
const createFooterBlock = (): FooterLineBlock => ({
  id: `footer-${Date.now()}-${nextFooterId++}`,
  title: '',
  widthUnit: 'percent',
  widthValue: 25,
  lines: [],
});

export const FooterBlockLineEditor: React.FC<FooterBlockLineEditorProps> = ({ blocks, onChange, availableWidthMm }) => {
  const totalWidthMm = blocks.reduce((sum, block) => sum + resolveBlockWidthMm(block, availableWidthMm), 0);

  const updateBlock = (id: string, updates: Partial<FooterLineBlock>) => {
    onChange(blocks.map((block) => (block.id === id ? { ...block, ...updates } : block)));
  };

  const removeBlock = (id: string) => onChange(blocks.filter((block) => block.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Footer-Blöcke</h4>
          <p className="text-xs text-muted-foreground">
            Breiten-Summe: {totalWidthMm.toFixed(1)}mm / {availableWidthMm}mm
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...blocks, createFooterBlock()])}>
          <Plus className="h-3 w-3 mr-1" /> Block hinzufügen
        </Button>
      </div>

      {blocks.map((block, index) => (
        <Card key={block.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Block {index + 1}</span>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => removeBlock(block.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Titel (optional)</Label>
                <Input
                  value={block.title || ''}
                  onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                  placeholder="z.B. Für Sie in Karlsruhe"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Breiteneinheit</Label>
                <Select value={block.widthUnit} onValueChange={(value: 'percent' | 'cm') => updateBlock(block.id, { widthUnit: value })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Prozent</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Breite ({block.widthUnit === 'cm' ? 'cm' : '%'})</Label>
                <Input
                  type="number"
                  step={block.widthUnit === 'cm' ? '0.1' : '1'}
                  min="1"
                  value={block.widthValue}
                  onChange={(e) => updateBlock(block.id, { widthValue: Math.max(1, parseFloat(e.target.value) || 1) })}
                  className="h-8"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Effektiv: {resolveBlockWidthMm(block, availableWidthMm).toFixed(1)}mm
                </p>
              </div>
            </div>

            <BlockLineEditor
              blockType="footer"
              lines={block.lines}
              onChange={(lines) => updateBlock(block.id, { lines })}
            />
          </CardContent>
        </Card>
      ))}

      {blocks.length === 0 && (
        <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
          Noch keine Footer-Blöcke angelegt.
        </div>
      )}
    </div>
  );
};
