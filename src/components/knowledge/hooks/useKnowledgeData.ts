import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { debugConsole } from '@/utils/debugConsole';

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string | null;
  plain_text: string;
  content_nodes: string | null;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean | null;
  is_locked: boolean | null;
  creator_name?: string | null;
  content_html?: string | null;
  document_version?: number | null;
  editing_started_at?: string | null;
  editing_user_id?: string | null;
  is_template?: boolean | null;
  locked_by?: string | null;
  tenant_id?: string;
}

interface KnowledgeDocumentRow {
  id: string;
  title: string;
  content: string | null;
  category: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  is_locked: boolean | null;
}

export interface LexicalChangePayload {
  plainText: string;
  nodesJson?: string;
  html?: string;
}

interface PersistedKnowledgeContentV1 {
  format: 'lexical-v1';
  plain_text: string;
  content_nodes: Record<string, unknown> | null;
  content_html: string | null;
}

const KNOWLEDGE_FORMAT = 'lexical-v1';

export const serializeKnowledgeContent = (payload: LexicalChangePayload): string => {
  let contentNodes: Record<string, unknown> | null = null;
  if (payload.nodesJson && payload.nodesJson.trim()) {
    try {
      contentNodes = JSON.parse(payload.nodesJson) as Record<string, unknown>;
    } catch {
      contentNodes = null;
    }
  }
  const next: PersistedKnowledgeContentV1 = {
    format: KNOWLEDGE_FORMAT,
    plain_text: payload.plainText ?? '',
    content_nodes: contentNodes,
    content_html: payload.html?.trim() ? payload.html : null,
  };
  return JSON.stringify(next);
};

export const parseKnowledgeContent = (raw: string | null | undefined): LexicalChangePayload & { storageContent: string | null } => {
  if (!raw?.trim()) {
    return { plainText: '', nodesJson: undefined, html: undefined, storageContent: raw ?? null };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedKnowledgeContentV1>;
    if (parsed?.format === KNOWLEDGE_FORMAT) {
      return {
        plainText: parsed.plain_text ?? '',
        nodesJson: parsed.content_nodes ? JSON.stringify(parsed.content_nodes) : undefined,
        html: parsed.content_html ?? undefined,
        storageContent: raw,
      };
    }
  } catch {
    // Legacy plain text format.
  }

  return { plainText: raw, nodesJson: undefined, html: undefined, storageContent: raw };
};

