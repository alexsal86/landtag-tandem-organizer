import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  is_active: boolean;
  order_index: number;
}

async function parseRSSFeed(url: string, source: string, category: string, articlesPerFeed: number = 10) {
  console.log(`Fetching RSS from: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RSS News Widget/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    console.log(`RSS content length: ${xmlText.length}`);
    
    // Simple XML parsing for RSS
    const items = [];
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];
      
      // Extract fields with regex
      const title = extractTag(itemContent, 'title');
      const description = extractTag(itemContent, 'description');
      const link = extractTag(itemContent, 'link');
      const pubDate = extractTag(itemContent, 'pubDate');
      
      if (title && link) {
        items.push({
          id: `${source}-${Date.now()}-${Math.random()}`,
          title: cleanText(title),
          description: cleanText(description || '') || '',
          link: link.trim(),
          pub_date: parsePubDate(pubDate || ''),
          source,
          category,
          image_url: extractTag(itemContent, 'enclosure url') || null
        });
      }
      
      // Limit items per feed (dynamic)
      if (items.length >= articlesPerFeed) break;
    }
    
    console.log(`Parsed ${items.length} items from ${source}`);
    return items;
    
  } catch (error) {
    console.error(`Error parsing RSS from ${url}:`, error);
    return [];
  }
}

function extractTag(content: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i');
  const match = content.match(regex);
  return match ? match[1] : null;
}

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parsePubDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  try {
    // Handle various date formats
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { category, limit, tenant_id } = await req.json();
    
    if (!tenant_id) {
      throw new Error('tenant_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log(`Fetching from ${filteredSources.length} sources for tenant ${tenant_id}, category: ${category || 'all'}`);
    
    // Fetch from all sources in parallel
    const fetchPromises = filteredSources.map((source: RSSSource) => 
      parseRSSFeed(source.url, source.name, source.category, articlesPerFeed)
    );
    
    const results = await Promise.allSettled(fetchPromises);
    
    // Combine and sort articles
    const allArticles = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => (result as PromiseFulfilledResult<any[]>).value)
      .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
      .slice(0, totalLimit);
    
    console.log(`Returning ${allArticles.length} articles`);
    
    return new Response(
      JSON.stringify({ 
        articles: allArticles,
        total: allArticles.length,
        sources: filteredSources.length 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('Error in fetch-rss-feeds function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch RSS feeds',
        details: error instanceof Error ? error.message : String(error) 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});