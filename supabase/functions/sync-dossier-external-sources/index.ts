import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { withSafeHandler } from "../_shared/security.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

type Watcher = {
  id: string;
  dossier_id: string;
  tenant_id: string;
  source_name: string;
  source_url: string;
  source_type: string;
  keywords: string[];
  created_by: string;
};

type FeedItem = {
  title: string;
  description: string;
  link: string;
  publishedAt: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url.trim();
  }
};

const extractTag = (content: string, tagName: string): string | null => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = content.match(regex);
  return match ? match[1] : null;
};

const cleanText = (text: string | null) => {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

const parseDate = (value: string | null) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const hashText = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const parseRssFeed = async (url: string): Promise<FeedItem[]> => {
  const response = await fetch(url, { headers: { "User-Agent": "DossierBot/1.0" } });
  if (!response.ok) throw new Error(`RSS fetch failed (${response.status})`);
  const xmlText = await response.text();

  const items: FeedItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null = null;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const item = match[1];
    const title = cleanText(extractTag(item, "title"));
    const description = cleanText(extractTag(item, "description"));
    const link = cleanText(extractTag(item, "link"));
    const pubDate = parseDate(extractTag(item, "pubDate"));

    if (!title || !link) continue;
    items.push({ title, description, link, publishedAt: pubDate });
    if (items.length >= 25) break;
  }

  return items;
};

const matchesKeywords = (item: FeedItem, keywords: string[]) => {
  if (!keywords.length) return true;
  const haystack = normalize(`${item.title} ${item.description}`);
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
};

serve(withSafeHandler("sync-dossier-external-sources", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get("Authorization");
  const internalSecret = req.headers.get("x-automation-secret");
  const isInternalCall = Boolean(automationSecret && internalSecret === automationSecret);

  if (!authHeader && !isInternalCall) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const tenantId = typeof body.tenantId === "string" ? body.tenantId : undefined;
  const dossierId = typeof body.dossierId === "string" ? body.dossierId : undefined;

  let query = supabaseAdmin
    .from("dossier_source_watchers")
    .select("id, dossier_id, tenant_id, source_name, source_url, source_type, keywords, created_by")
    .eq("is_active", true);

  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (dossierId) query = query.eq("dossier_id", dossierId);

  const { data: watchers, error: watcherError } = await query;
  if (watcherError) throw watcherError;

  let inserted = 0;
  let skipped = 0;
  const errors: Array<Record<string, string>> = [];

  for (const watcher of (watchers ?? []) as Watcher[]) {
    try {
      const feedItems = watcher.source_type === "rss" ? await parseRssFeed(watcher.source_url) : [];

      for (const item of feedItems) {
        if (!matchesKeywords(item, watcher.keywords ?? [])) {
          skipped += 1;
          continue;
        }

        const normalizedUrl = normalizeUrl(item.link);
        const sourceHash = await hashText(normalizedUrl);

        const { data: duplicateFlag, error: duplicateError } = await supabaseAdmin.rpc("dossier_is_duplicate_entry", {
          p_tenant_id: watcher.tenant_id,
          p_dossier_id: watcher.dossier_id,
          p_source_hash: sourceHash,
          p_title: item.title,
        });

        if (duplicateError) throw duplicateError;
        if (duplicateFlag) {
          skipped += 1;
          continue;
        }

        const shortText = item.description.slice(0, 280);
        const titleFingerprint = await hashText(normalize(item.title));

        const { error: insertError } = await supabaseAdmin
          .from("dossier_entries")
          .insert({
            dossier_id: watcher.dossier_id,
            tenant_id: watcher.tenant_id,
            created_by: watcher.created_by,
            entry_type: "link",
            title: item.title,
            content: shortText,
            source_url: normalizedUrl,
            source_hash: sourceHash,
            title_fingerprint: titleFingerprint,
            external_published_at: item.publishedAt,
            metadata: {
              source_name: watcher.source_name,
              source_type: watcher.source_type,
              watcher_id: watcher.id,
              imported_at: new Date().toISOString(),
              matched_keywords: watcher.keywords,
            },
          });

        if (insertError) {
          if (insertError.code === "23505") {
            skipped += 1;
            continue;
          }
          throw insertError;
        }

        inserted += 1;
      }

      await supabaseAdmin
        .from("dossier_source_watchers")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", watcher.id);
    } catch (error) {
      errors.push({ watcherId: watcher.id, message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return new Response(JSON.stringify({
    watchers: (watchers ?? []).length,
    inserted,
    skipped,
    errors,
  }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}));
