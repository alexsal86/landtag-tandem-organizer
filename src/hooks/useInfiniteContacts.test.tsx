import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { range, notifyError } = vi.hoisted(() => ({ range: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ currentTenant: { id: "tenant-1" } }) }));
vi.mock("@/lib/notify", () => ({ notify: { error: notifyError, success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => {
    const query = { select: () => query, eq: () => query, neq: () => query, order: () => query, range };
    return query;
  } },
}));
import { useInfiniteContacts } from "./useInfiniteContacts";

const page = Array.from({ length: 50 }, (_, index) => ({ id: `${index}`, name: `Kontakt ${index}` }));

describe("contact loading failures", () => {
  beforeEach(() => range.mockReset());

  it("stops automatic retries after initial failure and allows an explicit refresh", async () => {
    range.mockResolvedValueOnce({ error: new Error("offline") });
    const { result, rerender } = renderHook(() => useInfiniteContacts());
    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    rerender();
    expect(range).toHaveBeenCalledTimes(1);
    expect(notifyError).toHaveBeenCalledTimes(1);

    range.mockResolvedValueOnce({ data: page.slice(0, 1), count: 1 });
    act(() => result.current.refreshContacts());
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));
    expect(result.current.loadError).toBe(false);
    expect(range).toHaveBeenCalledTimes(2);
  });

  it("keeps loaded contacts after pagination fails and stops retrying", async () => {
    range.mockResolvedValueOnce({ data: page, count: 100 });
    const { result } = renderHook(() => useInfiniteContacts());
    await waitFor(() => expect(result.current.contacts).toHaveLength(50));
    range.mockResolvedValueOnce({ error: new Error("offline") });
    act(() => { result.current.loadMore(); result.current.loadMore(); });
    await waitFor(() => expect(result.current.loadError).toBe(true));
    act(() => result.current.loadMore());
    expect(result.current.contacts).toHaveLength(50);
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(range).toHaveBeenCalledTimes(2);
  });
});
