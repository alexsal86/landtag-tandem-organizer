import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  useQuery: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: mock.useQuery }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "reader" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mock.rpc, from: mock.from },
}));
import {
  useComparison,
  useDistrictHistory,
  useDistrictSeries,
  useDistrictVersions,
  useQualityData,
} from "./hooks";
beforeEach(() => vi.clearAllMocks());
describe("Wahlanalyse: begrenzte, abbrechbare Datenzugriffe", () => {
  it("lädt nur einen gewählten Wahlkreis und die ausgewählten Jahre", async () => {
    mock.rpc.mockReturnValue({
      abortSignal: vi
        .fn()
        .mockResolvedValue({
          data: { results: [], turnout: [], state: [], versions: [] },
          error: null,
        }),
    });
    useDistrictSeries(3, [2021, 2026]);
    const config = mock.useQuery.mock.calls[0][0];
    const signal = new AbortController().signal;
    await config.queryFn({ signal });
    expect(mock.rpc).toHaveBeenCalledWith("get_analysis_district_series", {
      district: 3,
      selected_years: [2021, 2026],
    });
    expect(mock.rpc.mock.results[0].value.abortSignal).toHaveBeenCalledWith(
      signal,
    );
    expect(config.queryKey).toContain("reader");
  });
  it("begrenzt den Vergleich auf zwei Jahre, Stimmenarten und ausgewählte Parteien", async () => {
    mock.rpc.mockReturnValue({
      abortSignal: vi
        .fn()
        .mockResolvedValue({
          data: { results: [], turnout: [], state: [], versions: [] },
          error: null,
        }),
    });
    useComparison(2021, 2026, "single", "second", ["SPD", "CDU"]);
    await mock.useQuery.mock.calls[0][0].queryFn({
      signal: new AbortController().signal,
    });
    expect(mock.rpc).toHaveBeenCalledWith("get_analysis_comparison", {
      before_year: 2021,
      after_year: 2026,
      before_ballot: "single",
      after_ballot: "second",
      selected_parties: ["CDU", "SPD"],
    });
  });
  it("lädt Mandate erst beim Öffnen der Historie", () => {
    useDistrictHistory(1, 2026, false);
    expect(mock.useQuery.mock.calls[0][0].enabled).toBe(false);
  });
  it("begrenzt Wahlkreisversionen serverseitig nach Jahr und Anzahl", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      abortSignal: vi.fn(),
    };
    for (const key of ["select", "eq", "order", "limit"] as const)
      query[key].mockReturnValue(query);
    query.abortSignal.mockResolvedValue({ data: [], error: null });
    mock.from.mockReturnValue(query);
    useDistrictVersions(2026);
    await mock.useQuery.mock.calls[0][0].queryFn({
      signal: new AbortController().signal,
    });
    expect(query.eq).toHaveBeenCalledWith("year", 2026);
    expect(query.limit).toHaveBeenCalledWith(100);
  });
  it("lädt für die Zahlenprüfung keine fremden Wahljahre", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      abortSignal: vi.fn(),
    };
    for (const key of ["select", "eq", "limit"] as const)
      query[key].mockReturnValue(query);
    query.abortSignal.mockResolvedValue({ data: [], error: null });
    mock.from.mockReturnValue(query);
    useQualityData(2021);
    await mock.useQuery.mock.calls[0][0].queryFn({
      signal: new AbortController().signal,
    });
    expect(mock.from).toHaveBeenCalledTimes(4);
    expect(
      query.eq.mock.calls.every(
        (call) => call[0] === "year" && call[1] === 2021,
      ),
    ).toBe(true);
    expect(query.limit.mock.calls.map((call) => call[0])).toEqual([
      1000, 200, 100, 100,
    ]);
  });
  it("zeigt RPC-Fehler statt fehlgeschlagene Zugriffe als leere Ergebnisse zu maskieren", async () => {
    mock.rpc.mockReturnValue({
      abortSignal: vi
        .fn()
        .mockResolvedValue({
          data: null,
          error: new Error("permission denied"),
        }),
    });
    useDistrictSeries(1, [2026]);
    await expect(
      mock.useQuery.mock.calls[0][0].queryFn({
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("permission denied");
  });
});
