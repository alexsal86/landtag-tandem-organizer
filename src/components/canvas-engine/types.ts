export type ElementType = 'text' | 'image' | 'shape' | 'block';
export type ShapeType = 'line' | 'circle' | 'rectangle' | 'sunflower' | 'lion' | 'wappen';
export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  textLineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  imageUrl?: string;
  blobUrl?: string;
  storagePath?: string;
  preserveAspectRatio?: boolean;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType?: ShapeType;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;
  rotation?: number;
  color?: string;
}

export interface BlockElement extends BaseElement {
  type: 'block';
  blockId?: string;
  blockTitle?: string;
  blockContent?: string;
  blockFontSize?: number;
  blockFontFamily?: string;
  blockFontWeight?: string;
  blockColor?: string;
  blockLineHeight?: number;
}

export type HeaderElement = TextElement | ImageElement | ShapeElement | BlockElement;
