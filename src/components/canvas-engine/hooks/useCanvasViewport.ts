import { useState } from 'react';

interface ViewportOptions {
  previewWidth: number;
  previewHeight: number;
}

export const useCanvasViewport = ({ previewWidth, previewHeight }: ViewportOptions) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const getCanvasPoint = (previewElement: HTMLDivElement | null, clientX: number, clientY: number) => {
    if (!previewElement) return { x: 0, y: 0 };
    const rect = previewElement.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return {
      x: Math.max(0, Math.min(previewWidth, x)),
      y: Math.max(0, Math.min(previewHeight, y)),
    };
  };

  const getViewportPoint = (previewElement: HTMLDivElement | null, clientX: number, clientY: number) => {
    if (!previewElement) return { x: 0, y: 0 };
    const rect = previewElement.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(previewWidth, clientX - rect.left)),
      y: Math.max(0, Math.min(previewHeight, clientY - rect.top)),
    };
  };

  const zoomAtPoint = (previewElement: HTMLDivElement | null, clientX: number, clientY: number, nextZoom: number) => {
    if (!previewElement) return;
    const clampedZoom = Math.max(0.5, Math.min(3, nextZoom));
    const rect = previewElement.getBoundingClientRect();
    const cursorX = clientX - rect.left;
    const cursorY = clientY - rect.top;
    const baseX = (cursorX - pan.x) / zoom;
    const baseY = (cursorY - pan.y) / zoom;
    setZoom(clampedZoom);
    setPan({
      x: cursorX - baseX * clampedZoom,
      y: cursorY - baseY * clampedZoom,
    });
  };

  return {
    zoom,
    setZoom,
    pan,
    setPan,
    getCanvasPoint,
    getViewportPoint,
    zoomAtPoint,
  };
};
