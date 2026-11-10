import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  tenant: { id: "office-a" },
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ currentTenant: state.tenant }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: state.rpc,
    from: state.from,
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  },
}));
import {
  useKnowledgeQuestions,
  useSimilarKnowledgeQuestions,
  useKnowledgeHistory,
  useKnowledgeWrite,
} from "./useKnowledgeQuestions";

it("does not display a delayed result from the previous office after switching offices", async () => {
  let finishOld!: (value: unknown) => void;
  const old = new Promise((resolve) => {
    finishOld = resolve;
  });
  state.tenant = { id: "office-a" };
  state.rpc.mockImplementation((_name, args) => ({
    abortSignal: () =>
      args.p_tenant === "office-a"
        ? old
        : Promise.resolve({
            data: [{ items: [{ id: "question-b" }], total_count: 1 }],
            error: null,
          }),
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(
    () => useKnowledgeQuestions("", "answers", null),
    { wrapper },
  );
  await waitFor(() => expect(state.rpc).toHaveBeenCalled());
  state.tenant = { id: "office-b" };
  rerender();
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe("question-b"));
  await act(async () => {
    finishOld({
      data: [{ items: [{ id: "private-question-a" }], total_count: 1 }],
      error: null,
    });
    await old;
  });
  expect(result.current.data?.[0]?.id).toBe("question-b");
  unmount();
  client.clear();
});

it("uses the compact list RPC with a bounded page and preserves server excerpts", async () => {
  state.tenant = { id: "office-a" };
  state.rpc.mockImplementation(() => ({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            items: [
              { id: "compact", answer_excerpt: "Treffer im Antworttext" },
            ],
            total_count: 1,
          },
        ],
        error: null,
      }),
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => useKnowledgeQuestions("Antwort", "answers", null),
    { wrapper },
  );
  await waitFor(() =>
    expect(result.current.data?.[0]?.answer_excerpt).toBe(
      "Treffer im Antworttext",
    ),
  );
  expect(state.rpc).toHaveBeenLastCalledWith(
    "knowledge_qa_list",
    expect.objectContaining({ p_limit: 20, p_tenant: "office-a" }),
  );
  unmount();
  client.clear();
});

it("loads the server cursor and stops even when the last page contains twenty entries", async () => {
  const cursor = { id: "last", updated_at: "2026-11-11T00:00:00Z", rank: 0 };
  state.rpc.mockImplementation((_name, args) => ({
    abortSignal: () =>
      Promise.resolve({
        data: [
          {
            items: args.p_cursor
              ? Array.from({ length: 20 }, (_, i) => ({ id: `b-${i}` }))
              : [{ id: "a" }],
            total_count: 21,
            next_cursor: args.p_cursor ? null : cursor,
          },
        ],
        error: null,
      }),
  }));
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => useKnowledgeQuestions("", "answers", null),
    { wrapper },
  );
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data).toHaveLength(21));
  expect(result.current.hasNextPage).toBe(false);
  expect(result.current.totalCount).toBe(21);
  expect(state.rpc).toHaveBeenLastCalledWith(
    "knowledge_qa_list",
    expect.objectContaining({ p_cursor: cursor }),
  );
  unmount();
  client.clear();
});

it("suggests at most three answered questions after the title debounce and skips short titles", async () => {
  state.rpc.mockClear();
  state.rpc.mockImplementation(() => ({
    abortSignal: () =>
      Promise.resolve({
        data: [{ items: [{ id: "similar" }], total_count: 1 }],
        error: null,
      }),
  }));
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, rerender, unmount } = renderHook(
    ({ title }) => useSimilarKnowledgeQuestions(title),
    { initialProps: { title: "KA" }, wrapper },
  );
  expect(state.rpc).not.toHaveBeenCalled();
  rerender({ title: "Kleine Anfrage" });
  expect(state.rpc).not.toHaveBeenCalled();
  await waitFor(() => expect(result.current.data?.[0]?.id).toBe("similar"));
  expect(state.rpc).toHaveBeenLastCalledWith(
    "knowledge_qa_list",
    expect.objectContaining({
      p_query: "Kleine Anfrage",
      p_view: "answers",
      p_limit: 3,
    }),
  );
  rerender({ title: "" });
  expect(result.current.data).toEqual([]);
  unmount();
  client.clear();
});

it("loads older history by revision with a bounded extra row instead of truncating at 100", async () => {
  const revisions: (number | null)[] = [];
  state.from.mockImplementation(() => {
    let before: number | null = null;
    const request = {
      select: () => request,
      eq: () => request,
      order: () => request,
      limit: (size: number) => {
        expect(size).toBe(21);
        return request;
      },
      lt: (_column: string, revision: number) => {
        before = revision;
        return request;
      },
      abortSignal: () => {
        revisions.push(before);
        return Promise.resolve({
          data:
            before === null
              ? Array.from({ length: 21 }, (_, index) => ({
                  id: String(120 - index),
                  revision: 120 - index,
                }))
              : [{ id: "100", revision: 100 }],
          error: null,
        });
      },
    };
    return request;
  });
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => useKnowledgeHistory("history-question", true),
    { wrapper },
  );
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));
  expect(result.current.data?.pages[0].items).toHaveLength(20);
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  expect(revisions).toEqual([null, 101]);
  expect(result.current.data?.pages.flatMap((page) => page.items)).toHaveLength(
    21,
  );
  unmount();
  client.clear();
});

it('clears an assignee with SQL null through the typed write RPC', async () => {
  state.rpc.mockImplementation(() => ({ single: () => Promise.resolve({ data: { id: 'question' }, error: null }) }));
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useKnowledgeWrite(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ name: 'knowledge_qa_set_assignee', args: { p_question: 'question', p_expected_revision: 3, p_assigned_to: null } }); });
  expect(state.rpc).toHaveBeenLastCalledWith('knowledge_qa_set_assignee', expect.objectContaining({ p_assigned_to: null, p_expected_revision: 3 }));
  unmount(); client.clear();
});
