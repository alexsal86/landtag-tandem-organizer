import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";

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
const EMPTY_ITEMS: CaseItem[] = [];
const EMPTY_FILES: CaseFile[] = [];
const EMPTY_TEAM_USERS: TeamUser[] = [];

const caseWorkspaceKeys = {
  root: (tenantId?: string) => ["case-workspace", tenantId ?? "no-tenant"] as const,
  caseItems: (tenantId?: string) => [...caseWorkspaceKeys.root(tenantId), "case-items"] as const,
  caseFiles: (tenantId?: string) => [...caseWorkspaceKeys.root(tenantId), "case-files"] as const,
  teamUsers: (tenantId?: string) => [...caseWorkspaceKeys.root(tenantId), "team-users"] as const,
};

const flattenInfiniteData = <T,>(data?: InfiniteData<T[], number>): T[] => data?.pages.flat() ?? [];

const paginate = <T,>(rows: T[]): T[][] => {
  if (rows.length === 0) return [[]];

  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    pages.push(rows.slice(i, i + PAGE_SIZE));
  }
  return pages;
};

const toInfiniteData = <T,>(rows: T[]): InfiniteData<T[], number> => {
  const pages = paginate(rows);
  return {
    pages,
    pageParams: pages.map((_, index) => index * PAGE_SIZE),
  };
};

export const useCaseWorkspaceData = ({ tenantId, userId }: { tenantId?: string; userId?: string }) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(tenantId && userId);

  const itemsQueryKey = caseWorkspaceKeys.caseItems(tenantId);
  const filesQueryKey = caseWorkspaceKeys.caseFiles(tenantId);
  const teamUsersQueryKey = caseWorkspaceKeys.teamUsers(tenantId);

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

    const profileById = new Map<string, { name: string; avatarUrl: string | null }>(
      (profileRows || []).map((row: any) => [row.user_id, { name: row.display_name || "Unbekannt", avatarUrl: row.avatar_url || null }]),
    );

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

  const caseItemsQuery = useInfiniteQuery({
    queryKey: itemsQueryKey,
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchItemsPage(pageParam),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => lastPage.length === PAGE_SIZE ? lastPageParam + lastPage.length : undefined,
  });

  const caseFilesQuery = useInfiniteQuery({
    queryKey: filesQueryKey,
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFilesPage(pageParam),
    getNextPageParam: (lastPage, _allPages, lastPageParam) => lastPage.length === PAGE_SIZE ? lastPageParam + lastPage.length : undefined,
  });

  const teamUsersQuery = useQuery({
    queryKey: teamUsersQueryKey,
    enabled,
    queryFn: fetchTeamUsers,
  });

  const caseItems = useMemo(() => enabled ? flattenInfiniteData(caseItemsQuery.data) : EMPTY_ITEMS, [enabled, caseItemsQuery.data]);
  const caseFiles = useMemo(() => enabled ? flattenInfiniteData(caseFilesQuery.data) : EMPTY_FILES, [enabled, caseFilesQuery.data]);
  const teamUsers = teamUsersQuery.data ?? EMPTY_TEAM_USERS;

  const setInfiniteRows = useCallback(<T,>(queryKey: readonly unknown[], updater: SetStateAction<T[]>) => {
    queryClient.setQueryData<InfiniteData<T[], number>>(queryKey, (current) => {
      const currentRows = flattenInfiniteData(current);
      const nextRows = typeof updater === "function"
        ? (updater as (prevState: T[]) => T[])(currentRows)
        : updater;

      return toInfiniteData(nextRows);
    });
  }, [queryClient]);

  const setCaseItems: Dispatch<SetStateAction<CaseItem[]>> = useCallback((updater) => {
    setInfiniteRows(itemsQueryKey, updater);
  }, [itemsQueryKey, setInfiniteRows]);

  const refreshAll = useCallback(async () => {
    if (!enabled) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: itemsQueryKey }),
      queryClient.invalidateQueries({ queryKey: filesQueryKey }),
      queryClient.invalidateQueries({ queryKey: teamUsersQueryKey }),
    ]);

    await Promise.all([
      caseItemsQuery.refetch(),
      caseFilesQuery.refetch(),
      teamUsersQuery.refetch(),
    ]);
  }, [enabled, queryClient, itemsQueryKey, filesQueryKey, teamUsersQueryKey, caseItemsQuery, caseFilesQuery, teamUsersQuery]);

  const loadMoreItems = useCallback(async () => {
    if (!caseItemsQuery.hasNextPage || caseItemsQuery.isFetchingNextPage) return;
    await caseItemsQuery.fetchNextPage();
  }, [caseItemsQuery]);

  const loadMoreFiles = useCallback(async () => {
    if (!caseFilesQuery.hasNextPage || caseFilesQuery.isFetchingNextPage) return;
    await caseFilesQuery.fetchNextPage();
  }, [caseFilesQuery]);

  useEffect(() => {
    if (!enabled) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        void refreshAll();
      }, 250);
    };

    const handleCaseItemChange = (payload: any) => {
      const eventType = payload.eventType as string;
      const newRow = payload.new as CaseItem | undefined;
      const oldRow = payload.old as { id?: string } | undefined;

      if (eventType === "INSERT" && newRow) {
        setCaseItems((prev) => {
          if (prev.some((item) => item.id === newRow.id)) return prev;
          return [newRow, ...prev];
        });
        return;
      }

      if (eventType === "UPDATE" && newRow) {
        setCaseItems((prev) => {
          const idx = prev.findIndex((item) => item.id === newRow.id);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = newRow;
          return updated;
        });
        return;
      }

      if (eventType === "DELETE" && oldRow?.id) {
        setCaseItems((prev) => prev.filter((item) => item.id !== oldRow.id));
        return;
      }

      scheduleRefresh();
    };

    const handleCaseFileChange = (payload: any) => {
      const eventType = payload.eventType as string;
      const newRow = payload.new as CaseFile | undefined;
      const oldRow = payload.old as { id?: string } | undefined;

      if (eventType === "INSERT" && newRow) {
        setInfiniteRows(filesQueryKey, (prev: CaseFile[]) => {
          if (prev.some((file) => file.id === newRow.id)) return prev;
          return [newRow, ...prev];
        });
        return;
      }

      if (eventType === "UPDATE" && newRow) {
        setInfiniteRows(filesQueryKey, (prev: CaseFile[]) => {
          const idx = prev.findIndex((file) => file.id === newRow.id);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = newRow;
          return updated;
        });
        return;
      }

      if (eventType === "DELETE" && oldRow?.id) {
        setInfiniteRows(filesQueryKey, (prev: CaseFile[]) => prev.filter((file) => file.id !== oldRow.id));
        return;
      }

      scheduleRefresh();
    };

    const channel = supabase
      .channel(`case-workspace-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_items", filter: `tenant_id=eq.${tenantId}` }, handleCaseItemChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_files", filter: `tenant_id=eq.${tenantId}` }, handleCaseFileChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_decisions", filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [enabled, filesQueryKey, refreshAll, setCaseItems, setInfiniteRows, tenantId]);

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
    loading: enabled ? (caseItemsQuery.isLoading || caseFilesQuery.isLoading || teamUsersQuery.isLoading) : false,
    refreshAll,
    hasMoreItems: Boolean(caseItemsQuery.hasNextPage),
    hasMoreFiles: Boolean(caseFilesQuery.hasNextPage),
    loadMoreItems,
    loadMoreFiles,
    loadingMoreItems: caseItemsQuery.isFetchingNextPage,
    loadingMoreFiles: caseFilesQuery.isFetchingNextPage,
  };
};
