import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { debugConsole } from '@/utils/debugConsole';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  title: string;
  content: string | null;
  content_html: string | null;
  created_by: string;
  created_at: string;
  change_summary: string | null;
  creator_name?: string;
}

export function useKnowledgeVersionHistory(documentId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!documentId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_document_versions')
        .select('id, document_id, version_number, title, content, content_html, created_by, created_at, change_summary')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const creatorIds = [...new Set((data ?? []).map((v: Record<string, any>) => v.created_by))];
      let nameMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', creatorIds);
        nameMap = ((profiles ?? []) as any[]).reduce<Record<string, string>>((acc, p) => {
          acc[p.user_id] = p.display_name || 'Unbekannt';
          return acc;
        }, {});
      }

      setVersions(
        (data ?? []).map((v: Record<string, any>) => ({
          ...v,
          creator_name: nameMap[v.created_by] || 'Unbekannt',
        }))
      );
    } catch (err) {
      debugConsole.error('Error fetching versions:', err);
      toast({ title: 'Fehler', description: 'Versionshistorie konnte nicht geladen werden.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [documentId, user, toast]);

  const createVersion = useCallback(async (
    doc: { id: string; title: string; content: string | null; content_html?: string | null; tenant_id?: string },
    changeSummary?: string,
  ) => {
    if (!user || !doc.tenant_id) return;

    try {
      // Get next version number
      const { data: latest } = await supabase
        .from('knowledge_document_versions')
        .select('version_number')
        .eq('document_id', doc.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latest?.version_number ?? 0) + 1;

      const { error } = await supabase.from('knowledge_document_versions').insert({
        document_id: doc.id,
        version_number: nextVersion,
        title: doc.title,
        content: doc.content,
        content_html: doc.content_html ?? null,
        created_by: user.id,
        change_summary: changeSummary ?? null,
        tenant_id: doc.tenant_id,
      });

      if (error) throw error;
    } catch (err) {
      debugConsole.error('Error creating version:', err);
    }
  }, [user]);

  return { versions, loading, fetchVersions, createVersion };
}
