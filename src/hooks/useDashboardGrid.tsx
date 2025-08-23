import { WidgetSize } from './useDashboardLayout';

// Grid configuration
export const GRID_COLUMNS = 6;
export const GRID_ROW_HEIGHT = 200; // Base height in px
export const GRID_GAP = 16; // Gap in px

export function getGridColumns(widgetSize: WidgetSize): number {
  const [width] = widgetSize.split('x').map(Number);
  return width;
}

export function getGridRows(widgetSize: WidgetSize): number {
  const [, height] = widgetSize.split('x').map(Number);
  return height;
}

// Calculate responsive grid unit based on container width
export function calculateGridUnit(containerWidth: number): number {
  return (containerWidth - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS;
}

// Convert pixel coordinates to grid position
export function pixelToGridPosition(
  x: number,
  y: number,
  containerWidth: number
): { column: number; row: number } {
  const gridUnit = calculateGridUnit(containerWidth);
  
  const column = Math.max(1, Math.min(GRID_COLUMNS, Math.ceil(x / (gridUnit + GRID_GAP))));
  const row = Math.max(1, Math.ceil(y / (GRID_ROW_HEIGHT + GRID_GAP)));
  
  return { column, row };
}

// Convert mouse delta to grid size change
export function deltaToGridSize(
  deltaX: number,
  deltaY: number,
  containerWidth: number
): { deltaColumns: number; deltaRows: number } {
  const gridUnit = calculateGridUnit(containerWidth);
  
  const deltaColumns = Math.round(deltaX / (gridUnit + GRID_GAP));
  const deltaRows = Math.round(deltaY / (GRID_ROW_HEIGHT + GRID_GAP));
  
  return { deltaColumns, deltaRows };
}

export function findAvailablePosition(
  existingPositions: Array<{ x: number; y: number; w: number; h: number }>,
  newWidgetSize: WidgetSize = '2x2'
): { x: number; y: number } {
  const cols = getGridColumns(newWidgetSize);
  const rows = getGridRows(newWidgetSize);
  
  // Create a grid to track occupied positions
  const grid: boolean[][] = Array(20).fill(null).map(() => Array(GRID_COLUMNS).fill(false));
  
  // Mark occupied positions
  existingPositions.forEach(({ x, y, w, h }) => {
    for (let row = y; row < y + h && row < 20; row++) {
      for (let col = x; col < x + w && col < GRID_COLUMNS; col++) {
        grid[row][col] = true;
      }
    }
  });
  
  // Find first available position
  for (let y = 0; y < 20 - rows + 1; y++) {
    for (let x = 0; x < GRID_COLUMNS - cols + 1; x++) {
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

export function getWidgetDimensions(widgetSize: WidgetSize, containerWidth: number) {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  const gridUnit = calculateGridUnit(containerWidth);
  
  return {
    width: cols * gridUnit + (cols - 1) * GRID_GAP,
    height: rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_GAP
  };
}

export function isValidPosition(
  x: number,
  y: number,
  widgetSize: WidgetSize,
  existingWidgets: Array<{ x: number; y: number; w: number; h: number; id?: string }>,
  excludeId?: string
): boolean {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  
  // Check grid boundaries
  if (x < 0 || y < 0 || x + cols > GRID_COLUMNS) {
    return false;
  }
  
  // Check for collisions with other widgets
  for (const widget of existingWidgets) {
    if (excludeId && widget.id === excludeId) continue;
    
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

// Validate and clamp widget size to allowed boundaries
export function validateWidgetSize(
  currentSize: WidgetSize,
  newWidth: number,
  newHeight: number,
  maxWidth: number = 6,
  maxHeight: number = 4
): WidgetSize {
  const validSizes: WidgetSize[] = [
    '1x1', '2x1', '1x2', '2x2', '3x1', '1x3', '3x2', '2x3', '3x3', 
    '4x1', '1x4', '4x2', '2x4'
  ];
  
  // Clamp to boundaries
  const clampedW = Math.max(1, Math.min(maxWidth, newWidth));
  const clampedH = Math.max(1, Math.min(maxHeight, newHeight));
  
  const newSizeStr = `${clampedW}x${clampedH}` as WidgetSize;
  
  if (validSizes.includes(newSizeStr)) {
    return newSizeStr;
  }
  
  // Find nearest valid size
  const nearest = validSizes.find(size => {
    const [w, h] = size.split('x').map(Number);
    return Math.abs(w - clampedW) + Math.abs(h - clampedH) <= 1;
  });
  
  return nearest || currentSize;
}