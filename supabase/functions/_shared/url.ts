/**
 * Resolves the public app base URL used in invitation links.
 *
 * Priority:
 * 1) Request origin/referer (best for multi-domain setups)
 * 2) PUBLIC_APP_URL env var
 * 3) SUPABASE_URL env var (last fallback)
 */
export function resolveAppBaseUrl(req: Request): string {
  const originOrReferer = req.headers.get("origin") || req.headers.get("referer");
  if (originOrReferer) {
    try {
      return new URL(originOrReferer).origin;
    } catch {
      // Ignore malformed header and continue with environment fallbacks.
    }
  }

  const publicAppUrl = Deno.env.get("PUBLIC_APP_URL");
  if (publicAppUrl) {
    try {
      return new URL(publicAppUrl).origin;
    } catch {
      // Ignore malformed env value and continue with next fallback.
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (supabaseUrl) {
    try {
      return new URL(supabaseUrl).origin;
    } catch {
      // Ignore malformed env value.
    }
  }

  return "";
}

export function requireAppBaseUrl(req: Request): string {
  const baseUrl = resolveAppBaseUrl(req);
  if (!baseUrl) {
    throw new Error("Unable to resolve app base URL. Set PUBLIC_APP_URL or SUPABASE_URL.");
  }
  return baseUrl;
}
