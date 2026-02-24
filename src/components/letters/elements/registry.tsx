import React from 'react';
import { Circle, Flower2, Image as ImageIcon, LayoutGrid, Minus, Square, Type } from 'lucide-react';
import type { HeaderElement } from '@/components/canvas-engine/types';

interface ElementRegistryEntry {
  getLabel: (element: HeaderElement) => string;
  getIcon: (element: HeaderElement) => React.ReactNode;
}

const DEFAULT_ICON_CLASS = 'h-3.5 w-3.5 shrink-0';

export const elementRegistry: Record<HeaderElement['type'], ElementRegistryEntry> = {
  text: {
    getLabel: (element) => (element.type === 'text' ? (element.content || 'Text').slice(0, 25) : 'Text'),
    getIcon: () => <Type className={DEFAULT_ICON_CLASS} />,
  },
  image: {
    getLabel: () => 'Bild',
    getIcon: () => <ImageIcon className={DEFAULT_ICON_CLASS} />,
  },
  block: {
    getLabel: (element) => (element.type === 'block' ? `Block: ${element.blockTitle || 'Block'}` : 'Block'),
    getIcon: () => <LayoutGrid className={DEFAULT_ICON_CLASS} />,
  },
  shape: {
    getLabel: (element) => (element.type === 'shape' ? `Form: ${element.shapeType || 'shape'}` : 'Form'),
    getIcon: (element) => {
      if (element.type === 'shape') {
        if (element.shapeType === 'circle') return <Circle className={DEFAULT_ICON_CLASS} />;
        if (element.shapeType === 'line') return <Minus className={DEFAULT_ICON_CLASS} />;
        if (element.shapeType === 'sunflower') return <Flower2 className={DEFAULT_ICON_CLASS} />;
        if (element.shapeType === 'wappen') return <img src="/assets/wappen-bw.svg" className={DEFAULT_ICON_CLASS} alt="Wappen" style={{ objectFit: 'contain' }} />;
      }
      return <Square className={DEFAULT_ICON_CLASS} />;
    },
  },
};

export const getElementLabelFromRegistry = (element: HeaderElement) => {
  const entry = elementRegistry[element.type];
  return entry?.getLabel(element) ?? 'Element';
};

export const getElementIconFromRegistry = (element: HeaderElement) => {
  const entry = elementRegistry[element.type];
  return entry?.getIcon(element) ?? <Square className={DEFAULT_ICON_CLASS} />;
};
