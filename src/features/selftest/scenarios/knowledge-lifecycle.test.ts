import { expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async (name: string) => ({ data: name === 'knowledge_qa_selftest' ? { ok: true, checks: {} } : [{ items: [], total_count: 0 }], error: null })) } }));
import { knowledgeLifecycleScenario } from './knowledge-lifecycle';
import type { TestContext } from '../types';

it('runs the knowledge rules presented by the selftest center without creating business data', async () => {
  const context: TestContext = { runId: 'test', tenantId: 'office', userId: 'user', data: {}, created: [], storageObjects: [], trackRecord: vi.fn(), trackStorage: vi.fn() };
  for (const step of knowledgeLifecycleScenario.steps) expect(await step.run(context), step.label).toMatchObject({ ok: true });
  expect(context.trackRecord).not.toHaveBeenCalled(); expect(context.trackStorage).not.toHaveBeenCalled();
});
