// Stable identity for news articles.
//
// The id is derived from the normalized article link (tracking parameters and
// fragment removed) so it survives refetches, cache misses, source reordering
// and redeployments. Tasks, shares and per-user read/saved state can safely
// reference it.

const TRACKING_PARAMETER = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$)/i;

/** Normalizes a link for identity comparison; falls back to the trimmed input. */
export function normalizeArticleLink(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    const sorted = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMETER.test(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey));
    url.search = "";
    for (const [key, value] of sorted) url.searchParams.append(key, value);
    return url.toString();
  } catch {
    return trimmed;
  }
}

/** Deterministic article id (`nws_` + 128 bit of the normalized link hash). */
export async function newsArticleId(rawLink: string): Promise<string> {
  const normalized = normalizeArticleLink(rawLink);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `nws_${hex.slice(0, 32)}`;
}
