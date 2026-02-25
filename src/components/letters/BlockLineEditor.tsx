import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, Trash2, Space, Zap, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface BlockLine {
  id: string;
  type: 'label-value' | 'spacer' | 'text-only';
  label?: string;
  value?: string;
  isVariable?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  fontSize?: number;
  spacerHeight?: number;
}

export interface BlockLineData {
  mode: 'lines';
  lines: BlockLine[];
}

/** Check whether stored data is line-mode or legacy canvas */
export function isLineMode(data: any): data is BlockLineData {
  return data && typeof data === 'object' && data.mode === 'lines' && Array.isArray(data.lines);
}

interface AvailableVariable {
  key: string;
  label: string;
  preview: string;
}

const INFO_BLOCK_VARIABLES: AvailableVariable[] = [
  { key: '{{bearbeiter}}', label: 'Bearbeiter', preview: 'Max Mustermann' },
  { key: '{{telefon}}', label: 'Telefon', preview: '040 1234-5678' },
  { key: '{{email}}', label: 'E-Mail', preview: 'max@beispiel.de' },
  { key: '{{datum}}', label: 'Datum', preview: '25. Februar 2026' },
  { key: '{{aktenzeichen}}', label: 'Aktenzeichen', preview: 'AZ-2026-001' },
  { key: '{{unser_zeichen}}', label: 'Unser Zeichen', preview: 'MM/abc' },
];

const ADDRESS_FIELD_VARIABLES: AvailableVariable[] = [
  { key: '{{empfaenger_name}}', label: 'Empfänger Name', preview: 'Erika Mustermann' },
  { key: '{{empfaenger_strasse}}', label: 'Straße', preview: 'Musterstraße 1' },
  { key: '{{empfaenger_plz}}', label: 'PLZ', preview: '20095' },
  { key: '{{empfaenger_ort}}', label: 'Ort', preview: 'Hamburg' },
  { key: '{{empfaenger_land}}', label: 'Land', preview: 'Deutschland' },
];

const DIN5008_INFO_BLOCK_TEMPLATE: BlockLine[] = [
  { id: 'din-1', type: 'label-value', label: 'Ihr Gesprächspartner:', value: '{{bearbeiter}}', isVariable: true, labelBold: true },
  { id: 'din-2', type: 'label-value', label: 'Abteilung:', value: '', labelBold: true },
  { id: 'din-3', type: 'spacer', spacerHeight: 2 },
  { id: 'din-4', type: 'label-value', label: 'Telefon:', value: '{{telefon}}', isVariable: true, labelBold: true },
  { id: 'din-5', type: 'label-value', label: 'E-Mail:', value: '{{email}}', isVariable: true, labelBold: true },
  { id: 'din-6', type: 'spacer', spacerHeight: 2 },
  { id: 'din-7', type: 'label-value', label: 'Datum:', value: '{{datum}}', isVariable: true, labelBold: true },
  { id: 'din-8', type: 'label-value', label: 'Unser Zeichen:', value: '{{unser_zeichen}}', isVariable: true, labelBold: true },
];

const DIN5008_ADDRESS_TEMPLATE: BlockLine[] = [
  { id: 'addr-1', type: 'text-only', value: '{{empfaenger_name}}', isVariable: true },
  { id: 'addr-2', type: 'text-only', value: '{{empfaenger_strasse}}', isVariable: true },
  { id: 'addr-3', type: 'text-only', value: '{{empfaenger_plz}} {{empfaenger_ort}}', isVariable: true },
  { id: 'addr-4', type: 'text-only', value: '{{empfaenger_land}}', isVariable: true },
];

interface BlockLineEditorProps {
  blockType: 'infoBlock' | 'addressField';
  lines: BlockLine[];
  onChange: (lines: BlockLine[]) => void;
}

let nextId = 1;
const genId = () => `bl-${Date.now()}-${nextId++}`;

