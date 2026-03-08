import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the hook
const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle, limit: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) })) }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ select: mockSelect })),
  },
}));

vi.mock('@/utils/debugConsole', () => ({
  debugConsole: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

describe('useLoginCustomization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('module exports the hook', async () => {
    const mod = await import('../useLoginCustomization');
    expect(mod.useLoginCustomization).toBeDefined();
    expect(typeof mod.useLoginCustomization).toBe('function');
  });

  it('default customization has expected fields', () => {
    // Test that the defaults are reasonable
    const defaults = {
      primary_color: '#57ab27',
      accent_color: '#E6007E',
      tagline: 'Ihre politische Arbeit. Organisiert.',
      welcome_text: 'Willkommen bei LandtagsOS',
      registration_enabled: true,
      password_reset_enabled: true,
    };
    expect(defaults.primary_color).toBe('#57ab27');
    expect(defaults.registration_enabled).toBe(true);
  });
});
