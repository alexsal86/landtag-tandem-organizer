import { icons } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

/**
 * Converts a Lucide icon to an SVG string
 * @param iconName - Name of the Lucide icon (e.g., 'Flag', 'MapPin')
 * @param color - Color of the icon (hex, rgb, or CSS color name)
 * @param size - Size of the icon in pixels
 * @returns SVG string or null if icon not found
 */
export const lucideIconToSvg = (
  iconName: string, 
  color: string = '#000000', 
  size: number = 20
): string | null => {
  // Try to get the icon from lucide-react
  const Icon = icons[iconName as keyof typeof icons];
  
  if (!Icon) {
    return null;
  }
  
  // Create React element with the icon
  const iconElement = createElement(Icon, { 
    color, 
    size, 
    strokeWidth: 2,
    fill: 'none'
  });
  
  // Render to SVG string
  return renderToString(iconElement);
};

/**
 * Checks if a string is a Lucide icon name
 * @param iconName - String to check
 * @returns true if it's a valid Lucide icon name
 */
export const isLucideIcon = (iconName: string): boolean => {
  return iconName in icons;
};
