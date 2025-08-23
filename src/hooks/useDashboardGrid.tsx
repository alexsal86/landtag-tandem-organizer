import { WidgetSize } from './useDashboardLayout';

// Grid configuration - Responsive breakpoints
export const GRID_COLUMNS_DESKTOP = 6;
export const GRID_COLUMNS_TABLET = 4;
export const GRID_COLUMNS_MOBILE = 2;
export const GRID_ROW_HEIGHT = 120; // Reduced for better fit
export const GRID_GAP = 16; // Gap in px

// Get responsive column count based on screen width
export function getResponsiveColumns(containerWidth: number): number {
  if (containerWidth >= 1024) return GRID_COLUMNS_DESKTOP;
  if (containerWidth >= 768) return GRID_COLUMNS_TABLET;
  return GRID_COLUMNS_MOBILE;
}

export const GRID_COLUMNS = GRID_COLUMNS_DESKTOP; // Default for compatibility

export function getGridColumns(widgetSize: WidgetSize): number {
  const [width] = widgetSize.split('x').map(Number);
  return width;
}

export function getGridRows(widgetSize: WidgetSize): number {
  const [, height] = widgetSize.split('x').map(Number);
  return height;
}

// Get CSS Grid unit size - simplified for CSS Grid 1fr
export function getCSSGridUnit(containerWidth: number): number {
  const columns = getResponsiveColumns(containerWidth);
  // Pure CSS Grid calculation: available width divided by columns
  return (containerWidth - (GRID_GAP * (columns + 1))) / columns;
}

// Convert pixel coordinates to CSS Grid position
export function pixelToGridPosition(
  x: number,
  y: number,
  containerWidth: number
): { column: number; row: number } {
  const columns = getResponsiveColumns(containerWidth);
  const gridUnit = getCSSGridUnit(containerWidth);
  
  // Direct CSS Grid mapping with padding offset
  const adjustedX = Math.max(0, x - GRID_GAP);
  const adjustedY = Math.max(0, y - GRID_GAP);
  
  const column = Math.max(0, Math.min(columns - 1, Math.floor(adjustedX / (gridUnit + GRID_GAP))));
  const row = Math.max(0, Math.floor(adjustedY / (GRID_ROW_HEIGHT + GRID_GAP)));
  
  return { column, row };
}

// Convert mouse delta to CSS Grid columns/rows
export function deltaToGridSize(
  deltaX: number,
  deltaY: number,
  containerWidth: number
): { deltaColumns: number; deltaRows: number } {
  const gridUnit = getCSSGridUnit(containerWidth);
  
  // CSS Grid-based delta with smaller threshold for responsiveness
  const colThreshold = gridUnit * 0.25;
  const rowThreshold = GRID_ROW_HEIGHT * 0.25;
  
  const deltaColumns = Math.abs(deltaX) > colThreshold ? Math.round(deltaX / (gridUnit + GRID_GAP)) : 0;
  const deltaRows = Math.abs(deltaY) > rowThreshold ? Math.round(deltaY / (GRID_ROW_HEIGHT + GRID_GAP)) : 0;
  
  return { deltaColumns, deltaRows };
}

export function findAvailablePosition(
  existingPositions: Array<{ x: number; y: number; w: number; h: number }>,
  newWidgetSize: WidgetSize = '2x2',
  containerWidth: number = 1200
): { x: number; y: number } {
  const cols = getGridColumns(newWidgetSize);
  const rows = getGridRows(newWidgetSize);
  const gridColumns = getResponsiveColumns(containerWidth);
  
  // Create a grid to track occupied positions
  const grid: boolean[][] = Array(20).fill(null).map(() => Array(gridColumns).fill(false));
  
  // Mark occupied positions
  existingPositions.forEach(({ x, y, w, h }) => {
    for (let row = y; row < y + h && row < 20; row++) {
      for (let col = x; col < x + w && col < gridColumns; col++) {
        grid[row][col] = true;
      }
    }
  });
  
  // Find first available position
  for (let y = 0; y < 20 - rows + 1; y++) {
    for (let x = 0; x < gridColumns - cols + 1; x++) {
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
  const gridUnit = getCSSGridUnit(containerWidth);
  
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
  excludeId?: string,
  containerWidth: number = 1200
): boolean {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  const gridColumns = getResponsiveColumns(containerWidth);
  
  // Check grid boundaries
  if (x < 0 || y < 0 || x + cols > gridColumns) {
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
  containerWidth: number = 1200,
  maxHeight: number = 4
): WidgetSize {
  const maxWidth = getResponsiveColumns(containerWidth);
  const validSizes: WidgetSize[] = [
    '1x1', '2x1', '1x2', '2x2', '3x1', '1x3', '3x2', '2x3', '3x3', 
    '4x1', '1x4', '4x2', '2x4', '5x1', '6x1', '5x2', '6x2'
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

// Get widget pixel dimensions based on CSS Grid units
export function getWidgetPixelDimensions(
  widgetSize: WidgetSize, 
  containerWidth: number
): { width: number; height: number } {
  const cols = getGridColumns(widgetSize);
  const rows = getGridRows(widgetSize);
  const gridUnit = getCSSGridUnit(containerWidth);
  
  return {
    width: cols * gridUnit + (cols - 1) * GRID_GAP,
    height: rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_GAP
  };
}