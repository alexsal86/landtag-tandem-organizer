/**
 * Utility for consistent user color assignment
 * Used as fallback when no badge_color is set in profile
 */

export const AVAILABLE_COLORS = [
  { value: 'bg-palette-blue', label: 'Blau', hex: '#bfdbfe', text: '#172554', baseHex: '#3b82f6', classes: 'bg-blue-200 text-blue-950' },
  { value: 'bg-palette-green', label: 'Grün', hex: '#bbf7d0', text: '#052e16', baseHex: '#22c55e', classes: 'bg-green-200 text-green-950' },
  { value: 'bg-palette-yellow', label: 'Gelb', hex: '#fef08a', text: '#422006', baseHex: '#eab308', classes: 'bg-yellow-200 text-yellow-950' },
  { value: 'bg-palette-red', label: 'Rot', hex: '#fecaca', text: '#450a0a', baseHex: '#ef4444', classes: 'bg-red-200 text-red-950' },
  { value: 'bg-palette-purple', label: 'Lila', hex: '#e9d5ff', text: '#3b0764', baseHex: '#a855f7', classes: 'bg-purple-200 text-purple-950' },
  { value: 'bg-palette-pink', label: 'Pink', hex: '#fbcfe8', text: '#500724', baseHex: '#ec4899', classes: 'bg-pink-200 text-pink-950' },
  { value: 'bg-palette-indigo', label: 'Indigo', hex: '#c7d2fe', text: '#1e1b4b', baseHex: '#6366f1', classes: 'bg-indigo-200 text-indigo-950' },
  { value: 'bg-palette-teal', label: 'Türkis', hex: '#99f6e4', text: '#042f2e', baseHex: '#14b8a6', classes: 'bg-teal-200 text-teal-950' },
  { value: 'bg-palette-orange', label: 'Orange', hex: '#fed7aa', text: '#431407', baseHex: '#f97316', classes: 'bg-orange-200 text-orange-950' },
  { value: 'bg-palette-cyan', label: 'Cyan', hex: '#a5f3fc', text: '#083344', baseHex: '#06b6d4', classes: 'bg-cyan-200 text-cyan-950' },
  { value: 'bg-palette-lime', label: 'Limette', hex: '#d9f99d', text: '#1a2e05', baseHex: '#84cc16', classes: 'bg-lime-200 text-lime-950' },
  { value: 'bg-palette-amber', label: 'Bernstein', hex: '#fde68a', text: '#451a03', baseHex: '#f59e0b', classes: 'bg-amber-200 text-amber-950' },
];

/**
 * Generate consistent color based on userId hash
 * Used as fallback when badge_color is not set
 */
export const getHashedColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return AVAILABLE_COLORS[Math.abs(hash) % AVAILABLE_COLORS.length].value;
};
