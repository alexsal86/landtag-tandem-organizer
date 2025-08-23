import { WidgetSize } from './useDashboardLayout';

export function getGridColumns(widgetSize: WidgetSize): number {
  const [width] = widgetSize.split('x').map(Number);
  return width;
}

export function getGridRows(widgetSize: WidgetSize): number {
  const [, height] = widgetSize.split('x').map(Number);
  return height;
}

export function findAvailablePosition(
  existingPositions: Array<{ x: number; y: number; w: number; h: number }>,
  newWidgetSize: WidgetSize = '2x2'
): { x: number; y: number } {
  const cols = getGridColumns(newWidgetSize);
  const rows = getGridRows(newWidgetSize);
  const maxCols = 6; // Grid has 6 columns
  
  // Create a grid to track occupied positions
  const grid: boolean[][] = Array(20).fill(null).map(() => Array(maxCols).fill(false));
  
  // Mark occupied positions
  existingPositions.forEach(({ x, y, w, h }) => {
    for (let row = y; row < y + h && row < 20; row++) {
      for (let col = x; col < x + w && col < maxCols; col++) {
        grid[row][col] = true;
      }
    }
  });
  
  // Find first available position
  for (let y = 0; y < 20 - rows + 1; y++) {
    for (let x = 0; x < maxCols - cols + 1; x++) {
      let canPlace = true;
      
      // Check if widget can fit at this position
      for (let row = y; row < y + rows && canPlace; row++) {
        for (let col = x; col < x + cols && canPlace; col++) {
          if (grid[row][col]) {
            canPlace = false;
          }
        }
      }
      
      if (canPlace) {
        return { x, y };
      }
    }
  }
  
  // Fallback to bottom-right if no space found
  return { x: 0, y: Math.max(0, Math.max(...existingPositions.map(p => p.y + p.h), 0)) };
}

export function getWidgetDimensions(widgetSize: WidgetSize) {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  
  return {
    width: cols * 200 - 16, // Account for grid gap
    height: rows * 200 - 16
  };
}

export function isValidPosition(
  x: number,
  y: number,
  widgetSize: WidgetSize,
  existingWidgets: Array<{ x: number; y: number; w: number; h: number }>,
  excludeId?: string
): boolean {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  const maxCols = 6;
  
  // Check grid boundaries
  if (x < 0 || y < 0 || x + cols > maxCols) {
    return false;
  }
  
  // Check for collisions with other widgets
  for (const widget of existingWidgets) {
    if (
      x < widget.x + widget.w &&
      x + cols > widget.x &&
      y < widget.y + widget.h &&
      y + rows > widget.y
    ) {
      return false;
    }
  }
  
  return true;
}