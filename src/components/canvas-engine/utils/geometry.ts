import type { HeaderElement } from '../types';

export const getElementDimensions = (element: HeaderElement) => ({
  width: Math.max(1, element.width || (element.type === 'text' ? 70 : element.type === 'block' ? 45 : 50)),
  height: Math.max(1, element.height || (element.type === 'text' ? 8 : element.type === 'block' ? 18 : 10)),
});
