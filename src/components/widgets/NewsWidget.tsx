import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ExternalLink, Filter, Rss } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  pub_date: string;
  source: string;
  category: string;
  image_url?: string;
}

interface NewsWidgetProps {
  widgetId?: string;
}

export const NewsWidget: React.FC<NewsWidgetProps> = ({ widgetId }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const categories = [
    { value: 'all', label: 'Alle' },
    { value: 'politik', label: 'Politik' },
    { value: 'wirtschaft', label: 'Wirtschaft' },
    { value: 'tech', label: 'Technologie' },
    { value: 'sport', label: 'Sport' }
  ];

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: memberships } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!memberships?.tenant_id) throw new Error('No tenant found');

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const fetchPromise = supabase.functions.invoke('fetch-rss-feeds', {
        body: { 
          category: selectedCategory === 'all' ? undefined : selectedCategory,
          limit: 20,
          tenant_id: memberships.tenant_id
        }
      });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;
      
      setArticles(data?.articles || []);
    } catch (err) {
      console.error('Error fetching news:', err);
      const errorMessage = err instanceof Error && err.message === 'Request timeout' 
        ? 'Zeitüberschreitung beim Laden der Nachrichten'
        : 'Fehler beim Laden der Nachrichten';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Delay initial load to prevent UI blocking
    const timer = setTimeout(() => {
      fetchNews();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [selectedCategory]);

  const filteredArticles = articles.filter(article => 
    selectedCategory === 'all' || article.category === selectedCategory
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rss className="h-4 w-4" />
            News
          </CardTitle>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-background"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        {error && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {error}
            <Button variant="link" onClick={fetchNews} className="ml-2 p-0 h-auto">
              Erneut versuchen
            </Button>
          </div>
        )}
        
        {loading && (
          <div className="p-4 text-center">
            <div className="animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {filteredArticles.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Keine Artikel gefunden
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="group border-b pb-3 last:border-b-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded transition-colors"
                    onClick={() => window.open(article.link, '_blank')}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary">
                        {article.title}
                      </h4>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                    
                    {article.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {article.description}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2 items-center">
                        <Badge variant="secondary" className="text-xs py-0 px-2">
                          {article.source}
                        </Badge>
                        {article.category !== 'general' && (
                          <Badge variant="outline" className="text-xs py-0 px-2">
                            {article.category}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(article.pub_date)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};