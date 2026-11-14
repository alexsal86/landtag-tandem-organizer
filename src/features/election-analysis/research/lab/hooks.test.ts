import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ useQuery: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: mock.useQuery }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from },
}));
import { useLabDistrictData } from "./hooks";
beforeEach(() => vi.clearAllMocks());
function query() {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    abortSignal: vi.fn(),
  };
  for (const k of ["select", "eq", "order", "limit"] as const)
    q[k].mockReturnValue(q);
  q.abortSignal.mockResolvedValue({ data: [], error: null });
  mock.from.mockReturnValue(q);
  return q;
}
it("lädt nur ein Wahljahr und eine Stimmenart, keine Landestabelle", async () => {
  const q = query();
  useLabDistrictData(2026, "second");
  const config = mock.useQuery.mock.calls[0][0],
    signal = new AbortController().signal;
  await config.queryFn({ signal });
  expect(q.eq).toHaveBeenCalledWith("year", 2026);
  expect(q.eq.mock.calls.filter((c) => c[0] === "ballot")).toEqual([
    ["ballot", "second"],
    ["ballot", "second"],
  ]);
  expect(q.limit.mock.calls.map((c) => c[0])).toEqual([350, 70, 70]);
  expect(mock.from.mock.calls.flat()).not.toContain("election_analysis_state");
  expect(q.abortSignal).toHaveBeenCalledWith(signal);
  expect(config.queryKey).toContain("reader");
});
it("begrenzt OLS auf die gewählte Partei und deren Nenner", async () => {
  const q = query();
  useLabDistrictData(2021, "single", "CDU");
  await mock.useQuery.mock.calls[0][0].queryFn({
    signal: new AbortController().signal,
  });
  expect(mock.from).toHaveBeenCalledTimes(2);
  expect(q.eq).toHaveBeenCalledWith("party", "CDU");
  expect(q.limit.mock.calls.map((c) => c[0])).toEqual([70, 70]);
});
it("lädt keine nicht ausgewählte Vergleichswahl vor", () => {
  useLabDistrictData(0, "single");
  expect(mock.useQuery.mock.calls[0][0].enabled).toBe(false);
});
