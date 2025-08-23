import React from 'react';
import { getResponsiveColumns, GRID_ROW_HEIGHT, GRID_GAP, getCSSGridUnit } from '@/hooks/useDashboardGrid';

interface GridDebugOverlayProps {
  containerWidth: number;
  isVisible: boolean;
}

export function GridDebugOverlay({ containerWidth, isVisible }: GridDebugOverlayProps) {
  if (!isVisible) return null;

  const gridColumns = getResponsiveColumns(containerWidth);
  const gridUnit = getCSSGridUnit(containerWidth);

  console.log('🎯 Grid Debug (8-Column):', {
    containerWidth,
    gridColumns,
    gridUnit,
    calculatedTotalWidth: gridColumns * gridUnit + (gridColumns - 1) * GRID_GAP,
    availableWidth: containerWidth,
    padding: 'vertical only',
    gaps: GRID_GAP * (gridColumns - 1)
  });

  const debugInfo = [
    `Container: ${containerWidth}px`,
    `Columns: ${gridColumns}`,
    `Unit: ${Math.round(gridUnit)}px`,
    `3x1 Widget: ${Math.round(3 * gridUnit + 2 * GRID_GAP)}px`,
    `2x1 Widget: ${Math.round(2 * gridUnit + 1 * GRID_GAP)}px`,
    `3x1 Widget: ${Math.round(3 * gridUnit + 2 * GRID_GAP)}px`,
    `Total (3+2+3): ${Math.round(8 * gridUnit + 7 * GRID_GAP)}px`
  ];

  return (
    <div className="absolute top-2 right-2 bg-black/80 text-white text-xs p-2 rounded font-mono z-50">
      <div className="font-bold mb-1">Grid Debug</div>
      {debugInfo.map((info, i) => (
        <div key={i}>{info}</div>
      ))}
    </div>
  );
}