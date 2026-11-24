import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import Parser from 'npm:rss-parser@3.13.0'
import { requireTenantAccess } from "../_shared/tenant-access.ts";

import { withSafeHandler } from "../_shared/security.ts";
import { fetchPublicFeed } from "../_shared/feed-fetch.ts";
import { articleIdentity, normalizeArticleLink } from "../_shared/newsArticle.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
}

interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  order_index: number;
}

interface NewsArticle {
  id: string;
  guid: string | null;
  title: string;
  description: string;
  link: string;
  pub_date: string;
  source: string;
  category: string;
  image_url: string | null;
}

async function resolveHost(host: string): Promise<string[]> {
  const results = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
  return results.flatMap(result => (result.status === 'fulfilled' ? result.value : []));
}

/** Fetches one feed through the SSRF-guarded fetcher and maps it with rss-parser. */
async function parseRSSFeed(source: RSSSource, articlesPerFeed: number): Promise<NewsArticle[]> {
  const xml = await fetchPublicFeed(source.url, { resolve: resolveHost, fetch });
  const feed = await new Parser().parseString(xml);
  const articles: NewsArticle[] = [];

  for (const item of feed.items) {
    const link = cleanText(item.link ?? '').trim();
    const title = cleanText(item.title ?? '');
    const guid = cleanText(item.guid ?? item.id ?? '').trim() || null;

    if (!title) continue;

    // Link first, feed guid as fallback; entries without either cannot be referenced.
    const id = await articleIdentity({ link, guid, sourceKey: source.id });
    if (!id) continue;

    articles.push({
      id,
      guid,
      title,
      description: cleanText(item.contentSnippet ?? item.content ?? item.summary ?? ''),
      link,
      pub_date: parsePubDate(item.isoDate ?? item.pubDate ?? ''),
      source: source.name,
      category: source.category,
      image_url: extractImageUrl(item),
    });

    if (articles.length >= articlesPerFeed) break;
  }

  return articles;
}

function extractImageUrl(item: { enclosure?: { url?: string }; content?: string; contentSnippet?: string; [key: string]: unknown }): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  const media = item['media:content'] as { $?: { url?: string } } | undefined;
  if (media?.$?.url) return media.$.url;
  const html = item.content ?? item['content:encoded'] ?? '';
  const match = typeof html === 'string' ? html.match(/<img[^>]+src=["']([^"']+)["']/i) : null;
  return match ? match[1] : null;
}

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePubDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** Persists the fetched articles so stable ids keep resolving after the feed moves on. */
async function persistArticles(supabase: any, tenantId: string, articles: NewsArticle[]): Promise<void> {
  if (articles.length === 0) return;

  const now = new Date().toISOString();
  const rows = articles.map((article) => ({
    tenant_id: tenantId,
    article_id: article.id,
    guid: article.guid,
    title: article.title.slice(0, 500),
    description: article.description.slice(0, 2000),
    link: article.link.slice(0, 2048),
    source: article.source,
    category: article.category,
    image_url: article.image_url,
    pub_date: article.pub_date,
    last_seen_at: now,
  }));

  const { error } = await supabase
    .from('news_articles')
    .upsert(rows, { onConflict: 'tenant_id,article_id' });

  if (error) {
    console.error('⚠️ Failed to persist news articles:', error);
  }
}

