import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
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

const PAGE_SIZE = 100;

async function fetchTeamUsers(tenantId: string): Promise<TeamUser[]> {
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

  const profileById = new Map(
    (profileRows || []).map((row: { user_id: string; display_name: string | null; avatar_url: string | null }) => [
      row.user_id,
      { name: row.display_name || "Unbekannt", avatarUrl: row.avatar_url || null },
    ]),
  );

  return memberIds.map((id) => {
    const profile = profileById.get(id);
    return { id, name: profile?.name || "Unbekannt", avatarUrl: profile?.avatarUrl || null };
  });
}

async function fetchItemsPage(tenantId: string, pageParam: number): Promise<{ items: CaseItem[]; nextOffset?: number }> {
  const { data, error } = await supabase
    .from("case_items")
    .select("id, visible_to_all, subject, summary, resolution_summary, source_channel, source_received_at, status, completion_note, completed_at, priority, due_at, case_file_id, user_id, owner_user_id, intake_payload, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(pageParam, pageParam + PAGE_SIZE - 1);
  if (error) throw error;
  const items = (data || []) as unknown as CaseItem[];
  return { items, nextOffset: items.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined };
}

async function fetchFilesPage(tenantId: string, pageParam: number): Promise<{ files: CaseFile[]; nextOffset?: number }> {
  const { data, error } = await supabase
    .from("case_files")
    .select("id, title, status, reference_number, current_status_note, case_type, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .range(pageParam, pageParam + PAGE_SIZE - 1);
  if (error) throw error;
  const files = (data || []) as CaseFile[];
  return { files, nextOffset: files.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined };
}

export const useCaseWorkspaceData = ({ tenantId, userId }: { tenantId?: string; userId?: string }) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(tenantId && userId);

  const itemsQuery = useInfiniteQuery({
    queryKey: ["case-workspace", tenantId, "items"],
    queryFn: ({ pageParam = 0 }) => fetchItemsPage(tenantId!, pageParam),
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const filesQuery = useInfiniteQuery({
    queryKey: ["case-workspace", tenantId, "files"],
    queryFn: ({ pageParam = 0 }) => fetchFilesPage(tenantId!, pageParam),
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const teamUsersQuery = useQuery({
    queryKey: ["case-workspace", tenantId, "team-users"],
    queryFn: () => fetchTeamUsers(tenantId!),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const caseItems = useMemo(
    () => itemsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [itemsQuery.data],
  );
  const caseFiles = useMemo(
    () => filesQuery.data?.pages.flatMap((page) => page.files) ?? [],
    [filesQuery.data],
  );
  const teamUsers = teamUsersQuery.data ?? [];

  const caseFilesById = useMemo(
    () => Object.fromEntries(caseFiles.map((file) => [file.id, file])) as Record<string, CaseFile>,
    [caseFiles],
  );

  const setCaseItems = useCallback((updater: CaseItem[] | ((current: CaseItem[]) => CaseItem[])) => {
    if (!tenantId) return;
    queryClient.setQueryData(["case-workspace", tenantId, "items"], (current: any) => {
      const currentItems = current?.pages?.flatMap((page: { items: CaseItem[] }) => page.items) ?? [];
      const nextItems = typeof updater === "function" ? updater(currentItems) : updater;
      return {
        pageParams: [0],
        pages: [{ items: nextItems, nextOffset: nextItems.length >= PAGE_SIZE ? nextItems.length : undefined }],
      };
    });
  }, [queryClient, tenantId]);

  const setCaseFiles = useCallback((updater: CaseFile[] | ((current: CaseFile[]) => CaseFile[])) => {
    if (!tenantId) return;
    queryClient.setQueryData(["case-workspace", tenantId, "files"], (current: any) => {
      const currentFiles = current?.pages?.flatMap((page: { files: CaseFile[] }) => page.files) ?? [];
      const nextFiles = typeof updater === "function" ? updater(currentFiles) : updater;
      return {
        pageParams: [0],
        pages: [{ files: nextFiles, nextOffset: nextFiles.length >= PAGE_SIZE ? nextFiles.length : undefined }],
      };
    });
  }, [queryClient, tenantId]);

  const refreshAll = useCallback(async () => {
    if (!tenantId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["case-workspace", tenantId, "items"] }),
      queryClient.invalidateQueries({ queryKey: ["case-workspace", tenantId, "files"] }),
      queryClient.invalidateQueries({ queryKey: ["case-workspace", tenantId, "team-users"] }),
    ]);
  }, [queryClient, tenantId]);

  const loadMoreItems = useCallback(async () => {
    if (!itemsQuery.hasNextPage || itemsQuery.isFetchingNextPage) return;
    await itemsQuery.fetchNextPage();
  }, [itemsQuery]);

  const loadMoreFiles = useCallback(async () => {
    if (!filesQuery.hasNextPage || filesQuery.isFetchingNextPage) return;
    await filesQuery.fetchNextPage();
  }, [filesQuery]);

  useEffect(() => {
    if (!tenantId || !userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void refreshAll();
      }, 250);
    };

    const channel = supabase
      .channel(`case-workspace-${tenantId}-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_items", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_files", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tenant_memberships", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [refreshAll, tenantId, userId]);

  const isLoading = itemsQuery.isLoading || filesQuery.isLoading || teamUsersQuery.isLoading;
  const error = (itemsQuery.error || filesQuery.error || teamUsersQuery.error) as Error | null;

  if (error) {
    debugConsole.error("Failed to load case workspace data:", error);
  }

  return {
    data: {
      caseItems,
      caseFiles,
      caseFilesById,
      teamUsers,
      hasMoreItems: Boolean(itemsQuery.hasNextPage),
      hasMoreFiles: Boolean(filesQuery.hasNextPage),
    },
    caseItems,
    setCaseItems,
    caseFiles,
    setCaseFiles,
    caseFilesById,
    teamUsers,
    isLoading,
    loading: isLoading,
    error,
    refetch: refreshAll,
    refreshAll,
    hasMoreItems: Boolean(itemsQuery.hasNextPage),
    hasMoreFiles: Boolean(filesQuery.hasNextPage),
    loadMoreItems,
    loadMoreFiles,
    loadingMoreItems: itemsQuery.isFetchingNextPage,
    loadingMoreFiles: filesQuery.isFetchingNextPage,
  };
};
