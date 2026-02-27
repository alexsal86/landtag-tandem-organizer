import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, Trash2, Space, Zap, FileText, Bold } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface BlockLine {
  id: string;
  type: 'label-value' | 'spacer' | 'text-only' | 'block-start' | 'block-end';
  label?: string;
  value?: string;
  isVariable?: boolean;
  labelBold?: boolean;
  valueBold?: boolean;
  fontSize?: number;
  spacerHeight?: number;
  widthUnit?: 'percent' | 'cm';
  widthValue?: number;
  color?: string;
  prefixShape?: 'none' | 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
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
  { key: '{{empfaenger_anrede}}', label: 'Anrede (Herrn/Frau)', preview: 'Herrn' },
  { key: '{{empfaenger_name}}', label: 'Empfänger Name', preview: 'Erika Mustermann' },
  { key: '{{empfaenger_nachname}}', label: 'Nachname', preview: 'Mustermann' },
  { key: '{{empfaenger_strasse}}', label: 'Straße', preview: 'Musterstraße 1' },
  { key: '{{empfaenger_plz}}', label: 'PLZ', preview: '20095' },
  { key: '{{empfaenger_ort}}', label: 'Ort', preview: 'Hamburg' },
  { key: '{{empfaenger_land}}', label: 'Land', preview: 'Deutschland' },
];

