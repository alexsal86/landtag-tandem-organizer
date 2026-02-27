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

export const isFooterLineBlocksData = (value: any): value is FooterLineBlocksData => {
  return !!value && typeof value === 'object' && value.mode === 'line-blocks' && Array.isArray(value.blocks);
};

const toTextOnlyLine = (content: string, index: number): BlockLine => ({
  id: `legacy-${Date.now()}-${index}`,
  type: 'text-only',
  value: content,
  isVariable: /\{\{.*?\}\}/.test(content),
  fontSize: 8,
});

export const parseFooterBlocksForEditor = (raw: any): FooterLineBlock[] => {
  if (isFooterLineBlocksData(raw)) return raw.blocks;

  if (Array.isArray(raw)) {
    return raw.map((legacyBlock: any, index: number): FooterLineBlock => {
      const lines = String(legacyBlock?.content || '')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line, lineIndex) => toTextOnlyLine(line, lineIndex));

      return {
        id: legacyBlock?.id || `legacy-block-${Date.now()}-${index}`,
        title: legacyBlock?.title || '',
        widthUnit: 'percent',
        widthValue: Number(legacyBlock?.widthPercent) || 25,
        lines,
      };
    });
  }

  return [];
};

export const resolveBlockWidthMm = (block: FooterLineBlock, availableWidthMm: number): number => {
  if (block.widthUnit === 'cm') return Math.max(1, block.widthValue * 10);
  return Math.max(1, (availableWidthMm * block.widthValue) / 100);
};

export const toFooterLineBlocksData = (blocks: FooterLineBlock[]): FooterLineBlocksData => ({
  mode: 'line-blocks',
  blocks,
});
