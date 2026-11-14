import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ useQuery: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: mock.useQuery }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from },
}));
import {
  useCandidateCoverage,
  useCandidatePartyReference,
} from "./mandateHooks";
beforeEach(() => vi.clearAllMocks());
it("lädt Parteireferenzen erst nach ausdrücklichem Öffnen und bestätigter Vollständigkeit", () => {
  useCandidatePartyReference(2026, false);
  expect(mock.useQuery.mock.calls[0][0].enabled).toBe(false);
});
it("lädt keine unabhängige Zweitstimmenreferenz vor 2026", () => {
  useCandidatePartyReference(2021, true);
  expect(mock.useQuery.mock.calls[0][0].enabled).toBe(false);
});
it("begrenzt Referenzen auf ein Jahr, Zweitstimmen und höchstens 350 Zeilen", async () => {
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
  useCandidatePartyReference(2026, true);
  const config = mock.useQuery.mock.calls[0][0],
    signal = new AbortController().signal;
  await config.queryFn({ signal });
  expect(q.eq).toHaveBeenCalledWith("year", 2026);
  expect(q.eq).toHaveBeenCalledWith("ballot", "second");
  expect(q.limit).toHaveBeenCalledWith(350);
  expect(q.abortSignal).toHaveBeenCalledWith(signal);
  expect(config.queryKey).toContain("reader");
});
it("begrenzt Vollständigkeitsabfragen auf eine einzige Periode", async () => {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    abortSignal: vi.fn(),
    maybeSingle: vi.fn(),
  };
  for (const k of ["select", "eq", "abortSignal"] as const)
    q[k].mockReturnValue(q);
  q.maybeSingle.mockResolvedValue({ data: null, error: null });
  mock.from.mockReturnValue(q);
  useCandidateCoverage("selected");
  await mock.useQuery.mock.calls[0][0].queryFn({
    signal: new AbortController().signal,
  });
  expect(q.eq).toHaveBeenCalledWith("period_id", "selected");
});
