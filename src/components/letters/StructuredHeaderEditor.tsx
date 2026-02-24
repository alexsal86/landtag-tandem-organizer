import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Type, Image as ImageIcon, GripVertical, Upload, Plus, FolderOpen, Square, Circle, Minus, LayoutGrid, Keyboard, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import type { BlockElement, HeaderElement, ImageElement, ResizeHandle, ShapeElement, ShapeType, TextElement } from '@/components/canvas-engine/types';
import { getElementDimensions } from '@/components/canvas-engine/utils/geometry';
import { alignElements, distributeElements, type AlignAxis, type DistributeAxis } from '@/components/canvas-engine/utils/align';
import { useCanvasHistory } from '@/components/canvas-engine/hooks/useCanvasHistory';
import { useCanvasSelection } from '@/components/canvas-engine/hooks/useCanvasSelection';
import { getElementIconFromRegistry, getElementLabelFromRegistry } from '@/components/letters/elements/registry';
import { ImageCanvasElement, TextCanvasElement } from '@/components/letters/elements/canvasElements';
import { CSS_PX_PER_MM } from '@/lib/units';
import { CanvasToolbar } from '@/components/letters/CanvasToolbar';
import type { LetterLayoutSettings } from '@/types/letterLayout';

interface GalleryImage {
  name: string;
  path: string;
  blobUrl: string;
}

interface StructuredHeaderEditorProps {
  initialElements?: HeaderElement[];
  onElementsChange: (elements: HeaderElement[]) => void;
  actionButtons?: React.ReactNode;
  layoutSettings?: LetterLayoutSettings;
  canvasWidthMm?: number;
  canvasHeightMm?: number;
}

const createElementId = () => crypto.randomUUID();

const getShapeFillColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.fillColor ?? element.color ?? fallback) : fallback;

const getShapeStrokeColor = (element: HeaderElement, fallback = '#000000') =>
  element.type === 'shape' ? (element.strokeColor ?? element.color ?? fallback) : fallback;

// Sunflower SVG inline component
const SunflowerSVG: React.FC<{ width: number; height: number; className?: string }> = ({ width, height, className }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 438.44 440.44"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <g id="XMLID_1_">
      <g>
        <path fill="#FAE301" d="M438.19,192.22c-1.19,4.48-6.5,4.84-5,12c-7.66,9-20.101,13.23-29.99,20
          c6.67,11.32,21.85,14.141,26.99,26.99c-9.87,14.8-30.101,19.23-52.99,21c8.72,14.95,31.729,24.26,33,50
          c-28.34,18.14-64.04-4.79-85.99-15c2.73,22.271,17.36,41.29,18.99,67.99c-33.95-2.37-42.78-29.88-64.99-44
          c4.32,10.2,11.41,26.26,10,47c-0.79,11.569-7.28,43.109-14,43.99c-4.15,0.55-14.93-17.16-18-20.99
          c-6.9-8.641-11.95-13.44-16.99-21c-4.81,16.859-8.68,34.649-17,47.99c-7.76,1.239-9.93,8.069-15,12
          c-8.91-21.41-13.42-47.24-20-70.99c-5.18,9.26-12.32,18.819-18.99,28c-6.25,8.58-11.15,20.55-22,21.99
          c2.05-19.391,4.7-41.99,3-61.99c-10.52,9.149-22.62,25.37-37,34c-3.54,0.54-2.46-3.54-6-3c-2.16-21.96-5.51-45.66,4-61.99
          c-17.62,11.37-33.94,24.05-58.99,27.99c-0.57-7.04,5.84-15.38,8-23c-0.35-3.311-5.76-1.57-9-2c3.7-25.63,20.74-37.92,31-56.99
          c-24.29-3.71-54.67-1.32-70.99-13c3.79-5.53,11.53-7.13,16.99-11c-7.76-8.229-18.7-13.29-26.99-20.99
          c9.26-6.319,19.59-7.2,28.99-12c13.79-7.04,26.64-13.57,48-14c-27.98-7.35-48.65-22.01-58-47.99c4.23-4.11,14.35-2.32,20-5
          c-4.93-9.79-14.28-20.31-16-30c7,0,12.31-1.69,20-1c-1.21-3.79-1.93-8.06-4-11c17.83-2.82,35.45,3.21,51.99,5
          c-8.27-19.05-19.88-34.77-26.99-54.99c24.72,0.28,41.43,8.56,55.99,19c-0.3-20.69,4.41-43.98,11-61c8.62,5.38,14.72,13.28,23,19
          c2.74-9.92,5-20.33,5-32.99c22.91,14.41,44.17,30.48,50.99,60.99c6.41-31.25,29.82-45.5,51.99-60.99c7.65,14.2,9.75,33.98,8,54.99
          c15.43-12.23,26.75-28.58,51-32c3.01,11.13-1.78,22.81-1,35c13.71-5.65,24.24-19.7,37.99-22c0.63,35.96-13.66,57-29.99,75.99
          c27.03-3.96,52.23-9.76,73.99-19c-7.15,33.85-21.891,60.11-55,68C383.41,159.51,418.31,171.48,438.19,192.22z"/>
      </g>
    </g>
    <path fill="#76A837" d="M279.21,160.23c5.41,14.66,18.65-3.82,28,0c-2.08,6.25-10.27,6.4-15,9.99c8.08,2.74,19.04-0.28,27-1
      c-7.47,6.2-17.81,9.53-21,20c9.49,3.47,21.47-4.51,31-1c-4.14,9.38-24.21-1.72-29,8c0.37,4.63,3.12,6.87,6,9
      c-0.85,3.16-5.16,2.84-6,6c4.19,5.14,15.73,2.93,19,9c-8.18,0.15-16.31,0.36-21,4c-1.81,12.471,6.46,14.87,11,20.99
      c-1.84,2.42-5.9-1.37-10,0c5.14,10.25,19.64,16.29,21,27c-11.46,0.58-14.53-15.32-25-19c-2.49-0.15-3.1,1.58-5,2
      c-0.32,6.99,4.32,9.021,4,16c-4.78-0.89-7.38-3.95-11-6c-15.71,12.31,16.69,25.13,11,37c-8.62-4.72-10.59-16.08-18-22
      c-2.8,5.49,1.91,12.07,2,18c-5.41-3.26-7.76-9.57-14-12c-2.97,7.32,1.19,16.13,1,24c-6.94-3.84-10.96-18.88-19.99-17
      c-10.489,2.18-3.47,21.06-5,31c-5.58-4.76-7.1-13.58-8-23c-3.77,1.9-3.739,7.59-5,12c-6.3-4.85-4.989-14.66-13-16
      c-9.52-1.6-14.05,9.22-19,17c-0.4-15.8-13.38-26.7-23-12c-2.39-4.28-0.19-18.2-6.99-21c-7.95,1.72-11.12,8.21-16,13
      c-0.32-4.68,6.94-14.57,3-23c-1.71,0.05-2.59-0.74-3-2c-5.58,1.61-10.34,8.75-16,7c1.09-5.24,4.45-8.21,6-13
      c-12.7-1.64-20.96,14.98-33,14c5.92-11.41,22.76-11.91,31-21c-2.38-2.62-7.51-2.49-11-4c0.13-4.2,3.87-4.79,4-9
      c-3.87-3.46-14.91,0.25-18-3.99c1.76-3.91,9.46-1.88,13-4c-1.73-3.609-7.22-3.45-8-8c4.67-0.33,7.86-2.149,10-5
      c-2.54-13.13-16.25-15.08-28-19c10.41-3.59,27.12-0.88,30-12c-3.39-9.28-17.38-7.95-23-15c7.83-1.67,16.46,4.09,24,6
      c-0.89-5.11-6.74-5.26-7-11c11.85,7.42,24.24-3.18,22-14.99c19.67-0.15,1.43-17.35-3-25c8.39,1.42,10.44,11.88,18,13
      c11.45,1.69,19.32-11.2,21.99-23c5.5,4.37,14.98,11.87,23,5c-0.4-7.37-3.68-15.71-1-23c5.9,3.77,3.09,16.24,8,21
      c4.11-0.23,6.18-2.48,8-5c4.16,19.41,22.79,2.25,29.99,0c-1.33,3-1.01,7.65-1,12c10.62,11.15,17.96-7.21,26-11
      c2.95,9.73-15.6,26.78-1,33c8.45-3.55,14.88-9.12,22-14C293.87,145.56,283.91,152.92,279.21,160.23z"/>
  </svg>
);