export function useKnowledgeData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [documentTopicsMap, setDocumentTopicsMap] = useState<Record<string, string[]>>({});
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [editorContent, setEditorContent] = useState<LexicalChangePayload>({ plainText: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const fetchCreatorNames = useCallback(async (rows: KnowledgeDocumentRow[]) => {
    const ids = Array.from(new Set(rows.map(r => r.created_by).filter(Boolean)));
    if (ids.length === 0) return {} as Record<string, string>;
    const { data, error } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
    if (error) throw error;
    return ((data ?? []) as any[]).reduce<Record<string, string>>((acc, p) => { acc[p.user_id] = p.display_name || 'Unbekannt'; return acc; }, {});
  }, []);

  const hydrateDocuments = useCallback(async (rows: KnowledgeDocumentRow[]) => {
    const names = await fetchCreatorNames(rows);
    return rows.map(r => {
      const parsed = parseKnowledgeContent(r.content);
      return {
        ...r,
        is_locked: r.is_locked || false,
        creator_name: names[r.created_by] || 'Unbekannt',
        plain_text: parsed.plainText,
        content_nodes: parsed.nodesJson ?? null,
        content_html: parsed.html ?? null,
      };
    });
  }, [fetchCreatorNames]);

  const fetchAllDocumentTopics = useCallback(async (docIds: string[]) => {
    if (docIds.length === 0) return;
    const { data, error } = await supabase.from('knowledge_document_topics').select('document_id, topic_id').in('document_id', docIds);
    if (error) { debugConsole.error('Error fetching document topics:', error); return; }
    const map: Record<string, string[]> = {};
    data?.forEach((item: Record<string, any>) => { if (!map[item.document_id]) map[item.document_id] = []; map[item.document_id].push(item.topic_id); });
    setDocumentTopicsMap(map);
  }, []);

  const fetchDocumentTopicsById = useCallback(async (docId: string) => {
    const { data, error } = await supabase.from('knowledge_document_topics').select('topic_id').eq('document_id', docId);
    if (error) { debugConsole.error('Error fetching document topics:', error); return; }
    setDocumentTopicsMap(prev => ({ ...prev, [docId]: (data ?? []).map(i: Record<string, any> => i.topic_id) }));
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.from('knowledge_documents').select('id, title, content, category, created_by, created_at, updated_at, is_published, is_locked').order('updated_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as KnowledgeDocumentRow[];
      if (rows.length > 0) {
        const docs = await hydrateDocuments(rows);
        setDocuments(docs);
        await fetchAllDocumentTopics(docs.map(d => d.id));
      } else { setDocuments([]); }
    } catch (error) {
      debugConsole.error('Error fetching documents:', error);
      toast({ title: "Fehler beim Laden der Dokumente", description: "Die Dokumente konnten nicht geladen werden.", variant: "destructive" });
    } finally { setLoading(false); }
  }, [user, hydrateDocuments, fetchAllDocumentTopics, toast]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  useEffect(() => {
    if (!user) { setTenantId(null); return; }
    supabase.rpc('get_user_primary_tenant_id', { _user_id: user.id }).then(({ data }) => setTenantId(data));
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user || !tenantId) return;
    const channelName = `knowledge-docs-${tenantId}-${crypto.randomUUID()}`;
    const channel = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_documents', filter: `tenant_id=eq.${tenantId}` }, async (payload: Record<string, any>) => {
      if (payload.eventType === 'DELETE') {
        const deletedId = (payload.old as any)?.id;
        if (!deletedId) return;
        setDocuments(prev => prev.filter(d => d.id !== deletedId));
        setDocumentTopicsMap(prev => { const { [deletedId]: _, ...rest } = prev; return rest; });
        if (selectedDocument?.id === deletedId) navigate('/knowledge', { replace: true });
        return;
      }
      const nextRow = payload.new as KnowledgeDocumentRow | null;
      if (!nextRow) return;
      try {
        const [next] = await hydrateDocuments([nextRow]);
        setDocuments(prev => { const idx = prev.findIndex(d => d.id === next.id); if (idx === -1) return [next, ...prev]; const u = [...prev]; u[idx] = { ...u[idx], ...next }; return u; });
        if (selectedDocument?.id === next.id) setSelectedDocument(prev => prev ? { ...prev, ...next } : prev);
        await fetchDocumentTopicsById(next.id);
      } catch { fetchDocuments(); }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, tenantId, selectedDocument?.id, navigate, hydrateDocuments, fetchDocumentTopicsById, fetchDocuments]);

  const handleCreateDocument = async (newDoc: { title: string; content: string; is_published: boolean; selectedTopics: string[] }) => {
    if (!user || !newDoc.title.trim() || !tenantId) return;
    try {
      const initialContent = serializeKnowledgeContent({ plainText: newDoc.content || '' });
      const { data, error } = await supabase.from('knowledge_documents').insert([{ title: newDoc.title, content: initialContent, category: 'general', created_by: user.id, tenant_id: tenantId, is_published: newDoc.is_published, is_locked: false }]).select().single();
      if (error) throw error;
      if (newDoc.selectedTopics.length > 0) {
        await supabase.from('knowledge_document_topics').insert(newDoc.selectedTopics.map(t => ({ document_id: data.id, topic_id: t })));
      }
      toast({ title: "Dokument erstellt", description: "Das neue Dokument wurde erfolgreich erstellt." });
      const parsed = parseKnowledgeContent(data.content);
      const doc = {
        ...data,
        is_locked: false,
        creator_name: user.user_metadata?.display_name || user.email || 'Unknown',
        plain_text: parsed.plainText,
        content_nodes: parsed.nodesJson ?? null,
        content_html: parsed.html ?? null,
      };
      setSelectedDocument(doc);
      setEditorContent(parseKnowledgeContent(data.content));
      setIsEditorOpen(true);
      setIsSidebarCollapsed(false);
      navigate(`/knowledge/${data.id}`, { replace: true });
    } catch (error) {
      debugConsole.error('Error creating document:', error);
      toast({ title: "Fehler beim Erstellen", description: "Das Dokument konnte nicht erstellt werden.", variant: "destructive" });
    }
  };

  const handleSaveDocument = async (topicIds: string[], setTopicsFn: (ids: string[]) => Promise<any>) => {
    if (!selectedDocument || !user) return;
    try {
      const persistedContent = serializeKnowledgeContent(editorContent);
      const { error } = await supabase.from('knowledge_documents').update({ content: persistedContent, updated_at: new Date().toISOString() }).eq('id', selectedDocument.id);
      if (error) throw error;
      await setTopicsFn(topicIds);
      setHasUnsavedChanges(false);
      toast({ title: "Gespeichert", description: "Das Dokument wurde gespeichert." });
      setSelectedDocument(prev => prev ? {
        ...prev,
        content: persistedContent,
        plain_text: editorContent.plainText,
        content_nodes: editorContent.nodesJson ?? null,
        content_html: editorContent.html ?? null,
      } : null);
    } catch (error) {
      debugConsole.error('Error saving document:', error);
      toast({ title: "Fehler beim Speichern", description: "Das Dokument konnte nicht gespeichert werden.", variant: "destructive" });
    }
  };

  const handleToggleLock = async () => {
    if (!selectedDocument || !user) return;
    if (selectedDocument.created_by !== user.id) { toast({ title: "Keine Berechtigung", description: "Nur der Ersteller kann den Sperrstatus ändern.", variant: "destructive" }); return; }
    try {
      const newLock = !selectedDocument.is_locked;
      const { error } = await supabase.from('knowledge_documents').update({ is_locked: newLock }).eq('id', selectedDocument.id);
      if (error) throw error;
      setSelectedDocument(prev => prev ? { ...prev, is_locked: newLock } : null);
      setDocuments(prev => prev.map(d => d.id === selectedDocument.id ? { ...d, is_locked: newLock } : d));
      toast({ title: newLock ? "Dokument gesperrt" : "Dokument entsperrt", description: newLock ? "Das Dokument ist jetzt schreibgeschützt." : "Das Dokument kann jetzt bearbeitet werden." });
    } catch (error) {
      toast({ title: "Fehler", description: "Der Sperrstatus konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      const { error } = await supabase.from('knowledge_documents').delete().eq('id', docId);
      if (error) throw error;
      toast({ title: "Dokument gelöscht", description: "Das Dokument wurde erfolgreich gelöscht." });
      if (selectedDocument?.id === docId) navigate('/knowledge', { replace: true });
    } catch (error) {
      toast({ title: "Fehler beim Löschen", description: "Das Dokument konnte nicht gelöscht werden.", variant: "destructive" });
    }
  };

  return {
    documents, loading, tenantId, documentTopicsMap, selectedDocument,
    editorContent, hasUnsavedChanges, isEditorOpen, isSidebarCollapsed,
    setSelectedDocument, setEditorContent, setHasUnsavedChanges,
    setIsEditorOpen, setIsSidebarCollapsed,
    handleCreateDocument, handleSaveDocument, handleToggleLock, handleDeleteDocument,
  };
}
