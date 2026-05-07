// Edge-Function-Cache Helper – nutzt Postgres-Tabelle public.edge_function_cache.
// Alle Reads/Writes laufen mit SERVICE_ROLE_KEY und sind nicht für Client-Calls gedacht.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export interface CacheOptions {
  /** TTL in Sekunden. Default: 3600 (1h). */
  ttlSeconds?: number;
}

/** Liest aus dem Cache. Gibt `null` zurück wenn fehlt oder abgelaufen. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from("edge_function_cache")
    .select("cache_value, expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.cache_value as T;
}

/** Schreibt einen Wert in den Cache. */
export async function cacheSet(
  key: string,
  value: unknown,
  options: CacheOptions = {},
): Promise<void> {
  const ttl = options.ttlSeconds ?? 3600;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  await supabase
    .from("edge_function_cache")
    .upsert(
      { cache_key: key, cache_value: value, expires_at: expiresAt },
      { onConflict: "cache_key" },
    );
}

/** get-or-compute Pattern. Bei Miss wird `compute()` ausgeführt und das Resultat gecached. */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  await cacheSet(key, value, options);
  return value;
}

/** Invalidiert einen Schlüssel explizit. */
export async function cacheDelete(key: string): Promise<void> {
  await supabase.from("edge_function_cache").delete().eq("cache_key", key);
}
