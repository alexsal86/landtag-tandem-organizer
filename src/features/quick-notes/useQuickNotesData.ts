import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { getNotesRepository, type NotePatch } from "./repository";

export function useQuickNotesData(refreshTrigger?: number) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const client = useQueryClient();
  const repository = useMemo(() => getNotesRepository(client, {
    userId: user?.id ?? "", tenantId: currentTenant?.id ?? "",
  }), [client, user?.id, currentTenant?.id]);
  const enabled = Boolean(user?.id && currentTenant?.id);
  const sync = useSyncExternalStore(repository.subscribe, repository.getSnapshot);
  const query = useQuery({
    queryKey: repository.key, enabled,
    queryFn: ({ signal }) => repository.read(signal),
    staleTime: 30_000, gcTime: 15 * 60_000, networkMode: "always", retry: false,
    refetchOnWindowFocus: true,
  });
  useEffect(() => enabled ? repository.acquire() : undefined, [repository, enabled]);
  // External refresh requests remain compatible; ordinary mutations update one
  // cached note and never route through this full-list refresh.
  useEffect(() => {
    if (enabled && refreshTrigger) void client.invalidateQueries({ queryKey: repository.key });
  }, [client, repository, enabled, refreshTrigger]);
  const patchMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => repository.patch(id, patch), networkMode: "always" });
  const queueMutation = useMutation({ mutationFn: (input: Parameters<typeof repository.queue>[0]) => {
    if (!enabled) throw new Error("Bitte zuerst anmelden und einen Arbeitsbereich wählen");
    return repository.queue(input);
  }, networkMode: "always" });
  const loadNotes = useCallback(async () => { await client.invalidateQueries({ queryKey: repository.key }); }, [client, repository]);
  return {
    notes: enabled ? query.data ?? [] : [], loading: enabled && query.isPending,
    error: query.error, sync, repository, loadNotes,
    setNotes: repository.setNotes,
    patchNote: patchMutation.mutateAsync,
    queueNote: queueMutation.mutateAsync,
  };
}

/** Keeps durable writes moving even when the notes screen is closed. */
export function QuickNotesRuntime() {
  useQuickNotesData();
  return null;
}
