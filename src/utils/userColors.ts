/**
 * Utility for consistent user color assignment
 * Used as fallback when no badge_color is set in profile
 */

export const AVAILABLE_COLORS = [
  { value: 'bg-palette-blue', label: 'Blau', hex: '#3b82f6' },
  { value: 'bg-palette-green', label: 'Grün', hex: '#22c55e' },
  { value: 'bg-palette-yellow', label: 'Gelb', hex: '#eab308' },
  { value: 'bg-palette-red', label: 'Rot', hex: '#ef4444' },
  { value: 'bg-palette-purple', label: 'Lila', hex: '#a855f7' },
  { value: 'bg-palette-pink', label: 'Pink', hex: '#ec4899' },
  { value: 'bg-palette-indigo', label: 'Indigo', hex: '#6366f1' },
  { value: 'bg-palette-teal', label: 'Türkis', hex: '#14b8a6' },
  { value: 'bg-palette-orange', label: 'Orange', hex: '#f97316' },
  { value: 'bg-palette-cyan', label: 'Cyan', hex: '#06b6d4' },
  { value: 'bg-palette-lime', label: 'Limette', hex: '#84cc16' },
  { value: 'bg-palette-amber', label: 'Bernstein', hex: '#f59e0b' },
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
