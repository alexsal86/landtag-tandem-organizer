import { useSearchParams } from "react-router-dom";
export const format = (v: number | null | undefined, digits = 2) =>
  v == null
    ? "—"
    : v.toLocaleString("de-DE", { maximumFractionDigits: digits });
export function attempt<T>(calculate: () => T): {
  value: T | null;
  error: string | null;
} {
  try {
    return { value: calculate(), error: null };
  } catch (e) {
    return {
      value: null,
      error: e instanceof Error ? e.message : "Berechnung nicht möglich.",
    };
  }
}
export function useLabParams() {
  const [params, setParams] = useSearchParams();
  return {
    params,
    set: (key: string, value: string) =>
      setParams((old) => {
        const next = new URLSearchParams(old);
        next.set(key, value);
        return next;
      }),
  };
}
export function labNumber(
  params: URLSearchParams,
  key: string,
  fallback: number,
) {
  const raw = params.get(key);
  return raw === null ? fallback : raw.trim() ? Number(raw) : NaN;
}