const LionSVG: React.FC<{ width: number; height: number; className?: string }> = ({ width, height, className }) => (
  <svg width={width} height={height} viewBox="0 0 151.80499 62.099997" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fill="#ffffff" d="m 33.4,5.7999996 c 0.7,2.3 4.1,1.7 4.2,-0.8 -1.3,-0.2 -3,0 -4.2,0.8 z"/>
    <path fill="#000000" d="m 28.5,17.5 c 1.2,-0.4 1.3,-1.4 1,-2 -2.3,0.6 -5,1.3 -8.6,0.8 C 17,15.9 16.2,13.8 16.2,12.4 H 16.1 L 16,12.3 v 0.2 c -0.1,0.1 -0.2,0.3 -0.2,0.4 -1,2.2 0,4.9 4.2,5.3 4.5,0.5 7.4,-0.4 8.5,-0.7 z"/>
    <path fill="#000000" d="m 150,48.200003 c -1.4,-1.4 -3,-2.6 -4.5,-3.5 -2.5,-1.5 -4.6,-2.4 -4.6,-2.4 C 140.7,39.6 139.4,35.3 137.7,31.3 c -1,-2.3 -2.2,-4.5 -3.5,-6.1 l 0.3,0.3 c 4.1,-1 7.1,-5.3 6.8,-10.2 -0.4,-6.1 -6.1,-12.5 -19.7,-9.8000004 -5,1 -9,2.4 -12.9,4.0000004 -4,1.7 -7.9,3.5 -12.499996,5.1 C 91.500004,16.2 87.6,17 84.5,16.7 81.7,16.5 79.6,15.4 78.4,13.6 76.7,11.1 79.2,8.4999996 80.2,7.7999996 82.1,6.5999996 83.8,4.5 82.8,1 c -1.8,0.3 -5,1.4 -7.6,3.4 -2.1,1.5999996 -3.8,3.8999996 -3.8,7 0.1,4.2 3,7.5 7.8,8.6 3.2,0.7 5.8,1 8.8,0.6 4.300004,-0.6 9.700004,-2.5 19.3,-6.1 9,-3.4 14,-4.9 17.9,-5.1 2.5,-0.1 4.4,0.2 6.6,1 1.4,0.5 2.3,1.3 3,2.1 0.8,1 1,2.2 1,3.3 -0.2,2.1 -1.7,4.1 -4,4.6 h -1.7 c -0.7,-0.1 -1.5,-0.2 -2.4,-0.4 -2.6,-0.5 -6.1,-1.1 -11.6,-0.5 -3.3,0.3 -7.3,1.1 -12.2,2.7 C 93.700004,25.5 86,26.8 80.1,27 71.7,27.3 66.8,25.4 63,23.9 62.6,20.2 61.8,17.2 60.7,14.8 59,10.9 56.7,8.3999996 55.2,7.0999996 c 0,0 0.9,-0.5 1.3,-3.4999996 -2.2,-0.4 -5.2,0.8 -5.2,0.8 0,0 -5.6,-3.6 -13.2,-2.3 C 35.2,2.6 33.8,3.4 33,4.7 26.9,6.8999996 26.4,7.2999996 24.9,8.1999996 24,8.8999996 24,9.4 24,9.9 c 0,0.5 0.3,0.8 0.4,0.9 0.2,0.2 0.3,0.4 0.3,0.7 0.1,1.7 0.1,2.3 0.6,3.7 0.2,0.6 0.8,0.5 1.4,0.3 4,-1.5 5.7,0.4 5.7,2.1 0,1.5 -0.8,2.9 -3.7,3.1 h -1.3 c -0.4,0 -0.7,0 -0.7,0.6 0,0.4 0.9,2.7 1,3.1 0.4,1.2 0.7,1.4 1.7,1.4 1.9,0 4.4,-0.5 5.2,-0.7 0,0 -0.1,2.5 0.7,5.8 -6.7,-2.5 -11.8,-3.2 -17.5,-3 -5.6,0.2 -9.4,1.4 -11.9,2.8 -4.5,2.5 -4.9,5.7 -4.9,5.7 0,0 6.5,1.5 9.2,0.8 1.8,-0.6 3,-2.3 3,-2.3 0,0 4.3,0.9 9.9,3.9 2.8,1.5 6,3.500003 9.2,6.300003 0.1,0 7.5,-2.9 7.8,-3 0.2,-0.1 0.4,-0.1 0.6,0.2 0.2,0.2 0.1,0.5 -0.1,0.6 -0.7,0.6 -5.2,3.6 -9.8,6.3 -3,1.8 -6.2,3.7 -9,5.4 -2.2,-0.3 -3.2,-0.3 -5.2,-0.3 -4.4,0.1 -7.3,3.9 -7.3,6.7 h 17 c 0.7,-0.2 7.8,-1.7 15,-3.1 5.2,-1 10.4,-2 13.3,-2.6 1.3,-0.2 1.9,-0.4 2.2,-0.4 0.5,-0.1 0.9,-0.2 1.4,-0.6 0.2,-0.2 0.4,-0.5 0.6,-1 0.1,-0.4 0.7,-2.1 0.7,-2.1 l 3.7,-0.4 c 4.9,-0.4 9.3,-1.4 13.3,-2.7 5.1,-1.6 9.5,-3.7 13.3,-5.5 C 94.500004,40.4 98.400004,38.5 101.7,38.4 c -0.5,3.300003 0.3,5.900003 0.8,8.400003 0.5,2.4 0.8,4.8 -0.5,7.7 -9.899996,0 -8.799996,6.6 -8.799996,6.6 H 110.3 c 0,0 1.2,-3.8 4,-8.2 1.4,-2.1 3.2,-4.4 5.4,-6.4 0.4,-0.4 0.3,-0.8 0.1,-1.1 -1.9,-2.4 -2.9,-6.900003 -3.1,-7.800003 v -0.2 c 0,-0.2 0,-0.5 0.3,-0.5 0.3,-0.1 0.5,0 0.5,0.2 0.1,0.1 0.1,0.2 0.1,0.3 0,0.2 0.2,0.4 0.2,0.6 0.1,0.4 0.4,1 0.8,1.7 0.8,1.400003 1.9,3.000003 3.6,4.600003 2.2,2.1 5,3.7 7.7,5 3.3,1.5 6.6,2.6 9,3.3 2.8,0.8 3.1,1.7 3.1,2 h -1.2 c -1.4,0.2 -3,0.3 -4.9,2.1 -1.9,1.8 -1.5,4.3 -1.5,4.3 h 11.8 c 1.5,0 2.1,-0.9 2.6,-2.6 0.3,-1.1 1.7,-6.7 1.8,-7.1 0.5,-1.7 0,-2.6 -0.6,-3.1 z M 34.4,6.7999996 c 1.2,-0.8 2.9,-1 4.2,-0.8 -0.1,2.5 -3.5,3.1000004 -4.2,0.8 z"/>
  </svg>
);

const WappenSVG: React.FC<{ width: number; height: number; className?: string }> = ({ width, height, className }) => (
  <img src="/assets/wappen-bw.svg" width={width} height={height} className={className} alt="Landeswappen Baden-Württemberg" style={{ objectFit: 'contain' }} />
);

