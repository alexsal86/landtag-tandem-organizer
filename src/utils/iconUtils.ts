import { icons, type LucideIcon } from 'lucide-react';

/**
 * Convert a kebab-case or lowercase icon name to PascalCase.
 * e.g. "map-pin" → "MapPin", "flag" → "Flag", "MapPin" → "MapPin"
 */
export const toPascalCase = (name: string): string =>
  name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

/**
 * Get a Lucide icon component by name (supports both kebab-case and PascalCase).
 * Returns the icon component or null if not found.
 */
export const getLucideIcon = (iconName: string): LucideIcon | null => {
  // Try direct lookup first (PascalCase)
  let Icon = icons[iconName as keyof typeof icons];
  if (Icon) return Icon as LucideIcon;

  // Try converting from kebab-case
  const pascalName = toPascalCase(iconName);
  Icon = icons[pascalName as keyof typeof icons];
  return (Icon as LucideIcon) || null;
};
