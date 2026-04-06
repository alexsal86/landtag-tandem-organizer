import { useCallback, useEffect, useRef, useState } from 'react';
import type { BlockElement, HeaderElement, ResizeHandle, TextElement } from '@/components/canvas-engine/types';
import { getElementDimensions } from '@/components/canvas-engine/utils/geometry';
import { alignElements, distributeElements, type AlignAxis, type DistributeAxis } from '@/components/canvas-engine/utils/align';

interface UseCanvasInteractionsOptions {
  elements: HeaderElement[];
  setElements: React.Dispatch<React.SetStateAction<HeaderElement[]>>;
  applyElements: (updater: (prev: HeaderElement[]) => HeaderElement[], options?: { recordHistory?: boolean }) => void;
  pushHistorySnapshot: (snapshot: HeaderElement[]) => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setSelectedElementId: (id: string | null) => void;
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectOne: (id: string | null) => void;
  setSelection: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  canvasMaxWidth: number;
  canvasMaxHeight: number;
  effectiveScaleX: number;
  effectiveScaleY: number;
  canvasPixelWidth: number;
  canvasPixelHeight: number;
  previewRef: React.RefObject<HTMLDivElement | null>;
  editingTextId: string | null;
  editingBlockId: string | null;
}

export const useCanvasInteractions = ({
  elements,
  setElements,
  applyElements,
  pushHistorySnapshot,
  selectedElementId,
  selectedElementIds,
  setSelectedElementId,
  setSelectedElementIds,
  selectOne,
  setSelection,
  toggleSelect,
  clearSelection,
  canvasMaxWidth,
  canvasMaxHeight,
  effectiveScaleX,
  effectiveScaleY,
  canvasPixelWidth,
  canvasPixelHeight,
  previewRef,
  editingTextId,
  editingBlockId,
}: UseCanvasInteractionsOptions) => {
  const SNAP_MM = 1.5;

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const [smartGuideDistance, setSmartGuideDistance] = useState<{ horizontal?: number; vertical?: number }>({});
  const [clipboardElement, setClipboardElement] = useState<HeaderElement | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    ow: number;
    oh: number;
    handle: ResizeHandle;
    group?: {
      baseWidth: number;
      baseHeight: number;
      left: number;
      top: number;
      right: number;
      bottom: number;
      items: Record<string, { x: number; y: number; width: number; height: number }>;
    };
  } | null>(null);

  const dragInitialElementsRef = useRef<HeaderElement[] | null>(null);
  const resizeInitialElementsRef = useRef<HeaderElement[] | null>(null);
  const snapLinesTimeoutRef = useRef<number | null>(null);
  const selectionInitialIdsRef = useRef<string[]>([]);

  const selectedElement = elements.find(el => el.id === selectedElementId);
  const isElementSelected = (id: string) => selectedElementIds.includes(id);
  const selectedCount = selectedElementIds.length;
  const isToggleModifierPressed = (event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => Boolean(event.shiftKey || event.metaKey || event.ctrlKey);

  const selectedIndex = selectedElement ? elements.findIndex((el) => el.id === selectedElement.id) : -1;
  const canMoveLayerBackward = selectedIndex > 0;
  const canMoveLayerForward = selectedIndex >= 0 && selectedIndex < elements.length - 1;
  const canAlignSelection = selectedElementIds.length > 1;
  const canDistributeSelection = selectedElementIds.length > 2;
  const canPasteFromClipboard = Boolean(clipboardElement);

  const updateElement = (id: string, updates: Partial<HeaderElement>, options?: { recordHistory?: boolean }) => {
    applyElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el), options);
  };

  const removeElement = (id: string) => {
    applyElements(prev => prev.filter(el => el.id !== id));
    setSelectedElementIds((previous) => previous.filter((selectedId) => selectedId !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const removeSelectedElements = () => {
    if (selectedElementIds.length === 0) return;
    applyElements((prev) => prev.filter((el) => !selectedElementIds.includes(el.id)));
    clearSelection();
  };

  const snapToOtherElements = (id: string, x: number, y: number, allElements: HeaderElement[]) => {
    const current = allElements.find((el) => el.id === id);
    if (!current) return { x, y, guides: {} as { x?: number; y?: number } };
    const { width: w, height: h } = getElementDimensions(current);

    const xTargets: number[] = [];
    const yTargets: number[] = [];
    for (const el of allElements) {
      if (el.id === id) continue;
      const { width: tw, height: th } = getElementDimensions(el);
      xTargets.push(el.x, el.x + tw, el.x + tw / 2);
      yTargets.push(el.y, el.y + th, el.y + th / 2);
    }
    xTargets.push(0, canvasMaxWidth / 2, canvasMaxWidth);
    yTargets.push(0, canvasMaxHeight / 2, canvasMaxHeight);

    let bestX: { delta: number; snapped: number; guide: number } | null = null;
    let bestY: { delta: number; snapped: number; guide: number } | null = null;

    for (const tx of xTargets) {
      const dLeft = Math.abs(x - tx);
      if (dLeft <= SNAP_MM && (!bestX || dLeft < bestX.delta)) bestX = { delta: dLeft, snapped: tx, guide: tx };
      const dRight = Math.abs(x + w - tx);
      if (dRight <= SNAP_MM && (!bestX || dRight < bestX.delta)) bestX = { delta: dRight, snapped: tx - w, guide: tx };
      const dCenter = Math.abs(x + w / 2 - tx);
      if (dCenter <= SNAP_MM && (!bestX || dCenter < bestX.delta)) bestX = { delta: dCenter, snapped: tx - w / 2, guide: tx };
    }

    for (const ty of yTargets) {
      const dTop = Math.abs(y - ty);
      if (dTop <= SNAP_MM && (!bestY || dTop < bestY.delta)) bestY = { delta: dTop, snapped: ty, guide: ty };
      const dBottom = Math.abs(y + h - ty);
      if (dBottom <= SNAP_MM && (!bestY || dBottom < bestY.delta)) bestY = { delta: dBottom, snapped: ty - h, guide: ty };
      const dCenter = Math.abs(y + h / 2 - ty);
      if (dCenter <= SNAP_MM && (!bestY || dCenter < bestY.delta)) bestY = { delta: dCenter, snapped: ty - h / 2, guide: ty };
    }

    const sx = bestX ? bestX.snapped : x;
    const sy = bestY ? bestY.snapped : y;
    const guides: { x?: number; y?: number } = {};
    if (bestX) guides.x = bestX.guide;
    if (bestY) guides.y = bestY.guide;

    return { x: Math.round(sx), y: Math.round(sy), guides };
  };

  useEffect(() => {
    return () => {
      if (snapLinesTimeoutRef.current) {
        window.clearTimeout(snapLinesTimeoutRef.current);
      }
    };
  }, []);

  const flashSnapLines = (guides: { x?: number; y?: number }) => {
    if (!guides.x && !guides.y) return;
    setSnapLines(guides);
    if (snapLinesTimeoutRef.current) {
      window.clearTimeout(snapLinesTimeoutRef.current);
    }
    snapLinesTimeoutRef.current = window.setTimeout(() => {
      setSnapLines({});
      snapLinesTimeoutRef.current = null;
    }, 600);
  };

  const calculateSmartGuideDistances = (movingId: string, x: number, y: number, allElements: HeaderElement[]) => {
    const moving = allElements.find((el) => el.id === movingId);
    if (!moving) {
      setSmartGuideDistance({});
      return;
    }
    const { width, height } = getElementDimensions(moving);
    const movingCenterX = x + width / 2;
    const movingCenterY = y + height / 2;

    let nearestHorizontal: number | undefined;
    let nearestVertical: number | undefined;

    allElements.forEach((el) => {
      if (el.id === movingId) return;
      const { width: w, height: h } = getElementDimensions(el);
      const centerX = el.x + w / 2;
      const centerY = el.y + h / 2;
      const dx = Math.abs(movingCenterX - centerX);
      const dy = Math.abs(movingCenterY - centerY);
      if (nearestHorizontal == null || dx < nearestHorizontal) nearestHorizontal = dx;
      if (nearestVertical == null || dy < nearestVertical) nearestVertical = dy;
    });

    setSmartGuideDistance({
      horizontal: nearestHorizontal != null ? Math.round(nearestHorizontal) : undefined,
      vertical: nearestVertical != null ? Math.round(nearestVertical) : undefined,
    });
  };

  const onElementMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    if (editingTextId === element.id || editingBlockId === element.id) return;
    event.stopPropagation();

    if (isToggleModifierPressed(event)) {
      toggleSelect(element.id);
      return;
    }

    const activeSelection = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
    const origins = activeSelection.reduce<Record<string, { x: number; y: number }>>((acc, id) => {
      const current = elements.find((el) => el.id === id);
      if (current) acc[id] = { x: current.x, y: current.y };
      return acc;
    }, {});

    setSelection(activeSelection);
    setDragId(element.id);
    dragInitialElementsRef.current = elements;
    setDragStart({ x: event.clientX, y: event.clientY, origins });
  };

  const onResizeMouseDown = (event: React.MouseEvent, element: HeaderElement, handle: ResizeHandle = 'se') => {
    event.stopPropagation(); event.preventDefault();
    setResizingId(element.id);
    resizeInitialElementsRef.current = elements;

    const activeIds = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
    if (activeIds.length > 1) {
      const selected = elements
        .filter((el) => activeIds.includes(el.id))
        .map((el) => {
          const { width, height } = getElementDimensions(el);
          return { ...el, width, height };
        });
      const left = Math.min(...selected.map((el) => el.x));
      const top = Math.min(...selected.map((el) => el.y));
      const right = Math.max(...selected.map((el) => el.x + el.width));
      const bottom = Math.max(...selected.map((el) => el.y + el.height));
      const items = selected.reduce<Record<string, { x: number; y: number; width: number; height: number }>>((acc, item) => {
        acc[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
        return acc;
      }, {});

      setResizeStart({
        x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30, handle,
        group: { baseWidth: Math.max(1, right - left), baseHeight: Math.max(1, bottom - top), left, top, right, bottom, items },
      });
      return;
    }

    setResizeStart({ x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30, handle });
  };

  const onPreviewMouseUp = () => {
    const dragInitialSnapshot = dragInitialElementsRef.current;
    const resizeInitialSnapshot = resizeInitialElementsRef.current;

    if (dragInitialSnapshot) {
      setElements((current) => {
        if (dragInitialSnapshot !== current) pushHistorySnapshot(dragInitialSnapshot);
        return current;
      });
    }

    if (resizeInitialSnapshot) {
      setElements((current) => {
        if (resizeInitialSnapshot !== current) pushHistorySnapshot(resizeInitialSnapshot);
        return current;
      });
    }

    dragInitialElementsRef.current = null;
    resizeInitialElementsRef.current = null;
    setDragId(null);
    setDragStart(null);
    setResizingId(null);
    setResizeStart(null);
    setSnapLines({});
    setSmartGuideDistance({});
    setSelectionBox(null);
  };

  useEffect(() => {
    if (!dragId && !resizingId) return;
    const handler = () => onPreviewMouseUp();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [dragId, resizingId]);

  const onPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    const rect = previewRef.current.getBoundingClientRect();
    const startX = Math.max(0, Math.min(canvasPixelWidth, event.clientX - rect.left));
    const startY = Math.max(0, Math.min(canvasPixelHeight, event.clientY - rect.top));

    const appendSelection = isToggleModifierPressed(event);
    selectionInitialIdsRef.current = appendSelection ? selectedElementIds : [];
    if (!appendSelection) {
      setSelectedElementId(null);
      setSelectedElementIds([]);
    }
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
  };

  const onPreviewMouseMove = (event: React.MouseEvent) => {
    if (selectionBox && previewRef.current) {
      const rect = previewRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(canvasPixelWidth, event.clientX - rect.left));
      const currentY = Math.max(0, Math.min(canvasPixelHeight, event.clientY - rect.top));
      const nextSelection = { ...selectionBox, currentX, currentY };
      setSelectionBox(nextSelection);

      const leftPx = Math.min(nextSelection.startX, nextSelection.currentX);
      const rightPx = Math.max(nextSelection.startX, nextSelection.currentX);
      const topPx = Math.min(nextSelection.startY, nextSelection.currentY);
      const bottomPx = Math.max(nextSelection.startY, nextSelection.currentY);

      const left = Math.max(0, Math.min(canvasMaxWidth, leftPx / effectiveScaleX));
      const right = Math.max(0, Math.min(canvasMaxWidth, rightPx / effectiveScaleX));
      const top = Math.max(0, Math.min(canvasMaxHeight, topPx / effectiveScaleY));
      const bottom = Math.max(0, Math.min(canvasMaxHeight, bottomPx / effectiveScaleY));

      const hits = elements
        .filter((element) => {
          const { width, height } = getElementDimensions(element);
          const elementLeft = element.x;
          const elementRight = element.x + width;
          const elementTop = element.y;
          const elementBottom = element.y + height;
          if (event.altKey) {
            return elementLeft >= left && elementRight <= right && elementTop >= top && elementBottom <= bottom;
          }
          return !(elementRight < left || elementLeft > right || elementBottom < top || elementTop > bottom);
        })
        .map((element) => element.id);

      const mergedSelection = Array.from(new Set([...selectionInitialIdsRef.current, ...hits]));
      setSelection(mergedSelection);
      return;
    }

    if (resizingId && resizeStart) {
      const resizingElement = elements.find((el) => el.id === resizingId);
      const dx = (event.clientX - resizeStart.x) / effectiveScaleX;
      const dy = (event.clientY - resizeStart.y) / effectiveScaleY;
      let newW = Math.max(5, resizeStart.ow + dx);
      let newH = Math.max(5, resizeStart.oh + dy);
      let shiftX = 0;
      let shiftY = 0;

      if (resizeStart.handle.includes('w')) { newW = Math.max(5, resizeStart.ow - dx); shiftX = resizeStart.ow - newW; }
      if (resizeStart.handle.includes('n')) { newH = Math.max(5, resizeStart.oh - dy); shiftY = resizeStart.oh - newH; }
      if (resizeStart.handle === 'n' || resizeStart.handle === 's') newW = resizeStart.ow;
      if (resizeStart.handle === 'e' || resizeStart.handle === 'w') newH = resizeStart.oh;

      const preserveAspect = Boolean(event.ctrlKey || (resizingElement?.type === 'image' && resizingElement.preserveAspectRatio));
      if (preserveAspect && resizeStart.ow > 0 && resizeStart.oh > 0) {
        const ratio = resizeStart.ow / resizeStart.oh;
        if (resizeStart.handle === 'n' || resizeStart.handle === 's') newW = newH * ratio;
        else newH = newW / ratio;
      }

      if (resizeStart.group) {
        const nextLeft = resizeStart.handle.includes('w') ? resizeStart.group.left + dx : resizeStart.group.left;
        const nextTop = resizeStart.handle.includes('n') ? resizeStart.group.top + dy : resizeStart.group.top;
        const nextRight = resizeStart.handle.includes('e') ? resizeStart.group.right + dx : resizeStart.group.right;
        const nextBottom = resizeStart.handle.includes('s') ? resizeStart.group.bottom + dy : resizeStart.group.bottom;

        let groupWidth = Math.max(5, nextRight - nextLeft);
        let groupHeight = Math.max(5, nextBottom - nextTop);
        if (preserveAspect) {
          const groupRatio = resizeStart.group.baseWidth / resizeStart.group.baseHeight;
          if (resizeStart.handle === 'n' || resizeStart.handle === 's') groupWidth = groupHeight * groupRatio;
          else groupHeight = groupWidth / groupRatio;
        }

        const scaleX = groupWidth / resizeStart.group.baseWidth;
        const scaleY = groupHeight / resizeStart.group.baseHeight;
        const originX = resizeStart.handle.includes('w') ? resizeStart.group.right - groupWidth : resizeStart.group.left;
        const originY = resizeStart.handle.includes('n') ? resizeStart.group.bottom - groupHeight : resizeStart.group.top;

        applyElements((prev) => prev.map((el) => {
          const source = resizeStart.group?.items[el.id];
          if (!source) return el;
          const relativeX = source.x - resizeStart.group!.left;
          const relativeY = source.y - resizeStart.group!.top;
          return {
            ...el,
            x: Math.max(0, Math.min(canvasMaxWidth, Math.round(originX + relativeX * scaleX))),
            y: Math.max(0, Math.min(canvasMaxHeight, Math.round(originY + relativeY * scaleY))),
            width: Math.max(5, Math.round(source.width * scaleX)),
            height: Math.max(5, Math.round(source.height * scaleY)),
          };
        }), { recordHistory: false });
        return;
      }

      updateElement(resizingId, {
        x: resizingElement ? Math.max(0, Math.min(canvasMaxWidth, Math.round(resizingElement.x + shiftX))) : undefined,
        y: resizingElement ? Math.max(0, Math.min(canvasMaxHeight, Math.round(resizingElement.y + shiftY))) : undefined,
        width: Math.round(newW),
        height: Math.round(newH),
      }, { recordHistory: false });
      return;
    }

    if (!dragId || !dragStart) return;
    const dx = (event.clientX - dragStart.x) / effectiveScaleX;
    const dy = (event.clientY - dragStart.y) / effectiveScaleY;
    const origin = dragStart.origins[dragId];
    if (!origin) return;
    const nx = Math.max(0, Math.min(canvasMaxWidth, origin.x + dx));
    const ny = Math.max(0, Math.min(canvasMaxHeight, origin.y + dy));
    const snapped = snapToOtherElements(dragId, nx, ny, elements);
    flashSnapLines(snapped.guides);
    calculateSmartGuideDistances(dragId, snapped.x, snapped.y, elements);
    const offsetX = snapped.x - origin.x;
    const offsetY = snapped.y - origin.y;

    applyElements((prev) => prev.map((el) => {
      const selectedOrigin = dragStart.origins[el.id];
      if (!selectedOrigin) return el;
      return {
        ...el,
        x: Math.max(0, Math.min(canvasMaxWidth, Math.round(selectedOrigin.x + offsetX))),
        y: Math.max(0, Math.min(canvasMaxHeight, Math.round(selectedOrigin.y + offsetY))),
      };
    }), { recordHistory: false });
  };

  const cycleSelection = (direction: 1 | -1) => {
    if (elements.length === 0) return;
    const currentIndex = elements.findIndex((el) => el.id === selectedElementId);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (startIndex + direction + elements.length) % elements.length;
    selectOne(elements[nextIndex].id);
  };

  const moveElementLayer = (id: string, direction: 1 | -1) => {
    applyElements((prev) => {
      const index = prev.findIndex((el) => el.id === id);
      if (index < 0) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const copySelectedElement = () => {
    if (!selectedElement) return;
    setClipboardElement({ ...selectedElement });
  };

  const pasteClipboardElement = () => {
    if (!clipboardElement) return;
    const source = clipboardElement;
    const nextX = Math.max(0, Math.min(canvasMaxWidth, source.x + 10));
    const nextY = Math.max(0, Math.min(canvasMaxHeight, source.y + 10));
    const pasted: HeaderElement = { ...source, id: crypto.randomUUID(), x: nextX, y: nextY };
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
    setClipboardElement(pasted);
  };

  const duplicateSelectedElement = () => {
    if (!selectedElement) return;
    const source = selectedElement;
    const pasted: HeaderElement = {
      ...source,
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(canvasMaxWidth, source.x + 10)),
      y: Math.max(0, Math.min(canvasMaxHeight, source.y + 10)),
    };
    setClipboardElement({ ...source });
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
  };

  const alignSelection = (axis: AlignAxis) => {
    applyElements((prev) => alignElements(prev, axis, { selectedElementIds, headerMaxWidth: canvasMaxWidth, headerMaxHeight: canvasMaxHeight }));
  };

  const distributeSelection = (axis: DistributeAxis) => {
    applyElements((prev) => distributeElements(prev, axis, { selectedElementIds, headerMaxWidth: canvasMaxWidth, headerMaxHeight: canvasMaxHeight }));
  };

  const validatePosition = (value: number, max: number) => Math.max(0, Math.min(value, max));

  return {
    dragId,
    selectionBox,
    snapLines,
    smartGuideDistance,
    resizingId,
    selectedElement,
    isElementSelected,
    selectedCount,
    isToggleModifierPressed,
    canMoveLayerBackward,
    canMoveLayerForward,
    canAlignSelection,
    canDistributeSelection,
    canPasteFromClipboard,
    updateElement,
    removeElement,
    removeSelectedElements,
    onElementMouseDown,
    onResizeMouseDown,
    onPreviewMouseDown,
    onPreviewMouseMove,
    onPreviewMouseUp,
    cycleSelection,
    moveElementLayer,
    copySelectedElement,
    pasteClipboardElement,
    duplicateSelectedElement,
    alignSelection,
    distributeSelection,
    validatePosition,
  };
};