/** Adds the caller's own read/saved flags; they are never cached per tenant. */
async function applyUserState(
  supabase: any,
  tenantId: string,
  userId: string,
  articles: NewsArticle[],
): Promise<Array<NewsArticle & { is_read: boolean; is_saved: boolean; read_at: string | null; saved_at: string | null }>> {
  const withDefaults = articles.map((article) => ({
    ...article,
    is_read: false,
    is_saved: false,
    read_at: null as string | null,
    saved_at: null as string | null,
  }));

  if (articles.length === 0) return withDefaults;

  const { data, error } = await supabase
    .from('news_article_states')
    .select('article_id, is_read, is_saved, read_at, saved_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('article_id', articles.map((article) => article.id));

  if (error) {
    console.error('⚠️ Failed to load news article states:', error);
    return withDefaults;
  }

  const states = new Map((data ?? []).map((row: any) => [row.article_id, row]));
  return withDefaults.map((article) => {
    const state: any = states.get(article.id);
    return state ? { ...article, is_read: state.is_read, is_saved: state.is_saved, read_at: state.read_at, saved_at: state.saved_at } : article;
  });
}

serve(withSafeHandler("fetch-rss-feeds", async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, limit, tenant_id: requestedTenantId } = await req.json();

    const tenantAccess = await requireTenantAccess({
      req,
      functionName: "fetch-rss-feeds",
      requestedTenantId: requestedTenantId,
    });

    if ("response" in tenantAccess) {
      return tenantAccess.response;
    }

    const tenant_id = tenantAccess.tenantId;
    const user_id = tenantAccess.user.id;

    // Initialize Supabase client first for cache check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (5 minute TTL)
    const cacheKey = `rss_${tenant_id}_${category || 'all'}`;

    const { data: cachedData, error: cacheError } = await supabase
      .from('rss_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cachedData && !cacheError) {
      const cachedArticles: NewsArticle[] = cachedData.content?.articles ?? [];
      return new Response(
        JSON.stringify({
          ...cachedData.content,
          articles: await applyUserState(supabase, tenant_id, user_id, cachedArticles),
          cached: true,
          cache_expires_at: cachedData.expires_at
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Cache': 'HIT'
          }
        }
      );
    }


    // Load settings from database
    const { data: settings } = await supabase
      .from('rss_settings')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    const articlesPerFeed = settings?.articles_per_feed || 10;
    const totalLimit = limit || settings?.total_articles_limit || 20;

    // Load sources from database (only active)
    const { data: sources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('order_index');

    if (sourcesError) {
      console.error('Error loading sources:', sourcesError);
      throw sourcesError;
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({
          articles: [],
          total: 0,
          sources: 0,
          message: 'No active RSS sources configured for this tenant'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter by category if specified
    let filteredSources = sources;
    if (category && category !== 'all') {
      filteredSources = sources.filter((s: RSSSource) => s.category === category);
    }

    // Fetch from all sources in parallel
    const fetchPromises = filteredSources.map((source: RSSSource) =>
      parseRSSFeed(source, articlesPerFeed)
    );

    const results = await Promise.allSettled(fetchPromises);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error parsing RSS from ${filteredSources[index]?.url}:`, result.reason);
      }
    });

    // Combine and sort articles
    const sortedArticles = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => (result as PromiseFulfilledResult<NewsArticle[]>).value)
      .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime());

    // The same URL from several feeds is one article; the newest occurrence wins.
    const seen = new Set<string>();
    const uniqueArticles: NewsArticle[] = [];
    for (const article of sortedArticles) {
      const key = article.link ? `link:${normalizeArticleLink(article.link)}` : `id:${article.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueArticles.push(article);
    }

    const allArticles = uniqueArticles.slice(0, totalLimit);

    await persistArticles(supabase, tenant_id, allArticles);

    // Prepare response data (user-independent part goes into the cache)
    const responseData = {
      articles: allArticles,
      total: allArticles.length,
      sources: filteredSources.length,
      cached: false
    };

    // Store in cache (5 minute TTL)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error: cacheInsertError } = await supabase
      .from('rss_cache')
      .upsert({
        cache_key: cacheKey,
        content: responseData,
        expires_at: expiresAt
      }, {
        onConflict: 'cache_key'
      });

    if (cacheInsertError) {
      console.error('⚠️ Failed to cache RSS data:', cacheInsertError);
      // Continue anyway - caching is not critical
    }

    return new Response(
      JSON.stringify({
        ...responseData,
        articles: await applyUserState(supabase, tenant_id, user_id, allArticles),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache': 'MISS'
        },
      }
    );

  } catch (error) {
    console.error('Error in fetch-rss-feeds function:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch RSS feeds',
        details: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}));
