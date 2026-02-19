import type { HeaderElement } from '../types';
import { getElementDimensions } from './geometry';

export type AlignAxis = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

interface AlignOptions {
  selectedElementIds: string[];
  headerMaxWidth: number;
  headerMaxHeight: number;
}

export const alignElements = (
  elements: HeaderElement[],
  axis: AlignAxis,
  options: AlignOptions,
): HeaderElement[] => {
  const { selectedElementIds, headerMaxWidth, headerMaxHeight } = options;
  if (selectedElementIds.length < 2) return elements;
  const selected = elements.filter((el) => selectedElementIds.includes(el.id));
  if (selected.length < 2) return elements;

  const bounds = selected.reduce((acc, element) => {
    const { width, height } = getElementDimensions(element);
    return {
      left: Math.min(acc.left, element.x),
      top: Math.min(acc.top, element.y),
      right: Math.max(acc.right, element.x + width),
      bottom: Math.max(acc.bottom, element.y + height),
    };
  }, { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });

  const centerX = (bounds.left + bounds.right) / 2;
  const middleY = (bounds.top + bounds.bottom) / 2;

  return elements.map((element) => {
    if (!selectedElementIds.includes(element.id)) return element;
    const { width, height } = getElementDimensions(element);
    let x = element.x;
    let y = element.y;

    if (axis === 'left') x = bounds.left;
    if (axis === 'center') x = centerX - width / 2;
    if (axis === 'right') x = bounds.right - width;
    if (axis === 'top') y = bounds.top;
    if (axis === 'middle') y = middleY - height / 2;
    if (axis === 'bottom') y = bounds.bottom - height;

    return {
      ...element,
      x: Math.max(0, Math.min(headerMaxWidth, Math.round(x))),
      y: Math.max(0, Math.min(headerMaxHeight, Math.round(y))),
    };
  });
};

export const distributeElements = (
  elements: HeaderElement[],
  axis: DistributeAxis,
  options: AlignOptions,
): HeaderElement[] => {
  const { selectedElementIds, headerMaxWidth, headerMaxHeight } = options;
  if (selectedElementIds.length < 3) return elements;

  const selected = elements
    .filter((el) => selectedElementIds.includes(el.id))
    .map((element) => ({ ...element, ...getElementDimensions(element) }));
  if (selected.length < 3) return elements;

  const sorted = [...selected].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const startPos = axis === 'horizontal' ? first.x : first.y;
  const endPos = axis === 'horizontal' ? last.x + last.width : last.y + last.height;
  const totalSize = sorted.reduce((sum, item) => sum + (axis === 'horizontal' ? item.width : item.height), 0);
  const totalGap = endPos - startPos - totalSize;
  if (totalGap <= 0) return elements;

  const gap = totalGap / (sorted.length - 1);
  let cursor = startPos;
  const positions = new Map<string, number>();

  sorted.forEach((item) => {
    positions.set(item.id, cursor);
    cursor += (axis === 'horizontal' ? item.width : item.height) + gap;
  });

  return elements.map((element) => {
    const nextPos = positions.get(element.id);
    if (nextPos == null) return element;
    return {
      ...element,
      x: axis === 'horizontal' ? Math.max(0, Math.min(headerMaxWidth, Math.round(nextPos))) : element.x,
      y: axis === 'vertical' ? Math.max(0, Math.min(headerMaxHeight, Math.round(nextPos))) : element.y,
    };
  });
};
