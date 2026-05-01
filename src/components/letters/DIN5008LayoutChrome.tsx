import React from 'react';
import { buildFooterBlocksFromStored } from '@/components/letters/footerBlockUtils';
import { getBlockLineFontStack } from '@/components/letters/BlockLineEditor';

interface FoldHoleMarksProps {
  foldHoleMarks: {
    enabled?: boolean;
    left?: number;
    strokeWidthPt?: number;
    foldMarkWidth?: number;
    holeMarkWidth?: number;
    topMarkY?: number;
    holeMarkY?: number;
    bottomMarkY?: number;
  };
}

export const FoldHoleMarks: React.FC<FoldHoleMarksProps> = ({ foldHoleMarks }) => {
  if (!(foldHoleMarks.enabled ?? true)) return null;

  return (
    <>
      {[
        { y: foldHoleMarks.topMarkY, width: foldHoleMarks.foldMarkWidth, key: 'fold-top' },
        { y: foldHoleMarks.holeMarkY, width: foldHoleMarks.holeMarkWidth, key: 'hole' },
        { y: foldHoleMarks.bottomMarkY, width: foldHoleMarks.foldMarkWidth, key: 'fold-bottom' },
      ].map((mark) => (
        <div
          key={mark.key}
          style={{
            position: 'absolute',
            left: `${foldHoleMarks.left}mm`,
            top: `${mark.y}mm`,
            width: `${mark.width}mm`,
            height: `${Math.max(0.1, (foldHoleMarks.strokeWidthPt || 1) * 0.3528)}mm`,
            backgroundColor: '#111',
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
};

interface TemplateFooterBlocksProps {
  footerBlocks?: unknown;
  debugMode?: boolean;
}

export const TemplateFooterBlocks: React.FC<TemplateFooterBlocksProps> = ({ footerBlocks, debugMode = false }) => {
  if (!footerBlocks) return null;

  const sortedBlocks = buildFooterBlocksFromStored(footerBlocks);

  return (
    <div
      className="flex"
      style={{
        position: 'absolute',
        top: '272mm',
        left: '25mm',
        right: '20mm',
        height: '18mm',
        fontSize: '8pt',
        zIndex: 30,
        backgroundColor: debugMode ? 'rgba(128,0,128,0.05)' : '#fff',
      }}
    >
      {sortedBlocks.map((block: FooterBlock, index: number) => {
        const blockWidth = block.widthUnit === 'cm'
          ? `${Math.max(1, Number(block.widthValue) || 1)}cm`
          : `${Math.max(1, Number(block.widthValue) || 25)}%`;

        return (
          <div
            key={block.id || index}
            style={{ width: blockWidth, paddingRight: '2mm', fontSize: '8pt', lineHeight: 1 }}
          >
            {block.title && <div style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{block.title}</div>}
            <div>
              {(block.lines || []).map((line: FooterBlockLine, lineIndex: number) => {
                if (line.type === 'spacer') {
                  return <div key={lineIndex} style={{ height: `${Math.max(0.5, Number(line.spacerHeight) || 1)}mm` }} />;
                }
                const content = line.type === 'label-value'
                  ? `${line.label || ''} ${line.value || ''}`.trim()
                  : (line.value || '');
                if (!content) return null;

                return (
                  <div
                    key={lineIndex}
                    style={{
                      fontSize: `${Math.max(6, Math.min(12, Number(line.fontSize) || 8))}pt`,
                      fontFamily: getBlockLineFontStack(line.fontFamily),
                      fontWeight: line.valueBold ? 'bold' : 'normal',
                      color: line.color || undefined,
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface PaginationFooterProps {
  enabled: boolean;
  topMm: number;
  align?: 'left' | 'right' | 'center';
  fontSize?: number;
}

export const PaginationFooter: React.FC<PaginationFooterProps> = ({
  enabled,
  topMm,
  align = 'right',
  fontSize = 8,
}) => {
  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: `${topMm}mm`,
        left: align === 'left' ? '25mm' : undefined,
        right: align !== 'left' ? '20mm' : undefined,
        textAlign: align,
        fontSize: `${fontSize}pt`,
        color: '#666',
        zIndex: 30,
        backgroundColor: '#fff',
        padding: '0 1mm',
        fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
      }}
    >
      Seite 1 von 1
    </div>
  );
};
