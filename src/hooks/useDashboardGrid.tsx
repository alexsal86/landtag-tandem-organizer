export type WidgetSize = '1x1' | '2x1' | '3x1' | '1x2' | '2x2' | '3x2' | '1x3' | '2x3' | '3x3';

// Grid constants
const DESKTOP_COLUMNS = 6;
const TABLET_COLUMNS = 4;
const MOBILE_COLUMNS = 2;
export const ROW_HEIGHT = 200;
export const GRID_GAP = 16;

// Get responsive columns based on container width
export const getResponsiveColumns = (containerWidth: number): number => {
  if (containerWidth >= 1024) return DESKTOP_COLUMNS;
  if (containerWidth >= 768) return TABLET_COLUMNS;
  return MOBILE_COLUMNS;
};

// Get grid columns from widget size
export const getGridColumns = (widgetSize: WidgetSize): number => {
  return parseInt(widgetSize.split('x')[0]);
};

// Get grid rows from widget size
export const getGridRows = (widgetSize: WidgetSize): number => {
  return parseInt(widgetSize.split('x')[1]);
};

// Get pixel height for widget
export const getWidgetHeight = (widgetSize: WidgetSize): number => {
  const rows = getGridRows(widgetSize);
  return (rows * ROW_HEIGHT) + ((rows - 1) * GRID_GAP);
};

// Find available position for new widget
export const findAvailablePosition = (
  existingPositions: Array<{ x: number; y: number; w: number; h: number }>,
  newWidgetSize: WidgetSize = '2x2',
  containerWidth: number = 1200
): { x: number; y: number } => {
  const gridColumns = getResponsiveColumns(containerWidth);
  const newW = getGridColumns(newWidgetSize);
  const newH = getGridRows(newWidgetSize);

  for (let y = 0; y < 20; y++) {
    for (let x = 0; x <= gridColumns - newW; x++) {
      const wouldCollide = existingPositions.some(pos => {
        return !(x >= pos.x + pos.w || x + newW <= pos.x || y >= pos.y + pos.h || y + newH <= pos.y);
      });

      if (!wouldCollide) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: Math.max(0, ...existingPositions.map(p => p.y + p.h)) };
};

// Check if position is valid
export const isValidPosition = (
  x: number,
  y: number,
  widgetSize: WidgetSize,
  existingWidgets: Array<{ x: number; y: number; w: number; h: number; id?: string }>,
  excludeId?: string,
  containerWidth: number = 1200
): boolean => {
  const gridColumns = getResponsiveColumns(containerWidth);
  const w = getGridColumns(widgetSize);
  const h = getGridRows(widgetSize);

  if (x < 0 || y < 0 || x + w > gridColumns) return false;

  return !existingWidgets.some(widget => {
    if (excludeId && widget.id === excludeId) return false;
    return !(x >= widget.x + widget.w || x + w <= widget.x || y >= widget.y + widget.h || y + h <= widget.y);
  });
};

// Validate widget size
export const validateWidgetSize = (
  currentSize: WidgetSize,
  newWidth: number,
  newHeight: number,
  containerWidth: number = 1200,
  maxHeight: number = 3
): WidgetSize => {
  const gridColumns = getResponsiveColumns(containerWidth);
  const clampedWidth = Math.max(1, Math.min(gridColumns, newWidth));
  const clampedHeight = Math.max(1, Math.min(maxHeight, newHeight));
  
  const validSizes: WidgetSize[] = ['1x1', '2x1', '3x1', '1x2', '2x2', '3x2', '1x3', '2x3', '3x3'];
  const newSize = `${clampedWidth}x${clampedHeight}` as WidgetSize;
  
  return validSizes.includes(newSize) ? newSize : currentSize;
};

// Additional helper for grid calculations
export const getCSSGridUnit = (containerWidth: number): number => {
  const columns = getResponsiveColumns(containerWidth);
  return (containerWidth - (GRID_GAP * (columns - 1))) / columns;
};