export const BlockLineEditor: React.FC<BlockLineEditorProps> = ({ blockType, lines, onChange }) => {
  const variables = blockType === 'infoBlock' ? INFO_BLOCK_VARIABLES : ADDRESS_FIELD_VARIABLES;
  const din5008Template = blockType === 'infoBlock' ? DIN5008_INFO_BLOCK_TEMPLATE : DIN5008_ADDRESS_TEMPLATE;

  const addLine = (type: BlockLine['type']) => {
    const newLine: BlockLine = type === 'spacer'
      ? { id: genId(), type: 'spacer', spacerHeight: 2 }
      : type === 'text-only'
        ? { id: genId(), type: 'text-only', value: '' }
        : { id: genId(), type: 'label-value', label: '', value: '', labelBold: true };
    onChange([...lines, newLine]);
  };

  const updateLine = (id: string, updates: Partial<BlockLine>) => {
    onChange(lines.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const removeLine = (id: string) => {
    onChange(lines.filter(l => l.id !== id));
  };

  /** Insert variable at the end of the current value (supports multiple vars per line) */
  const insertVariable = (lineId: string, varKey: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    const currentValue = line.value || '';
    const newValue = currentValue ? `${currentValue} ${varKey}` : varKey;
    updateLine(lineId, { value: newValue, isVariable: true });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = [...lines];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  const loadTemplate = () => {
    onChange(din5008Template.map(l => ({ ...l, id: genId() })));
  };

  const getPreviewText = (line: BlockLine): string => {
    if (!line.value) return '';
    let text = line.value;
    const allVars = [...INFO_BLOCK_VARIABLES, ...ADDRESS_FIELD_VARIABLES];
    for (const v of allVars) {
      text = text.split(v.key).join(v.preview);
    }
    return text;
  };

  const hasVariable = (val: string | undefined) => val ? /\{\{.*?\}\}/.test(val) : false;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Zeilen</span>
          <Button variant="outline" size="sm" onClick={loadTemplate} className="h-7 text-xs">
            <FileText className="mr-1 h-3 w-3" />
            DIN 5008 Vorlage
          </Button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="block-lines">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                {lines.map((line, index) => (
                  <Draggable key={line.id} draggableId={line.id} index={index}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-center gap-1 rounded border px-1 py-1 text-xs ${snap.isDragging ? 'bg-accent shadow-md' : 'bg-background'}`}
                      >
                        <div {...prov.dragHandleProps} className="cursor-grab text-muted-foreground">
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>

                        {line.type === 'spacer' ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">Abstand</Badge>
                            <Input
                              type="number"
                              value={line.spacerHeight || 2}
                              onChange={(e) => updateLine(line.id, { spacerHeight: parseFloat(e.target.value) || 2 })}
                              className="h-6 w-16 text-xs"
                              min={1}
                              max={20}
                            />
                            <span className="text-muted-foreground">mm</span>
                          </div>
                        ) : line.type === 'text-only' ? (
                          <div className="flex flex-1 items-center gap-1">
                            <Badge variant="secondary" className="shrink-0 text-[10px]">Text</Badge>
                            <Input
                              value={line.value || ''}
                              onChange={(e) => updateLine(line.id, { value: e.target.value, isVariable: /\{\{.*?\}\}/.test(e.target.value) })}
                              className="h-6 flex-1 text-xs"
                              placeholder="Text oder {{variable}}..."
                            />
                            <Select onValueChange={(v) => insertVariable(line.id, v)}>
                              <SelectTrigger className="h-6 w-8 px-1">
                                <Zap className="h-3 w-3 text-amber-500" />
                              </SelectTrigger>
                              <SelectContent>
                                {variables.map((v) => (
                                  <SelectItem key={v.key} value={v.key} className="text-xs">{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          /* label-value */
                          <div className="flex flex-1 items-center gap-1">
                            <Input
                              value={line.label || ''}
                              onChange={(e) => updateLine(line.id, { label: e.target.value })}
                              className="h-6 w-28 shrink-0 text-xs font-semibold"
                              placeholder="Label..."
                            />
                            <Input
                              value={line.value || ''}
                              onChange={(e) => updateLine(line.id, { value: e.target.value, isVariable: /\{\{.*?\}\}/.test(e.target.value) })}
                              className="h-6 flex-1 text-xs"
                              placeholder="Wert oder {{variable}}..."
                            />
                            <Select onValueChange={(v) => insertVariable(line.id, v)}>
                              <SelectTrigger className="h-6 w-8 px-1">
                                <Zap className="h-3 w-3 text-amber-500" />
                              </SelectTrigger>
                              <SelectContent>
                                {variables.map((v) => (
                                  <SelectItem key={v.key} value={v.key} className="text-xs">{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(line.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('label-value')}>
            <Plus className="mr-1 h-3 w-3" />Label + Wert
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('text-only')}>
            <Plus className="mr-1 h-3 w-3" />Nur Text
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('spacer')}>
            <Space className="mr-1 h-3 w-3" />Abstand
          </Button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="rounded-lg border bg-white p-4">
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Vorschau</span>
        <div className="space-y-0 text-[9pt] leading-tight font-[Arial,sans-serif]">
          {lines.map((line) => {
            if (line.type === 'spacer') {
              return <div key={line.id} style={{ height: `${line.spacerHeight || 2}mm` }} />;
            }
            const previewVal = getPreviewText(line);
            const isVar = hasVariable(line.value);
            if (line.type === 'text-only') {
              return (
                <div key={line.id} className={`flex items-center gap-1 ${line.valueBold ? 'font-bold' : ''}`} style={{ fontSize: `${line.fontSize || 9}pt` }}>
                  <span>{previewVal || '\u00A0'}</span>
                  {isVar && <Zap className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                </div>
              );
            }
            // label-value
            return (
              <div key={line.id} className="flex items-center gap-1" style={{ fontSize: `${line.fontSize || 9}pt` }}>
                <span className={line.labelBold !== false ? 'font-bold' : ''}>{line.label || ''}</span>
                <span className={line.valueBold ? 'font-bold' : ''}>{previewVal || ''}</span>
                {isVar && <Zap className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
              </div>
            );
          })}
          {lines.length === 0 && <div className="text-muted-foreground italic text-xs">Keine Zeilen vorhanden</div>}
        </div>
      </div>
    </div>
  );
};