export const StructuredHeaderEditor: React.FC<StructuredHeaderEditorProps> = ({ initialElements = [], onElementsChange, actionButtons, layoutSettings, canvasWidthMm, canvasHeightMm }) => {
  const { toast } = useToast();
  const { currentTenant } = useTenant();
  const {
    elements,
    setElements,
    applyElements,
    pushHistorySnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvasHistory<HeaderElement>(initialElements);
  const {
    selectedElementId,
    setSelectedElementId,
    selectedElementIds,
    setSelectedElementIds,
    selectOne,
    setSelection,
    toggleSelect,
    clearSelection,
  } = useCanvasSelection();
  const [showRuler, setShowRuler] = useState(false);
  const [showCenterGuides, setShowCenterGuides] = useState(false);
  const [showMargins, setShowMargins] = useState(true);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const [smartGuideDistance, setSmartGuideDistance] = useState<{ horizontal?: number; vertical?: number }>({});
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [clipboardElement, setClipboardElement] = useState<HeaderElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editorDrafts, setEditorDrafts] = useState<Record<string, string>>({});
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origins: Record<string, { x: number; y: number }> } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const dragInitialElementsRef = useRef<HeaderElement[] | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const snapLinesTimeoutRef = useRef<number | null>(null);
  const lastReportedRef = useRef<HeaderElement[]>(initialElements);
  const selectionInitialIdsRef = useRef<string[]>([]);

  // Resize state
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
  const resizeInitialElementsRef = useRef<HeaderElement[] | null>(null);

  // Image gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);

  // Blob URL mapping
  const blobUrlMapRef = useRef<Map<string, string>>(new Map());

  const canvasMaxWidth = canvasWidthMm ?? 210;
  const canvasMaxHeight = canvasHeightMm ?? 45;
  const previewWidth = canvasMaxWidth * CSS_PX_PER_MM;
  const previewHeight = canvasMaxHeight * CSS_PX_PER_MM;
  const previewScaleX = CSS_PX_PER_MM;
  const previewScaleY = CSS_PX_PER_MM;
  const SNAP_MM = 1.5;

  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const [zoomLevel, setZoomLevel] = useState(1);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_STEPS.indexOf(z);
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => {
      const idx = ZOOM_STEPS.indexOf(z);
      return idx > 0 ? ZOOM_STEPS[idx - 1] : z;
    });
  }, []);

  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);

  // Native wheel listener for Ctrl+Scroll zoom with cursor-centered scrolling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const container = el;
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left + container.scrollLeft;
      const cursorY = e.clientY - rect.top + container.scrollTop;

      const currentScale = previewScaleX * zoomLevelRef.current;
      const mmX = (cursorX - 28) / currentScale;
      const mmY = (cursorY - 28) / currentScale;

      const currentIdx = ZOOM_STEPS.indexOf(zoomLevelRef.current);
      const nextZoom = e.deltaY < 0
        ? (currentIdx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[currentIdx + 1] : zoomLevelRef.current)
        : (currentIdx > 0 ? ZOOM_STEPS[currentIdx - 1] : zoomLevelRef.current);

      if (nextZoom === zoomLevelRef.current) return;
      setZoomLevel(nextZoom);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newScale = previewScaleX * nextZoom;
          const newCursorX = mmX * newScale + 28;
          const newCursorY = mmY * newScale + 28;
          container.scrollLeft = newCursorX - (e.clientX - rect.left);
          container.scrollTop = newCursorY - (e.clientY - rect.top);
        });
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Effective scale includes zoom — drives canvas size, rulers, element positions
  const canvasPixelWidth = previewWidth * zoomLevel;
  const canvasPixelHeight = previewHeight * zoomLevel;
  const effectiveScaleX = previewScaleX * zoomLevel;
  const effectiveScaleY = previewScaleY * zoomLevel;

  const marginGuides = [
    { key: 'left', orientation: 'vertical' as const, pos: (layoutSettings?.margins.left ?? 25) * effectiveScaleX, label: 'Links', color: '#2563eb' },
    { key: 'right', orientation: 'vertical' as const, pos: (canvasMaxWidth - (layoutSettings?.margins.right ?? 20)) * effectiveScaleX, label: 'Rechts', color: '#2563eb' },
    { key: 'top', orientation: 'horizontal' as const, pos: (layoutSettings?.margins.top ?? 45) * effectiveScaleY, label: 'Oben', color: '#16a34a' },
    { key: 'bottom', orientation: 'horizontal' as const, pos: (canvasMaxHeight - (layoutSettings?.margins.bottom ?? 25)) * effectiveScaleY, label: 'Unten', color: '#16a34a' },
  ].filter((guide) => {
    if (guide.orientation === 'vertical') return guide.pos >= 0 && guide.pos <= canvasPixelWidth;
    return guide.pos >= 0 && guide.pos <= canvasPixelHeight;
  });

  useEffect(() => {
    if (!showRuler) return;

    const hCanvas = horizontalRulerRef.current;
    const vCanvas = verticalRulerRef.current;
    if (!hCanvas || !vCanvas) return;

    const hCtx = hCanvas.getContext('2d');
    const vCtx = vCanvas.getContext('2d');
    if (!hCtx || !vCtx) return;

    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    hCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    for (let i = 0; i <= 210; i += 1) {
      const x = (i * canvasPixelWidth) / 210;
      const tickHeight = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      hCtx.beginPath();
      hCtx.moveTo(x, hCanvas.height);
      hCtx.lineTo(x, hCanvas.height - tickHeight);
      hCtx.stroke();
    }

    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);
    vCtx.strokeStyle = 'rgba(100, 116, 139, 0.8)';
    for (let i = 0; i <= 45; i += 1) {
      const y = (i * canvasPixelHeight) / 45;
      const tickWidth = i % 10 === 0 ? 12 : i % 5 === 0 ? 8 : 5;
      vCtx.beginPath();
      vCtx.moveTo(vCanvas.width, y);
      vCtx.lineTo(vCanvas.width - tickWidth, y);
      vCtx.stroke();
    }
  }, [canvasPixelWidth, canvasPixelHeight, showRuler]);

  // Resolve blob URL
  const resolveBlobUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const cached = blobUrlMapRef.current.get(storagePath);
    if (cached) return cached;
    try {
      const { data } = supabase.storage.from('letter-assets').getPublicUrl(storagePath);
      if (!data?.publicUrl) return null;
      blobUrlMapRef.current.set(storagePath, data.publicUrl);
      return data.publicUrl;
    } catch { return null; }
  }, []);

  useEffect(() => {
    const resolveAll = async () => {
      const updated = await Promise.all(elements.map(async (el) => {
        if (el.type !== 'image' || !el.storagePath || el.blobUrl) return el;
        const blobUrl = await resolveBlobUrl(el.storagePath);
        if (!blobUrl) return el;
        return { ...el, blobUrl };
      }));
      const changed = updated.some((el, idx) => el !== elements[idx]);
      if (changed) setElements(updated);
    };
    resolveAll();
  }, []);

  const loadGalleryImages = useCallback(async () => {
    if (!currentTenant?.id) return;
    setGalleryLoading(true);
    try {
      const folderPath = `${currentTenant.id}/header-images`;
      const { data: files, error } = await supabase.storage.from('letter-assets').list(folderPath);
      if (error) return;
      const imageFiles = (files || []).filter(f => f.name && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name));
      const loaded: GalleryImage[] = [];
      for (const file of imageFiles) {
        const filePath = `${folderPath}/${file.name}`;
        try {
          const { data: urlData } = supabase.storage.from('letter-assets').getPublicUrl(filePath);
          if (!urlData?.publicUrl) continue;
          blobUrlMapRef.current.set(filePath, urlData.publicUrl);
          loaded.push({ name: file.name, path: filePath, blobUrl: urlData.publicUrl });
        } catch (e) { console.error('Error downloading', file.name, e); }
      }
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return loaded;
      });
    } catch (error) { console.error('Error loading gallery:', error); }
    finally { setGalleryLoading(false); }
  }, [currentTenant?.id]);

  useEffect(() => {
    loadGalleryImages();
    return () => {
      setGalleryImages((previous) => {
        previous.forEach((img) => URL.revokeObjectURL(img.blobUrl));
        return [];
      });
      blobUrlMapRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlMapRef.current.clear();
    };
  }, [currentTenant?.id, loadGalleryImages]);

  const snapToOtherElements = (id: string, x: number, y: number, allElements: HeaderElement[]) => {
    const current = allElements.find((el) => el.id === id);
    if (!current) return { x, y, guides: {} as { x?: number; y?: number } };
    let sx = x, sy = y;
    const { width: w, height: h } = getElementDimensions(current);
    const guides: { x?: number; y?: number } = {};
    const edgeTargets = allElements.filter((el) => el.id !== id).flatMap((el) => {
      const { width: tw, height: th } = getElementDimensions(el);
      return [{ x: el.x, y: el.y }, { x: el.x + tw, y: el.y + th }, { x: el.x + tw / 2, y: el.y + th / 2 }];
    });
    for (const t of edgeTargets) {
      if (Math.abs(sx - t.x) <= SNAP_MM) { sx = t.x; guides.x = t.x; }
      if (Math.abs(sx + w - t.x) <= SNAP_MM) { sx = t.x - w; guides.x = t.x; }
      if (Math.abs(sx + w / 2 - t.x) <= SNAP_MM) { sx = t.x - w / 2; guides.x = t.x; }
      if (Math.abs(sy - t.y) <= SNAP_MM) { sy = t.y; guides.y = t.y; }
      if (Math.abs(sy + h - t.y) <= SNAP_MM) { sy = t.y - h; guides.y = t.y; }
      if (Math.abs(sy + h / 2 - t.y) <= SNAP_MM) { sy = t.y - h / 2; guides.y = t.y; }
    }
    const centerX = canvasMaxWidth / 2;
    const centerY = canvasMaxHeight / 2;
    const axisTargetsX = [0, centerX, canvasMaxWidth];
    const axisTargetsY = [0, centerY, canvasMaxHeight];
    for (const tx of axisTargetsX) {
      if (Math.abs(sx - tx) <= SNAP_MM) { sx = tx; guides.x = tx; }
      if (Math.abs(sx + w - tx) <= SNAP_MM) { sx = tx - w; guides.x = tx; }
      if (Math.abs(sx + w / 2 - tx) <= SNAP_MM) { sx = tx - w / 2; guides.x = tx; }
    }
    for (const ty of axisTargetsY) {
      if (Math.abs(sy - ty) <= SNAP_MM) { sy = ty; guides.y = ty; }
      if (Math.abs(sy + h - ty) <= SNAP_MM) { sy = ty - h; guides.y = ty; }
      if (Math.abs(sy + h / 2 - ty) <= SNAP_MM) { sy = ty - h / 2; guides.y = ty; }
    }
    return { x: Math.round(sx), y: Math.round(sy), guides };
  };

  useEffect(() => {
    return () => {
      if (snapLinesTimeoutRef.current) {
        window.clearTimeout(snapLinesTimeoutRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (elements !== lastReportedRef.current) {
      lastReportedRef.current = elements;
      onElementsChange(elements);
    }
  }, [elements, onElementsChange]);

  const uploadImage = async (file: File): Promise<{ publicUrl: string; storagePath: string; blobUrl: string } | null> => {
    try {
      if (!currentTenant?.id) { toast({ title: 'Fehler', description: 'Kein Mandant gefunden', variant: 'destructive' }); return null; }
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentTenant.id}/header-images/${fileName}`;
      const { data, error } = await supabase.storage.from('letter-assets').upload(filePath, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(data.path);
      const blobUrl = URL.createObjectURL(file);
      blobUrlMapRef.current.set(filePath, blobUrl);
      await loadGalleryImages();
      return { publicUrl, storagePath: filePath, blobUrl };
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Fehler', description: 'Bild konnte nicht hochgeladen werden', variant: 'destructive' });
      return null;
    }
  };

  const handleGalleryUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadImage(file);
      toast({ title: 'Bild hochgeladen' });
    };
    input.click();
  };

  const addImageFromGallery = (galleryImg: GalleryImage) => {
    const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(galleryImg.path);
    const newElement: HeaderElement = {
      id: createElementId(), type: 'image', x: 20, y: 10, width: 40, height: 20,
      imageUrl: publicUrl, blobUrl: galleryImg.blobUrl, storagePath: galleryImg.path, preserveAspectRatio: true,
    };
    applyElements(prev => [...prev, newElement]);
    selectOne(newElement.id);
  };

  const deleteGalleryImage = async (galleryImg: GalleryImage) => {
    try {
      const { error } = await supabase.storage.from('letter-assets').remove([galleryImg.path]);
      if (error) { toast({ title: 'Fehler', description: `Löschen fehlgeschlagen: ${error.message}`, variant: 'destructive' }); return; }
      URL.revokeObjectURL(galleryImg.blobUrl);
      blobUrlMapRef.current.delete(galleryImg.path);
      await loadGalleryImages();
      toast({ title: 'Bild gelöscht' });
    } catch (error: any) {
      toast({ title: 'Fehler', description: `Bild konnte nicht gelöscht werden: ${error?.message || 'Unbekannter Fehler'}`, variant: 'destructive' });
    }
  };

  const addTextElement = (x = 20, y = 12, content = 'Lorem ipsum dolor sit amet') => {
    const el: HeaderElement = { id: createElementId(), type: 'text', x, y, content, fontSize: 12, fontFamily: 'Arial', fontWeight: 'normal', color: '#000000', textLineHeight: 1.2 };
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const result = await uploadImage(file);
      if (!result) return;
      const el: HeaderElement = { id: createElementId(), type: 'image', x: 20, y: 10, width: 40, height: 20, imageUrl: result.publicUrl, blobUrl: result.blobUrl, storagePath: result.storagePath, preserveAspectRatio: true };
      applyElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
      setSelectedElementIds([el.id]);
    };
    input.click();
  };

  const addShapeElement = (shapeType: ShapeType) => {
    const defaultsByType: Record<ShapeType, Partial<ShapeElement>> = {
      line: { width: 50, height: 1, fillColor: 'transparent', strokeColor: '#000000', strokeWidth: 2 },
      circle: { width: 20, height: 20, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 1 },
      rectangle: { width: 40, height: 20, fillColor: '#3b82f6', strokeColor: '#1e40af', strokeWidth: 1, borderRadius: 0 },
      sunflower: { width: 25, height: 25, fillColor: '#22c55e', strokeColor: '#15803d', strokeWidth: 0 },
      lion: { width: 30, height: 12, fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0 },
      wappen: { width: 18, height: 10, fillColor: 'transparent', strokeColor: 'transparent', strokeWidth: 0 },
    };
    const defaults = defaultsByType[shapeType];
    const el: HeaderElement = { id: createElementId(), type: 'shape', shapeType, x: 20, y: 10, rotation: 0, ...defaults };
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

  const createBlockElement = (x = 10, y = 25) => {
    const blockNumber = elements.filter((el) => el.type === 'block').length + 1;
    const el: HeaderElement = {
      id: createElementId(), type: 'block', x, y, width: 45, height: 18,
      blockTitle: `Block ${blockNumber}`,
      blockContent: '', blockFontSize: 9, blockFontFamily: 'Arial', blockFontWeight: 'normal', blockColor: '#000000', blockLineHeight: 1,
    };
    return el;
  };

  const addBlockElement = () => {
    const el = createBlockElement();
    applyElements(prev => [...prev, el]);
    selectOne(el.id);
  };

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

  const onToolDragStart = (event: React.DragEvent, tool: string) => {
    event.dataTransfer.setData('application/x-header-tool', tool);
    event.dataTransfer.effectAllowed = 'copy';
    const dragPreview = document.createElement('div');
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-9999px';
    dragPreview.style.left = '-9999px';
    dragPreview.style.padding = '8px 10px';
    dragPreview.style.border = '1px solid #16a34a';
    dragPreview.style.borderRadius = '6px';
    dragPreview.style.background = '#ffffff';
    dragPreview.style.fontFamily = 'Arial, sans-serif';
    dragPreview.style.fontSize = '13px';
    dragPreview.style.color = '#111827';
    dragPreview.style.maxWidth = '240px';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    dragPreview.textContent = tool === 'text' ? 'Lorem ipsum dolor sit amet' : 'Block\nDirekt auf der Canvas bearbeiten';
    dragPreview.style.whiteSpace = 'pre-line';
    document.body.appendChild(dragPreview);
    event.dataTransfer.setDragImage(dragPreview, 12, 12);
    requestAnimationFrame(() => dragPreview.remove());
  };

  const onGalleryDragStart = (event: React.DragEvent, galleryImg: GalleryImage) => {
    event.dataTransfer.setData('application/x-gallery-image', JSON.stringify({ path: galleryImg.path, blobUrl: galleryImg.blobUrl }));
    event.dataTransfer.effectAllowed = 'copy';
    const imgEl = event.target as HTMLImageElement;
    if (imgEl) event.dataTransfer.setDragImage(imgEl, imgEl.width / 2, imgEl.height / 2);
  };

  const onPreviewDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvasMaxWidth, (event.clientX - rect.left) / effectiveScaleX));
    const y = Math.max(0, Math.min(canvasMaxHeight, (event.clientY - rect.top) / effectiveScaleY));

    const tool = event.dataTransfer.getData('application/x-header-tool');
    if (tool === 'text') { addTextElement(Math.round(x), Math.round(y)); return; }
    if (tool === 'block') {
      const el = createBlockElement(Math.round(x), Math.round(y));
      applyElements(prev => [...prev, el]);
      setSelectedElementId(el.id);
      return;
    }

    const galleryData = event.dataTransfer.getData('application/x-gallery-image');
    if (galleryData) {
      try {
        const { path, blobUrl } = JSON.parse(galleryData);
        const { data: { publicUrl } } = supabase.storage.from('letter-assets').getPublicUrl(path);
        const el: HeaderElement = { id: createElementId(), type: 'image', x: Math.round(x), y: Math.round(y), width: 40, height: 20, imageUrl: publicUrl, blobUrl, storagePath: path, preserveAspectRatio: true };
        applyElements(prev => [...prev, el]);
        setSelectedElementId(el.id);
        setSelectedElementIds([el.id]);
      } catch (e) { console.error('Error parsing gallery drop data:', e); }
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);
  const isElementSelected = (id: string) => selectedElementIds.includes(id);
  const selectedCount = selectedElementIds.length;
  const isToggleModifierPressed = (event: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => Boolean(event.shiftKey || event.metaKey || event.ctrlKey);

  const onElementMouseDown = (event: React.MouseEvent, element: HeaderElement) => {
    if (editingTextId === element.id || editingBlockId === element.id) {
      return;
    }
    event.stopPropagation();

    if (isToggleModifierPressed(event)) {
      toggleSelect(element.id);
      return;
    }

    const activeSelection = selectedElementIds.includes(element.id)
      ? selectedElementIds
      : [element.id];
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
        x: event.clientX,
        y: event.clientY,
        ow: element.width || 50,
        oh: element.height || 30,
        handle,
        group: {
          baseWidth: Math.max(1, right - left),
          baseHeight: Math.max(1, bottom - top),
          left,
          top,
          right,
          bottom,
          items,
        },
      });
      return;
    }

    setResizeStart({ x: event.clientX, y: event.clientY, ow: element.width || 50, oh: element.height || 30, handle });
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

      if (resizeStart.handle.includes('w')) {
        newW = Math.max(5, resizeStart.ow - dx);
        shiftX = resizeStart.ow - newW;
      }
      if (resizeStart.handle.includes('n')) {
        newH = Math.max(5, resizeStart.oh - dy);
        shiftY = resizeStart.oh - newH;
      }
      if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
        newW = resizeStart.ow;
      }
      if (resizeStart.handle === 'e' || resizeStart.handle === 'w') {
        newH = resizeStart.oh;
      }

      const preserveAspect = Boolean(event.ctrlKey || (resizingElement?.type === 'image' && resizingElement.preserveAspectRatio));
      if (preserveAspect && resizeStart.ow > 0 && resizeStart.oh > 0) {
        const ratio = resizeStart.ow / resizeStart.oh;
        if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
          newW = newH * ratio;
        } else {
          newH = newW / ratio;
        }
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
          if (resizeStart.handle === 'n' || resizeStart.handle === 's') {
            groupWidth = groupHeight * groupRatio;
          } else {
            groupHeight = groupWidth / groupRatio;
          }
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

  const onPreviewMouseUp = () => {
    const dragInitialSnapshot = dragInitialElementsRef.current;
    const resizeInitialSnapshot = resizeInitialElementsRef.current;

    if (dragInitialSnapshot) {
      setElements((current) => {
        if (dragInitialSnapshot !== current) {
          pushHistorySnapshot(dragInitialSnapshot);
        }
        return current;
      });
    }

    if (resizeInitialSnapshot) {
      setElements((current) => {
        if (resizeInitialSnapshot !== current) {
          pushHistorySnapshot(resizeInitialSnapshot);
        }
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
    const pasted: HeaderElement = { ...source, id: createElementId(), x: nextX, y: nextY };
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
    setClipboardElement(pasted);
  };

  const duplicateSelectedElement = () => {
    if (!selectedElement) return;
    const source = selectedElement;
    const pasted: HeaderElement = {
      ...source,
      id: createElementId(),
      x: Math.max(0, Math.min(canvasMaxWidth, source.x + 10)),
      y: Math.max(0, Math.min(canvasMaxHeight, source.y + 10)),
    };
    setClipboardElement({ ...source });
    applyElements((prev) => [...prev, pasted]);
    selectOne(pasted.id);
  };

  const canPasteFromClipboard = Boolean(clipboardElement);
  const selectedIndex = selectedElement ? elements.findIndex((el) => el.id === selectedElement.id) : -1;
  const canMoveLayerBackward = selectedIndex > 0;
  const canMoveLayerForward = selectedIndex >= 0 && selectedIndex < elements.length - 1;
  const canAlignSelection = selectedElementIds.length > 1;
  const canDistributeSelection = selectedElementIds.length > 2;

  const flashSnapLines = (guides: { x?: number; y?: number }) => {
    if (!guides.x && !guides.y) {
      return;
    }
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



  const alignSelection = (axis: AlignAxis) => {
    applyElements((prev) => alignElements(prev, axis, {
      selectedElementIds,
      headerMaxWidth: canvasMaxWidth,
      headerMaxHeight: canvasMaxHeight,
    }));
  };

  const distributeSelection = (axis: DistributeAxis) => {
    applyElements((prev) => distributeElements(prev, axis, {
      selectedElementIds,
      headerMaxWidth: canvasMaxWidth,
      headerMaxHeight: canvasMaxHeight,
    }));
  };


  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target?.isContentEditable || editingTextId || editingBlockId) {
      return;
    }

    const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    const isRedo = (event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
    if (isUndo) {
      event.preventDefault();
      undo();
      return;
    }
    if (isRedo) {
      event.preventDefault();
      redo();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === '?') {
      event.preventDefault();
      setShowShortcutsHelp((previous) => !previous);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelectedElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      pasteClipboardElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelectedElement();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === ']') {
      if (selectedElement) {
        event.preventDefault();
        moveElementLayer(selectedElement.id, 1);
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === '[') {
      if (selectedElement) {
        event.preventDefault();
        moveElementLayer(selectedElement.id, -1);
      }
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      cycleSelection(event.shiftKey ? -1 : 1);
      return;
    }

    if (!selectedElement) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelectedElements(); return; }
    let dx = 0, dy = 0;
    if (event.key === 'ArrowLeft') dx = -1;
    if (event.key === 'ArrowRight') dx = 1;
    if (event.key === 'ArrowUp') dy = -1;
    if (event.key === 'ArrowDown') dy = 1;
    if (!dx && !dy) return;
    event.preventDefault();

    applyElements((prev) => prev.map((el) => {
      if (!selectedElementIds.includes(el.id)) return el;
      return {
        ...el,
        x: Math.max(0, Math.min(canvasMaxWidth, el.x + dx)),
        y: Math.max(0, Math.min(canvasMaxHeight, el.y + dy)),
      };
    }));
  };


  const validatePosition = (value: number, max: number) => Math.max(0, Math.min(value, max));

  const startEditingText = (element: TextElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.content || '' }));
    setEditingTextId(element.id);
  };

  const startEditingBlock = (element: BlockElement) => {
    setEditorDrafts((prev) => ({ ...prev, [element.id]: element.blockContent || '' }));
    setEditingBlockId(element.id);
  };

  const cancelEditing = (id: string) => {
    setEditorDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingTextId === id) setEditingTextId(null);
    if (editingBlockId === id) setEditingBlockId(null);
  };

  const commitTextEditing = (id: string) => {
    updateElement(id, { content: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const commitBlockEditing = (id: string) => {
    updateElement(id, { blockContent: editorDrafts[id] || '' });
    cancelEditing(id);
  };

  const renderColorInput = (label: string, value: string, onChange: (color: string) => void) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-10 border-0 bg-transparent p-0 shadow-none"
        />
        <span className="text-[11px] font-mono text-muted-foreground">{value.toUpperCase()}</span>
      </div>
    </div>
  );

  const updateImageSize = (element: ImageElement, next: { width?: number; height?: number }) => {
    const baseW = Math.max(1, element.width || 1);
    const baseH = Math.max(1, element.height || 1);
    if (!element.preserveAspectRatio) {
      updateElement(element.id, next);
      return;
    }
    if (next.width != null) {
      updateElement(element.id, { width: next.width, height: Math.max(1, Math.round(next.width * (baseH / baseW))) });
      return;
    }
    if (next.height != null) {
      updateElement(element.id, { height: next.height, width: Math.max(1, Math.round(next.height * (baseW / baseH))) });
    }
  };

  const getElementLabel = (el: HeaderElement) => getElementLabelFromRegistry(el);

  const getElementAriaLabel = (el: HeaderElement) => `${getElementLabel(el)} bei x ${el.x} Millimeter, y ${el.y} Millimeter`;

  useEffect(() => {
    if (!selectedElementId) {
      setAriaAnnouncement('Keine Auswahl');
      return;
    }
    const selected = elements.find((el) => el.id === selectedElementId);
    if (!selected) return;
    setAriaAnnouncement(`Ausgewählt: ${getElementAriaLabel(selected)}`);
  }, [elements, selectedElementId]);

  const getElementIcon = (el: HeaderElement) => getElementIconFromRegistry(el);


  const renderResizeHandles = (element: HeaderElement) => {
    if (!isElementSelected(element.id)) return null;
    const handles: Array<{ key: ResizeHandle; className: string; style: React.CSSProperties }> = [
      { key: 'nw', className: 'cursor-nwse-resize', style: { left: 0, top: 0, transform: 'translate(-50%, -50%)' } },
      { key: 'n', className: 'cursor-ns-resize', style: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' } },
      { key: 'ne', className: 'cursor-nesw-resize', style: { right: 0, top: 0, transform: 'translate(50%, -50%)' } },
      { key: 'e', className: 'cursor-ew-resize', style: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
      { key: 'se', className: 'cursor-nwse-resize', style: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' } },
      { key: 's', className: 'cursor-ns-resize', style: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' } },
      { key: 'sw', className: 'cursor-nesw-resize', style: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' } },
      { key: 'w', className: 'cursor-ew-resize', style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
    ];

    return handles.map((handle) => (
      <div
        key={`${element.id}-${handle.key}`}
        className={`absolute w-3 h-3 bg-primary border border-primary-foreground z-10 ${handle.className}`}
        style={handle.style}
        onMouseDown={(event) => onResizeMouseDown(event, element, handle.key)}
      />
    ));
  };

  // Render shape on canvas
  const renderShapeCanvas = (element: ShapeElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 20) * scaleX;
    const h = (element.height || 20) * scaleY;
    const isSelected = isElementSelected(element.id);
    const rotation = element.rotation || 0;

    const wrapperStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${element.x * scaleX}px`,
      top: `${element.y * scaleY}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: rotation ? `rotate(${rotation}deg)` : undefined,
      cursor: 'move',
    };

    if (element.shapeType === 'sunflower') {
      return (
        <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}>
          <SunflowerSVG width={w} height={h} />
          {renderResizeHandles(element)}
        </div>
      );
    }

    if (element.shapeType === 'lion') {
      return (
        <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}>
          <LionSVG width={w} height={h} />
          {renderResizeHandles(element)}
        </div>
      );
    }

    if (element.shapeType === 'wappen') {
      return (
        <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`border ${isSelected ? 'border-primary border-dashed border-2' : 'border-transparent'}`}>
          <WappenSVG width={w} height={h} />
          {renderResizeHandles(element)}
        </div>
      );
    }

    return (
      <div key={element.id} aria-label={getElementAriaLabel(element)} style={wrapperStyle} onMouseDown={(e) => onElementMouseDown(e, element)} className={`${isSelected ? 'ring-2 ring-primary ring-dashed' : ''}`}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {element.shapeType === 'line' && (
            <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke={getShapeStrokeColor(element, '#000000')} strokeWidth={element.strokeWidth ?? 2} />
          )}
          {element.shapeType === 'circle' && (
            <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - (element.strokeWidth ?? 1)} ry={h / 2 - (element.strokeWidth ?? 1)} fill={getShapeFillColor(element, '#22c55e')} stroke={getShapeStrokeColor(element, '#15803d')} strokeWidth={element.strokeWidth ?? 1} />
          )}
          {element.shapeType === 'rectangle' && (
            <rect x={(element.strokeWidth ?? 1) / 2} y={(element.strokeWidth ?? 1) / 2} width={w - (element.strokeWidth ?? 1)} height={h - (element.strokeWidth ?? 1)} rx={element.borderRadius ?? 0} fill={getShapeFillColor(element, '#3b82f6')} stroke={getShapeStrokeColor(element, '#1e40af')} strokeWidth={element.strokeWidth ?? 1} />
          )}
        </svg>
        {renderResizeHandles(element)}
      </div>
    );
  };

  // Render block element on canvas
  const renderBlockCanvas = (element: BlockElement, scaleX: number, scaleY: number) => {
    const w = (element.width || 45) * scaleX;
    const h = (element.height || 18) * scaleY;
    const isSelected = isElementSelected(element.id);
    const fontSize = (element.blockFontSize || 9) * (96 / 72);
    const hasContent = Boolean((element.blockContent || '').trim());
    const isEditing = editingBlockId === element.id;

    return (
      <div
        key={element.id}
        aria-label={getElementAriaLabel(element)}
        className={`absolute cursor-move border overflow-hidden ${isSelected ? 'border-primary border-dashed border-2 bg-primary/5' : 'border-gray-300 bg-gray-50/50'}`}
        style={{ left: `${element.x * scaleX}px`, top: `${element.y * scaleY}px`, width: `${w}px`, height: `${h}px`, fontSize: `${fontSize}px`, fontFamily: element.blockFontFamily || 'Arial', fontWeight: element.blockFontWeight || 'normal', color: element.blockColor || '#000', lineHeight: `${element.blockLineHeight || 1}` }}
        onMouseDown={(e) => onElementMouseDown(e, element)}
        onDoubleClick={(e) => { e.stopPropagation(); startEditingBlock(element); }}
      >
        {!hasContent && <div className="font-bold text-[10px] px-1 pt-0.5 opacity-70">{element.blockTitle || 'Block'}</div>}
        {isEditing ? (
          <textarea
            className="px-1 h-full w-full resize-none border-0 bg-transparent outline-none"
            value={editorDrafts[element.id] || ''}
            autoFocus
            onChange={(e) => setEditorDrafts((prev) => ({ ...prev, [element.id]: e.target.value }))}
            onBlur={() => commitBlockEditing(element.id)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelEditing(element.id);
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                commitBlockEditing(element.id);
              }
            }}
          />
        ) : (
          <div className="px-1 whitespace-pre-line h-full">{element.blockContent || ''}</div>
        )}
        {renderResizeHandles(element)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <CanvasToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler((v) => !v)}
        showAxes={showCenterGuides}
        onToggleAxes={() => setShowCenterGuides((v) => !v)}
        showMargins={showMargins}
        onToggleMargins={() => setShowMargins((v) => !v)}
        canCopy={!!selectedElement}
        onCopy={copySelectedElement}
        canPaste={canPasteFromClipboard}
        onPaste={pasteClipboardElement}
        canDuplicate={!!selectedElement}
        onDuplicate={duplicateSelectedElement}
        trailingContent={
          <>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, -1)} disabled={!canMoveLayerBackward}><ArrowDown className="h-3.5 w-3.5 mr-1" />Ebene runter</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => selectedElement && moveElementLayer(selectedElement.id, 1)} disabled={!canMoveLayerForward}><ArrowUp className="h-3.5 w-3.5 mr-1" />Ebene hoch</Button>
            <Button variant={showShortcutsHelp ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" onClick={() => setShowShortcutsHelp((value) => !value)}><Keyboard className="h-3.5 w-3.5 mr-1" />Shortcuts</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={zoomOut} disabled={zoomLevel <= ZOOM_STEPS[0]}>−</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoomLevel(1)}>{Math.round(zoomLevel * 100)}%</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={zoomIn} disabled={zoomLevel >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</Button>
            <div className="h-7 px-2 text-xs rounded border bg-background/90 flex items-center text-muted-foreground">
              Auswahl: <span className="ml-1 font-semibold text-foreground">{selectedCount}</span>
            </div>
          </>
        }
      />

      {canAlignSelection && (
        <div className="flex flex-wrap gap-1 rounded-md border bg-background p-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('left')}>Links</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('center')}>Zentrum</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('right')}>Rechts</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('top')}>Oben</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('middle')}>Mitte</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => alignSelection('bottom')}>Unten</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => distributeSelection('horizontal')} disabled={!canDistributeSelection}>Horizontal verteilen</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => distributeSelection('vertical')} disabled={!canDistributeSelection}>Vertikal verteilen</Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-3">
        <div className="xl:col-start-1 xl:row-start-1 flex flex-col gap-4">
        {/* Tools */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente hinzufügen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            <Button onClick={addImageElement} className="w-full justify-start" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />Bild hochladen & einfügen
            </Button>
            {/* Draggable Text */}
            <div draggable onDragStart={(e) => onToolDragStart(e, 'text')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs">Text-Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            {/* Draggable Block */}
            <div draggable onDragStart={(e) => onToolDragStart(e, 'block')} className="rounded border bg-background px-3 py-2 text-sm cursor-grab active:cursor-grabbing flex items-start gap-2">
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div><div className="font-medium text-xs flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Block</div><div className="text-xs text-muted-foreground">Auf Canvas ziehen</div></div>
            </div>
            {/* Shapes */}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Formen</p>
            <div className="grid grid-cols-4 gap-1">
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('line')} title="Linie"><Minus className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('circle')} title="Kreis"><Circle className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('rectangle')} title="Rechteck"><Square className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('sunflower')} title="Sonnenblume"><SunflowerSVG width={14} height={14} /></Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('lion')} title="Löwe">
                <svg width="28" height="12" viewBox="0 0 151.80499 62.099997" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#000000" d="m 150,48.200003 c -1.4,-1.4 -3,-2.6 -4.5,-3.5 -2.5,-1.5 -4.6,-2.4 -4.6,-2.4 C 140.7,39.6 139.4,35.3 137.7,31.3 c -1,-2.3 -2.2,-4.5 -3.5,-6.1 l 0.3,0.3 c 4.1,-1 7.1,-5.3 6.8,-10.2 -0.4,-6.1 -6.1,-12.5 -19.7,-9.8000004 -5,1 -9,2.4 -12.9,4.0000004 -4,1.7 -7.9,3.5 -12.499996,5.1 C 91.500004,16.2 87.6,17 84.5,16.7 81.7,16.5 79.6,15.4 78.4,13.6 76.7,11.1 79.2,8.4999996 80.2,7.7999996 82.1,6.5999996 83.8,4.5 82.8,1 c -1.8,0.3 -5,1.4 -7.6,3.4 -2.1,1.5999996 -3.8,3.8999996 -3.8,7 0.1,4.2 3,7.5 7.8,8.6 3.2,0.7 5.8,1 8.8,0.6 4.300004,-0.6 9.700004,-2.5 19.3,-6.1 9,-3.4 14,-4.9 17.9,-5.1 2.5,-0.1 4.4,0.2 6.6,1 1.4,0.5 2.3,1.3 3,2.1 0.8,1 1,2.2 1,3.3 -0.2,2.1 -1.7,4.1 -4,4.6 h -1.7 c -0.7,-0.1 -1.5,-0.2 -2.4,-0.4 -2.6,-0.5 -6.1,-1.1 -11.6,-0.5 -3.3,0.3 -7.3,1.1 -12.2,2.7 C 93.700004,25.5 86,26.8 80.1,27 71.7,27.3 66.8,25.4 63,23.9 62.6,20.2 61.8,17.2 60.7,14.8 59,10.9 56.7,8.3999996 55.2,7.0999996 c 0,0 0.9,-0.5 1.3,-3.4999996 -2.2,-0.4 -5.2,0.8 -5.2,0.8 0,0 -5.6,-3.6 -13.2,-2.3 C 35.2,2.6 33.8,3.4 33,4.7 26.9,6.8999996 26.4,7.2999996 24.9,8.1999996 24,8.8999996 24,9.4 24,9.9 c 0,0.5 0.3,0.8 0.4,0.9 0.2,0.2 0.3,0.4 0.3,0.7 0.1,1.7 0.1,2.3 0.6,3.7 0.2,0.6 0.8,0.5 1.4,0.3 4,-1.5 5.7,0.4 5.7,2.1 0,1.5 -0.8,2.9 -3.7,3.1 h -1.3 c -0.4,0 -0.7,0 -0.7,0.6 0,0.4 0.9,2.7 1,3.1 0.4,1.2 0.7,1.4 1.7,1.4 1.9,0 4.4,-0.5 5.2,-0.7 0,0 -0.1,2.5 0.7,5.8 -6.7,-2.5 -11.8,-3.2 -17.5,-3 -5.6,0.2 -9.4,1.4 -11.9,2.8 -4.5,2.5 -4.9,5.7 -4.9,5.7 0,0 6.5,1.5 9.2,0.8 1.8,-0.6 3,-2.3 3,-2.3 0,0 4.3,0.9 9.9,3.9 2.8,1.5 6,3.500003 9.2,6.300003 0.1,0 7.5,-2.9 7.8,-3 0.2,-0.1 0.4,-0.1 0.6,0.2 0.2,0.2 0.1,0.5 -0.1,0.6 -0.7,0.6 -5.2,3.6 -9.8,6.3 -3,1.8 -6.2,3.7 -9,5.4 -2.2,-0.3 -3.2,-0.3 -5.2,-0.3 -4.4,0.1 -7.3,3.9 -7.3,6.7 h 17 c 0.7,-0.2 7.8,-1.7 15,-3.1 5.2,-1 10.4,-2 13.3,-2.6 1.3,-0.2 1.9,-0.4 2.2,-0.4 0.5,-0.1 0.9,-0.2 1.4,-0.6 0.2,-0.2 0.4,-0.5 0.6,-1 0.1,-0.4 0.7,-2.1 0.7,-2.1 l 3.7,-0.4 c 4.9,-0.4 9.3,-1.4 13.3,-2.7 5.1,-1.6 9.5,-3.7 13.3,-5.5 C 94.500004,40.4 98.400004,38.5 101.7,38.4 c -0.5,3.300003 0.3,5.900003 0.8,8.400003 0.5,2.4 0.8,4.8 -0.5,7.7 -9.899996,0 -8.799996,6.6 -8.799996,6.6 H 110.3 c 0,0 1.2,-3.8 4,-8.2 1.4,-2.1 3.2,-4.4 5.4,-6.4 0.4,-0.4 0.3,-0.8 0.1,-1.1 -1.9,-2.4 -2.9,-6.900003 -3.1,-7.800003 v -0.2 c 0,-0.2 0,-0.5 0.3,-0.5 0.3,-0.1 0.5,0 0.5,0.2 0.1,0.1 0.1,0.2 0.1,0.3 0,0.2 0.2,0.4 0.2,0.6 0.1,0.4 0.4,1 0.8,1.7 0.8,1.400003 1.9,3.000003 3.6,4.600003 2.2,2.1 5,3.7 7.7,5 3.3,1.5 6.6,2.6 9,3.3 2.8,0.8 3.1,1.7 3.1,2 h -1.2 c -1.4,0.2 -3,0.3 -4.9,2.1 -1.9,1.8 -1.5,4.3 -1.5,4.3 h 11.8 c 1.5,0 2.1,-0.9 2.6,-2.6 0.3,-1.1 1.7,-6.7 1.8,-7.1 0.5,-1.7 0,-2.6 -0.6,-3.1 z M 34.4,6.7999996 c 1.2,-0.8 2.9,-1 4.2,-0.8 -0.1,2.5 -3.5,3.1000004 -4.2,0.8 z"/>
                </svg>
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => addShapeElement('wappen')} title="Landeswappen BW">
                <img src="/assets/wappen-bw.svg" width={20} height={12} alt="Wappen" style={{ objectFit: 'contain' }} />
              </Button>
            </div>

        </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1"><FolderOpen className="h-3.5 w-3.5" /> Bilder-Galerie</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleGalleryUpload} className="h-7 px-2"><Upload className="h-3 w-3 mr-1" /> Hochladen</Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {galleryLoading ? (
              <p className="text-xs text-muted-foreground">Lade Bilder...</p>
            ) : galleryImages.length === 0 ? (
              <p className="text-xs text-muted-foreground">Noch keine Bilder hochgeladen.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {galleryImages.map((img) => (
                    <div key={img.path} className={`relative group border rounded overflow-hidden aspect-square bg-muted/30 cursor-pointer ${selectedGalleryImage?.path === img.path ? 'ring-2 ring-primary' : ''}`} onClick={() => setSelectedGalleryImage(img)}>
                      <img src={img.blobUrl} alt={img.name} className="w-full h-full object-contain" draggable onDragStart={(e) => onGalleryDragStart(e, img)} title={`${img.name} — Klicken zum Auswählen oder ziehen`} />
                      <button onClick={(e) => { e.stopPropagation(); deleteGalleryImage(img); if (selectedGalleryImage?.path === img.path) setSelectedGalleryImage(null); }} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
                {selectedGalleryImage && (
                  <div className="space-y-2">
                    <div className="border border-dashed border-muted-foreground/30 rounded-md p-2 flex items-center justify-center bg-muted/10 min-h-[80px]">
                      <img src={selectedGalleryImage.blobUrl} alt={selectedGalleryImage.name} className="max-h-[80px] max-w-full object-contain" />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{selectedGalleryImage.name}</p>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={() => { addImageFromGallery(selectedGalleryImage); setSelectedGalleryImage(null); }}>
                      <ImageIcon className="h-3 w-3 mr-1" /> In Canvas einfügen
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="xl:col-start-1 xl:row-start-2 flex flex-col gap-6">
          {actionButtons && (
            <Card className="self-start">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Bearbeitung</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-2">
                {actionButtons}
              </CardContent>
            </Card>
          )}

        {/* Elements list */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Elemente bearbeiten ({elements.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {elements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Elemente vorhanden</p>
            ) : (
              elements.map((element) => (
                <div
                  key={element.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isElementSelected(element.id)}
                  aria-label={`Element auswählen: ${getElementLabel(element)}`}
                  className={`group p-2 border rounded cursor-pointer transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isElementSelected(element.id) ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={(event) => {
                    if (isToggleModifierPressed(event)) {
                      toggleSelect(element.id);
                      return;
                    }
                    selectOne(element.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectOne(element.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getElementIcon(element)}
                      <span className="font-medium truncate">{getElementLabel(element)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={(e) => { e.stopPropagation(); removeElement(element.id); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                  <p className="text-muted-foreground">x: {element.x}mm, y: {element.y}mm</p>

                  {isElementSelected(element.id) && (
                    <div className="mt-2 pt-2 border-t space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">X (mm)</Label><Input type="number" value={element.x} onChange={(e) => updateElement(element.id, { x: validatePosition(parseFloat(e.target.value) || 0, canvasMaxWidth) })} className="h-7 text-xs" /></div>
                        <div><Label className="text-xs">Y (mm)</Label><Input type="number" value={element.y} onChange={(e) => updateElement(element.id, { y: validatePosition(parseFloat(e.target.value) || 0, canvasMaxHeight) })} className="h-7 text-xs" /></div>
                      </div>
                      {element.type === 'text' && (
                        <>
                          <Label className="text-xs">Text</Label>
                          <Input value={element.content || ''} onChange={(e) => updateElement(element.id, { content: e.target.value })} placeholder="Text" className="h-7 text-xs" />
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.fontSize || 12} onChange={(e) => updateElement(element.id, { fontSize: parseFloat(e.target.value) || 12 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.color || '#000000', (color) => updateElement(element.id, { color }))}
                          </div>
                          <div><Label className="text-xs">Schriftart</Label>
                          <Select value={element.fontFamily || 'Arial'} onValueChange={(value) => updateElement(element.id, { fontFamily: value })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Calibri">Calibri</SelectItem>
                              <SelectItem value="Verdana">Verdana</SelectItem>
                            </SelectContent>
                          </Select>
                          </div>
                          <div><Label className="text-xs">Formatierung</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontWeight === 'bold' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.fontStyle === 'italic' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={element.textDecoration === 'underline' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })}>U</Button>
                          </div>
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.textLineHeight || 1.2} onChange={(e) => updateElement(element.id, { textLineHeight: parseFloat(e.target.value) || 1.2 })} className="h-7 text-xs" /></div>
                          <div><Label className="text-xs">Ausrichtung</Label>
                          <div className="grid grid-cols-3 gap-1">
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'left' || !(element as TextElement).textAlign ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textAlign: 'left' })}>L</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'center' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textAlign: 'center' })}>M</Button>
                            <Button type="button" size="sm" className="h-6 text-xs" variant={(element as TextElement).textAlign === 'right' ? 'default' : 'outline'} onClick={() => updateElement(element.id, { textAlign: 'right' })}>R</Button>
                          </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={element.width ?? ''} placeholder="Auto" onChange={(e) => updateElement(element.id, { width: e.target.value ? parseFloat(e.target.value) || undefined : undefined })} className="h-7 text-xs flex-1" />
                                {element.width != null && <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => updateElement(element.id, { width: undefined })}>Auto</Button>}
                              </div>
                            </div>
                            <div><Label className="text-xs">Höhe (mm)</Label>
                              <div className="flex gap-1">
                                <Input type="number" value={element.height ?? ''} placeholder="Auto" onChange={(e) => updateElement(element.id, { height: e.target.value ? parseFloat(e.target.value) || undefined : undefined })} className="h-7 text-xs flex-1" />
                                {element.height != null && <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => updateElement(element.id, { height: undefined })}>Auto</Button>}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {element.type === 'image' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 50} onChange={(e) => updateImageSize(element, { width: parseFloat(e.target.value) || 50 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 30} onChange={(e) => updateImageSize(element, { height: parseFloat(e.target.value) || 30 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id={`preserve-${element.id}`} checked={element.preserveAspectRatio || false} onCheckedChange={(checked) => updateElement(element.id, { preserveAspectRatio: checked as boolean })} />
                            <Label htmlFor={`preserve-${element.id}`} className="text-xs">Seitenverhältnis</Label>
                          </div>
                        </>
                      )}
                      {element.type === 'shape' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 20} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 20} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 20 })} className="h-7 text-xs" /></div>
                          </div>
                          {element.shapeType !== 'sunflower' && element.shapeType !== 'lion' && (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                {renderColorInput('Füllfarbe', getShapeFillColor(element), (fillColor) => updateElement(element.id, { fillColor }))}
                                {renderColorInput('Randfarbe', getShapeStrokeColor(element), (strokeColor) => updateElement(element.id, { strokeColor }))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div><Label className="text-xs">Strichstärke</Label><Input type="number" value={element.strokeWidth || 1} onChange={(e) => updateElement(element.id, { strokeWidth: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" min={0} max={10} /></div>
                                {element.shapeType === 'rectangle' && (
                                  <div><Label className="text-xs">Rundung</Label><Input type="number" value={element.borderRadius || 0} onChange={(e) => updateElement(element.id, { borderRadius: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" min={0} /></div>
                                )}
                              </div>
                            </>
                          )}
                          <div><Label className="text-xs">Rotation (°)</Label><Input type="number" value={element.rotation || 0} onChange={(e) => updateElement(element.id, { rotation: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                      {element.type === 'block' && (
                        <>
                          <div><Label className="text-xs">Titel</Label><Input value={element.blockTitle || ''} onChange={(e) => updateElement(element.id, { blockTitle: e.target.value })} className="h-7 text-xs" /></div>
                          <div><Label className="text-xs">Inhalt</Label><Input value={element.blockContent || ''} onChange={(e) => updateElement(element.id, { blockContent: e.target.value })} className="h-7 text-xs" /></div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Breite (mm)</Label><Input type="number" value={element.width || 45} onChange={(e) => updateElement(element.id, { width: parseFloat(e.target.value) || 45 })} className="h-7 text-xs" /></div>
                            <div><Label className="text-xs">Höhe (mm)</Label><Input type="number" value={element.height || 18} onChange={(e) => updateElement(element.id, { height: parseFloat(e.target.value) || 18 })} className="h-7 text-xs" /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">Schriftgröße</Label><Input type="number" value={element.blockFontSize || 9} onChange={(e) => updateElement(element.id, { blockFontSize: parseInt(e.target.value) || 9 })} className="h-7 text-xs" /></div>
                            {renderColorInput('Farbe', element.blockColor || '#000000', (blockColor) => updateElement(element.id, { blockColor }))}
                          </div>
                          <div><Label className="text-xs">Zeilenabstand</Label><Input type="number" step="0.1" min="0.8" value={element.blockLineHeight || 1} onChange={(e) => updateElement(element.id, { blockLineHeight: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" /></div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>

        <CardContent className="xl:col-start-2 xl:row-start-1 xl:row-span-4 min-w-0 space-y-2 p-3 pt-4">
            <h3 className="text-sm font-semibold">Header-Vorschau</h3>
            <p className="text-xs text-muted-foreground">Doppelklick auf Text/Block zum Bearbeiten. Mit Mausrad + Strg/Cmd zoomen.</p>
            <div ref={previewContainerRef} className="border rounded-lg p-4 bg-muted/20 overflow-auto outline-none" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="relative mx-auto" style={{ paddingLeft: 28, paddingTop: 28, width: canvasPixelWidth + 28, height: canvasPixelHeight + 28 }}>
              <div className={`absolute top-0 left-7 h-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`} style={{ width: canvasPixelWidth }}>
                  <canvas ref={horizontalRulerRef} width={Math.round(canvasPixelWidth)} height={28} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 22 }).map((_, i) => (<span key={`label-x-${i}`} className="absolute top-0" style={{ left: `${(i * canvasPixelWidth) / 21}px` }}>{i * 10}</span>))}
                </div>
                <div className={`absolute top-7 left-0 w-7 border bg-slate-100 text-[10px] text-muted-foreground pointer-events-none ${showRuler ? '' : 'invisible'}`} style={{ height: canvasPixelHeight }}>
                  <canvas ref={verticalRulerRef} width={28} height={Math.round(canvasPixelHeight)} className="absolute inset-0 h-full w-full" />
                  {Array.from({ length: 5 }).map((_, i) => (<span key={`label-y-${i}`} className="absolute left-0" style={{ top: `${(i * canvasPixelHeight) / 4}px` }}>{i * 10}</span>))}
                </div>

            <div
              ref={previewRef}
              tabIndex={0}
              role="application"
              aria-label="Header-Vorschau. Mit Shift- oder Cmd/Ctrl-Klick mehrfach auswählen, leere Fläche ziehen erstellt Auswahlrechteck, Alt beim Ziehen wählt nur vollständig enthaltene Elemente, mit Tab durch Elemente wechseln, mit Pfeiltasten Auswahl bewegen, Entf löscht, Strg+Z rückgängig, Strg+C/V kopiert und fügt ein, Strg+] bzw. Strg+[ ändert die Ebene, Strg+Shift+? öffnet die Shortcut-Hilfe."
              onKeyDown={onPreviewKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onMouseDown={onPreviewMouseDown}
              onDrop={onPreviewDrop}
              onMouseMove={onPreviewMouseMove}
              onMouseUp={onPreviewMouseUp}
              onClick={(e) => { if (e.target === e.currentTarget) { clearSelection(); } }}
              className="border border-gray-300 bg-white relative outline-none"
              style={{ width: `${canvasPixelWidth}px`, height: `${canvasPixelHeight}px` }}>
              <span className="sr-only" aria-live="polite">{ariaAnnouncement}</span>
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: `${10 * effectiveScaleX}px ${10 * effectiveScaleY}px` }}>
              {showCenterGuides && (
                <>
                  <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-red-500/80 pointer-events-none" />
                  <div className="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-red-500/80 pointer-events-none" />
                </>
              )}
              {showMargins && marginGuides.map((guide) => (
                <React.Fragment key={guide.key}>
                  {guide.orientation === 'vertical' ? (
                    <>
                      <div className="absolute top-0 bottom-0 border-l border-dashed pointer-events-none z-10" style={{ left: `${guide.pos}px`, borderColor: guide.color }} />
                      <div className="absolute top-1 rounded bg-background/90 px-1 py-0 text-[10px] text-muted-foreground pointer-events-none z-10" style={{ left: `${Math.min(Math.max(guide.pos + 2, 2), Math.max(canvasPixelWidth - 42, 2))}px` }}>{guide.label}</div>
                    </>
                  ) : (
                    <>
                      <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none z-10" style={{ top: `${guide.pos}px`, borderColor: guide.color }} />
                      <div className="absolute left-1 rounded bg-background/90 px-1 py-0 text-[10px] text-muted-foreground pointer-events-none z-10" style={{ top: `${Math.min(Math.max(guide.pos + 2, 2), Math.max(canvasPixelHeight - 18, 2))}px` }}>{guide.label}</div>
                    </>
                  )}
                </React.Fragment>
              ))}

              {snapLines.x != null && (
                <>
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-emerald-500/90 pointer-events-none animate-pulse"
                    style={{ left: `${snapLines.x * effectiveScaleX}px` }}
                  />
                  <div className="absolute top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ left: `${snapLines.x * effectiveScaleX + 2}px` }}>
                    {Math.round(snapLines.x)}mm
                  </div>
                </>
              )}
              {snapLines.y != null && (
                <>
                  <div
                    className="absolute left-0 right-0 border-t-2 border-emerald-500/90 pointer-events-none animate-pulse"
                    style={{ top: `${snapLines.y * effectiveScaleY}px` }}
                  />
                  <div className="absolute left-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white pointer-events-none" style={{ top: `${snapLines.y * effectiveScaleY + 2}px` }}>
                    {Math.round(snapLines.y)}mm
                  </div>
                </>
              )}

              {(smartGuideDistance.horizontal != null || smartGuideDistance.vertical != null) && (
                <div className="absolute bottom-2 left-2 z-10 rounded bg-emerald-600/90 px-2 py-1 text-[10px] text-white pointer-events-none">
                  {smartGuideDistance.horizontal != null && <span>ΔX {smartGuideDistance.horizontal}mm </span>}
                  {smartGuideDistance.vertical != null && <span>ΔY {smartGuideDistance.vertical}mm</span>}
                </div>
              )}

              {elements.map((element) => {
                const scaleX = effectiveScaleX;
                const scaleY = effectiveScaleY;

                if (element.type === 'text') {
                    return (
                    <TextCanvasElement
                      key={element.id}
                      element={element}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      isSelected={isElementSelected(element.id)}
                      isEditing={editingTextId === element.id}
                      draftValue={editorDrafts[element.id] || ''}
                      onMouseDown={onElementMouseDown}
                      onDoubleClick={(event, item) => {
                        event.stopPropagation();
                        startEditingText(item);
                      }}
                      onDraftChange={(id, value) => setEditorDrafts((prev) => ({ ...prev, [id]: value }))}
                      onCommitEdit={commitTextEditing}
                      onCancelEdit={cancelEditing}
                      ariaLabel={getElementAriaLabel(element)}
                      renderResizeHandles={renderResizeHandles}
                    />
                  );
                }

                if (element.type === 'image') {
                  return (
                    <ImageCanvasElement
                      key={element.id}
                      element={element}
                      scaleX={scaleX}
                      scaleY={scaleY}
                      isSelected={isElementSelected(element.id)}
                      ariaLabel={getElementAriaLabel(element)}
                      onMouseDown={onElementMouseDown}
                      renderResizeHandles={renderResizeHandles}
                    />
                  );
                }

                if (element.type === 'shape') {
                  return renderShapeCanvas(element, scaleX, scaleY);
                }

                if (element.type === 'block') {
                  return renderBlockCanvas(element, scaleX, scaleY);
                }

                return null;
              })}
              </div>

              {selectionBox && (
                <div
                  className="absolute border border-primary/80 bg-primary/10 pointer-events-none"
                  style={{
                    left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                    top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                    width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                    height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                  }}
                />
              )}

              {showShortcutsHelp && (
                <div className="absolute right-3 top-3 z-20 w-72 rounded-md border bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
                  <div className="mb-2 font-semibold">Tastatur-Shortcuts</div>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><span className="font-medium text-foreground">Shift/Cmd/Ctrl + Klick</span> Mehrfachauswahl</li>
                    <li><span className="font-medium text-foreground">Leere Fläche ziehen</span> Auswahlrechteck</li>
                    <li><span className="font-medium text-foreground">Alt + Ziehen</span> Nur vollständig enthaltene Elemente</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + Mausrad</span> Zoom</li>
                    <li><span className="font-medium text-foreground">Ausrichten-Leiste</span> Bei Mehrfachauswahl sichtbar</li>
                    <li><span className="font-medium text-foreground">Verteilen</span> Ab 3 selektierten Elementen</li>
                    <li><span className="font-medium text-foreground">Snap-Linien</span> Blitzen beim Einrasten kurz auf</li>
                    <li><span className="font-medium text-foreground">Smart-Guide ΔX/ΔY</span> Zeigt nächste Abstände beim Drag</li>
                    <li><span className="font-medium text-foreground">Tab / Shift+Tab</span> Auswahl wechseln</li>
                    <li><span className="font-medium text-foreground">Pfeiltasten</span> Auswahl bewegen</li>
                    <li><span className="font-medium text-foreground">Resize-Handle</span> Skaliert bei Mehrfachauswahl die Gruppe</li>
                    <li><span className="font-medium text-foreground">Entf / Backspace</span> Element löschen</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + C / V</span> Kopieren / Einfügen</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + D</span> Duplizieren</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + ] / [</span> Ebene vor / zurück</li>
                    <li><span className="font-medium text-foreground">Strg/Cmd + Shift + ?</span> Hilfe ein/aus</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          </div>
        </CardContent>
    </div>
    </div>
  );
};
