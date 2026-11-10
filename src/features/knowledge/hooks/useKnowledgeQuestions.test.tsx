import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({ tenant: { id: 'office-a' }, rpc: vi.fn() }));
vi.mock('@/hooks/useTenant', () => ({ useTenant: () => ({ currentTenant: state.tenant }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
import { useKnowledgeQuestions } from './useKnowledgeQuestions';

it('does not display a delayed result from the previous office after switching offices', async () => {
  let finishOld!: (value: unknown) => void;
  const old = new Promise(resolve => { finishOld = resolve; });
  state.tenant = { id: 'office-a' };
  state.rpc.mockImplementation((_name, args) => ({ abortSignal: () => args.p_tenant === 'office-a' ? old : Promise.resolve({ data: [{ id: 'question-b' }], error: null }) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender, unmount } = renderHook(() => useKnowledgeQuestions('', 'answers', 0, null), { wrapper });
  await waitFor(() => expect(state.rpc).toHaveBeenCalled());
  state.tenant = { id: 'office-b' }; rerender();
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe('question-b'));
  await act(async () => { finishOld({ data: [{ id: 'private-question-a' }], error: null }); await old; });
  expect(result.current.data?.[0]?.id).toBe('question-b');
  unmount(); client.clear();
});
