import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { jourFixePlatformIntegrationScenario } from './jour-fixe-platform-integration';
import type { TestContext } from '../types';

describe('Jour-fixe platform selftest', () => {
  it('executes the shared radar rules without a database', async () => {
    const ctx: TestContext = { runId: 'run', tenantId: 'office', userId: 'user', created: [], storageObjects: [], data: {}, trackRecord: vi.fn(), trackStorage: vi.fn() };
    const step = jourFixePlatformIntegrationScenario.steps.find(step => step.id === 'radar-rules');
    if (!step) throw new Error('Radar logic test missing');
    expect((await step.run(ctx)).ok).toBe(true);
  });
});