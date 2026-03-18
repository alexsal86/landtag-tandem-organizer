import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";

export type CaseItem = {
  id: string;
  visible_to_all: boolean;
  subject: string | null;
  resolution_summary: string | null;
  summary: string | null;
  source_channel: string | null;
  source_received_at: string | null;
  status: string | null;
  completion_note: string | null;
  completed_at: string | null;
  priority: string | null;
  due_at: string | null;
  case_file_id: string | null;
  user_id: string | null;
  owner_user_id: string | null;
  intake_payload: CaseItemIntakePayload | null;
  updated_at: string | null;
};

export type CaseFile = {
  id: string;
  title: string;
  status: string;
  reference_number: string | null;
  current_status_note: string | null;
  case_type: string | null;
  updated_at: string;
};

export type TeamUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type WorkspaceCache = {
  caseItems: CaseItem[];
  caseFiles: CaseFile[];
  teamUsers: TeamUser[];
  itemsOffset: number;
  filesOffset: number;
  hasMoreItems: boolean;
  hasMoreFiles: boolean;
};

const PAGE_SIZE = 100;
const workspaceCache = new Map<string, WorkspaceCache>();

const EMPTY_CACHE: WorkspaceCache = {
  caseItems: [],
  caseFiles: [],
  teamUsers: [],
  itemsOffset: 0,
  filesOffset: 0,
  hasMoreItems: true,
  hasMoreFiles: true,
};

