import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { annotationEventLabel, type AnnotationEvent } from "../audit";
import { plainAnnotationComment } from "../mentions";

export function AnnotationAudit({
  documentId,
  threadId,
  authorName,
}: {
  documentId: string;
  threadId?: string;
  authorName: (id: string) => string;
}) {
  const events = useInfiniteQuery({
    queryKey: ["annotation-events", documentId, threadId ?? "all"],
    refetchInterval: 30_000,
    initialPageParam: 0,
    getNextPageParam: (lastPage: AnnotationEvent[], pages) =>
      lastPage.length === 100 ? pages.length : undefined,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from("document_annotation_events")
        .select("*")
        .eq("document_id", documentId);
      if (threadId) query = query.eq("thread_id", threadId);
      const result = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam * 100, pageParam * 100 + 99);
      if (result.error) throw result.error;
      return result.data as unknown as AnnotationEvent[];
    },
  });
  const rows = Array.from(
    new Map(
      (events.data?.pages.flat() ?? []).map((event) => [event.id, event]),
    ).values(),
  );
  const actorIds = Array.from(
    new Set(rows.flatMap((event) => (event.actor_id ? [event.actor_id] : []))),
  )
    .sort()
    .join(",");
  const actors = useQuery({
    queryKey: ["annotation-event-authors", actorIds],
    enabled: !!actorIds,
    staleTime: 300_000,
    queryFn: async () => {
      const result = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", actorIds.split(","));
      if (result.error) throw result.error;
      return Object.fromEntries(
        result.data.map((row) => [
          row.user_id,
          row.display_name ?? "Unbekannt",
        ]),
      );
    },
  });
  return (
    <div
      className="mt-2 max-h-80 space-y-3 overflow-auto rounded border p-2 text-xs"
      onClick={(e) => e.stopPropagation()}
    >
      {events.isLoading ? (
        "Verlauf wird geladen …"
      ) : events.isError ? (
        <p>
          Der Änderungsverlauf ist derzeit nicht verfügbar.
          <button
            type="button"
            className="aw-button"
            onClick={() => {
              void events.refetch();
            }}
          >
            Erneut laden
          </button>
        </p>
      ) : !rows.length ? (
        "Noch keine aufgezeichneten Änderungen. Der Verlauf beginnt mit der Aktivierung dieser Funktion."
      ) : (
        rows.map((event) => (
          <div key={event.id}>
            <p>
              <strong>{annotationEventLabel(event)}</strong>
              {!threadId && <span> · {event.annotation_id.slice(0, 8)}</span>}
            </p>
            <p className="text-muted-foreground">
              {event.actor_id
                ? (actors.data?.[event.actor_id] ?? authorName(event.actor_id))
                : "System"}{" "}
              · {new Date(event.created_at).toLocaleString("de-DE")}
            </p>
            {event.before_data?.content !== event.after_data?.content && (
              <details>
                <summary>Kommentaränderung</summary>
                <p className="whitespace-pre-wrap">
                  Vorher:{" "}
                  {plainAnnotationComment(event.before_data?.content ?? "—")}
                </p>
                <p className="whitespace-pre-wrap">
                  Nachher:{" "}
                  {plainAnnotationComment(event.after_data?.content ?? "—")}
                </p>
              </details>
            )}
          </div>
        ))
      )}
      {events.hasNextPage && (
        <button
          className="aw-button"
          type="button"
          disabled={events.isFetchingNextPage}
          onClick={() => {
            void events.fetchNextPage();
          }}
        >
          Weitere Änderungen laden
        </button>
      )}
    </div>
  );
}
