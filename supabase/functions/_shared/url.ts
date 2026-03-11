const APP_URL_ENV_KEYS = [
  "PUBLIC_APP_URL",
  "APP_URL",
  "SITE_URL",
  "VITE_PUBLIC_APP_URL",
] as const;

function toOrigin(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

/**
 * Resolves the public app base URL used in invitation links.
 *
 * Priority:
 * 1) Request origin/referer (best for multi-domain setups)
 * 2) PUBLIC_APP_URL / APP_URL / SITE_URL / VITE_PUBLIC_APP_URL
 * 3) SUPABASE_URL (legacy fallback)
 */
export function resolveAppBaseUrl(req: Request): string {
  const requestOrigin = toOrigin(req.headers.get("origin") || req.headers.get("referer"));
  if (requestOrigin) return requestOrigin;

  for (const envKey of APP_URL_ENV_KEYS) {
    const envOrigin = toOrigin(Deno.env.get(envKey));
    if (envOrigin) return envOrigin;
  }

  // Legacy fallback for existing environments that only define SUPABASE_URL.
  return toOrigin(Deno.env.get("SUPABASE_URL"));
}

export function requireAppBaseUrl(req: Request): string {
  const baseUrl = resolveAppBaseUrl(req);
  if (!baseUrl) {
    throw new Error("Unable to resolve app base URL. Set PUBLIC_APP_URL (or APP_URL/SITE_URL) and ensure it is a valid URL.");
  }
  return baseUrl;
}