export const useCaseWorkspaceData = ({ tenantId, userId }: { tenantId?: string; userId?: string }) => {
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreItems, setLoadingMoreItems] = useState(false);
  const [loadingMoreFiles, setLoadingMoreFiles] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const itemsOffsetRef = useRef(0);
  const filesOffsetRef = useRef(0);

  const persistCache = useCallback((patch: Partial<WorkspaceCache>) => {
    if (!tenantId) return;
    const current = workspaceCache.get(tenantId) ?? EMPTY_CACHE;
    workspaceCache.set(tenantId, { ...current, ...patch });
  }, [tenantId]);

  const fetchTeamUsers = useCallback(async () => {
    if (!tenantId) return [] as TeamUser[];
    const { data: membersRes, error: membersError } = await supabase
      .from("user_tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (membersError) throw membersError;
    const memberIds = ((membersRes || []) as Array<{ user_id: string }>).map((row) => row.user_id);
    if (memberIds.length === 0) return [];

    const { data: profileRows, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", memberIds);
    if (profilesError) throw profilesError;

    const profileById = new Map<string, any>((profileRows || []).map((row) => [row.user_id, { name: row.display_name || "Unbekannt", avatarUrl: row.avatar_url || null }]));
    return memberIds.map((id) => {
      const profile = profileById.get(id);
      return { id, name: profile?.name || "Unbekannt", avatarUrl: profile?.avatarUrl || null };
    });
  }, [tenantId]);

  const fetchItemsPage = useCallback(async (offset: number) => {
    if (!tenantId) return [] as CaseItem[];
    const { data, error } = await supabase
      .from("case_items")
      .select("id, visible_to_all, subject, summary, resolution_summary, source_channel, source_received_at, status, completion_note, completed_at, priority, due_at, case_file_id, user_id, owner_user_id, intake_payload, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return (data || []) as unknown as CaseItem[];
  }, [tenantId]);

  const fetchFilesPage = useCallback(async (offset: number) => {
    if (!tenantId) return [] as CaseFile[];
    const { data, error } = await supabase
      .from("case_files")
      .select("id, title, status, reference_number, current_status_note, case_type, updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    return (data || []) as CaseFile[];
  }, [tenantId]);

  const refreshAll = useCallback(async () => {
    if (!tenantId || !userId) {
      setCaseItems([]);
      setCaseFiles([]);
      setTeamUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [items, files, users] = await Promise.all([fetchItemsPage(0), fetchFilesPage(0), fetchTeamUsers()]);
      itemsOffsetRef.current = items.length;
      filesOffsetRef.current = files.length;
      setCaseItems(items);
      setCaseFiles(files);
      setTeamUsers(users);
      setHasMoreItems(items.length === PAGE_SIZE);
      setHasMoreFiles(files.length === PAGE_SIZE);
      persistCache({
        caseItems: items,
        caseFiles: files,
        teamUsers: users,
        itemsOffset: items.length,
        filesOffset: files.length,
        hasMoreItems: items.length === PAGE_SIZE,
        hasMoreFiles: files.length === PAGE_SIZE,
      });
    } catch (error) {
      debugConsole.error("Failed to refresh case workspace data:", error);
      setCaseItems([]);
      setCaseFiles([]);
      setTeamUsers([]);
      setHasMoreItems(false);
      setHasMoreFiles(false);
    } finally {
      setLoading(false);
    }
  }, [fetchFilesPage, fetchItemsPage, fetchTeamUsers, persistCache, tenantId, userId]);

  const loadMoreItems = useCallback(async () => {
    if (!hasMoreItems || loadingMoreItems) return;
    setLoadingMoreItems(true);
    try {
      const next = await fetchItemsPage(itemsOffsetRef.current);
      itemsOffsetRef.current += next.length;
      const hasMore = next.length === PAGE_SIZE;
      setCaseItems((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const dedupedNext = next.filter((item) => !existing.has(item.id));
        const merged = [...prev, ...dedupedNext];
        persistCache({ caseItems: merged, itemsOffset: itemsOffsetRef.current, hasMoreItems: hasMore });
        return merged;
      });
      setHasMoreItems(hasMore);
    } finally {
      setLoadingMoreItems(false);
    }
  }, [fetchItemsPage, hasMoreItems, loadingMoreItems, persistCache]);

  const loadMoreFiles = useCallback(async () => {
    if (!hasMoreFiles || loadingMoreFiles) return;
    setLoadingMoreFiles(true);
    try {
      const next = await fetchFilesPage(filesOffsetRef.current);
      filesOffsetRef.current += next.length;
      const hasMore = next.length === PAGE_SIZE;
      setCaseFiles((prev) => {
        const existing = new Set(prev.map((file) => file.id));
        const dedupedNext = next.filter((file) => !existing.has(file.id));
        const merged = [...prev, ...dedupedNext];
        persistCache({ caseFiles: merged, filesOffset: filesOffsetRef.current, hasMoreFiles: hasMore });
        return merged;
      });
      setHasMoreFiles(hasMore);
    } finally {
      setLoadingMoreFiles(false);
    }
  }, [fetchFilesPage, hasMoreFiles, loadingMoreFiles, persistCache]);

  useEffect(() => {
    if (!tenantId || !userId) {
      setCaseItems([]);
      setCaseFiles([]);
      setTeamUsers([]);
      setLoading(false);
      return;
    }

    const cached = workspaceCache.get(tenantId);
    if (cached) {
      setCaseItems(cached.caseItems);
      setCaseFiles(cached.caseFiles);
      setTeamUsers(cached.teamUsers);
      itemsOffsetRef.current = cached.itemsOffset;
      filesOffsetRef.current = cached.filesOffset;
      setHasMoreItems(cached.hasMoreItems);
      setHasMoreFiles(cached.hasMoreFiles);
      setLoading(false);
    } else {
      setCaseItems([]);
      setCaseFiles([]);
      setTeamUsers([]);
      itemsOffsetRef.current = 0;
      filesOffsetRef.current = 0;
      setHasMoreItems(true);
      setHasMoreFiles(true);
    }

    void refreshAll();
  }, [refreshAll, tenantId, userId]);

  useEffect(() => {
    if (!tenantId || !userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void refreshAll();
      }, 250);
    };

    const channel = supabase
      .channel(`case-workspace-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_items", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_files", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [refreshAll, tenantId, userId]);

  const caseFilesById = useMemo(() => caseFiles.reduce<Record<string, CaseFile>>((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {}), [caseFiles]);

  return {
    caseItems,
    setCaseItems,
    caseFiles,
    caseFilesById,
    teamUsers,
    loading,
    refreshAll,
    hasMoreItems,
    hasMoreFiles,
    loadMoreItems,
    loadMoreFiles,
    loadingMoreItems,
    loadingMoreFiles,
  };
};
