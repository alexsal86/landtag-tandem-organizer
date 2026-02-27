import type { BlockLine } from '@/components/letters/BlockLineEditor';

export interface FooterLineBlock {
  id: string;
  title?: string;
  widthUnit: 'percent' | 'cm';
  widthValue: number;
  lines: BlockLine[];
}

export interface FooterLineBlocksData {
  mode: 'line-blocks';
  blocks: FooterLineBlock[];
}

export interface FooterLineData {
  mode: 'lines';
  lines: BlockLine[];
}

const isFooterLineBlocksData = (value: any): value is FooterLineBlocksData => {
  return !!value && typeof value === 'object' && value.mode === 'line-blocks' && Array.isArray(value.blocks);
};

const isFooterLineData = (value: any): value is FooterLineData => {
  return !!value && typeof value === 'object' && value.mode === 'lines' && Array.isArray(value.lines);
};

const toTextOnlyLine = (content: string, index: number): BlockLine => ({
  id: `legacy-${Date.now()}-${index}`,
  type: 'text-only',
  value: content,
  isVariable: /\{\{.*?\}\}/.test(content),
  fontSize: 8,
});

const flattenBlocksToLines = (blocks: FooterLineBlock[]): BlockLine[] => {
  const lines: BlockLine[] = [];
  blocks.forEach((block, index) => {
    lines.push({
      id: `fb-start-${Date.now()}-${index}`,
      type: 'block-start',
      label: block.title || '',
      widthUnit: block.widthUnit,
      widthValue: block.widthValue,
    } as BlockLine);

    block.lines.forEach((line, lineIndex) => {
      lines.push({ ...line, id: line.id || `fb-line-${Date.now()}-${index}-${lineIndex}` });
    });

    lines.push({ id: `fb-end-${Date.now()}-${index}`, type: 'block-end' } as BlockLine);
  });
  return lines;
};

export const parseFooterLinesForEditor = (raw: any): BlockLine[] => {
  if (isFooterLineData(raw)) return raw.lines;

  if (isFooterLineBlocksData(raw)) {
    return flattenBlocksToLines(raw.blocks || []);
  }

  if (Array.isArray(raw)) {
    const blocks = raw.map((legacyBlock: any, index: number): FooterLineBlock => ({
      id: legacyBlock?.id || `legacy-block-${Date.now()}-${index}`,
      title: legacyBlock?.title || '',
      widthUnit: 'percent',
      widthValue: Number(legacyBlock?.widthPercent) || 25,
      lines: String(legacyBlock?.content || '')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line, lineIndex) => toTextOnlyLine(line, lineIndex)),
    }));
    return flattenBlocksToLines(blocks);
  }

  return [];
};

export const toFooterLineData = (lines: BlockLine[]): FooterLineData => ({
  mode: 'lines',
  lines,
});

export const resolveBlockWidthMm = (widthUnit: 'percent' | 'cm', widthValue: number, availableWidthMm: number): number => {
  if (widthUnit === 'cm') return Math.max(1, widthValue * 10);
  return Math.max(1, (availableWidthMm * widthValue) / 100);
};

export const buildFooterBlocksFromStored = (raw: any): FooterLineBlock[] => {
  if (isFooterLineBlocksData(raw)) return raw.blocks || [];

  if (Array.isArray(raw)) {
    return raw.map((block: any, index: number) => ({
      id: block?.id || `legacy-block-${Date.now()}-${index}`,
      title: block?.title || '',
      widthUnit: 'percent',
      widthValue: Number(block?.widthPercent) || 25,
      lines: String(block?.content || '')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line, lineIndex) => toTextOnlyLine(line, lineIndex)),
    }));
  }

  if (!isFooterLineData(raw)) return [];

  const blocks: FooterLineBlock[] = [];
  let current: FooterLineBlock | null = null;

  raw.lines.forEach((line, idx) => {
    if (line.type === 'block-start') {
      if (current) blocks.push(current);
      current = {
        id: line.id || `block-${Date.now()}-${idx}`,
        title: line.label || '',
        widthUnit: ((line as any).widthUnit === 'cm' ? 'cm' : 'percent'),
        widthValue: Number((line as any).widthValue) || 25,
        lines: [],
      };
      return;
    }

    if (line.type === 'block-end') {
      if (current) {
        blocks.push(current);
        current = null;
      }
      return;
    }

    if (!current) {
      current = {
        id: `auto-${Date.now()}-${idx}`,
        title: '',
        widthUnit: 'percent',
        widthValue: 25,
        lines: [],
      };
    }
    current.lines.push(line);
  });

  if (current) blocks.push(current);
  return blocks;
};
