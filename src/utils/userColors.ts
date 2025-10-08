/**
 * Utility for consistent user color assignment
 * Used as fallback when no badge_color is set in profile
 */

export const AVAILABLE_COLORS = [
  { value: 'bg-blue-500', label: 'Blau', hex: '#3b82f6' },
  { value: 'bg-green-500', label: 'Grün', hex: '#22c55e' },
  { value: 'bg-yellow-500', label: 'Gelb', hex: '#eab308' },
  { value: 'bg-red-500', label: 'Rot', hex: '#ef4444' },
  { value: 'bg-purple-500', label: 'Lila', hex: '#a855f7' },
  { value: 'bg-pink-500', label: 'Pink', hex: '#ec4899' },
  { value: 'bg-indigo-500', label: 'Indigo', hex: '#6366f1' },
  { value: 'bg-teal-500', label: 'Türkis', hex: '#14b8a6' },
  { value: 'bg-orange-500', label: 'Orange', hex: '#f97316' },
  { value: 'bg-cyan-500', label: 'Cyan', hex: '#06b6d4' },
  { value: 'bg-lime-500', label: 'Limette', hex: '#84cc16' },
  { value: 'bg-amber-500', label: 'Bernstein', hex: '#f59e0b' },
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
