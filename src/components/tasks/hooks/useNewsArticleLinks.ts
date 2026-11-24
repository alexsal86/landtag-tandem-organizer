import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { Task } from "@/components/tasks/types";

export interface NewsArticleLink {
  article_id: string;
  title: string;
  link: string;
  source: string;
}

const CHUNK_SIZE = 100;

/**
 * Resolves the persisted news articles behind news-sourced tasks so lists can
 * link straight to the article. Missing articles (older tasks, pruned feeds)
 * simply produce no entry.
 */
export function useNewsArticleLinks(tasks: Pick<Task, "source_type" | "source_id">[]) {
  const ids = useMemo(() => {
    const unique = new Set<string>();
    for (const task of tasks) {
      if (task.source_type === "news" && task.source_id) unique.add(task.source_id);
    }
    return [...unique].sort();
  }, [tasks]);
  const idsKey = ids.join(",");
  const [articles, setArticles] = useState<Record<string, NewsArticleLink>>({});

  useEffect(() => {
    if (!idsKey) {
      setArticles({});
      return;
    }

    const articleIds = idsKey.split(",");
    let cancelled = false;

    const load = async () => {
      const chunks: string[][] = [];
      for (let index = 0; index < articleIds.length; index += CHUNK_SIZE) {
        chunks.push(articleIds.slice(index, index + CHUNK_SIZE));
      }

      const results = await Promise.all(chunks.map((chunk) =>
        supabase
          .from("news_articles")
          .select("article_id,title,link,source")
          .in("article_id", chunk)
      ));

      if (cancelled) return;

      const next: Record<string, NewsArticleLink> = {};
      for (const result of results) {
        if (result.error) {
          debugConsole.error("Error loading news article backlinks:", result.error);
          continue;
        }
        for (const article of result.data ?? []) next[article.article_id] = article;
      }
      setArticles(next);
    };

    void load();
    return () => { cancelled = true; };
  }, [idsKey]);

  return articles;
}
