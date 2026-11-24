import React, { useState, useEffect } from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ExternalLink, Rss, Share2, CheckSquare, Bookmark, BookmarkCheck, Check, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NewsShareDialog } from './NewsShareDialog';
import { NewsToTaskDialog } from './NewsToTaskDialog';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui-patterns';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  pub_date: string;
  source: string;
  category: string;
  image_url?: string;
  is_read?: boolean;
  is_saved?: boolean;
  read_at?: string | null;
  saved_at?: string | null;
}

interface NewsWidgetProps {
  widgetId?: string;
  compact?: boolean;
}

type NewsView = 'all' | 'unread' | 'saved';

export const NewsWidget: React.FC<NewsWidgetProps> = ({ compact = false }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [view, setView] = useState<NewsView>('all');
  const [error, setError] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

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

      setUserId(user.id);
      setTenantId(memberships.tenant_id);

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

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as { data?: { articles?: NewsArticle[] }; error?: unknown };

      if (error) throw error;
      
      setArticles(data?.articles || []);
    } catch (err) {
      debugConsole.error('Error fetching news:', err);
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

  /** Persists gelesen/merken for the current user; the article id is stable. */
  const updateArticleState = async (article: NewsArticle, patch: { is_read?: boolean; is_saved?: boolean }) => {
    if (!userId || !tenantId) return;

    const nextRead = patch.is_read ?? Boolean(article.is_read);
    const nextSaved = patch.is_saved ?? Boolean(article.is_saved);
    const now = new Date().toISOString();
    const readAt = nextRead ? (article.read_at ?? now) : null;
    const savedAt = nextSaved ? (article.saved_at ?? now) : null;

    const { error } = await supabase
      .from('news_article_states')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        article_id: article.id,
        is_read: nextRead,
        is_saved: nextSaved,
        read_at: readAt,
        saved_at: savedAt,
      }, { onConflict: 'tenant_id,user_id,article_id' });

    if (error) {
      debugConsole.error('Error updating news article state:', error);
      return;
    }

    setArticles((current) => current.map((entry) =>
      entry.id === article.id
        ? { ...entry, is_read: nextRead, is_saved: nextSaved, read_at: readAt, saved_at: savedAt }
        : entry
    ));
  };

  const openArticle = (article: NewsArticle) => {
    window.open(article.link, '_blank');
    if (!article.is_read) void updateArticleState(article, { is_read: true });
  };

  const filteredArticles = articles
    .filter(article => selectedCategory === 'all' || article.category === selectedCategory)
    .filter(article => view === 'all' || (view === 'unread' ? !article.is_read : Boolean(article.is_saved)));

  const savedCount = articles.filter(article => article.is_saved).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const decodeHtmlEntities = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    if (date >= startOfToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    if (date >= startOfYesterday) {
      return 'gestern';
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  if (compact) {
    return (
      <>
        <div>
          {loading && <LoadingState variant="list" rows={3} />}
          {error && <ErrorState description={error} onRetry={fetchNews} />}
          {!loading && !error && (
            <div className="divide-y divide-border">
              {filteredArticles.length === 0 ? (
                <EmptyState icon={Rss} size="sm" title="Keine Artikel gefunden" />
              ) : (
                filteredArticles.slice(0, 6).map((article) => (
                  <div
                    key={article.id}
                    className="group cursor-pointer py-3 first:pt-0 last:pb-0 -mx-2 px-2 rounded hover:bg-muted/30 transition-colors"
                    onClick={() => openArticle(article)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2 text-xs">
                        <span className="font-bold text-primary truncate">{article.source}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{formatRelativeTime(article.pub_date)}</span>
                        {article.is_saved && (
                          <BookmarkCheck className="h-3 w-3 shrink-0 text-primary" aria-label="Gemerkt" />
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateArticleState(article, { is_read: !article.is_read });
                          }}
                          title={article.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                          aria-label={article.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                        >
                          {article.is_read ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateArticleState(article, { is_saved: !article.is_saved });
                          }}
                          title={article.is_saved ? 'Aus Merkliste entfernen' : 'Merken'}
                          aria-label={article.is_saved ? 'Aus Merkliste entfernen' : 'Merken'}
                        >
                          {article.is_saved ? <BookmarkCheck className="h-3 w-3 text-primary" /> : <Bookmark className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArticle(article);
                            setShareDialogOpen(true);
                          }}
                          title="News teilen"
                          aria-label="News teilen"
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArticle(article);
                            setTaskDialogOpen(true);
                          }}
                          title="Aufgabe erstellen"
                          aria-label="Aufgabe erstellen"
                        >
                          <CheckSquare className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className={`text-body leading-snug line-clamp-2 ${article.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {decodeHtmlEntities(article.title)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <NewsShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          article={selectedArticle}
        />

        <NewsToTaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          article={selectedArticle}
        />
      </>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rss className="h-4 w-4" />
            News
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Kategorie"
              className="text-xs px-2 py-1 border rounded bg-background"
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              value={view}
              onChange={(e) => setView(e.target.value as NewsView)}
              aria-label="Ansicht"
              className="text-xs px-2 py-1 border rounded bg-background"
            >
              <option value="all">Alle</option>
              <option value="unread">Ungelesen</option>
              <option value="saved">Gemerkt{savedCount > 0 ? ` (${savedCount})` : ''}</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              disabled={loading}
              aria-label="Nachrichten neu laden"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        {error && (
          <div className="p-space-md">
            <ErrorState description={error} onRetry={fetchNews} />
          </div>
        )}

        {loading && (
          <div className="p-space-md">
            <LoadingState variant="card" rows={3} />
          </div>
        )}

        {!loading && !error && (
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
              {filteredArticles.length === 0 ? (
                <EmptyState
                  icon={Rss}
                  title={
                    view === 'saved'
                      ? 'Noch keine gemerkten Artikel'
                      : view === 'unread'
                        ? 'Alles gelesen'
                        : 'Keine Artikel gefunden'
                  }
                  description={
                    view === 'all'
                      ? 'Wähle eine andere Kategorie oder lade die Liste neu.'
                      : 'Wechsle die Ansicht, um alle Nachrichten zu sehen.'
                  }
                  action={{ label: 'Neu laden', icon: RefreshCw, onClick: fetchNews }}
                />
              ) : (
                filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="group border-b pb-3 last:border-b-0 -mx-2 px-2 py-2 rounded transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h4 
                        className={`font-medium text-sm line-clamp-2 hover:text-primary cursor-pointer flex-1 ${article.is_read ? 'text-muted-foreground' : ''}`}
                        onClick={() => openArticle(article)}
                      >
                        {decodeHtmlEntities(article.title)}
                      </h4>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateArticleState(article, { is_read: !article.is_read });
                          }}
                          title={article.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                          aria-label={article.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                        >
                          {article.is_read ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateArticleState(article, { is_saved: !article.is_saved });
                          }}
                          title={article.is_saved ? 'Aus Merkliste entfernen' : 'Merken'}
                          aria-label={article.is_saved ? 'Aus Merkliste entfernen' : 'Merken'}
                        >
                          {article.is_saved ? <BookmarkCheck className="h-3 w-3 text-primary" /> : <Bookmark className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArticle(article);
                            setShareDialogOpen(true);
                          }}
                          title="News teilen"
                          aria-label="News teilen"
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArticle(article);
                            setTaskDialogOpen(true);
                          }}
                          title="Aufgabe erstellen"
                          aria-label="Aufgabe erstellen"
                        >
                          <CheckSquare className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openArticle(article);
                          }}
                          title="Artikel öffnen"
                          aria-label="Artikel öffnen"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {article.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {decodeHtmlEntities(article.description)}
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
                        {article.is_saved && (
                          <Badge variant="outline" className="text-xs py-0 px-2 gap-1">
                            <BookmarkCheck className="h-3 w-3" />
                            Gemerkt
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

      <NewsShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        article={selectedArticle}
      />

      <NewsToTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        article={selectedArticle}
      />
    </Card>
  );
};
