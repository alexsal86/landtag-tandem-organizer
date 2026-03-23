import { useCallback, useEffect, useMemo } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { debugConsole } from "@/utils/debugConsole";

type CaseItemsRow = Pick<
  Database["public"]["Tables"]["case_items"]["Row"],
  | "id"
  | "visible_to_all"
  | "subject"
  | "resolution_summary"
  | "summary"
  | "source_channel"
  | "source_received_at"
  | "status"
  | "completion_note"
  | "completed_at"
  | "priority"
  | "due_at"
  | "case_file_id"
  | "user_id"
  | "owner_user_id"
  | "updated_at"
> & {
  intake_payload: CaseItemIntakePayload | null;
};

type CaseFilesRow = Pick<
  Database["public"]["Tables"]["case_files"]["Row"],
  | "id"
  | "title"
  | "status"
  | "reference_number"
  | "current_status_note"
  | "case_type"
  | "updated_at"
>;

type TeamMembershipRow = Pick<
  Database["public"]["Tables"]["user_tenant_memberships"]["Row"],
  "user_id"
>;

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "user_id" | "display_name" | "avatar_url"
>;

export type CaseItem = CaseItemsRow;
export type CaseFile = CaseFilesRow;

export type TeamUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type ItemsPage = { items: CaseItem[]; nextOffset?: number };
type FilesPage = { files: CaseFile[]; nextOffset?: number };
type ItemsInfiniteData = InfiniteData<ItemsPage, number>;
type FilesInfiniteData = InfiniteData<FilesPage, number>;

type QueryDataErrorContext = {
  scope: "team-users" | "items" | "files";
  tenantId: string;
  pageParam?: number;
};

const PAGE_SIZE = 100;
const UNKNOWN_USER_LABEL = "Unbekannt";

function logAndThrowQueryError(error: Error, context: QueryDataErrorContext): never {
  debugConsole.error("[useCaseWorkspaceData] Failed to fetch workspace data", {
    ...context,
    message: error.message,
  }, error);
  throw error;
}

function buildNextOffset(currentOffset: number, loadedCount: number): number | undefined {
  return loadedCount === PAGE_SIZE ? currentOffset + PAGE_SIZE : undefined;
}

function mapProfileToTeamUser(profile?: ProfileRow): Omit<TeamUser, "id"> {
  return {
    name: profile?.display_name || UNKNOWN_USER_LABEL,
    avatarUrl: profile?.avatar_url || null,
  };
}

async function fetchTeamUsers(tenantId: string): Promise<TeamUser[]> {
  const { data: membershipRows, error } = await supabase
    .from("user_tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) {
    logAndThrowQueryError(error, { scope: "team-users", tenantId });
  }

  const membershipData: TeamMembershipRow[] = membershipRows ?? [];
  const memberIds = membershipData.map((row) => row.user_id);

  if (memberIds.length === 0) {
    debugConsole.log("[useCaseWorkspaceData] No active team users found", { tenantId });
    return [];
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", memberIds);

  if (profileError) {
    logAndThrowQueryError(profileError, { scope: "team-users", tenantId });
  }

  const profiles: ProfileRow[] = profileRows ?? [];
  const profileById = new Map<string, Omit<TeamUser, "id">>(
    profiles.map((profile) => [profile.user_id, mapProfileToTeamUser(profile)]),
  );

  return memberIds.map((id) => ({
    id,
    ...(profileById.get(id) ?? mapProfileToTeamUser()),
  }));
}

async function fetchItemsPage(tenantId: string, pageParam: number): Promise<ItemsPage> {
  const { data, error } = await supabase
    .from("case_items")
    .select("id, visible_to_all, subject, summary, resolution_summary, source_channel, source_received_at, status, completion_note, completed_at, priority, due_at, case_file_id, user_id, owner_user_id, intake_payload, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(pageParam, pageParam + PAGE_SIZE - 1);

  if (error) {
    logAndThrowQueryError(error, { scope: "items", tenantId, pageParam });
  }

  const items: CaseItem[] = data ?? [];

  return {
    items,
    nextOffset: buildNextOffset(pageParam, items.length),
  };
}

async function fetchFilesPage(tenantId: string, pageParam: number): Promise<FilesPage> {
  const { data, error } = await supabase
    .from("case_files")
    .select("id, title, status, reference_number, current_status_note, case_type, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .range(pageParam, pageParam + PAGE_SIZE - 1);

  if (error) {
    logAndThrowQueryError(error, { scope: "files", tenantId, pageParam });
  }

  const files: CaseFile[] = data ?? [];

  return {
    files,
    nextOffset: buildNextOffset(pageParam, files.length),
  };
}

function setInfinitePageRows<TPage extends { nextOffset?: number }, TRow>(
  rowsKey: keyof TPage,
  rows: TRow[],
): InfiniteData<TPage, number> {
  return {
    pageParams: [0],
    pages: [{ [rowsKey]: rows, nextOffset: rows.length >= PAGE_SIZE ? rows.length : undefined } as TPage],
  };
}

export const useCaseWorkspaceData = ({ tenantId, userId }: { tenantId?: string; userId?: string }) => {
  const queryClient = useQueryClient();
  const enabled = Boolean(tenantId && userId);

  const itemsQuery = useInfiniteQuery<ItemsPage, Error, ItemsInfiniteData, [string, string | undefined, string], number>({
    queryKey: ["case-workspace", tenantId, "items"],
    queryFn: ({ pageParam = 0 }) => fetchItemsPage(tenantId!, pageParam),
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const filesQuery = useInfiniteQuery<FilesPage, Error, FilesInfiniteData, [string, string | undefined, string], number>({
    queryKey: ["case-workspace", tenantId, "files"],
    queryFn: ({ pageParam = 0 }) => fetchFilesPage(tenantId!, pageParam),
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const teamUsersQuery = useQuery<TeamUser[], Error>({
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

    queryClient.setQueryData<ItemsInfiniteData>(["case-workspace", tenantId, "items"], (current) => {
      const currentItems = current?.pages.flatMap((page) => page.items) ?? [];
      const nextItems = typeof updater === "function" ? updater(currentItems) : updater;
      return setInfinitePageRows<ItemsPage, CaseItem>("items", nextItems);
    });
  }, [queryClient, tenantId]);

  const setCaseFiles = useCallback((updater: CaseFile[] | ((current: CaseFile[]) => CaseFile[])) => {
    if (!tenantId) return;

    queryClient.setQueryData<FilesInfiniteData>(["case-workspace", tenantId, "files"], (current) => {
      const currentFiles = current?.pages.flatMap((page) => page.files) ?? [];
      const nextFiles = typeof updater === "function" ? updater(currentFiles) : updater;
      return setInfinitePageRows<FilesPage, CaseFile>("files", nextFiles);
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
    debugConsole.error("[useCaseWorkspaceData] Failed to load case workspace data", {
      tenantId,
      userId,
      message: error.message,
    }, error);
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
