import { describe, expect, it } from 'vitest';

import { resolveBadgeColor } from '@/components/plugins/MentionsPlugin';
import { AVAILABLE_COLORS, getHashedColor } from '@/utils/userColors';

describe('resolveBadgeColor', () => {
  it('returns explicit hex colors unchanged', () => {
    expect(resolveBadgeColor('#112233', 'user-1')).toBe('#112233');
  });

  it('resolves known utility classes to configured hex values', () => {
    const firstColor = AVAILABLE_COLORS[0];
    expect(resolveBadgeColor(firstColor.value, 'user-2')).toBe(firstColor.hex);
  });

  it('falls back to hashed color when no badge color is set', () => {
    const userId = 'fallback-user';
    const expectedClass = getHashedColor(userId);
    const expectedHex = AVAILABLE_COLORS.find((c) => c.value === expectedClass)?.hex ?? '#3b82f6';

    expect(resolveBadgeColor(null, userId)).toBe(expectedHex);
  });
});
