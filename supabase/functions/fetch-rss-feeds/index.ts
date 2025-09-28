import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RSSSource {
  name: string;
  url: string;
  category: string;
  rsshub_path?: string;
}

// RSSHub public instance and RSS feeds
const RSS_SOURCES: RSSSource[] = [
  // German News via RSSHub
  { name: 'Tagesschau', url: 'https://rsshub.app/tagesschau/news', category: 'politik' },
  { name: 'Spiegel Politik', url: 'https://rsshub.app/spiegel/politik', category: 'politik' },
  { name: 'Zeit Online Politik', url: 'https://rsshub.app/zeit/politik', category: 'politik' },
  { name: 'Handelsblatt', url: 'https://rsshub.app/handelsblatt/news', category: 'wirtschaft' },
  { name: 'Heise Online', url: 'https://rsshub.app/heise/news', category: 'tech' },
  { name: 'Kicker', url: 'https://rsshub.app/kicker/news', category: 'sport' },
  
  // Direct RSS feeds as fallback
  { name: 'ARD Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/', category: 'politik' },
  { name: 'Deutsche Welle', url: 'https://rss.dw.com/xml/rss-de-all', category: 'politik' },
  { name: 'FAZ Politik', url: 'https://www.faz.net/rss/aktuell/politik/', category: 'politik' },
];

async function parseRSSFeed(url: string, source: string, category: string) {
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
      
      // Limit items per feed
      if (items.length >= 10) break;
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
    const { category, limit = 20 } = await req.json();
    
    // Filter sources by category if specified
    const sourcesToFetch = category 
      ? RSS_SOURCES.filter(source => source.category === category)
      : RSS_SOURCES;
    
    console.log(`Fetching from ${sourcesToFetch.length} sources for category: ${category || 'all'}`);
    
    // Fetch from all sources in parallel
    const fetchPromises = sourcesToFetch.map(source => 
      parseRSSFeed(source.url, source.name, source.category)
    );
    
    const results = await Promise.allSettled(fetchPromises);
    
    // Combine and sort articles
    const allArticles = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => (result as PromiseFulfilledResult<any[]>).value)
      .sort((a, b) => new Date(b.pub_date).getTime() - new Date(a.pub_date).getTime())
      .slice(0, limit);
    
    console.log(`Returning ${allArticles.length} articles`);
    
    return new Response(
      JSON.stringify({ 
        articles: allArticles,
        total: allArticles.length,
        sources: sourcesToFetch.length 
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