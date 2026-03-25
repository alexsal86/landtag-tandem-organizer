import type { BlockLine } from '@/components/letters/BlockLineEditor';
import { isRecord } from '@/utils/typeSafety';

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

interface LegacyFooterBlock {
  id?: string;
  title?: string;
  widthPercent?: number;
  content?: string;
}

export interface FooterBlockTypographyContract {
  titleHighlight: boolean;
  titleFontSize: number;
  titleFontWeight: 'normal' | 'bold';
  titleColor?: string;
}

const DEFAULT_BLOCK_WIDTH_PERCENT = 25;

const isFooterLineBlocksData = (value: unknown): value is FooterLineBlocksData => {
  return isRecord(value) && value.mode === 'line-blocks' && Array.isArray(value.blocks);
};

const isFooterLineData = (value: unknown): value is FooterLineData => {
  return isRecord(value) && value.mode === 'lines' && Array.isArray(value.lines);
};

const isLegacyFooterBlock = (value: unknown): value is LegacyFooterBlock => isRecord(value);

const toTextOnlyLine = (content: string, index: number): BlockLine => ({
  id: `legacy-${Date.now()}-${index}`,
  type: 'text-only',
  value: content,
  isVariable: /\{\{.*?\}\}/.test(content),
  fontSize: 8,
});

export const toFooterBlockTypographyContract = (value: unknown): FooterBlockTypographyContract => {
  if (!isRecord(value)) {
    return {
      titleHighlight: false,
      titleFontSize: 13,
      titleFontWeight: 'bold',
    };
  }

  return {
    titleHighlight: value.titleHighlight === true,
    titleFontSize: typeof value.titleFontSize === 'number' ? value.titleFontSize : 13,
    titleFontWeight: value.titleFontWeight === 'normal' ? 'normal' : 'bold',
    titleColor: typeof value.titleColor === 'string' ? value.titleColor : undefined,
  };
};

const toLegacyFooterBlock = (value: unknown, index: number): FooterLineBlock => {
  const legacyBlock: LegacyFooterBlock = isLegacyFooterBlock(value) ? value : {};
  return {
    id: typeof legacyBlock.id === 'string' ? legacyBlock.id : `legacy-block-${Date.now()}-${index}`,
    title: typeof legacyBlock.title === 'string' ? legacyBlock.title : '',
    widthUnit: 'percent',
    widthValue: Number(legacyBlock.widthPercent) || DEFAULT_BLOCK_WIDTH_PERCENT,
    lines: String(legacyBlock.content || '')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, lineIndex) => toTextOnlyLine(line, lineIndex)),
  };
};

const flattenBlocksToLines = (blocks: FooterLineBlock[]): BlockLine[] => {
  const lines: BlockLine[] = [];
  blocks.forEach((block, index) => {
    const typography = toFooterBlockTypographyContract(block);
    lines.push({
      id: `fb-start-${Date.now()}-${index}`,
      type: 'block-start',
      label: block.title || '',
      widthUnit: block.widthUnit,
      widthValue: block.widthValue,
      titleHighlight: typography.titleHighlight,
      titleFontSize: typography.titleFontSize,
      titleFontWeight: typography.titleFontWeight,
      titleColor: typography.titleColor,
    } as BlockLine);

    block.lines.forEach((line, lineIndex) => {
      lines.push({ ...line, id: line.id || `fb-line-${Date.now()}-${index}-${lineIndex}` });
    });

    lines.push({ id: `fb-end-${Date.now()}-${index}`, type: 'block-end' } as BlockLine);
  });
  return lines;
};

export const parseFooterLinesForEditor = (raw: unknown): BlockLine[] => {
  if (isFooterLineData(raw)) return raw.lines;

  if (isFooterLineBlocksData(raw)) {
    return flattenBlocksToLines(raw.blocks || []);
  }

  if (Array.isArray(raw)) {
    const blocks = raw.map((legacyBlock, index): FooterLineBlock => toLegacyFooterBlock(legacyBlock, index));
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

const toBlockStartWidth = (line: BlockLine): Pick<FooterLineBlock, 'widthUnit' | 'widthValue'> => ({
  widthUnit: line.widthUnit === 'cm' ? 'cm' : 'percent',
  widthValue: Number(line.widthValue) || DEFAULT_BLOCK_WIDTH_PERCENT,
});

export const buildFooterBlocksFromStored = (raw: unknown): FooterLineBlock[] => {
  if (isFooterLineBlocksData(raw)) return raw.blocks || [];

  if (Array.isArray(raw)) {
    return raw.map((block, index) => toLegacyFooterBlock(block, index));
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
        ...toBlockStartWidth(line),
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
        widthValue: DEFAULT_BLOCK_WIDTH_PERCENT,
        lines: [],
      };
    }
    current.lines.push(line);
  });

  if (current) blocks.push(current);
  return blocks;
};