const RETURN_ADDRESS_VARIABLES: AvailableVariable[] = [
  { key: '{{absender_name}}', label: 'Absender Name', preview: 'Alexander Salomon' },
  { key: '{{absender_organisation}}', label: 'Organisation', preview: 'Fraktion GRÜNE' },
  { key: '{{absender_strasse}}', label: 'Straße', preview: 'Konrad-Adenauer-Str. 3' },
  { key: '{{absender_plz_ort}}', label: 'PLZ/Ort', preview: '70173 Stuttgart' },
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

const DIN5008_RETURN_ADDRESS_TEMPLATE: BlockLine[] = [
  { id: 'ret-1', type: 'text-only', value: '{{absender_name}} · {{absender_organisation}} · {{absender_strasse}} · {{absender_plz_ort}}', isVariable: true, fontSize: 7 },
];

const DIN5008_FOOTER_TEMPLATE: BlockLine[] = [
  // Block 1: Name & Partei
  { id: 'ft-1', type: 'block-start', label: '', widthUnit: 'percent', widthValue: 25 },
  { id: 'ft-2', type: 'text-only', value: 'Alexander Salomon MdL', fontSize: 8, valueBold: true, color: '#4a8c3f' },
  { id: 'ft-3', type: 'text-only', value: 'Fraktion GRÜNE im', fontSize: 7 },
  { id: 'ft-4', type: 'text-only', value: 'Landtag von', fontSize: 7 },
  { id: 'ft-5', type: 'text-only', value: 'Baden-Württemberg', fontSize: 7 },
  { id: 'ft-6', type: 'block-end' },
  // Block 2: Für Sie im Landtag
  { id: 'ft-7', type: 'block-start', label: '', widthUnit: 'percent', widthValue: 25 },
  { id: 'ft-8', type: 'text-only', value: 'Für Sie im Landtag', fontSize: 8, valueBold: true },
  { id: 'ft-9', type: 'text-only', value: 'Konrad-Adenauer-Str. 3', fontSize: 7 },
  { id: 'ft-10', type: 'text-only', value: '70173 Stuttgart', fontSize: 7 },
  { id: 'ft-11', type: 'text-only', value: 'T 0711 / 2063-623', fontSize: 7 },
  { id: 'ft-12', type: 'block-end' },
  // Block 3: Für Sie in Karlsruhe
  { id: 'ft-13', type: 'block-start', label: '', widthUnit: 'percent', widthValue: 25 },
  { id: 'ft-14', type: 'text-only', value: 'Für Sie in Karlsruhe', fontSize: 8, valueBold: true },
  { id: 'ft-15', type: 'text-only', value: 'Markgrafenstr. 16', fontSize: 7 },
  { id: 'ft-16', type: 'text-only', value: '76131 Karlsruhe', fontSize: 7 },
  { id: 'ft-17', type: 'text-only', value: 'T 0721 / 98507-24', fontSize: 7 },
  { id: 'ft-18', type: 'block-end' },
  // Block 4: Politik direkt
  { id: 'ft-19', type: 'block-start', label: '', widthUnit: 'percent', widthValue: 25 },
  { id: 'ft-20', type: 'text-only', value: 'Politik direkt', fontSize: 8, valueBold: true },
  { id: 'ft-21', type: 'text-only', value: 'alexander-salomon.de', fontSize: 7 },
  { id: 'ft-22', type: 'text-only', value: 'alexander.salomon@', fontSize: 7 },
  { id: 'ft-23', type: 'text-only', value: 'gruene.landtag-bw.de', fontSize: 7 },
  { id: 'ft-24', type: 'block-end' },
];

interface BlockLineEditorProps {
  blockType: 'infoBlock' | 'addressField' | 'returnAddress' | 'footer' | 'subject';
  lines: BlockLine[];
  onChange: (lines: BlockLine[]) => void;
}

const SUBJECT_PREFIX_SHAPES: Array<{ value: 'none' | 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen'; label: string }> = [
  { value: 'none', label: 'Keine Form' },
  { value: 'line', label: 'Linie ─' },
  { value: 'circle', label: 'Kreis ○' },
  { value: 'rectangle', label: 'Rechteck □' },
  { value: 'sunflower', label: 'Sonnenblume 🌻' },
  { value: 'lion', label: 'Löwe 🦁' },
  { value: 'wappen', label: 'Wappen 🏛️' },
];

let nextId = 1;
const genId = () => `bl-${Date.now()}-${nextId++}`;

export const BlockLineEditor: React.FC<BlockLineEditorProps> = ({ blockType, lines, onChange }) => {
  const footerVariables: AvailableVariable[] = [
    ...RETURN_ADDRESS_VARIABLES,
    { key: '{{telefon}}', label: 'Telefon', preview: '0711 / 2063-623' },
    { key: '{{email}}', label: 'E-Mail', preview: 'alexander.salomon@gruene.landtag-bw.de' },
    { key: '{{webseite}}', label: 'Webseite', preview: 'alexander-salomon.de' },
  ];
  const variables = blockType === 'infoBlock'
    ? INFO_BLOCK_VARIABLES
    : blockType === 'returnAddress'
      ? RETURN_ADDRESS_VARIABLES
      : blockType === 'footer'
        ? footerVariables
        : blockType === 'subject'
          ? [{ key: '{{betreff}}', label: 'Betreff', preview: 'Ihr Anliegen vom 08. März 2026' }]
        : ADDRESS_FIELD_VARIABLES;
  const din5008Template = blockType === 'infoBlock'
    ? DIN5008_INFO_BLOCK_TEMPLATE
    : blockType === 'returnAddress'
      ? DIN5008_RETURN_ADDRESS_TEMPLATE
    : blockType === 'footer'
      ? DIN5008_FOOTER_TEMPLATE
      : blockType === 'subject'
        ? [{ id: 'subject-1', type: 'text-only', value: '{{betreff}}', isVariable: true } as BlockLine]
        : DIN5008_ADDRESS_TEMPLATE;

  const addLine = (type: BlockLine['type']) => {
    const newLine: BlockLine = type === 'spacer'
      ? { id: genId(), type: 'spacer', spacerHeight: 2 }
      : type === 'text-only'
        ? { id: genId(), type: 'text-only', value: '' }
        : type === 'block-start'
          ? { id: genId(), type: 'block-start', label: '', widthUnit: 'percent', widthValue: 25 }
          : type === 'block-end'
            ? { id: genId(), type: 'block-end' }
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
    const allVars = [...INFO_BLOCK_VARIABLES, ...ADDRESS_FIELD_VARIABLES, ...RETURN_ADDRESS_VARIABLES];
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
                {lines.map((line, index) => {
                  // Determine indentation: lines between block-start and block-end
                  const isInsideBlock = (() => {
                    if (line.type === 'block-start' || line.type === 'block-end') return false;
                    let depth = 0;
                    for (let i = 0; i < index; i++) {
                      if (lines[i].type === 'block-start') depth++;
                      if (lines[i].type === 'block-end') depth--;
                    }
                    return depth > 0;
                  })();
                  return (
                  <Draggable key={line.id} draggableId={line.id} index={index}>
                    {(prov, snap) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`flex items-center gap-1 rounded border px-1 py-1 text-xs ${snap.isDragging ? 'bg-accent shadow-md' : 'bg-background'}`}
                        style={{ ...prov.draggableProps.style, marginLeft: isInsideBlock ? 24 : 0 }}
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
                        ) : line.type === 'block-start' ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">Block Anfang</Badge>
                            <Input
                              value={line.label || ''}
                              onChange={(e) => updateLine(line.id, { label: e.target.value })}
                              className="h-6 w-44 text-xs"
                              placeholder="Titel (optional)"
                            />
                            <Select
                              value={line.widthUnit || 'percent'}
                              onValueChange={(value: 'percent' | 'cm') => updateLine(line.id, { widthUnit: value })}
                            >
                              <SelectTrigger className="h-6 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percent">%</SelectItem>
                                <SelectItem value="cm">cm</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step={line.widthUnit === 'cm' ? '0.1' : '1'}
                              value={line.widthValue || 25}
                              onChange={(e) => updateLine(line.id, { widthValue: Math.max(1, parseFloat(e.target.value) || 1) })}
                              className="h-6 w-20 text-xs"
                              min={1}
                            />
                          </div>
                        ) : line.type === 'block-end' ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">Block Ende</Badge>
                            <span className="text-[11px] text-muted-foreground">Schließt den aktuellen Footer-Block</span>
                          </div>
                        ) : line.type === 'text-only' ? (
                          <div className="flex flex-1 items-center gap-1">
                            <Badge variant="secondary" className="shrink-0 text-[10px]">Text</Badge>
                            {blockType === 'subject' && (
                              <Select
                                value={(line as any).prefixShape || 'none'}
                                onValueChange={(value: 'none' | 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen') => updateLine(line.id, { prefixShape: value } as any)}
                              >
                                <SelectTrigger className="h-6 w-36 text-xs">
                                  <SelectValue placeholder="Form" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SUBJECT_PREFIX_SHAPES.map((shape) => (
                                    <SelectItem key={shape.value} value={shape.value} className="text-xs">{shape.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Input
                              value={line.value || ''}
                              onChange={(e) => updateLine(line.id, { value: e.target.value, isVariable: /\{\{.*?\}\}/.test(e.target.value) })}
                              className="h-6 flex-1 text-xs"
                              placeholder="Text oder {{variable}}..."
                            />
                            <Button
                              variant={line.valueBold ? 'default' : 'ghost'}
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => updateLine(line.id, { valueBold: !line.valueBold })}
                              title="Fett"
                            >
                              <Bold className="h-3 w-3" />
                            </Button>
                            <Input
                              type="color"
                              value={line.color || '#000000'}
                              onChange={(e) => updateLine(line.id, { color: e.target.value === '#000000' ? undefined : e.target.value })}
                              className="h-6 w-6 p-0 border-0 cursor-pointer"
                              title="Textfarbe"
                            />
                            <Input
                              type="number"
                              value={line.fontSize || 9}
                              onChange={(e) => updateLine(line.id, { fontSize: parseFloat(e.target.value) || 9 })}
                              className="h-6 w-12 text-xs text-center"
                              min={5}
                              max={24}
                              title="Schriftgröße (pt)"
                            />
                            <span className="text-[10px] text-muted-foreground">pt</span>
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
                            <Button
                              variant={line.valueBold ? 'default' : 'ghost'}
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => updateLine(line.id, { valueBold: !line.valueBold })}
                              title="Wert fett"
                            >
                              <Bold className="h-3 w-3" />
                            </Button>
                            <Input
                              type="color"
                              value={line.color || '#000000'}
                              onChange={(e) => updateLine(line.id, { color: e.target.value === '#000000' ? undefined : e.target.value })}
                              className="h-6 w-6 p-0 border-0 cursor-pointer"
                              title="Textfarbe"
                            />
                            <Input
                              type="number"
                              value={line.fontSize || 9}
                              onChange={(e) => updateLine(line.id, { fontSize: parseFloat(e.target.value) || 9 })}
                              className="h-6 w-12 text-xs text-center"
                              min={5}
                              max={24}
                              title="Schriftgröße (pt)"
                            />
                            <span className="text-[10px] text-muted-foreground">pt</span>
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
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('label-value')}>
            <Plus className="mr-1 h-3 w-3" />Label + Wert
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('text-only')}>
            <Plus className="mr-1 h-3 w-3" />Nur Text
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('spacer')}>
            <Space className="mr-1 h-3 w-3" />Abstand
          </Button>
          {blockType === 'footer' && (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('block-start')}>
                <Plus className="mr-1 h-3 w-3" />Block Anfang
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addLine('block-end')}>
                <Plus className="mr-1 h-3 w-3" />Block Ende
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Right: Preview */}
      <div className="rounded-lg border bg-white p-4">
        <span className="text-xs font-medium text-muted-foreground mb-2 block">Vorschau</span>
        {blockType === 'footer' ? (
          /* Footer preview: render blocks as horizontal columns */
          <div className="flex text-[7pt] leading-tight font-[Arial,sans-serif]" style={{ gap: '2mm' }}>
            {(() => {
              const columns: { label: string; widthValue: number; widthUnit: string; items: BlockLine[] }[] = [];
              let current: typeof columns[0] | null = null;
              lines.forEach((line) => {
                if (line.type === 'block-start') {
                  if (current) columns.push(current);
                  current = { label: line.label || '', widthValue: line.widthValue || 25, widthUnit: line.widthUnit || 'percent', items: [] };
                } else if (line.type === 'block-end') {
                  if (current) { columns.push(current); current = null; }
                } else if (current) {
                  current.items.push(line);
                }
              });
              if (current) columns.push(current);
              if (columns.length === 0) return <div className="text-muted-foreground italic text-xs">Keine Footer-Blöcke</div>;
              return columns.map((col, ci) => (
                <div key={ci} style={{ width: col.widthUnit === 'cm' ? `${col.widthValue}cm` : `${col.widthValue}%` }}>
                  {col.items.map((line) => {
                    if (line.type === 'spacer') return <div key={line.id} style={{ height: `${line.spacerHeight || 2}mm` }} />;
                    const previewVal = getPreviewText(line);
                    return (
                      <div key={line.id} style={{ fontSize: `${line.fontSize || 8}pt`, fontWeight: line.valueBold ? 'bold' : 'normal', color: line.color || '#000' }}>
                        {line.type === 'label-value' ? `${line.label || ''} ${previewVal}`.trim() : (previewVal || '\u00A0')}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        ) : (
        <div className="space-y-0 text-[9pt] leading-tight font-[Arial,sans-serif]">
          {lines.map((line) => {
            if (line.type === 'spacer') {
              return <div key={line.id} style={{ height: `${line.spacerHeight || 2}mm` }} />;
            }
            if (line.type === 'block-start') {
              return <div key={line.id} className="text-[10px] font-semibold text-muted-foreground border-t pt-1 mt-1">[Block Anfang] {line.label || ''}</div>;
            }
            if (line.type === 'block-end') {
              return <div key={line.id} className="text-[10px] text-muted-foreground border-b pb-1 mb-1">[Block Ende]</div>;
            }
            const previewVal = getPreviewText(line);
            const isVar = hasVariable(line.value);
            if (line.type === 'text-only') {
              return (
                <div key={line.id} className={`flex items-center gap-1 ${line.valueBold ? 'font-bold' : ''}`} style={{ fontSize: `${line.fontSize || 9}pt`, color: line.color || undefined }}>
                  <span>{previewVal || '\u00A0'}</span>
                  {isVar && <Zap className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                </div>
              );
            }
            // label-value
            return (
              <div key={line.id} className="flex items-center gap-1" style={{ fontSize: `${line.fontSize || 9}pt`, color: line.color || undefined }}>
                <span className={line.labelBold !== false ? 'font-bold' : ''}>{line.label || ''}</span>
                <span className={line.valueBold ? 'font-bold' : ''}>{previewVal || ''}</span>
                {isVar && <Zap className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
              </div>
            );
          })}
          {lines.length === 0 && <div className="text-muted-foreground italic text-xs">Keine Zeilen vorhanden</div>}
        </div>
        )}
      </div>
    </div>
  );
};
